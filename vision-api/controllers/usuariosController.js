import { pool } from "../database.js";
import bcrypt from "bcrypt";

const validarCelular = (celular) => {
    if (!/^\d{7,15}$/.test(celular)) {
        throw new Error("El número de celular no es válido");
    }
};

// Obtener todos los usuarios
export const obtenerUsuarios = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id_usuario, 
                u.nombre,
                u.usuario, 
                u.correo, 
                u.estado,
                u.fecha_creacion,
                COALESCE(
                    ARRAY_AGG(r.nombre) FILTER (WHERE r.nombre IS NOT NULL), 
                    '{}'
                ) as roles
            FROM usuario u
            LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
            LEFT JOIN rol r ON ur.id_rol = r.id_rol
            GROUP BY u.id_usuario
            ORDER BY u.fecha_creacion DESC
        `);

        res.json({ 
            ok: true, 
            usuarios: result.rows 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            ok: false, 
            msg: "Error al obtener usuarios" 
        });
    }
};

// Obtener un usuario por ID
export const obtenerUsuarioPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT 
                u.id_usuario, 
                u.nombre,
                u.usuario, 
                u.celular,
                u.correo, 
                u.estado,
                u.fecha_creacion
            FROM usuario u
            WHERE u.id_usuario = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
        }

        // Obtener roles
        const rolesResult = await pool.query(
            `SELECT r.id_rol, r.nombre 
             FROM usuario_rol ur
             INNER JOIN rol r ON ur.id_rol = r.id_rol
             WHERE ur.id_usuario = $1`,
            [id]
        );

        const usuario = {
            ...result.rows[0],
            roles: rolesResult.rows
        };

        res.json({ ok: true, usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener usuario" });
    }
};

// Crear usuario
export const crearUsuario = async (req, res) => {
    const client = await pool.connect();
    
    try {
        let { nombre, usuario, correo, clave, celular, roles = [] } = req.body;

        // Validaciones
        if (!nombre || !usuario || !clave) {
            return res.status(400).json({ 
                ok: false, 
                msg: "Nombre, usuario y clave son requeridos" 
            });
        }

        // Normalizar datos
        if (correo) correo = correo.toLowerCase().trim();
        usuario = usuario.toLowerCase().trim();

        await client.query('BEGIN');

        // Verificar si el usuario ya existe
        const existeUsuario = await client.query(
            "SELECT id_usuario FROM usuario WHERE usuario = $1",
            [usuario]
        );

        if (existeUsuario.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                ok: false, 
                msg: "El nombre de usuario ya está en uso" 
            });
        }
        // Validar celular si se envía
        if (celular) {
            validarCelular(celular);
        }
        // Verificar si el correo ya existe (si se proporciona)
        if (correo) {
            const existeCorreo = await client.query(
                "SELECT id_usuario FROM usuario WHERE correo = $1",
                [correo]
            );

            if (existeCorreo.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    ok: false, 
                    msg: "El correo ya está registrado" 
                });
            }
        }

        // Hash de la contraseña
        const claveHash = await bcrypt.hash(clave, 10);

        // Insertar usuario con TODOS los campos obligatorios
        const result = await client.query(
            `INSERT INTO usuario (nombre, usuario, correo, clave, celular, estado) 
             VALUES ($1, $2, $3, $4, $5, true) 
             RETURNING id_usuario, nombre, usuario, correo, celular, estado, fecha_creacion`,
            [nombre, usuario, correo || null, claveHash, celular || null]
        );

        const nuevoUsuario = result.rows[0];

        // Asignar roles
        if (roles.length > 0) {
            for (const idRol of roles) {
                await client.query(
                    "INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)",
                    [nuevoUsuario.id_usuario, idRol]
                );
            }
        }

        await client.query('COMMIT');

        res.status(201).json({ 
            ok: true, 
            msg: "Usuario creado exitosamente",
            usuario: nuevoUsuario 
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error completo:", error);
        res.status(500).json({ 
            ok: false, 
            msg: "Error al crear usuario",
            detalles: error.message
        });
    } finally {
        client.release();
    }
};

// Actualizar usuario
export const actualizarUsuario = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        let { nombre, usuario, correo, celular, clave, estado, roles } = req.body;

        await client.query('BEGIN');

        // Verificar que el usuario existe
        const existe = await client.query(
            "SELECT id_usuario FROM usuario WHERE id_usuario = $1",
            [id]
        );

        if (existe.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
        }
        if (celular !== undefined && celular !== null && celular !== "") {
            validarCelular(celular);
        }


        // Construir query dinámico
        const campos = [];
        const valores = [];
        let contador = 1;

        if (nombre) {
            campos.push(`nombre = $${contador++}`);
            valores.push(nombre);
        }
        if (usuario !== undefined) {
        const usuarioLimpio = usuario.trim().toLowerCase();

        if (usuarioLimpio.length === 0) {
            throw new Error("El nombre de usuario no puede estar vacío");
        }

        // Verificar que no esté en uso por otro usuario
        const existeUsuario = await client.query(
            `SELECT id_usuario
            FROM usuario
            WHERE usuario = $1 AND id_usuario != $2`,
            [usuarioLimpio, id]
        );

        if (existeUsuario.rows.length > 0) {
            throw new Error("El nombre de usuario ya está en uso");
        }

        // Solo si pasa las validaciones, se agrega al UPDATE
        campos.push(`usuario = $${contador++}`);
        valores.push(usuarioLimpio);
        }   

        if (correo) {
            campos.push(`correo = $${contador++}`);
            valores.push(correo.toLowerCase().trim());
        }
        if (celular !== undefined) {
            campos.push(`celular = $${contador++}`);
            valores.push(celular);
        }
        if (clave) {
            const claveHash = await bcrypt.hash(clave, 10);
            campos.push(`clave = $${contador++}`);
            valores.push(claveHash);
        }
        if (estado !== undefined) {
            campos.push(`estado = $${contador++}`);
            valores.push(estado);
        }

        if (campos.length > 0) {
            campos.push(`fecha_actualizacion = NOW()`);
            valores.push(id);
            await client.query(
                `UPDATE usuario SET ${campos.join(', ')} WHERE id_usuario = $${contador}`,
                valores
            );
        }

        // Actualizar roles si se proporcionan
        if (roles && Array.isArray(roles)) {

            // Normalizar y validar roles
            const rolesValidos = roles
                .map(r => Number(r))
                .filter(r => Number.isInteger(r));

            if (rolesValidos.length === 0) {
                throw new Error("Roles inválidos");
            }

            // Verificar que existan en BD
            const resultRoles = await client.query(
                "SELECT id_rol FROM rol WHERE id_rol = ANY($1::int[])",
                [rolesValidos]
            );

            if (resultRoles.rows.length !== rolesValidos.length) {
                throw new Error("Uno o más roles no existen");
            }

            await client.query(
                "DELETE FROM usuario_rol WHERE id_usuario = $1",
                [id]
            );

            for (const idRol of rolesValidos) {
                await client.query(
                    "INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)",
                    [id, idRol]
                );
            }
        }


        await client.query('COMMIT');

        res.json({ ok: true, msg: "Usuario actualizado exitosamente" });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al actualizar usuario" });
    } finally {
        client.release();
    }
};

// Eliminar usuario (soft delete)
export const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "UPDATE usuario SET estado = false WHERE id_usuario = $1 RETURNING id_usuario",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
        }

        res.json({ ok: true, msg: "Usuario desactivado exitosamente" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar usuario" });
    }
};