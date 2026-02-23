import { pool } from "../database.js";
import crypto from "crypto";
import { crearApartadoProveedor } from "./proveedorApartado.controller.js";


const obtenerInventarioProducto = async (id_producto) => {
    const result = await pool.query(`
    SELECT talla,
      SUM(
        CASE 
          WHEN ai.tipo = 'entrada' THEN di.cantidad
          WHEN ai.tipo = 'salida' THEN -di.cantidad
        END
      ) AS cantidad
    FROM ajustes_inventario ai
    JOIN detalle_ajuste_inventario di ON ai.id_ajuste = di.id_ajuste
    WHERE di.id_producto = $1
    GROUP BY talla
  `, [id_producto]);

    return result.rows;
};
export const prepararApartado = async (req, res) => {
    try {
        const { productos } = req.body;

        if (!productos || !Array.isArray(productos)) {
            return res.status(400).json({
                ok: false,
                msg: "Productos inválidos"
            });
        }

        const resultado = [];

        for (const prod of productos) {
            const inventario = await obtenerInventarioProducto(prod.id_producto);

            const inventarioMap = {};
            inventario.forEach(i => {
                inventarioMap[i.talla] = Number(i.cantidad);
            });

            const tallasResultado = {};

            for (const talla in prod.tallas) {
                const necesario = Number(prod.tallas[talla]);
                const disponible = inventarioMap[talla] || 0;

                const apartar = Math.max(0, necesario - disponible);

                // ⛔ si no hay que apartar, luego se puede filtrar en frontend
                tallasResultado[talla] = {
                    necesario,
                    en_inventario: disponible,
                    apartar
                };
            }

            resultado.push({
                id_producto: prod.id_producto,
                tallas: tallasResultado
            });
        }

        res.json({ ok: true, resultado });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            ok: false,
            msg: "Error preparando apartado"
        });
    }
};
// Crear una compra/apartado con múltiples productos
export const crearCompra = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id_proveedor, observaciones, productos } = req.body;

        // Validaciones
        if (!id_proveedor) {
            return res.status(400).json({
                ok: false,
                msg: "ID de proveedor es requerido"
            });
        }

        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: "Debe incluir al menos un producto"
            });
        }

        // Verificar que el proveedor existe
        const proveedor = await client.query(
            "SELECT id_proveedor, nombre, telefono FROM proveedores WHERE id_proveedor = $1",
            [id_proveedor]
        );

        if (proveedor.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Proveedor no encontrado" });
        }

        await client.query('BEGIN');

        // Validar y calcular total
        let totalCompra = 0;
        const productosValidados = [];

        for (const prod of productos) {
            const { id_producto, cantidad, precio_unitario } = prod;

            // Validaciones del producto
            if (!id_producto || !cantidad || !precio_unitario) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    ok: false,
                    msg: "Cada producto debe tener id_producto, cantidad y precio_unitario"
                });
            }

            if (cantidad <= 0 || precio_unitario <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    ok: false,
                    msg: "Cantidad y precio deben ser mayores a 0"
                });
            }

            // Verificar que el producto existe
            const producto = await client.query(
                "SELECT id_producto, nombre FROM productos WHERE id_producto = $1",
                [id_producto]
            );

            if (producto.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    ok: false,
                    msg: `Producto con ID ${id_producto} no encontrado`
                });
            }

            // Verificar que el proveedor maneja este producto
            const relacion = await client.query(
                `SELECT precio_proveedor 
                 FROM productos_proveedores 
                 WHERE id_producto = $1 AND id_proveedor = $2 AND activo = true`,
                [id_producto, id_proveedor]
            );

            if (relacion.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    ok: false,
                    msg: `El proveedor no maneja el producto "${producto.rows[0].nombre}"`
                });
            }

            // Advertencia si el precio es diferente al configurado
            const precioConfiguracion = parseFloat(relacion.rows[0].precio_proveedor);
            if (Math.abs(precio_unitario - precioConfiguracion) > 0.01) {
                console.warn(`Advertencia: Precio diferente para producto ${id_producto}. Configurado: ${precioConfiguracion}, Recibido: ${precio_unitario}`);
            }

            const subtotal = cantidad * precio_unitario;
            totalCompra += subtotal;

            productosValidados.push({
                id_producto,
                nombre: producto.rows[0].nombre,
                cantidad,
                precio_unitario,
                subtotal
            });
        }

        // Crear registro de compra
        const compra = await client.query(
            `INSERT INTO compras (id_proveedor, fecha_compra, total_compra, observaciones) 
             VALUES ($1, CURRENT_DATE, $2, $3) 
             RETURNING *`,
            [id_proveedor, totalCompra, observaciones || null]
        );

        const nuevaCompra = compra.rows[0];

        // Insertar detalles de la compra
        const detallesCreados = [];
        for (const prod of productosValidados) {
            const detalle = await client.query(
                `INSERT INTO detalle_compras 
                 (id_compra, id_producto, cantidad, precio_unitario, subtotal, cantidad_recibida, estado) 
                 VALUES ($1, $2, $3, $4, $5, 0, 'pendiente') 
                 RETURNING *`,
                [nuevaCompra.id_compra, prod.id_producto, prod.cantidad, prod.precio_unitario, prod.subtotal]
            );

            detallesCreados.push({
                ...detalle.rows[0],
                nombre_producto: prod.nombre
            });
        }

        // ── Crear apartado de proveedor automáticamente ──
        // Talla 0 = genérica (la columna talla es INTEGER en BD)
        const productosParaApartar = productosValidados.map(p => ({
            id_producto: p.id_producto,
            tallas: { 0: p.cantidad }
        }));

        const apartado = await crearApartadoProveedor({
            client,
            id_compra: nuevaCompra.id_compra,
            id_proveedor,
            productos: productosParaApartar
        });

        await client.query('COMMIT');

        // ── Generar link de WhatsApp ──
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const linkApartado = `${baseUrl}/proveedor/apartado/${apartado.token}`;
        const nombreProv = proveedor.rows[0].nombre;
        const telefonoProv = proveedor.rows[0].telefono;
        const mensajeWsp = `Hola ${nombreProv} 👋\n\nTenemos un pedido pendiente de confirmación.\n\nPor favor indícanos disponibilidad en el siguiente enlace:\n👉 ${linkApartado}\n\nGracias.`;
        const linkWhatsapp = telefonoProv
            ? `https://wa.me/57${telefonoProv}?text=${encodeURIComponent(mensajeWsp)}`
            : null;

        res.status(201).json({
            ok: true,
            msg: "Compra creada exitosamente",
            id_apartado: apartado.id_apartado,
            link_whatsapp: linkWhatsapp,
            compra: {
                ...nuevaCompra,
                proveedor: nombreProv,
                detalles: detallesCreados
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al crear compra" });
    } finally {
        client.release();
    }
};

export const crearApartadoConTallas = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id_proveedor, observaciones, productos } = req.body;

        if (!id_proveedor || !productos || !Array.isArray(productos)) {
            return res.status(400).json({
                ok: false,
                msg: "Datos incompletos para crear el apartado"
            });
        }

        await client.query("BEGIN");

        // Crear compra (apartado)
        const compraResult = await client.query(
            `INSERT INTO compras (id_proveedor, fecha_compra, total_compra, observaciones)
       VALUES ($1, CURRENT_DATE, 0, $2)
       RETURNING id_compra`,
            [id_proveedor, observaciones || null]
        );

        const id_compra = compraResult.rows[0].id_compra;
        // 📦 Crear apartado proveedor (MISMA TRANSACCIÓN)
        const apartado = await crearApartadoProveedor({
            client,
            id_compra,
            id_proveedor,
            productos
        });
        let totalCompra = 0;

        for (const producto of productos) {
            const { id_producto, precio_unitario, tallas } = producto;

            if (!id_producto || !precio_unitario || !tallas) {
                throw new Error("Producto mal formado");
            }

            // Calcular cantidad total del producto
            let cantidadTotal = 0;
            Object.values(tallas).forEach(c => {
                cantidadTotal += Number(c);
            });

            const subtotal = cantidadTotal * precio_unitario;
            totalCompra += subtotal;

            // Crear detalle_compra
            const detalleResult = await client.query(
                `INSERT INTO detalle_compras
         (id_compra, id_producto, cantidad, precio_unitario, subtotal, estado)
         VALUES ($1, $2, $3, $4, $5, 'pendiente_confirmacion')
         RETURNING id_detalle`,
                [id_compra, id_producto, cantidadTotal, precio_unitario, subtotal]
            );

            const id_detalle = detalleResult.rows[0].id_detalle;

            // Insertar tallas
            for (const talla in tallas) {
                const cantidad = Number(tallas[talla]);

                if (cantidad > 0) {
                    await client.query(
                        `INSERT INTO detalle_compra_talla
             (id_detalle, talla, cantidad, estado)
             VALUES ($1, $2, $3, 'pendiente_confirmacion')`,
                        [id_detalle, talla, cantidad]
                    );
                }
            }
        }

        // Actualizar total de la compra
        await client.query(
            `UPDATE compras SET total_compra = $1 WHERE id_compra = $2`,
            [totalCompra, id_compra]
        );


        // 📞 Obtener proveedor
        const proveedorResult = await client.query(
            "SELECT nombre, telefono FROM proveedores WHERE id_proveedor = $1",
            [id_proveedor]
        );

        const proveedor = proveedorResult.rows[0];

        // 🔗 Crear link de WhatsApp
        const mensaje = `
    Hola ${proveedor.nombre} 👋

    Tenemos un pedido pendiente de confirmación.

    Por favor indica disponibilidad en el siguiente enlace:
    👉 http://localhost:3000/proveedor/apartado/${apartado.token}

    Gracias.
    `;

        const linkWhatsApp = `https://wa.me/57${proveedor.telefono}?text=${encodeURIComponent(mensaje)}`;

        await client.query("COMMIT");



        res.status(201).json({
            ok: true,
            msg: "Apartado creado correctamente",
            id_compra,
            id_apartado: apartado.id_apartado,
            token: apartado.token,
            link_whatsapp: linkWhatsApp
        });


    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({
            ok: false,
            msg: "Error al crear apartado"
        });
    } finally {
        client.release();
    }
};


// Obtener todas las compras
export const obtenerCompras = async (req, res) => {
    try {
        const { estado } = req.query; // Filtro opcional por estado

        let query = `
            SELECT 
                c.id_compra,
                c.fecha_compra,
                c.total_compra,
                c.observaciones,
                p.id_proveedor,
                p.nombre as proveedor,
                COUNT(dc.id_detalle) as total_items,
                SUM(dc.cantidad) as total_pares,
                SUM(dc.cantidad_recibida) as total_recibidos,
                CASE 
                    WHEN SUM(dc.cantidad) = SUM(dc.cantidad_recibida) THEN 'recibido'
                    WHEN SUM(dc.cantidad_recibida) > 0 THEN 'parcial'
                    ELSE 'pendiente'
                END as estado_general
            FROM compras c
            INNER JOIN proveedores p ON c.id_proveedor = p.id_proveedor
            LEFT JOIN detalle_compras dc ON c.id_compra = dc.id_compra
        `;

        const params = [];

        if (estado) {
            // Filtrar por estado si se proporciona
            query += ` WHERE 1=1 `;
            if (estado === 'pendiente') {
                query += ` AND dc.estado = 'pendiente'`;
            } else if (estado === 'recibido') {
                query += ` AND dc.estado = 'recibido'`;
            } else if (estado === 'parcial') {
                query += ` AND dc.estado = 'parcial'`;
            }
        }

        query += `
            GROUP BY c.id_compra, p.id_proveedor
            ORDER BY c.fecha_compra DESC
        `;

        const result = await pool.query(query, params);

        res.json({ ok: true, compras: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener compras" });
    }
};

// Obtener detalle de una compra específica
export const obtenerCompraPorId = async (req, res) => {
    try {
        const { id } = req.params;

        // Datos de la compra
        const compra = await pool.query(`
            SELECT 
                c.*,
                p.nombre as proveedor,
                p.telefono as telefono_proveedor,
                p.cedula as cedula_proveedor
            FROM compras c
            INNER JOIN proveedores p ON c.id_proveedor = p.id_proveedor
            WHERE c.id_compra = $1
        `, [id]);

        if (compra.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
        }

        // Detalles de la compra
        const detalles = await pool.query(`
            SELECT 
                dc.*,
                prod.nombre as producto,
                prod.descripcion,
                prod.ruta_foto,
                (dc.cantidad - dc.cantidad_recibida) as pendiente_recibir
            FROM detalle_compras dc
            INNER JOIN productos prod ON dc.id_producto = prod.id_producto
            WHERE dc.id_compra = $1
            ORDER BY dc.id_detalle
        `, [id]);

        res.json({
            ok: true,
            compra: compra.rows[0],
            detalles: detalles.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener compra" });
    }
};

// Registrar recepción de productos
export const registrarRecepcion = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params; // id_compra
        const { detalles } = req.body; // Array con id_detalle y cantidad_recibida

        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: "Debe incluir los detalles de recepción"
            });
        }

        await client.query('BEGIN');

        // Verificar que la compra existe
        const compra = await client.query(
            "SELECT id_compra FROM compras WHERE id_compra = $1",
            [id]
        );

        if (compra.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
        }

        for (const detalle of detalles) {
            const { id_detalle, cantidad_recibida } = detalle;

            if (!id_detalle || cantidad_recibida === undefined) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    ok: false,
                    msg: "Cada detalle debe tener id_detalle y cantidad_recibida"
                });
            }

            if (cantidad_recibida < 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    ok: false,
                    msg: "La cantidad recibida no puede ser negativa"
                });
            }

            // Obtener el detalle actual
            const detalleActual = await client.query(
                "SELECT cantidad, cantidad_recibida FROM detalle_compras WHERE id_detalle = $1 AND id_compra = $2",
                [id_detalle, id]
            );

            if (detalleActual.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    ok: false,
                    msg: `Detalle ${id_detalle} no encontrado en esta compra`
                });
            }

            const cantidadTotal = detalleActual.rows[0].cantidad;
            const recibidoPrevio = detalleActual.rows[0].cantidad_recibida || 0;
            const nuevaCantidadRecibida = recibidoPrevio + cantidad_recibida;

            // Validar que no se exceda la cantidad apartada
            if (nuevaCantidadRecibida > cantidadTotal) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    ok: false,
                    msg: `La cantidad recibida excede la cantidad apartada para el detalle ${id_detalle}`
                });
            }

            // Determinar nuevo estado
            let nuevoEstado = 'pendiente';
            if (nuevaCantidadRecibida === cantidadTotal) {
                nuevoEstado = 'recibido';
            } else if (nuevaCantidadRecibida > 0) {
                nuevoEstado = 'parcial';
            }

            // Actualizar el detalle
            await client.query(
                `UPDATE detalle_compras 
                 SET cantidad_recibida = $1, estado = $2 
                 WHERE id_detalle = $3`,
                [nuevaCantidadRecibida, nuevoEstado, id_detalle]
            );
        }

        await client.query('COMMIT');

        res.json({
            ok: true,
            msg: "Recepción registrada exitosamente"
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al registrar recepción" });
    } finally {
        client.release();
    }
};

// Actualizar foto de evidencia de un detalle
export const actualizarFotoEvidencia = async (req, res) => {
    try {
        const { id, id_detalle } = req.params;
        // Acepta archivo subido por multer O URL en body
        const foto_evidencia = req.file
            ? `/imagenes/${req.file.filename}`
            : req.body.foto_evidencia;

        if (!foto_evidencia) {
            return res.status(400).json({ ok: false, msg: "No se recibió foto" });
        }

        const result = await pool.query(
            `UPDATE detalle_compras SET foto_evidencia = $1
             WHERE id_detalle = $2 AND id_compra = $3 RETURNING *`,
            [foto_evidencia, id_detalle, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Detalle no encontrado" });
        }

        res.json({ ok: true, msg: "Foto guardada", foto_evidencia });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al guardar foto" });
    }
};

// Obtener compras de un proveedor específico
export const obtenerComprasPorProveedor = async (req, res) => {
    try {
        const { id_proveedor } = req.params;

        const result = await pool.query(`
            SELECT 
                c.id_compra,
                c.fecha_compra,
                c.total_compra,
                c.observaciones,
                COUNT(dc.id_detalle) as total_items,
                SUM(dc.cantidad) as total_pares,
                SUM(dc.cantidad_recibida) as total_recibidos,
                CASE 
                    WHEN SUM(dc.cantidad) = SUM(dc.cantidad_recibida) THEN 'recibido'
                    WHEN SUM(dc.cantidad_recibida) > 0 THEN 'parcial'
                    ELSE 'pendiente'
                END as estado_general
            FROM compras c
            LEFT JOIN detalle_compras dc ON c.id_compra = dc.id_compra
            WHERE c.id_proveedor = $1
            GROUP BY c.id_compra
            ORDER BY c.fecha_compra DESC
        `, [id_proveedor]);

        res.json({ ok: true, compras: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener compras del proveedor" });
    }
};

// Eliminar una compra (solo si no tiene recepciones)
export const eliminarCompra = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        await client.query('BEGIN');

        // Verificar si tiene recepciones
        const recepciones = await client.query(
            "SELECT SUM(cantidad_recibida) as total FROM detalle_compras WHERE id_compra = $1",
            [id]
        );

        if (parseInt(recepciones.rows[0].total) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                ok: false,
                msg: "No se puede eliminar una compra que ya tiene productos recibidos"
            });
        }

        // Eliminar detalles
        await client.query("DELETE FROM detalle_compras WHERE id_compra = $1", [id]);

        // Eliminar compra
        const result = await client.query(
            "DELETE FROM compras WHERE id_compra = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
        }

        await client.query('COMMIT');

        res.json({ ok: true, msg: "Compra eliminada exitosamente" });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar compra" });
    } finally {
        client.release();
    }
};