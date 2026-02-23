/**
 * UTILIDADES GENERALES
 * 
 * Funciones que se usan en múltiples páginas
 */

/**
 * FORMATEAR MONEDA
 */
function formatearMoneda(valor) {
    const numero = parseFloat(valor) || 0;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(numero);
}

/**
 * FORMATEAR FECHA
 */
function formatearFecha(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * FORMATEAR FECHA Y HORA
 */
function formatearFechaHora(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * OBTENER BADGE SEGÚN ESTADO
 */
function obtenerBadgeEstado(estado) {
    const badges = {
        'pendiente': '<span class="badge badge-warning">Pendiente</span>',
        'parcial': '<span class="badge badge-secondary">Parcial</span>',
        'recibido': '<span class="badge badge-success">Recibido</span>',
        'true': '<span class="badge badge-success">Activo</span>',
        'false': '<span class="badge badge-danger">Inactivo</span>'
    };
    
    return badges[estado] || '<span class="badge badge-secondary">-</span>';
}

/**
 * MOSTRAR TOAST (notificación temporal)
 */
function mostrarToast(mensaje, tipo = 'success') {
    // Crear elemento
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    
    // Estilos inline (se pueden mover a CSS)
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '1rem 1.5rem',
        borderRadius: '8px',
        backgroundColor: tipo === 'success' ? '#10b981' : '#ef4444',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        zIndex: '10000',
        animation: 'slideInRight 0.3s ease-out'
    });
    
    document.body.appendChild(toast);
    
    // Eliminar después de 3 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * CONFIGURAR MENÚ MÓVIL (reutilizable)
 */
function configurarMenuMovil() {
    const menuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!menuToggle || !sidebar || !overlay) return;
    
    menuToggle.addEventListener('click', function() {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
    });
    
    overlay.addEventListener('click', function() {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
    });
    
    const menuLinks = sidebar.querySelectorAll('a');
    menuLinks.forEach(link => {
        link.addEventListener('click', function() {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
        });
    });
}

/**
 * CONFIGURAR LOGOUT (reutilizable)
 */
function configurarLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
                logout();
            }
        });
    }
}

/**
 * MOSTRAR INFO DE USUARIO EN SIDEBAR (reutilizable)
 */
function mostrarInfoUsuarioSidebar() {
    const usuario = getCurrentUser();
    const userWelcome = document.getElementById('userWelcome');
    
    if (userWelcome && usuario) {
        userWelcome.textContent = `Hola, ${usuario.nombre}`;
    }
}

/**
 * DEBOUNCE - evitar múltiples ejecuciones rápidas
 * Útil para búsquedas en tiempo real
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}