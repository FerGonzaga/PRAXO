// config/db.js
// Se encarga unicamente de conectar la aplicacion a MongoDB Atlas usando Mongoose.

const mongoose = require('mongoose');

async function conectarDB() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('No se encontro MONGODB_URI en el archivo .env');
    }

    await mongoose.connect(uri);

    console.log('Conexion exitosa a MongoDB Atlas');
  } catch (error) {
    console.error('Error al conectar con MongoDB Atlas:', error.message);
    // Si la BD no conecta, no tiene sentido seguir corriendo el servidor
    process.exit(1);
  }
}

module.exports = conectarDB;