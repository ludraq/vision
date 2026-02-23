import { pool } from "../database.js";

// Asignar producto a un proveedor con su precio
export const asignarProductoAProveedor = async (req, res) => {
    try {
        const { id } = req.params; // id_producto
        const { id_proveedor, precio_proveedor } = req.body;

        // Validaciones
        if (!id_proveedor || !precio_proveedor) {
            return res.status(400).json({ 
                ok: false, 
                msg: "ID de proveedor y precio son requeridos" 
            });
        }

        if (precio_proveedor <= 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "El precio debe ser mayor a 0" 
            });
        }

        // Verificar que el producto existe
        const producto = await pool.query(
            "SELECT id_producto FROM productos WHERE id_producto = $1",
            [id]
        );

        if (producto.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Producto no encontrado" });
        }

        // Verificar que el proveedor existe
        const proveedor = await pool.query(
            "SELECT id_proveedor FROM proveedores WHERE id_proveedor = $1",
            [id_proveedor]
        );

        if (proveedor.rows.length === 0) {
            return res.status(404).json({ ok: false, msg: "Proveedor no encontrado" });
        }

        // Verificar si ya existe la relación
        const existe = await pool.query(
            "SELECT id_producto_proveedor FROM productos_proveedores WHERE id_producto = $1 AND id_proveedor = $2",
            [id, id_proveedor]
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "Este producto ya está asignado a ese proveedor. Use PUT para actualizar el precio." 
            });
        }

        // Crear la relación
        const result = await pool.query(
            `INSERT INTO productos_proveedores (id_producto, id_proveedor, precio_proveedor, activo) 
             VALUES ($1, $2, $3, true) 
             RETURNING *`,
            [id, id_proveedor, precio_proveedor]
        );

        res.status(201).json({ 
            ok: true, 
            msg: "Producto asignado al proveedor exitosamente",
            relacion: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al asignar producto a proveedor" });
    }
};

// Obtener todos los proveedores que manejan un producto
export const obtenerProveedoresDeProducto = async (req, res) => {
    try {
        const { id } = req.params; // id_producto

        const result = await pool.query(`
            SELECT 
                pp.id_producto_proveedor,
                pp.precio_proveedor,
                pp.fecha_actualizacion,
                pp.activo,
                prov.id_proveedor,
                prov.nombre,
                prov.telefono,
                prov.cedula,
                -- Historial de compras
                COALESCE((
                    SELECT SUM(dc.cantidad)
                    FROM detalle_compras dc
                    INNER JOIN compras c ON dc.id_compra = c.id_compra
                    WHERE dc.id_producto = pp.id_producto 
                      AND c.id_proveedor = pp.id_proveedor
                ), 0) as total_suministrado,
                -- Última compra
                (
                    SELECT MAX(c.fecha_compra)
                    FROM compras c
                    INNER JOIN detalle_compras dc ON c.id_compra = dc.id_compra
                    WHERE dc.id_producto = pp.id_producto 
                      AND c.id_proveedor = pp.id_proveedor
                ) as ultima_compra
            FROM productos_proveedores pp
            INNER JOIN proveedores prov ON pp.id_proveedor = prov.id_proveedor
            WHERE pp.id_producto = $1
            ORDER BY pp.activo DESC, pp.precio_proveedor ASC
        `, [id]);

        res.json({ 
            ok: true, 
            proveedores: result.rows 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al obtener proveedores del producto" });
    }
};

// Obtener todos los productos que maneja un proveedor
export const obtenerProductosDeProveedor = async (req, res) => {
    try {
        const { id_proveedor } = req.params;

        const result = await pool.query(`
            SELECT 
                pp.id_producto_proveedor,
                pp.precio_proveedor,
                pp.fecha_actualizacion,
                pp.activo,
                prod.id_producto,
                prod.nombre,
                prod.descripcion,
                prod.precio as precio_base,
                prod.ruta_foto,
                -- Diferencia de precio
                (pp.precio_proveedor - prod.precio) as diferencia_precio,
                -- Total suministrado
                COALESCE((
                    SELECT SUM(dc.cantidad)
                    FROM detalle_compras dc
                    INNER JOIN compras c ON dc.id_compra = c.id_compra
                    WHERE dc.id_producto = pp.id_producto 
                      AND c.id_proveedor = pp.id_proveedor
                ), 0) as total_suministrado
            FROM productos_proveedores pp
            INNER JOIN productos prod ON pp.id_producto = prod.id_producto
            WHERE pp.id_proveedor = $1 AND pp.activo = true
            ORDER BY prod.nombre
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

// Actualizar precio de un producto para un proveedor específico
export const actualizarPrecioProveedor = async (req, res) => {
    try {
        const { id, id_proveedor } = req.params;
        const { precio_proveedor, activo } = req.body;

        // Validaciones
        if (precio_proveedor !== undefined && precio_proveedor <= 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "El precio debe ser mayor a 0" 
            });
        }

        // Construir query dinámico
        const campos = [];
        const valores = [];
        let contador = 1;

        if (precio_proveedor !== undefined) {
            campos.push(`precio_proveedor = $${contador++}`);
            valores.push(precio_proveedor);
            campos.push(`fecha_actualizacion = CURRENT_DATE`);
        }

        if (activo !== undefined) {
            campos.push(`activo = $${contador++}`);
            valores.push(activo);
        }

        if (campos.length === 0) {
            return res.status(400).json({ ok: false, msg: "No hay campos para actualizar" });
        }

        valores.push(id, id_proveedor);

        const result = await pool.query(
            `UPDATE productos_proveedores 
             SET ${campos.join(', ')} 
             WHERE id_producto = $${contador++} AND id_proveedor = $${contador}
             RETURNING *`,
            valores
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                ok: false, 
                msg: "No se encontró la relación producto-proveedor" 
            });
        }

        res.json({ 
            ok: true, 
            msg: "Precio actualizado exitosamente",
            relacion: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al actualizar precio" });
    }
};

// Desactivar producto para un proveedor (soft delete)
export const desactivarProductoProveedor = async (req, res) => {
    try {
        const { id, id_proveedor } = req.params;

        const result = await pool.query(
            `UPDATE productos_proveedores 
             SET activo = false 
             WHERE id_producto = $1 AND id_proveedor = $2
             RETURNING *`,
            [id, id_proveedor]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                ok: false, 
                msg: "No se encontró la relación producto-proveedor" 
            });
        }

        res.json({ 
            ok: true, 
            msg: "Producto desactivado para este proveedor"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al desactivar producto" });
    }
};

// Eliminar relación producto-proveedor (hard delete)
export const eliminarProductoProveedor = async (req, res) => {
    try {
        const { id, id_proveedor } = req.params;

        // Verificar si tiene compras asociadas
        const compras = await pool.query(
            `SELECT COUNT(*) as total 
             FROM detalle_compras dc
             INNER JOIN compras c ON dc.id_compra = c.id_compra
             WHERE dc.id_producto = $1 AND c.id_proveedor = $2`,
            [id, id_proveedor]
        );

        if (parseInt(compras.rows[0].total) > 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: "No se puede eliminar porque existen compras registradas. Use desactivar en su lugar." 
            });
        }

        const result = await pool.query(
            "DELETE FROM productos_proveedores WHERE id_producto = $1 AND id_proveedor = $2 RETURNING *",
            [id, id_proveedor]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                ok: false, 
                msg: "No se encontró la relación producto-proveedor" 
            });
        }

        res.json({ 
            ok: true, 
            msg: "Relación eliminada exitosamente" 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: "Error al eliminar relación" });
    }
};