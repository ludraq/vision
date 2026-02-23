const MENU_POR_ROL = {
  administrador: [
    { text: 'Dashboard', href: '../dashboard.html', icon: '📊' },
    { text: 'Proveedores', href: '/pages/proveedores.html', icon: '📦' },
    { text: 'Productos', href: '/pages/productos.html', icon: '📦' },
    { text: 'Compras', href: '/pages/compras.html', icon: '🛒' },
    { text: 'Pedidos', href: '/pages/pedidos.html', icon: '📦' },
    { text: 'Usuarios', href: '/pages/usuarios.html', icon: '👥' },
    { text: 'Transportadoras', href: '/pages/transportadoras.html', icon: '🚚' },
    { text: 'Apartados', href: '/pages/apartados.html', icon: '📦' },
    { text: 'Configuración', href: '/pages/configuracion.html', icon: '⚙️' }
  ],
  bodeguero: [
    { text: 'Dashboard', href: '../dashboard.html', icon: '📊' },
    { text: 'Inventario', href: '/pages/inventario.html', icon: '📦' },
    { text: 'Compras', href: '/pages/compras.html', icon: '🛒' },
    { text: 'Pedidos', href: '/pages/pedidos.html', icon: '📦' },
    { text: 'Apartados', href: '/pages/apartados.html', icon: '📦' },
    { text: 'Productos', href: '/pages/productos.html', icon: '📦' },
  ],
  vendedor: [
    { text: 'Dashboard', href: '../dashboard.html', icon: '📊' },
    { text: 'Pedidos', href: '/pages/pedidos.html', icon: '📦' }
  ],
  empacador: [
    { text: 'Dashboard', href: '../pages/dashboard.html', icon: '📊' },
    { text: 'Apartados', href: '/pages/apartados.html', icon: '📦' }
  ]
};
function renderSidebar() {
  const usuario = getCurrentUser();
  if (!usuario || !usuario.roles) return;

  const menu = document.getElementById('sidebarMenu');
  menu.innerHTML = '';

  const rol = usuario.roles[0];
  const items = MENU_POR_ROL[rol] || [];

  items.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${item.href}">${item.text}</a>`;
    menu.appendChild(li);
  });

  // Logout
  menu.innerHTML += `
    <li class="menu-section"></li>
    <li><a href="#" id="logoutBtn" class="logout-btn">🚪 Cerrar Sesión</a></li>
  `;
}
