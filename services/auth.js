// services/auth.js
// Verificación de credenciales, compartida por el login web y el de la app.

const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuarios_Praxo');

// Devuelve { usuario } o { error, status }
async function verificarCredenciales(correo, password) {
  if (typeof correo !== 'string' || typeof password !== 'string' || !correo || !password) {
    return { error: 'Completa correo y contraseña.', status: 400 };
  }

  const usuario = await Usuario.findOne({ correo: correo.trim().toLowerCase() });
  if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
    return { error: 'Correo o contraseña incorrectos.', status: 401 };
  }

  if (!usuario.emailVerificado) {
    return { error: 'Verifica tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.', status: 403 };
  }

  return { usuario };
}

module.exports = { verificarCredenciales };
