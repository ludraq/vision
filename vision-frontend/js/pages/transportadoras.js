/**
 * MÓDULO DE TRANSPORTADORAS — Vision
 */

let transportadoras = [];
let transActual = null;

document.addEventListener('DOMContentLoaded', () => { renderSidebar(); });

document.addEventListener('DOMContentLoaded', async function () {
    if (!requireAuth() || !requireRole(['administrador'])) return;
    mostrarInfoUsuarioSidebar();
    configurarMenuMovil();
    configurarLogout();
    await cargarTransportadoras();
    configurarEventos();
});

// ─────────────────────────────────────────────
// CARGAR Y RENDERIZAR TARJETAS
// ─────────────────────────────────────────────
async function cargarTransportadoras() {
    const grid = document.getElementById('transGrid');
    grid.innerHTML = '<p class="text-secondary">Cargando...</p>';

    try {
        const res = await apiGet(API_CONFIG.ENDPOINTS.TRANSPORTADORAS);
        if (!res.ok) throw new Error(res.msg);
        transportadoras = res.transportadoras;

        if (!transportadoras.length) {
            grid.innerHTML = '<p class="text-secondary">No hay transportadoras registradas. Agrega una con el botón de arriba.</p>';
            return;
        }

        // Cargar saldos de cada transportadora en paralelo
        const saldos = await Promise.all(
            transportadoras.map(t =>
                apiGet(`${API_CONFIG.ENDPOINTS.TRANSPORTADORAS}/${t.id_transportadora}/estado-cuenta`)
                    .then(r => r.ok ? r.resumen : null)
                    .catch(() => null)
            )
        );

        grid.innerHTML = transportadoras.map((t, idx) => {
            const s = saldos[idx];
            const cicloLabel = t.ciclo_dias === 1 ? 'Diario' :
                t.ciclo_dias === 7 ? 'Semanal' :
                    t.ciclo_dias === 15 ? 'Quincenal' :
                        t.ciclo_dias === 30 ? 'Mensual' : `${t.ciclo_dias} días`;

            return `
                <div class="trans-card">
                    <div class="trans-card-header">
                        <div>
                            <div class="trans-nombre">🚚 ${t.nombre}</div>
                            <div class="trans-cuenta">Cuenta: <strong>${t.usuario || '—'}</strong></div>
                        </div>
                        <span class="trans-ciclo">${cicloLabel}</span>
                    </div>

                    ${s ? `
                    <div class="trans-saldos">
                        <div class="saldo-chip">
                            <div class="s-label">Me deben</div>
                            <div class="s-valor ${s.saldo_pendiente_entregados >= 0 ? 's-verde' : 's-rojo'}">
                                ${formatearMoneda(s.saldo_pendiente_entregados)}
                            </div>
                        </div>
                        <div class="saldo-chip">
                            <div class="s-label">Debo (devol.)</div>
                            <div class="s-valor ${s.saldo_pendiente_devoluciones > 0 ? 's-rojo' : 's-verde'}">
                                ${formatearMoneda(s.saldo_pendiente_devoluciones)}
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <div class="trans-acciones">
                        <button class="btn-trans ver" onclick="abrirEstadoCuenta(${t.id_transportadora})">
                            📊 Estado de cuenta
                        </button>
                        <button class="btn-trans edit" onclick="editarTrans(${t.id_transportadora})">✏️</button>
                        <button class="btn-trans del" onclick="eliminarTrans(${t.id_transportadora}, '${t.nombre}')">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
        grid.innerHTML = '<p class="text-secondary">Error al cargar transportadoras</p>';
    }
}

// ─────────────────────────────────────────────
// ESTADO DE CUENTA
// ─────────────────────────────────────────────
async function abrirEstadoCuenta(id, fechaInicio = '', fechaFin = '') {
    transActual = id;
    const modal = document.getElementById('modalCuenta');
    const contenido = document.getElementById('contenidoCuenta');
    const t = transportadoras.find(t => t.id_transportadora === id);
    document.getElementById('cuentaNombreTrans').textContent = t ? t.nombre : '';
    contenido.innerHTML = '<p class="text-secondary">Cargando...</p>';
    modal.classList.add('active');

    try {
        let url = `${API_CONFIG.ENDPOINTS.TRANSPORTADORAS}/${id}/estado-cuenta`;
        if (fechaInicio) url += `?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;

        const res = await apiGet(url);
        if (!res.ok) throw new Error(res.msg);

        const { resumen, pedidos_entregados, pedidos_devueltos, pagos_entregados, pagos_devoluciones, periodo, transportadora } = res;

        contenido.innerHTML = `
            <!-- Filtro de periodo -->
            <div class="filtro-periodo">
                <div>
                    <label>Desde</label>
                    <input type="date" id="filtroDesdeCuenta" value="${periodo.inicio}">
                </div>
                <div>
                    <label>Hasta</label>
                    <input type="date" id="filtroHastaCuenta" value="${periodo.fin}">
                </div>
                <button class="btn-primary" onclick="filtrarEstadoCuenta(${id})" style="padding:6px 14px;font-size:0.82rem;">
                    Filtrar
                </button>
                <span style="font-size:0.75rem;color:#888;align-self:center;">
                    Ciclo: <strong>${transportadora.ciclo_dias} día(s)</strong>
                </span>
            </div>

            <!-- Saldos globales -->
            <div class="saldos-banner">
                <div class="saldo-big verde">
                    <div class="sb-label">Me deben (saldo global)</div>
                    <div class="sb-valor">${formatearMoneda(resumen.saldo_pendiente_entregados)}</div>
                    <div style="font-size:0.72rem;opacity:.7;margin-top:4px;">
                        Entregado: ${formatearMoneda(resumen.total_entregado_global)} · Pagado: ${formatearMoneda(resumen.total_pagado_entregados)}
                    </div>
                </div>
                <div class="saldo-big rojo">
                    <div class="sb-label">Debo por devoluciones</div>
                    <div class="sb-valor">${formatearMoneda(resumen.saldo_pendiente_devoluciones)}</div>
                    <div style="font-size:0.72rem;opacity:.7;margin-top:4px;">
                        Total devol: ${formatearMoneda(resumen.total_devoluciones_global)} · Pagado: ${formatearMoneda(resumen.total_pagado_devoluciones)}
                    </div>
                </div>
                <div class="saldo-big">
                    <div class="sb-label">Periodo actual</div>
                    <div class="sb-valor" style="font-size:1.1rem;">
                        ${pedidos_entregados.length} entregados<br>
                        ${pedidos_devueltos.length} devueltos
                    </div>
                    <div style="font-size:0.72rem;opacity:.7;margin-top:4px;">
                        ${formatearFecha(periodo.inicio)} → ${formatearFecha(periodo.fin)}
                    </div>
                </div>
            </div>

            <!-- TABS -->
            <div class="tabs">
                <button class="tab-btn active" onclick="activarTab('tab-entregados', this)">
                    ✅ Entregados (${pedidos_entregados.length})
                </button>
                <button class="tab-btn" onclick="activarTab('tab-devueltos', this)">
                    🔄 Devueltos (${pedidos_devueltos.length})
                </button>
                <button class="tab-btn" onclick="activarTab('tab-pagos-recibidos', this)">
                    💰 Pagos recibidos (${pagos_entregados.length})
                </button>
                <button class="tab-btn" onclick="activarTab('tab-pagos-devol', this)">
                    💸 Pagos devoluciones (${pagos_devoluciones.length})
                </button>
            </div>

            <!-- TAB: Pedidos entregados del periodo -->
            <div class="tab-content active" id="tab-entregados">
                ${pedidos_entregados.length ? `
                <table class="mini-table">
                    <thead><tr>
                        <th>Guía</th><th>Fecha entrega</th><th>Cliente</th><th>Ciudad</th><th>Valor recaudado</th>
                    </tr></thead>
                    <tbody>
                        ${pedidos_entregados.map(p => `
                            <tr>
                                <td>${p.numero_guia || '—'}</td>
                                <td>${formatearFecha(p.fecha_estado)}</td>
                                <td>${p.nombre_cliente}</td>
                                <td>${p.ciudad_destino}</td>
                                <td class="valor-money"><strong>${formatearMoneda(p.valor_recaudado)}</strong></td>
                            </tr>
                        `).join('')}
                        <tr style="background:#f0f8f4;font-weight:800;">
                            <td colspan="4" style="text-align:right;">Total periodo:</td>
                            <td class="valor-money">${formatearMoneda(resumen.total_entregado_periodo)}</td>
                        </tr>
                    </tbody>
                </table>
                ` : '<p class="text-secondary" style="padding:16px;">Sin entregas en este periodo</p>'}
            </div>

            <!-- TAB: Pedidos devueltos del periodo -->
            <div class="tab-content" id="tab-devueltos">
                ${pedidos_devueltos.length ? `
                <table class="mini-table">
                    <thead><tr>
                        <th>Guía</th><th>Fecha</th><th>Cliente</th><th>Ciudad</th><th>Costo envío (a pagar)</th>
                    </tr></thead>
                    <tbody>
                        ${pedidos_devueltos.map(p => `
                            <tr>
                                <td>${p.numero_guia || '—'}</td>
                                <td>${formatearFecha(p.fecha_estado)}</td>
                                <td>${p.nombre_cliente}</td>
                                <td>${p.ciudad_destino}</td>
                                <td style="color:#842029;font-weight:700;">${formatearMoneda(p.costo_envio)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background:#fdf2f2;font-weight:800;">
                            <td colspan="4" style="text-align:right;">Total a pagar periodo:</td>
                            <td style="color:#842029;">${formatearMoneda(resumen.total_devoluciones_periodo)}</td>
                        </tr>
                    </tbody>
                </table>
                ` : '<p class="text-secondary" style="padding:16px;">Sin devoluciones en este periodo</p>'}
            </div>

            <!-- TAB: Pagos recibidos (trans me paga) -->
            <div class="tab-content" id="tab-pagos-recibidos">
                ${pagos_entregados.length ? `
                <table class="mini-table" style="margin-bottom:12px;">
                    <thead><tr><th>Fecha pago</th><th>Monto</th><th>Periodo cubierto</th><th>Observaciones</th><th></th></tr></thead>
                    <tbody>
                        ${pagos_entregados.map(p => `
                            <tr>
                                <td>${formatearFecha(p.fecha_pago)}</td>
                                <td class="valor-money"><strong>${formatearMoneda(p.monto_pago)}</strong></td>
                                <td style="font-size:0.78rem;color:#666;">
                                    ${p.fecha_inicio_ciclo ? `${formatearFecha(p.fecha_inicio_ciclo)} → ${formatearFecha(p.fecha_fin_ciclo)}` : '—'}
                                </td>
                                <td style="font-size:0.78rem;">${p.observaciones || '—'}</td>
                                <td>
                                    <button class="btn-tbl del" style="padding:3px 8px;background:#fee2e2;color:#991b1b;border:none;border-radius:5px;cursor:pointer;font-size:0.75rem;"
                                        onclick="eliminarPagoEntregado(${id}, ${p.id_entregado})">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : '<p class="text-secondary" style="padding:12px 0;">Sin pagos registrados</p>'}

                <!-- Formulario registrar pago -->
                <div class="pago-form">
                    <h4>💰 Registrar pago recibido</h4>
                    <div class="pago-form-grid">
                        <div class="form-group">
                            <label>Fecha pago *</label>
                            <input type="date" id="fechaPagoEntregado">
                        </div>
                        <div class="form-group">
                            <label>Monto *</label>
                            <input type="number" id="montoPagoEntregado" min="0" step="1000" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Observaciones</label>
                            <input type="text" id="obsPagoEntregado" placeholder="Opcional">
                        </div>
                        <button class="btn-primary" onclick="registrarPagoEntregado(${id})" style="padding:7px 14px;font-size:0.82rem;">
                            Registrar
                        </button>
                    </div>
                </div>
            </div>

            <!-- TAB: Pagos de devoluciones (yo le pago) -->
            <div class="tab-content" id="tab-pagos-devol">
                ${pagos_devoluciones.length ? `
                <table class="mini-table" style="margin-bottom:12px;">
                    <thead><tr><th>Fecha pago</th><th>Monto</th><th>Periodo cubierto</th><th>Observaciones</th><th></th></tr></thead>
                    <tbody>
                        ${pagos_devoluciones.map(p => `
                            <tr>
                                <td>${formatearFecha(p.fecha_pago)}</td>
                                <td style="color:#842029;font-weight:700;">${formatearMoneda(p.monto_pago)}</td>
                                <td style="font-size:0.78rem;color:#666;">
                                    ${p.fecha_inicio_ciclo ? `${formatearFecha(p.fecha_inicio_ciclo)} → ${formatearFecha(p.fecha_fin_ciclo)}` : '—'}
                                </td>
                                <td style="font-size:0.78rem;">${p.observaciones || '—'}</td>
                                <td>
                                    <button style="padding:3px 8px;background:#fee2e2;color:#991b1b;border:none;border-radius:5px;cursor:pointer;font-size:0.75rem;"
                                        onclick="eliminarPagoDevolucion(${id}, ${p.id_devolucion})">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : '<p class="text-secondary" style="padding:12px 0;">Sin pagos de devoluciones registrados</p>'}

                <div class="pago-form">
                    <h4>💸 Registrar pago de devoluciones</h4>
                    <div class="pago-form-grid">
                        <div class="form-group">
                            <label>Fecha pago *</label>
                            <input type="date" id="fechaPagoDevol">
                        </div>
                        <div class="form-group">
                            <label>Monto *</label>
                            <input type="number" id="montoPagoDevol" min="0" step="1000" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Observaciones</label>
                            <input type="text" id="obsPagoDevol" placeholder="Opcional">
                        </div>
                        <button class="btn-primary" onclick="registrarPagoDevolucion(${id})" style="padding:7px 14px;font-size:0.82rem;">
                            Registrar
                        </button>
                    </div>
                </div>
            </div>
        `;

    } catch (e) {
        contenido.innerHTML = `<p class="text-secondary">Error: ${e.message}</p>`;
    }
}

function filtrarEstadoCuenta(id) {
    const desde = document.getElementById('filtroDesdeCuenta').value;
    const hasta = document.getElementById('filtroHastaCuenta').value;
    abrirEstadoCuenta(id, desde, hasta);
}

function activarTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

// ─────────────────────────────────────────────
// REGISTRAR / ELIMINAR PAGOS
// ─────────────────────────────────────────────
async function registrarPagoEntregado(id) {
    const fecha = document.getElementById('fechaPagoEntregado').value;
    const monto = document.getElementById('montoPagoEntregado').value;
    const obs = document.getElementById('obsPagoEntregado').value;

    if (!fecha || !monto) { mostrarToast('Fecha y monto son requeridos', 'error'); return; }

    try {
        const res = await apiPost(
            `${API_CONFIG.ENDPOINTS.TRANSPORTADORAS}/${id}/pagos-entregados`,
            { fecha_pago: fecha, monto_pago: parseFloat(monto), observaciones: obs || null }
        );
        if (!res.ok) throw new Error(res.msg);
        mostrarToast('Pago registrado', 'success');
        abrirEstadoCuenta(id);
    } catch (e) { mostrarToast(e.message, 'error'); }
}

async function registrarPagoDevolucion(id) {
    const fecha = document.getElementById('fechaPagoDevol').value;
    const monto = document.getElementById('montoPagoDevol').value;
    const obs = document.getElementById('obsPagoDevol').value;

    if (!fecha || !monto) { mostrarToast('Fecha y monto son requeridos', 'error'); return; }

    try {
        const res = await apiPost(
            `${API_CONFIG.ENDPOINTS.TRANSPORTADORAS}/${id}/pagos-devoluciones`,
            { fecha_pago: fecha, monto_pago: parseFloat(monto), observaciones: obs || null }
        );
        if (!res.ok) throw new Error(res.msg);
        mostrarToast('Pago de devolución registrado', 'success');
        abrirEstadoCuenta(id);
    } catch (e) { mostrarToast(e.message, 'error'); }
}

async function eliminarPagoEntregado(idTrans, idPago) {
    if (!confirm('¿Eliminar este pago?')) return;
    try {
        const res = await apiDelete(
            `${API_CONFIG.ENDPOINTS.TRANSPORTADORAS}/${idTrans}/pagos-entregados/${idPago}`
        );
        if (!res.ok) throw new Error(res.msg);
        mostrarToast('Pago eliminado', 'success');
        abrirEstadoCuenta(idTrans);
    } catch (e) { mostrarToast(e.message, 'error'); }
}

async function eliminarPagoDevolucion(idTrans, idPago) {
    if (!confirm('¿Eliminar este pago?')) return;
    try {
        const res = await apiDelete(
            `${API_CONFIG.ENDPOINTS.TRANSPORTADORAS}/${idTrans}/pagos-devoluciones/${idPago}`
        );
        if (!res.ok) throw new Error(res.msg);
        mostrarToast('Pago eliminado', 'success');
        abrirEstadoCuenta(idTrans);
    } catch (e) { mostrarToast(e.message, 'error'); }
}

// ─────────────────────────────────────────────
// CRUD TRANSPORTADORAS
// ─────────────────────────────────────────────
function abrirModalNueva() {
    document.getElementById('modalTransTitulo').textContent = 'Nueva Transportadora';
    document.getElementById('transId').value = '';
    document.getElementById('formTrans').reset();
    document.getElementById('transCiclo').value = 1;
    document.getElementById('errorTrans').style.display = 'none';
    document.getElementById('modalTrans').classList.add('active');
}

function editarTrans(id) {
    const t = transportadoras.find(t => t.id_transportadora === id);
    if (!t) return;
    document.getElementById('modalTransTitulo').textContent = 'Editar Transportadora';
    document.getElementById('transId').value = id;
    document.getElementById('transNombre').value = t.nombre || '';
    document.getElementById('transUsuario').value = t.usuario || '';
    document.getElementById('transUrl').value = t.url_seguimiento || '';
    document.getElementById('transCiclo').value = t.ciclo_dias || 1;
    document.getElementById('transObservaciones').value = t.observaciones || '';
    document.getElementById('errorTrans').style.display = 'none';
    document.getElementById('modalTrans').classList.add('active');
}

async function eliminarTrans(id, nombre) {
    if (!confirm(`¿Eliminar la transportadora "${nombre}"?`)) return;
    try {
        const res = await apiDelete(`${API_CONFIG.ENDPOINTS.TRANSPORTADORAS}/${id}`);
        if (!res.ok) throw new Error(res.msg);
        mostrarToast('Transportadora eliminada', 'success');
        await cargarTransportadoras();
    } catch (e) { mostrarToast(e.message, 'error'); }
}

async function guardarTrans(e) {
    e.preventDefault();
    const btn = document.getElementById('btnGuardarTrans');
    const err = document.getElementById('errorTrans');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    err.style.display = 'none';

    try {
        const id = document.getElementById('transId').value;
        const datos = {
            nombre: document.getElementById('transNombre').value.trim(),
            usuario: document.getElementById('transUsuario').value.trim() || null,
            url_seguimiento: document.getElementById('transUrl').value.trim() || null,
            ciclo_dias: parseInt(document.getElementById('transCiclo').value) || 1,
            observaciones: document.getElementById('transObservaciones').value.trim() || null
        };

        const res = id
            ? await apiPut(`${API_CONFIG.ENDPOINTS.TRANSPORTADORAS}/${id}`, datos)
            : await apiPost(API_CONFIG.ENDPOINTS.TRANSPORTADORAS, datos);

        if (!res.ok) throw new Error(res.msg);

        mostrarToast(id ? 'Transportadora actualizada' : 'Transportadora creada', 'success');
        document.getElementById('modalTrans').classList.remove('active');
        await cargarTransportadoras();
    } catch (error) {
        err.textContent = error.message;
        err.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
    }
}

// ─────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────
function configurarEventos() {
    document.getElementById('btnNuevaTrans').addEventListener('click', abrirModalNueva);
    document.getElementById('btnCerrarTrans').addEventListener('click', () => {
        document.getElementById('modalTrans').classList.remove('active');
    });
    document.getElementById('btnCancelarTrans').addEventListener('click', () => {
        document.getElementById('modalTrans').classList.remove('active');
    });
    document.getElementById('modalTrans').addEventListener('click', e => {
        if (e.target.id === 'modalTrans') document.getElementById('modalTrans').classList.remove('active');
    });
    document.getElementById('formTrans').addEventListener('submit', guardarTrans);

    document.getElementById('btnCerrarCuenta').addEventListener('click', () => {
        document.getElementById('modalCuenta').classList.remove('active');
    });
    document.getElementById('modalCuenta').addEventListener('click', e => {
        if (e.target.id === 'modalCuenta') document.getElementById('modalCuenta').classList.remove('active');
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