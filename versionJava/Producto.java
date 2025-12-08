public class Producto {
    int productoId;
    String nombre;
    double precio;
    int stock;
    Integer proveedorId;

    public Producto(int productoId, String nombre, double precio, int stock) {
        this.productoId = productoId;
        this.nombre = nombre;
        this.precio = precio;
        this.stock = stock;
        this.proveedorId = null;
    }

    public String toString() {
        String prov = (proveedorId == null) ? "Sin asignar" : proveedorId.toString();
        return "ID: " + productoId + " - " + nombre +
               " - Precio: $" + precio +
               " - Stock: " + stock +
               " - Proveedor: " + prov;
    }
}
