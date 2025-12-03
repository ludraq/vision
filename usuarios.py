class Usuario:
    def __init__(self, user_id: int, nombre: str, rol: str, activo: bool = True):
        self.user_id = user_id
        self.nombre = nombre
        self.rol = rol
        self.activo = activo

    def __str__(self):
        estado = "Activo" if self.activo else "Inactivo"
        return f"ID: {self.user_id} - {self.nombre} - Rol: {self.rol} - Estado: {estado}"


class UserManager:
    def __init__(self):
        self.usuarios = []
        self.next_id = 1  # Generador automático de IDs

    
    
    #         MENÚ USUARIOS
    def menu_usuarios(self):
        while True:
            print("\n===== GESTIÓN DE USUARIOS =====")
            print("1. Ver usuarios")
            print("2. Agregar usuario")
            print("3. Modificar usuario")
            print("4. Eliminar usuario")
            print("5. Volver al menú principal")

            opcion = input("Seleccione una opción: ")

            if opcion == "1":
                self.ver_usuarios()
            elif opcion == "2":
                self.agregar_usuario()
            elif opcion == "3":
                self.modificar_usuario()
            elif opcion == "4":
                self.eliminar_usuario()
            elif opcion == "5":
                break
            else:
                print(" Opción no válida.")

    
    #           CRUD
    

    def ver_usuarios(self):
        print("\n--- LISTA DE USUARIOS ---")
        if not self.usuarios:
            print("No hay usuarios registrados.")
            return

        for usuario in self.usuarios:
            print(usuario)

    def agregar_usuario(self):
        print("\n--- AGREGAR USUARIO ---")
        nombre = input("Nombre del usuario: ")
        rol = input("Rol del usuario: ")

        nuevo = Usuario(self.next_id, nombre, rol, True)
        self.usuarios.append(nuevo)
        self.next_id += 1

        print(" Usuario agregado correctamente.")

    def modificar_usuario(self):
        print("\n--- MODIFICAR USUARIO ---")
        if not self.usuarios:
            print("No hay usuarios para modificar.")
            return

        try:
            user_id = int(input("Ingrese el ID del usuario: "))
        except ValueError:
            print(" ID inválido.")
            return

        usuario = self.buscar_usuario_por_id(user_id)
        if not usuario:
            print(" Usuario no encontrado.")
            return

        print(f"Datos actuales: {usuario}")

        nuevo_nombre = input("Nuevo nombre (enter para mantener): ")
        nuevo_rol = input("Nuevo rol (enter para mantener): ")
        nuevo_estado = input("¿Activo? (s/n, enter para mantener): ")

        if nuevo_nombre:
            usuario.nombre = nuevo_nombre
        if nuevo_rol:
            usuario.rol = nuevo_rol
        if nuevo_estado.lower() == "s":
            usuario.activo = True
        elif nuevo_estado.lower() == "n":
            usuario.activo = False

        print(" Usuario modificado correctamente.")

    def eliminar_usuario(self):
        print("\n--- ELIMINAR USUARIO ---")
        if not self.usuarios:
            print("No hay usuarios para eliminar.")
            return

        try:
            user_id = int(input("Ingrese el ID del usuario a eliminar: "))
        except ValueError:
            print(" ID inválido.")
            return

        usuario = self.buscar_usuario_por_id(user_id)

        if usuario:
            self.usuarios.remove(usuario)
            print(" Usuario eliminado correctamente.")
        else:
            print(" Usuario no encontrado.")

    
    #       MÉTODO AUXILIAR
    
    def buscar_usuario_por_id(self, user_id):
        for usuario in self.usuarios:
            if usuario.user_id == user_id:
                return usuario
        return None


