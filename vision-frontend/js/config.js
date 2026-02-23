/**
 * CONFIGURACIÓN DE LA API
 * 
 * Aquí definimos la URL base de nuestro backend.
 * Si cambias el puerto o dominio, solo modificas este archivo.
 */

const API_CONFIG = {
    // URL base de tu API (ajusta según tu configuración)
    BASE_URL: 'http://localhost:3000',

    // Endpoints principales
    ENDPOINTS: {
        // Autenticación
        LOGIN: '/auth/login',

        // Usuarios
        USUARIOS: '/usuarios',

        // Proveedores
        PROVEEDORES: '/proveedores',
        PROVEEDORES_ABONOS: (id) => `/proveedores/${id}/abonos`,
        PROVEEDORES_PRODUCTOS: (id) => `/proveedores/${id}/productos`,

        // Productos
        PRODUCTOS: '/productos',
        PRODUCTOS_BUSCAR: '/productos/buscar',
        PRODUCTOS_PROVEEDORES: (id) => `/productos/${id}/proveedores`,
        PRODUCTOS_FOTO: (id) => `/productos/${id}/foto`,

        // Compras
        COMPRAS: '/compras',
        COMPRAS_RECIBIR: (id) => `/compras/${id}/recibir`,
        COMPRAS_FOTO: (id, idDetalle) => `/compras/${id}/detalle/${idDetalle}/foto`,
        COMPRAS_PROVEEDOR: (id) => `/compras/proveedor/${id}`,

        // Devoluciones
        DEVOLUCIONES: '/devoluciones',
        DEVOLUCIONES_PROVEEDOR: (id) => `/devoluciones/proveedor/${id}`,
        DEVOLUCIONES_RESUMEN: (id) => `/devoluciones/proveedor/${id}/resumen`,

        // Pedidos
        PEDIDOS: '/pedidos',
        PEDIDOS_COMISIONES: '/pedidos/comisiones',

        // Configuración y bonos (admin)
        CONFIGURACION: '/configuracion',
        BONOS: '/configuracion/bonos',
        BONO: (id) => `/configuracion/bonos/${id}`,

        // Transportadoras
        TRANSPORTADORAS: '/transportadoras',
        TRANS_ESTADO_CUENTA: (id) => `/transportadoras/${id}/estado-cuenta`,
        TRANS_PAGOS_ENTREGADOS: (id) => `/transportadoras/${id}/pagos-entregados`,
        TRANS_PAGOS_DEVOLUCIONES: (id) => `/transportadoras/${id}/pagos-devoluciones`,
    },

    // Tiempo de espera para las peticiones (en milisegundos)
    TIMEOUT: 10000
};

/**
 * FUNCIÓN PARA HACER PETICIONES HTTP
 * 
 * Esta función centraliza todas las peticiones a la API.
 * Maneja automáticamente el token de autenticación.
 * 
 * @param {string} endpoint - La ruta del endpoint (ej: '/usuarios')
 * @param {object} options - Opciones de la petición (método, body, etc.)
 * @returns {Promise} - Promesa con la respuesta del servidor
 */
async function apiRequest(endpoint, options = {}) {
    // Configuración por defecto
    const config = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    // Agregar token si existe
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Agregar body si existe
    if (options.body) {
        config.body = JSON.stringify(options.body);
    }

    try {
        // Hacer la petición
        const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, config);

        // Parsear la respuesta
        const data = await response.json();

        // Si hay error HTTP, lanzar excepción
        if (!response.ok) {
            throw {
                status: response.status,
                message: data.msg || 'Error en la petición',
                data: data
            };
        }

        return data;

    } catch (error) {
        // Si es error de red
        if (error.name === 'TypeError') {
            throw {
                status: 0,
                message: 'Error de conexión. Verifica que el servidor esté corriendo.',
                data: null
            };
        }

        // Si es error del servidor
        throw error;
    }
}

/**
 * FUNCIONES AUXILIARES PARA PETICIONES COMUNES
 */

// GET
async function apiGet(endpoint) {
    return apiRequest(endpoint, { method: 'GET' });
}

// POST
async function apiPost(endpoint, body) {
    return apiRequest(endpoint, { method: 'POST', body });
}

// PUT
async function apiPut(endpoint, body) {
    return apiRequest(endpoint, { method: 'PUT', body });
}

// DELETE
async function apiDelete(endpoint) {
    return apiRequest(endpoint, { method: 'DELETE' });
}