import { pool } from "../database.js";
import { registrarMovimientoInventario } from "./inventario.controller.js";
import { crearApartadoProveedor } from "./proveedorApartado.controller.js";

const verificarYDescontarInventario = async ({ client, id_usuario, productos }) => {
    const productosParaApartado = {};

    for (const prod of productos) {
        const { id_producto, talla, cantidad, id_proveedor } = prod;

        const inventario = await client.query(`
            SELECT COALESCE(SUM(
                CASE 
                    WHEN ai.tipo = 'entrada' THEN di.cantidad
                    WHEN ai.tipo = 'salida' THEN -di.cantidad
                END
            ), 0) AS stock
            FROM ajustes_inventario ai
            JOIN detalle_ajuste_inventario di ON ai.id_ajuste = di.id_ajuste
            WHERE di.id_producto = $1 AND di.talla = $2
        `, [id_producto, talla]);

        const stock = parseInt(inventario.rows[0].stock) || 0;
        const enInventario = Math.min(stock, cantidad);
        const apartar = cantidad - enInventario;

        if (enInventario > 0) {
            const ajuste = await client.query(
                `INSERT INTO ajustes_inventario (tipo, motivo, observaciones, id_usuario)
                 VALUES ('salida', 'pedido', 'Salida automática por pedido', $1)
                 RETURNING id_ajuste`,
                [id_usuario]
            );
            await client.query(
                `INSERT INTO detalle_ajuste_inventario (id_ajuste, id_producto, talla, cantidad)
                 VALUES ($1, $2, $3, $4)`,
                [ajuste.rows[0].id_ajuste, id_producto, talla, enInventario]
            );
        }

        if (apartar > 0 && id_proveedor) {
            if (!productosParaApartado[id_proveedor]) {
                productosParaApartado[id_proveedor] = [];
            }
            const existing = productosParaApartado[id_proveedor].find(
                p => p.id_producto === id_producto
            );
            if (existing) {
                existing.tallas[talla] = (existing.tallas[talla] || 0) + apartar;
            } else {
                productosParaApartado[id_proveedor].push({
                    id_producto,
                    precio_unitario: prod.precio_unitario || 0,
                    tallas: { [talla]: apartar }
                });
            }
        }
    }

    return productosParaApartado;
};

export const crearPedido = async (req, res) => {
    const client = await pool.connect();

    try {
        const id_usuario = req.usuario.id_usuario;
        const {
            nombre_cliente,
            cedula_cliente,
            celular_cliente,
            ciudad_destino,
            direccion_cliente,
            id_transportadora,
            costo_envio,
            valor_publicidad,
            productos
        } = req.body;

        if (!nombre_cliente || !celular_cliente || !ciudad_destino || !direccion_cliente) {
            return res.status(400).json({ ok: false, msg: "Nombre, celular, ciudad y dirección del cliente son requeridos" });
        }
        if (!id_transportadora) {
            return res.status(400).json({ ok: false, msg: "La transportadora es requerida" });
        }
        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ ok: false, msg: "Debe incluir al menos un producto" });
        }

        const config = await pool.query("SELECT comision_base FROM configuracion WHERE id_config = 1");
        const comision = config.rows.length > 0 ? config.rows[0].comision_base : 0;

        await client.query("BEGIN");

        // 1. Crear o encontrar cliente
        let id_cliente;
        const clienteExiste = cedula_cliente
            ? await client.query("SELECT id_cliente FROM clientes WHERE cedula = $1", [cedula_cliente])
            : await client.query("SELECT id_cliente FROM clientes WHERE nombre = $1 AND celular = $2", [nombre_cliente, celular_cliente]);

        if (clienteExiste.rows.length > 0) {
            id_cliente = clienteExiste.rows[0].id_cliente;
            await client.query(
                `UPDATE clientes SET nombre = $1, celular = $2, direccion = $3, 
                 ciudad = $4, fecha_ultimo_pedido = CURRENT_DATE WHERE id_cliente = $5`,
                [nombre_cliente, celular_cliente, direccion_cliente, ciudad_destino, id_cliente]
            );
        } else {
            const nuevoCliente = await client.query(
                `INSERT INTO clientes (nombre, cedula, celular, direccion, ciudad, fecha_ultimo_pedido)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) RETURNING id_cliente`,
                [nombre_cliente, cedula_cliente || null, celular_cliente, direccion_cliente, ciudad_destino]
            );
            id_cliente = nuevoCliente.rows[0].id_cliente;
        }

        // 2. Calcular totales
        let valor_productos = 0;
        for (const prod of productos) {
            valor_productos += prod.cantidad * prod.precio_unitario;
        }
        const costo_total = valor_productos + (parseFloat(costo_envio) || 0);

        // 3. Crear pedido
        const pedido = await client.query(
            `INSERT INTO pedidos 
                (fecha_venta, estado_envio, costo_envio, costo_total,
                 id_cliente, id_usuario, id_transportadora, valor_publicidad, comision)
             VALUES (CURRENT_DATE, 'Pendiente', $1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [parseFloat(costo_envio) || 0, costo_total, id_cliente, id_usuario,
                id_transportadora, parseFloat(valor_publicidad) || 0, comision]
        );
        const id_pedido = pedido.rows[0].id_pedido;

        // 4. Insertar detalle de productos del pedido
        for (const prod of productos) {
            const subtotal = prod.cantidad * prod.precio_unitario;
            await client.query(
                `INSERT INTO detalle_pedidos (id_pedido, id_producto, talla, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [id_pedido, prod.id_producto, prod.talla, prod.cantidad, prod.precio_unitario, subtotal]
            );
        }

        // 5. Verificar inventario y acumular lo que hay que apartar
        const apartadosPorProveedor = await verificarYDescontarInventario({
            client,
            id_usuario,
            productos
        });

        // 6. Crear compra + detalles + apartado por cada proveedor
        const apartadosCreados = [];
        for (const [id_proveedor, prods] of Object.entries(apartadosPorProveedor)) {

            // ── Calcular total real de la compra ──
            const totalCompraProveedor = prods.reduce((sum, p) => {
                const cantidadTotal = Object.values(p.tallas).reduce((s, c) => s + Number(c), 0);
                return sum + (cantidadTotal * (p.precio_unitario || 0));
            }, 0);

            // ── Crear registro de compra con total real ──
            const compra = await client.query(
                `INSERT INTO compras (id_proveedor, fecha_compra, total_compra, observaciones)
                 VALUES ($1, CURRENT_DATE, $2, 'Apartado automático por pedido')
                 RETURNING id_compra`,
                [id_proveedor, totalCompraProveedor]
            );
            const id_compra = compra.rows[0].id_compra;

            // ── Insertar detalles de la compra ──
            for (const prod of prods) {
                const cantidadTotal = Object.values(prod.tallas).reduce((s, c) => s + Number(c), 0);
                const subtotal = cantidadTotal * (prod.precio_unitario || 0);

                await client.query(
                    `INSERT INTO detalle_compras 
                     (id_compra, id_producto, cantidad, precio_unitario, subtotal, cantidad_recibida, estado)
                     VALUES ($1, $2, $3, $4, $5, 0, 'pendiente')`,
                    [id_compra, prod.id_producto, cantidadTotal, prod.precio_unitario || 0, subtotal]
                );
            }

            // ── Crear apartado al proveedor ──
            const apartado = await crearApartadoProveedor({
                client,
                id_compra,
                id_proveedor: parseInt(id_proveedor),
                productos: prods
            });

            apartadosCreados.push({
                id_proveedor: parseInt(id_proveedor),
                id_apartado: apartado.id_apartado,
                token: apartado.token
            });
        }

        await client.query("COMMIT");

        res.status(201).json({
            ok: true,
            msg: "Pedido creado exitosamente",
            pedido: pedido.rows[0],
            apartados: apartadosCreados
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al crear pedido" });
    } finally {
        client.release();
    }
};

export const obtenerPedidos = async (req, res) => {
    try {
        const { id_usuario, rol } = req.usuario;
        const roles = req.usuario.roles || [];
        const esAdmin = roles.includes('administrador');
        const { estado, fecha_inicio, fecha_fin, buscar } = req.query;

        let condiciones = [];
        let params = [];
        let contador = 1;

        if (!esAdmin) {
            condiciones.push(`p.id_usuario = $${contador++}`);
            params.push(id_usuario);
        }
        if (estado) {
            condiciones.push(`p.estado_envio = $${contador++}`);
            params.push(estado);
        }
        if (fecha_inicio) {
            condiciones.push(`p.fecha_venta >= $${contador++}`);
            params.push(fecha_inicio);
        }
        if (fecha_fin) {
            condiciones.push(`p.fecha_venta <= $${contador++}`);
            params.push(fecha_fin);
        }
        if (buscar) {
            condiciones.push(`(
                LOWER(c.nombre) LIKE LOWER($${contador}) OR
                CAST(p.numero_guia AS TEXT) LIKE $${contador} OR
                c.celular LIKE $${contador}
            )`);
            params.push(`%${buscar}%`);
            contador++;
        }

        const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

        const result = await pool.query(`
            SELECT 
                p.id_pedido, p.numero_guia, p.fecha_venta, p.estado_envio,
                p.fecha_estado, p.costo_envio, p.costo_total, p.valor_publicidad,
                p.comision, p.razon_cliente, p.fecha_razon, p.observaciones,
                c.nombre AS nombre_cliente, c.cedula AS cedula_cliente,
                c.celular AS celular_cliente, c.ciudad AS ciudad_destino,
                c.direccion AS direccion_cliente,
                u.nombre AS nombre_asesor, u.usuario AS usuario_asesor,
                t.nombre AS transportadora, t.url_seguimiento, t.usuario AS nombre_cuenta,
                COALESCE(SUM(dp.cantidad), 0) AS cantidad_pares,
                COALESCE(SUM(dp.subtotal), 0) AS valor_productos
            FROM pedidos p
            INNER JOIN clientes c ON p.id_cliente = c.id_cliente
            INNER JOIN usuario u ON p.id_usuario = u.id_usuario
            INNER JOIN transportadoras t ON p.id_transportadora = t.id_transportadora
            LEFT JOIN detalle_pedidos dp ON p.id_pedido = dp.id_pedido
            ${where}
            GROUP BY p.id_pedido, c.id_cliente, u.id_usuario, t.id_transportadora
            ORDER BY p.fecha_venta DESC, p.id_pedido DESC
        `, params);

        const pedidos = result.rows.map(p => {
            const valor_a_recaudar = parseFloat(p.valor_productos) || 0;
            const valor_total = valor_a_recaudar + parseFloat(p.costo_envio || 0);
            const utilidad = valor_a_recaudar
                - parseFloat(p.valor_publicidad || 0)
                - parseFloat(p.comision || 0);
            return { ...p, valor_a_recaudar, valor_total, utilidad };
        });

        res.json({ ok: true, pedidos, total: pedidos.length });

    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener pedidos" });
    }
};

export const obtenerPedidoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const roles = req.usuario.roles || [];
        const esAdmin = roles.includes('administrador');

        const pedido = await pool.query(`
            SELECT p.*, c.nombre AS nombre_cliente, c.cedula AS cedula_cliente,
                c.celular AS celular_cliente, c.ciudad AS ciudad_destino,
                c.direccion AS direccion_cliente, u.nombre AS nombre_asesor,
                u.usuario AS usuario_asesor, t.nombre AS transportadora,
                t.url_seguimiento, t.usuario AS nombre_cuenta
            FROM pedidos p
            INNER JOIN clientes c ON p.id_cliente = c.id_cliente
            INNER JOIN usuario u ON p.id_usuario = u.id_usuario
            INNER JOIN transportadoras t ON p.id_transportadora = t.id_transportadora
            WHERE p.id_pedido = $1
        `, [id]);

        if (pedido.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Pedido no encontrado" });
        }

        if (!esAdmin && pedido.rows[0].id_usuario !== req.usuario.id_usuario) {
            return res.status(403).json({ ok: false, msg: "No tienes permiso para ver este pedido" });
        }

        const detalle = await pool.query(`
            SELECT dp.*, pr.nombre AS nombre_producto, pr.ruta_foto
            FROM detalle_pedidos dp
            INNER JOIN productos pr ON dp.id_producto = pr.id_producto
            WHERE dp.id_pedido = $1
        `, [id]);

        const p = pedido.rows[0];
        const valor_a_recaudar = detalle.rows.reduce((acc, d) => acc + parseFloat(d.subtotal), 0);
        const valor_total = valor_a_recaudar + parseFloat(p.costo_envio || 0);
        const utilidad = valor_a_recaudar
            - parseFloat(p.valor_publicidad || 0)
            - parseFloat(p.comision || 0);

        res.json({
            ok: true,
            pedido: { ...p, valor_a_recaudar, valor_total, utilidad },
            detalle: detalle.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener pedido" });
    }
};

export const actualizarPedido = async (req, res) => {
    try {
        const { id } = req.params;
        const roles = req.usuario.roles || [];
        const esAdmin = roles.includes('administrador');

        const {
            numero_guia, estado_envio, costo_envio, valor_publicidad,
            razon_cliente, fecha_razon, observaciones, comision
        } = req.body;

        const existe = await pool.query("SELECT id_pedido FROM pedidos WHERE id_pedido = $1", [id]);
        if (existe.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Pedido no encontrado" });
        }

        const campos = [];
        const valores = [];
        let c = 1;

        if (numero_guia !== undefined) { campos.push(`numero_guia = $${c++}`); valores.push(numero_guia); }
        if (estado_envio) {
            campos.push(`estado_envio = $${c++}`); valores.push(estado_envio);
            campos.push(`fecha_estado = CURRENT_DATE`);
        }
        if (costo_envio !== undefined) { campos.push(`costo_envio = $${c++}`); valores.push(costo_envio); }
        if (valor_publicidad !== undefined) { campos.push(`valor_publicidad = $${c++}`); valores.push(valor_publicidad); }
        if (razon_cliente !== undefined) { campos.push(`razon_cliente = $${c++}`); valores.push(razon_cliente); }
        if (fecha_razon !== undefined) { campos.push(`fecha_razon = $${c++}`); valores.push(fecha_razon); }
        if (observaciones !== undefined) { campos.push(`observaciones = $${c++}`); valores.push(observaciones); }
        if (comision !== undefined && esAdmin) { campos.push(`comision = $${c++}`); valores.push(comision); }

        if (campos.length === 0) {
            return res.status(400).json({ ok: false, msg: "No hay campos para actualizar" });
        }

        if (costo_envio !== undefined) {
            const detalle = await pool.query(
                "SELECT COALESCE(SUM(subtotal),0) AS valor_productos FROM detalle_pedidos WHERE id_pedido = $1", [id]
            );
            const nuevo_total = parseFloat(detalle.rows[0].valor_productos) + parseFloat(costo_envio);
            campos.push(`costo_total = $${c++}`);
            valores.push(nuevo_total);
        }

        valores.push(id);
        await pool.query(`UPDATE pedidos SET ${campos.join(", ")} WHERE id_pedido = $${c}`, valores);

        res.json({ ok: true, msg: "Pedido actualizado exitosamente" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al actualizar pedido" });
    }
};

export const eliminarPedido = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        await client.query("BEGIN");

        const pedido = await client.query("SELECT id_pedido FROM pedidos WHERE id_pedido = $1", [id]);
        if (pedido.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ ok: false, msg: "Pedido no encontrado" });
        }

        await client.query("DELETE FROM detalle_pedidos WHERE id_pedido = $1", [id]);
        await client.query("DELETE FROM pedidos WHERE id_pedido = $1", [id]);

        await client.query("COMMIT");
        res.json({ ok: true, msg: "Pedido eliminado exitosamente" });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar pedido" });
    } finally {
        client.release();
    }
};

export const obtenerResumenComisiones = async (req, res) => {
    try {
        const roles = req.usuario.roles || [];
        const esAdmin = roles.includes('administrador');
        const { mes, anio } = req.query;

        const mesActual = mes || new Date().getMonth() + 1;
        const anioActual = anio || new Date().getFullYear();

        let condicion = `EXTRACT(MONTH FROM p.fecha_venta) = $1 AND EXTRACT(YEAR FROM p.fecha_venta) = $2`;
        let params = [mesActual, anioActual];

        if (!esAdmin) {
            condicion += ` AND p.id_usuario = $3`;
            params.push(req.usuario.id_usuario);
        }

        const result = await pool.query(`
            SELECT 
                u.id_usuario, u.nombre AS nombre_asesor, u.usuario AS usuario_asesor,
                COUNT(p.id_pedido) AS total_pedidos,
                COUNT(CASE WHEN p.estado_envio = 'ENTREGADO' THEN 1 END) AS pedidos_entregados,
                COALESCE(SUM(p.comision), 0) AS total_comisiones,
                COALESCE(SUM(CASE WHEN p.estado_envio = 'ENTREGADO' THEN p.comision END), 0) AS comisiones_ganadas
            FROM pedidos p
            INNER JOIN usuario u ON p.id_usuario = u.id_usuario
            WHERE ${condicion}
            GROUP BY u.id_usuario
            ORDER BY total_pedidos DESC
        `, params);

        res.json({ ok: true, resumen: result.rows });

    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener resumen de comisiones" });
    }
};