// middlewares/apiAuth.js
// Protege la API de la app móvil: exige "Authorization: Bearer <token>".
// Por ahora la app es SOLO para clientes.

const Usuario = require('../models/Usuarios_Praxo');
const { verificarToken } = require('../services/jwt');

async function requiereClienteApi(req, res, next) {
  try {
    const encabezado = req.get('authorization') || '';
    const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;
    const datos = verificarToken(token);

    if (!token) {
      return res.status(401).json({ mensaje: 'Inicia sesión para continuar.' });
    }
    if (!datos) {
      return res.status(401).json({ mensaje: 'Tu sesión expiró. Inicia sesión de nuevo.' });
    }

    const usuario = await Usuario.findById(datos.sub).select('nombre correo tipoUsuario tokenVersion emailVerificado').lean();

    // tokenVersion permite invalidar todos los tokens ("cerrar sesión en todos los dispositivos")
    if (!usuario || (usuario.tokenVersion || 0) !== (datos.ver || 0)) {
      return res.status(401).json({ mensaje: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
    }
    if (usuario.tipoUsuario !== 'cliente') {
      return res.status(403).json({ mensaje: 'Por ahora la app de PRAXO es solo para clientes.' });
    }

    req.usuario = {
      id: String(usuario._id),
      nombre: usuario.nombre,
      correo: usuario.correo,
      tipoUsuario: usuario.tipoUsuario
    };
    next();
  } catch (error) {
    console.error('Error de autenticación API:', error.message);
    res.status(401).json({ mensaje: 'No se pudo validar tu sesión.' });
  }
}

module.exports = { requiereClienteApi };
