import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class Usermanager {

    private List<Usuario> usuarios;
    private int nextId;
    private Scanner sc;

    public Usermanager(Scanner sc) {
        this.usuarios = new ArrayList<>();
        this.nextId = 1;
        this.sc = sc;
    }

    public void menuUsuarios() {
        while (true) {
            System.out.println("\n===== GESTIÓN DE USUARIOS =====");
            System.out.println("1. Ver usuarios");
            System.out.println("2. Agregar usuario");
            System.out.println("3. Modificar usuario");
            System.out.println("4. Eliminar usuario");
            System.out.println("5. Volver al menú principal");

            System.out.print("Seleccione una opción: ");
            String opcion = sc.nextLine().trim();

            switch(opcion) {
                case "1" -> verUsuarios();
                case "2" -> agregarUsuario();
                case "3" -> modificarUsuario();
                case "4" -> eliminarUsuario();
                case "5" -> { return; }
                default -> System.out.println(" Opción no válida.");
            }
        }
    }

    
    // CRUD
    

    private void verUsuarios() {
        System.out.println("\n--- LISTA DE USUARIOS ---");

        if (usuarios.isEmpty()) {
            System.out.println("No hay usuarios registrados.");
            return;
        }

        for (Usuario u : usuarios) {
            System.out.println(u);
        }
    }

    private void agregarUsuario() {
        System.out.println("\n--- AGREGAR USUARIO ---");

        System.out.print("Nombre del usuario: ");
        String nombre = sc.nextLine();

        System.out.print("Rol del usuario: ");
        String rol = sc.nextLine();

        Usuario nuevo = new Usuario(nextId, nombre, rol, true);
        usuarios.add(nuevo);
        nextId++;

        System.out.println(" Usuario agregado correctamente.");
    }

    private void modificarUsuario() {
        System.out.println("\n--- MODIFICAR USUARIO ---");

        if (usuarios.isEmpty()) {
            System.out.println("No hay usuarios para modificar.");
            return;
        }

        System.out.print("Ingrese el ID del usuario: ");
        String entrada = sc.nextLine();

        int userId;
        try {
            userId = Integer.parseInt(entrada);
        } catch (NumberFormatException e) {
            System.out.println(" ID inválido.");
            return;
        }

        Usuario usuario = buscarUsuarioPorId(userId);

        if (usuario == null) {
            System.out.println(" Usuario no encontrado.");
            return;
        }

        System.out.println("Datos actuales: " + usuario);

        System.out.print("Nuevo nombre (enter para mantener): ");
        String nuevoNombre = sc.nextLine();

        System.out.print("Nuevo rol (enter para mantener): ");
        String nuevoRol = sc.nextLine();

        System.out.print("¿Activo? (s/n, enter para mantener): ");
        String nuevoEstado = sc.nextLine().trim().toLowerCase();

        if (!nuevoNombre.isEmpty()) usuario.setNombre(nuevoNombre);
        if (!nuevoRol.isEmpty()) usuario.setRol(nuevoRol);

        if (nuevoEstado.equals("s")) usuario.setActivo(true);
        else if (nuevoEstado.equals("n")) usuario.setActivo(false);

        System.out.println(" Usuario modificado correctamente.");
    }

    private void eliminarUsuario() {
        System.out.println("\n--- ELIMINAR USUARIO ---");

        if (usuarios.isEmpty()) {
            System.out.println("No hay usuarios para eliminar.");
            return;
        }

        System.out.print("Ingrese el ID del usuario: ");
        String entrada = sc.nextLine();

        int userId;
        try {
            userId = Integer.parseInt(entrada);
        } catch (NumberFormatException e) {
            System.out.println(" ID inválido.");
            return;
        }

        Usuario usuario = buscarUsuarioPorId(userId);

        if (usuario != null) {
            usuarios.remove(usuario);
            System.out.println(" Usuario eliminado correctamente.");
        } else {
            System.out.println(" Usuario no encontrado.");
        }
    }

    
    //MÉTODO AUXILIAR
    

    private Usuario buscarUsuarioPorId(int id) {
        for (Usuario u : usuarios) {
            if (u.getUserId() == id) {
                return u;
            }
        }
        return null;
    }
}

