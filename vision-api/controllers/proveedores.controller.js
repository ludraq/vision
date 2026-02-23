import { pool } from "../database.js";

// Obtener todos los proveedores con cálculo de deuda
export const obtenerProveedores = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.id_proveedor,
                p.nombre,
                p.telefono,
                p.cedula,
                p.direccion,
                p.saldo_total,
                -- Total de productos comprados (apartados)
                COALESCE((
                    SELECT SUM(c.total_compra)
                    FROM compras c
                    WHERE c.id_proveedor = p.id_proveedor
                ), 0) as total_comprado,
                -- Total de abonos realizados
                COALESCE((
                    SELECT SUM(a.monto_abono)
                    FROM abonos a
                    WHERE a.id_proveedor = p.id_proveedor
                ), 0) as total_abonado,
                -- Deuda actual = Comprado - Abonado
                COALESCE((
                    SELECT SUM(c.total_compra)
                    FROM compras c
                    WHERE c.id_proveedor = p.id_proveedor
                ), 0) - 
                COALESCE((
                    SELECT SUM(a.monto_abono)
                    FROM abonos a
                    WHERE a.id_proveedor = p.id_proveedor
                ), 0) as deuda_calculada
            FROM proveedores p
            ORDER BY p.nombre
        `);

        res.json({ ok: true, proveedores: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener proveedores" });
    }
};

// Obtener proveedor por ID con movimientos detallados
export const obtenerProveedorPorId = async (req, res) => {
    try {
        const { id } = req.params;

        // Datos del proveedor con deuda
        const proveedor = await pool.query(`
            SELECT 
                p.*,
                COALESCE((
                    SELECT SUM(c.total_compra)
                    FROM compras c
                    WHERE c.id_proveedor = p.id_proveedor
                ), 0) as total_comprado,
                COALESCE((
                    SELECT SUM(a.monto_abono)
                    FROM abonos a
                    WHERE a.id_proveedor = p.id_proveedor
                ), 0) as total_abonado,
                COALESCE((
                    SELECT SUM(c.total_compra)
                    FROM compras c
                    WHERE c.id_proveedor = p.id_proveedor
                ), 0) - 
                COALESCE((
                    SELECT SUM(a.monto_abono)
                    FROM abonos a
                    WHERE a.id_proveedor = p.id_proveedor
                ), 0) as deuda_calculada
            FROM proveedores p
            WHERE p.id_proveedor = $1
        `, [id]);

        if (proveedor.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Proveedor no encontrado" });
        }

        // Productos que ha suministrado el proveedor
        const productos = await pool.query(`
            SELECT 
                prod.id_producto,
                prod.nombre,
                prod.precio,
                prod.ruta_foto,
                SUM(dc.cantidad) as total_apartado
            FROM compras c
            INNER JOIN detalle_compras dc ON c.id_compra = dc.id_compra
            INNER JOIN productos prod ON dc.id_producto = prod.id_producto
            WHERE c.id_proveedor = $1
            GROUP BY prod.id_producto
            ORDER BY prod.nombre
        `, [id]);

        // Historial de compras (apartados)
        const compras = await pool.query(`
            SELECT 
                c.id_compra,
                c.fecha_compra,
                c.total_compra,
                c.observaciones,
                COUNT(dc.id_detalle) as items
            FROM compras c
            LEFT JOIN detalle_compras dc ON c.id_compra = dc.id_compra
            WHERE c.id_proveedor = $1
            GROUP BY c.id_compra
            ORDER BY c.fecha_compra DESC
        `, [id]);

        // Detalle de la última compra (ejemplo)
        const ultimaCompra = await pool.query(`
            SELECT 
                dc.cantidad,
                dc.precio_unitario,
                dc.subtotal,
                prod.nombre as producto
            FROM compras c
            INNER JOIN detalle_compras dc ON c.id_compra = dc.id_compra
            INNER JOIN productos prod ON dc.id_producto = prod.id_producto
            WHERE c.id_proveedor = $1
            ORDER BY c.fecha_compra DESC, dc.id_detalle
            LIMIT 10
        `, [id]);

        // Historial de abonos
        const abonos = await pool.query(`
            SELECT 
                a.id_abono,
                a.fecha_abono,
                a.monto_abono,
                a.metodo_pago,
                a.observaciones
            FROM abonos a
            WHERE a.id_proveedor = $1
            ORDER BY a.fecha_abono DESC
        `, [id]);

        res.json({
            ok: true,
            proveedor: {
                ...proveedor.rows[0],
                productos: productos.rows,
                compras: compras.rows,
                ultimo_detalle: ultimaCompra.rows,
                abonos: abonos.rows
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener proveedor" });
    }
};

// Crear proveedor
export const crearProveedor = async (req, res) => {
    try {
        const { nombre, telefono, cedula, direccion } = req.body;

        if (!nombre || !cedula) {
            return res.status(400).json({ 
                ok: false, 
                msg: "Nombre y cédula son requeridos" 
            });
        }

        const existe = await pool.query(
            "SELECT id_proveedor FROM proveedores WHERE cedula = $1",
            [cedula]
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "Ya existe un proveedor con esa cédula" 
            });
        }

        const result = await pool.query(
            `INSERT INTO proveedores (nombre, telefono, cedula, direccion, saldo_total) 
             VALUES ($1, $2, $3, $4, 0) 
             RETURNING *`,
            [nombre, telefono || null, cedula, direccion || null]
        );

        res.status(201).json({ 
            ok: true, 
            msg: "Proveedor creado exitosamente",
            proveedor: result.rows[0] 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al crear proveedor" });
    }
};

// Actualizar proveedor
export const actualizarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, telefono, cedula, direccion } = req.body;

        const campos = [];
        const valores = [];
        let contador = 1;

        if (nombre) {
            campos.push(`nombre = $${contador++}`);
            valores.push(nombre);
        }
        if (telefono !== undefined) {
            campos.push(`telefono = $${contador++}`);
            valores.push(telefono);
        }
        if (cedula) {
            campos.push(`cedula = $${contador++}`);
            valores.push(cedula);
        }
        if (direccion !== undefined) {
            campos.push(`direccion = $${contador++}`);
            valores.push(direccion);
        }

        if (campos.length === 0) {
            return res.status(400).json({ ok: false, msg: "No hay campos para actualizar" });
        }

        valores.push(id);
        await pool.query(
            `UPDATE proveedores SET ${campos.join(', ')} WHERE id_proveedor = $${contador}`,
            valores
        );

        res.json({ ok: true, msg: "Proveedor actualizado exitosamente" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al actualizar proveedor" });
    }
};

// Eliminar proveedor
export const eliminarProveedor = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si tiene compras
        const compras = await pool.query(
            "SELECT COUNT(*) as total FROM compras WHERE id_proveedor = $1",
            [id]
        );

        if (parseInt(compras.rows[0].total) > 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "No se puede eliminar el proveedor porque tiene compras registradas" 
            });
        }

        const result = await pool.query(
            "DELETE FROM proveedores WHERE id_proveedor = $1 RETURNING id_proveedor",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Proveedor no encontrado" });
        }

        res.json({ ok: true, msg: "Proveedor eliminado exitosamente" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar proveedor" });
    }
};

// Registrar abono a proveedor
export const registrarAbono = async (req, res) => {
    try {
        const { id } = req.params;
        const { monto_abono, metodo_pago, observaciones } = req.body;

        if (!monto_abono || monto_abono <= 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "El monto debe ser mayor a 0" 
            });
        }

        const result = await pool.query(
            `INSERT INTO abonos (id_proveedor, fecha_abono, monto_abono, metodo_pago, observaciones) 
             VALUES ($1, CURRENT_DATE, $2, $3, $4) 
             RETURNING *`,
            [id, monto_abono, metodo_pago || null, observaciones || null]
        );

        res.status(201).json({ 
            ok: true, 
            msg: "Abono registrado exitosamente",
            abono: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al registrar abono" });
    }
};