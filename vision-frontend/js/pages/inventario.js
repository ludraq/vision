document.addEventListener('DOMContentLoaded', () => {
    requireAuth();
    renderSidebar();
    requireRole(['administrador', 'bodeguero']);
    mostrarInfoUsuarioSidebar();
    configurarLogout();
    configurarMenuMovil();

    cargarInventario();
    cargarProductos();

    document.getElementById('btnNuevoAjuste')
        .addEventListener('click', () => abrirModal(true));

    document.getElementById('cerrarModal')
        .addEventListener('click', () => abrirModal(false));

    document.getElementById('formAjuste')
        .addEventListener('submit', guardarAjuste);
});

/* ===============================
   INVENTARIO
================================ */

async function cargarInventario() {
    try {
        const res = await apiGet('/inventario');

        const tbody = document.getElementById('tablaInventario');
        tbody.innerHTML = '';

        if (res.inventario.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-secondary">
                        Sin registros
                    </td>
                </tr>`;
            return;
        }

        res.inventario.forEach(i => {
            tbody.innerHTML += `
                <tr>
                    <td>${i.producto}</td>
                    <td>${i.talla}</td>
                    <td>${i.cantidad}</td>
                </tr>`;
        });

    } catch (err) {
        mostrarToast(err.message, 'error');
    }
}

/* ===============================
   PRODUCTOS
================================ */

async function cargarProductos() {
    const select = document.getElementById('producto');
    select.innerHTML = '';

    try {
        const res = await apiGet(API_CONFIG.ENDPOINTS.PRODUCTOS);

        res.productos.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id_producto;
            option.textContent = p.nombre;
            select.appendChild(option);
        });

    } catch (err) {
        mostrarToast('Error cargando productos', 'error');
    }
}

/* ===============================
   AJUSTE MANUAL
================================ */

async function guardarAjuste(e) {
    e.preventDefault();

    const id_producto = parseInt(document.getElementById('producto').value);
    const talla = parseInt(document.getElementById('talla').value);
    const cantidad = parseInt(document.getElementById('cantidad').value);

    if (!id_producto || !talla || cantidad <= 0) {
        mostrarToast('Debe seleccionar producto, talla y cantidad válida', 'error');
        return;
    }

    const data = {
        tipo: document.getElementById('tipo').value,
        motivo: document.getElementById('motivo').value,
        observaciones: document.getElementById('observaciones').value,
        productos: [ // ✅ nombre correcto
            {
                id_producto,
                talla,
                cantidad
            }
        ]
    };

    console.log('Ajuste enviado:', data); // 👈 debug útil

    try {
        await apiPost('/inventario/ajuste-manual', data);
        mostrarToast('Ajuste registrado correctamente');
        abrirModal(false);
        cargarInventario();
        e.target.reset();
    } catch (err) {
        mostrarToast(err.message, 'error');
    }
}


/* ===============================
   MODAL
================================ */

function abrirModal(mostrar) {
    document.getElementById('modalAjuste')
        .classList.toggle('active', mostrar);
}
