import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./database.js";
import usuariosRoutes from "./routes/usuarios.js";
import authRoutes from "./routes/auth.routes.js";
import proveedoresRoutes from "./routes/proveedores.js";
import productosRoutes from "./routes/productos.js";
import comprasRoutes from "./routes/compras.js";
import devolucionesRoutes from "./routes/devoluciones.js";
import rolesRoutes from "./routes/roles.js";
import inventarioRoutes from "./routes/inventario.js";
import apartadosRoutes from "./routes/apartados.js";
import transportadorasRoutes from "./routes/transportadoras.js";
import pedidosRoutes from "./routes/pedidos.js";
import configuracionRoutes from "./routes/configuracion.js";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)
dotenv.config();
process.env.TZ = 'America/Bogota';

const app = express();

app.use(cors());
app.use(express.json());




app.use(express.static(path.join(__dirname, "../vision-frontend")));

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../vision-frontend/index.html")
    );
}),
    // Ruta de prueba
    app.get("/test-db", async (req, res) => {
        try {
            const result = await pool.query("SELECT NOW()");
            res.json({ ok: true, time: result.rows[0] });
        } catch (error) {
            res.json({ ok: false, error: error.message });
        }
    });

app.use("/usuarios", usuariosRoutes);
app.use("/auth", authRoutes);
app.use("/roles", rolesRoutes);
app.use("/proveedores", proveedoresRoutes);
app.use("/productos", productosRoutes);
// Página pública para el proveedor
app.get("/proveedor/apartado/:token", (_, res) => {
    res.sendFile(path.join(__dirname, "../vision-frontend/proveedor-apartado.html"));
});
app.use("/api", apartadosRoutes);  // cubre /api/proveedor/apartado/:token

app.use("/devoluciones", devolucionesRoutes);
app.use("/inventario", inventarioRoutes);
app.use("/transportadoras", transportadorasRoutes);
app.use("/pedidos", pedidosRoutes);
app.use("/configuracion", configuracionRoutes);
app.use("/compras", comprasRoutes);

app.use("/imagenes", express.static("imagenes"));

// Iniciar servidor
app.listen(process.env.PORT, () => {
    console.log(`servidor corriendo en https://localhost:${process.env.PORT}`);
});


