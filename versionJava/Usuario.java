public class Usuario {

    private int userId;
    private String nombre;
    private String rol;
    private boolean activo;

    public Usuario(int userId, String nombre, String rol, boolean activo) {
        this.userId = userId;
        this.nombre = nombre;
        this.rol = rol;
        this.activo = activo;
    }

    // Getters y setters
    public int getUserId() { return userId; }
    public String getNombre() { return nombre; }
    public String getRol() { return rol; }
    public boolean isActivo() { return activo; }

    public void setNombre(String nombre) { this.nombre = nombre; }
    public void setRol(String rol) { this.rol = rol; }
    public void setActivo(boolean activo) { this.activo = activo; }

    @Override
    public String toString() {
        String estado = activo ? "Activo" : "Inactivo";
        return "ID: " + userId + " - " + nombre + " - Rol: " + rol + " - Estado: " + estado;
    }
}
