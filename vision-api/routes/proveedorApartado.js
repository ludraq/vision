import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  verApartadoPorToken,
  responderApartadoProveedor
} from "../controllers/proveedorApartado.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
router.get("/proveedor/apartado/:token", (req, res) => {
  res.sendFile(
    path.resolve(
      __dirname,
      "../../vision-frontend/pages/apartadosProveedor.html"
    )
  );
});

// Público (sin auth)
router.get("/api/proveedor/apartado/:token", verApartadoPorToken);
router.post("/api/proveedor/apartado/:token/responder", responderApartadoProveedor);

export default router;
