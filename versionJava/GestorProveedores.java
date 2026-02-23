import java.util.*;
import java.util.stream.Collectors;

public class GestorProveedores {
    private List<Proveedor> proveedores = new ArrayList<>();
    private int nextId = 1;
    private int nextOrdenId = 1;
    private ProductoManager productoManager;
    private Scanner sc;

    public GestorProveedores(Scanner sc, ProductoManager productoManager) {
        this.sc = sc;
        this.productoManager = productoManager;
    }

    public Proveedor buscarPorId(int proveedorId) {
        for (Proveedor p : proveedores) {
            if (p.proveedorId == proveedorId)
                return p;
        }
        return null;
    }

    public void setProductoManager(ProductoManager productoManager) {
        this.productoManager = productoManager;
    }

    public void addProveedor() {
        System.out.print("Nombre del proveedor: ");
        String nombre = sc.nextLine().trim();
        System.out.print("Contacto del proveedor: ");
        String contacto = sc.nextLine().trim();

        if (nombre.isEmpty()) {
            System.out.println(" El nombre no puede estar vacío.");
            return;
        }

        for (Proveedor p : proveedores) {
            if (p.nombre.equalsIgnoreCase(nombre)) {
                System.out.println(" Ese proveedor ya existe.");
                return;
            }
        }

        Proveedor nuevo = new Proveedor(nextId++, nombre, contacto);
        proveedores.add(nuevo);
        System.out.println(" Proveedor añadido correctamente con ID: " + nuevo.proveedorId);
    }

    public void verProveedores() {
        if (proveedores.isEmpty()) {
            System.out.println("No hay proveedores registrados.");
            return;
        }
        for (Proveedor p : proveedores) {
            System.out.println(p);
        }
    }

    public void modificarProveedor() {
        try {
            System.out.print("ID del proveedor a modificar: ");
            int id = Integer.parseInt(sc.nextLine());
            Proveedor p = buscarPorId(id);
            if (p == null) {
                System.out.println(" No existe proveedor con ese ID.");
                return;
            }
            System.out.println("Datos actuales: " + p);
            System.out.print("Nuevo nombre (enter para mantener): ");
            String nuevoNombre = sc.nextLine().trim();
            System.out.print("Nuevo contacto (enter para mantener): ");
            String nuevoContacto = sc.nextLine().trim();
            if (!nuevoNombre.isEmpty())
                p.nombre = nuevoNombre;
            if (!nuevoContacto.isEmpty())
                p.contacto = nuevoContacto;
            System.out.println(" Proveedor modificado exitosamente.");
        } catch (NumberFormatException e) {
            System.out.println(" ID inválido.");
        }
    }

    public void eliminarProveedor() {
        try {
            System.out.print("ID del proveedor a eliminar: ");
            int id = Integer.parseInt(sc.nextLine());
            Proveedor p = buscarPorId(id);
            if (p == null) {
                System.out.println(" Ningún proveedor tiene esa ID.");
                return;
            }
            double deuda = p.deudaTotal();
            if (deuda > 0) {
                System.out.println(
                        String.format("  ADVERTENCIA: Este proveedor tiene una deuda pendiente de $%.2f", deuda));
                System.out.print("¿Estás seguro de eliminarlo? (s/n): ");
                String c = sc.nextLine().trim().toLowerCase();
                if (!c.equals("s")) {
                    System.out.println("Eliminación cancelada.");
                    return;
                }
            }
            proveedores.remove(p);
            System.out.println(" Proveedor eliminado correctamente.");
        } catch (NumberFormatException e) {
            System.out.println(" ID inválido.");
        }
    }

    public void asignarProducto() {
        try {
            System.out.print("ID del proveedor: ");
            int pid = Integer.parseInt(sc.nextLine());
            Proveedor p = buscarPorId(pid);
            if (p == null) {
                System.out.println(" Ese proveedor no existe.");
                return;
            }
            System.out.print("ID del producto a asignar: ");
            int prodId = Integer.parseInt(sc.nextLine());
            Producto producto = productoManager.buscarPorId(prodId);
            if (producto == null) {
                System.out.println(" Ese producto no existe.");
                return;
            }
            p.asignarProducto(prodId);
        } catch (NumberFormatException e) {
            System.out.println(" ID de producto inválido.");
        }
    }

    public void crearOrdenCompra() {
        try {
            System.out.print("ID del proveedor: ");
            int pid = Integer.parseInt(sc.nextLine());
            Proveedor p = buscarPorId(pid);
            if (p == null) {
                System.out.println(" Proveedor no registrado.");
                return;
            }
            if (p.productosAsignados.isEmpty()) {
                System.out.println(" Este proveedor no tiene productos asignados.");
                return;
            }
            OrdenCompra nueva = new OrdenCompra(nextOrdenId++, pid);
            System.out.println("\n--- CREAR ORDEN DE COMPRA ---");
            System.out.println("Orden #" + nueva.ordenId);
            System.out.println("\n--- Productos del proveedor ---");
            for (int prodId : p.productosAsignados) {
                Producto prod = productoManager.buscarPorId(prodId);
                if (prod != null) {
                    System.out.println("ID: " + prod.productoId + " - " + prod.nombre + " - Precio: $"
                            + String.format("%.2f", prod.precio));
                }
            }

            while (true) {
                System.out.print("\nID del producto a agregar (0 para finalizar): ");
                int productoId;
                try {
                    productoId = Integer.parseInt(sc.nextLine());
                } catch (NumberFormatException e) {
                    System.out.println(" ID inválido.");
                    continue;
                }
                if (productoId == 0)
                    break;
                if (!p.productosAsignados.contains(productoId)) {
                    System.out.println(" Este producto no está asignado a este proveedor.");
                    continue;
                }
                Producto producto = productoManager.buscarPorId(productoId);
                if (producto == null) {
                    System.out.println(" Producto no encontrado.");
                    continue;
                }
                System.out.println("\nProducto seleccionado: " + producto.nombre);
                System.out.println("Ingresa las tallas y cantidades (escribe 'fin' para terminar con este producto):");
                Map<String, Integer> tallasDict = new LinkedHashMap<>();
                while (true) {
                    System.out.print("  Talla (o 'fin'): ");
                    String talla = sc.nextLine().trim().toUpperCase();
                    if (talla.equalsIgnoreCase("fin"))
                        break;
                    try {
                        System.out.print("  Cantidad de talla " + talla + ": ");
                        int cantidad = Integer.parseInt(sc.nextLine());
                        if (cantidad <= 0) {
                            System.out.println("   La cantidad debe ser mayor a 0.");
                            continue;
                        }
                        tallasDict.put(talla, cantidad);
                    } catch (NumberFormatException e) {
                        System.out.println("   Cantidad inválida.");
                    }
                }
                if (!tallasDict.isEmpty()) {
                    nueva.agregarItem(productoId, producto.nombre, tallasDict, producto.precio);
                    System.out.println(" Producto agregado a la orden.");
                } else {
                    System.out.println(" No se agregaron tallas para este producto.");
                }
            }

            if (!nueva.items.isEmpty()) {
                p.ordenes.add(nueva);
                System.out.println("\n Orden de compra creada exitosamente:");
                System.out.println(nueva);
            } else {
                System.out.println(" No se agregaron productos a la orden. Orden cancelada.");
            }

        } catch (Exception e) {
            System.out.println(" Ocurrió un error: " + e.getMessage());
        }
    }

    public void verOrdenes() {
        try {
            System.out.print("ID del proveedor: ");
            int pid = Integer.parseInt(sc.nextLine());
            Proveedor p = buscarPorId(pid);
            if (p == null) {
                System.out.println(" Proveedor no registrado.");
                return;
            }
            if (p.ordenes.isEmpty()) {
                System.out.println("No hay órdenes registradas para este proveedor.");
                return;
            }
            System.out.println("\n" + "=".repeat(60));
            System.out.println("ÓRDENES DE COMPRA - " + p.nombre);
            System.out.println("=".repeat(60));
            for (OrdenCompra o : p.ordenes) {
                System.out.println(o);
            }
        } catch (NumberFormatException e) {
            System.out.println(" ID inválido.");
        }
    }

    public void registrarPago() {
        try {
            System.out.print("ID del proveedor: ");
            int pid = Integer.parseInt(sc.nextLine());
            Proveedor p = buscarPorId(pid);
            if (p == null) {
                System.out.println(" Proveedor no registrado.");
                return;
            }
            List<OrdenCompra> pendientes = p.ordenes.stream().filter(o -> o.total > o.pagado)
                    .collect(Collectors.toList());
            if (pendientes.isEmpty()) {
                System.out.println(" No hay órdenes con saldo pendiente.");
                return;
            }
            System.out.println("\n--- Órdenes con saldo pendiente ---");
            for (OrdenCompra o : pendientes) {
                System.out.println(String.format("Orden #%d - Total: $%.2f - Pagado: $%.2f - Pendiente: $%.2f",
                        o.ordenId, o.total, o.pagado, (o.total - o.pagado)));
            }
            System.out.print("\nID de la orden a pagar: ");
            int ordenId = Integer.parseInt(sc.nextLine());
            OrdenCompra orden = p.ordenes.stream().filter(o -> o.ordenId == ordenId).findFirst().orElse(null);
            if (orden == null) {
                System.out.println(" Orden no encontrada.");
                return;
            }
            System.out.println("\nOrden #" + orden.ordenId);
            System.out.println(String.format("Total: $%.2f", orden.total));
            System.out.println(String.format("Pagado: $%.2f", orden.pagado));
            System.out.println(String.format("Pendiente: $%.2f", (orden.total - orden.pagado)));
            System.out.print("\nMonto a pagar: ");
            double monto = Double.parseDouble(sc.nextLine());
            if (monto <= 0) {
                System.out.println(" El monto debe ser mayor a 0.");
                return;
            }
            if (orden.registrarPago(monto)) {
                System.out.println(" Pago registrado. Estado: " + orden.estado);
                System.out.println(String.format("Nuevo saldo pendiente: $%.2f", (orden.total - orden.pagado)));
            }
        } catch (NumberFormatException e) {
            System.out.println(" Valores inválidos.");
        }
    }

    public void registrarDevolucion() {
        try {
            System.out.print("ID del proveedor: ");
            int pid = Integer.parseInt(sc.nextLine());
            Proveedor p = buscarPorId(pid);
            if (p == null) {
                System.out.println(" Proveedor no registrado.");
                return;
            }
            double deudaTotal = p.deudaTotal();
            if (deudaTotal <= 0) {
                System.out.println(" Este proveedor no tiene deuda pendiente.");
                return;
            }
            System.out.println(String.format("\nDeuda actual del proveedor: $%.2f", deudaTotal));
            if (p.productosAsignados.isEmpty()) {
                System.out.println(" Este proveedor no tiene productos asignados.");
                return;
            }
            System.out.println("\n--- PRODUCTOS DEL PROVEEDOR ---");
            for (int prodId : p.productosAsignados) {
                Producto pr = productoManager.buscarPorId(prodId);
                if (pr != null) {
                    System.out.println("ID: " + pr.productoId + " - " + pr.nombre + " - Precio: $"
                            + String.format("%.2f", pr.precio));
                }
            }
            System.out.println("\n--- REGISTRAR DEVOLUCIÓN ---");
            System.out.println("Ingresa los productos y cantidades a devolver");
            List<Map<String, Object>> devoluciones = new ArrayList<>();
            double totalDevolucion = 0.0;
            while (true) {
                System.out.print("\nID del producto a devolver (0 para finalizar): ");
                int productoId = Integer.parseInt(sc.nextLine());
                if (productoId == 0)
                    break;
                if (!p.productosAsignados.contains(productoId)) {
                    System.out.println(" Este producto no está asignado a este proveedor.");
                    continue;
                }
                Producto prod = productoManager.buscarPorId(productoId);
                if (prod == null) {
                    System.out.println(" Producto no encontrado.");
                    continue;
                }
                boolean existe = devoluciones.stream().anyMatch(d -> ((int) d.get("producto_id")) == productoId);
                if (existe) {
                    System.out.println(" Este producto ya está en la lista de devolución.");
                    continue;
                }
                System.out.print("Cantidad de '" + prod.nombre + "' a devolver: ");
                int cantidad = Integer.parseInt(sc.nextLine());
                if (cantidad <= 0) {
                    System.out.println(" La cantidad debe ser mayor a 0.");
                    continue;
                }
                double subtotal = cantidad * prod.precio;
                Map<String, Object> dev = new HashMap<>();
                dev.put("producto_id", productoId);
                dev.put("nombre", prod.nombre);
                dev.put("cantidad", cantidad);
                dev.put("precio", prod.precio);
                dev.put("subtotal", subtotal);
                devoluciones.add(dev);
                totalDevolucion += subtotal;
                System.out.println(String.format("✔ Agregado: %d × $%.2f = $%.2f", cantidad, prod.precio, subtotal));
                System.out.println(String.format("Total acumulado: $%.2f", totalDevolucion));
            }

            if (devoluciones.isEmpty()) {
                System.out.println(" No se agregaron productos a la devolución.");
                return;
            }

            if (totalDevolucion > deudaTotal) {
                System.out.println(String.format("\n El monto de la devolución ($%.2f) excede la deuda total ($%.2f).",
                        totalDevolucion, deudaTotal));
                System.out.println("No se puede procesar la devolución.");
                return;
            }

            // Resumen y confirmación
            System.out.println("\n" + "=".repeat(60));
            System.out.println("RESUMEN DE DEVOLUCIÓN");
            System.out.println("=".repeat(60));
            for (Map<String, Object> dev : devoluciones) {
                System.out.println(dev.get("nombre"));
                System.out.println(
                        "  Cantidad: " + dev.get("cantidad") + " × $" + String.format("%.2f", dev.get("precio"))
                                + " = $" + String.format("%.2f", dev.get("subtotal")));
            }
            System.out.println("-".repeat(60));
            System.out.println(String.format("TOTAL A DESCONTAR: $%.2f", totalDevolucion));
            System.out.println("=".repeat(60));
            System.out.print("\n¿Confirmar devolución? (s/n): ");
            String confirmar = sc.nextLine().trim().toLowerCase();
            if (!confirmar.equals("s")) {
                System.out.println("Devolución cancelada.");
                return;
            }

            // Aplicar devolución a órdenes pendientes (de la más antigua a la más reciente)
            double montoRestante = totalDevolucion;
            for (OrdenCompra orden : p.ordenes) {
                if (montoRestante <= 0)
                    break;
                double saldoOrden = orden.total - orden.pagado;
                if (saldoOrden > 0) {
                    double montoAplicado = Math.min(montoRestante, saldoOrden);
                    orden.total -= montoAplicado; // descontar del total de la orden
                    orden.actualizarEstado();
                    montoRestante -= montoAplicado;
                    System.out.println(
                            String.format("  ✔ $%.2f descontados de la Orden #%d", montoAplicado, orden.ordenId));
                }
            }

            double nuevaDeuda = p.deudaTotal();
            System.out.println("\n" + "=".repeat(60));
            System.out.println("✔ DEVOLUCIÓN PROCESADA EXITOSAMENTE");
            System.out.println("=".repeat(60));
            System.out.println(String.format("Total descontado: $%.2f", totalDevolucion));
            System.out.println(String.format("Deuda anterior: $%.2f", deudaTotal));
            System.out.println(String.format("Nueva deuda: $%.2f", nuevaDeuda));
            System.out.println("=".repeat(60));

        } catch (NumberFormatException e) {
            System.out.println(" Valor inválido.");
        } catch (Exception e) {
            System.out.println(" Ocurrió un error: " + e.getMessage());
        }
    }

    public void menuProveedores() {
        while (true) {
            System.out.println("""
                    MENU DE PROVEEDORES
                    1. Añadir proveedor
                    2. Ver proveedores
                    3. Modificar proveedor
                    4. Eliminar proveedor
                    5. Asignar producto a proveedors
                    6. Crear orden de compra
                    7. Ver órdenes de compra
                    8. Registrar pago/abono
                    9. Registrar devolución
                    10. Volver al menú principal""");
            System.out.print("Seleccione una opción: ");
            String opcion = sc.nextLine().trim();
            switch (opcion) {
                case "1" -> addProveedor();
                case "2" -> verProveedores();
                case "3" -> modificarProveedor();
                case "4" -> eliminarProveedor();
                case "5" -> asignarProducto();
                case "6" -> crearOrdenCompra();
                case "7" -> verOrdenes();
                case "8" -> registrarPago();
                case "9" -> registrarDevolucion();
                case "10" -> {
                    return;
                }
                default -> System.out.println("Opción inválida.\n");
            }
        }
    }
}
