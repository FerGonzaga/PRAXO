// middlewares/apiAuth.js
// Protege la API de la app móvil: exige "Authorization: Bearer <token>".
// La app ya funciona para CLIENTES y PRESTADORES; cada ruta dice qué tipos acepta.

const Usuario = require('../models/Usuarios_Praxo');
const { verificarToken } = require('../services/jwt');

// tipos: ['cliente'], ['prestador'] o ['cliente', 'prestador']
function requiereUsuarioApi(tipos = ['cliente', 'prestador']) {
  return async (req, res, next) => {
    try {
      const encabezado = req.get('authorization') || '';
      const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;
      if (!token) {
        return res.status(401).json({ mensaje: 'Inicia sesión para continuar.' });
      }

      const datos = verificarToken(token);
      // Los tokens de enlaces temporales (p. ej. comprobante) llevan "uso" y NO sirven como sesión
      if (!datos || datos.uso) {
        return res.status(401).json({ mensaje: 'Tu sesión expiró. Inicia sesión de nuevo.' });
      }

      const usuario = await Usuario.findById(datos.sub).select('nombre correo tipoUsuario tokenVersion').lean();

      // tokenVersion permite invalidar todos los tokens ("cerrar sesión en todos los dispositivos")
      if (!usuario || (usuario.tokenVersion || 0) !== (datos.ver || 0)) {
        return res.status(401).json({ mensaje: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
      }
      if (!tipos.includes(usuario.tipoUsuario)) {
        return res.status(403).json({
          mensaje: tipos.length === 1 && tipos[0] === 'cliente'
            ? 'Esta función es solo para clientes.'
            : 'Esta función es solo para prestadores de servicios.'
        });
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
  };
}

module.exports = {
  requiereUsuarioApi,
  requiereCualquierUsuarioApi: requiereUsuarioApi(['cliente', 'prestador']),
  requiereClienteApi: requiereUsuarioApi(['cliente']),
  requierePrestadorApi: requiereUsuarioApi(['prestador'])
};
