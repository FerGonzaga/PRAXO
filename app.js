// app.js
// Punto de entrada de la aplicacion.

require('dotenv').config(); // Carga las variables del archivo .env a process.env

const express = require('express');
const path = require('path');
const session = require('express-session');

const conectarDB = require('./config/db');


// ==========================================
// CREAR APLICACION
// ==========================================

const app = express();

const PORT = process.env.PORT || 3000;


// ==========================================
// RUTAS
// ==========================================

const indexRoutes = require('./routes/index');

const trabajadoresRoutes = require('./routes/trabajadores');

// Ruta de registro de usuarios y login
const authRoutes = require('./routes/auth');

const verificacionRoutes = require('./routes/verificacion');

// Ruta del carrito de servicios
const carritoRoutes = require('./routes/carrito');


// ==========================================
// CONECTAR A MONGODB
// ==========================================

conectarDB();


// ==========================================
// CONFIGURAR EJS
// ==========================================

app.set('view engine', 'ejs');

app.set(
  'views',
  path.join(__dirname, 'views')
);


// ==========================================
// ARCHIVOS ESTATICOS
// ==========================================

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);


// ==========================================
// LEER FORMULARIOS Y JSON
// ==========================================

// Permite leer formularios enviados por POST
app.use(
  express.urlencoded({
    extended: true
  })
);

// Permite leer JSON
app.use(express.json());


// ==========================================
// CONFIGURAR SESIONES
// ==========================================

// La sesion se utilizara para guardar temporalmente
// los servicios seleccionados en el carrito.

app.use(
  session({

    secret:
      process.env.SESSION_SECRET ||
      'praxo-clave-desarrollo',

    resave: false,

    saveUninitialized: false,

    cookie: {

      // Duracion de la sesion:
      // 2 horas
      maxAge:
        1000 * 60 * 60 * 2,

      // Evita que JavaScript del navegador
      // pueda leer directamente la cookie
      httpOnly: true,

      // En localhost debe estar en false
      secure: false

    }

  })
);


// ==========================================
// VARIABLES GLOBALES PARA LAS VISTAS
// ==========================================

// Esto permitirá después mostrar el número
// de servicios del carrito en el navbar.

app.use((req, res, next) => {

  const carrito =
    req.session.carrito || [];

  res.locals.cantidadCarrito =
    carrito.length;

  next();

});


// ==========================================
// REGISTRAR RUTAS
// ==========================================

// Inicio
app.use(
  '/',
  indexRoutes
);


// Profesionales
app.use(
  '/trabajadores',
  trabajadoresRoutes
);


// Registro y login
app.use(
  '/api/auth',
  authRoutes
);


// Verificacion de correo
app.use(
  '/verificacion',
  verificacionRoutes
);


// Carrito de servicios
app.use(
  '/carrito',
  carritoRoutes
);


// ==========================================
// MANEJO DE RUTA NO ENCONTRADA
// ==========================================

app.use((req, res) => {

  res.status(404).send(
    'Página no encontrada'
  );

});


// ==========================================
// LEVANTAR SERVIDOR
// ==========================================

app.listen(
  PORT,
  () => {

    console.log(
      `Servidor corriendo en http://localhost:${PORT}`
    );

  }
);