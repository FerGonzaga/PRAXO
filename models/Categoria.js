// models/Categoria.js
// Define la forma de cada documento de la coleccion "categorias"
// (las opciones que apareceran en el menu desplegable).

const mongoose = require('mongoose');

const categoriaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true, // ej: "Electricista", "Cerrajero"
  },
  grupo: {
    type: String, // ej: "Hogar y mantenimiento", "Limpieza y cuidado"
  },
  icono: {
    type: String, // nombre o ruta del icono asociado
  },
});

module.exports = mongoose.model('Categoria', categoriaSchema, 'categorias');