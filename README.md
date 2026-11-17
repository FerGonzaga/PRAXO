# PRAXO

Plataforma web que conecta a clientes con prestadores de servicios del hogar y oficios (electricistas, plomeros, cerrajeros, etc.). El cliente busca un profesional, le envía una solicitud, recibe una cotización, paga y califica el servicio; el prestador administra sus solicitudes, cotiza y cobra a través de la plataforma.

Proyecto integrador de la carrera de Ingeniería en Tecnologías de la Información y Comunicaciones (ITSOEH).

---

## Contenido

1. [Cómo se usa la página](#1-cómo-se-usa-la-página)
2. [Tecnologías](#2-tecnologías)
3. [Instalación local](#3-instalación-local)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Estructura del proyecto](#5-estructura-del-proyecto)
6. [Rutas de la página web](#6-rutas-de-la-página-web)
7. [API para la app móvil (`/api/v1`)](#7-api-para-la-app-móvil-apiv1)
8. [Reglas de negocio](#8-reglas-de-negocio)
9. [Pagos](#9-pagos)
10. [Correos](#10-correos)
11. [Seguridad y privacidad](#11-seguridad-y-privacidad)
12. [Despliegue en Render](#12-despliegue-en-render)
13. [Datos de ejemplo](#13-datos-de-ejemplo)
14. [Problemas comunes](#14-problemas-comunes)

---

## 1. Cómo se usa la página

PRAXO tiene dos tipos de cuenta: **cliente** y **prestador**. Cada uno ve un panel distinto al iniciar sesión.

### Registro e inicio de sesión

1. En `/registro` se elige el tipo de cuenta: **Busco servicios** (cliente) u **Ofrezco servicios** (prestador). El prestador además captura su oficio, teléfono, ciudad y una descripción.
2. Es obligatorio aceptar los Términos y Condiciones y el Aviso de Privacidad. Recibir promociones es opcional.
3. PRAXO envía un **correo de verificación**. Hasta que se abra el enlace, la cuenta no puede iniciar sesión.
4. Con el correo verificado, se inicia sesión en `/login`.

### Como cliente

1. **Buscar un profesional** en `/trabajadores`, con filtros por oficio y ciudad. Cada tarjeta muestra la calificación, el precio de referencia y si el profesional está disponible ahora.
2. **Ver su perfil** (`/trabajadores/:id`): descripción, precio y reseñas de otros clientes.
3. **Agregar el servicio al carrito** con fecha, hora, dirección, referencias, descripción, nivel de urgencia y, opcionalmente, una foto del problema.
4. **Confirmar la contratación** en `/carrito`, aceptando las políticas de compra. Cada servicio del carrito se convierte en una solicitud enviada al profesional.
5. **Negociar en la sala de acuerdos** (`/chat/:id`): chatear con el profesional y revisar su cotización, que muestra el desglose completo (precio del profesional, comisión de PRAXO e IVA).
6. **Aceptar o rechazar** la cotización.
7. **Pagar** en `/pago/:id` y descargar el comprobante en PDF.
8. Cuando el profesional termina, **calificar el servicio** con 1 a 5 estrellas y un comentario.
9. Consultar todo lo anterior en `/historial`, con filtro por estado.

### Como prestador

1. Desde `/inicio-prestador`, activar o desactivar **"Disponible ahora"** para aparecer como disponible ante los clientes.
2. Definir el **precio base** de referencia en `/prestador/precio` (por servicio, por hora o por día).
3. Revisar las **solicitudes recibidas** en `/prestador/solicitudes` y enviar una **cotización** con el precio y un mensaje. El prestador recibe íntegro el precio que cotiza; la comisión se le suma al cliente.
4. Conversar con el cliente en la sala de acuerdos.
5. Cuando el cliente paga, realizar el trabajo y marcarlo como **completado**.
6. Ver sus servicios e ingresos en `/historial`.

### Privacidad (ambos tipos de cuenta)

En `/perfil/privacidad` el usuario puede consultar el aviso, aceptar o retirar el consentimiento para promociones y **descargar todos sus datos** en formato JSON (derecho de acceso, LFPDPPP).

---

## 2. Tecnologías

| Capa | Tecnología |
|---|---|
| Servidor | Node.js + Express 5 |
| Vistas | EJS + Bootstrap 5 (tema propio en `public/css/praxo-theme.css`) |
| Base de datos | MongoDB Atlas con Mongoose |
| Sesiones web | `express-session` (cookie `httpOnly`) |
| Contraseñas | `bcrypt` |
| Subida de archivos | `multer` |
| Pagos | Stripe Checkout (modo prueba) o pasarela simulada |
| Correo | Brevo (verificación de cuenta) y EmailJS (códigos y formulario de contacto) |
| Analítica | Google Analytics 4 (opcional) |
| Hospedaje | Render |

---

## 3. Instalación local

### Requisitos

- Node.js en su versión LTS (20 o superior)
- Una base de datos en MongoDB Atlas (o MongoDB local)
- Git

### Pasos

```bash
git clone https://github.com/FerGonzaga/PRAXO.git
cd PRAXO
npm install
```

Crea un archivo `.env` en la raíz del proyecto (ver la [sección 4](#4-variables-de-entorno)) y arranca el servidor:

```bash
node app.js
```

La página queda disponible en `http://localhost:3000`.

> **Sugerencia:** agrega `"start": "node app.js"` a la sección `scripts` de `package.json` para poder usar `npm start`, que es el comando que Render espera por defecto.

---

## 4. Variables de entorno

Todas se definen en el archivo `.env` (local) y en **Environment** dentro de Render (producción).

> ⚠️ El archivo `.env` **nunca** se sube a GitHub. Lo mismo aplica para cualquier archivo con contraseñas o cadenas de conexión: si una credencial llegó a subirse alguna vez, hay que cambiarla, porque sigue visible en el historial de Git.

### Obligatorias

| Variable | Para qué sirve | Ejemplo |
|---|---|---|
| `MONGODB_URI` | Conexión a MongoDB. Sin ella el servidor no arranca. | `mongodb+srv://usuario:contraseña@cluster.mongodb.net/praxo` |
| `SESSION_SECRET` | Firma las cookies de sesión. En producción es indispensable. | cadena aleatoria larga |
| `APP_URL` | URL pública del sitio; se usa en los enlaces de los correos. En Render se toma `RENDER_EXTERNAL_URL` automáticamente. | `http://localhost:3000` |

### Correos

| Variable | Para qué sirve |
|---|---|
| `BREVO_API_KEY` | Clave de Brevo para el correo de verificación de cuenta |
| `BREVO_SENDER_NAME` | Nombre del remitente (ej. `PRAXO`) |
| `BREVO_SENDER_EMAIL` | Correo remitente, validado en Brevo |
| `EMAILJS_SERVICE_ID` | Servicio de EmailJS |
| `EMAILJS_PUBLIC_KEY` | Clave pública de EmailJS |
| `EMAILJS_PRIVATE_KEY` | Clave privada de EmailJS (solo servidor) |
| `EMAILJS_TEMPLATE_VERIFICACION_ID` | Plantilla del código de verificación |
| `EMAILJS_CONTACTO_TEMPLATE_ID` | Plantilla del formulario de contacto |
| `CORREO_PRIVACIDAD` | Correo de contacto que aparece en el aviso de privacidad |

### Pagos

| Variable | Para qué sirve |
|---|---|
| `STRIPE_SECRET_KEY` | Activa Stripe. **Solo se aceptan llaves de prueba** (`sk_test_...`); una llave `sk_live_` se ignora a propósito. Sin esta variable se usa la pasarela simulada. |
| `STRIPE_WEBHOOK_SECRET` | Firma del webhook de Stripe (`whsec_...`). Opcional, pero recomendada. |
| `COMISION_PORCENTAJE` | Comisión de PRAXO sobre el precio del prestador. Por defecto `10`. |
| `DATA_ENCRYPTION_KEY` | Llave AES-256 (64 caracteres hexadecimales) para cifrar los identificadores de pago en la base. Si falta, se deriva de `SESSION_SECRET`. |

### App móvil y otros

| Variable | Para qué sirve |
|---|---|
| `JWT_SECRET` | Firma los tokens de la app móvil. Mínimo 32 caracteres. Necesaria solo si se usa `/api/v1`. |
| `APP_VERSION_MINIMA` | Versión mínima de la app móvil que el servidor acepta. Por defecto `1.0.0`. |
| `GA_MEASUREMENT_ID` | ID de Google Analytics 4 (`G-XXXXXXXXXX`). Si falta, no se carga. |
| `PORT` | Puerto del servidor. Por defecto `3000`; Render lo asigna solo. |
| `NODE_ENV` | `production` activa HTTPS obligatorio, HSTS y cookies seguras. En Render se detecta solo. |

### Generar secretos aleatorios

```bash
# Para SESSION_SECRET y JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Para DATA_ENCRYPTION_KEY (exactamente 64 caracteres hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Ejemplo de `.env` para desarrollo

```env
MONGODB_URI=mongodb+srv://USUARIO:CONTRASEÑA@cluster.mongodb.net/praxo_dev
SESSION_SECRET=pega-aqui-un-secreto-aleatorio
APP_URL=http://localhost:3000

BREVO_API_KEY=
BREVO_SENDER_NAME=PRAXO
BREVO_SENDER_EMAIL=

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=
COMISION_PORCENTAJE=10

JWT_SECRET=pega-aqui-otro-secreto-aleatorio
```

> Usa una base de datos distinta para desarrollo (por ejemplo `praxo_dev`) para no mezclar pruebas con los datos reales de los usuarios.

---

## 5. Estructura del proyecto

```
PRAXO/
├── app.js                  Punto de entrada: middlewares, sesiones y montaje de rutas
├── config/
│   ├── db.js               Conexión a MongoDB
│   ├── tarifas.js          Cálculo de comisión e IVA
│   └── privacidad.js       Datos del aviso de privacidad
├── controllers/            Lógica de trabajadores, perfil, verificación y categorías
├── middlewares/
│   ├── auth.js             Acceso por tipo de usuario
│   ├── requiereSesion.js   Exige sesión iniciada
│   └── seguridad.js        Cabeceras, saneamiento de entradas, origen y límites de intentos
├── models/                 Esquemas de Mongoose (ver abajo)
├── routes/                 Rutas de la web (y de la API)
├── services/
│   ├── brevo.js            Correo de verificación de cuenta
│   ├── emailService.js     Códigos de verificación (EmailJS)
│   ├── stripe.js           Integración con Stripe Checkout
│   ├── pagos.js            Registro y confirmación de pagos
│   ├── cifrado.js          Cifrado AES-256-GCM de datos sensibles
│   ├── calificaciones.js   Recalcula el promedio de estrellas
│   └── ticketPdf.js        Comprobante de pago en PDF
├── views/                  Plantillas EJS (y partials/)
├── public/                 CSS, JavaScript del navegador e imágenes
│   └── uploads/            Fotos subidas por los clientes (no se versiona)
├── data/                   Datos de ejemplo en JSON
├── scripts/seed.js         Carga los trabajadores de ejemplo
└── Documentos/             Documentación del proyecto en PDF
```

### Modelos principales

| Modelo | Colección | Contenido |
|---|---|---|
| `Usuario` (`Usuarios_Praxo.js`) | `usuariospraxo` | Cuenta: nombre, correo, contraseña (hash), tipo, consentimientos |
| `Trabajador` | `trabajadores` | Perfil público del prestador: oficio, ciudad, foto, precio, calificación, disponibilidad |
| `SolicitudServicio` | `solicitudservicios` | Servicios en el carrito del cliente (antes de confirmar) |
| `Solicitud` | `solicituds` | Solicitud confirmada: estado, cotización, desglose y pago |
| `Mensaje` | `mensajes` | Mensajes del chat de cada solicitud |
| `Resena` | `resenas` | Calificación de 1 a 5 estrellas (una por solicitud) |
| `TokenVerificacion` | `tokensVerificacion` | Enlaces de verificación de correo |
| `CodigoVerificacion` | `codigosVerificacion` | Códigos de verificación enviados por correo |
| `RefreshToken` | `refreshtokens` | Sesiones de la app móvil (solo el hash del token) |
| `Categoria` | `categorias` | Categorías de servicio |

---

## 6. Rutas de la página web

Estas rutas devuelven páginas HTML (EJS) o redirigen. Están pensadas para el navegador.

| Ruta | Acceso | Descripción |
|---|---|---|
| `GET /` | Público | Página de inicio |
| `GET /quienes-somos`, `/contacto` | Público | Páginas informativas |
| `GET /terminos`, `/aviso-privacidad`, `/politicas` | Público | Documentos legales |
| `GET /registro`, `/registro/cliente`, `/registro/prestador` | Público | Formularios de registro |
| `GET /login` | Público | Inicio de sesión |
| `GET /revisa-correo` | Público | Aviso para verificar el correo |
| `GET /trabajadores` | Público | Catálogo con filtros `?oficio=` y `?ciudad=` |
| `GET /trabajadores/:id` | Público | Perfil del profesional |
| `GET /inicio-cliente` | Cliente | Panel del cliente |
| `GET /inicio-prestador` | Prestador | Panel del prestador |
| `/carrito` | Cliente | Ver, agregar, editar, eliminar y confirmar servicios |
| `/prestador/precio` | Prestador | Precio base de referencia |
| `/prestador/solicitudes` | Prestador | Bandeja de solicitudes y cotización |
| `POST /prestador/disponibilidad` | Prestador | Activa o desactiva "Disponible ahora" (JSON) |
| `/chat/:id` | Participantes | Chat, aceptar, rechazar, completar y calificar |
| `/pago/:id` | Cliente | Pago (Stripe o simulado) y comprobante PDF |
| `GET /historial` | Con sesión | Historial con filtro `?estado=` |
| `/perfil`, `/perfil/privacidad` | Con sesión | Perfil y centro de privacidad |

### Rutas de autenticación (JSON)

| Ruta | Descripción |
|---|---|
| `POST /api/auth/registro` | Crea la cuenta y envía el correo de verificación |
| `GET /api/auth/verificar-email?token=` | Enlace que llega por correo |
| `POST /api/auth/login` | Inicia sesión (cookie) |
| `GET /api/auth/sesion` | Devuelve la sesión actual |
| `POST /api/auth/logout` | Cierra la sesión |
| `POST /verificacion/enviar`, `/verificacion/validar` | Envío y validación de códigos por correo |

---

## 7. API para la app móvil (`/api/v1`)

La app móvil **no** usa las rutas de la sección anterior, porque devuelven HTML. Usa esta API, que siempre responde JSON y se autentica con tokens.

> Requiere `npm install jsonwebtoken` y la variable `JWT_SECRET`.

### Autenticación

La app inicia sesión y recibe dos tokens:

- **Access token**: dura 15 minutos. Se envía en cada petición con el encabezado `Authorization: Bearer <token>`.
- **Refresh token**: dura 30 días y sirve solo para obtener un access token nuevo. **Cambia cada vez que se usa**; si alguien reutiliza uno ya usado, se cierra la sesión de ese dispositivo.

La app debe guardar ambos tokens en almacenamiento seguro (`expo-secure-store`), nunca en `AsyncStorage`. Los endpoints también aceptan la cookie de sesión de la web.

### Formato de respuesta

Todas las respuestas incluyen `ok`. Los errores traen además `mensaje` (listo para mostrarse al usuario) y, en algunos casos, `codigo`:

```json
{ "ok": false, "codigo": "TOKEN_INVALIDO", "mensaje": "Tu sesión expiró." }
```

| Código | Qué debe hacer la app |
|---|---|
| `TOKEN_INVALIDO` | Renovar con `/auth/refresh` y repetir la petición |
| `REFRESH_INVALIDO` | Borrar los tokens y volver al login |
| `SIN_SESION` | Mostrar el login |
| `CORREO_NO_VERIFICADO` | Pedir al usuario que verifique su correo |

### Endpoints

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/api/v1/estado` | Público | Versión de la API y versión mínima de la app |
| POST | `/api/v1/auth/login` | Público | `{ correo, password, dispositivo? }` → tokens y usuario |
| POST | `/api/v1/auth/refresh` | Público | `{ refreshToken }` → tokens nuevos |
| POST | `/api/v1/auth/logout` | Público | `{ refreshToken }` → cierra la sesión del dispositivo |
| GET | `/api/v1/auth/yo` | Con sesión | Usuario actual y, si es prestador, su perfil |
| GET | `/api/v1/trabajadores` | Público | Catálogo. Filtros: `oficio`, `ciudad`, `disponible=1`, `pagina`, `limite` (máx. 50) |
| GET | `/api/v1/trabajadores/oficios` | Público | Lista de oficios para los filtros |
| GET | `/api/v1/trabajadores/:id` | Público | Perfil y últimas 20 reseñas |
| GET | `/api/v1/solicitudes` | Con sesión | Solicitudes del usuario. Filtro opcional `?estado=` |
| POST | `/api/v1/solicitudes` | Cliente | Crea una solicitud (ver ejemplo abajo) |
| GET | `/api/v1/solicitudes/:id` | Participante | Detalle, mensajes y reseña |
| POST | `/api/v1/solicitudes/:id/mensajes` | Participante | `{ texto }` |
| POST | `/api/v1/solicitudes/:id/cotizar` | Prestador | `{ precio, mensaje }` |
| POST | `/api/v1/solicitudes/:id/aceptar` | Cliente | Acepta la cotización |
| POST | `/api/v1/solicitudes/:id/rechazar` | Cliente | Rechaza la cotización |
| POST | `/api/v1/solicitudes/:id/completar` | Prestador | Marca el trabajo como terminado |
| POST | `/api/v1/solicitudes/:id/resena` | Cliente | `{ calificacion: 1-5, comentario }` |
| PATCH | `/api/v1/prestador/disponibilidad` | Prestador | `{ disponible: true \| false }` |

El registro de cuentas se hace con `POST /api/auth/registro` (sección 6), que ya responde JSON.

Las acciones sobre una solicitud (`cotizar`, `aceptar`, etc.) devuelven la solicitud actualizada completa, para que la app refresque la pantalla con una sola respuesta.

### Ejemplos

**Iniciar sesión**

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "correo": "cliente@ejemplo.com", "password": "********", "dispositivo": "App PRAXO (android)" }
```

```json
{
  "ok": true,
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "q8Zk3...",
  "usuario": { "id": "665f...", "nombre": "Ana Ruiz", "correo": "cliente@ejemplo.com", "tipoUsuario": "cliente" }
}
```

**Crear una solicitud**

```http
POST /api/v1/solicitudes
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "trabajadorId": "665a...",
  "fecha": "2026-11-20",
  "hora": "10:00",
  "ubicacion": "Av. Juárez 120, Centro",
  "referenciasUbicacion": "Portón negro",
  "descripcion": "Fuga de agua bajo el lavabo",
  "urgencia": "Programado",
  "requiereCotizacion": true,
  "aceptaPoliticas": true
}
```

**Un profesional en el catálogo**

```json
{
  "id": "665a...",
  "nombre": "María López",
  "oficio": "Plomero",
  "ciudad": "Pachuca de Soto, Hidalgo",
  "descripcion": "Reparación de fugas, instalación de tuberías y calentadores.",
  "foto": "/assets/img/trabajadores/maria.jpg",
  "calificacionPromedio": 4.9,
  "totalResenas": 12,
  "disponibleAhora": false,
  "precioReferencia": { "precio": 300, "unidad": "por hora" },
  "precioNota": ""
}
```

### Notas para quien desarrolla la app

- Las **fotos** llegan como rutas relativas (`/assets/...`). Hay que anteponer la URL del servidor.
- Los **montos** (`montos.total`, `montos.comision`, etc.) ya vienen calculados por el servidor. La app solo los muestra; nunca debe calcular comisiones por su cuenta.
- La API **no expone** el teléfono de los prestadores ni los identificadores de pago de Stripe.
- Las fechas de servicio usan el formato `AAAA-MM-DD` y las horas `HH:MM` (24 h).
- **Contrato de cambios**: agregar campos a una respuesta es seguro; quitar o renombrar uno rompe las apps ya instaladas. Un cambio incompatible se publica como `/api/v2`, manteniendo `/api/v1` mientras haya usuarios con versiones anteriores.

---

## 8. Reglas de negocio

### Estados de una solicitud

```
Pendiente ──(prestador cotiza)──► Cotizada ──(cliente acepta)──► Aceptada ──(cliente paga)──► Pagada ──(prestador termina)──► Completada
                                     │                                                                                       │
                                     └──(cliente rechaza)──► Rechazada                                         (cliente califica)
```

| Transición | Quién | Condición |
|---|---|---|
| Pendiente → Cotizada | Prestador de esa solicitud | Precio mayor a 0 y menor a $1,000,000 |
| Cotizada → Aceptada / Rechazada | Cliente de esa solicitud | — |
| Aceptada → Pagada | Cliente | Pago aprobado; el monto se toma de la base de datos, nunca del formulario |
| Pagada → Completada | Prestador | — |
| Reseña | Cliente | Solo en estado Completada y una sola vez por solicitud |

Cada cambio de estado deja un mensaje automático en el chat y se hace de forma atómica, para que un doble clic no lo aplique dos veces.

### Cálculo del cobro (`config/tarifas.js`)

```
  Precio del prestador          (lo recibe íntegro)
+ Comisión PRAXO                (COMISION_PORCENTAJE % del precio, 10 % por defecto)
+ IVA 16 % sobre la comisión
= Total que paga el cliente
```

Ejemplo con un precio de $500: comisión $50, IVA $8, **total $558**. El desglose se guarda en la solicitud al momento de cotizar, así que un cambio posterior en la comisión no altera las cotizaciones ya enviadas.

---

## 9. Pagos

PRAXO tiene dos modos de pago, y elige solo según la configuración:

**Stripe Checkout (si existe `STRIPE_SECRET_KEY` con una llave `sk_test_`).** El cliente escribe su tarjeta en la página de Stripe; los datos de la tarjeta nunca pasan por el servidor de PRAXO. El pago se confirma consultando a Stripe y, si está configurado, mediante el webhook `POST /pago/stripe/webhook`, que escucha los eventos `checkout.session.completed` y `checkout.session.async_payment_succeeded`.

Para recibir el webhook en local se puede usar Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/pago/stripe/webhook
```

**Pasarela simulada (si no hay llave de Stripe).** Sirve para demostraciones. Solo se guardan la marca y los últimos 4 dígitos de la tarjeta.

| Tarjeta de prueba | Resultado |
|---|---|
| `4242 4242 4242 4242` | Pago aprobado |
| `4000 0000 0000 0002` | Rechazado (fondos insuficientes) |
| Cualquier otra tarjeta válida | Aprobado |

En ambos modos se genera un comprobante en PDF en `/pago/:id/comprobante`, que pueden descargar el cliente y el prestador.

> Por diseño, PRAXO **no acepta llaves de producción** (`sk_live_`), para evitar cobros reales en un proyecto académico.

---

## 10. Correos

- **Verificación de cuenta (Brevo).** Al registrarse, el usuario recibe un enlace a `/api/auth/verificar-email`. El enlace usa `RENDER_EXTERNAL_URL` o `APP_URL`, así que esa variable debe apuntar a la URL correcta del entorno.
- **Códigos de verificación y formulario de contacto (EmailJS).** El envío de códigos tiene una espera de 60 segundos entre solicitudes, caducidad de 10 minutos y máximo 5 intentos, para no agotar la cuota gratuita.

En Brevo, el correo remitente (`BREVO_SENDER_EMAIL`) debe estar validado; de lo contrario los correos no se envían.

---

## 11. Seguridad y privacidad

Lo que ya implementa el proyecto:

- Contraseñas con `bcrypt`; mensajes de error que no revelan qué correos están registrados.
- Límites de intentos para login, registro, verificación, pagos y mensajes del chat.
- Saneamiento de entradas contra inyección NoSQL y verificación del origen de las peticiones.
- Cabeceras de seguridad; en producción, HTTPS obligatorio, HSTS y cookies `secure`.
- Verificación de permisos en el servidor: cada usuario solo ve y modifica sus propias solicitudes.
- Validación del contenido real de las imágenes subidas, no solo de su extensión.
- Cifrado AES-256-GCM de los identificadores de transacción.
- Registro del consentimiento, opt-in de promociones y descarga de datos personales (LFPDPPP).

Recomendaciones de mantenimiento:

- Mantener fuera del repositorio el `.env`, cualquier archivo con credenciales y la carpeta `public/uploads/`. Revisar el `.gitignore` antes de cada commit.
- En MongoDB Atlas, restringir **Network Access** en lugar de permitir `0.0.0.0/0` cuando el plan lo permita.
- Las sesiones de la web se guardan en memoria: cada reinicio del servidor cierra la sesión de todos los usuarios. Se puede resolver con `connect-mongo`.
- Las fotos de `public/uploads/` se pierden en cada despliegue de Render, porque su disco es temporal. Para producción conviene moverlas a un almacenamiento en la nube (Cloudinary o S3).

---

## 12. Despliegue en Render

1. Crear un **Web Service** conectado al repositorio de GitHub.
2. **Build command:** `npm install`
3. **Start command:** `node app.js` (o `npm start` si se agregó el script).
4. En **Environment**, cargar las variables de la [sección 4](#4-variables-de-entorno). No hace falta definir `PORT` ni `NODE_ENV`.
5. En MongoDB Atlas, permitir el acceso desde Render en **Network Access**.
6. Si se usa Stripe, registrar el webhook en el panel de Stripe apuntando a `https://<tu-servicio>.onrender.com/pago/stripe/webhook` y copiar su secreto en `STRIPE_WEBHOOK_SECRET`.

En el plan gratuito, Render apaga el servicio tras un rato sin uso; la primera petición después de eso tarda varios segundos en responder.

---

## 13. Datos de ejemplo

`scripts/seed.js` carga los profesionales de `data/trabajadores-ejemplo.json`, con sus fotos guardadas en la base de datos.

1. Coloca las imágenes indicadas en `fotoArchivo` dentro de `public/assets/img/trabajadores/`.
2. Ejecuta:

```bash
node scripts/seed.js
```

> ⚠️ El script **borra todos los trabajadores existentes** antes de insertar los de ejemplo. Úsalo solo en una base de datos de desarrollo.

---

## 14. Problemas comunes

| Síntoma | Causa probable |
|---|---|
| El servidor se cierra al arrancar con "No se encontró MONGODB_URI" | Falta el `.env` o la variable |
| "Error al conectar con MongoDB Atlas" | Contraseña incorrecta o la IP no está permitida en Network Access |
| El login funciona en local pero no en Render | Falta `SESSION_SECRET`, o se accede por `http://` en lugar de `https://` |
| No llega el correo de verificación | Variables de Brevo incompletas o remitente sin validar |
| El enlace del correo apunta a `localhost` | `APP_URL` mal configurada en producción |
| El pago usa la pasarela simulada en lugar de Stripe | Falta `STRIPE_SECRET_KEY` o no empieza con `sk_test_` |
| Las fotos subidas desaparecen | Render borró el disco temporal en el último despliegue |
| La app móvil responde "Falta JWT_SECRET" o no inicia sesión | Falta `JWT_SECRET` (mínimo 32 caracteres) |
| La app móvil no conecta con el servidor local | Se usó `localhost` en lugar de la IP de la computadora |
