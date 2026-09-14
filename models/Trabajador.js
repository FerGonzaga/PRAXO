// models/Trabajador.js
// Define la forma que debe tener cada documento de la coleccion "trabajadores".

const mongoose = require('mongoose');

const trabajadorSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
    },
    oficio: {
      type: String,
      required: true, // ej: "Electricista", "Plomero", etc.
    },
    telefono: {
      type: String,
      required: true,
    },
    ciudad: {
      type: String,
      required: true,
    },
    descripcion: {
      type: String,
    },
    calificacionPromedio: {
      type: Number,
      default: 0,
    },
    disponibleAhora: {
      type: Boolean,
      default: false,
    },
    fotoUrl: {
      type: String,
    },
  },
  {
    timestamps: true, // agrega createdAt y updatedAt automaticamente
  }
);

// El tercer argumento fuerza el nombre exacto de la coleccion en MongoDB.
// Sin esto, Mongoose la llamaria "trabajadors" (pluralizacion en ingles),
// distinta a la coleccion "trabajadores" que ya existe en Atlas.
module.exports = mongoose.model('Trabajador', trabajadorSchema, 'trabajadores');