// app.js
// Punto de entrada de la aplicacion.

require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

const conectarDB = require('./config/db');
const {
  cabecerasSeguridad,
  sanitizarEntradas,
  verificarOrigen,
  limitadores
} = require('./middlewares/seguridad');


// ==========================================
// CREAR APLICACION
// ==========================================

const app = express();

// Reglas de cobro (comisión + IVA) disponibles en todas las vistas EJS
app.locals.tarifas = require('./config/tarifas');

// ==========================================
// CIFRADO EN TRÁNSITO (HTTPS / TLS)
// ==========================================
// Render atiende HTTPS y reenvía la petición a Node: "trust proxy" permite
// saber si la conexión original era segura (encabezado X-Forwarded-Proto).
const ES_PRODUCCION =
  process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

app.set('trust proxy', 1);

// No anunciar que el servidor usa Express
app.disable('x-powered-by');

// Cabeceras HTTP de seguridad (clickjacking, sniffing, etc.)
app.use(cabecerasSeguridad({ produccion: ES_PRODUCCION }));

// En producción la sesión DEBE firmarse con un secreto propio
if (ES_PRODUCCION && !process.env.SESSION_SECRET) {
  console.error('⚠️  Falta SESSION_SECRET en producción: las sesiones usarían una clave pública.');
}

if (ES_PRODUCCION) {
  app.use((req, res, next) => {
    // Redirige cualquier petición HTTP a HTTPS
    if (!req.secure) {
      return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    }
    // HSTS: el navegador solo usará HTTPS con este sitio durante 1 año
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
}

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

const prestadorRoutes =
  require('./routes/prestador');
  


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
// WEBHOOK DE STRIPE
// ==========================================
// Va ANTES de express.json(): la firma se verifica con el cuerpo crudo.
app.post(
  '/pago/stripe/webhook',
  express.raw({ type: 'application/json' }),
  require('./routes/stripeWebhook')
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

      // En producción (Render, HTTPS) la cookie solo viaja cifrada.
      // En localhost (HTTP) debe ser false o la sesión no funcionaría.
      secure:
        ES_PRODUCCION,

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
// SEGURIDAD DE LAS PETICIONES
// ==========================================

// Quita operadores de MongoDB ($ne, $gt...) del cuerpo: evita inyección NoSQL
app.use(sanitizarEntradas);

// CSRF: los POST deben venir de nuestro propio sitio
app.use(verificarOrigen);

// Límite de intentos contra fuerza bruta y spam
app.use('/api/auth/login', limitadores.loginPorIp, limitadores.loginPorCuenta);
app.use('/api/auth/registro', limitadores.registro);
app.use('/verificacion', limitadores.verificacion);
app.use('/pago', limitadores.pagos);
app.use('/chat', (req, res, next) =>
  req.path.endsWith('/mensaje') ? limitadores.mensajes(req, res, next) : next()
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


// ------------------------------------------
// PRESTADORES: precio base y solicitudes recibidas
// ------------------------------------------
//
// Va AQUI (despues de express-session y de las variables
// globales) para que req.session y usuarioActual existan.

app.use(
  '/prestador',
  prestadorRoutes
);

// ------------------------------------------
// Uso del chat entre cliente y prestador de servicio
// ------------------------------------------
app.use('/chat', require('./routes/chat'));

// ------------------------------------------
// Pago simulado de servicios (Aceptada -> Pagada)
// ------------------------------------------
app.use('/pago', require('./routes/pago'));

// ------------------------------------------
// Historial de servicios (cliente y prestador)
// ------------------------------------------
app.use('/historial', require('./routes/historial'));


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
// MANEJO GLOBAL DE ERRORES
// ==========================================
// Nunca mostramos detalles internos (rutas, consultas, stack) al usuario.

app.use((error, req, res, next) => {
  console.error('Error no controlado:', error);
  if (res.headersSent) return next(error);
  res.status(error.status || 500).send('Ocurrió un error. Intenta de nuevo más tarde.');
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