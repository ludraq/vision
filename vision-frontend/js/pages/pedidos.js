/**
 * MÓDULO DE PEDIDOS — Vision
 */

let todosPedidos = [];
let todosProductos = [];
let todasTransportadoras = [];
let productosEnPedido = [];  // [{ id_producto, nombre, talla, cantidad, precio_unitario, id_proveedor, ruta_foto }]
let comisionBase = 0;
let nombreCuentaGlobal = '';
let usuarioActual = null;

document.addEventListener('DOMContentLoaded', () => { renderSidebar(); });

document.addEventListener('DOMContentLoaded', async function () {
    if (!requireAuth() || !requireRole(['administrador', 'vendedor', 'bodeguero'])) return;

    mostrarInfoUsuarioSidebar();
    configurarMenuMovil();
    configurarLogout();


    usuarioActual = JSON.parse(localStorage.getItem('usuario') || '{}');
    await Promise.all([
        cargarConfiguracion(),
        cargarTransportadoras(),
        cargarProductos()
    ]);
    await cargarPedidos();
    configurarEventos();
});

// ─────────────────────────────────────────────
// CARGA DE DATOS INICIALES
// ─────────────────────────────────────────────
async function cargarConfiguracion() {
    try {
        const res = await apiGet(API_CONFIG.ENDPOINTS.CONFIGURACION);
        if (res.ok && res.configuracion) {
            comisionBase = parseFloat(res.configuracion.comision_base) || 0;
            nombreCuentaGlobal = res.configuracion.nombre_cuenta || '';
            document.getElementById('nombreCuenta').value = nombreCuentaGlobal;
        }
    } catch (e) { console.error('Error config:', e); }
}

async function cargarTransportadoras() {
    try {
        const res = await apiGet(API_CONFIG.ENDPOINTS.TRANSPORTADORAS);
        if (res.ok) {
            todasTransportadoras = res.transportadoras;
            const sel = document.getElementById('transportadoraSelect');
            sel.innerHTML = '<option value="">Seleccionar...</option>';
            res.transportadoras.forEach(t => {
                sel.innerHTML += `<option value="${t.id_transportadora}" 
                    data-cuenta="${t.usuario || ''}">${t.nombre}</option>`;
            });
        }
    } catch (e) { console.error('Error transportadoras:', e); }
}

async function cargarProductos() {
    try {
        const res = await apiGet(API_CONFIG.ENDPOINTS.PRODUCTOS);
        if (res.ok) {
            todosProductos = res.productos;
            const sel = document.getElementById('selectorProducto');
            sel.innerHTML = '<option value="">-- Seleccionar producto --</option>';
            res.productos.forEach(p => {
                sel.innerHTML += `<option value="${p.id_producto}">${p.nombre} — $${formatearNumero(p.precio)}</option>`;
            });
        }
    } catch (e) { console.error('Error productos:', e); }
}

async function cargarPedidos(filtros = {}) {
    const tbody = document.getElementById('cuerpoTabla');
    tbody.innerHTML = '<tr><td colspan="13" class="text-center text-secondary" style="padding:24px;">Cargando...</td></tr>';

    try {
        let url = API_CONFIG.ENDPOINTS.PEDIDOS;
        const params = new URLSearchParams();
        if (filtros.buscar) params.append('buscar', filtros.buscar);
        if (filtros.estado) params.append('estado', filtros.estado);
        if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
        if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
        if (params.toString()) url += '?' + params.toString();

        const res = await apiGet(url);
        if (!res.ok) throw new Error(res.msg);

        todosPedidos = res.pedidos || [];
        renderTabla(todosPedidos);
        renderTotales(todosPedidos);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="13" class="text-center text-secondary" style="padding:24px;">Error al cargar pedidos</td></tr>';
    }
}

// ─────────────────────────────────────────────
// RENDER TABLA
// ─────────────────────────────────────────────
function renderTabla(lista) {
    const tbody = document.getElementById('cuerpoTabla');
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="13" class="text-center text-secondary" style="padding:32px;">No hay pedidos</td></tr>';
        return;
    }

    const esAdmin = usuarioActual.rol === 'administrador';

    tbody.innerHTML = lista.map(p => `
        <tr>
            <td><strong>#${p.id_pedido}</strong></td>
            <td>${p.numero_guia || '<span style="color:#bbb">—</span>'}</td>
            <td>${formatearFecha(p.fecha_venta)}</td>
            <td>
                <strong>${p.nombre_cliente}</strong><br>
                <span style="color:#888;font-size:0.75rem;">${p.celular_cliente}</span>
            </td>
            <td>${p.ciudad_destino}</td>
            <td>${p.nombre_asesor || p.usuario_asesor}</td>
            <td>${p.transportadora}</td>
            <td style="text-align:center;">${p.cantidad_pares}</td>
            <td class="valor-money">${formatearMoneda(p.valor_a_recaudar)}</td>
            <td>${formatearMoneda(p.costo_envio)}</td>
            <td class="valor-money"><strong>${formatearMoneda(p.valor_total)}</strong></td>
            <td><span class="badge-estado ${claseEstado(p.estado_envio)}">${p.estado_envio}</span></td>
            <td>
                <div class="acciones-td">
                    <button class="btn-tbl ver" onclick="verDetalle(${p.id_pedido})">👁 Ver</button>
                    <button class="btn-tbl edit" onclick="abrirActualizar(${p.id_pedido})">✏️</button>
                    ${esAdmin ? `<button class="btn-tbl del" onclick="eliminarPedido(${p.id_pedido})">🗑️</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function renderTotales(lista) {
    const entregados = lista.filter(p => p.estado_envio === 'ENTREGADO');
    const enRuta = lista.filter(p => p.estado_envio !== 'ENTREGADO' && p.estado_envio !== 'DEVUELTO AL REMITENTE' && p.estado_envio !== 'Pendiente');
    const totalRecaudar = lista.reduce((a, p) => a + parseFloat(p.valor_a_recaudar || 0), 0);

    document.getElementById('totalesRow').innerHTML = `
        <div class="total-chip azul"><span class="chip-label">Total pedidos</span><span class="chip-valor">${lista.length}</span></div>
        <div class="total-chip verde"><span class="chip-label">Entregados</span><span class="chip-valor">${entregados.length}</span></div>
        <div class="total-chip"><span class="chip-label">En ruta</span><span class="chip-valor">${enRuta.length}</span></div>
        <div class="total-chip verde"><span class="chip-label">Valor a recaudar</span><span class="chip-valor">${formatearMoneda(totalRecaudar)}</span></div>
    `;
}

function claseEstado(estado) {
    if (!estado) return '';
    const e = estado.toUpperCase();
    if (e === 'PENDIENTE') return 'estado-pendiente';
    if (e.includes('ENTREGADO') && !e.includes('DEVUELTO')) return 'estado-entregado';
    if (e.includes('DEVUELTO') || e.includes('DEVOLUCION')) return 'estado-devolucion';
    if (e.includes('BODEGA')) return 'estado-bodega';
    if (e.includes('DISTRIBUCION')) return 'estado-distribucion';
    if (e.includes('INTENTO')) return 'estado-intento';
    if (e.includes('CONFIRMACION') || e.includes('OFICINA')) return 'estado-confirmacion';
    if (e.includes('VIAJANDO')) return 'estado-viajando';
    return 'estado-pendiente';
}

// ─────────────────────────────────────────────
// CONFIGURAR EVENTOS
// ─────────────────────────────────────────────
function configurarEventos() {
    // Nuevo pedido
    document.getElementById('btnNuevoPedido').addEventListener('click', abrirModalNuevo);
    document.getElementById('btnCerrarModalPedido').addEventListener('click', cerrarModalPedido);
    document.getElementById('btnCancelarPedido').addEventListener('click', cerrarModalPedido);
    document.getElementById('modalPedido').addEventListener('click', e => {
        if (e.target.id === 'modalPedido') cerrarModalPedido();
    });
    document.getElementById('formPedido').addEventListener('submit', guardarPedido);

    // Recalcular resumen al cambiar envío/publicidad
    document.getElementById('costoEnvio').addEventListener('input', actualizarResumen);
    document.getElementById('valorPublicidad').addEventListener('input', actualizarResumen);

    document.getElementById('transportadoraSelect').addEventListener('change', function () {
        const opt = this.options[this.selectedIndex];
        document.getElementById('nombreCuenta').value = opt.dataset.cuenta || '—';
    });
    // Búsqueda de productos
    document.getElementById('buscarProductoInput').addEventListener('input', debounce(buscarEnDropdown, 250));
    document.getElementById('selectorProducto').addEventListener('change', agregarDesdeSelectorLista);
    document.addEventListener('click', e => {
        if (!e.target.closest('.producto-search-box')) {
            document.getElementById('productoDropdown').classList.remove('open');
        }
    });

    // Modal detalle
    document.getElementById('btnCerrarDetalle').addEventListener('click', () => {
        document.getElementById('modalDetalle').classList.remove('active');
    });

    // Modal actualizar estado
    document.getElementById('btnCerrarEstado').addEventListener('click', () => {
        document.getElementById('modalEstado').classList.remove('active');
    });
    document.getElementById('btnCancelarEstado').addEventListener('click', () => {
        document.getElementById('modalEstado').classList.remove('active');
    });
    document.getElementById('formEstado').addEventListener('submit', guardarActualizacion);

    // Filtros
    document.getElementById('btnFiltrar').addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);
    document.getElementById('filtroTexto').addEventListener('keypress', e => {
        if (e.key === 'Enter') aplicarFiltros();
    });
}

// ─────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────
function aplicarFiltros() {
    cargarPedidos({
        buscar: document.getElementById('filtroTexto').value.trim(),
        estado: document.getElementById('filtroEstado').value,
        fecha_inicio: document.getElementById('filtroDesde').value,
        fecha_fin: document.getElementById('filtroHasta').value
    });
}

function limpiarFiltros() {
    document.getElementById('filtroTexto').value = '';
    document.getElementById('filtroEstado').value = '';
    document.getElementById('filtroDesde').value = '';
    document.getElementById('filtroHasta').value = '';
    cargarPedidos();
}

// ─────────────────────────────────────────────
// MODAL NUEVO PEDIDO
// ─────────────────────────────────────────────
function abrirModalNuevo() {
    document.getElementById('modalPedidoTitulo').textContent = 'Nuevo Pedido';
    document.getElementById('pedidoId').value = '';
    document.getElementById('formPedido').reset();
    productosEnPedido = [];
    renderProductosEnPedido();
    actualizarResumen();

    // Prellenar asesor
    document.getElementById('nombreAsesor').value = usuarioActual.nombre || usuarioActual.usuario || '';
    document.getElementById('nombreCuenta').value = nombreCuentaGlobal;

    document.getElementById('errorPedido').style.display = 'none';
    document.getElementById('modalPedido').classList.add('active');
}

function cerrarModalPedido() {
    document.getElementById('modalPedido').classList.remove('active');
    productosEnPedido = [];
}

// ─────────────────────────────────────────────
// BÚSQUEDA DE PRODUCTOS EN DROPDOWN
// ─────────────────────────────────────────────
function buscarEnDropdown(e) {
    const termino = e.target.value.trim().toLowerCase();
    const dropdown = document.getElementById('productoDropdown');

    if (!termino) { dropdown.classList.remove('open'); return; }

    const filtrados = todosProductos.filter(p =>
        p.nombre.toLowerCase().includes(termino)
    ).slice(0, 8);

    if (!filtrados.length) {
        dropdown.innerHTML = '<div style="padding:12px;color:#888;font-size:0.82rem;">Sin resultados</div>';
    } else {
        dropdown.innerHTML = filtrados.map(p => {
            const img = p.ruta_foto
                ? `<img src="${p.ruta_foto}" alt="">`
                : `<div class="thumb-placeholder">👟</div>`;
            return `
                <div class="producto-option" onclick="agregarProductoDesdeDropdown(${p.id_producto})">
                    ${img}
                    <div class="info">
                        <strong>${p.nombre}</strong>
                        <span>${formatearMoneda(p.precio)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    dropdown.classList.add('open');
}

function agregarProductoDesdeDropdown(id_producto) {
    const producto = todosProductos.find(p => p.id_producto === id_producto);
    if (!producto) return;
    agregarProductoAlPedido(producto);
    document.getElementById('buscarProductoInput').value = '';
    document.getElementById('productoDropdown').classList.remove('open');
}

function agregarDesdeSelectorLista() {
    const id = parseInt(document.getElementById('selectorProducto').value);
    if (!id) return;
    const producto = todosProductos.find(p => p.id_producto === id);
    if (producto) agregarProductoAlPedido(producto);
    document.getElementById('selectorProducto').value = '';
}

async function agregarProductoAlPedido(producto) {
    // Si ya está, solo incrementar cantidad
    const existe = productosEnPedido.find(p => p.id_producto === producto.id_producto && !p.talla);
    if (existe) {
        existe.cantidad += 1;
        renderProductosEnPedido();
        return;
    }

    // Buscar proveedor con menor precio para este producto
    let id_proveedor = null;
    let precio_proveedor = parseFloat(producto.precio) || 0;
    try {
        const res = await apiGet(API_CONFIG.ENDPOINTS.PRODUCTOS_PROVEEDORES(producto.id_producto));
        if (res.ok && res.proveedores && res.proveedores.length > 0) {
            // Ya viene ordenado por precio ASC — tomar el primero activo
            const mejor = res.proveedores.find(p => p.activo);
            if (mejor) {
                id_proveedor = mejor.id_proveedor;
                precio_proveedor = parseFloat(mejor.precio_proveedor) || precio_proveedor;
            }
        }
    } catch (e) {
        console.warn('No se pudo obtener proveedor para el producto:', e);
    }

    productosEnPedido.push({
        id_producto: producto.id_producto,
        nombre: producto.nombre,
        ruta_foto: producto.ruta_foto || null,
        talla: '',
        cantidad: 1,
        precio_unitario: precio_proveedor,
        id_proveedor   // asignado automáticamente (proveedor con menor precio)
    });
    renderProductosEnPedido();
}

function renderProductosEnPedido() {
    const contenedor = document.getElementById('productosLista');
    const sinProductos = document.getElementById('sinProductos');

    if (!productosEnPedido.length) {
        contenedor.innerHTML = `<p class="text-secondary" id="sinProductos" style="font-size:0.82rem;text-align:center;padding:8px;">Aún no has agregado productos</p>`;
        actualizarResumen();
        return;
    }

    // Cargar proveedores para cada producto (para el select)
    contenedor.innerHTML = productosEnPedido.map((prod, idx) => {
        const img = prod.ruta_foto
            ? `<img src="${prod.ruta_foto}" alt="">`
            : `<div class="thumb-sm">👟</div>`;
        return `
            <div class="producto-item">
                ${img}
                <span class="nombre-prod">${prod.nombre}</span>
                <select onchange="cambiarTalla(${idx}, this.value)" title="Talla">
                    <option value="">Talla</option>
                    ${[35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45].map(t =>
            `<option value="${t}" ${prod.talla == t ? 'selected' : ''}>${t}</option>`
        ).join('')}
                </select>
                <input type="number" min="1" value="${prod.cantidad}"
                    onchange="cambiarCantidad(${idx}, this.value)"
                    placeholder="Cant." title="Cantidad">
                ${usuarioActual.rol === 'administrador'
                ? `<input type="number" min="0" step="1000" value="${prod.precio_unitario}"
                        onchange="cambiarPrecio(${idx}, this.value)" title="Precio unitario">`
                : `<span style="padding:5px 7px;font-size:0.82rem;font-weight:600;color:#1a6b3c;">${formatearMoneda(prod.precio_unitario)}</span>`
            }
                <button class="btn-quitar" onclick="quitarProducto(${idx})" title="Quitar">✕</button>
            </div>
        `;
    }).join('');

    actualizarResumen();
}

function cambiarTalla(idx, val) { productosEnPedido[idx].talla = val; }
function cambiarCantidad(idx, val) { productosEnPedido[idx].cantidad = parseInt(val) || 1; actualizarResumen(); }
function cambiarPrecio(idx, val) { productosEnPedido[idx].precio_unitario = parseFloat(val) || 0; actualizarResumen(); }
function quitarProducto(idx) { productosEnPedido.splice(idx, 1); renderProductosEnPedido(); }

function actualizarResumen() {
    const resumen = document.getElementById('resumenPedido');
    const costoEnvio = parseFloat(document.getElementById('costoEnvio').value) || 0;
    const publicidad = parseFloat(document.getElementById('valorPublicidad').value) || 0;

    const valorProductos = productosEnPedido.reduce((a, p) => a + p.cantidad * p.precio_unitario, 0);
    const valorRecaudar = valorProductos;
    const valorTotal = valorRecaudar + costoEnvio;
    const utilidad = valorRecaudar - publicidad - comisionBase;

    document.getElementById('r_productos').textContent = formatearMoneda(valorProductos);
    document.getElementById('r_envio').textContent = formatearMoneda(costoEnvio);
    document.getElementById('r_publicidad').textContent = formatearMoneda(publicidad);
    document.getElementById('r_comision').textContent = formatearMoneda(comisionBase);
    document.getElementById('r_recaudar').textContent = formatearMoneda(valorRecaudar);
    document.getElementById('r_total').textContent = formatearMoneda(valorTotal);

    resumen.classList.toggle('visible', productosEnPedido.length > 0);
}

// ─────────────────────────────────────────────
// GUARDAR PEDIDO
// ─────────────────────────────────────────────
async function guardarPedido(e) {
    e.preventDefault();
    const btn = document.getElementById('btnGuardarPedido');
    const err = document.getElementById('errorPedido');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    err.style.display = 'none';

    try {
        if (!productosEnPedido.length) throw new Error('Agrega al menos un producto');

        for (const p of productosEnPedido) {
            if (!p.talla) throw new Error(`Selecciona la talla del producto "${p.nombre}"`);
            if (!p.cantidad || p.cantidad < 1) throw new Error(`Cantidad inválida en "${p.nombre}"`);
            if (!p.precio_unitario || p.precio_unitario <= 0) throw new Error(`Precio inválido en "${p.nombre}"`);
        }

        const datos = {
            nombre_cliente: document.getElementById('nombreCliente').value.trim(),
            cedula_cliente: document.getElementById('cedulaCliente').value.trim() || null,
            celular_cliente: document.getElementById('celularCliente').value.trim(),
            ciudad_destino: document.getElementById('ciudadDestino').value.trim(),
            direccion_cliente: document.getElementById('direccionCliente').value.trim(),
            id_transportadora: parseInt(document.getElementById('transportadoraSelect').value),
            costo_envio: parseFloat(document.getElementById('costoEnvio').value) || 0,
            valor_publicidad: parseFloat(document.getElementById('valorPublicidad').value) || 0,
            observaciones: document.getElementById('observacionesPedido').value.trim() || null,
            productos: productosEnPedido.map(p => ({
                id_producto: p.id_producto,
                talla: parseInt(p.talla),
                cantidad: p.cantidad,
                precio_unitario: p.precio_unitario,
                id_proveedor: p.id_proveedor || null
            }))
        };

        const guia = document.getElementById('numeroGuia').value;
        if (guia) datos.numero_guia = parseInt(guia);

        const res = await apiPost(API_CONFIG.ENDPOINTS.PEDIDOS, datos);
        if (!res.ok) throw new Error(res.msg || 'Error al guardar');

        mostrarToast('Pedido creado exitosamente', 'success');

        if (res.apartados && res.apartados.length > 0) {
            mostrarToast(`Se crearon ${res.apartados.length} apartado(s) al proveedor`, 'info');
        }

        cerrarModalPedido();
        await cargarPedidos();

    } catch (error) {
        err.textContent = error.message;
        err.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Pedido';
    }
}

// ─────────────────────────────────────────────
// VER DETALLE
// ─────────────────────────────────────────────
async function verDetalle(id) {
    const modal = document.getElementById('modalDetalle');
    const contenido = document.getElementById('contenidoDetalle');
    document.getElementById('detalle_id').textContent = `#${id}`;
    contenido.innerHTML = '<p class="text-secondary">Cargando...</p>';
    modal.classList.add('active');

    try {
        const res = await apiGet(`${API_CONFIG.ENDPOINTS.PEDIDOS}/${id}`);
        if (!res.ok) throw new Error(res.msg);

        const p = res.pedido;
        const det = res.detalle || [];

        const enlaceSeguimiento = p.url_seguimiento && p.numero_guia
            ? `<a href="${p.url_seguimiento}${p.numero_guia}" target="_blank" style="color:#0a58ca;">🔗 Rastrear</a>`
            : '—';

        contenido.innerHTML = `
            <div class="seccion-form" style="margin-bottom:12px;">
                <h3>👤 Cliente</h3>
                <div class="detalle-grid">
                    <div class="detalle-fila"><span class="etiqueta">Nombre</span><span class="valor">${p.nombre_cliente}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Cédula</span><span class="valor">${p.cedula_cliente || '—'}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Celular</span><span class="valor">${p.celular_cliente}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Ciudad</span><span class="valor">${p.ciudad_destino}</span></div>
                    <div class="detalle-fila" style="grid-column:span 2;"><span class="etiqueta">Dirección</span><span class="valor">${p.direccion_cliente}</span></div>
                </div>
            </div>
            <div class="seccion-form" style="margin-bottom:12px;">
                <h3>🚚 Envío</h3>
                <div class="detalle-grid">
                    <div class="detalle-fila"><span class="etiqueta">Cuenta</span><span class="valor">${p.nombre_cuenta || '—'}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Asesor</span><span class="valor">${p.nombre_asesor || p.usuario_asesor}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Transportadora</span><span class="valor">${p.transportadora}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Guía</span><span class="valor">${p.numero_guia || '—'}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Fecha venta</span><span class="valor">${formatearFecha(p.fecha_venta)}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Estado</span><span class="valor"><span class="badge-estado ${claseEstado(p.estado_envio)}">${p.estado_envio}</span></span></div>
                    <div class="detalle-fila"><span class="etiqueta">Fecha estado</span><span class="valor">${p.fecha_estado ? formatearFecha(p.fecha_estado) : '—'}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Seguimiento</span><span class="valor">${enlaceSeguimiento}</span></div>
                    ${p.razon_cliente ? `
                    <div class="detalle-fila" style="grid-column:span 2;"><span class="etiqueta">Razón cliente</span><span class="valor">${p.razon_cliente}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Fecha razón</span><span class="valor">${p.fecha_razon ? formatearFecha(p.fecha_razon) : '—'}</span></div>
                    ` : ''}
                </div>
            </div>
            <div class="seccion-form" style="margin-bottom:12px;">
                <h3>💰 Valores</h3>
                <div class="detalle-grid">
                    <div class="detalle-fila"><span class="etiqueta">Valor productos</span><span class="valor valor-money">${formatearMoneda(p.valor_a_recaudar)}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Valor a recaudar</span><span class="valor valor-money">${formatearMoneda(p.valor_a_recaudar)}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Costo envío</span><span class="valor">${formatearMoneda(p.costo_envio)}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Valor total</span><span class="valor valor-money"><strong>${formatearMoneda(p.valor_total)}</strong></span></div>
                    <div class="detalle-fila"><span class="etiqueta">Publicidad</span><span class="valor">${formatearMoneda(p.valor_publicidad)}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Comisión</span><span class="valor">${formatearMoneda(p.comision)}</span></div>
                    <div class="detalle-fila"><span class="etiqueta">Utilidad</span><span class="valor ${p.utilidad >= 0 ? 'valor-money' : ''}" style="${p.utilidad < 0 ? 'color:#842029;' : ''}">${formatearMoneda(p.utilidad)}</span></div>
                </div>
            </div>
            <div class="seccion-form">
                <h3>👟 Productos (${det.length} ítem${det.length !== 1 ? 's' : ''})</h3>
                <table class="detalle-productos-table">
                    <thead><tr><th>Producto</th><th>Talla</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
                    <tbody>
                        ${det.map(d => `
                            <tr>
                                <td><strong>${d.nombre_producto}</strong></td>
                                <td>${d.talla || '—'}</td>
                                <td>${d.cantidad}</td>
                                <td>${formatearMoneda(d.precio_unitario)}</td>
                                <td class="valor-money">${formatearMoneda(d.subtotal)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${p.observaciones ? `<div class="seccion-form"><h3>📝 Observaciones</h3><p style="font-size:0.85rem;">${p.observaciones}</p></div>` : ''}
        `;
    } catch (e) {
        contenido.innerHTML = `<p class="text-secondary">Error al cargar: ${e.message}</p>`;
    }
}

// ─────────────────────────────────────────────
// ACTUALIZAR PEDIDO (estado, guía, razón)
// ─────────────────────────────────────────────
function abrirActualizar(id) {
    const pedido = todosPedidos.find(p => p.id_pedido === id);
    if (!pedido) return;

    const esAdmin = usuarioActual.rol === 'administrador';

    document.getElementById('estadoPedidoId').value = id;
    document.getElementById('nuevoEstado').value = pedido.estado_envio || '';
    document.getElementById('nuevaGuia').value = pedido.numero_guia || '';
    document.getElementById('razonCliente').value = pedido.razon_cliente || '';
    document.getElementById('fechaRazon').value = pedido.fecha_razon || '';
    document.getElementById('nuevoCostoEnvio').value = pedido.costo_envio || 0;
    document.getElementById('nuevasObservaciones').value = pedido.observaciones || '';

    // Campo comisión solo para admin
    const campoComision = document.getElementById('campoComisionAdmin');
    campoComision.style.display = esAdmin ? 'block' : 'none';
    if (esAdmin) document.getElementById('nuevaComision').value = pedido.comision || 0;

    document.getElementById('errorEstado').style.display = 'none';
    document.getElementById('modalEstado').classList.add('active');
}

async function guardarActualizacion(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const err = document.getElementById('errorEstado');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    err.style.display = 'none';

    try {
        const id = document.getElementById('estadoPedidoId').value;
        const esAdmin = usuarioActual.rol === 'administrador';

        const datos = {};
        const estado = document.getElementById('nuevoEstado').value;
        const guia = document.getElementById('nuevaGuia').value;
        const razon = document.getElementById('razonCliente').value.trim();
        const fechaRazon = document.getElementById('fechaRazon').value;
        const costoEnvio = document.getElementById('nuevoCostoEnvio').value;
        const obs = document.getElementById('nuevasObservaciones').value.trim();

        if (estado) datos.estado_envio = estado;
        if (guia) datos.numero_guia = parseInt(guia);
        if (razon) datos.razon_cliente = razon;
        if (fechaRazon) datos.fecha_razon = fechaRazon;
        if (costoEnvio !== '') datos.costo_envio = parseFloat(costoEnvio);
        if (obs) datos.observaciones = obs;
        if (esAdmin) {
            const com = document.getElementById('nuevaComision').value;
            if (com !== '') datos.comision = parseFloat(com);
        }

        if (!Object.keys(datos).length) {
            throw new Error('No hay cambios para guardar');
        }

        const res = await apiPut(`${API_CONFIG.ENDPOINTS.PEDIDOS}/${id}`, datos);
        if (!res.ok) throw new Error(res.msg || 'Error al actualizar');

        mostrarToast('Pedido actualizado', 'success');
        document.getElementById('modalEstado').classList.remove('active');
        await cargarPedidos();

    } catch (error) {
        err.textContent = error.message;
        err.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Actualizar';
    }
}

// ─────────────────────────────────────────────
// ELIMINAR PEDIDO
// ─────────────────────────────────────────────
async function eliminarPedido(id) {
    if (!confirm(`¿Eliminar el pedido #${id}? Esta acción no se puede deshacer.`)) return;

    try {
        const res = await apiDelete(`${API_CONFIG.ENDPOINTS.PEDIDOS}/${id}`);
        if (!res.ok) throw new Error(res.msg);
        mostrarToast('Pedido eliminado', 'success');
        await cargarPedidos();
    } catch (e) {
        mostrarToast(e.message || 'Error al eliminar', 'error');
    }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatearFecha(fecha) {
    if (!fecha) return '—';
    // Tomar solo la parte de fecha (YYYY-MM-DD) para evitar problemas de timezone
    const parte = typeof fecha === 'string' ? fecha.substring(0, 10) : fecha;
    const [anio, mes, dia] = parte.split('-');
    if (!anio || !mes || !dia) return '—';
    return `${dia}/${mes}/${anio}`;
}

function formatearNumero(n) {
    return Number(n).toLocaleString('es-CO');
}

function debounce(fn, delay) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}