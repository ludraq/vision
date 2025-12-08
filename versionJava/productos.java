import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class productos {

    // ======== Clase Producto ========
    static class Producto {
        int id;
        String nombre;
        double precio;
        int stock;
        Integer proveedorId;

        Producto(int id, String nombre, double precio, int stock) {
            this.id = id;
            this.nombre = nombre;
            this.precio = precio;
            this.stock = stock;
            this.proveedorId = null;
        }

        public String toString() {
            String prov = (proveedorId == null) ? "Sin asignar" : proveedorId.toString();
            return "ID: " + id + " - " + nombre +
                    " - Precio: $" + precio +
                    " - Stock: " + stock +
                    " - Proveedor: " + prov;
        }
    }

    // ======== ProductoManager (principal) ========
    public static void main(String[] args) {

        Scanner sc = new Scanner(System.in);
        List<Producto> productos = new ArrayList<>();
        int nextId = 1;

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

                    Producto p = null;
                    for (Producto x : productos) {
                        if (x.id == id)
                            p = x;
                    }
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

                    Producto p = null;
                    for (Producto x : productos)
                        if (x.id == id)
                            p = x;

                    if (p == null) {
                        System.out.println("❌ No encontrado.");
                        break;
                    }

                    productos.remove(p);
                    System.out.println("✔ Eliminado.");
                }

                // ASIGNAR A PROVEEDOR
                case "5" -> {
                    System.out.print("ID producto: ");
                    int idp = Integer.parseInt(sc.nextLine());

                    Producto p = null;
                    for (Producto x : productos)
                        if (x.id == idp)
                            p = x;

                    if (p == null) {
                        System.out.println("❌ Producto no existe.");
                        break;
                    }

                    System.out.print("ID proveedor: ");
                    int idprov = Integer.parseInt(sc.nextLine());

                    p.proveedorId = idprov;
                    System.out.println(
                            "✔ Asignado (solo marca el ID, el proveedor se gestiona desde el gestor de proveedores).");
                }

                case "6" -> {
                    System.out.println("Saliendo...");
                    return;
                }

                default -> System.out.println("❌ Opción inválida.");
            }
        }
    }
}
