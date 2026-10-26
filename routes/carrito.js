// routes/carrito.js
// Carrito persistente de servicios de PRAXO.

const express = require('express');
const router = express.Router();
const Trabajador = require('../models/Trabajador');
const SolicitudServicio = require('../models/SolicitudServicio');
const Solicitud = require('../models/Solicitud'); // 🟢 IMPORTAR EL NUEVO MODELO
const requiereSesion = require('../middlewares/requiereSesion');

// ==========================================
// CONFIGURACIÓN DE MULTER
// ==========================================
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/solicitudes'); 
  },
  filename: function (req, file, cb) {
    cb(null, 'praxo_foto_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

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
      .sort({ createdAt: -1 })
      .lean();

    const carrito = solicitudes.map((solicitud) => ({
      ...solicitud,
      id: solicitud._id.toString()
    }));

    res.render('carrito', {
      titulo: 'Mis servicios',
      carrito
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
router.post('/agregar', upload.single('imagenEvidencia'), async (req, res) => {
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
    return res.status(500).send(`Error en el servidor: ${error.message}`);
  }
});

module.exports = router;