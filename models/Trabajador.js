// models/Trabajador.js

// Define la forma que debe tener cada documento de la coleccion "trabajadores".

const mongoose = require("mongoose");

const trabajadorSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
    },

    nombre: {
      type: String,
      required: true,
    },

    oficio: {
      type: String,
      required: true,
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

    precioBase: { type: Number, min: 0, default: null }, // null = "a cotizar"
    unidadPrecio: {
      type: String,
      enum: ["servicio", "hora", "dia"],
      default: "servicio",
    },
    precioNota: { type: String, maxlength: 140, default: "" },
    precioActualizadoEn: { type: Date },
    historialPrecios: [
      {
        precio: { type: Number, default: null },
        unidad: { type: String },
        motivo: { type: String },
        fecha: { type: Date, default: Date.now },
      },
    ],

    fotoUrl: {
      type: String,
    },
  },
  {
    timestamps: true, // agrega createdAt y updatedAt automaticamente
  },
);

module.exports = mongoose.model("Trabajador", trabajadorSchema, "trabajadores");
