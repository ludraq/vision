class Admin:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password


class LoginSystem:
    def __init__(self, admin: Admin):
        self.admin = admin
        self.intentos_maximos = 3

    def iniciar_sesion(self):
        print("\n===== INICIO DE SESIÓN - ADMINISTRADOR =====\n")
        intentos = 0

        while intentos < self.intentos_maximos:
            usuario = input("Usuario: ")
            contraseña = input("Contraseña: ")

            if self.validar_credenciales(usuario, contraseña):
                print("\n✔ Inicio de sesión exitoso.\n")
                return True
            else:
                intentos += 1
                print(f"✘ Credenciales incorrectas. Intentos restantes: {self.intentos_maximos - intentos}\n")

        print("❌ Ha superado el número máximo de intentos. Sistema bloqueado.")
        return False

    def validar_credenciales(self, usuario: str, contraseña: str) -> bool:
        return usuario == self.admin.username and contraseña == self.admin.password


class MainApp:
    def __init__(self):
        # Credenciales de administrador (almacenadas en memoria)
        admin = Admin(username="admin", password="1234")
        self.login_system = LoginSystem(admin)

    def ejecutar(self):
        if self.login_system.iniciar_sesion():
            self.menu_principal()

    def menu_principal(self):
        while True:
            print("======= MENÚ PRINCIPAL =======")
            print("1. Gestión de Usuarios")
            print("2. Gestión de Proveedores")
            print("3. Gestión de Productos")
            print("4. Salir")
            opcion = input("Seleccione una opción: ")

            if opcion == "4":
                print("\nCerrando sistema...")
                break
            else:
                print("\nMódulo en desarrollo...\n")


# Ejecutar programa
if __name__ == "__main__":
    app = MainApp()
    app.ejecutar()
