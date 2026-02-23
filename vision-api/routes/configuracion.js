import { Router } from "express";
import {
    obtenerConfiguracion,
    actualizarConfiguracion,
    crearBono,
    actualizarBono,
    eliminarBono
} from "../controllers/configuracion.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verificarToken);

// Configuración general (admin)
router.get("/", obtenerConfiguracion);
router.put("/", verificarRol("administrador"), actualizarConfiguracion);

// Bonos (solo admin)
router.post("/bonos", verificarRol("administrador"), crearBono);
router.put("/bonos/:id", verificarRol("administrador"), actualizarBono);
router.delete("/bonos/:id", verificarRol("administrador"), eliminarBono);

export default router;