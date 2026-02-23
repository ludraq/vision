import java.util.Scanner;

public class Main {

    private LoginSystem loginsystem;
    private Usermanager usermanager;
    private ProductoManager productoManager;
    private GestorProveedores gestorProveedores;
    private Scanner sc;

    public Main() {
        this.sc = new Scanner(System.in);
        Admin admin = new Admin("admin", "123");
        this.loginsystem = new LoginSystem(admin, sc);
        this.usermanager = new Usermanager(sc);

        // Crear primero GestorProveedores sin ProductoManager
        this.gestorProveedores = new GestorProveedores(sc, null);

        // Crear ProductoManager con la MISMA instancia de GestorProveedores
        this.productoManager = new ProductoManager(sc, gestorProveedores);

        // Ahora actualizar la referencia de ProductoManager en GestorProveedores
        // usando reflexión o un setter (necesitamos agregar un setter)
        this.gestorProveedores.setProductoManager(productoManager);
    }

    public void ejecutar() {
        try {
            if (loginsystem.iniciarSesion()) {
                menuPrincipal();
            }
        } finally {
            // Cerrar el Scanner al terminar
            sc.close();
            System.out.println("Sistema cerrado correctamente.");
        }
    }

    private void menuPrincipal() {
        while (true) {
            System.out.println("\n===== MENU PRINCIPAL =====");
            System.out.println("Ingresa una opción:");
            System.out.println("1. Gestor de usuarios");
            System.out.println("2. Gestión de proveedores");
            System.out.println("3. Gestión de productos");
            System.out.println("4. Salir");
            System.out.print("Opción: ");

            String opcionStr = sc.nextLine().trim();
            int opcion;

            try {
                opcion = Integer.parseInt(opcionStr);
            } catch (NumberFormatException e) {
                System.out.println("Por favor ingresa un número válido.");
                continue;
            }

            switch (opcion) {
                case 1:
                    System.out.println("\n=== Has seleccionado Gestor de Usuarios ===");
                    usermanager.menuUsuarios();
                    break;
                case 2:
                    System.out.println("\n=== Has seleccionado Gestor de Proveedores ===");
                    gestorProveedores.menuProveedores();
                    break;
                case 3:
                    System.out.println("\n=== Has seleccionado Gestor de Productos ===");
                    productoManager.menuProductos();
                    break;
                case 4:
                    System.out.println("Saliendo del programa...");
                    return;
                default:
                    System.out.println("Ingresa una opción válida (1-4)");
            }
        }
    }

    public static void main(String[] args) {
        Main main = new Main();
        main.ejecutar();
    }
}
