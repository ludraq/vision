import { Router } from "express";
import {
    listarApartados,
    obtenerApartadoPorId,
    verApartadoPorToken,
    responderApartadoProveedor,
    marcarRecogido,
    subirFotoEvidencia,
    generarLinkWhatsapp
} from "../controllers/proveedorApartado.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";
import { uploadImagen } from "../middlewares/upload.middleware.js";

const router = Router();

// ── Rutas PÚBLICAS (proveedor, sin login) ──
router.get("/proveedor/apartado/:token", verApartadoPorToken);
router.post("/proveedor/apartado/:token/responder", responderApartadoProveedor);

// ── Rutas PRIVADAS (empacador / admin / bodeguero) ──
router.get("/apartados", verificarToken, verificarRol("administrador", "bodeguero", "empacador"), listarApartados);
router.get("/apartados/:id", verificarToken, verificarRol("administrador", "bodeguero", "empacador"), obtenerApartadoPorId);
router.post("/apartados/:id/recoger", verificarToken, verificarRol("administrador", "bodeguero", "empacador"), marcarRecogido);
router.post("/apartados/:id/whatsapp", verificarToken, verificarRol("administrador", "bodeguero", "empacador"), generarLinkWhatsapp);
router.put("/apartados/:id/detalle/:id_detalle/foto",
    verificarToken,
    verificarRol("administrador", "bodeguero", "empacador"),
    uploadImagen.single("foto"),
    subirFotoEvidencia
);

export default router;