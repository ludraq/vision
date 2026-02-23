/**
 * FUNCIONALIDAD DE LA PÁGINA DE LOGIN
 * 
 * Este archivo contiene toda la lógica para:
 * - Capturar el formulario de login
 * - Validar los datos
 * - Enviar al backend
 * - Manejar errores
 * - Redirigir al dashboard
 */

// Este código se ejecuta cuando la página termina de cargar
document.addEventListener('DOMContentLoaded', function() {
    console.log('Página de login cargada');
    
    // Si ya hay sesión activa, redirigir al dashboard
    if (isAuthenticated()) {
        console.log('Usuario ya autenticado, redirigiendo...');
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Obtener elementos del DOM (Document Object Model)
    // getElementById nos permite "agarrar" elementos HTML por su ID
    const loginForm = document.getElementById('loginForm');
    const correoInput = document.getElementById('correo');
    const claveInput = document.getElementById('clave');
    const loginBtn = document.getElementById('loginBtn');
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('errorMessage');
    
    /**
     * FUNCIÓN PARA MOSTRAR ERRORES
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Ocultar el error después de 5 segundos
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
    
    /**
     * FUNCIÓN PARA MOSTRAR/OCULTAR LOADING
     */
    function setLoading(isLoading) {
        if (isLoading) {
            loginBtn.disabled = true;
            loginBtn.style.display = 'none';
            loading.style.display = 'block';
        } else {
            loginBtn.disabled = false;
            loginBtn.style.display = 'block';
            loading.style.display = 'none';
        }
    }
    
    /**
     * MANEJADOR DEL FORMULARIO
     * 
     * addEventListener escucha eventos (como clicks, envíos de formulario, etc.)
     * 'submit' es el evento que se dispara cuando se envía el formulario
     */
    loginForm.addEventListener('submit', async function(event) {
        // preventDefault evita que el formulario se envíe de la forma tradicional
        // (que recarga la página)
        event.preventDefault();
        
        // Limpiar mensaje de error previo
        errorMessage.style.display = 'none';
        
        // Obtener valores del formulario
        const correo = correoInput.value.trim();
        const clave = claveInput.value;
        
        // Validaciones básicas
        if (!correo || !clave) {
            showError('Por favor, completa todos los campos');
            return;
        }
        
        // Validar formato de correo
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo)) {
            showError('Por favor, ingresa un correo válido');
            return;
        }
        
        // Mostrar loading
        setLoading(true);
        
        try {
            // Intentar hacer login
            console.log('Intentando login con:', correo);
            const response = await login(correo, clave);
            
            console.log('Login exitoso:', response);
            
            // Redirigir al dashboard
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            // Si hay error, mostrarlo
            console.error('Error en login:', error);
            
            let errorMsg = 'Error al iniciar sesión';
            
            if (error.status === 401) {
                errorMsg = 'Correo o contraseña incorrectos';
            } else if (error.status === 0) {
                errorMsg = 'No se puede conectar al servidor. Verifica que esté corriendo.';
            } else if (error.message) {
                errorMsg = error.message;
            }
            
            showError(errorMsg);
            
        } finally {
            // finally se ejecuta siempre, haya error o no
            // Ocultar loading
            setLoading(false);
        }
    });
    
    /**
     * LIMPIAR ERRORES AL ESCRIBIR
     * 
     * Esto mejora la experiencia de usuario
     */
    correoInput.addEventListener('input', function() {
        errorMessage.style.display = 'none';
    });
    
    claveInput.addEventListener('input', function() {
        errorMessage.style.display = 'none';
    });
    
    // Enfocar el campo de correo automáticamente
    correoInput.focus();
    
    console.log('Evento de formulario registrado correctamente');
});