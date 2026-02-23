import { pool } from "../database.js";

// Helper: construir la URL pública de la imagen
// Ejemplo resultado: /imagenes/producto-1234567890.jpg
function rutaPublica(nombreArchivo) {
    if (!nombreArchivo) return null;
    return `/imagenes/${nombreArchivo}`;
}

// Obtener todos los productos con información de proveedores
export const obtenerProductos = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.id_producto,
                p.nombre,
                p.descripcion,
                p.precio,
                p.ruta_foto,
                -- Cantidad total apartada
                COALESCE(SUM(dc.cantidad), 0) as total_apartado,
                -- Cantidad total recibida
                COALESCE(SUM(dc.cantidad_recibida), 0) as total_recibido,
                -- Cantidad de proveedores que lo han suministrado
                COUNT(DISTINCT c.id_proveedor) as proveedores_count
            FROM productos p
            LEFT JOIN detalle_compras dc ON p.id_producto = dc.id_producto
            LEFT JOIN compras c ON dc.id_compra = c.id_compra
            GROUP BY p.id_producto
            ORDER BY p.nombre
        `);

        res.json({ ok: true, productos: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener productos" });
    }
};

// Obtener producto por ID con historial completo
export const obtenerProductoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        // Datos del producto
        const producto = await pool.query(
            `SELECT * FROM productos WHERE id_producto = $1`,
            [id]
        );

        if (producto.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Producto no encontrado" });
        }

        // Historial de compras por proveedor
        const historialCompras = await pool.query(`
            SELECT 
                c.id_compra,
                c.fecha_compra,
                prov.nombre as proveedor,
                prov.id_proveedor,
                dc.cantidad,
                dc.cantidad_recibida,
                dc.precio_unitario,
                dc.subtotal,
                dc.estado,
                dc.foto_evidencia
            FROM detalle_compras dc
            INNER JOIN compras c ON dc.id_compra = c.id_compra
            INNER JOIN proveedores prov ON c.id_proveedor = prov.id_proveedor
            WHERE dc.id_producto = $1
            ORDER BY c.fecha_compra DESC
        `, [id]);

        // Proveedores que han suministrado este producto
        const proveedores = await pool.query(`
            SELECT DISTINCT
                prov.id_proveedor,
                prov.nombre,
                prov.telefono,
                -- Última vez que suministró
                MAX(c.fecha_compra) as ultima_compra,
                -- Precio más reciente
                (SELECT dc2.precio_unitario 
                 FROM detalle_compras dc2
                 INNER JOIN compras c2 ON dc2.id_compra = c2.id_compra
                 WHERE dc2.id_producto = $1 
                   AND c2.id_proveedor = prov.id_proveedor
                 ORDER BY c2.fecha_compra DESC
                 LIMIT 1) as ultimo_precio,
                -- Total suministrado
                SUM(dc.cantidad) as total_suministrado
            FROM detalle_compras dc
            INNER JOIN compras c ON dc.id_compra = c.id_compra
            INNER JOIN proveedores prov ON c.id_proveedor = prov.id_proveedor
            WHERE dc.id_producto = $1
            GROUP BY prov.id_proveedor
            ORDER BY ultima_compra DESC
        `, [id]);

        res.json({
            ok: true,
            producto: producto.rows[0],
            historial: historialCompras.rows,
            proveedores: proveedores.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener producto" });
    }
};

// Crear producto
export const crearProducto = async (req, res) => {
    try {
        const { nombre, descripcion, precio } = req.body;

        // Validaciones
        if (!nombre || !precio) {
            return res.status(400).json({ 
                ok: false, 
                msg: "Nombre y precio son requeridos" 
            });
        }

        if (precio <= 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "El precio debe ser mayor a 0" 
            });
        }

        // Verificar si ya existe un producto con el mismo nombre
        const existe = await pool.query(
            "SELECT id_producto FROM productos WHERE LOWER(nombre) = LOWER($1)",
            [nombre]
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "Ya existe un producto con ese nombre" 
            });
        }

        // Si se subió una imagen, multer la guarda en req.file
        const ruta_foto = req.file ? rutaPublica(req.file.filename) : null;

        const result = await pool.query(
            `INSERT INTO productos (nombre, descripcion, precio, ruta_foto) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [nombre, descripcion || null, precio, ruta_foto]
        );

        res.status(201).json({ 
            ok: true, 
            msg: "Producto creado exitosamente",
            producto: result.rows[0] 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al crear producto" });
    }
};

// Actualizar producto
export const actualizarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio } = req.body;

        // Validar que el producto existe
        const existe = await pool.query(
            "SELECT id_producto FROM productos WHERE id_producto = $1",
            [id]
        );

        if (existe.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Producto no encontrado" });
        }

        // Construir query dinámico
        const campos = [];
        const valores = [];
        let contador = 1;

        if (nombre) {
            campos.push(`nombre = $${contador++}`);
            valores.push(nombre);
        }
        if (descripcion !== undefined) {
            campos.push(`descripcion = $${contador++}`);
            valores.push(descripcion);
        }
        if (precio !== undefined) {
            if (precio <= 0) {
                return res.status(400).json({ 
                    ok: false, 
                    msg: "El precio debe ser mayor a 0" 
                });
            }
            campos.push(`precio = $${contador++}`);
            valores.push(precio);
        }

        // Si se subió nueva imagen
        if (req.file) {
            campos.push(`ruta_foto = $${contador++}`);
            valores.push(rutaPublica(req.file.filename));
        }

        if (campos.length === 0) {
            return res.status(400).json({ ok: false, msg: "No hay campos para actualizar" });
        }

        valores.push(id);
        const result = await pool.query(
            `UPDATE productos SET ${campos.join(', ')} WHERE id_producto = $${contador}`,
            valores
        );

        res.json({ 
            ok: true,
            msg: "Producto actualizado exitosamente",
            producto: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al actualizar producto" });
    }
};

// Eliminar producto
export const eliminarProducto = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si tiene compras asociadas
        const compras = await pool.query(
            "SELECT COUNT(*) as total FROM detalle_compras WHERE id_producto = $1",
            [id]
        );

        if (parseInt(compras.rows[0].total) > 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "No se puede eliminar el producto porque tiene compras asociadas" 
            });
        }

        const result = await pool.query(
            "DELETE FROM productos WHERE id_producto = $1 RETURNING id_producto",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Producto no encontrado" });
        }

        res.json({ ok: true, msg: "Producto eliminado exitosamente" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar producto" });
    }
};

// Buscar productos por nombre
export const buscarProductos = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "Parámetro de búsqueda requerido" 
            });
        }

        const result = await pool.query(`
            SELECT 
                p.id_producto,
                p.nombre,
                p.descripcion,
                p.precio,
                p.ruta_foto,
                COALESCE(SUM(dc.cantidad), 0) as total_apartado,
                COUNT(DISTINCT c.id_proveedor) as proveedores_count
            FROM productos p
            LEFT JOIN detalle_compras dc ON p.id_producto = dc.id_producto
            LEFT JOIN compras c ON dc.id_compra = c.id_compra
            WHERE LOWER(p.nombre) LIKE LOWER($1) 
               OR LOWER(p.descripcion) LIKE LOWER($1)
            GROUP BY p.id_producto
            ORDER BY p.nombre
            LIMIT 50
        `, [`%${q}%`]);

        res.json({ 
            ok: true, 
            productos: result.rows,
            total: result.rows.length 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al buscar productos" });
    }
};

// Obtener productos de un proveedor específico
export const obtenerProductosPorProveedor = async (req, res) => {
    try {
        const { id_proveedor } = req.params;

        const result = await pool.query(`
            SELECT DISTINCT
                p.id_producto,
                p.nombre,
                p.descripcion,
                p.precio,
                p.ruta_foto,
                -- Última compra con este proveedor
                MAX(c.fecha_compra) as ultima_compra,
                -- Último precio que cobró
                (SELECT dc2.precio_unitario 
                 FROM detalle_compras dc2
                 INNER JOIN compras c2 ON dc2.id_compra = c2.id_compra
                 WHERE dc2.id_producto = p.id_producto 
                   AND c2.id_proveedor = $1
                 ORDER BY c2.fecha_compra DESC
                 LIMIT 1) as ultimo_precio_proveedor,
                -- Total suministrado por este proveedor
                SUM(dc.cantidad) as total_suministrado
            FROM productos p
            INNER JOIN detalle_compras dc ON p.id_producto = dc.id_producto
            INNER JOIN compras c ON dc.id_compra = c.id_compra
            WHERE c.id_proveedor = $1
            GROUP BY p.id_producto
            ORDER BY ultima_compra DESC
        `, [id_proveedor]);

        res.json({ 
            ok: true, 
            productos: result.rows 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener productos del proveedor" });
    }
};

// Actualizar foto del producto
export const actualizarFotoProducto = async (req, res) => {
    try {
        const { id } = req.params;
        

        if (!req.file) {
            return res.status(400).json({ 
                ok: false, 
                msg: "Ruta de foto es requerida" 
            });
        }

        const ruta_foto = rutaPublica(req.file.filename);

        const result = await pool.query(
            `UPDATE productos SET ruta_foto = $1 WHERE id_producto = $2 RETURNING *`,
            [ruta_foto, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Producto no encontrado" });
        }

        res.json({ 
            ok: true, 
            msg: "Foto actualizada exitosamente",
            producto: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al actualizar foto" });
    }
};