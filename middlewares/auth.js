// middlewares/auth.js
// Funciones para proteger rutas segun si hay sesion iniciada y de que tipo.

function requireLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/login');
  }
  next();
}

function requireTipo(tipoEsperado) {
  return (req, res, next) => {
    if (!req.session.usuario) {
      return res.redirect('/login');
    }
    if (req.session.usuario.tipoUsuario !== tipoEsperado) {
      return res.status(403).send('No tienes permiso para ver esta página.');
    }
    next();
  };
}

module.exports = { requireLogin, requireTipo };