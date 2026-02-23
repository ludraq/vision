/**
 * CONFIGURACIÓN — Vision (solo administrador)
 */

let transportadoras = [];
let bonos = [];

document.addEventListener('DOMContentLoaded', () => { renderSidebar(); });

document.addEventListener('DOMContentLoaded', async function () {
    if (!requireAuth() || !requireRole(['administrador'])) return;

    mostrarInfoUsuarioSidebar();
    configurarMenuMovil();
    configurarLogout();

    await cargarDatos();
    configurarEventos();
});

async function cargarDatos() {
    try {
        const [resConfig, resTrans] = await Promise.all([
            apiGet(API_CONFIG.ENDPOINTS.CONFIGURACION),
            apiGet(API_CONFIG.ENDPOINTS.TRANSPORTADORAS)
        ]);

        if (resConfig.ok && resConfig.configuracion) {
            const c = resConfig.configuracion;
            document.getElementById('comisionDisplay').textContent = formatearMoneda(c.comision_base);
            document.getElementById('nuevaComisionBase').value = c.comision_base;
        }

        if (resConfig.ok) {
            bonos = resConfig.bonos || [];
            renderBonos();
        }

        if (resTrans.ok) {
            transportadoras = resTrans.transportadoras;
            renderTransportadoras();
        }
    } catch (e) {
        console.error('Error cargando configuración:', e);
    }
}

// ─────────────────────────────────────────────
// TRANSPORTADORAS
// ─────────────────────────────────────────────
function renderTransportadoras() {
    const contenedor = document.getElementById('listaTransportadoras');

    if (!transportadoras.length) {
        contenedor.innerHTML = '<p class="text-secondary" style="font-size:0.83rem;">No hay transportadoras registradas</p>';
        return;
    }

    contenedor.innerHTML = transportadoras.map(t => `
        <div class="transportadora-item">
            <div style="flex:1;">
                <div class="transportadora-nombre">🚚 ${t.nombre}</div>
                <div class="transportadora-cuenta">
                    Cuenta: <strong>${t.usuario || '—'}</strong>
                    ${t.url_seguimiento ? `· <span style="color:#0a58ca; font-size:0.75rem;">${t.url_seguimiento}</span>` : ''}
                </div>
            </div>
            <button class="btn-edit-cuenta" onclick="abrirEditarCuenta(${t.id_transportadora})">
                ✏️ Editar
            </button>
        </div>
    `).join('');
}

function abrirEditarCuenta(id) {
    const t = transportadoras.find(t => t.id_transportadora === id);
    if (!t) return;

    document.getElementById('cuentaTransportadoraId').value = id;
    document.getElementById('cuentaTransportadoraNombre').textContent = t.nombre;
    document.getElementById('cuentaNombre').value = t.usuario || '';
    document.getElementById('cuentaUrl').value = t.url_seguimiento || '';
    document.getElementById('errorCuenta').style.display = 'none';
    document.getElementById('modalCuenta').classList.add('active');
}

// ─────────────────────────────────────────────
// COMISIÓN
// ─────────────────────────────────────────────
async function actualizarComision() {
    const valor = parseFloat(document.getElementById('nuevaComisionBase').value);
    const msg = document.getElementById('msgComision');

    if (isNaN(valor) || valor < 0) {
        mostrarMensaje(msg, 'Ingresa un valor válido', 'error');
        return;
    }

    try {
        const res = await apiPut(API_CONFIG.ENDPOINTS.CONFIGURACION, { comision_base: valor });
        if (!res.ok) throw new Error(res.msg);

        document.getElementById('comisionDisplay').textContent = formatearMoneda(valor);
        mostrarMensaje(msg, '✓ Comisión actualizada', 'success');
        mostrarToast('Comisión actualizada exitosamente', 'success');
    } catch (e) {
        mostrarMensaje(msg, e.message, 'error');
    }
}

// ─────────────────────────────────────────────
// BONOS
// ─────────────────────────────────────────────
function renderBonos() {
    const contenedor = document.getElementById('listaBonos');

    if (!bonos.length) {
        contenedor.innerHTML = '<p class="text-secondary" style="font-size:0.83rem; margin-bottom:4px;">No hay bonos configurados. Agrega uno abajo.</p>';
        return;
    }

    const tipoLabel = { cantidad: '# pedidos', valor: '$ vendido', fijo: 'Siempre activo' };

    contenedor.innerHTML = bonos.map(b => `
        <div class="bono-item">
            <div class="bono-info">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="bono-nombre">${b.nombre}</span>
                    <span class="bono-badge ${b.activo ? 'bono-activo' : 'bono-inactivo'}">
                        ${b.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <span style="font-size:0.73rem; color:#888;">
                        ${tipoLabel[b.tipo]}${b.meta ? ` · Meta: ${b.tipo === 'valor' ? formatearMoneda(b.meta) : b.meta}` : ''}
                    </span>
                </div>
                ${b.descripcion ? `<div class="bono-desc">${b.descripcion}</div>` : ''}
            </div>
            <div class="bono-valor">${formatearMoneda(b.valor_bono)}</div>
            <div class="bono-acciones">
                <button class="btn-sm toggle" onclick="toggleBono(${b.id_bono}, ${b.activo})">
                    ${b.activo ? '⏸ Pausar' : '▶ Activar'}
                </button>
                <button class="btn-sm del" onclick="eliminarBono(${b.id_bono}, '${b.nombre}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function crearBono() {
    const msg = document.getElementById('msgBono');
    const nombre = document.getElementById('bonoNombre').value.trim();
    const descripcion = document.getElementById('bonoDescripcion').value.trim();
    const tipo = document.getElementById('bonoTipo').value;
    const meta = document.getElementById('bonoMeta').value;
    const valor_bono = parseFloat(document.getElementById('bonoValor').value);

    if (!nombre) { mostrarMensaje(msg, 'El nombre del bono es requerido', 'error'); return; }
    if (isNaN(valor_bono) || valor_bono <= 0) { mostrarMensaje(msg, 'Ingresa un valor válido', 'error'); return; }
    if ((tipo === 'cantidad' || tipo === 'valor') && !meta) {
        mostrarMensaje(msg, 'Ingresa la meta para este tipo de bono', 'error'); return;
    }

    try {
        const datos = { nombre, descripcion: descripcion || null, tipo, valor_bono };
        if (meta) datos.meta = parseFloat(meta);

        const res = await apiPost(API_CONFIG.ENDPOINTS.BONOS, datos);
        if (!res.ok) throw new Error(res.msg);

        mostrarToast('Bono creado', 'success');
        // Limpiar form
        document.getElementById('bonoNombre').value = '';
        document.getElementById('bonoDescripcion').value = '';
        document.getElementById('bonoMeta').value = '';
        document.getElementById('bonoValor').value = '';
        document.getElementById('msgBono').style.display = 'none';

        await cargarDatos();
    } catch (e) {
        mostrarMensaje(msg, e.message, 'error');
    }
}

async function toggleBono(id, estadoActual) {
    try {
        const res = await apiPut(`${API_CONFIG.ENDPOINTS.BONOS}/${id}`, { activo: !estadoActual });
        if (!res.ok) throw new Error(res.msg);
        mostrarToast(estadoActual ? 'Bono pausado' : 'Bono activado', 'success');
        await cargarDatos();
    } catch (e) {
        mostrarToast(e.message, 'error');
    }
}

async function eliminarBono(id, nombre) {
    if (!confirm(`¿Eliminar el bono "${nombre}"?`)) return;
    try {
        const res = await apiDelete(`${API_CONFIG.ENDPOINTS.BONOS}/${id}`);
        if (!res.ok) throw new Error(res.msg);
        mostrarToast('Bono eliminado', 'success');
        await cargarDatos();
    } catch (e) {
        mostrarToast(e.message, 'error');
    }
}

function toggleMetaBono() {
    const tipo = document.getElementById('bonoTipo').value;
    const campo = document.getElementById('campoMeta');
    campo.style.display = tipo !== 'fijo' ? 'block' : 'none';
    if (tipo === 'cantidad') {
        document.getElementById('bonoMeta').placeholder = 'Ej: 20 pedidos';
    } else if (tipo === 'valor') {
        document.getElementById('bonoMeta').placeholder = 'Ej: 3000000';
    }
}

// ─────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────
function configurarEventos() {
    // Modal cuenta transportadora
    document.getElementById('btnCerrarCuenta').addEventListener('click', () => {
        document.getElementById('modalCuenta').classList.remove('active');
    });
    document.getElementById('btnCancelarCuenta').addEventListener('click', () => {
        document.getElementById('modalCuenta').classList.remove('active');
    });
    document.getElementById('modalCuenta').addEventListener('click', e => {
        if (e.target.id === 'modalCuenta') document.getElementById('modalCuenta').classList.remove('active');
    });
    document.getElementById('formCuenta').addEventListener('submit', guardarCuenta);
}

async function guardarCuenta(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const err = document.getElementById('errorCuenta');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    err.style.display = 'none';

    try {
        const id = document.getElementById('cuentaTransportadoraId').value;
        const usuario = document.getElementById('cuentaNombre').value.trim();
        const url_seguimiento = document.getElementById('cuentaUrl').value.trim();

        if (!usuario) throw new Error('El nombre de la cuenta es requerido');

        const res = await apiPut(`${API_CONFIG.ENDPOINTS.TRANSPORTADORAS}/${id}`, {
            usuario,
            url_seguimiento: url_seguimiento || null
        });

        if (!res.ok) throw new Error(res.msg);

        mostrarToast('Cuenta actualizada', 'success');
        document.getElementById('modalCuenta').classList.remove('active');
        await cargarDatos();
    } catch (error) {
        err.textContent = error.message;
        err.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
    }
}

// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────
function mostrarMensaje(el, texto, tipo) {
    el.textContent = texto;
    el.style.display = 'block';
    el.style.color = tipo === 'error' ? '#842029' : '#1a6b3c';
    el.style.fontWeight = '600';
}