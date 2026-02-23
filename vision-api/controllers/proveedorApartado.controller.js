import { pool } from "../database.js";
import { v4 as uuidv4 } from "uuid";
import { registrarMovimientoInventario } from "./inventario.controller.js";

// ─────────────────────────────────────────────
// HELPER INTERNO: crear apartado por proveedor
// Llamado desde pedidos.controller.js al crear pedido
// ─────────────────────────────────────────────
export const crearApartadoProveedor = async ({ client, id_compra, id_proveedor, productos }) => {
  try {
    // ── Buscar si ya hay un apartado pendiente para este proveedor ──
    const existente = await client.query(
      `SELECT id_apartado, token FROM apartados_proveedor 
       WHERE id_proveedor = $1 AND estado = 'pendiente'
       ORDER BY fecha_creacion DESC LIMIT 1`,
      [id_proveedor]
    );

    let id_apartado, token;

    if (existente.rows.length > 0) {
      // Reutilizar el apartado pendiente existente
      id_apartado = existente.rows[0].id_apartado;
      token = existente.rows[0].token;
    } else {
      // Crear nuevo apartado solo si no hay uno pendiente
      token = uuidv4();
      const apartado = await client.query(
        `INSERT INTO apartados_proveedor (id_compra, id_proveedor, token, estado, fecha_creacion)
         VALUES ($1, $2, $3, 'pendiente', NOW())
         RETURNING id_apartado, token`,
        [id_compra, id_proveedor, token]
      );
      id_apartado = apartado.rows[0].id_apartado;
    }

    // ── Insertar productos evitando duplicados de producto+talla ──
    for (const prod of productos) {
      const { id_producto, tallas } = prod;
      for (const talla in tallas) {
        const cantidad = Number(tallas[talla]);
        if (cantidad <= 0) continue;

        // Si ya existe ese producto+talla en el apartado, sumar la cantidad
        const yaExiste = await client.query(
          `SELECT id_detalle, cantidad_solicitada FROM apartado_detalle_proveedor
           WHERE id_apartado = $1 AND id_producto = $2 AND talla = $3`,
          [id_apartado, id_producto, talla]
        );

        if (yaExiste.rows.length > 0) {
          // Sumar al existente
          await client.query(
            `UPDATE apartado_detalle_proveedor
             SET cantidad_solicitada = cantidad_solicitada + $1
             WHERE id_detalle = $2`,
            [cantidad, yaExiste.rows[0].id_detalle]
          );
        } else {
          // Insertar nuevo detalle
          await client.query(
            `INSERT INTO apartado_detalle_proveedor
             (id_apartado, id_producto, talla, cantidad_solicitada, estado)
             VALUES ($1, $2, $3, $4, 'pendiente')`,
            [id_apartado, id_producto, talla, cantidad]
          );
        }
      }
    }

    return { ok: true, id_apartado, token };
  } catch (error) {
    throw error;
  }
};

// ─────────────────────────────────────────────
// LISTAR APARTADOS (para el empacador/admin)
// ─────────────────────────────────────────────
export const listarApartados = async (req, res) => {
  try {
    const { estado } = req.query;

    let condicion = '';
    const params = [];

    if (estado) {
      condicion = 'WHERE ap.estado = $1';
      params.push(estado);
    }

    const result = await pool.query(`
            SELECT 
                ap.id_apartado,
                ap.estado,
                ap.fecha_creacion,
                ap.fecha_respuesta,
                ap.token,
                p.id_proveedor,
                p.nombre AS proveedor,
                p.telefono AS telefono_proveedor,
                -- Cantidad de ítems
                COUNT(adp.id_detalle) AS total_items,
                SUM(adp.cantidad_solicitada) AS total_pares_solicitados,
                -- Pares confirmados (cuando ya respondió)
                SUM(CASE WHEN adp.disponible = true THEN adp.cantidad_disponible ELSE 0 END) AS total_confirmados,
                -- Pares recogidos
                SUM(CASE WHEN adp.estado = 'recogido' THEN adp.cantidad_disponible ELSE 0 END) AS total_recogidos
            FROM apartados_proveedor ap
            INNER JOIN proveedores p ON ap.id_proveedor = p.id_proveedor
            LEFT JOIN apartado_detalle_proveedor adp ON ap.id_apartado = adp.id_apartado
            ${condicion}
            GROUP BY ap.id_apartado, p.id_proveedor
            ORDER BY 
                CASE WHEN ap.estado = 'pendiente' THEN 0 ELSE 1 END ASC,
                ap.fecha_creacion DESC
        `, params);

    res.json({ ok: true, apartados: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, msg: "Error al listar apartados" });
  }
};

// ─────────────────────────────────────────────
// DETALLE DE UN APARTADO (empacador ve qué confirmó el proveedor)
// ─────────────────────────────────────────────
export const obtenerApartadoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const apartado = await pool.query(`
            SELECT 
                ap.*,
                p.nombre AS proveedor,
                p.telefono AS telefono_proveedor
            FROM apartados_proveedor ap
            INNER JOIN proveedores p ON ap.id_proveedor = p.id_proveedor
            WHERE ap.id_apartado = $1
        `, [id]);

    if (apartado.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Apartado no encontrado" });
    }

    const detalles = await pool.query(`
            SELECT 
                adp.*,
                pr.nombre AS nombre_producto,
                pr.ruta_foto
            FROM apartado_detalle_proveedor adp
            INNER JOIN productos pr ON adp.id_producto = pr.id_producto
            WHERE adp.id_apartado = $1
            ORDER BY pr.nombre, adp.talla
        `, [id]);

    res.json({
      ok: true,
      apartado: apartado.rows[0],
      detalles: detalles.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, msg: "Error al obtener apartado" });
  }
};

// ─────────────────────────────────────────────
// VER APARTADO POR TOKEN (página pública del proveedor)
// ─────────────────────────────────────────────
export const verApartadoPorToken = async (req, res) => {
  try {
    const { token } = req.params;

    const apartado = await pool.query(`
            SELECT ap.id_apartado, ap.estado, ap.fecha_creacion,
                   p.nombre AS proveedor
            FROM apartados_proveedor ap
            JOIN proveedores p ON ap.id_proveedor = p.id_proveedor
            WHERE ap.token = $1
        `, [token]);

    if (apartado.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Apartado no encontrado" });
    }

    const detalles = await pool.query(`
            SELECT 
                adp.id_detalle,
                adp.id_producto,
                pr.nombre AS producto,
                pr.ruta_foto,
                adp.talla,
                adp.cantidad_solicitada,
                adp.disponible,
                adp.cantidad_disponible,
                adp.estado
            FROM apartado_detalle_proveedor adp
            JOIN productos pr ON pr.id_producto = adp.id_producto
            WHERE adp.id_apartado = $1
            ORDER BY pr.nombre, adp.talla
        `, [apartado.rows[0].id_apartado]);

    res.json({
      ok: true,
      apartado: apartado.rows[0],
      productos: detalles.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, msg: "Error cargando apartado" });
  }
};

// ─────────────────────────────────────────────
// PROVEEDOR RESPONDE (marca qué tiene disponible)
// ─────────────────────────────────────────────
export const responderApartadoProveedor = async (req, res) => {
  const client = await pool.connect();
  try {
    const { token } = req.params;
    const { productos } = req.body;

    await client.query("BEGIN");

    const apartado = await client.query(
      `SELECT id_apartado, estado, id_proveedor FROM apartados_proveedor WHERE token = $1`,
      [token]
    );

    if (apartado.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Apartado no encontrado" });
    }
    if (apartado.rows[0].estado !== 'pendiente') {
      return res.status(400).json({ ok: false, msg: "Este apartado ya fue respondido" });
    }

    const id_apartado = apartado.rows[0].id_apartado;
    const id_proveedor_actual = apartado.rows[0].id_proveedor;

    for (const prod of productos) {
      const { id_detalle, disponible, cantidad_disponible } = prod;
      await client.query(
        `UPDATE apartado_detalle_proveedor
         SET disponible = $1,
             cantidad_disponible = $2,
             estado = 'respondido'
         WHERE id_detalle = $3`,
        [disponible, cantidad_disponible || 0, id_detalle]
      );
    }

    await client.query(
      `UPDATE apartados_proveedor
       SET estado = 'respondido', fecha_respuesta = NOW()
       WHERE id_apartado = $1`,
      [id_apartado]
    );

    // ── AQUÍ EMPIEZAN LOS LOGS Y LA LÓGICA DE REASIGNACIÓN ──
    const noDisponibles = productos.filter(p => !p.disponible);
    console.log('🔴 No disponibles:', noDisponibles);

    for (const prod of noDisponibles) {
      const detalle = await client.query(
        `SELECT id_producto, talla, cantidad_solicitada
         FROM apartado_detalle_proveedor
         WHERE id_detalle = $1`,
        [prod.id_detalle]
      );
      console.log('📦 Detalle:', detalle.rows);

      if (detalle.rows.length === 0) continue;

      const { id_producto, talla, cantidad_solicitada } = detalle.rows[0];

      const siguienteProveedor = await client.query(
        `SELECT pp.id_proveedor, pp.precio_proveedor, p.nombre
         FROM productos_proveedores pp
         JOIN proveedores p ON pp.id_proveedor = p.id_proveedor
         WHERE pp.id_producto = $1
           AND pp.id_proveedor != $2
           AND pp.activo = true
         ORDER BY pp.precio_proveedor ASC
         LIMIT 1`,
        [id_producto, id_proveedor_actual]
      );
      console.log('🏢 Siguiente proveedor:', siguienteProveedor.rows);

      if (siguienteProveedor.rows.length === 0) continue;

      const { id_proveedor: id_proveedor_nuevo } = siguienteProveedor.rows[0];

      const apartadoExistente = await client.query(
        `SELECT id_apartado FROM apartados_proveedor
         WHERE id_proveedor = $1 AND estado = 'pendiente'
         ORDER BY fecha_creacion DESC
         LIMIT 1`,
        [id_proveedor_nuevo]
      );
      console.log('📋 Apartado existente:', apartadoExistente.rows);

      let id_apartado_destino;

      if (apartadoExistente.rows.length > 0) {
        id_apartado_destino = apartadoExistente.rows[0].id_apartado;
        // Actualizar fecha para que suba al tope
        await client.query(
          `UPDATE apartados_proveedor SET fecha_creacion = NOW() 
         WHERE id_apartado = $1`,
          [id_apartado_destino]
        );
      } else {
        const nuevoApartado = await client.query(
          `INSERT INTO apartados_proveedor (id_proveedor, token, estado, fecha_creacion)
           VALUES ($1, $2, 'pendiente', NOW())
           RETURNING id_apartado`,
          [id_proveedor_nuevo, uuidv4()]
        );
        id_apartado_destino = nuevoApartado.rows[0].id_apartado;
        console.log('✅ Nuevo apartado creado:', id_apartado_destino);
      }

      const yaExiste = await client.query(
        `SELECT id_detalle FROM apartado_detalle_proveedor
         WHERE id_apartado = $1 AND id_producto = $2 AND talla = $3`,
        [id_apartado_destino, id_producto, talla]
      );
      console.log('🔍 Ya existe detalle:', yaExiste.rows);

      if (yaExiste.rows.length > 0) continue;

      await client.query(
        `INSERT INTO apartado_detalle_proveedor
         (id_apartado, id_producto, talla, cantidad_solicitada, estado)
         VALUES ($1, $2, $3, $4, 'pendiente')`,
        [id_apartado_destino, id_producto, talla, cantidad_solicitada]
      );
      console.log('✅ Detalle insertado en apartado:', id_apartado_destino);
    }
    // ── FIN LÓGICA REASIGNACIÓN ──
    console.log('✅ FUNCIÓN EJECUTADA - productos recibidos:', JSON.stringify(productos));
    await client.query("COMMIT");
    res.json({ ok: true, msg: "¡Respuesta registrada! Gracias." });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error('❌ Error:', error);
    res.status(500).json({ ok: false, msg: "Error al responder apartado" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// MARCAR RECOGIDO + FOTO DE EVIDENCIA
// El empacador marca qué recogió y sube foto
// Esto dispara entrada al inventario
// ─────────────────────────────────────────────
export const marcarRecogido = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params; // id_apartado
    const { items, foto_evidencia } = req.body;
    // items = [{ id_detalle, cantidad_recogida }]

    const id_usuario = req.usuario.id_usuario;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, msg: "Debes indicar los ítems recogidos" });
    }

    await client.query("BEGIN");

    // Verificar que el apartado existe y fue respondido
    const apartado = await client.query(
      `SELECT id_apartado, estado, id_proveedor FROM apartados_proveedor WHERE id_apartado = $1`,
      [id]
    );

    if (apartado.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, msg: "Apartado no encontrado" });
    }

    if (!['respondido', 'parcial'].includes(apartado.rows[0].estado)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, msg: "El proveedor aún no ha respondido este apartado" });
    }

    // Preparar productos para el ajuste de inventario
    const productosInventario = [];

    for (const item of items) {
      const { id_detalle, cantidad_recogida } = item;

      if (!cantidad_recogida || cantidad_recogida <= 0) continue;

      // Obtener el detalle
      const detalle = await client.query(
        `SELECT id_producto, talla, cantidad_disponible, estado
                 FROM apartado_detalle_proveedor
                 WHERE id_detalle = $1 AND id_apartado = $2`,
        [id_detalle, id]
      );

      if (detalle.rows.length === 0) continue;

      const d = detalle.rows[0];

      if (cantidad_recogida > d.cantidad_disponible) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          msg: `No puedes recoger más de lo confirmado por el proveedor`
        });
      }

      // Actualizar estado del detalle
      await client.query(
        `UPDATE apartado_detalle_proveedor
                 SET estado = 'recogido',
                     foto_evidencia = $1
                 WHERE id_detalle = $2`,
        [foto_evidencia || null, id_detalle]
      );

      productosInventario.push({
        id_producto: d.id_producto,
        talla: d.talla,
        cantidad: cantidad_recogida
      });
    }

    // Registrar entrada en inventario
    if (productosInventario.length > 0) {
      await registrarMovimientoInventario({
        tipo: 'entrada',
        motivo: 'recogida_proveedor',
        observaciones: `Recogida apartado #${id}`,
        id_usuario,
        productos: productosInventario
      });
    }

    // Verificar si todos los ítems fueron recogidos
    const pendientes = await client.query(
      `SELECT COUNT(*) AS total
             FROM apartado_detalle_proveedor
             WHERE id_apartado = $1 AND disponible = true AND estado != 'recogido'`,
      [id]
    );

    const nuevoEstado = parseInt(pendientes.rows[0].total) === 0 ? 'completado' : 'parcial';

    await client.query(
      `UPDATE apartados_proveedor SET estado = $1 WHERE id_apartado = $2`,
      [nuevoEstado, id]
    );
    // ── Actualizar saldo del proveedor según lo recogido ──
    const id_proveedor = apartado.rows[0].id_proveedor;
    let montoTotal = 0;
    console.log('💰 productosInventario:', productosInventario);
    console.log('💰 id_proveedor:', id_proveedor);
    for (const prod of productosInventario) {
      const precioResult = await client.query(
        `SELECT precio_proveedor 
            FROM productos_proveedores 
            WHERE id_proveedor = $1 AND id_producto = $2 AND activo = true`,
        [id_proveedor, prod.id_producto]
      );

      if (precioResult.rows.length > 0) {
        const precio = parseFloat(precioResult.rows[0].precio_proveedor);
        montoTotal += prod.cantidad * precio;
      }
    }

    if (montoTotal > 0) {
      await client.query(
        `UPDATE proveedores 
            SET saldo_total = saldo_total + $1 
            WHERE id_proveedor = $2`,
        [montoTotal, id_proveedor]
      );
    }


    await client.query("COMMIT");

    res.json({
      ok: true,
      msg: nuevoEstado === 'completado'
        ? 'Recogida completada. Inventario actualizado.'
        : 'Recogida parcial registrada. Inventario actualizado.',
      estado: nuevoEstado
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ ok: false, msg: "Error al marcar recogido" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// SUBIR FOTO DE EVIDENCIA (separado, por si la sube después)
// ─────────────────────────────────────────────
export const subirFotoEvidencia = async (req, res) => {
  try {
    const { id, id_detalle } = req.params;
    const foto_evidencia = req.file ? `/imagenes/${req.file.filename}` : req.body.foto_evidencia;

    if (!foto_evidencia) {
      return res.status(400).json({ ok: false, msg: "No se recibió foto" });
    }

    await pool.query(
      `UPDATE apartado_detalle_proveedor SET foto_evidencia = $1
             WHERE id_detalle = $2 AND id_apartado = $3`,
      [foto_evidencia, id_detalle, id]
    );

    res.json({ ok: true, msg: "Foto guardada", foto_evidencia });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, msg: "Error al guardar foto" });
  }
};

// ─────────────────────────────────────────────
// GENERAR LINK DE WHATSAPP
// ─────────────────────────────────────────────
export const generarLinkWhatsapp = async (req, res) => {
  try {
    const { id } = req.params;

    const apartado = await pool.query(`
            SELECT ap.token, ap.id_apartado,
                   p.nombre AS proveedor, p.telefono
            FROM apartados_proveedor ap
            INNER JOIN proveedores p ON ap.id_proveedor = p.id_proveedor
            WHERE ap.id_apartado = $1
        `, [id]);

    if (apartado.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Apartado no encontrado" });
    }

    const { token, proveedor, telefono } = apartado.rows[0];
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const linkApartado = `${baseUrl}/proveedor/apartado/${token}`;

    const mensaje = `Hola ${proveedor} 👋\n\nTenemos productos pendientes de confirmación.\n\nPor favor indícanos disponibilidad en el siguiente enlace:\n👉 ${linkApartado}\n\nGracias.`;

    const linkWhatsapp = `https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`;

    res.json({ ok: true, link_whatsapp: linkWhatsapp, link_apartado: linkApartado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, msg: "Error al generar link" });
  }
};