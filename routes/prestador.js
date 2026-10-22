// routes/prestador.js
// Rutas exclusivas de prestadores. Se montan en app.js como: app.use('/prestador', ...)
//
// IMPORTANTE: en app.js deben montarse DESPUES de express-session y del
// middleware de variables globales (usuarioActual). Si se montan antes,
// req.session no existe y todas estas rutas fallan.
//
// PRECIO BASE DEL PERFIL
//   GET  /prestador/precio                    -> pagina para ver y editar el precio base
//   POST /prestador/precio                    -> guarda el precio (JSON) y lo anota en el historial
//
// SOLICITUDES RECIBIDAS Y PRECIO DE CADA TRABAJO
//   GET  /prestador/solicitudes               -> trabajos que los clientes le pidieron
//   POST /prestador/solicitudes/:id/precio    -> propone o ajusta el precio de un trabajo (JSON)

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Trabajador = require('../models/Trabajador');
const SolicitudServicio = require('../models/SolicitudServicio');
const Usuario = require('../models/Usuarios_Praxo');

const UNIDADES = ['servicio', 'hora', 'dia'];
const PRECIO_MAXIMO = 1000000;
const MAX_TEXTO = 140;
const MAX_HISTORIAL = 20;            // cambios del precio base que se conservan
const MAX_HISTORIAL_SOLICITUD = 30;  // movimientos de precio por solicitud


// -----------------------------------------------------------
// ACCESO: solo prestadores con sesion iniciada.
// Es autocontenido (no depende de otros archivos de middlewares).
// -----------------------------------------------------------
function requierePrestador(req, res, next) {

  const usuario = req.session && req.session.usuario;
  const esPagina = req.method === 'GET';

  if (!usuario) {
    return esPagina
      ? res.redirect('/login')
      : res.status(401).json({ mensaje: 'Inicia sesión para continuar.' });
  }

  if (usuario.tipoUsuario !== 'prestador') {
    return esPagina
      ? res.status(403).send('Esta página es solo para prestadores de servicios.')
      : res.status(403).json({ mensaje: 'Solo los prestadores pueden hacer esto.' });
  }

  next();

}

router.use(requierePrestador);


// -----------------------------------------------------------
// PUNTO UNICO DE AJUSTE:
// obtiene el id del usuario con sesion iniciada. Si tu login guarda
// el id con otro nombre, cambia solo esta funcion.
// -----------------------------------------------------------
function obtenerUsuarioId(req) {
  const u = req.session && req.session.usuario;
  return u ? (u.id || u._id || null) : null;
}

// El perfil se busca SIEMPRE por el usuario de la sesion, nunca por un id
// que mande el navegador: asi un prestador no puede tocar datos de otro.
async function buscarPerfil(req) {
  const usuarioId = obtenerUsuarioId(req);
  if (!usuarioId) {
    return null;
  }
  return Trabajador.findOne({ usuarioId });
}

// Valida un precio escrito por el usuario. Devuelve { ok, valor }.
function leerPrecio(valorCrudo) {

  const texto = String(
    valorCrudo === undefined || valorCrudo === null ? '' : valorCrudo
  ).trim();

  const valor = Number(texto);

  if (texto === '' || !Number.isFinite(valor) || valor <= 0 || valor > PRECIO_MAXIMO) {
    return { ok: false };
  }

  // Se guarda con 2 decimales
  return { ok: true, valor: Math.round(valor * 100) / 100 };

}

function modeloTieneCamposDePrecio() {
  return Boolean(
    SolicitudServicio.schema &&
    SolicitudServicio.schema.path('precioPropuesto') &&
    SolicitudServicio.schema.path('estadoPrecio') &&
    SolicitudServicio.schema.path('historialPrecio')
  );
}


// ===========================================================
// PRECIO BASE DEL PERFIL
// ===========================================================

// GET /prestador/precio
router.get('/precio', async (req, res) => {

  try {

    const trabajador = await buscarPerfil(req);

    if (!trabajador) {
      return res.status(404).send('No se encontró tu perfil de prestador.');
    }

    // Los cambios mas recientes primero
    const historial = [...(trabajador.historialPrecios || [])]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 10);

    return res.render('prestador-precio', {
      titulo: 'Mi precio',
      trabajador,
      historial
    });

  } catch (error) {

    console.error('Error al cargar la pagina de precio:', error);
    return res.status(500).send('Ocurrió un error al cargar tu precio.');

  }

});


// POST /prestador/precio
router.post('/precio', async (req, res) => {

  try {

    const { precio, unidad, nota, motivo, sinPrecio } = req.body;

    if (!UNIDADES.includes(unidad)) {
      return res.status(400).json({ mensaje: 'Elige una unidad de cobro válida.' });
    }

    let nuevoPrecio = null; // null = "a cotizar"

    if (sinPrecio !== true) {

      const lectura = leerPrecio(precio);

      if (!lectura.ok) {
        return res.status(400).json({
          mensaje: 'Ingresa un precio mayor a 0 (máximo $1,000,000).'
        });
      }

      nuevoPrecio = lectura.valor;

    }

    const notaLimpia = String(nota || '').trim().slice(0, MAX_TEXTO);
    const motivoLimpio = String(motivo || '').trim().slice(0, MAX_TEXTO);

    const trabajador = await buscarPerfil(req);

    if (!trabajador) {
      return res.status(404).json({ mensaje: 'No se encontró tu perfil de prestador.' });
    }

    // Si todavia no se agregaron los campos de precio al modelo Trabajador,
    // se avisa con claridad en vez de fallar con un error confuso.
    if (!Array.isArray(trabajador.historialPrecios)) {
      console.error('Falta agregar los campos de precio al modelo Trabajador.');
      return res.status(500).json({
        mensaje: 'Falta actualizar el modelo Trabajador (campos de precio).'
      });
    }

    const eraPrimerPrecio =
      trabajador.precioBase === null || trabajador.precioBase === undefined;

    const cambioElPrecio =
      trabajador.precioBase !== nuevoPrecio ||
      trabajador.unidadPrecio !== unidad;

    trabajador.precioBase = nuevoPrecio;
    trabajador.unidadPrecio = unidad;
    trabajador.precioNota = notaLimpia;

    if (cambioElPrecio) {

      const fecha = new Date();

      trabajador.precioActualizadoEn = fecha;

      trabajador.historialPrecios.push({
        precio: nuevoPrecio,
        unidad,
        motivo: motivoLimpio || (eraPrimerPrecio ? 'Precio inicial' : 'Actualización de precio'),
        fecha
      });

      if (trabajador.historialPrecios.length > MAX_HISTORIAL) {
        trabajador.historialPrecios = trabajador.historialPrecios.slice(-MAX_HISTORIAL);
      }

    }

    await trabajador.save();

    return res.json({
      mensaje: cambioElPrecio
        ? 'Precio actualizado. Tus clientes ya lo ven en tu perfil.'
        : 'Se guardaron tus cambios.',
      precio: trabajador.precioBase,
      unidad: trabajador.unidadPrecio
    });

  } catch (error) {

    console.error('Error al guardar el precio:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor.' });

  }

});


// ===========================================================
// SOLICITUDES RECIBIDAS Y PRECIO DE CADA TRABAJO
// ===========================================================

// GET /prestador/solicitudes
router.get('/solicitudes', async (req, res) => {

  try {

    const trabajador = await buscarPerfil(req);

    if (!trabajador) {
      return res.status(404).send('No se encontró tu perfil de prestador.');
    }

    // Solo las solicitudes dirigidas A ESTE prestador
    const solicitudes = await SolicitudServicio
      .find({ trabajadorId: trabajador._id })
      .sort({ createdAt: -1 })
      .lean();

    // Se muestra solo el NOMBRE del cliente (no su correo ni otros datos)
    const idsClientes = [...new Set(solicitudes.map((s) => String(s.clienteId)))]
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const clientes = idsClientes.length > 0
      ? await Usuario.find({ _id: { $in: idsClientes } }).select('nombre').lean()
      : [];

    const nombres = {};
    clientes.forEach((c) => { nombres[String(c._id)] = c.nombre; });

    const lista = solicitudes.map((s) => ({
      ...s,
      id: String(s._id),
      clienteNombre: nombres[String(s.clienteId)] || 'Cliente'
    }));

    return res.render('prestador-solicitudes', {
      titulo: 'Solicitudes recibidas',
      trabajador,
      solicitudes: lista
    });

  } catch (error) {

    console.error('Error al cargar las solicitudes:', error);
    return res.status(500).send('No se pudieron cargar tus solicitudes.');

  }

});


// POST /prestador/solicitudes/:id/precio   body: { precio, motivo }
//
// Reglas:
//  - La primera vez propone el precio (motivo opcional).
//  - Si ya habia un precio y lo cambia, el motivo es OBLIGATORIO para que
//    el cliente entienda por que cambia.
//  - Cada propuesta o ajuste deja el precio en estado "Propuesto":
//    el cliente tiene que aceptarlo. Nadie sube un precio en silencio.
router.post('/solicitudes/:id/precio', async (req, res) => {

  try {

    if (!modeloTieneCamposDePrecio()) {
      console.error('Falta agregar los campos de precio al modelo SolicitudServicio.');
      return res.status(500).json({
        mensaje: 'Falta actualizar el modelo SolicitudServicio (campos de precio).'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ mensaje: 'La solicitud no existe.' });
    }

    const lectura = leerPrecio(req.body.precio);

    if (!lectura.ok) {
      return res.status(400).json({
        mensaje: 'Ingresa un precio mayor a 0 (máximo $1,000,000).'
      });
    }

    const nuevoPrecio = lectura.valor;
    const motivoLimpio = String(req.body.motivo || '').trim().slice(0, MAX_TEXTO);

    const trabajador = await buscarPerfil(req);

    if (!trabajador) {
      return res.status(404).json({ mensaje: 'No se encontró tu perfil de prestador.' });
    }

    // La solicitud debe ser de ESTE prestador
    const solicitud = await SolicitudServicio.findOne({
      _id: req.params.id,
      trabajadorId: trabajador._id
    });

    if (!solicitud) {
      return res.status(404).json({ mensaje: 'La solicitud no existe.' });
    }

    const habiaPrecio = typeof solicitud.precioPropuesto === 'number';

    // Mismo precio que ya esta en juego: no hay nada que cambiar
    if (habiaPrecio && solicitud.precioPropuesto === nuevoPrecio) {

      if (solicitud.estadoPrecio === 'Aceptado') {
        return res.json({ mensaje: 'Ese precio ya fue aceptado por el cliente.' });
      }

      if (solicitud.estadoPrecio === 'Propuesto') {
        return res.json({ mensaje: 'Ese precio ya está enviado al cliente.' });
      }

    }

    if (habiaPrecio && motivoLimpio === '') {
      return res.status(400).json({
        mensaje: 'Cuéntale al cliente por qué cambia el precio.'
      });
    }

    solicitud.precioPropuesto = nuevoPrecio;
    solicitud.estadoPrecio = 'Propuesto';

    solicitud.historialPrecio.push({
      precio: nuevoPrecio,
      motivo: motivoLimpio || 'Cotización inicial',
      fecha: new Date(),
      autor: 'prestador',
      accion: habiaPrecio ? 'ajuste' : 'propuesta'
    });

    if (solicitud.historialPrecio.length > MAX_HISTORIAL_SOLICITUD) {
      solicitud.historialPrecio = solicitud.historialPrecio.slice(-MAX_HISTORIAL_SOLICITUD);
    }

    await solicitud.save();

    return res.json({
      mensaje: 'Precio enviado. El cliente debe aceptarlo para confirmarlo.'
    });

  } catch (error) {

    console.error('Error al proponer el precio de la solicitud:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor.' });

  }

});


module.exports = router;
