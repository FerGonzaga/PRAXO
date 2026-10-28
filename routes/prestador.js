// routes/prestador.js
// Rutas exclusivas de prestadores. Se montan en app.js como: app.use('/prestador', ...)

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Trabajador = require('../models/Trabajador');
const SolicitudServicio = require('../models/SolicitudServicio');
const Solicitud = require('../models/Solicitud'); // 🟢 IMPORTAMOS LA NUEVA MÁQUINA DE ESTADOS
const Usuario = require('../models/Usuarios_Praxo');

const UNIDADES = ['servicio', 'hora', 'dia'];
const PRECIO_MAXIMO = 1000000;
const MAX_TEXTO = 140;
const MAX_HISTORIAL = 20;            // cambios del precio base que se conservan
const MAX_HISTORIAL_SOLICITUD = 30;  // movimientos de precio por solicitud


// -----------------------------------------------------------
// ACCESO: solo prestadores con sesion iniciada.
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
// UTILIDADES
// -----------------------------------------------------------
function obtenerUsuarioId(req) {
  const u = req.session && req.session.usuario;
  return u ? (u.id || u._id || null) : null;
}

async function buscarPerfil(req) {
  const usuarioId = obtenerUsuarioId(req);
  if (!usuarioId) {
    return null;
  }
  return Trabajador.findOne({ usuarioId });
}

function leerPrecio(valorCrudo) {
  const texto = String(
    valorCrudo === undefined || valorCrudo === null ? '' : valorCrudo
  ).trim();

  const valor = Number(texto);

  if (texto === '' || !Number.isFinite(valor) || valor <= 0 || valor > PRECIO_MAXIMO) {
    return { ok: false };
  }

  return { ok: true, valor: Math.round(valor * 100) / 100 };
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

    let nuevoPrecio = null;

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

    if (!Array.isArray(trabajador.historialPrecios)) {
      return res.status(500).json({
        mensaje: 'Falta actualizar el modelo Trabajador (campos de precio).'
      });
    }

    const eraPrimerPrecio = trabajador.precioBase === null || trabajador.precioBase === undefined;
    const cambioElPrecio = trabajador.precioBase !== nuevoPrecio || trabajador.unidadPrecio !== unidad;

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
// BANDEJA DE SOLICITUDES (MÁQUINA DE ESTADOS)
// ===========================================================

// GET /prestador/solicitudes
router.get('/solicitudes', async (req, res) => {
  try {
    const trabajador = await buscarPerfil(req);

    if (!trabajador) {
      return res.status(404).send('No se encontró tu perfil de prestador.');
    }

    // 🟢 BUSCAMOS EN LA NUEVA COLECCIÓN 'Solicitud'
    const solicitudes = await Solicitud.find({ trabajadorId: trabajador._id })
      .populate('clienteId', 'nombre') 
      .sort({ fechaCreacion: -1 })
      .lean();

    return res.render('prestador-solicitudes', {
      titulo: 'Solicitudes recibidas',
      trabajador,
      solicitudes // Pasamos la data directa a la vista
    });

  } catch (error) {
    console.error('Error al cargar las solicitudes:', error);
    return res.status(500).send('No se pudieron cargar tus solicitudes.');
  }
});


// 🟢 NUEVA RUTA: RESPONDER Y COTIZAR SOLICITUD
// POST /prestador/responder-solicitud/:id
router.post('/responder-solicitud/:id', async (req, res) => {
  try {
    const trabajador = await buscarPerfil(req);
    
    if (!trabajador) {
      return res.status(404).send('No se encontró tu perfil de prestador.');
    }

    const { mensajeCotizacion, precioAcordado } = req.body;
    
    // Validar precio
    const precio = Number(precioAcordado);
    if (!precio || precio <= 0) {
      return res.status(400).send('Debes ingresar un precio válido.');
    }

    // Buscamos la solicitud y verificamos que pertenezca a este trabajador
    const solicitud = await Solicitud.findOne({ 
      _id: req.params.id,
      trabajadorId: trabajador._id
    });

    if (!solicitud) {
      return res.status(404).send('La solicitud no existe.');
    }

    // 🔒 Solo se puede cotizar una solicitud Pendiente
    // (evita cambiar el precio después de que el cliente aceptó o pagó)
    if (solicitud.estado !== 'Pendiente') {
      return res.status(409).send('Esta solicitud ya fue cotizada y no puede modificarse.');
    }

    // Actualizamos la máquina de estados
    solicitud.estado = 'Cotizada';
    solicitud.precioAcordado = precio;
    solicitud.mensajeCotizacion = mensajeCotizacion;

    await solicitud.save();

    // Regresamos a la bandeja
    return res.redirect('/prestador/solicitudes');

  } catch (error) {
    console.error('Error al cotizar solicitud:', error);
    return res.status(500).send('Error interno del servidor.');
  }
});


// ===========================================================
// DISPONIBILIDAD ("Disponible ahora")
// POST /prestador/disponibilidad   body: { disponible: true|false }
// ===========================================================
router.post('/disponibilidad', async (req, res) => {
  try {
    const { disponible } = req.body;

    if (typeof disponible !== 'boolean') {
      return res.status(400).json({ mensaje: 'Valor de disponibilidad inválido.' });
    }

    const trabajador = await Trabajador.findOneAndUpdate(
      { usuarioId: obtenerUsuarioId(req) },
      { $set: { disponibleAhora: disponible } },
      { new: true }
    );

    if (!trabajador) {
      return res.status(404).json({ mensaje: 'No se encontró tu perfil de prestador.' });
    }

    return res.json({
      disponible: trabajador.disponibleAhora,
      mensaje: trabajador.disponibleAhora
        ? 'Ahora apareces como disponible para los clientes.'
        : 'Ya no apareces como disponible.'
    });

  } catch (error) {
    console.error('Error al actualizar disponibilidad:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});


module.exports = router;