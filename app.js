// app.js
// Punto de entrada de la aplicacion.

require('dotenv').config(); // Carga las variables del archivo .env a process.env

const express = require('express');
const path = require('path');
const conectarDB = require('./config/db');

// Rutas
const indexRoutes = require('./routes/index');
const trabajadoresRoutes = require('./routes/trabajadores');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Conectar a la base de datos antes de levantar el servidor
conectarDB();

// 2. Configurar EJS como motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 3. Servir archivos estaticos (css, js del cliente, imagenes) desde /public
app.use(express.static(path.join(__dirname, 'public')));

// 4. Middleware para poder leer datos enviados desde formularios (POST)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 5. Registrar las rutas
app.use('/', indexRoutes);
app.use('/trabajadores', trabajadoresRoutes);

// 6. Levantar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});