import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class OrdenCompra {
    public int ordenId;
    public int proveedorId;
    public String fecha;
    public List<OrderItem> items = new ArrayList<>();
    public double total = 0.0;
    public double pagado = 0.0;
    public String estado = "Pendiente";

    private static final DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public OrdenCompra(int ordenId, int proveedorId) {
        this.ordenId = ordenId;
        this.proveedorId = proveedorId;
        this.fecha = LocalDateTime.now().format(fmt);
    }

    public void agregarItem(int productoId, String nombreProducto, Map<String,Integer> tallasDict, double precioUnitario) {
        OrderItem item = new OrderItem(productoId, nombreProducto, tallasDict, precioUnitario);
        items.add(item);
        total += item.subtotal;
        actualizarEstado();
    }

    public boolean registrarPago(double monto) {
        if (monto > (total - pagado)) {
            System.out.println(String.format(" No puedes pagar más de lo que debes. Pendiente: $%.2f", (total - pagado)));
            return false;
        }
        pagado += monto;
        actualizarEstado();
        return true;
    }

    public void actualizarEstado() {
        if (pagado == 0.0) estado = "Pendiente";
        else if (pagado >= total) estado = "Pagado Total";
        else estado = "Pagado Parcial";
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("\n").append("=".repeat(60)).append("\n");
        sb.append("ORDEN #").append(ordenId).append(" - ").append(fecha).append("\n");
        sb.append("Estado: ").append(estado).append("\n");
        sb.append("=".repeat(60)).append("\n");
        for (OrderItem item : items) {
            sb.append(item.toString()).append("\n");
        }
        sb.append("-".repeat(60)).append("\n");
        sb.append(String.format("Total de la orden: $%.2f\n", total));
        sb.append(String.format("Pagado: $%.2f\n", pagado));
        sb.append(String.format("Pendiente: $%.2f\n", (total - pagado)));
        sb.append("=".repeat(60)).append("\n");
        return sb.toString();
    }
}
