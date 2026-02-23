import express from "express";
import {
  listarInventario,
  ajusteManualInventario,
  registrarCompraRecibida,
  registrarDevolucionTransportadora
} from "../controllers/inventario.controller.js";

import { verificarToken,verificarRol } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * 📦 LISTAR INVENTARIO ACTUAL
 * GET /inventario
 */
router.get(
  "/",
  verificarToken,
  verificarRol("administrador", "bodeguero", "empacador"),
  listarInventario
);

/**
 * ➕ AJUSTE MANUAL DE INVENTARIO
 * POST /inventario/ajuste-manual
 */
router.post(
  "/ajuste-manual",
  verificarToken,
  verificarRol("administrador", "bodeguero"),
  ajusteManualInventario
);

/**
 * 📥 COMPRA RECIBIDA
 * POST /inventario/compra-recibida
 */
router.post(
  "/compra-recibida",
  verificarToken,
  verificarRol("administrador", "bodeguero"),
  registrarCompraRecibida
);

/**
 * 🔄 DEVOLUCIÓN DE TRANSPORTADORA
 * POST /inventario/devolucion
 */
router.post(
  "/devolucion",
  verificarToken,
  verificarRol("administrador", "bodeguero"),
  registrarDevolucionTransportadora
);

export default router;
