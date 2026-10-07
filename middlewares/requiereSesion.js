// middlewares/requiereSesion.js
// Protege las rutas que requieren una sesión iniciada.

function requiereSesion(req, res, next) {

  // Si existe un usuario en la sesión,
  // puede continuar.
  if (
    req.session &&
    req.session.usuario
  ) {

    return next();

  }


  // Guardamos la página que intentaba visitar
  // para poder regresarlo después del login.
  if (req.session) {

    req.session.redirectDespuesLogin =
      req.originalUrl;

  }


  // Si no tiene sesión, enviarlo al login.
  return res.redirect('/login');

}


module.exports = requiereSesion;