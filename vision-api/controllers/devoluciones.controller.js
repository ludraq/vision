import { pool } from "../database.js";

// Registrar devolución a proveedor con detalle de productos
export const registrarDevolucion = async (req, res) => {
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
                msg: "Debe incluir al menos un producto a devolver" 
            });
        }

        // Verificar que el proveedor existe
        const proveedor = await client.query(
            "SELECT id_proveedor, nombre FROM proveedores WHERE id_proveedor = $1",
            [id_proveedor]
        );

        if (proveedor.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Proveedor no encontrado" });
        }

        await client.query('BEGIN');

        // Validar productos y calcular monto total
        let montoTotal = 0;
        const productosValidados = [];

        for (const prod of productos) {
            const { id_producto, cantidad } = prod;

            // Validaciones
            if (!id_producto || !cantidad) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    ok: false, 
                    msg: "Cada producto debe tener id_producto y cantidad" 
                });
            }

            if (cantidad <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    ok: false, 
                    msg: "La cantidad debe ser mayor a 0" 
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

            // Obtener el precio al que se le compró a este proveedor (último precio)
            const precioProveedor = await client.query(
                `SELECT dc.precio_unitario
                 FROM detalle_compras dc
                 INNER JOIN compras c ON dc.id_compra = c.id_compra
                 WHERE dc.id_producto = $1 AND c.id_proveedor = $2
                 ORDER BY c.fecha_compra DESC
                 LIMIT 1`,
                [id_producto, id_proveedor]
            );

            if (precioProveedor.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    ok: false, 
                    msg: `No hay registro de compras del producto "${producto.rows[0].nombre}" con este proveedor` 
                });
            }

            const precioUnitario = parseFloat(precioProveedor.rows[0].precio_unitario);
            const subtotal = cantidad * precioUnitario;
            montoTotal += subtotal;

            productosValidados.push({
                id_producto,
                nombre: producto.rows[0].nombre,
                cantidad,
                precio_unitario: precioUnitario,
                subtotal
            });
        }

        // Verificar que el proveedor tenga deuda suficiente
        const deuda = await client.query(`
            SELECT 
                COALESCE((SELECT SUM(c.total_compra) FROM compras c WHERE c.id_proveedor = $1), 0) -
                COALESCE((SELECT SUM(a.monto_abono) FROM abonos a WHERE a.id_proveedor = $1), 0) -
                COALESCE((SELECT SUM(d.monto) FROM devoluciones d WHERE d.id_proveedor = $1), 0)
                as deuda_actual
        `, [id_proveedor]);

        const deudaActual = parseFloat(deuda.rows[0].deuda_actual);

        if (montoTotal > deudaActual) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                ok: false, 
                msg: `El monto de devolución ($${montoTotal.toLocaleString()}) excede la deuda actual ($${deudaActual.toLocaleString()})` 
            });
        }

        // Crear registro de devolución
        const devolucion = await client.query(
            `INSERT INTO devoluciones (id_proveedor, fecha_devolucion, monto, observaciones) 
             VALUES ($1, CURRENT_DATE, $2, $3) 
             RETURNING *`,
            [id_proveedor, montoTotal, observaciones || null]
        );

        const nuevaDevolucion = devolucion.rows[0];

        // Insertar detalle de devoluciones
        const detallesCreados = [];
        for (const prod of productosValidados) {
            const detalle = await client.query(
                `INSERT INTO detalle_devoluciones 
                 (id_devolucion, id_producto, cantidad, precio_unitario, subtotal) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING *`,
                [nuevaDevolucion.id_devolucion, prod.id_producto, prod.cantidad, prod.precio_unitario, prod.subtotal]
            );
            
            detallesCreados.push({
                ...detalle.rows[0],
                nombre_producto: prod.nombre
            });
        }

        await client.query('COMMIT');

        res.status(201).json({ 
            ok: true, 
            msg: "Devolución registrada exitosamente",
            devolucion: {
                ...nuevaDevolucion,
                proveedor: proveedor.rows[0].nombre,
                detalles: detallesCreados
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al registrar devolución" });
    } finally {
        client.release();
    }
};

// Obtener todas las devoluciones
export const obtenerDevoluciones = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                d.id_devolucion,
                d.fecha_devolucion,
                d.monto,
                d.observaciones,
                p.id_proveedor,
                p.nombre as proveedor,
                p.telefono as telefono_proveedor,
                COUNT(dd.id_detalle_devolucion) as total_items,
                SUM(dd.cantidad) as total_pares
            FROM devoluciones d
            INNER JOIN proveedores p ON d.id_proveedor = p.id_proveedor
            LEFT JOIN detalle_devoluciones dd ON d.id_devolucion = dd.id_devolucion
            GROUP BY d.id_devolucion, p.id_proveedor
            ORDER BY d.fecha_devolucion DESC
        `);

        res.json({ ok: true, devoluciones: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener devoluciones" });
    }
};

// Obtener devolución por ID con detalle
export const obtenerDevolucionPorId = async (req, res) => {
    try {
        const { id } = req.params;

        // Datos de la devolución
        const devolucion = await pool.query(`
            SELECT 
                d.*,
                p.nombre as proveedor,
                p.telefono as telefono_proveedor,
                p.cedula as cedula_proveedor,
                p.direccion as direccion_proveedor
            FROM devoluciones d
            INNER JOIN proveedores p ON d.id_proveedor = p.id_proveedor
            WHERE d.id_devolucion = $1
        `, [id]);

        if (devolucion.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Devolución no encontrada" });
        }

        // Detalle de productos devueltos
        const detalles = await pool.query(`
            SELECT 
                dd.*,
                prod.nombre as producto,
                prod.descripcion,
                prod.ruta_foto
            FROM detalle_devoluciones dd
            INNER JOIN productos prod ON dd.id_producto = prod.id_producto
            WHERE dd.id_devolucion = $1
            ORDER BY dd.id_detalle_devolucion
        `, [id]);

        res.json({
            ok: true,
            devolucion: devolucion.rows[0],
            detalles: detalles.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener devolución" });
    }
};

// Obtener devoluciones de un proveedor específico
export const obtenerDevolucionesPorProveedor = async (req, res) => {
    try {
        const { id_proveedor } = req.params;

        const result = await pool.query(`
            SELECT 
                d.id_devolucion,
                d.fecha_devolucion,
                d.monto,
                d.observaciones,
                COUNT(dd.id_detalle_devolucion) as total_items,
                SUM(dd.cantidad) as total_pares
            FROM devoluciones d
            LEFT JOIN detalle_devoluciones dd ON d.id_devolucion = dd.id_devolucion
            WHERE d.id_proveedor = $1
            GROUP BY d.id_devolucion
            ORDER BY d.fecha_devolucion DESC
        `, [id_proveedor]);

        // Calcular total devuelto
        const total = await pool.query(
            "SELECT COALESCE(SUM(monto), 0) as total_devuelto FROM devoluciones WHERE id_proveedor = $1",
            [id_proveedor]
        );

        res.json({ 
            ok: true, 
            devoluciones: result.rows,
            total_devuelto: total.rows[0].total_devuelto
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener devoluciones del proveedor" });
    }
};

// Eliminar devolución (solo si fue un error)
export const eliminarDevolucion = async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { id } = req.params;

        await client.query('BEGIN');

        // Eliminar detalles primero
        await client.query("DELETE FROM detalle_devoluciones WHERE id_devolucion = $1", [id]);

        // Eliminar devolución
        const result = await client.query(
            "DELETE FROM devoluciones WHERE id_devolucion = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ ok: false, msg: "Devolución no encontrada" });
        }

        await client.query('COMMIT');

        res.json({ 
            ok: true, 
            msg: "Devolución eliminada exitosamente",
            devolucion: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar devolución" });
    } finally {
        client.release();
    }
};

// Obtener resumen de movimientos de un proveedor
export const obtenerResumenProveedor = async (req, res) => {
    try {
        const { id_proveedor } = req.params;

        // Verificar que existe
        const proveedor = await pool.query(
            "SELECT * FROM proveedores WHERE id_proveedor = $1",
            [id_proveedor]
        );

        if (proveedor.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Proveedor no encontrado" });
        }

        // Totales
        const totales = await pool.query(`
            SELECT 
                COALESCE((SELECT SUM(c.total_compra) FROM compras c WHERE c.id_proveedor = $1), 0) as total_comprado,
                COALESCE((SELECT SUM(a.monto_abono) FROM abonos a WHERE a.id_proveedor = $1), 0) as total_abonado,
                COALESCE((SELECT SUM(d.monto) FROM devoluciones d WHERE d.id_proveedor = $1), 0) as total_devuelto
        `, [id_proveedor]);

        const total_comprado = parseFloat(totales.rows[0].total_comprado);
        const total_abonado = parseFloat(totales.rows[0].total_abonado);
        const total_devuelto = parseFloat(totales.rows[0].total_devuelto);
        const deuda_actual = total_comprado - total_abonado - total_devuelto;

        // Últimos movimientos
        const compras = await pool.query(
            "SELECT id_compra, fecha_compra, total_compra FROM compras WHERE id_proveedor = $1 ORDER BY fecha_compra DESC LIMIT 5",
            [id_proveedor]
        );

        const abonos = await pool.query(
            "SELECT id_abono, fecha_abono, monto_abono FROM abonos WHERE id_proveedor = $1 ORDER BY fecha_abono DESC LIMIT 5",
            [id_proveedor]
        );

        const devoluciones = await pool.query(
            "SELECT id_devolucion, fecha_devolucion, monto FROM devoluciones WHERE id_proveedor = $1 ORDER BY fecha_devolucion DESC LIMIT 5",
            [id_proveedor]
        );

        res.json({
            ok: true,
            proveedor: proveedor.rows[0],
            resumen: {
                total_comprado,
                total_abonado,
                total_devuelto,
                deuda_actual
            },
            ultimos_movimientos: {
                compras: compras.rows,
                abonos: abonos.rows,
                devoluciones: devoluciones.rows
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener resumen" });
    }
};