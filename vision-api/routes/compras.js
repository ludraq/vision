import { Router } from "express";
import {
    crearCompra,
    crearApartadoConTallas,
    obtenerCompras,
    obtenerCompraPorId,
    obtenerComprasPorProveedor,
    registrarRecepcion,
    actualizarFotoEvidencia,
    eliminarCompra
} from "../controllers/compras.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";
import { uploadImagen } from "../middlewares/upload.middleware.js";

const router = Router();
router.use(verificarToken);

// Consultas
router.get("/", obtenerCompras);
router.get("/proveedor/:id_proveedor", obtenerComprasPorProveedor);
router.get("/:id", obtenerCompraPorId);

// Gestión
router.post("/", verificarRol("administrador", "bodeguero"), crearCompra);
// Compra con tallas detalladas (para pedidos con desglose por número de talla)
router.post("/apartado", verificarRol("administrador", "bodeguero"), crearApartadoConTallas);
router.put("/:id/recibir", verificarRol("administrador", "bodeguero", "empacador"), registrarRecepcion);
router.put("/:id/detalle/:id_detalle/foto",
    verificarRol("administrador", "bodeguero", "empacador"),
    uploadImagen.single("foto"),
    actualizarFotoEvidencia
);
router.delete("/:id", verificarRol("administrador"), eliminarCompra);

export default router;