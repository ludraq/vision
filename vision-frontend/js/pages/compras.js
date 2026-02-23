/**
 * MÓDULO DE COMPRAS — Vision
 */

let todasCompras = [];
let todosProveedores = [];
let todosProductos = [];
let productosEnCompra = []; // [{ id_producto, nombre, cantidad, precio_unitario }]

document.addEventListener('DOMContentLoaded', () => { renderSidebar(); });

document.addEventListener('DOMContentLoaded', async function () {
    if (!requireAuth() || !requireRole(['administrador', 'bodeguero', 'empacador'])) return;
    mostrarInfoUsuarioSidebar();
    configurarMenuMovil();
    configurarLogout();

    await Promise.all([cargarProveedores(), cargarProductos()]);
    await cargarCompras();
    configurarEventos();
});

// ─────────────────────────────────────────────
// CARGA DE DATOS
// ─────────────────────────────────────────────
async function cargarProveedores() {
    try {
        const res = await apiGet(API_CONFIG.ENDPOINTS.PROVEEDORES);
        if (res.ok) {
            todosProveedores = res.proveedores || [];

            // Llenar filtro
            const filtro = document.getElementById('filtroProveedor');
            todosProveedores.forEach(p => {
                filtro.innerHTML += `<option value="${p.id_proveedor}">${p.nombre}</option>`;
            });

            // Llenar selector en modal nueva compra
            const sel = document.getElementById('proveedorNueva');
            todosProveedores.forEach(p => {
                sel.innerHTML += `<option value="${p.id_proveedor}">${p.nombre}</option>`;
            });
        }
    } catch (e) { console.error('Error proveedores:', e); }
}

async function cargarProductos() {
    try {
        const res = await apiGet(API_CONFIG.ENDPOINTS.PRODUCTOS);
        if (res.ok) {
            todosProductos = res.productos || [];
            const sel = document.getElementById('selectorProductoNueva');
            todosProductos.forEach(p => {
                sel.innerHTML += `<option value="${p.id_producto}" data-precio="${p.precio}">${p.nombre}</option>`;
            });
        }
    } catch (e) { console.error('Error productos:', e); }
}

async function cargarCompras(filtros = {}) {
    const tbody = document.getElementById('cuerpoTabla');
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-secondary" style="padding:24px;">Cargando...</td></tr>';

    try {
        let url = API_CONFIG.ENDPOINTS.COMPRAS;
        const params = new URLSearchParams();
        if (filtros.id_proveedor) params.append('id_proveedor', filtros.id_proveedor);
        if (filtros.estado) params.append('estado', filtros.estado);
        if (params.toString()) url += '?' + params.toString();

        const res = await apiGet(url);
        if (!res.ok) throw new Error(res.msg);

        todasCompras = res.compras || [];

        // Filtros de fecha (en frontend, ya que el backend no los soporta)
        let lista = todasCompras;
        if (filtros.desde) lista = lista.filter(c => c.fecha_compra >= filtros.desde);
        if (filtros.hasta) lista = lista.filter(c => c.fecha_compra <= filtros.hasta);

        renderTabla(lista);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-secondary" style="padding:24px;">Error al cargar compras</td></tr>';
    }
}

// ─────────────────────────────────────────────
// RENDER TABLA
// ─────────────────────────────────────────────
function renderTabla(lista) {
    const tbody = document.getElementById('cuerpoTabla');

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-secondary" style="padding:32px;">No hay compras registradas</td></tr>';
        return;
    }

    const esAdmin = JSON.parse(localStorage.getItem('usuario') || '{}').rol === 'administrador';

    tbody.innerHTML = lista.map(c => {
        // Si tiene apartado asociado, marcarlo
        const origenBadge = c.observaciones && c.observaciones.includes('Apartado')
            ? '<span class="badge-compra badge-apartado">Apartado</span>'
            : '<span style="font-size:0.75rem;color:#888;">Manual</span>';

        const estadoBadge = {
            pendiente: '<span class="badge-compra badge-pendiente">Pendiente</span>',
            parcial: '<span class="badge-compra badge-parcial">Parcial</span>',
            recibido: '<span class="badge-compra badge-recibido">Recibido</span>'
        }[c.estado_general] || `<span class="badge-compra badge-pendiente">${c.estado_general}</span>`;

        return `
            <tr>
                <td><strong>#${c.id_compra}</strong></td>
                <td>${formatearFecha(c.fecha_compra)}</td>
                <td><strong>${c.proveedor}</strong></td>
                <td style="text-align:center;">${c.total_items || 0}</td>
                <td style="text-align:center;">${c.total_pares || 0}</td>
                <td class="valor-money"><strong>${formatearMoneda(c.total_compra)}</strong></td>
                <td>${origenBadge}</td>
                <td>${estadoBadge}</td>
                <td>
                    <div class="acciones-td">
                        <button class="btn-tbl ver" onclick="verDetalle(${c.id_compra})">👁 Ver</button>
                        ${esAdmin && c.estado_general === 'pendiente'
                ? `<button class="btn-tbl del" onclick="eliminarCompra(${c.id_compra})">🗑️</button>`
                : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ─────────────────────────────────────────────
// VER DETALLE
// ─────────────────────────────────────────────
async function verDetalle(id) {
    const modal = document.getElementById('modalDetalle');
    const contenido = document.getElementById('contenidoDetalle');
    document.getElementById('detalleId').textContent = `#${id}`;
    contenido.innerHTML = '<p class="text-secondary">Cargando...</p>';
    modal.classList.add('active');

    try {
        const res = await apiGet(`${API_CONFIG.ENDPOINTS.COMPRAS}/${id}`);
        if (!res.ok) throw new Error(res.msg);

        const { compra, detalles } = res;

        contenido.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-bottom:16px;font-size:0.85rem;">
                <div><span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em;color:#888;font-weight:700;display:block;">Proveedor</span><strong>${compra.proveedor}</strong></div>
                <div><span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em;color:#888;font-weight:700;display:block;">Fecha</span>${formatearFecha(compra.fecha_compra)}</div>
                <div><span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em;color:#888;font-weight:700;display:block;">Total</span><span class="valor-money"><strong>${formatearMoneda(compra.total_compra)}</strong></span></div>
                ${compra.observaciones ? `<div style="grid-column:span 2;"><span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em;color:#888;font-weight:700;display:block;">Observaciones</span>${compra.observaciones}</div>` : ''}
            </div>

            <table class="detalle-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>P. Unitario</th>
                        <th>Subtotal</th>
                        <th>Recibido</th>
                        <th>Pendiente</th>
                        <th>Estado</th>
                        <th>Evidencia</th>
                    </tr>
                </thead>
                <tbody>
                    ${detalles.map(d => `
                        <tr>
                            <td><strong>${d.producto}</strong></td>
                            <td style="text-align:center;">${d.cantidad}</td>
                            <td>${formatearMoneda(d.precio_unitario)}</td>
                            <td class="valor-money">${formatearMoneda(d.subtotal)}</td>
                            <td style="text-align:center;color:#1a6b3c;font-weight:700;">${d.cantidad_recibida || 0}</td>
                            <td style="text-align:center;color:${d.pendiente_recibir > 0 ? '#854d0e' : '#1a6b3c'};font-weight:700;">${d.pendiente_recibir || 0}</td>
                            <td><span class="badge-compra badge-${d.estado}">${d.estado}</span></td>
                            <td>
                                ${d.foto_evidencia
                ? `<img src="${d.foto_evidencia}"
                                        style="width:44px;height:44px;object-fit:cover;border-radius:6px;cursor:pointer;"
                                        onclick="window.open('${d.foto_evidencia}','_blank')"
                                        title="Ver foto completa">`
                : `<label style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:#f0f0f8;border:1px solid #ddd;border-radius:6px;font-size:0.74rem;cursor:pointer;color:#3730a3;font-weight:600;">
                                        📷 Foto
                                        <input type="file" accept="image/*" capture="environment" style="display:none"
                                            onchange="subirFotoCompra(${id}, ${d.id_detalle}, this)">
                                       </label>`
            }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        contenido.innerHTML = `<p class="text-secondary">Error: ${e.message}</p>`;
    }
}

// ─────────────────────────────────────────────
// NUEVA COMPRA MANUAL
// ─────────────────────────────────────────────
function abrirModalNueva() {
    productosEnCompra = [];
    document.getElementById('formNueva').reset();
    document.getElementById('productosCompraLista').innerHTML = '';
    document.getElementById('errorNueva').style.display = 'none';
    document.getElementById('modalNueva').classList.add('active');
}

function agregarProductoCompra() {
    const sel = document.getElementById('selectorProductoNueva');
    const id = parseInt(sel.value);
    if (!id) return;

    const opt = sel.options[sel.selectedIndex];
    const precio = parseFloat(opt.dataset.precio) || 0;
    const nombre = opt.text;

    if (productosEnCompra.find(p => p.id_producto === id)) {
        mostrarToast('Ese producto ya está en la lista', 'error');
        return;
    }

    productosEnCompra.push({ id_producto: id, nombre, cantidad: 1, precio_unitario: precio });
    sel.value = '';
    renderProductosCompra();
}

function renderProductosCompra() {
    const contenedor = document.getElementById('productosCompraLista');

    if (!productosEnCompra.length) {
        contenedor.innerHTML = '<p class="text-secondary" style="font-size:0.82rem;padding:8px;">Sin productos</p>';
        return;
    }

    contenedor.innerHTML = productosEnCompra.map((p, idx) => `
        <div class="producto-compra-item">
            <span style="font-weight:600;font-size:0.82rem;">${p.nombre}</span>
            <input type="number" min="1" value="${p.cantidad}"
                onchange="cambiarCantidadCompra(${idx}, this.value)"
                placeholder="Cant." style="padding:5px 7px;border:1px solid #ddd;border-radius:6px;font-size:0.81rem;">
            <input type="number" min="0" step="1000" value="${p.precio_unitario}"
                onchange="cambiarPrecioCompra(${idx}, this.value)"
                placeholder="Precio" style="padding:5px 7px;border:1px solid #ddd;border-radius:6px;font-size:0.81rem;">
            <button class="btn-quitar" onclick="quitarProductoCompra(${idx})" type="button">✕</button>
        </div>
    `).join('');
}

function cambiarCantidadCompra(idx, val) { productosEnCompra[idx].cantidad = parseInt(val) || 1; }
function cambiarPrecioCompra(idx, val) { productosEnCompra[idx].precio_unitario = parseFloat(val) || 0; }
function quitarProductoCompra(idx) { productosEnCompra.splice(idx, 1); renderProductosCompra(); }

async function guardarNuevaCompra(e) {
    e.preventDefault();
    const btn = document.getElementById('btnGuardarNueva');
    const err = document.getElementById('errorNueva');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    err.style.display = 'none';

    try {
        const id_proveedor = parseInt(document.getElementById('proveedorNueva').value);
        const observaciones = document.getElementById('obsNueva').value.trim();

        if (!id_proveedor) throw new Error('Selecciona un proveedor');
        if (!productosEnCompra.length) throw new Error('Agrega al menos un producto');

        for (const p of productosEnCompra) {
            if (!p.cantidad || p.cantidad < 1) throw new Error(`Cantidad inválida en "${p.nombre}"`);
            if (!p.precio_unitario || p.precio_unitario <= 0) throw new Error(`Precio inválido en "${p.nombre}"`);
        }

        const datos = {
            id_proveedor,
            observaciones: observaciones || null,
            productos: productosEnCompra.map(p => ({
                id_producto: p.id_producto,
                cantidad: p.cantidad,
                precio_unitario: p.precio_unitario
            }))
        };

        const res = await apiPost(API_CONFIG.ENDPOINTS.COMPRAS, datos);
        if (!res.ok) throw new Error(res.msg);

        document.getElementById('modalNueva').classList.remove('active');
        await cargarCompras();

        // Si el backend generó un apartado + link de WhatsApp, abrir WhatsApp automáticamente
        if (res.link_whatsapp) {
            mostrarToast('✅ Compra guardada. Abriendo WhatsApp para notificar al proveedor...', 'success');
            setTimeout(() => window.open(res.link_whatsapp, '_blank'), 800);
        } else {
            mostrarToast('Compra registrada exitosamente', 'success');
        }
    } catch (error) {
        err.textContent = error.message;
        err.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Compra';
    }
}

async function eliminarCompra(id) {
    if (!confirm(`¿Eliminar la compra #${id}? Solo se puede eliminar si no tiene productos recibidos.`)) return;
    try {
        const res = await apiDelete(`${API_CONFIG.ENDPOINTS.COMPRAS}/${id}`);
        if (!res.ok) throw new Error(res.msg);
        mostrarToast('Compra eliminada', 'success');
        await cargarCompras();
    } catch (e) {
        mostrarToast(e.message, 'error');
    }
}

// ─────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────
function aplicarFiltros() {
    cargarCompras({
        id_proveedor: document.getElementById('filtroProveedor').value,
        estado: document.getElementById('filtroEstado').value,
        desde: document.getElementById('filtroDesde').value,
        hasta: document.getElementById('filtroHasta').value
    });
}

function limpiarFiltros() {
    document.getElementById('filtroProveedor').value = '';
    document.getElementById('filtroEstado').value = '';
    document.getElementById('filtroDesde').value = '';
    document.getElementById('filtroHasta').value = '';
    cargarCompras();
}

// ─────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────
function configurarEventos() {
    document.getElementById('btnNuevaCompra').addEventListener('click', abrirModalNueva);

    document.getElementById('btnCerrarNueva').addEventListener('click', () => {
        document.getElementById('modalNueva').classList.remove('active');
    });
    document.getElementById('btnCancelarNueva').addEventListener('click', () => {
        document.getElementById('modalNueva').classList.remove('active');
    });
    document.getElementById('modalNueva').addEventListener('click', e => {
        if (e.target.id === 'modalNueva') document.getElementById('modalNueva').classList.remove('active');
    });
    document.getElementById('formNueva').addEventListener('submit', guardarNuevaCompra);

    document.getElementById('btnCerrarDetalle').addEventListener('click', () => {
        document.getElementById('modalDetalle').classList.remove('active');
    });
    document.getElementById('modalDetalle').addEventListener('click', e => {
        if (e.target.id === 'modalDetalle') document.getElementById('modalDetalle').classList.remove('active');
    });

    document.getElementById('btnFiltrar').addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatearFecha(fecha) {
    if (!fecha) return '—';
    const parte = typeof fecha === 'string' ? fecha.substring(0, 10) : fecha;
    const [a, m, d] = parte.split('-');
    if (!a || !m || !d) return '—';
    return `${d}/${m}/${a}`;
}

// ─────────────────────────────────────────────
// SUBIR FOTO DE EVIDENCIA
// En móvil abre la cámara trasera, en PC el explorador
// ─────────────────────────────────────────────
async function subirFotoCompra(id_compra, id_detalle, input) {
    const file = input.files[0];
    if (!file) return;

    const label = input.closest('label');
    if (label) { label.textContent = '⏳ Subiendo...'; }

    try {
        const formData = new FormData();
        formData.append('foto', file);
        const token = localStorage.getItem('token');

        const res = await fetch(
            `${API_CONFIG.BASE_URL}/compras/${id_compra}/detalle/${id_detalle}/foto`,
            {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            }
        );

        const data = await res.json();
        if (!data.ok) throw new Error(data.msg);

        mostrarToast('Foto guardada exitosamente', 'success');
        // Recargar el detalle para mostrar la foto
        verDetalle(id_compra);
    } catch (e) {
        mostrarToast(e.message || 'Error al subir foto', 'error');
        if (label) { label.innerHTML = '📷 Foto <input type="file" accept="image/*" capture="environment" style="display:none" onchange="subirFotoCompra(' + id_compra + ',' + id_detalle + ', this)">'; }
    }
}