import { Router } from "express";
import {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario
} from "../controllers/usuariosController.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

router.get("/", obtenerUsuarios);
router.get("/:id", obtenerUsuarioPorId);
router.post("/", verificarRol("administrador"), crearUsuario);
router.put("/:id", verificarRol("administrador"), actualizarUsuario);
router.delete("/:id", verificarRol("administrador"), eliminarUsuario);

export default router;