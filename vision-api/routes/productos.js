import { Router } from "express";
import {
    obtenerProductos,
    obtenerProductoPorId,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    buscarProductos,
    obtenerProductosPorProveedor,
    actualizarFotoProducto
} from "../controllers/productos.controller.js";
import {
    asignarProductoAProveedor,
    obtenerProveedoresDeProducto,
    obtenerProductosDeProveedor,
    actualizarPrecioProveedor,
    desactivarProductoProveedor,
    eliminarProductoProveedor
} from "../controllers/productos_proveedores.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";
import { uploadImagen } from "../middlewares/upload.middleware.js";

const router = Router();

router.use(verificarToken);

// Consultas (todos los roles autenticados)
router.get("/", obtenerProductos);
router.get("/buscar", buscarProductos);
router.get("/proveedor/:id_proveedor", obtenerProductosPorProveedor);
router.get("/:id", obtenerProductoPorId);

// Gestión de productos (admin y bodeguero)
router.post("/", verificarRol("administrador", "bodeguero"), uploadImagen.single("imagen"), crearProducto);
router.put("/:id", verificarRol("administrador", "bodeguero"), uploadImagen.single("imagen"),actualizarProducto);
router.put("/:id/foto", verificarRol("administrador", "bodeguero"), uploadImagen.single("imagen"),actualizarFotoProducto);
router.delete("/:id", verificarRol("administrador"), eliminarProducto);

// Gestión de relaciones producto-proveedor (admin y bodeguero)
router.get("/:id/proveedores", obtenerProveedoresDeProducto);
router.post("/:id/proveedores", verificarRol("administrador", "bodeguero"), asignarProductoAProveedor);
router.put("/:id/proveedores/:id_proveedor", verificarRol("administrador", "bodeguero"), actualizarPrecioProveedor);
router.patch("/:id/proveedores/:id_proveedor/desactivar", verificarRol("administrador", "bodeguero"), desactivarProductoProveedor);
router.delete("/:id/proveedores/:id_proveedor", verificarRol("administrador"), eliminarProductoProveedor);

export default router;