/**
 * GESTIÓN DE USUARIOS
 * CRUD Completo
 */

// Variables globales
let usuarios = [];
let roles = [];
let usuarioEditando = null;
document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
});
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Página de usuarios cargada');
    
    // Proteger página - solo administradores
    if (!requireAuth() || !requireRole('administrador')) {
        return;
    }
    
    // Configurar elementos comunes
    mostrarInfoUsuarioSidebar();
    configurarMenuMovil();
    configurarLogout();
    
    // Cargar roles disponibles
    await cargarRoles();
    
    // Cargar usuarios
    await cargarUsuarios();
    
    // Configurar eventos
    configurarEventos();
});

/**
 * CARGAR ROLES DESDE LA API
 */
async function cargarRoles() {
    try {
        const response = await apiGet('/roles');

        if (!response.ok) {
            throw new Error('Error al cargar roles');
        }

        roles = response.roles;

        const selectRoles = document.getElementById('roles');
        selectRoles.innerHTML = roles.map(rol =>
            `<option value="${rol.id_rol}">${rol.nombre}</option>`
        ).join('');
    } catch (error) {
        console.error(error);
        mostrarToast('Error al cargar roles', 'error');
    }
}


/**
 * CARGAR USUARIOS DESDE LA API
 */
async function cargarUsuarios() {
    const contenedor = document.getElementById('tablaUsuarios');
    
    try {
        const response = await apiGet(API_CONFIG.ENDPOINTS.USUARIOS);
        
        if (!response.ok || !response.usuarios) {
            throw new Error('Error al cargar usuarios');
        }
        
        usuarios = response.usuarios;
        mostrarUsuarios(usuarios);
        
    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = '<p class="text-center text-secondary">Error al cargar usuarios</p>';
        handleAuthError(error);
    }
}

/**
 * MOSTRAR USUARIOS EN LA TABLA
 */
function mostrarUsuarios(listaUsuarios) {
    const contenedor = document.getElementById('tablaUsuarios');
    
    if (!listaUsuarios || listaUsuarios.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-secondary">No hay usuarios registrados</p>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Roles</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    listaUsuarios.forEach(usuario => {
        const rolesTexto = usuario.roles && usuario.roles.length > 0 
            ? usuario.roles.join(', ') 
            : 'Sin roles';
        
        const estadoBadge = usuario.estado 
            ? '<span class="badge badge-success">Activo</span>'
            : '<span class="badge badge-danger">Inactivo</span>';
        
        html += `
            <tr>
                <td><strong>${usuario.nombre}</strong></td>
                <td>${usuario.usuario}</td>
                <td>${usuario.correo || '-'}</td>
                <td>${rolesTexto}</td>
                <td>${estadoBadge}</td>
                <td class="acciones">
                    <button class="btn-icon btn-edit" onclick="editarUsuario(${usuario.id_usuario})" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon btn-delete" onclick="eliminarUsuario(${usuario.id_usuario}, '${usuario.nombre}')" title="Eliminar">
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
    // Botón nuevo usuario
    const btnNuevo = document.getElementById('btnNuevoUsuario');
    btnNuevo.addEventListener('click', abrirModalNuevo);
    
    // Cerrar modal
    const btnCerrar = document.getElementById('btnCerrarModal');
    const btnCancelar = document.getElementById('btnCancelar');
    
    btnCerrar.addEventListener('click', cerrarModal);
    btnCancelar.addEventListener('click', cerrarModal);
    
    // Cerrar modal al hacer clic fuera
    const modal = document.getElementById('modalUsuario');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            cerrarModal();
        }
    });
    
    // Formulario
    const form = document.getElementById('formUsuario');
    form.addEventListener('submit', guardarUsuario);
    
    // Búsqueda en tiempo real
    const inputBuscar = document.getElementById('buscarUsuario');
    inputBuscar.addEventListener('input', debounce(function(e) {
        buscarUsuarios(e.target.value);
    }, 300));
}

/**
 * BUSCAR USUARIOS
 */
function buscarUsuarios(termino) {
    if (!termino) {
        mostrarUsuarios(usuarios);
        return;
    }
    
    const terminoLower = termino.toLowerCase();
    const filtrados = usuarios.filter(u => 
        u.nombre.toLowerCase().includes(terminoLower) ||
        u.usuario.toLowerCase().includes(terminoLower) ||
        (u.correo && u.correo.toLowerCase().includes(terminoLower))
    );
    
    mostrarUsuarios(filtrados);
}

/**
 * ABRIR MODAL PARA NUEVO USUARIO
 */
function abrirModalNuevo() {
    usuarioEditando = null;
    
    document.getElementById('modalTitulo').textContent = 'Nuevo Usuario';
    document.getElementById('claveOpcional').style.display = 'none';
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = '';
    document.getElementById('estado').checked = true;
    document.getElementById('errorModal').style.display = 'none';
    
    // Hacer contraseña requerida
    document.getElementById('clave').required = true;
    
    document.getElementById('modalUsuario').classList.add('active');
}

/**
 * EDITAR USUARIO
 */
async function editarUsuario(id) {
    try {
        const response = await apiGet(`${API_CONFIG.ENDPOINTS.USUARIOS}/${id}`);
        
        if (!response.ok || !response.usuario) {
            throw new Error('Usuario no encontrado');
        }
        
        console.log("USUARIO RECIBIDO DESDE API:", response.usuario);

        usuarioEditando = response.usuario;
        
        // Llenar formulario
        document.getElementById('modalTitulo').textContent = 'Editar Usuario';
        document.getElementById('claveOpcional').style.display = 'inline';
        document.getElementById('usuarioId').value = usuarioEditando.id_usuario;
        document.getElementById('nombre').value = usuarioEditando.nombre;
        document.getElementById('usuario').value = usuarioEditando.usuario;
        document.getElementById('correo').value = usuarioEditando.correo || '';
        document.getElementById('celular').value = usuarioEditando.celular || '';
        document.getElementById('clave').value = '';
        document.getElementById('estado').checked = usuarioEditando.estado;
        document.getElementById('errorModal').style.display = 'none';
        
        // Contraseña opcional al editar
        document.getElementById('clave').required = false;
        
        // Seleccionar roles
        const selectRoles = document.getElementById('roles');
        Array.from(selectRoles.options).forEach(option => {
            option.selected = usuarioEditando.roles && 
                usuarioEditando.roles.some(r => r.id_rol == option.value);
        });
        
        document.getElementById('modalUsuario').classList.add('active');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar usuario', 'error');
        handleAuthError(error);
    }
}

/**
 * GUARDAR USUARIO (crear o actualizar)
 */
async function guardarUsuario(e) {
    e.preventDefault();
    
    const btnGuardar = document.getElementById('btnGuardar');
    const errorModal = document.getElementById('errorModal');
    
    // Deshabilitar botón
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';
    errorModal.style.display = 'none';
    
    try {
        // Obtener datos del formulario
        const id = document.getElementById('usuarioId').value;
        const nombre = document.getElementById('nombre').value.trim();
        const usuario = document.getElementById('usuario').value.trim();
        const correo = document.getElementById('correo').value.trim();
        const celular = document.getElementById('celular').value.trim();
        const clave = document.getElementById('clave').value;
        const estado = document.getElementById('estado').checked;
        
        // Obtener roles seleccionados
        const selectRoles = document.getElementById('roles');
        const rolesSeleccionados = Array.from(selectRoles.selectedOptions).map(opt => parseInt(opt.value));
        
        if (rolesSeleccionados.length === 0) {
            throw new Error('Debes seleccionar al menos un rol');
        }
        
        // Preparar datos
        const datos = {
            nombre,
            usuario,
            correo: correo || null,
            celular: celular || null,
            estado,
            roles: rolesSeleccionados
        };
        
        // Solo incluir clave si se proporcionó
        if (clave) {
            datos.clave = clave;
        }
        
        let response;
        
        if (id) {
            // Actualizar
            response = await apiPut(`${API_CONFIG.ENDPOINTS.USUARIOS}/${id}`, datos);
        } else {
            // Crear nuevo
            if (!clave) {
                throw new Error('La contraseña es requerida para nuevos usuarios');
            }
            response = await apiPost(API_CONFIG.ENDPOINTS.USUARIOS, datos);
        }
        
        if (response.ok) {
            mostrarToast(id ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente', 'success');
            cerrarModal();
            await cargarUsuarios();
        } else {
            throw new Error(response.msg || 'Error al guardar usuario');
        }
        
    } catch (error) {
        console.error('Error:', error);
        errorModal.textContent = error.message || 'Error al guardar usuario';
        errorModal.style.display = 'block';
        handleAuthError(error);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar';
    }
}

/**
 * ELIMINAR USUARIO
 */
async function eliminarUsuario(id, nombre) {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${nombre}"?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        const response = await apiDelete(`${API_CONFIG.ENDPOINTS.USUARIOS}/${id}`);
        
        if (response.ok) {
            mostrarToast('Usuario eliminado exitosamente', 'success');
            await cargarUsuarios();
        } else {
            throw new Error(response.msg || 'Error al eliminar usuario');
        }
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast(error.message || 'Error al eliminar usuario', 'error');
        handleAuthError(error);
    }
}

/**
 * CERRAR MODAL
 */
function cerrarModal() {
    document.getElementById('modalUsuario').classList.remove('active');
    document.getElementById('formUsuario').reset();
    usuarioEditando = null;
}