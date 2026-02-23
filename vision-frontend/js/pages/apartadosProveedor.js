const token = window.location.pathname.split("/").pop();

fetch(`/api/proveedor/apartado/${token}`)
  .then(res => res.json())
  .then(data => {
    if (!data.ok) {
      alert(data.msg);
      return;
    }

    if (data.apartado.estado !== "pendiente") {
        document.querySelector("button").disabled = true;
        alert("Este apartado ya fue respondido.");
    }

    document.getElementById("proveedor").textContent =
      `Proveedor: ${data.apartado.proveedor}`;

    const tbody = document.getElementById("tablaProductos");

    data.productos.forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td>${p.producto}</td>
        <td>${p.talla}</td>
        <td>${p.cantidad_solicitada}</td>
        <td>
        <select data-id="${p.id_detalle}">
            <option value="true">Sí</option>
            <option value="false">No</option>
        </select>
        </td>
        <td>
        <input type="number" min="0" value="${p.cantidad_solicitada}">
        </td>
    `;

    const select = tr.querySelector("select");
    const input = tr.querySelector("input");

    select.addEventListener("change", () => {
        if (select.value === "false") {
        input.value = 0;
        input.disabled = true;
        } else {
        input.disabled = false;
        }
    });

    tbody.appendChild(tr);
    });

  });

document.getElementById("formApartado").addEventListener("submit", e => {
  e.preventDefault();

  const productos = [];

  document.querySelectorAll("tbody tr").forEach(row => {
    const select = row.querySelector("select");
    const input = row.querySelector("input");

    productos.push({
      id_detalle: select.dataset.id,
      disponible: select.value === "true",
      cantidad_disponible: Number(input.value)
    });
  });
  
  for (const p of productos) {
    if (p.disponible && p.cantidad_disponible <= 0) {
        alert("Si un producto está disponible, la cantidad debe ser mayor a 0");
        return;
    }
    }

  fetch(`/api/proveedor/apartado/${token}/responder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productos })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.msg);
      if (data.ok) {
        document.querySelector("button").disabled = true;
      }
    });
});
