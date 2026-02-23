import java.util.Scanner;
public class LoginSystem {
    private Admin admin;
    private int intentosMaximos = 3;
    private Scanner sc;

    public LoginSystem(Admin admin, Scanner sc) {
        this.admin = admin;
        this.sc = sc;
    }

    public boolean iniciarSesion() {
        int intentos = 0;

        System.out.println("--inicio de sesion administrador--");

        while (intentos < intentosMaximos) {
            System.out.println("usuario: ");
            String usuario = sc.nextLine();

            System.out.println("contrasena: ");
            String contrasena = sc.nextLine();

            if (validarCredenciales(usuario, contrasena)) {
                System.out.println("inicio de sesion exitoso \n");
                return true;
            } else {
                intentos++;
                System.out.println("credenciales invalidas intentos restantes:" + (intentosMaximos - intentos));
            }
        }
        System.out.println("ha superado el numero maximo de intentos, acceso denegado ");
        return false;
        
    }
    private boolean validarCredenciales(String usuario, String contrasena) {
        return usuario.equals(admin.getUsuario()) && contrasena.equals(admin.getContraseña());
    }
    
}