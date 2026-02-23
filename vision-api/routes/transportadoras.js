import { Router } from "express";
import {
    obtenerTransportadoras,
    obtenerTransportadoraPorId,
    crearTransportadora,
    actualizarTransportadora,
    eliminarTransportadora,
    obtenerEstadoCuenta,
    registrarPagoEntregados,
    registrarPagoDevoluciones,
    eliminarPagoEntregados,
    eliminarPagoDevoluciones
} from "../controllers/transportadoras.controller.js";
import { verificarToken, verificarRol } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verificarToken);

// CRUD transportadoras
router.get("/", obtenerTransportadoras);
router.get("/:id", obtenerTransportadoraPorId);
router.post("/", verificarRol("administrador"), crearTransportadora);
router.put("/:id", verificarRol("administrador"), actualizarTransportadora);
router.delete("/:id", verificarRol("administrador"), eliminarTransportadora);

// Estado de cuenta
router.get("/:id/estado-cuenta", obtenerEstadoCuenta);

// Pagos de entregados (trans me paga a mí)
router.post("/:id/pagos-entregados", verificarRol("administrador"), registrarPagoEntregados);
router.delete("/:id/pagos-entregados/:id_pago", verificarRol("administrador"), eliminarPagoEntregados);

// Pagos de devoluciones (yo le pago a la trans)
router.post("/:id/pagos-devoluciones", verificarRol("administrador"), registrarPagoDevoluciones);
router.delete("/:id/pagos-devoluciones/:id_pago", verificarRol("administrador"), eliminarPagoDevoluciones);

export default router;