import { Router } from "express";
import {
    registrarDevolucion,
    obtenerDevoluciones,
    obtenerDevolucionPorId,
    obtenerDevolucionesPorProveedor,
    eliminarDevolucion,
    obtenerResumenProveedor
} from "../controllers/devoluciones.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verificarToken);

// Consultas (todos los roles autenticados)
router.get("/", obtenerDevoluciones);
router.get("/:id", obtenerDevolucionPorId);
router.get("/proveedor/:id_proveedor", obtenerDevolucionesPorProveedor);
router.get("/proveedor/:id_proveedor/resumen", obtenerResumenProveedor);

// Gestión (admin y bodeguero)
router.post("/", verificarRol("administrador", "bodeguero"), registrarDevolucion);
router.delete("/:id", verificarRol("administrador"), eliminarDevolucion);

export default router;