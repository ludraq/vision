public class Admin {
    private String usuario;
    private String contrasena;

    public Admin(String usuario, String contrasena) {
        this.usuario = usuario;
        this.contrasena = contrasena;
    }
    public String getUsuario() {
        return usuario;
    }
    public String getContraseña() {
        return contrasena;
    }
}
