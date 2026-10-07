// models/SolicitudServicio.js
// Solicitudes de servicios guardadas de forma persistente.

const mongoose = require('mongoose');


const solicitudServicioSchema =
  new mongoose.Schema(

    {

      // Usuario que está contratando
      clienteId: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'Usuario',

        required:
          true,

        index:
          true

      },


      // Prestador seleccionado
      trabajadorId: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'Trabajador',

        required:
          true

      },


      // Guardamos también estos datos
      // para mostrar el servicio fácilmente.

      trabajador: {

        type:
          String,

        required:
          true,

        trim:
          true

      },


      servicio: {

        type:
          String,

        required:
          true,

        trim:
          true

      },


      // Se conserva como YYYY-MM-DD
      // para que sea compatible con tu EJS actual.

      fecha: {

        type:
          String,

        required:
          true

      },


      hora: {

        type:
          String,

        required:
          true

      },


      ubicacion: {

        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          150

      },


      descripcion: {

        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          500

      },


      ciudad: {

        type:
          String,

        default:
          ''

      },


      estado: {

        type:
          String,

        enum: [
          'Pendiente',
          'Confirmado',
          'Cancelado',
          'Completado'
        ],

        default:
          'Pendiente'

      }

    },


    {
      timestamps:
        true
    }

  );


module.exports =
  mongoose.model(
    'SolicitudServicio',
    solicitudServicioSchema
  );