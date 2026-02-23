import { Router } from "express";
import {
    crearPedido,
    obtenerPedidos,
    obtenerPedidoPorId,
    actualizarPedido,
    eliminarPedido,
    obtenerResumenComisiones
} from "../controllers/pedidos.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verificarToken);

router.get("/", obtenerPedidos);
router.get("/comisiones", obtenerResumenComisiones);
router.get("/:id", obtenerPedidoPorId);
router.post("/", verificarRol("administrador", "vendedor"), crearPedido);
router.put("/:id", verificarRol("administrador", "vendedor"), actualizarPedido);
router.delete("/:id", verificarRol("administrador"), eliminarPedido);

export default router;