// routes/carrito.js
// Carrito persistente de servicios de PRAXO.

const express = require('express');
const router = express.Router();
const Trabajador = require('../models/Trabajador');
const SolicitudServicio = require('../models/SolicitudServicio');
const Solicitud = require('../models/Solicitud'); // 🟢 IMPORTAR EL NUEVO MODELO
const requiereSesion = require('../middlewares/requiereSesion');
const { calcularDesglose } = require('../config/tarifas');

const UNIDADES = { servicio: 'por servicio', hora: 'por hora', dia: 'por día' };

// Precio de referencia del prestador (precio base o tarifa de referencia)
function precioReferencia(trabajador) {
  if (!trabajador) return null;
  if (typeof trabajador.precioBase === 'number' && trabajador.precioBase > 0) {
    return { precio: trabajador.precioBase, unidad: UNIDADES[trabajador.unidadPrecio] || 'por servicio' };
  }
  if (typeof trabajador.tarifaPrecio === 'number' && trabajador.tarifaPrecio > 0) {
    return { precio: trabajador.tarifaPrecio, unidad: trabajador.conceptoPrecio ? 'por ' + trabajador.conceptoPrecio.toLowerCase() : 'por servicio' };
  }
  return null;
}

// Valida y limpia los datos editables de un servicio del carrito
function validarDatosServicio(body) {
  const fecha = limpiarTexto(body.fecha);
  const hora = limpiarTexto(body.hora);
  const ubicacion = limpiarTexto(body.ubicacion);
  const descripcion = limpiarTexto(body.descripcion);
  const referenciasUbicacion = limpiarTexto(body.referenciasUbicacion);

  if (!fecha || !hora || !ubicacion || !descripcion) {
    return { error: 'Completa fecha, hora, ubicación y descripción.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    return { error: 'La fecha u hora no tienen un formato válido.' };
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(f.getTime()) || f < hoy) {
    return { error: 'Elige una fecha de hoy en adelante.' };
  }
  if (ubicacion.length > 150 || descripcion.length > 500 || referenciasUbicacion.length > 250) {
    return { error: 'Algún campo es demasiado largo.' };
  }

  return {
    ok: true,
    datos: {
      fecha, hora, ubicacion, descripcion, referenciasUbicacion,
      urgencia: body.urgencia === 'Urgencia' ? 'Urgencia' : 'Programado',
      requiereCotizacion: body.requiereCotizacion === true || body.requiereCotizacion === 'on'
    }
  };
}

function quiereJson(req) {
  return req.xhr || (req.get('accept') || '').includes('application/json');
}

// ==========================================
// CONFIGURACIÓN DE MULTER
// ==========================================
const multer = require('multer');
const path = require('path');

const crypto = require('crypto');

// 🔒 Solo imágenes, máximo 5 MB. La extensión se decide por el tipo
// detectado, NUNCA por el nombre que manda el usuario (evita subir .html o .js).
const TIPOS_PERMITIDOS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/solicitudes');
  },
  filename: function (req, file, cb) {
    cb(null, 'praxo_foto_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex') + TIPOS_PERMITIDOS[file.mimetype]);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter: function (req, file, cb) {
    if (!TIPOS_PERMITIDOS[file.mimetype]) {
      const err = new Error('Solo se permiten imágenes JPG, PNG o WEBP.');
      err.code = 'TIPO_NO_PERMITIDO';
      return cb(err);
    }
    cb(null, true);
  }
});

// Revisa la "firma" real del archivo (primeros bytes) para confirmar que es imagen
const fs = require('fs');
function esImagenReal(rutaArchivo) {
  try {
    const fd = fs.openSync(rutaArchivo, 'r');
    const b = Buffer.alloc(12);
    fs.readSync(fd, b, 0, 12, 0);
    fs.closeSync(fd);
    const jpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
    const png = b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    const webp = b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP';
    return jpg || png || webp;
  } catch (e) {
    return false;
  }
}

// Envoltura para responder con un mensaje claro si el archivo no es válido
function subirEvidencia(req, res, next) {
  upload.single('imagenEvidencia')(req, res, (err) => {
    if (err) {
      const mensaje = err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen pesa más de 5 MB.'
        : (err.code === 'TIPO_NO_PERMITIDO' ? err.message : 'No se pudo subir la imagen.');
      return res.status(400).send(mensaje);
    }
    if (req.file && !esImagenReal(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).send('El archivo no es una imagen válida.');
    }
    next();
  });
}

// ==========================================
// PROTEGER TODO EL CARRITO
// ==========================================
router.use(requiereSesion);

// ==========================================
// FUNCION AUXILIAR
// ==========================================
function limpiarTexto(valor) {
  if (typeof valor !== 'string') {
    return '';
  }
  return valor.trim();
}

// ==========================================
// MOSTRAR CARRITO
// GET /carrito
// ==========================================
router.get('/', async (req, res) => {
  try {
    const clienteId = req.session.usuario.id;
    const solicitudes = await SolicitudServicio
      .find({ clienteId })
      .populate('trabajadorId', 'precioBase unidadPrecio tarifaPrecio conceptoPrecio')
      .sort({ createdAt: -1 })
      .lean();

    // Resumen desglosado (estimado con el precio de referencia de cada prestador)
    const resumen = { servicios: solicitudes.length, aCotizar: 0, precioPrestador: 0, comision: 0, ivaComision: 0, total: 0 };

    const carrito = solicitudes.map((solicitud) => {
      const ref = precioReferencia(solicitud.trabajadorId);
      const estimado = ref ? calcularDesglose(ref.precio) : null;

      if (estimado) {
        resumen.precioPrestador += estimado.precioPrestador;
        resumen.comision += estimado.comision;
        resumen.ivaComision += estimado.ivaComision;
        resumen.total += estimado.total;
      } else {
        resumen.aCotizar += 1;
      }

      return {
        ...solicitud,
        id: solicitud._id.toString(),
        unidadReferencia: ref ? ref.unidad : null,
        estimado
      };
    });

    res.render('carrito', {
      titulo: 'Mis servicios',
      carrito,
      resumen,
      error: req.query.error || null
    });

  } catch (error) {
    console.error('Error al cargar el carrito:', error);
    res.status(500).send('No se pudieron cargar tus servicios.');
  }
});

// ==========================================
// AGREGAR SERVICIO
// POST /carrito/agregar
// ==========================================
router.post('/agregar', subirEvidencia, async (req, res) => {
  try {
    const {
      trabajadorId,
      fecha,
      hora,
      ubicacion,
      descripcion,
      urgencia,
      referenciasUbicacion,
      requiereCotizacion
    } = req.body;

    const clienteId = req.session.usuario.id;

    if (!trabajadorId) {
      return res.status(400).send('No se recibió el prestador del servicio.');
    }

    const fechaLimpia = limpiarTexto(fecha);
    const horaLimpia = limpiarTexto(hora);
    const ubicacionLimpia = limpiarTexto(ubicacion);
    const descripcionLimpia = limpiarTexto(descripcion);
    const referenciasLimpias = limpiarTexto(referenciasUbicacion);

    if (!fechaLimpia || !horaLimpia || !ubicacionLimpia || !descripcionLimpia) {
      return res.status(400).send('Completa todos los datos obligatorios del servicio.');
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaSeleccionada = new Date(`${fechaLimpia}T00:00:00`);

    if (Number.isNaN(fechaSeleccionada.getTime())) {
      return res.status(400).send('La fecha seleccionada no es válida.');
    }

    if (fechaSeleccionada < hoy) {
      return res.status(400).send('No puedes contratar un servicio para una fecha anterior.');
    }

    const trabajador = await Trabajador.findById(trabajadorId);
    if (!trabajador) {
      return res.status(404).send('El prestador seleccionado no existe.');
    }

    const nombreTrabajador = trabajador.nombre || trabajador.nombreCompleto || 'Profesional PRAXO';
    const nombreServicio = trabajador.oficio || trabajador.servicio || trabajador.categoria || 'Servicio profesional';

    let rutaImagen = null;
    if (req.file) {
      rutaImagen = '/uploads/solicitudes/' + req.file.filename;
    }

    const cotizacionBool = requiereCotizacion === 'on' ? true : false;
    const urgenciaValida = urgencia === 'Urgencia' ? 'Urgencia' : 'Programado';

    await SolicitudServicio.create({
      clienteId,
      trabajadorId: trabajador._id,
      trabajador: nombreTrabajador,
      servicio: nombreServicio,
      fecha: fechaLimpia,
      hora: horaLimpia,
      ubicacion: ubicacionLimpia,
      descripcion: descripcionLimpia,
      ciudad: trabajador.ciudad || '',
      estado: 'Pendiente',
      urgencia: urgenciaValida,
      referenciasUbicacion: referenciasLimpias,
      requiereCotizacion: cotizacionBool,
      imagenEvidencia: rutaImagen
    });

    return res.redirect('/carrito');

  } catch (error) {
    console.error('Error al agregar servicio:', error);
    if (error.name === 'CastError') {
      return res.status(400).send('El prestador seleccionado no es válido.');
    }
    return res.status(500).send('Ocurrió un error al agregar el servicio.');
  }
});

// ==========================================
// EDITAR SERVICIO (desde el carrito, sin recargar)
// POST /carrito/editar/:id   (JSON)
// ==========================================
router.post('/editar/:id', async (req, res) => {
  try {
    const validacion = validarDatosServicio(req.body || {});
    if (!validacion.ok) {
      return res.status(400).json({ mensaje: validacion.error });
    }

    const actualizado = await SolicitudServicio.findOneAndUpdate(
      { _id: req.params.id, clienteId: req.session.usuario.id },
      { $set: validacion.datos },
      { new: true, runValidators: true }
    ).lean();

    if (!actualizado) {
      return res.status(404).json({ mensaje: 'Ese servicio ya no está en tu carrito.' });
    }

    return res.json({ mensaje: 'Servicio actualizado.', servicio: actualizado });

  } catch (error) {
    console.error('Error editando servicio:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ mensaje: 'Servicio no válido.' });
    }
    return res.status(500).json({ mensaje: 'No se pudo actualizar el servicio.' });
  }
});

// ==========================================
// ELIMINAR SERVICIO
// POST /carrito/eliminar/:id
// ==========================================
router.post('/eliminar/:id', async (req, res) => {
  try {
    const clienteId = req.session.usuario.id;
    await SolicitudServicio.findOneAndDelete({
      _id: req.params.id,
      clienteId
    });

    if (quiereJson(req)) {
      const cantidad = await SolicitudServicio.countDocuments({ clienteId });
      return res.json({ ok: true, cantidad });
    }
    return res.redirect('/carrito');
  } catch (error) {
    console.error('Error eliminando servicio:', error);
    return res.status(500).send('No se pudo eliminar el servicio.');
  }
});

// ==========================================
// VACIAR CARRITO
// POST /carrito/vaciar
// ==========================================
router.post('/vaciar', async (req, res) => {
  try {
    const clienteId = req.session.usuario.id;
    await SolicitudServicio.deleteMany({ clienteId });
    return res.redirect('/carrito');
  } catch (error) {
    console.error('Error vaciando carrito:', error);
    return res.status(500).send('No se pudo vaciar el carrito.');
  }
});

// ==========================================
// CANTIDAD DEL CARRITO
// GET /carrito/cantidad
// ==========================================
router.get('/cantidad', async (req, res) => {
  try {
    const clienteId = req.session.usuario.id;
    const cantidad = await SolicitudServicio.countDocuments({ clienteId });
    return res.json({ cantidad });
  } catch (error) {
    console.error('Error contando servicios:', error);
    return res.status(500).json({ cantidad: 0 });
  }
});

// ======================================================
// 🟢 CONFIRMAR CONTRATACIÓN (Ruta de Diagnóstico)
// POST /carrito/confirmar
// ======================================================
router.post('/confirmar', async (req, res) => {
  try {
    console.log("👉 1. Entrando a la ruta de confirmación...");
    const clienteId = req.session.usuario.id;

    // 🔒 El cliente debe aceptar las políticas de compra antes de contratar
    if (req.body.aceptaPoliticas !== 'on') {
      return res.redirect('/carrito?error=politicas');
    }
    
    // 1. Obtener todos los servicios pendientes
    const carrito = await SolicitudServicio.find({ clienteId });
    console.log(`👉 2. Encontramos ${carrito.length} servicios en el carrito.`);
    
    if (!carrito || carrito.length === 0) {
      console.log("👉 2.1 El carrito estaba vacío, redirigiendo...");
      return res.redirect('/carrito');
    }

    // 2. Transferir a Solicitudes definitivas
    for (let item of carrito) {
      console.log(`👉 3. Intentando crear Solicitud para el trabajador: ${item.trabajadorId}`);
      
      const nuevaSolicitud = new Solicitud({
        clienteId: clienteId,
        trabajadorId: item.trabajadorId,
        servicio: item.servicio,
        fecha: item.fecha,
        hora: item.hora,
        ubicacion: item.ubicacion,
        referenciasUbicacion: item.referenciasUbicacion,
        descripcion: item.descripcion,
        urgencia: item.urgencia,
        imagenEvidencia: item.imagenEvidencia,
        requiereCotizacion: item.requiereCotizacion,
        estado: 'Pendiente'
      });
      
      console.log("👉 4. Modelo armado, intentando guardar en MongoDB...");
      await nuevaSolicitud.save();
      console.log("👉 5. ¡Guardado exitoso en colección solicituds!");
    }

    // 3. Vaciar el carrito
    await SolicitudServicio.deleteMany({ clienteId });
    console.log("👉 6. Carrito vaciado correctamente.");

    // 4. Redirigir
    console.log("👉 7. Redirigiendo al inicio...");
    return res.redirect('/inicio-cliente?exito=solicitud_enviada');

  } catch (error) {
    console.error('❌ ERROR GRAVE al procesar la contratación:', error);
    return res.status(500).send('No se pudo procesar la contratación. Intenta de nuevo.');
  }
});

module.exports = router;