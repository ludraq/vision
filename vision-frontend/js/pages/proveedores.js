/**
 * GESTIÓN DE PROVEEDORES
 */

let proveedores = [];
let proveedorEditando = null;
let proveedorAbono = null;
document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
});
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Página de proveedores cargada');
    
    if (!requireAuth() || !requireRole(['administrador', 'bodeguero'])) {
        return;
    }
    
    mostrarInfoUsuarioSidebar();
    configurarMenuMovil();
    configurarLogout();
    
    await cargarProveedores();
    configurarEventos();
});

/**
 * CARGAR PROVEEDORES
 */
async function cargarProveedores() {
    const contenedor = document.getElementById('tablaProveedores');
    
    try {
        const response = await apiGet(API_CONFIG.ENDPOINTS.PROVEEDORES);
        
        if (!response.ok || !response.proveedores) {
            throw new Error('Error al cargar proveedores');
        }
        
        proveedores = response.proveedores;
        mostrarProveedores(proveedores);
        
    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = '<p class="text-center text-secondary">Error al cargar proveedores</p>';
        handleAuthError(error);
    }
}

/**
 * MOSTRAR PROVEEDORES
 */
function mostrarProveedores(listaProveedores) {
    const contenedor = document.getElementById('tablaProveedores');
    
    if (!listaProveedores || listaProveedores.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-secondary">No hay proveedores registrados</p>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Cédula</th>
                    <th>Teléfono</th>
                    <th>Total Comprado</th>
                    <th>Total Abonado</th>
                    <th>Deuda Actual</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    listaProveedores.forEach(proveedor => {
        const deuda = parseFloat(proveedor.deuda_calculada || 0);
        const deudaBadge = deuda > 0 
            ? `<strong style="color: var(--danger)">${formatearMoneda(deuda)}</strong>`
            : `<span style="color: var(--success)">${formatearMoneda(deuda)}</span>`;
        
        html += `
            <tr>
                <td><strong>${proveedor.nombre}</strong></td>
                <td>${proveedor.cedula}</td>
                <td>${proveedor.telefono || '-'}</td>
                <td>${formatearMoneda(proveedor.total_comprado)}</td>
                <td>${formatearMoneda(proveedor.total_abonado)}</td>
                <td>${deudaBadge}</td>
                <td class="acciones">
                    <button class="btn-icon" onclick="abrirModalAbono(${proveedor.id_proveedor})" title="Registrar Abono">
                        💰
                    </button>
                    <button class="btn-icon btn-edit" onclick="editarProveedor(${proveedor.id_proveedor})" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon btn-delete" onclick="eliminarProveedor(${proveedor.id_proveedor}, '${proveedor.nombre}')" title="Eliminar">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    contenedor.innerHTML = html;
}

/**
 * CONFIGURAR EVENTOS
 */
function configurarEventos() {
    // Botón nuevo proveedor
    document.getElementById('btnNuevoProveedor').addEventListener('click', abrirModalNuevo);
    
    // Modal proveedor
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
    document.getElementById('modalProveedor').addEventListener('click', function(e) {
        if (e.target.id === 'modalProveedor') cerrarModal();
    });
    document.getElementById('formProveedor').addEventListener('submit', guardarProveedor);
    
    // Modal abono
    document.getElementById('btnCerrarModalAbono').addEventListener('click', cerrarModalAbono);
    document.getElementById('btnCancelarAbono').addEventListener('click', cerrarModalAbono);
    document.getElementById('modalAbono').addEventListener('click', function(e) {
        if (e.target.id === 'modalAbono') cerrarModalAbono();
    });
    document.getElementById('formAbono').addEventListener('submit', guardarAbono);
    
    // Búsqueda
    document.getElementById('buscarProveedor').addEventListener('input', debounce(function(e) {
        buscarProveedores(e.target.value);
    }, 300));
}

/**
 * BUSCAR PROVEEDORES
 */
function buscarProveedores(termino) {
    if (!termino) {
        mostrarProveedores(proveedores);
        return;
    }
    
    const terminoLower = termino.toLowerCase();
    const filtrados = proveedores.filter(p => 
        p.nombre.toLowerCase().includes(terminoLower) ||
        p.cedula.toLowerCase().includes(terminoLower)
    );
    
    mostrarProveedores(filtrados);
}

/**
 * ABRIR MODAL NUEVO
 */
function abrirModalNuevo() {
    proveedorEditando = null;
    document.getElementById('modalTitulo').textContent = 'Nuevo Proveedor';
    document.getElementById('formProveedor').reset();
    document.getElementById('proveedorId').value = '';
    document.getElementById('errorModal').style.display = 'none';
    document.getElementById('modalProveedor').classList.add('active');
}

/**
 * EDITAR PROVEEDOR
 */
async function editarProveedor(id) {
    try {
        const response = await apiGet(`${API_CONFIG.ENDPOINTS.PROVEEDORES}/${id}`);
        
        if (!response.ok || !response.proveedor) {
            throw new Error('Proveedor no encontrado');
        }
        
        proveedorEditando = response.proveedor;
        
        document.getElementById('modalTitulo').textContent = 'Editar Proveedor';
        document.getElementById('proveedorId').value = proveedorEditando.id_proveedor;
        document.getElementById('nombre').value = proveedorEditando.nombre;
        document.getElementById('cedula').value = proveedorEditando.cedula;
        document.getElementById('telefono').value = proveedorEditando.telefono || '';
        document.getElementById('direccion').value = proveedorEditando.direccion || '';
        document.getElementById('errorModal').style.display = 'none';
        
        document.getElementById('modalProveedor').classList.add('active');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar proveedor', 'error');
        handleAuthError(error);
    }
}

/**
 * GUARDAR PROVEEDOR
 */
async function guardarProveedor(e) {
    e.preventDefault();
    
    const btnGuardar = document.getElementById('btnGuardar');
    const errorModal = document.getElementById('errorModal');
    
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';
    errorModal.style.display = 'none';
    
    try {
        const id = document.getElementById('proveedorId').value;
        const datos = {
            nombre: document.getElementById('nombre').value.trim(),
            cedula: document.getElementById('cedula').value.trim(),
            telefono: document.getElementById('telefono').value.trim() || null,
            direccion: document.getElementById('direccion').value.trim() || null
        };
        
        let response;
        if (id) {
            response = await apiPut(`${API_CONFIG.ENDPOINTS.PROVEEDORES}/${id}`, datos);
        } else {
            response = await apiPost(API_CONFIG.ENDPOINTS.PROVEEDORES, datos);
        }
        
        if (response.ok) {
            mostrarToast(id ? 'Proveedor actualizado' : 'Proveedor creado', 'success');
            cerrarModal();
            await cargarProveedores();
        } else {
            throw new Error(response.msg || 'Error al guardar');
        }
        
    } catch (error) {
        console.error('Error:', error);
        errorModal.textContent = error.message;
        errorModal.style.display = 'block';
        handleAuthError(error);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar';
    }
}

/**
 * ELIMINAR PROVEEDOR
 */
async function eliminarProveedor(id, nombre) {
    if (!confirm(`¿Eliminar proveedor "${nombre}"?`)) return;
    
    try {
        const response = await apiDelete(`${API_CONFIG.ENDPOINTS.PROVEEDORES}/${id}`);
        
        if (response.ok) {
            mostrarToast('Proveedor eliminado', 'success');
            await cargarProveedores();
        } else {
            throw new Error(response.msg);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast(error.message || 'Error al eliminar', 'error');
        handleAuthError(error);
    }
}

/**
 * ABRIR MODAL ABONO
 */
async function abrirModalAbono(id) {
    try {
        const proveedor = proveedores.find(p => p.id_proveedor === id);
        if (!proveedor) throw new Error('Proveedor no encontrado');
        
        proveedorAbono = proveedor;
        
        document.getElementById('abonoProveedorId').value = proveedor.id_proveedor;
        document.getElementById('abonoProveedorNombre').textContent = proveedor.nombre;
        document.getElementById('abonoDeudaActual').textContent = formatearMoneda(proveedor.deuda_calculada);
        document.getElementById('formAbono').reset();
        document.getElementById('errorModalAbono').style.display = 'none';
        
        document.getElementById('modalAbono').classList.add('active');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al abrir modal de abono', 'error');
    }
}

/**
 * GUARDAR ABONO
 */
async function guardarAbono(e) {
    e.preventDefault();
    
    const btnGuardar = document.getElementById('btnGuardarAbono');
    const errorModal = document.getElementById('errorModalAbono');
    
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Registrando...';
    errorModal.style.display = 'none';
    
    try {
        const id = document.getElementById('abonoProveedorId').value;
        const datos = {
            monto_abono: parseFloat(document.getElementById('monto_abono').value),
            metodo_pago: document.getElementById('metodo_pago').value || null,
            observaciones: document.getElementById('observaciones_abono').value.trim() || null
        };
        
        const response = await apiPost(API_CONFIG.ENDPOINTS.PROVEEDORES_ABONOS(id), datos);
        
        if (response.ok) {
            mostrarToast('Abono registrado exitosamente', 'success');
            cerrarModalAbono();
            await cargarProveedores();
        } else {
            throw new Error(response.msg || 'Error al registrar abono');
        }
        
    } catch (error) {
        console.error('Error:', error);
        errorModal.textContent = error.message;
        errorModal.style.display = 'block';
        handleAuthError(error);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Registrar Abono';
    }
}

/**
 * CERRAR MODALES
 */
function cerrarModal() {
    document.getElementById('modalProveedor').classList.remove('active');
    document.getElementById('formProveedor').reset();
    proveedorEditando = null;
}

function cerrarModalAbono() {
    document.getElementById('modalAbono').classList.remove('active');
    document.getElementById('formAbono').reset();
    proveedorAbono = null;
}