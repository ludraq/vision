import { pool } from "../database.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const login = async (req, res) => {
    try {
        
        const { correo, clave } = req.body;
        console.log("BODY RECIBIDO:", req.body);  // <-- AGREGA ESTO
        // 1. Buscar usuario por correo
        const result = await pool.query(
            "SELECT * FROM usuario WHERE correo = $1 AND estado = true LIMIT 1",
            [correo]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ ok: false, msg: "Usuario no encontrado" });
        }

        const usuario = result.rows[0];

        // 2. Comparar contraseña (bcrypt)
        const esValida = await bcrypt.compare(clave, usuario.clave);

        if (!esValida) {
            return res.status(401).json({ ok: false, msg: "Contraseña incorrecta" });
        }

        // 3. Consultar roles del usuario
        const rolesQuery = await pool.query(
            `SELECT r.nombre 
             FROM usuario_rol ur
             INNER JOIN rol r ON ur.id_rol = r.id_rol
             WHERE ur.id_usuario = $1`,
            [usuario.id_usuario]
        );

        const roles = rolesQuery.rows.map(r => r.nombre);

        // 4. Crear token JWT
        const token = jwt.sign(
            {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                roles: roles
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES }
        );

        return res.json({
            ok: true,
            msg: "Login exitoso",
            token,
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                correo: usuario.correo,
                roles
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error interno" });
    }
};
