/**
 * GESTIÓN DE PRODUCTOS - PARTE 1
 */

let productos = [];
let proveedores = [];
let productoEditando = null;
let productoAsignando = null;
document.addEventListener('DOMContentLoaded', () => {
 
  renderSidebar();
});
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Página de productos cargada');
    
    if (!requireAuth() || !requireRole(['administrador', 'bodeguero'])) {
        return;
    }
    
    mostrarInfoUsuarioSidebar();
    configurarMenuMovil();
    configurarLogout();
    
    await cargarProveedores();
    await cargarProductos();
    configurarEventos();
});

/**
 * CARGAR PROVEEDORES
 */
async function cargarProveedores() {
    try {
        const response = await apiGet(API_CONFIG.ENDPOINTS.PROVEEDORES);
        if (response.ok) {
            proveedores = response.proveedores;
        }
    } catch (error) {
        console.error('Error al cargar proveedores:', error);
    }
}

/**
 * CARGAR PRODUCTOS
 */
async function cargarProductos() {
    const contenedor = document.getElementById('galeriaProductos');
    
    try {
        const response = await apiGet(API_CONFIG.ENDPOINTS.PRODUCTOS);
        
        if (!response.ok || !response.productos) {
            throw new Error('Error al cargar productos');
        }
        
        productos = response.productos;
        mostrarProductos(productos);
        
    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = '<p class="text-center text-secondary">Error al cargar productos</p>';
        handleAuthError(error);
    }
}

/**
 * MOSTRAR PRODUCTOS EN GALERÍA
 */
function mostrarProductos(listaProductos) {
    const contenedor = document.getElementById('galeriaProductos');
    
    if (!listaProductos || listaProductos.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-secondary">No hay productos registrados</p>';
        return;
    }
    
    let html = '<div class="productos-grid">';
    
    listaProductos.forEach(producto => {
        const imagen = producto.ruta_foto 
            ? `<img src="${producto.ruta_foto}" alt="${producto.nombre}" class="producto-imagen" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="producto-imagen-placeholder" style="display:none;">👟</div>`
            : `<div class="producto-imagen-placeholder">👟</div>`;
        
        const descripcion = producto.descripcion 
            ? `<p class="producto-descripcion">${producto.descripcion}</p>`
            : '';
        
        html += `
            <div class="producto-card">
                ${imagen}
                <div class="producto-info">
                    <h3 class="producto-nombre">${producto.nombre}</h3>
                    ${descripcion}
                    <div class="producto-precio">${formatearMoneda(producto.precio)}</div>
                    <div class="producto-acciones">
                        <button class="btn-asignar" onclick="abrirModalAsignar(${producto.id_producto})">
                            🏢 Proveedores
                        </button>
                        <button class="btn-icon btn-edit" onclick="editarProducto(${producto.id_producto})" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon btn-delete" onclick="eliminarProducto(${producto.id_producto}, '${producto.nombre}')" title="Eliminar">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    contenedor.innerHTML = html;
}
/**
 * GESTIÓN DE PRODUCTOS - PARTE 2
 */

/**
 * CONFIGURAR EVENTOS
 */
function configurarEventos() {
    // Botón nuevo producto
    document.getElementById('btnNuevoProducto').addEventListener('click', abrirModalNuevo);
    
    // Modal producto
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnCancelar').addEventListener('click', cerrarModal);
    document.getElementById('modalProducto').addEventListener('click', function(e) {
        if (e.target.id === 'modalProducto') cerrarModal();
    });
    document.getElementById('formProducto').addEventListener('submit', guardarProducto);
    
    // Preview de imagen
    document.getElementById('imagen').addEventListener('change', mostrarPreviewImagen);
    
    // Modal proveedores
    document.getElementById('btnCerrarModalProveedores').addEventListener('click', cerrarModalProveedores);
    document.getElementById('modalProveedores').addEventListener('click', function(e) {
        if (e.target.id === 'modalProveedores') cerrarModalProveedores();
    });
    document.getElementById('formAsignarProveedor').addEventListener('submit', asignarProveedor);
    
    // Búsqueda
    document.getElementById('buscarProducto').addEventListener('input', debounce(function(e) {
        buscarProductos(e.target.value);
    }, 300));
}

/**
 * BUSCAR PRODUCTOS
 */
function buscarProductos(termino) {
    if (!termino) {
        mostrarProductos(productos);
        return;
    }
    
    const terminoLower = termino.toLowerCase();
    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(terminoLower) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(terminoLower))
    );
    
    mostrarProductos(filtrados);
}

/**
 * MOSTRAR PREVIEW DE IMAGEN
 */
function mostrarPreviewImagen(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validar tamaño (2MB máx)
    if (file.size > 2 * 1024 * 1024) {
        alert('La imagen no debe superar 2MB');
        e.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        document.getElementById('imagenPreviewImg').src = event.target.result;
        document.getElementById('imagenPreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

/**
 * ABRIR MODAL NUEVO
 */
function abrirModalNuevo() {
    productoEditando = null;
    document.getElementById('modalTitulo').textContent = 'Nuevo Producto';
    document.getElementById('formProducto').reset();
    document.getElementById('productoId').value = '';
    document.getElementById('imagenPreview').style.display = 'none';
    document.getElementById('errorModal').style.display = 'none';
    document.getElementById('modalProducto').classList.add('active');
}

/**
 * EDITAR PRODUCTO
 */
async function editarProducto(id) {
    try {
        const response = await apiGet(`${API_CONFIG.ENDPOINTS.PRODUCTOS}/${id}`);
        
        if (!response.ok || !response.producto) {
            throw new Error('Producto no encontrado');
        }
        
        productoEditando = response.producto;
        
        document.getElementById('modalTitulo').textContent = 'Editar Producto';
        document.getElementById('productoId').value = productoEditando.id_producto;
        document.getElementById('nombre').value = productoEditando.nombre;
        document.getElementById('descripcion').value = productoEditando.descripcion || '';
        document.getElementById('precio').value = productoEditando.precio;
        
        // Mostrar imagen actual si existe
        if (productoEditando.ruta_foto) {
            document.getElementById('imagenPreviewImg').src = productoEditando.ruta_foto;
            document.getElementById('imagenPreview').style.display = 'block';
        } else {
            document.getElementById('imagenPreview').style.display = 'none';
        }
        
        document.getElementById('errorModal').style.display = 'none';
        document.getElementById('modalProducto').classList.add('active');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar producto', 'error');
        handleAuthError(error);
    }
}

/**
 * GUARDAR PRODUCTO
 */
async function guardarProducto(e) {
    e.preventDefault();

    const btnGuardar = document.getElementById('btnGuardar');
    const errorModal = document.getElementById('errorModal');

    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';
    errorModal.style.display = 'none';

    try {
        const id = document.getElementById('productoId').value;

        // Construir FormData (necesario para enviar archivos)
        const formData = new FormData();
        formData.append('nombre', document.getElementById('nombre').value.trim());
        formData.append('descripcion', document.getElementById('descripcion').value.trim() || '');
        formData.append('precio', parseFloat(document.getElementById('precio').value));

        // Adjuntar imagen si el usuario seleccionó una
        const imagenFile = document.getElementById('imagen').files[0];
        if (imagenFile) {
            formData.append('imagen', imagenFile); // 'imagen' debe coincidir con uploadImagen.single("imagen") en el router
        }

        // Obtener el token para la cabecera de autenticación
        const token = localStorage.getItem('token');

        let response;
        if (id) {
            // Editar producto existente
            response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTOS}/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // ⚠️ NO pongas Content-Type aquí; el navegador lo setea solo con el boundary correcto para FormData
                },
                body: formData
            });
        } else {
            // Crear nuevo producto
            response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTOS}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
        }

        const data = await response.json();

        if (data.ok) {
            mostrarToast(id ? 'Producto actualizado' : 'Producto creado', 'success');
            cerrarModal();
            await cargarProductos();
        } else {
            throw new Error(data.msg || 'Error al guardar');
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
 * CONVERTIR IMAGEN A BASE64
 */
function convertirImagenABase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * ELIMINAR PRODUCTO
 */
async function eliminarProducto(id, nombre) {
    if (!confirm(`¿Eliminar producto "${nombre}"?`)) return;
    
    try {
        const response = await apiDelete(`${API_CONFIG.ENDPOINTS.PRODUCTOS}/${id}`);
        
        if (response.ok) {
            mostrarToast('Producto eliminado', 'success');
            await cargarProductos();
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
 * CERRAR MODAL
 */
function cerrarModal() {
    document.getElementById('modalProducto').classList.remove('active');
    document.getElementById('formProducto').reset();
    document.getElementById('imagenPreview').style.display = 'none';
    productoEditando = null;
}
/**
 * GESTIÓN DE PRODUCTOS - PARTE 3: ASIGNACIÓN A PROVEEDORES
 */

/**
 * ABRIR MODAL ASIGNAR PROVEEDORES
 */
async function abrirModalAsignar(id) {
    try {
        const producto = productos.find(p => p.id_producto === id);
        if (!producto) throw new Error('Producto no encontrado');
        
        productoAsignando = producto;
        
        document.getElementById('productoNombreAsignar').textContent = producto.nombre;
        
        // Llenar select de proveedores
        const select = document.getElementById('proveedorSelect');
        select.innerHTML = '<option value="">Seleccionar...</option>';
        proveedores.forEach(p => {
            select.innerHTML += `<option value="${p.id_proveedor}">${p.nombre}</option>`;
        });
        
        // Cargar proveedores asignados
        await cargarProveedoresAsignados(id);
        
        document.getElementById('modalProveedores').classList.add('active');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al abrir modal', 'error');
    }
}

/**
 * CARGAR PROVEEDORES ASIGNADOS
 */
async function cargarProveedoresAsignados(idProducto) {
    const contenedor = document.getElementById('listaProveedoresAsignados');
    
    try {
        const response = await apiGet(API_CONFIG.ENDPOINTS.PRODUCTOS_PROVEEDORES(idProducto));
        
        if (!response.ok || !response.proveedores || response.proveedores.length === 0) {
            contenedor.innerHTML = '<p class="text-secondary">No hay proveedores asignados</p>';
            return;
        }
        
        let html = '<div class="table-container"><table><thead><tr><th>Proveedor</th><th>Precio</th><th>Acciones</th></tr></thead><tbody>';
        
        response.proveedores.forEach(prov => {
            html += `
                <tr>
                    <td><strong>${prov.nombre}</strong></td>
                    <td>${formatearMoneda(prov.precio_proveedor)}</td>
                    <td class="acciones">
                        <button class="btn-icon btn-delete" onclick="desasignarProveedor(${idProducto}, ${prov.id_proveedor}, '${prov.nombre}')" title="Quitar">
                            ❌
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        contenedor.innerHTML = html;
        
    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = '<p class="text-secondary">Error al cargar proveedores</p>';
    }
}

/**
 * ASIGNAR PROVEEDOR
 */
async function asignarProveedor(e) {
    e.preventDefault();
    
    try {
        const idProducto = productoAsignando.id_producto;
        const idProveedor = document.getElementById('proveedorSelect').value;
        const precioProveedor = parseFloat(document.getElementById('precioProveedor').value);
        
        const datos = {
            id_proveedor: parseInt(idProveedor),
            precio_proveedor: precioProveedor
        };
        
        const response = await apiPost(API_CONFIG.ENDPOINTS.PRODUCTOS_PROVEEDORES(idProducto), datos);
        
        if (response.ok) {
            mostrarToast('Proveedor asignado', 'success');
            document.getElementById('formAsignarProveedor').reset();
            await cargarProveedoresAsignados(idProducto);
        } else {
            throw new Error(response.msg);
        }
        
    } catch (error) {
        console.error('Error:', error);
        mostrarToast(error.message || 'Error al asignar proveedor', 'error');
    }
}

/**
 * DESASIGNAR PROVEEDOR
 */
async function desasignarProveedor(idProducto, idProveedor, nombreProveedor) {
    if (!confirm(`¿Quitar "${nombreProveedor}" de este producto?`)) return;
    
    try {
        const response = await apiDelete(`${API_CONFIG.ENDPOINTS.PRODUCTOS}/${idProducto}/proveedores/${idProveedor}`);
        
        if (response.ok) {
            mostrarToast('Proveedor quitado', 'success');
            await cargarProveedoresAsignados(idProducto);
        } else {
            throw new Error(response.msg);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast(error.message || 'Error al quitar proveedor', 'error');
    }
}

/**
 * CERRAR MODAL PROVEEDORES
 */
function cerrarModalProveedores() {
    document.getElementById('modalProveedores').classList.remove('active');
    document.getElementById('formAsignarProveedor').reset();
    productoAsignando = null;
}