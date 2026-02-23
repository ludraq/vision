import { pool } from "../database.js";

// Obtener todos los roles
export const obtenerRoles = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id_rol, nombre FROM rol ORDER BY id_rol"
        );

        res.json({
            ok: true,
            roles: result.rows
        });
    } catch (error) {
        console.error("Error al obtener roles:", error);
        res.status(500).json({
            ok: false,
            msg: "Error al obtener roles"
        });
    }
};
