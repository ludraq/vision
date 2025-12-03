class Producto:
    def __init__(self, producto_id: int, nombre: str, precio: float, stock: int):
        self.producto_id = producto_id
        self.nombre = nombre
        self.precio = precio
        self.stock = stock
        self.proveedor_id = None  # Ningún proveedor asignado al inicio

    def __str__(self):
        prov = self.proveedor_id if self.proveedor_id else "Sin asignar"
        return f"ID: {self.producto_id} - {self.nombre} - Precio: ${self.precio:.2f} - Stock: {self.stock} - Proveedor: {prov}"
        

class ProductoManager:
    def __init__(self, proveedor_manager):
        self.productos = []
        self.next_id = 1
        self.proveedor_manager = proveedor_manager  # Para poder asignar productos correctamente

    
    def menu_productos(self):
        while True:
            print("\n===== GESTIÓN DE PRODUCTOS =====")
            print("1. Ver productos")
            print("2. Crear producto")
            print("3. Modificar producto")
            print("4. Eliminar producto")
            print("5. Asignar producto a proveedor")
            print("6. Volver al menú principal")

            opcion = input("Seleccione una opción: ")

            if opcion == "1":
                self.ver_productos()
            elif opcion == "2":
                self.crear_producto()
            elif opcion == "3":
                self.modificar_producto()
            elif opcion == "4":
                self.eliminar_producto()
            elif opcion == "5":
                self.asignar_a_proveedor()
            elif opcion == "6":
                break
            else:
                print(" Opción no válida.")

    
    #CRUD
    
    def ver_productos(self):
        print("\n--- LISTA DE PRODUCTOS ---")
        if not self.productos:
            print("No hay productos registrados.")
            return

        for producto in self.productos:
            print(producto)

    def crear_producto(self):
        print("\n--- CREAR PRODUCTO ---")
        nombre = input("Nombre del producto: ")

        try:
            precio = float(input("Precio: "))
            if precio < 0:
                print(" El precio no puede ser negativo.")
                return
                
            stock = int(input("Stock inicial: "))
            if stock < 0:
                print(" El stock no puede ser negativo.")
                return
        except ValueError:
            print(" Precio o stock inválidos.")
            return

        nuevo = Producto(self.next_id, nombre, precio, stock)
        self.productos.append(nuevo)
        self.next_id += 1

        print(" Producto creado correctamente.")

    def modificar_producto(self):
        print("\n--- MODIFICAR PRODUCTO ---")
        if not self.productos:
            print("No hay productos creados.")
            return

        try:
            producto_id = int(input("ID del producto: "))
        except ValueError:
            print(" ID inválido.")
            return

        producto = self.buscar_por_id(producto_id)
        if not producto:
            print(" Producto no encontrado.")
            return

        print(f"Datos actuales: {producto}")

        nuevo_nombre = input("Nuevo nombre (enter para mantener): ")
        nuevo_precio = input("Nuevo precio (enter para mantener): ")
        nuevo_stock = input("Nuevo stock (enter para mantener): ")

        if nuevo_nombre:
            producto.nombre = nuevo_nombre
        if nuevo_precio:
            try:
                precio = float(nuevo_precio)
                if precio < 0:
                    print(" El precio no puede ser negativo.")
                else:
                    producto.precio = precio
            except:
                print(" Precio inválido.")
        if nuevo_stock:
            try:
                stock = int(nuevo_stock)
                if stock < 0:
                    print(" El stock no puede ser negativo.")
                else:
                    producto.stock = stock
            except:
                print(" Stock inválido.")

        print(" Producto modificado correctamente.")

    def eliminar_producto(self):
        print("\n--- ELIMINAR PRODUCTO ---")

        if not self.productos:
            print("No hay productos registrados.")
            return

        try:
            producto_id = int(input("ID del producto a eliminar: "))
        except ValueError:
            print(" ID inválido.")
            return

        producto = self.buscar_por_id(producto_id)
        if not producto:
            print(" Producto no encontrado.")
            return

        # Si estaba asignado a un proveedor → eliminarlo de la lista
        if producto.proveedor_id:
            proveedor = self.proveedor_manager.buscar_por_id(producto.proveedor_id)
            if proveedor:
                proveedor.productos_asignados.remove(producto.producto_id)

        self.productos.remove(producto)
        print("✔ Producto eliminado correctamente.")

    
    #     ASIGNAR A PROVEEDOR
    
    def asignar_a_proveedor(self):
        print("\n--- ASIGNAR PRODUCTO A PROVEEDOR ---")

        if not self.productos:
            print("No hay productos disponibles.")
            return
        if not self.proveedor_manager.proveedores:
            print("No hay proveedores registrados.")
            return

        try:
            producto_id = int(input("ID del producto: "))
            proveedor_id = int(input("ID del proveedor: "))
        except ValueError:
            print(" ID inválido.")
            return

        producto = self.buscar_por_id(producto_id)
        proveedor = self.proveedor_manager.buscar_por_id(proveedor_id)

        if not producto:
            print(" Producto no encontrado.")
            return
        if not proveedor:
            print(" Proveedor no encontrado.")
            return

        # Quitar asignación anterior si existía
        if producto.proveedor_id:
            proveedor_anterior = self.proveedor_manager.buscar_por_id(producto.proveedor_id)
            if proveedor_anterior:
                proveedor_anterior.productos_asignados.remove(producto.producto_id)

        # Asignar al nuevo proveedor
        producto.proveedor_id = proveedor_id
        proveedor.productos_asignados.append(producto.producto_id)

        print(f" Producto '{producto.nombre}' asignado al proveedor '{proveedor.nombre}'.")

    
    #       MÉTODO AUXILIAR
    
    def buscar_por_id(self, producto_id):
        for p in self.productos:
            if p.producto_id == producto_id:
                return p

        return None
