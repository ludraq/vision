import { Router } from "express";
import { obtenerRoles } from "../controllers/roles.controller.js";

const router = Router();

// GET /roles
router.get("/", obtenerRoles);

export default router;
