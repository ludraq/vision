import { pool } from "../database.js";


export const registrarMovimientoInventario = async ({
  tipo,
  motivo,
  observaciones,
  id_usuario,
  productos
}) => {
  const client = await pool.connect();

  try {
    if (!['entrada', 'salida'].includes(tipo)) {
      throw new Error("Tipo de movimiento inválido");
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      throw new Error("Debe incluir productos");
    }

    await client.query("BEGIN");

    const ajuste = await client.query(
      `INSERT INTO ajustes_inventario
       (tipo, motivo, observaciones, id_usuario)
       VALUES ($1, $2, $3, $4)
       RETURNING id_ajuste`,
      [tipo, motivo, observaciones || null, id_usuario]
    );

    const id_ajuste = ajuste.rows[0].id_ajuste;

    for (const prod of productos) {
      const { id_producto, talla, cantidad } = prod;

      if (!id_producto || !talla || cantidad <= 0) {
        throw new Error("Producto mal formado");
      }

      await client.query(
        `INSERT INTO detalle_ajuste_inventario
         (id_ajuste, id_producto, talla, cantidad)
         VALUES ($1, $2, $3, $4)`,
        [id_ajuste, id_producto, talla, cantidad]
      );
    }

    await client.query("COMMIT");

    return { ok: true, id_ajuste };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};


export const ajusteManualInventario = async (req, res) => {
  try {
    const { tipo, motivo, observaciones, productos } = req.body;
    const id_usuario = req.usuario.id_usuario;

    const resultado = await registrarMovimientoInventario({
      tipo,
      motivo,
      observaciones,
      id_usuario,
      productos
    });

    res.json({
      ok: true,
      msg: "Ajuste de inventario realizado",
      id_ajuste: resultado.id_ajuste
    });

  } catch (error) {
    res.status(400).json({
      ok: false,
      msg: error.message
    });
  }
};
/**
 * 📦 LISTAR INVENTARIO ACTUAL
 * GET /inventario
 */
export const listarInventario = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id_producto,
        p.nombre AS producto,
        di.talla,
        SUM(
          CASE 
            WHEN ai.tipo = 'entrada' THEN di.cantidad
            WHEN ai.tipo = 'salida' THEN -di.cantidad
          END
        ) AS cantidad
      FROM ajustes_inventario ai
      JOIN detalle_ajuste_inventario di ON ai.id_ajuste = di.id_ajuste
      JOIN productos p ON p.id_producto = di.id_producto
      GROUP BY p.id_producto, p.nombre, di.talla
      ORDER BY p.nombre, di.talla
    `);

    res.json({
      ok: true,
      inventario: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      msg: "Error al obtener inventario"
    });
  }
};
export const registrarCompraRecibida = async (req, res) => {
  res.status(501).json({
    ok: false,
    msg: "Función no implementada aún"
  });
};

export const registrarDevolucionTransportadora = async (req, res) => {
  res.status(501).json({
    ok: false,
    msg: "Función no implementada aún"
  });
};
