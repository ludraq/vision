/**
 * MÓDULO DE APARTADOS — Vision (Empacador / Admin / Bodeguero)
 */

let todosApartados = [];
let filtroActual = '';

document.addEventListener('DOMContentLoaded', () => { renderSidebar(); });

document.addEventListener('DOMContentLoaded', async function () {
    if (!requireAuth() || !requireRole(['administrador', 'bodeguero', 'empacador'])) return;
    mostrarInfoUsuarioSidebar();
    configurarMenuMovil();
    configurarLogout();
    await cargarApartados();
    configurarEventos();
});

// ─────────────────────────────────────────────
// CARGAR Y RENDERIZAR APARTADOS
// ─────────────────────────────────────────────
async function cargarApartados(estado = '') {
    const grid = document.getElementById('apartadosGrid');
    grid.innerHTML = '<p class="text-secondary">Cargando...</p>';

    try {
        let url = '/api/apartados';
        if (estado) url += `?estado=${estado}`;

        const res = await apiGet(url);
        if (!res.ok) throw new Error(res.msg);

        todosApartados = res.apartados || [];
        renderApartados(todosApartados);
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<p class="text-secondary">Error al cargar apartados</p>';
    }
}

function renderApartados(lista) {
    const grid = document.getElementById('apartadosGrid');

    if (!lista.length) {
        grid.innerHTML = '<p class="text-secondary" style="padding:24px;">No hay apartados en este estado</p>';
        return;
    }

    grid.innerHTML = lista.map(a => {
        const estadoLabel = {
            pendiente: '⏳ Pendiente respuesta',
            respondido: '✅ Respondido',
            parcial: '🔄 Recogida parcial',
            completado: '🏁 Completado'
        }[a.estado] || a.estado;

        const puedeEnviarWsp = ['pendiente'].includes(a.estado);
        const puedeRecoger = ['respondido', 'parcial'].includes(a.estado);

        return `
            <div class="apartado-card ${a.estado}">
                <div class="apt-header">
                    <div>
                        <div class="apt-proveedor">🏢 ${a.proveedor}</div>
                        <div class="apt-fecha">${formatearFecha(a.fecha_creacion)}
                            ${a.fecha_respuesta ? `· Respondido: ${formatearFecha(a.fecha_respuesta)}` : ''}
                        </div>
                    </div>
                    <span class="badge-apt badge-${a.estado}">${estadoLabel}</span>
                </div>

                <div class="apt-stats">
                    <span>📦 <strong>${a.total_items}</strong> refs</span>
                    <span>👟 <strong>${a.total_pares_solicitados}</strong> pares</span>
                    ${a.estado !== 'pendiente' ? `<span>✅ <strong>${a.total_confirmados || 0}</strong> confirm.</span>` : ''}
                    ${a.total_recogidos > 0 ? `<span>🏃 <strong>${a.total_recogidos}</strong> recogidos</span>` : ''}
                </div>

                <div class="apt-acciones">
                    <button class="btn-apt ver" onclick="verApartado(${a.id_apartado})">
                        👁 Ver detalle
                    </button>
                    ${puedeEnviarWsp ? `
                        <button class="btn-apt whatsapp" onclick="enviarWhatsapp(${a.id_apartado})">
                            📱 WhatsApp
                        </button>
                    ` : ''}
                    ${puedeRecoger ? `
                        <button class="btn-apt recoger" onclick="verApartado(${a.id_apartado}, true)">
                            🏃 Registrar recogida
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function filtrarPor(estado, btn) {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroActual = estado;
    cargarApartados(estado);
}

// ─────────────────────────────────────────────
// VER DETALLE DE APARTADO
// ─────────────────────────────────────────────
async function verApartado(id, modoRecoger = false) {
    const modal = document.getElementById('modalApartado');
    const contenido = document.getElementById('contenidoApt');
    document.getElementById('modalAptTitulo').textContent = `Apartado #${id}`;
    contenido.innerHTML = '<p class="text-secondary">Cargando...</p>';
    modal.classList.add('active');

    try {
        const res = await apiGet(`/api/apartados/${id}`);
        if (!res.ok) throw new Error(res.msg);

        const { apartado, detalles } = res;
        const puedeRecoger = ['respondido', 'parcial'].includes(apartado.estado);
        const yaCompleto = apartado.estado === 'completado';

        // Agrupar detalles por producto para mejor visualización
        const productosAgrupados = {};
        detalles.forEach(d => {
            if (!productosAgrupados[d.id_producto]) {
                productosAgrupados[d.id_producto] = {
                    nombre: d.nombre_producto,
                    ruta_foto: d.ruta_foto,
                    tallas: []
                };
            }
            productosAgrupados[d.id_producto].tallas.push(d);
        });

        let tablaHtml = `
            <table class="detalle-apt-tabla">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Talla</th>
                        <th>Solicitado</th>
                        <th>Disponible</th>
                        <th>Confirmado</th>
                        <th>Estado</th>
                        <th>Evidencia</th>
                        ${puedeRecoger && !yaCompleto ? '<th>A recoger</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;

        detalles.forEach(d => {
            const disponibleTexto = d.estado === 'pendiente'
                ? '<span style="color:#888;">—</span>'
                : d.disponible
                    ? `<span class="disponible-si">✓ Sí</span>`
                    : `<span class="disponible-no">✗ No</span>`;

            const confirmadoTexto = d.estado === 'pendiente'
                ? '—'
                : d.disponible ? d.cantidad_disponible : '0';

            const estadoTexto = {
                pendiente: '<span style="color:#888;font-size:0.75rem;">Esperando</span>',
                respondido: '<span style="color:#1e40af;font-size:0.75rem;">Confirmado</span>',
                recogido: '<span class="estado-recogido">✓ Recogido</span>'
            }[d.estado] || d.estado;

            const fotoHtml = d.foto_evidencia
                ? `<img src="${d.foto_evidencia}" class="foto-evidencia-thumb" onclick="window.open('${d.foto_evidencia}','_blank')" title="Ver foto">`
                : (d.estado === 'recogido'
                    ? `<label class="btn-foto">
                        📷 Foto
                        <input type="file" accept="image/*" style="display:none"
                            onchange="subirFoto(${id}, ${d.id_detalle}, this)">
                       </label>`
                    : '—');

            const inputRecoger = (puedeRecoger && d.disponible && d.estado !== 'recogido')
                ? `<input type="number" class="input-recogida" min="0"
                    max="${d.cantidad_disponible}" value="${d.cantidad_disponible}"
                    data-detalle="${d.id_detalle}" data-max="${d.cantidad_disponible}">`
                : (d.estado === 'recogido' ? `<span class="estado-recogido">✓</span>` : '—');

            tablaHtml += `
                <tr>
                    <td><strong>${d.nombre_producto}</strong></td>
                    <td style="text-align:center;">${d.talla}</td>
                    <td style="text-align:center;">${d.cantidad_solicitada}</td>
                    <td style="text-align:center;">${disponibleTexto}</td>
                    <td style="text-align:center;">${confirmadoTexto}</td>
                    <td>${estadoTexto}</td>
                    <td>${fotoHtml}</td>
                    ${puedeRecoger && !yaCompleto ? `<td style="text-align:center;">${inputRecoger}</td>` : ''}
                </tr>
            `;
        });

        tablaHtml += '</tbody></table>';

        const infoProveedor = `
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
                <div>
                    <span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em;color:#888;font-weight:700;">Proveedor</span>
                    <div style="font-weight:800;font-size:1rem;">${apartado.proveedor}</div>
                </div>
                <div>
                    <span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em;color:#888;font-weight:700;">Estado</span>
                    <div><span class="badge-apt badge-${apartado.estado}">${apartado.estado}</span></div>
                </div>
                <div>
                    <span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em;color:#888;font-weight:700;">Creado</span>
                    <div style="font-size:0.85rem;">${formatearFecha(apartado.fecha_creacion)}</div>
                </div>
                ${apartado.fecha_respuesta ? `
                <div>
                    <span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em;color:#888;font-weight:700;">Respondido</span>
                    <div style="font-size:0.85rem;">${formatearFecha(apartado.fecha_respuesta)}</div>
                </div>` : ''}
                ${apartado.estado === 'pendiente' ? `
                <button class="btn-apt whatsapp" onclick="enviarWhatsapp(${id})" style="margin-left:auto;">
                    📱 Enviar WhatsApp al proveedor
                </button>` : ''}
            </div>
        `;

        const seccionRecoger = (puedeRecoger && !yaCompleto && modoRecoger) ? `
            <div class="seccion-recoger" id="seccionRecoger">
                <h4>🏃 Registrar recogida</h4>
                <p style="font-size:0.82rem;color:#555;margin-bottom:12px;">
                    Ajusta las cantidades que efectivamente recogiste (puede ser menor a lo confirmado).
                </p>
                <div class="form-group">
                    <label style="font-size:0.78rem;font-weight:600;">Foto de evidencia general (opcional)</label>
                    <input type="file" id="fotoEvidenciaGeneral" accept="image/*">
                </div>
                <button class="btn-primary" onclick="confirmarRecogida(${id})" style="margin-top:8px;">
                    ✅ Confirmar recogida
                </button>
                <div id="msgRecogida" style="font-size:0.8rem;margin-top:8px;display:none;"></div>
            </div>
        ` : (puedeRecoger && !yaCompleto ? `
            <div style="text-align:center;margin-top:12px;">
                <button class="btn-primary" onclick="verApartado(${id}, true)">
                    🏃 Registrar recogida
                </button>
            </div>
        ` : '');

        contenido.innerHTML = infoProveedor + tablaHtml + seccionRecoger;

    } catch (e) {
        contenido.innerHTML = `<p class="text-secondary">Error: ${e.message}</p>`;
    }
}

// ─────────────────────────────────────────────
// CONFIRMAR RECOGIDA
// ─────────────────────────────────────────────
async function confirmarRecogida(id) {
    const btn = document.querySelector('#seccionRecoger .btn-primary');
    const msg = document.getElementById('msgRecogida');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        // Recoger cantidades de los inputs
        const inputs = document.querySelectorAll('.input-recogida');
        const items = [];

        inputs.forEach(input => {
            const cantidad = parseInt(input.value) || 0;
            if (cantidad > 0) {
                items.push({
                    id_detalle: parseInt(input.dataset.detalle),
                    cantidad_recogida: cantidad
                });
            }
        });

        if (!items.length) throw new Error('No hay cantidades para registrar');

        // Manejar foto de evidencia si la subieron
        let foto_evidencia = null;
        const fotoInput = document.getElementById('fotoEvidenciaGeneral');
        if (fotoInput && fotoInput.files[0]) {
            foto_evidencia = await subirFotoAlServidor(id, fotoInput.files[0]);
        }

        const res = await apiPost(`/api/apartados/${id}/recoger`, {
            items,
            foto_evidencia
        });

        if (!res.ok) throw new Error(res.msg);

        mostrarToast(res.msg, 'success');
        document.getElementById('modalApartado').classList.remove('active');
        await cargarApartados(filtroActual);

    } catch (e) {
        msg.textContent = e.message;
        msg.style.display = 'block';
        msg.style.color = '#842029';
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Confirmar recogida';
    }
}

// ─────────────────────────────────────────────
// SUBIR FOTO DE EVIDENCIA
// ─────────────────────────────────────────────
async function subirFoto(id_apartado, id_detalle, input) {
    const file = input.files[0];
    if (!file) return;

    try {
        const formData = new FormData();
        formData.append('foto', file);
        const token = localStorage.getItem('token');

        const res = await fetch(
            `${API_CONFIG.BASE_URL}/api/apartados/${id_apartado}/detalle/${id_detalle}/foto`,
            {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            }
        );

        const data = await res.json();
        if (!data.ok) throw new Error(data.msg);

        mostrarToast('Foto guardada', 'success');
        verApartado(id_apartado);
    } catch (e) {
        mostrarToast(e.message, 'error');
    }
}

async function subirFotoAlServidor(id_apartado, file) {
    // Sube foto y devuelve la ruta
    const formData = new FormData();
    formData.append('foto', file);
    const token = localStorage.getItem('token');

    // Subir al primer ítem del apartado como evidencia general
    const detalleInput = document.querySelector('.input-recogida');
    if (!detalleInput) return null;

    const res = await fetch(
        `${API_CONFIG.BASE_URL}/api/apartados/${id_apartado}/detalle/${detalleInput.dataset.detalle}/foto`,
        {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        }
    );
    const data = await res.json();
    return data.ok ? data.foto_evidencia : null;
}

// ─────────────────────────────────────────────
// ENVIAR WHATSAPP
// ─────────────────────────────────────────────
async function enviarWhatsapp(id) {
    try {
        const res = await apiPost(`/api/apartados/${id}/whatsapp`, {});
        if (!res.ok) throw new Error(res.msg);

        // Abrir WhatsApp en nueva pestaña
        window.open(res.link_whatsapp, '_blank');
        mostrarToast('Link de WhatsApp generado', 'success');
    } catch (e) {
        mostrarToast(e.message || 'Error al generar WhatsApp', 'error');
    }
}

// ─────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────
function configurarEventos() {
    document.getElementById('btnCerrarApt').addEventListener('click', () => {
        document.getElementById('modalApartado').classList.remove('active');
    });
    document.getElementById('modalApartado').addEventListener('click', e => {
        if (e.target.id === 'modalApartado') {
            document.getElementById('modalApartado').classList.remove('active');
        }
    });
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatearFecha(fecha) {
    if (!fecha) return '—';
    const parte = typeof fecha === 'string' ? fecha.substring(0, 10) : fecha;
    const [anio, mes, dia] = parte.split('-');
    if (!anio || !mes || !dia) return '—';
    return `${dia}/${mes}/${anio}`;
}