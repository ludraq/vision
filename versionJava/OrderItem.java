import java.util.LinkedHashMap;
import java.util.Map;

public class OrderItem {
    public int productoId;
    public String nombreProducto;
    public Map<String, Integer> tallas; // talla -> cantidad
    public int cantidadTotal;
    public double precioUnitario;
    public double subtotal;

    public OrderItem(int productoId, String nombreProducto, Map<String, Integer> tallas, double precioUnitario) {
        this.productoId = productoId;
        this.nombreProducto = nombreProducto;
        // creamos copia defensiva
        this.tallas = new LinkedHashMap<>(tallas);
        this.cantidadTotal = tallas.values().stream().mapToInt(Integer::intValue).sum();
        this.precioUnitario = precioUnitario;
        this.subtotal = this.cantidadTotal * this.precioUnitario;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Producto: ").append(nombreProducto).append(" (ID: ").append(productoId).append(")\n");
        sb.append("  Precio unitario: $").append(String.format("%.2f", precioUnitario)).append("\n");
        sb.append("  Tallas y cantidades:\n");
        for (Map.Entry<String, Integer> e : tallas.entrySet()) {
            sb.append("    - ").append(e.getKey()).append(": ").append(e.getValue()).append(" unidades\n");
        }
        sb.append("  Subtotal: $").append(String.format("%.2f", subtotal)).append("\n");
        return sb.toString();
    }
}
