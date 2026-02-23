import jwt from "jsonwebtoken";

export const verificarToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        console.log("Header recibido:", authHeader); // ← DEBUG

        if (!authHeader) {
            return res.status(401).json({ ok: false, msg: "Token no proporcionado" });
        }

        const token = authHeader.split(' ')[1]; // Separar "Bearer" del token
        console.log("Token extraído:", token); // ← DEBUG

        if (!token) {
            return res.status(401).json({ ok: false, msg: "Token no proporcionado" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Token decodificado:", decoded); // ← DEBUG
        
        req.usuario = decoded;
        next();
    } catch (error) {
        console.error("Error en verificarToken:", error.message); // ← DEBUG
        return res.status(401).json({ ok: false, msg: "Token inválido o expirado" });
    }
};

export const verificarRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        const { roles } = req.usuario;

        const tienePermiso = roles.some(rol => rolesPermitidos.includes(rol));

        if (!tienePermiso) {
            return res.status(403).json({ 
                ok: false, 
                msg: "No tienes permisos para esta acción" 
            });
        }

        next();
    };
};