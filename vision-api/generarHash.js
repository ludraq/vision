import bcrypt from "bcrypt";

const generar = async () => {
    const hash = await bcrypt.hash("admin3", 10);
    console.log("Hash generado:", hash);
};

generar();