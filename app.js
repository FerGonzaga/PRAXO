// app.js
// Punto de entrada de la aplicacion.

require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

const conectarDB = require('./config/db');


// ==========================================
// CREAR APLICACION
// ==========================================

const app = express();

const PORT =
  process.env.PORT || 3000;


// ==========================================
// MODELOS
// ==========================================

// Se utiliza para obtener la cantidad
// de servicios guardados por cada cliente.

const SolicitudServicio =
  require('./models/SolicitudServicio');


// ==========================================
// RUTAS
// ==========================================

const indexRoutes =
  require('./routes/index');

const trabajadoresRoutes =
  require('./routes/trabajadores');

const authRoutes =
  require('./routes/auth');

const verificacionRoutes =
  require('./routes/verificacion');

const carritoRoutes =
  require('./routes/carrito');

const perfilRoutes =
  require('./routes/perfil');
  


// ==========================================
// CONECTAR A MONGODB
// ==========================================

conectarDB();


// ==========================================
// CONFIGURAR EJS
// ==========================================

app.set(
  'view engine',
  'ejs'
);

app.set(
  'views',
  path.join(
    __dirname,
    'views'
  )
);


// ==========================================
// ARCHIVOS ESTATICOS
// ==========================================

app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);


// ==========================================
// LEER FORMULARIOS Y JSON
// ==========================================

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  express.json()
);


// ==========================================
// CONFIGURAR SESIONES
// ==========================================

// La sesion ahora se utiliza principalmente
// para identificar al usuario que inicio sesion.
//
// Los servicios del carrito ya NO se guardan
// aqui. Ahora se guardan en MongoDB.

app.use(
  session({

    secret:
      process.env.SESSION_SECRET ||
      'praxo-clave-desarrollo',

    resave:
      false,

    saveUninitialized:
      false,

    cookie: {

      // La sesion dura 2 horas.
      maxAge:
        1000 * 60 * 60 * 2,

      // Evita que JavaScript del navegador
      // pueda acceder directamente a la cookie.
      httpOnly:
        true,

      // Adecuado para localhost.
      secure:
        false,

      sameSite:
        'lax'

    }

  })
);


// ==========================================
// VARIABLES GLOBALES PARA LAS VISTAS
// ==========================================
//
// Estas variables estarán disponibles
// automáticamente en los archivos EJS.
//
// Ejemplos:
//
// usuarioAutenticado
// usuarioActual
// cantidadCarrito
//
// La cantidad del carrito ahora se obtiene
// directamente desde MongoDB.

app.use(
  async (req, res, next) => {

    try {

      // --------------------------------------
      // SABER SI HAY SESION
      // --------------------------------------

      res.locals.usuarioAutenticado =
        Boolean(
          req.session &&
          req.session.usuario
        );


      // --------------------------------------
      // USUARIO ACTUAL
      // --------------------------------------

      res.locals.usuarioActual =
        req.session?.usuario || null;


      // --------------------------------------
      // CANTIDAD INICIAL DEL CARRITO
      // --------------------------------------

      res.locals.cantidadCarrito =
        0;


      // Si no hay usuario autenticado,
      // no necesitamos consultar MongoDB.

      if (
        !req.session?.usuario?.id
      ) {

        return next();

      }


      // --------------------------------------
      // CONTAR SERVICIOS DEL USUARIO
      // --------------------------------------

      const cantidad =
        await SolicitudServicio
          .countDocuments({

            clienteId:
              req.session.usuario.id,

            estado:
              'Pendiente'

          });


      res.locals.cantidadCarrito =
        cantidad;


      next();


    } catch (error) {

      console.error(
        'Error obteniendo cantidad del carrito:',
        error
      );


      // Aunque falle el contador,
      // dejamos que la página continúe.

      res.locals.cantidadCarrito =
        0;

      next();

    }

  }
);


// ==========================================
// REGISTRAR RUTAS
// ==========================================


// ------------------------------------------
// INICIO
// ------------------------------------------

app.use(
  '/',
  indexRoutes
);


// ------------------------------------------
// PROFESIONALES
// ------------------------------------------

app.use(
  '/trabajadores',
  trabajadoresRoutes
);


// ------------------------------------------
// AUTENTICACION
// ------------------------------------------

app.use(
  '/api/auth',
  authRoutes
);


// ------------------------------------------
// VERIFICACION DE CORREO
// ------------------------------------------

app.use(
  '/verificacion',
  verificacionRoutes
);

// ------------------------------------------
// PERFIL DE USUARIO
// ------------------------------------------

app.use(
  '/perfil',
  perfilRoutes
);


// ------------------------------------------
// CARRITO DE SERVICIOS
// ------------------------------------------

app.use(
  '/carrito',
  carritoRoutes
);


// ==========================================
// RUTA NO ENCONTRADA
// ==========================================

app.use(
  (req, res) => {

    res
      .status(404)
      .send(
        'Página no encontrada'
      );

  }
);


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