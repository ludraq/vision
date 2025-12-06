from datetime import datetime


#          CLASE ORDEN DE COMPRA


class OrdenCompra:
    def __init__(self, orden_id, proveedor_id, fecha=None):
        self.orden_id = orden_id
        self.proveedor_id = proveedor_id
        self.fecha = fecha or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.items = []  # Lista de items: {producto_id, nombre_producto, tallas: {talla: cantidad}, precio_unitario, subtotal}
        self.total = 0
        self.pagado = 0
        self.estado = "Pendiente"  # Pendiente, Pagado Parcial, Pagado Total
    
    def agregar_item(self, producto_id, nombre_producto, tallas_dict, precio_unitario):
        """
        tallas_dict: {"S": 2, "M": 5, "L": 3} -> Talla: Cantidad
        """
        cantidad_total = sum(tallas_dict.values())
        subtotal = cantidad_total * precio_unitario
        
        item = {
            'producto_id': producto_id,
            'nombre_producto': nombre_producto,
            'tallas': tallas_dict.copy(),
            'cantidad_total': cantidad_total,
            'precio_unitario': precio_unitario,
            'subtotal': subtotal
        }
        
        self.items.append(item)
        self.total += subtotal
        self.actualizar_estado()
    
    def registrar_pago(self, monto):
        #abstrae la complejidad del calculo
        """Registra un pago/abono a la orden"""
        if monto > (self.total - self.pagado):
            print(f" No puedes pagar más de lo que debes. Pendiente: ${self.total - self.pagado:.2f}")
            return False
        
        self.pagado += monto
        self.actualizar_estado() #metodo interno
        return True
    
    def actualizar_estado(self):
        #logica compleja oculta al usuario
        """Actualiza el estado de la orden según el monto pagado"""
        if self.pagado == 0:
            self.estado = "Pendiente"
        elif self.pagado >= self.total:
            self.estado = "Pagado Total"
        else:
            self.estado = "Pagado Parcial"
    
    def __str__(self):
        resultado = f"\n{'='*60}\n"
        resultado += f"ORDEN #{self.orden_id} - {self.fecha}\n"
        resultado += f"Estado: {self.estado}\n"
        resultado += f"{'='*60}\n"
        
        for item in self.items:
            resultado += f"\nProducto: {item['nombre_producto']} (ID: {item['producto_id']})\n"
            resultado += f"  Precio unitario: ${item['precio_unitario']:.2f}\n"
            resultado += f"  Tallas y cantidades:\n"
            for talla, cantidad in item['tallas'].items():
                resultado += f"    - {talla}: {cantidad} unidades\n"
            resultado += f"  Subtotal: ${item['subtotal']:.2f}\n"
        
        resultado += f"\n{'-'*60}\n"
        resultado += f"Total de la orden: ${self.total:.2f}\n"
        resultado += f"Pagado: ${self.pagado:.2f}\n"
        resultado += f"Pendiente: ${self.total - self.pagado:.2f}\n"
        resultado += f"{'='*60}\n"
        
        return resultado



#               CLASE PROVEEDOR


class Proveedor:
    def __init__(self, proveedor_id, nombre, contacto):
        self.proveedor_id = proveedor_id #atributos privados
        self.nombre = nombre
        self.contacto = contacto
        self.productos_asignados = [] #lista interna protegida
        self.ordenes = []

    def __str__(self):
        deuda_total = sum(orden.total - orden.pagado for orden in self.ordenes)
        return (f"\nID: {self.proveedor_id} | Proveedor: {self.nombre}\n"
                f"Contacto: {self.contacto}\n"
                f"Deuda total: ${deuda_total:.2f}\n"
                f"Órdenes activas: {len(self.ordenes)}\n"
                f"Productos asignados: {', '.join(map(str, self.productos_asignados)) if self.productos_asignados else 'Ninguno'}\n")

    def asignar_producto(self, producto_id): #metodo publico
        if producto_id not in self.productos_asignados:
            self.productos_asignados.append(producto_id)
            print(f"\n✔ Producto ID {producto_id} asignado al proveedor {self.nombre}.")
        else:
            print(f" El producto ID {producto_id} ya está asignado a este proveedor.")




#           GESTOR DE PROVEEDORES

class GestorProveedores:
    def __init__(self):
        self.proveedores = []   
        self.next_id = 1
        self.next_orden_id = 1
        self.producto_manager = None

    def set_producto_manager(self, producto_manager):
        self.producto_manager = producto_manager

    def buscar_por_id(self, proveedor_id):
        for p in self.proveedores:
            if p.proveedor_id == proveedor_id:
                return p
        return None
    
    # -----------------------
    def añadir_proveedor(self):
        nombre = input("Nombre del proveedor: ").strip()
        contacto = input("Contacto del proveedor: ").strip()

        if not nombre:
            print(" El nombre no puede estar vacío.")
            return

        for p in self.proveedores:
            if p.nombre.lower() == nombre.lower():
                print(" Ese proveedor ya existe.")
                return

        nuevo_proveedor = Proveedor(self.next_id, nombre, contacto)
        self.proveedores.append(nuevo_proveedor)
        self.next_id += 1
        print(f"✔ Proveedor añadido correctamente con ID: {nuevo_proveedor.proveedor_id}")

    # -----------------------
    def ver_proveedores(self):
        if not self.proveedores:
            print("No hay proveedores registrados.")
            return

        for proveedor in self.proveedores:
            print(proveedor)

    # -----------------------
    def modificar_proveedor(self):
        try:
            proveedor_id = int(input("ID del proveedor a modificar: "))
        except ValueError:
            print(" ID inválido.")
            return
        
        proveedor = self.buscar_por_id(proveedor_id)
        if not proveedor:
            print(" No existe proveedor con ese ID.")
            return
        
        print(f"Datos actuales: {proveedor}")
        nuevo_nombre = input("Nuevo nombre (enter para mantener): ").strip()
        nuevo_contacto = input("Nuevo contacto (enter para mantener): ").strip()
        
        if nuevo_nombre: 
            proveedor.nombre = nuevo_nombre
        if nuevo_contacto:
            proveedor.contacto = nuevo_contacto
            
        print("✔ Proveedor modificado exitosamente.")
        
    # -----------------------
    def eliminar_proveedor(self):
        try: 
            proveedor_id = int(input("ID del proveedor a eliminar: "))
        except ValueError:
            print(" ID inválido.")
            return
        
        proveedor = self.buscar_por_id(proveedor_id)
        if not proveedor:
            print(" Ningún proveedor tiene esa ID.")
            return
        
        deuda_total = sum(orden.total - orden.pagado for orden in proveedor.ordenes)
        if deuda_total > 0:
            print(f"  ADVERTENCIA: Este proveedor tiene una deuda pendiente de ${deuda_total:.2f}")
            confirmar = input("¿Estás seguro de eliminarlo? (s/n): ").lower()
            if confirmar != 's':
                print("Eliminación cancelada.")
                return
        
        self.proveedores.remove(proveedor)
        print("✔ Proveedor eliminado correctamente.")

    # -----------------------
    def asignar_producto(self):
        try:
            proveedor_id = int(input("ID del proveedor: "))
        except ValueError:
            print(" ID inválido.")
            return

        proveedor = self.buscar_por_id(proveedor_id)
        if not proveedor:
            print(" Ese proveedor no existe.")
            return

        try:
            producto_id = int(input("ID del producto a asignar: "))
        except ValueError:
            print(" ID de producto inválido.")
            return
        
        if self.producto_manager:
            producto = self.producto_manager.buscar_por_id(producto_id)
            if not producto:
                print(" Ese producto no existe.")
                return
            
            proveedor.asignar_producto(producto_id)
    
    # -----------------------
    def crear_orden_compra(self):
        try:
            proveedor_id = int(input("ID del proveedor: "))
        except ValueError:
            print(" ID inválido.")
            return

        proveedor = self.buscar_por_id(proveedor_id)
        if not proveedor:
            print(" Proveedor no registrado.")
            return

        if not proveedor.productos_asignados:
            print(" Este proveedor no tiene productos asignados.")
            return
        
        # Crear nueva orden
        nueva_orden = OrdenCompra(self.next_orden_id, proveedor_id)
        self.next_orden_id += 1
        
        print("\n--- CREAR ORDEN DE COMPRA ---")
        print(f"Orden #{nueva_orden.orden_id}")
        
        # Mostrar productos disponibles
        print("\n--- Productos del proveedor ---")
        if self.producto_manager:
            for prod_id in proveedor.productos_asignados:
                producto = self.producto_manager.buscar_por_id(prod_id)
                if producto:
                    print(f"ID: {producto.producto_id} - {producto.nombre} - Precio: ${producto.precio:.2f}")
        
        while True:
            try:
                producto_id = int(input("\nID del producto a agregar (0 para finalizar): "))
                if producto_id == 0:
                    break
                    
                if producto_id not in proveedor.productos_asignados:
                    print(" Este producto no está asignado a este proveedor.")
                    continue
                
                if self.producto_manager:
                    producto = self.producto_manager.buscar_por_id(producto_id)
                    if not producto:
                        print(" Producto no encontrado.")
                        continue
                    
                    print(f"\nProducto seleccionado: {producto.nombre}")
                    print("Ingresa las tallas y cantidades (escribe 'fin' para terminar con este producto):")
                    
                    tallas_dict = {}
                    while True:
                        talla = input("  Talla (o 'fin'): ").strip().upper()
                        if talla == 'FIN':
                            break
                        
                        try:
                            cantidad = int(input(f"  Cantidad de talla {talla}: "))
                            if cantidad <= 0:
                                print("   La cantidad debe ser mayor a 0.")
                                continue
                            tallas_dict[talla] = cantidad
                        except ValueError:
                            print("   Cantidad inválida.")
                    
                    if tallas_dict:
                        nueva_orden.agregar_item(producto_id, producto.nombre, tallas_dict, producto.precio)
                        print(f" Producto agregado a la orden.")
                    else:
                        print(" No se agregaron tallas para este producto.")
                        
            except ValueError:
                print(" ID inválido.")
        
        if nueva_orden.items:
            proveedor.ordenes.append(nueva_orden)
            print("\n✔ Orden de compra creada exitosamente:")
            print(nueva_orden)
        else:
            print(" No se agregaron productos a la orden. Orden cancelada.")

    # -----------------------
    def ver_ordenes(self):
        try:
            proveedor_id = int(input("ID del proveedor: "))
        except ValueError:
            print(" ID inválido.")
            return

        proveedor = self.buscar_por_id(proveedor_id)
        if not proveedor:
            print(" Proveedor no registrado.")
            return
        
        if not proveedor.ordenes:
            print("No hay órdenes registradas para este proveedor.")
            return
        
        print(f"\n{'='*60}")
        print(f"ÓRDENES DE COMPRA - {proveedor.nombre}")
        print(f"{'='*60}")
        
        for orden in proveedor.ordenes:
            print(orden)

    # -----------------------
    def registrar_pago(self):
        try:
            proveedor_id = int(input("ID del proveedor: "))
        except ValueError:
            print(" ID inválido.")
            return

        proveedor = self.buscar_por_id(proveedor_id)
        if not proveedor:
            print(" Proveedor no registrado.")
            return
        
        if not proveedor.ordenes:
            print(" No hay órdenes para este proveedor.")
            return
        
        # Mostrar órdenes con saldo pendiente
        ordenes_pendientes = [o for o in proveedor.ordenes if o.total > o.pagado]
        if not ordenes_pendientes:
            print(" No hay órdenes con saldo pendiente.")
            return
        
        print("\n--- Órdenes con saldo pendiente ---")
        for orden in ordenes_pendientes:
            print(f"Orden #{orden.orden_id} - Total: ${orden.total:.2f} - Pagado: ${orden.pagado:.2f} - Pendiente: ${orden.total - orden.pagado:.2f}")
        
        try:
            orden_id = int(input("\nID de la orden a pagar: "))
            orden = next((o for o in proveedor.ordenes if o.orden_id == orden_id), None)
            
            if not orden:
                print(" Orden no encontrada.")
                return
            
            print(f"\nOrden #{orden.orden_id}")
            print(f"Total: ${orden.total:.2f}")
            print(f"Pagado: ${orden.pagado:.2f}")
            print(f"Pendiente: ${orden.total - orden.pagado:.2f}")
            
            monto = float(input("\nMonto a pagar: "))
            
            if monto <= 0:
                print(" El monto debe ser mayor a 0.")
                return
            
            if orden.registrar_pago(monto):
                print(f"✔ Pago registrado. Estado: {orden.estado}")
                print(f"Nuevo saldo pendiente: ${orden.total - orden.pagado:.2f}")
                
        except ValueError:
            print(" Valores inválidos.")

    # -----------------------
    def registrar_devolucion(self):
        try:
            proveedor_id = int(input("ID del proveedor: "))
        except ValueError:
            print(" ID inválido.")
            return

        proveedor = self.buscar_por_id(proveedor_id)
        if not proveedor:
            print(" Proveedor no registrado.")
            return
        
        # Calcular deuda total del proveedor
        deuda_total = sum(orden.total - orden.pagado for orden in proveedor.ordenes)
        
        if deuda_total <= 0:
            print("✔ Este proveedor no tiene deuda pendiente.")
            return
        
        print(f"\nDeuda actual del proveedor: ${deuda_total:.2f}")
        
        # Mostrar productos asignados al proveedor
        if not proveedor.productos_asignados:
            print(" Este proveedor no tiene productos asignados.")
            return
        
        print("\n--- PRODUCTOS DEL PROVEEDOR ---")
        if self.producto_manager:
            for prod_id in proveedor.productos_asignados:
                producto = self.producto_manager.buscar_por_id(prod_id)
                if producto:
                    print(f"ID: {producto.producto_id} - {producto.nombre} - Precio: ${producto.precio:.2f}")
        
        print("\n--- REGISTRAR DEVOLUCIÓN ---")
        print("Ingresa los productos y cantidades a devolver")
        
        devoluciones = []  # Lista de {producto_id, nombre, cantidad, precio, subtotal}
        total_devolucion = 0
        
        while True:
            try:
                producto_id = int(input("\nID del producto a devolver (0 para finalizar): "))
                if producto_id == 0:
                    break
                
                if producto_id not in proveedor.productos_asignados:
                    print(" Este producto no está asignado a este proveedor.")
                    continue
                
                if self.producto_manager:
                    producto = self.producto_manager.buscar_por_id(producto_id)
                    if not producto:
                        print(" Producto no encontrado.")
                        continue
                    
                    # Ya existe en la lista de devoluciones?
                    existe = False
                    for dev in devoluciones:
                        if dev['producto_id'] == producto_id:
                            print(f" Este producto ya está en la lista de devolución.")
                            existe = True
                            break
                    
                    if existe:
                        continue
                    
                    cantidad = int(input(f"Cantidad de '{producto.nombre}' a devolver: "))
                    
                    if cantidad <= 0:
                        print(" La cantidad debe ser mayor a 0.")
                        continue
                    
                    subtotal = cantidad * producto.precio
                    
                    devoluciones.append({
                        'producto_id': producto_id,
                        'nombre': producto.nombre,
                        'cantidad': cantidad,
                        'precio': producto.precio,
                        'subtotal': subtotal
                    })
                    
                    total_devolucion += subtotal
                    print(f"✔ Agregado: {cantidad} × ${producto.precio:.2f} = ${subtotal:.2f}")
                    print(f"Total acumulado: ${total_devolucion:.2f}")
                    
            except ValueError:
                print(" Valor inválido.")
        
        if not devoluciones:
            print(" No se agregaron productos a la devolución.")
            return
        
        # Verificar que el monto de devolución no exceda la deuda
        if total_devolucion > deuda_total:
            print(f"\n El monto de la devolución (${total_devolucion:.2f}) excede la deuda total (${deuda_total:.2f}).")
            print("No se puede procesar la devolución.")
            return
        
        # Mostrar resumen
        print("\n" + "="*60)
        print("RESUMEN DE DEVOLUCIÓN")
        print("="*60)
        for dev in devoluciones:
            print(f"{dev['nombre']}")
            print(f"  Cantidad: {dev['cantidad']} × ${dev['precio']:.2f} = ${dev['subtotal']:.2f}")
        print("-"*60)
        print(f"TOTAL A DESCONTAR: ${total_devolucion:.2f}")
        print("="*60)
        
        confirmar = input("\n¿Confirmar devolución? (s/n): ").lower()
        if confirmar != 's':
            print("Devolución cancelada.")
            return
        
        # Aplicar la devolución a las órdenes con saldo pendiente
        monto_restante = total_devolucion
        
        for orden in proveedor.ordenes:
            if monto_restante <= 0:
                break
            
            saldo_orden = orden.total - orden.pagado
            if saldo_orden > 0:
                # Aplicar lo que se pueda a esta orden
                monto_aplicado = min(monto_restante, saldo_orden)
                orden.total -= monto_aplicado
                orden.actualizar_estado()
                monto_restante -= monto_aplicado
                
                print(f"  ✔ ${monto_aplicado:.2f} descontados de la Orden #{orden.orden_id}")
        
        nueva_deuda = sum(orden.total - orden.pagado for orden in proveedor.ordenes)
        
        print(f"\n{'='*60}")
        print(" DEVOLUCIÓN PROCESADA EXITOSAMENTE")
        print(f"{'='*60}")
        print(f"Total descontado: ${total_devolucion:.2f}")
        print(f"Deuda anterior: ${deuda_total:.2f}")
        print(f"Nueva deuda: ${nueva_deuda:.2f}")
        print(f"{'='*60}")

    # -----------------------
    def menu_proveedores(self):
        while True:
            print("""
========================================
            MENÚ DE PROVEEDORES
========================================
1. Añadir proveedor
2. Ver proveedores
3. Modificar proveedor
4. Eliminar proveedor
5. Asignar producto a proveedor
6. Crear orden de compra
7. Ver órdenes de compra
8. Registrar pago/abono
9. Registrar devolución
10. Volver al menú principal
""")

            opcion = input("Seleccione una opción: ")

            if opcion == "1":
                self.añadir_proveedor()
            elif opcion == "2":
                self.ver_proveedores()
            elif opcion == "3":
                self.modificar_proveedor()
            elif opcion == "4":
                self.eliminar_proveedor()
            elif opcion == "5":
                self.asignar_producto()
            elif opcion == "6":
                self.crear_orden_compra()
            elif opcion == "7":
                self.ver_ordenes()
            elif opcion == "8":
                self.registrar_pago()
            elif opcion == "9":
                self.registrar_devolucion()
            elif opcion == "10":
                break
            else:

                print("Opción inválida.\n")
