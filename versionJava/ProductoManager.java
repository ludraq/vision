import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class ProductoManager {

    private List<Producto> productos = new ArrayList<>();
    private int nextId = 1;
    private Scanner sc;
    private GestorProveedores gestorProveedores;

    public ProductoManager(Scanner sc, GestorProveedores gestorProveedores) {
        this.sc = sc;
        this.gestorProveedores = gestorProveedores;
    }

    public Producto buscarPorId(int id) {
        for (Producto p : productos) {
            if (p.productoId == id)
                return p;
        }
        return null;
    }

    public void menuProductos() {
        while (true) {
            System.out.println("""

                    ===== GESTIÓN DE PRODUCTOS =====
                    1. Ver productos
                    2. Crear producto
                    3. Modificar producto
                    4. Eliminar producto
                    5. Asignar a proveedor
                    6. Salir
                    """);

            String opcion = sc.nextLine();

            switch (opcion) {

                // VER
                case "1" -> {
                    if (productos.isEmpty()) {
                        System.out.println("No hay productos registrados.");
                        break;
                    }
                    for (Producto p : productos)
                        System.out.println(p);
                }

                // CREAR
                case "2" -> {
                    System.out.print("Nombre: ");
                    String nombre = sc.nextLine();

                    try {
                        System.out.print("Precio: ");
                        double precio = Double.parseDouble(sc.nextLine());

                        if (precio < 0) {
                            System.out.println("❌ El precio no puede ser negativo.");
                            break;
                        }

                        System.out.print("Stock: ");
                        int stock = Integer.parseInt(sc.nextLine());

                        if (stock < 0) {
                            System.out.println("❌ El stock no puede ser negativo.");
                            break;
                        }

                        productos.add(new Producto(nextId++, nombre, precio, stock));
                        System.out.println("✔ Producto creado.");

                    } catch (Exception e) {
                        System.out.println("❌ Precio o stock inválidos.");
                    }
                }

                // MODIFICAR
                case "3" -> {
                    System.out.print("ID del producto: ");
                    int id = Integer.parseInt(sc.nextLine());

                    Producto p = buscarPorId(id);
                    if (p == null) {
                        System.out.println("❌ Producto no encontrado.");
                        break;
                    }

                    System.out.println("Actual: " + p);

                    System.out.print("Nuevo nombre (enter para mantener): ");
                    String nn = sc.nextLine();
                    if (!nn.isEmpty())
                        p.nombre = nn;

                    System.out.print("Nuevo precio: ");
                    String np = sc.nextLine();
                    if (!np.isEmpty())
                        p.precio = Double.parseDouble(np);

                    System.out.print("Nuevo stock: ");
                    String ns = sc.nextLine();
                    if (!ns.isEmpty())
                        p.stock = Integer.parseInt(ns);

                    System.out.println("✔ Producto modificado.");
                }

                // ELIMINAR
                case "4" -> {
                    System.out.print("ID a eliminar: ");
                    int id = Integer.parseInt(sc.nextLine());

                    Producto p = buscarPorId(id);

                    if (p == null) {
                        System.out.println("❌ No encontrado.");
                        break;
                    }

                    // Eliminar de la lista de proveedor si estaba asignado
                    if (p.proveedorId != null) {
                        Proveedor prov = gestorProveedores.buscarPorId(p.proveedorId);
                        if (prov != null) {
                            prov.productosAsignados.remove((Integer) p.productoId);
                        }
                    }

                    productos.remove(p);
                    System.out.println("✔ Eliminado.");
                }

                // ASIGNAR A PROVEEDOR
                case "5" -> {
                    System.out.print("ID producto: ");
                    int idp = Integer.parseInt(sc.nextLine());

                    Producto p = buscarPorId(idp);

                    if (p == null) {
                        System.out.println("❌ Producto no existe.");
                        break;
                    }

                    System.out.print("ID proveedor: ");
                    int idprov = Integer.parseInt(sc.nextLine());

                    Proveedor proveedor = gestorProveedores.buscarPorId(idprov);
                    if (proveedor == null) {
                        System.out.println("❌ Proveedor no existe.");
                        break;
                    }

                    // Eliminar asignación anterior si existe
                    if (p.proveedorId != null) {
                        Proveedor anterior = gestorProveedores.buscarPorId(p.proveedorId);
                        if (anterior != null) {
                            anterior.productosAsignados.remove((Integer) p.productoId);
                        }
                    }

                    // Asignar al nuevo proveedor
                    p.proveedorId = idprov;
                    if (!proveedor.productosAsignados.contains(p.productoId)) {
                        proveedor.productosAsignados.add(p.productoId);
                    }

                    System.out.println("✔ Producto asignado exitosamente al proveedor: " + proveedor.nombre);
                }

                case "6" -> {
                    System.out.println("Volviendo al menú principal...");
                    return;
                }

                default -> System.out.println("❌ Opción inválida.");
            }
        }
    }
}
