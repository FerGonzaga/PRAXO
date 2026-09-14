// scripts/seed.js
// Script de un solo uso: inserta los trabajadores de ejemplo en MongoDB Atlas,
// incluyendo su foto guardada como binario (igual que el formulario de registro).
//
// Antes de correrlo: coloca las imagenes referenciadas en "fotoArchivo"
// dentro de public/assets/images/trabajadores/
//
// Como correrlo (desde la raiz del proyecto):
//   node scripts/seed.js

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Trabajador = require('../models/Trabajador');

// Determina el tipo de imagen a partir de la extension del archivo
function obtenerContentType(nombreArchivo) {
  const extension = path.extname(nombreArchivo).toLowerCase();
  const tipos = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return tipos[extension] || 'application/octet-stream';
}

async function seed() {
  try {
    // 1. Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    // 2. Leer el archivo de datos de ejemplo
    const rutaDatos = path.join(__dirname, '../data/trabajadores-ejemplo.json');
    const datos = JSON.parse(fs.readFileSync(rutaDatos, 'utf-8'));

    // 3. Borrar trabajadores existentes (para no duplicar al correr el script varias veces)
    await Trabajador.deleteMany({});
    console.log('Coleccion de trabajadores limpiada');

    // 4. Insertar cada trabajador, cargando su foto como binario si existe el archivo
    const carpetaFotos = path.join(__dirname, '../public/assets/img/trabajadores');

    for (const item of datos) {
      const trabajador = new Trabajador({
        nombre: item.nombre,
        oficio: item.oficio,
        telefono: item.telefono,
        ciudad: item.ciudad,
        descripcion: item.descripcion,
        calificacionPromedio: item.calificacionPromedio,
        disponibleAhora: item.disponibleAhora,
      });

      if (item.fotoArchivo) {
        const rutaFoto = path.join(carpetaFotos, item.fotoArchivo);

        if (fs.existsSync(rutaFoto)) {
          trabajador.fotoData = fs.readFileSync(rutaFoto);
          trabajador.fotoContentType = obtenerContentType(item.fotoArchivo);
        } else {
          console.warn(
            `Aviso: no se encontro la imagen "${item.fotoArchivo}" para ${item.nombre}, se guardara sin foto.`
          );
        }
      }

      await trabajador.save();
      console.log(`Trabajador insertado: ${trabajador.nombre}`);
    }

    console.log(`${datos.length} trabajadores de ejemplo insertados correctamente`);
    process.exit(0);
  } catch (error) {
    console.error('Error al insertar datos de ejemplo:', error.message);
    process.exit(1);
  }
}

seed();