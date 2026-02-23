import { pool } from "../database.js";

// ─────────────────────────────────────────────
// CRUD TRANSPORTADORAS
// ─────────────────────────────────────────────
export const obtenerTransportadoras = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM transportadoras ORDER BY nombre");
        res.json({ ok: true, transportadoras: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener transportadoras" });
    }
};

export const obtenerTransportadoraPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "SELECT * FROM transportadoras WHERE id_transportadora = $1", [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Transportadora no encontrada" });
        }
        res.json({ ok: true, transportadora: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener transportadora" });
    }
};

export const crearTransportadora = async (req, res) => {
    try {
        const { nombre, usuario, clave, url_seguimiento, cobra_envio, ciclo_dias, observaciones } = req.body;

        if (!nombre) {
            return res.status(400).json({ ok: false, msg: "El nombre es requerido" });
        }

        const result = await pool.query(
            `INSERT INTO transportadoras 
                (nombre, usuario, clave, url_seguimiento, cobra_envio, ciclo_dias, observaciones)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [nombre, usuario || null, clave || null, url_seguimiento || null,
                cobra_envio ?? true, ciclo_dias || 1, observaciones || null]
        );

        res.status(201).json({ ok: true, msg: "Transportadora creada", transportadora: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al crear transportadora" });
    }
};

export const actualizarTransportadora = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, usuario, clave, url_seguimiento, cobra_envio, ciclo_dias, observaciones } = req.body;

        const existe = await pool.query(
            "SELECT id_transportadora FROM transportadoras WHERE id_transportadora = $1", [id]
        );
        if (existe.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Transportadora no encontrada" });
        }

        const campos = [];
        const valores = [];
        let c = 1;

        if (nombre !== undefined) { campos.push(`nombre = $${c++}`); valores.push(nombre); }
        if (usuario !== undefined) { campos.push(`usuario = $${c++}`); valores.push(usuario); }
        if (clave !== undefined) { campos.push(`clave = $${c++}`); valores.push(clave); }
        if (url_seguimiento !== undefined) { campos.push(`url_seguimiento = $${c++}`); valores.push(url_seguimiento); }
        if (cobra_envio !== undefined) { campos.push(`cobra_envio = $${c++}`); valores.push(cobra_envio); }
        if (ciclo_dias !== undefined) { campos.push(`ciclo_dias = $${c++}`); valores.push(ciclo_dias); }
        if (observaciones !== undefined) { campos.push(`observaciones = $${c++}`); valores.push(observaciones); }

        if (campos.length === 0) {
            return res.status(400).json({ ok: false, msg: "No hay campos para actualizar" });
        }

        valores.push(id);
        const result = await pool.query(
            `UPDATE transportadoras SET ${campos.join(", ")} WHERE id_transportadora = $${c} RETURNING *`,
            valores
        );

        res.json({ ok: true, msg: "Transportadora actualizada", transportadora: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al actualizar transportadora" });
    }
};

export const eliminarTransportadora = async (req, res) => {
    try {
        const { id } = req.params;

        const enUso = await pool.query(
            "SELECT COUNT(*) as total FROM pedidos WHERE id_transportadora = $1", [id]
        );
        if (parseInt(enUso.rows[0].total) > 0) {
            return res.status(400).json({
                ok: false,
                msg: "No se puede eliminar: hay pedidos asociados a esta transportadora"
            });
        }

        const result = await pool.query(
            "DELETE FROM transportadoras WHERE id_transportadora = $1 RETURNING id_transportadora", [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Transportadora no encontrada" });
        }

        res.json({ ok: true, msg: "Transportadora eliminada" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar transportadora" });
    }
};

// ─────────────────────────────────────────────
// ESTADO DE CUENTA
// ─────────────────────────────────────────────
export const obtenerEstadoCuenta = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_inicio, fecha_fin } = req.query;

        const trans = await pool.query(
            "SELECT * FROM transportadoras WHERE id_transportadora = $1", [id]
        );
        if (trans.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Transportadora no encontrada" });
        }

        const transportadora = trans.rows[0];

        // Calcular rango si no viene en query
        let inicio = fecha_inicio;
        let fin = fecha_fin;
        if (!inicio) {
            const ciclo = transportadora.ciclo_dias || 1;
            const hoy = new Date();
            const diaInicio = new Date(hoy);
            diaInicio.setDate(hoy.getDate() - ciclo);
            inicio = diaInicio.toISOString().split('T')[0];
            fin = hoy.toISOString().split('T')[0];
        }

        // Pedidos ENTREGADOS en el rango → lo que nos deben
        const pedidosEntregados = await pool.query(`
            SELECT 
                p.id_pedido,
                p.numero_guia,
                p.fecha_estado,
                p.costo_envio,
                c.nombre AS nombre_cliente,
                c.ciudad AS ciudad_destino,
                COALESCE((
                    SELECT SUM(dp.subtotal) 
                    FROM detalle_pedidos dp 
                    WHERE dp.id_pedido = p.id_pedido
                ), 0) AS valor_recaudado
            FROM pedidos p
            INNER JOIN clientes c ON p.id_cliente = c.id_cliente
            WHERE p.id_transportadora = $1
              AND p.estado_envio = 'ENTREGADO'
              AND p.fecha_estado >= $2
              AND p.fecha_estado <= $3
            ORDER BY p.fecha_estado DESC
        `, [id, inicio, fin]);

        // Pedidos DEVUELTOS en el rango → lo que debemos pagar
        const pedidosDevueltos = await pool.query(`
            SELECT 
                p.id_pedido,
                p.numero_guia,
                p.fecha_estado,
                p.costo_envio,
                c.nombre AS nombre_cliente,
                c.ciudad AS ciudad_destino
            FROM pedidos p
            INNER JOIN clientes c ON p.id_cliente = c.id_cliente
            WHERE p.id_transportadora = $1
              AND p.estado_envio IN ('DEVUELTO AL REMITENTE', 'EN PROCESO DE DEVOLUCION')
              AND p.fecha_estado >= $2
              AND p.fecha_estado <= $3
            ORDER BY p.fecha_estado DESC
        `, [id, inicio, fin]);

        // Historial completo de pagos recibidos (entregados)
        const pagosEntregados = await pool.query(`
            SELECT * FROM cuentas_entregados
            WHERE id_transportadora = $1
            ORDER BY fecha_pago DESC
        `, [id]);

        // Historial completo de pagos de devoluciones
        const pagosDevoluciones = await pool.query(`
            SELECT * FROM cuentas_devoluciones
            WHERE id_transportadora = $1
            ORDER BY fecha_pago DESC
        `, [id]);

        // Totales globales (no solo del periodo, para el saldo real)
        const totalEntregadoGlobal = await pool.query(`
            SELECT COALESCE(SUM(dp.subtotal), 0) AS total
            FROM pedidos p
            INNER JOIN detalle_pedidos dp ON p.id_pedido = dp.id_pedido
            WHERE p.id_transportadora = $1 AND p.estado_envio = 'ENTREGADO'
        `, [id]);

        const totalPagadoEntregadosGlobal = await pool.query(`
            SELECT COALESCE(SUM(monto_pago), 0) AS total
            FROM cuentas_entregados WHERE id_transportadora = $1
        `, [id]);

        const totalDevolucionesGlobal = await pool.query(`
            SELECT COALESCE(SUM(p.costo_envio), 0) AS total
            FROM pedidos p
            WHERE p.id_transportadora = $1 
              AND p.estado_envio IN ('DEVUELTO AL REMITENTE', 'EN PROCESO DE DEVOLUCION')
        `, [id]);

        const totalPagadoDevolucionesGlobal = await pool.query(`
            SELECT COALESCE(SUM(monto_pago), 0) AS total
            FROM cuentas_devoluciones WHERE id_transportadora = $1
        `, [id]);

        // Totales del periodo actual
        const totalEntregadoPeriodo = pedidosEntregados.rows.reduce(
            (a, p) => a + parseFloat(p.valor_recaudado || 0), 0
        );
        const totalDevolucionesPeriodo = pedidosDevueltos.rows.reduce(
            (a, p) => a + parseFloat(p.costo_envio || 0), 0
        );

        res.json({
            ok: true,
            transportadora,
            periodo: { inicio, fin },
            resumen: {
                // Periodo actual
                total_entregado_periodo: totalEntregadoPeriodo,
                total_devoluciones_periodo: totalDevolucionesPeriodo,
                // Saldos globales reales
                total_entregado_global: parseFloat(totalEntregadoGlobal.rows[0].total),
                total_pagado_entregados: parseFloat(totalPagadoEntregadosGlobal.rows[0].total),
                saldo_pendiente_entregados:
                    parseFloat(totalEntregadoGlobal.rows[0].total) -
                    parseFloat(totalPagadoEntregadosGlobal.rows[0].total),
                total_devoluciones_global: parseFloat(totalDevolucionesGlobal.rows[0].total),
                total_pagado_devoluciones: parseFloat(totalPagadoDevolucionesGlobal.rows[0].total),
                saldo_pendiente_devoluciones:
                    parseFloat(totalDevolucionesGlobal.rows[0].total) -
                    parseFloat(totalPagadoDevolucionesGlobal.rows[0].total)
            },
            pedidos_entregados: pedidosEntregados.rows,
            pedidos_devueltos: pedidosDevueltos.rows,
            pagos_entregados: pagosEntregados.rows,
            pagos_devoluciones: pagosDevoluciones.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener estado de cuenta" });
    }
};

// Registrar pago de entregados (la trans me paga)
export const registrarPagoEntregados = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_pago, monto_pago, observaciones, fecha_inicio_ciclo, fecha_fin_ciclo } = req.body;

        if (!fecha_pago || !monto_pago) {
            return res.status(400).json({ ok: false, msg: "Fecha y monto son requeridos" });
        }
        if (parseFloat(monto_pago) <= 0) {
            return res.status(400).json({ ok: false, msg: "El monto debe ser mayor a 0" });
        }

        const result = await pool.query(
            `INSERT INTO cuentas_entregados 
                (id_transportadora, fecha_pago, monto_pago, observaciones, fecha_inicio_ciclo, fecha_fin_ciclo)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [id, fecha_pago, monto_pago, observaciones || null,
                fecha_inicio_ciclo || null, fecha_fin_ciclo || null]
        );

        res.status(201).json({ ok: true, msg: "Pago registrado exitosamente", pago: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al registrar pago" });
    }
};

// Registrar pago de devoluciones (yo le pago a la trans)
export const registrarPagoDevoluciones = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_pago, monto_pago, observaciones, fecha_inicio_ciclo, fecha_fin_ciclo } = req.body;

        if (!fecha_pago || !monto_pago) {
            return res.status(400).json({ ok: false, msg: "Fecha y monto son requeridos" });
        }
        if (parseFloat(monto_pago) <= 0) {
            return res.status(400).json({ ok: false, msg: "El monto debe ser mayor a 0" });
        }

        const result = await pool.query(
            `INSERT INTO cuentas_devoluciones 
                (id_transportadora, fecha_pago, monto_pago, observaciones, fecha_inicio_ciclo, fecha_fin_ciclo)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [id, fecha_pago, monto_pago, observaciones || null,
                fecha_inicio_ciclo || null, fecha_fin_ciclo || null]
        );

        res.status(201).json({ ok: true, msg: "Pago de devoluciones registrado", pago: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al registrar pago de devoluciones" });
    }
};

export const eliminarPagoEntregados = async (req, res) => {
    try {
        const { id_pago } = req.params;
        const result = await pool.query(
            "DELETE FROM cuentas_entregados WHERE id_entregado = $1 RETURNING id_entregado", [id_pago]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Pago no encontrado" });
        }
        res.json({ ok: true, msg: "Pago eliminado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar pago" });
    }
};

export const eliminarPagoDevoluciones = async (req, res) => {
    try {
        const { id_pago } = req.params;
        const result = await pool.query(
            "DELETE FROM cuentas_devoluciones WHERE id_devolucion = $1 RETURNING id_devolucion", [id_pago]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Pago no encontrado" });
        }
        res.json({ ok: true, msg: "Pago eliminado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar pago" });
    }
};