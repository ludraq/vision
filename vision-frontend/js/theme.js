/**
 * theme.js - Gestión de Modo Oscuro para Vision
 */

document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const currentTheme = localStorage.getItem('theme');

    // Aplicar tema guardado
    if (currentTheme === 'dark') {
        body.classList.add('dark-mode');
    }

    // Crear y añadir botón de toggle si no existe
    if (!document.getElementById('themeToggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'themeToggle';
        toggleBtn.className = 'theme-toggle';
        toggleBtn.title = 'Cambiar modo';
        toggleBtn.innerHTML = body.classList.contains('dark-mode') ? '☀️' : '🌙';

        document.body.appendChild(toggleBtn);

        toggleBtn.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const theme = body.classList.contains('dark-mode') ? 'dark' : 'light';
            localStorage.setItem('theme', theme);
            toggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        });
    }
});
