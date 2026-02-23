import { Router } from "express";
import {
    obtenerProveedores,
    obtenerProveedorPorId,
    crearProveedor,
    actualizarProveedor,
    eliminarProveedor,
    registrarAbono
} from "../controllers/proveedores.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";
import { obtenerProductosDeProveedor } from "../controllers/productos_proveedores.controller.js";
const router = Router();

router.use(verificarToken);

// Consultas (todos los roles autenticados)
router.get("/", obtenerProveedores);
router.get("/:id", obtenerProveedorPorId);

// Gestión (solo admin y bodeguero)
router.post("/", verificarRol("administrador", "bodeguero"), crearProveedor);
router.put("/:id", verificarRol("administrador", "bodeguero"), actualizarProveedor);
router.delete("/:id", verificarRol("administrador"), eliminarProveedor);

// Abonos (solo admin)
router.post("/:id/abonos", verificarRol("administrador"), registrarAbono);
//productos de un proveedor
router.get("/:id_proveedor/productos", obtenerProductosDeProveedor);
export default router;