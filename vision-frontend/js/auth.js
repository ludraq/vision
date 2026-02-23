/**
 * SISTEMA DE AUTENTICACIÓN
 * 
 * Este archivo maneja todo lo relacionado con:
 * - Login y logout
 * - Almacenamiento del token
 * - Verificación de sesión
 * - Protección de rutas
 */

/**
 * FUNCIÓN PARA HACER LOGIN
 * 
 * @param {string} correo - Correo del usuario
 * @param {string} clave - Contraseña del usuario
 * @returns {Promise<object>} - Datos del usuario logueado
 */
async function login(correo, clave) {
    try {
        // Hacer petición al backend
        const response = await apiPost(API_CONFIG.ENDPOINTS.LOGIN, {
            correo,
            clave
        });

        // Si el login es exitoso
        if (response.ok && response.token) {
            // Guardar token en localStorage
            // localStorage es como una "caja fuerte" en el navegador
            // Los datos persisten aunque cierres el navegador
            localStorage.setItem('token', response.token);

            // Guardar datos del usuario
            const usuarioAGuardar = response.usuario;
            usuarioAGuardar.rol = usuarioAGuardar.roles ? usuarioAGuardar.roles[0] : '';
            localStorage.setItem('usuario', JSON.stringify(usuarioAGuardar));

            return response;
        } else {
            throw new Error(response.msg || 'Error al iniciar sesión');
        }

    } catch (error) {
        console.error('Error en login:', error);
        throw error;
    }
}

/**
 * FUNCIÓN PARA HACER LOGOUT
 * 
 * Elimina toda la información de sesión
 */
function logout() {
    // Eliminar token y usuario del localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');

    // Detectar si estamos en una subcarpeta
    const path = window.location.pathname;
    const isInSubfolder = path.includes('/pages/');

    // Redirigir al login según la ubicación
    if (isInSubfolder) {
        window.location.href = '../index.html';
    } else {
        window.location.href = 'index.html';
    }
}

/**
 * FUNCIÓN PARA VERIFICAR SI HAY SESIÓN ACTIVA
 * 
 * @returns {boolean} - true si hay sesión, false si no
 */
function isAuthenticated() {
    const token = localStorage.getItem('token');
    return token !== null && token !== undefined && token !== '';
}

/**
 * FUNCIÓN PARA OBTENER EL USUARIO ACTUAL
 * 
 * @returns {object|null} - Datos del usuario o null si no hay sesión
 */
function getCurrentUser() {
    const usuarioStr = localStorage.getItem('usuario');

    if (!usuarioStr) {
        return null;
    }

    try {
        // JSON.parse convierte el texto guardado de vuelta a objeto
        return JSON.parse(usuarioStr);
    } catch (error) {
        console.error('Error al parsear usuario:', error);
        return null;
    }
}

/**
 * FUNCIÓN PARA VERIFICAR SI EL USUARIO TIENE UN ROL ESPECÍFICO
 * 
 * @param {string} rol - Nombre del rol a verificar
 * @returns {boolean} - true si tiene el rol, false si no
 */
function hasRole(rol) {
    const usuario = getCurrentUser();

    if (!usuario || !usuario.roles) {
        return false;
    }

    // Verificar si el array de roles incluye el rol buscado
    return usuario.roles.includes(rol);
}

/**
 * FUNCIÓN PARA PROTEGER PÁGINAS
 * 
 * Esta función debe ejecutarse al cargar páginas protegidas.
 * Si no hay sesión, redirige al login.
 */
function requireAuth() {
    if (!isAuthenticated()) {
        // Detectar si estamos en una subcarpeta
        const path = window.location.pathname;
        const isInSubfolder = path.includes('/pages/');

        // Si no hay sesión, redirigir al login
        if (isInSubfolder) {
            window.location.href = '../index.html';
        } else {
            window.location.href = 'index.html';
        }
        return false;
    }
    return true;
}


/**
 * FUNCIÓN PARA VERIFICAR ROL Y REDIRIGIR SI NO TIENE PERMISO
 * 
 * @param {string|array} rolesPermitidos - Rol o array de roles permitidos
 */
function requireRole(rolesPermitidos) {
    // Asegurar que rolesPermitidos sea un array
    const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];

    const usuario = getCurrentUser();

    if (!usuario || !usuario.roles) {
        window.location.href = "/;"
        return false;
    }

    // Verificar si el usuario tiene al menos uno de los roles permitidos
    const tienePermiso = usuario.roles.some(rol => roles.includes(rol));

    if (!tienePermiso) {
        alert('No tienes permisos para acceder a esta página');
        window.location.href = "/pages/dashboard.html";
        return false;
    }

    return true;
}

/**
 * FUNCIÓN PARA MANEJAR ERRORES DE AUTENTICACIÓN
 * 
 * Si el servidor devuelve 401 (no autorizado), cerrar sesión
 */
function handleAuthError(error) {
    if (error.status === 401) {
        alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        logout();
    }
}