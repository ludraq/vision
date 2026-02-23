import { pool } from "../database.js";

// ─────────────────────────────────────────────
// OBTENER CONFIGURACIÓN ACTUAL
// ─────────────────────────────────────────────
export const obtenerConfiguracion = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, u.nombre AS modificado_por
             FROM configuracion c
             LEFT JOIN usuario u ON c.id_usuario_modifico = u.id_usuario
             WHERE c.id_config = 1`
        );

        const bonos = await pool.query(
            "SELECT * FROM bonos ORDER BY activo DESC, fecha_creacion DESC"
        );

        res.json({
            ok: true,
            configuracion: result.rows[0] || null,
            bonos: bonos.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener configuración" });
    }
};

// ─────────────────────────────────────────────
// ACTUALIZAR CONFIGURACIÓN (solo admin)
// ─────────────────────────────────────────────
export const actualizarConfiguracion = async (req, res) => {
    try {
        const id_usuario = req.usuario.id_usuario;
        const { nombre_cuenta, comision_base } = req.body;

        if (!nombre_cuenta && comision_base === undefined) {
            return res.status(400).json({ ok: false, msg: "No hay campos para actualizar" });
        }

        const campos = [];
        const valores = [];
        let c = 1;

        if (nombre_cuenta) { campos.push(`nombre_cuenta = $${c++}`); valores.push(nombre_cuenta); }
        if (comision_base !== undefined) { campos.push(`comision_base = $${c++}`); valores.push(comision_base); }
        campos.push(`fecha_actualizacion = NOW()`);
        campos.push(`id_usuario_modifico = $${c++}`);
        valores.push(id_usuario);

        valores.push(1); // id_config siempre es 1
        await pool.query(
            `UPDATE configuracion SET ${campos.join(", ")} WHERE id_config = $${c}`,
            valores
        );

        res.json({ ok: true, msg: "Configuración actualizada exitosamente" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al actualizar configuración" });
    }
};

// ─────────────────────────────────────────────
// CREAR BONO
// ─────────────────────────────────────────────
export const crearBono = async (req, res) => {
    try {
        const { nombre, descripcion, tipo, meta, valor_bono } = req.body;

        if (!nombre || !tipo || valor_bono === undefined) {
            return res.status(400).json({
                ok: false,
                msg: "Nombre, tipo y valor del bono son requeridos"
            });
        }

        if (!['cantidad', 'valor', 'fijo'].includes(tipo)) {
            return res.status(400).json({
                ok: false,
                msg: "Tipo debe ser: cantidad, valor o fijo"
            });
        }

        const result = await pool.query(
            `INSERT INTO bonos (nombre, descripcion, tipo, meta, valor_bono)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [nombre, descripcion || null, tipo, meta || null, valor_bono]
        );

        res.status(201).json({ ok: true, msg: "Bono creado", bono: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al crear bono" });
    }
};

// ─────────────────────────────────────────────
// ACTUALIZAR BONO
// ─────────────────────────────────────────────
export const actualizarBono = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, tipo, meta, valor_bono, activo } = req.body;

        const existe = await pool.query(
            "SELECT id_bono FROM bonos WHERE id_bono = $1", [id]
        );
        if (existe.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Bono no encontrado" });
        }

        const campos = [];
        const valores = [];
        let c = 1;

        if (nombre) { campos.push(`nombre = $${c++}`); valores.push(nombre); }
        if (descripcion !== undefined) { campos.push(`descripcion = $${c++}`); valores.push(descripcion); }
        if (tipo) { campos.push(`tipo = $${c++}`); valores.push(tipo); }
        if (meta !== undefined) { campos.push(`meta = $${c++}`); valores.push(meta); }
        if (valor_bono !== undefined) { campos.push(`valor_bono = $${c++}`); valores.push(valor_bono); }
        if (activo !== undefined) { campos.push(`activo = $${c++}`); valores.push(activo); }

        if (campos.length === 0) {
            return res.status(400).json({ ok: false, msg: "No hay campos para actualizar" });
        }

        valores.push(id);
        await pool.query(
            `UPDATE bonos SET ${campos.join(", ")} WHERE id_bono = $${c}`,
            valores
        );

        res.json({ ok: true, msg: "Bono actualizado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al actualizar bono" });
    }
};

// ─────────────────────────────────────────────
// ELIMINAR BONO
// ─────────────────────────────────────────────
export const eliminarBono = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "DELETE FROM bonos WHERE id_bono = $1 RETURNING id_bono", [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Bono no encontrado" });
        }
        res.json({ ok: true, msg: "Bono eliminado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar bono" });
    }
};