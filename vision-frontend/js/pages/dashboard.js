/**
 * FUNCIONALIDAD DEL DASHBOARD
 * 
 * Este archivo maneja:
 * - Verificar autenticación
 * - Mostrar datos del usuario
 * - Cargar estadísticas
 * - Manejar logout
 * - Cargar últimas compras
 */

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Dashboard cargado');
    
    
    // 1. PROTEGER LA PÁGINA
    // Si no hay sesión, redirigir al login
    if (!requireAuth()) {
        return;
    }

    renderSidebar();
    
    // 2. OBTENER USUARIO ACTUAL
    const usuario = getCurrentUser();
    const rol = usuario.roles[0].toLowerCase().trim();
    console.log('Usuario actual:', usuario);
    
    
    mostrarInfoUsuario(usuario);

    aplicarRolesDashboard(rol);
    
    if (rol === 'administrador'){
    await cargarEstadisticas();
    await cargarUltimasCompras();
    await cargarProveedoresDeuda();
    }
    configurarLogout();
    configurarMenuMovil();
});

/**
 * MOSTRAR INFORMACIÓN DEL USUARIO
 */
function mostrarInfoUsuario(usuario) {
    // Elementos del DOM
    const userWelcome = document.getElementById('userWelcome');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    // Mostrar nombre
    if (userWelcome) {
        userWelcome.textContent = `Hola, ${usuario.nombre}`;
    }
    
    if (userName) {
        userName.textContent = usuario.nombre;
    }
    
    // Mostrar roles
    if (userRole && usuario.roles && usuario.roles.length > 0) {
        // Capitalizar primera letra de cada rol
        const rolesFormateados = usuario.roles.map(rol => 
            rol.charAt(0).toUpperCase() + rol.slice(1)
        ).join(', ');
        userRole.textContent = rolesFormateados;
    }
}



/**
 * CARGAR ESTADÍSTICAS GENERALES
 */
async function cargarEstadisticas() {
    try {
        // Cargar datos en paralelo usando Promise.all
        // Esto hace que todas las peticiones se ejecuten al mismo tiempo
        const [proveedores, productos, compras] = await Promise.all([
            apiGet(API_CONFIG.ENDPOINTS.PROVEEDORES),
            apiGet(API_CONFIG.ENDPOINTS.PRODUCTOS),
            apiGet(API_CONFIG.ENDPOINTS.COMPRAS)
        ]);
        
        // Actualizar contador de proveedores
        const totalProveedoresEl = document.getElementById('totalProveedores');
        if (totalProveedoresEl && proveedores.ok) {
            totalProveedoresEl.textContent = proveedores.proveedores.length;
        }
        
        // Actualizar contador de productos
        const totalProductosEl = document.getElementById('totalProductos');
        if (totalProductosEl && productos.ok) {
            totalProductosEl.textContent = productos.productos.length;
        }
        
        // Actualizar contador de compras
        const totalComprasEl = document.getElementById('totalCompras');
        if (totalComprasEl && compras.ok) {
            totalComprasEl.textContent = compras.compras.length;
        }
        
        // Calcular deuda total
        if (proveedores.ok) {
            let deudaTotal = 0;
            proveedores.proveedores.forEach(prov => {
                deudaTotal += parseFloat(prov.deuda_calculada || 0);
            });
            
            const deudaTotalEl = document.getElementById('deudaTotal');
            if (deudaTotalEl) {
                deudaTotalEl.textContent = formatearMoneda(deudaTotal);
            }
        }
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        handleAuthError(error);
    }
}

/**
 * CARGAR ÚLTIMAS COMPRAS
 */
async function cargarUltimasCompras() {
    const contenedor = document.getElementById('ultimasCompras');
    
    try {
        const response = await apiGet(API_CONFIG.ENDPOINTS.COMPRAS);
        
        if (!response.ok || !response.compras || response.compras.length === 0) {
            contenedor.innerHTML = '<p class="text-center text-secondary">No hay compras registradas</p>';
            return;
        }
        
        // Tomar solo las últimas 5
        const ultimasCompras = response.compras.slice(0, 5);
        
        // Crear tabla
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Total</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        ultimasCompras.forEach(compra => {
            const estadoBadge = obtenerBadgeEstado(compra.estado_general);
            
            html += `
                <tr>
                    <td>${formatearFecha(compra.fecha_compra)}</td>
                    <td>${compra.proveedor}</td>
                    <td>${formatearMoneda(compra.total_compra)}</td>
                    <td>${estadoBadge}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        contenedor.innerHTML = html;
        
    } catch (error) {
        console.error('Error al cargar compras:', error);
        contenedor.innerHTML = '<p class="text-center text-secondary">Error al cargar compras</p>';
        handleAuthError(error);
    }
}

/**
 * CARGAR PROVEEDORES CON MAYOR DEUDA
 */
async function cargarProveedoresDeuda() {
    const contenedor = document.getElementById('proveedoresDeuda');
    
    try {
        const response = await apiGet(API_CONFIG.ENDPOINTS.PROVEEDORES);
        
        if (!response.ok || !response.proveedores || response.proveedores.length === 0) {
            contenedor.innerHTML = '<p class="text-center text-secondary">No hay proveedores registrados</p>';
            return;
        }
        
        // Filtrar proveedores con deuda > 0 y ordenar por deuda
        const proveedoresConDeuda = response.proveedores
            .filter(p => parseFloat(p.deuda_calculada || 0) > 0)
            .sort((a, b) => parseFloat(b.deuda_calculada) - parseFloat(a.deuda_calculada))
            .slice(0, 5);
        
        if (proveedoresConDeuda.length === 0) {
            contenedor.innerHTML = '<p class="text-center text-secondary">No hay proveedores con deuda</p>';
            return;
        }
        
        // Crear tabla
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Proveedor</th>
                        <th>Total Comprado</th>
                        <th>Total Abonado</th>
                        <th>Deuda Actual</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        proveedoresConDeuda.forEach(prov => {
            html += `
                <tr>
                    <td><strong>${prov.nombre}</strong></td>
                    <td>${formatearMoneda(prov.total_comprado)}</td>
                    <td>${formatearMoneda(prov.total_abonado)}</td>
                    <td><strong>${formatearMoneda(prov.deuda_calculada)}</strong></td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        contenedor.innerHTML = html;
        
    } catch (error) {
        console.error('Error al cargar proveedores:', error);
        contenedor.innerHTML = '<p class="text-center text-secondary">Error al cargar proveedores</p>';
        handleAuthError(error);
    }
}

/**
 * CONFIGURAR BOTÓN DE LOGOUT
 */
function configurarLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Confirmar antes de cerrar sesión
            if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
                logout();
            }
        });
    }
}

/**
 * CONFIGURAR MENÚ MÓVIL
 */
function configurarMenuMovil() {
    const menuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!menuToggle || !sidebar || !overlay) return;
    
    // Abrir menú
    menuToggle.addEventListener('click', function() {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
    });
    
    // Cerrar menú al hacer clic en el overlay
    overlay.addEventListener('click', function() {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
    });
    
    // Cerrar menú al hacer clic en un enlace
    const menuLinks = sidebar.querySelectorAll('a');
    menuLinks.forEach(link => {
        link.addEventListener('click', function() {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
        });
    });
}

/**
 * FUNCIONES AUXILIARES
 */

// Formatear moneda
function formatearMoneda(valor) {
    const numero = parseFloat(valor) || 0;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(numero);
}

// Formatear fecha
function formatearFecha(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Obtener badge según estado
function obtenerBadgeEstado(estado) {
    const badges = {
        'pendiente': '<span class="badge badge-warning">Pendiente</span>',
        'parcial': '<span class="badge badge-secondary">Parcial</span>',
        'recibido': '<span class="badge badge-success">Recibido</span>'
    };
    
    return badges[estado] || '<span class="badge badge-secondary">-</span>';
}

function aplicarRolesDashboard(rolActual) {
    document.querySelectorAll('[data-role]').forEach(el => {
        const rolesPermitidos = el.dataset.role
            .split(',')
            .map(r => r.trim().toLowerCase());

        if (!rolesPermitidos.includes(rolActual)) {
            el.remove(); // 🔥 fuera del DOM
        }
    });
}
