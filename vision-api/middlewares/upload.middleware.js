import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta destino: vision-api/imagenes
const CARPETA_IMAGENES = path.join(__dirname, "../imagenes");

// Crear la carpeta si no existe
if (!fs.existsSync(CARPETA_IMAGENES)) {
    fs.mkdirSync(CARPETA_IMAGENES, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, CARPETA_IMAGENES);
    },
    filename: function (req, file, cb) {
        // Nombre único: producto-timestamp.ext
        const ext = path.extname(file.originalname).toLowerCase();
        const nombreUnico = `producto-${Date.now()}${ext}`;
        cb(null, nombreUnico);
    }
});

const fileFilter = (req, file, cb) => {
    const tiposPermitidos = /jpeg|jpg|png|webp/;
    const esValido = tiposPermitidos.test(
        path.extname(file.originalname).toLowerCase()
    );

    if (esValido) {
        cb(null, true);
    } else {
        cb(new Error("Solo se permiten imágenes JPG, PNG o WEBP"), false);
    }
};

export const uploadImagen = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB máximo
});