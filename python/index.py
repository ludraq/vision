from login import LoginSystem, Admin
from usuarios import UserManager
from proveedores import GestorProveedores
from productos import ProductoManager

class SistemaVision:
    def __init__(self):
        #hace uso de instancias de otras clases como UserManager, GestorProveedores y ProductoManager
        self.gestor_usuarios = UserManager()
        self.gestor_proveedores = GestorProveedores()
        self.gestor_productos = ProductoManager(self.gestor_proveedores)
        
        # Establecer referencia cruzada (IMPORTANTE)
        self.gestor_proveedores.set_producto_manager(self.gestor_productos)
        
        # Crear el administrador y el sistema de login
        self.admin = Admin(username="admin", password="123")
        self.login_system = LoginSystem(self.admin)

    def menu(self):
        print("\n==== SISTEMA VISIÓN - CONTROL DE NEGOCIO ====")

        if not self.login_system.iniciar_sesion():
            print("Acceso denegado.")
            return

        while True:
            print("""
================= MENÚ PRINCIPAL =================
1. Gestión de Usuarios
2. Gestión de Proveedores
3. Gestión de Productos
4. Salir
""")

            opcion = input("Seleccione: ")

            if opcion == "1":
                self.gestor_usuarios.menu_usuarios()

            elif opcion == "2":
                self.gestor_proveedores.menu_proveedores()

            elif opcion == "3":
                self.gestor_productos.menu_productos()

            elif opcion == "4":
                print("Saliendo...")
                break

            else:
                print("Opción inválida.")


if __name__ == "__main__":
    SistemaVision().menu()
