import java.util.ArrayList;
import java.util.List;

public class Proveedor {
    public int proveedorId;
    public String nombre;
    public String contacto;
    public List<Integer> productosAsignados = new ArrayList<>();
    public List<OrdenCompra> ordenes = new ArrayList<>();

    public Proveedor(int proveedorId, String nombre, String contacto) {
        this.proveedorId = proveedorId;
        this.nombre = nombre;
        this.contacto = contacto;
    }

    public void asignarProducto(int productoId) {
        if (!productosAsignados.contains(productoId)) {
            productosAsignados.add(productoId);
            System.out.println(String.format("producto ID %d asignado al proveedor %s", productoId, nombre));
        } else {
            System.out.println("el producto ID " + productoId + " ya esta asignado al proveedor " + nombre);
        }
    }

    public double deudaTotal() {
        return ordenes.stream().mapToDouble(o -> o.total - o.pagado).sum();
    }

    @Override
    public String toString() {
        String prods = productosAsignados.isEmpty() ? "ninguno"
                : String.join(", ", productosAsignados.stream().map(Object::toString).toArray(String[]::new));
        return String.format(
                "\nID: %d | Proveedor: %s\n Contacto: %s \n deuda total: $%.2f\n Productos asignados (%d): %s\n",
                proveedorId, nombre, contacto, deudaTotal(), productosAsignados.size(), prods);
    }
}
