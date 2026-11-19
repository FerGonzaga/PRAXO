# PRAXO · App móvil para clientes (Expo / React Native)

La app usa **el mismo servidor y la misma base de datos que la página web**
(API en `/api/v1`). Por eso todo lo que haces en una se ve en la otra:
el carrito, las solicitudes, las cotizaciones y las reseñas.

## 1. Instalar (una sola vez)

Dentro de esta carpeta (`mobile/`):

```bash
npm install expo@latest
npx expo install react react-native expo-status-bar expo-secure-store expo-image-picker expo-web-browser @expo/vector-icons @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context @react-native-community/datetimepicker
```

`npx expo install` elige automáticamente las versiones compatibles con tu versión de Expo.

## 2. Configurar el servidor

Copia `.env.example` como `.env` y escribe la URL de tu servidor:

```
EXPO_PUBLIC_API_URL=https://TU-APP.onrender.com
```

Para usar el servidor de tu computadora: `http://IP-DE-TU-PC:3000`
(el celular y la PC en la misma red Wi-Fi; `localhost` no funciona desde el celular).

## 3. Ejecutar

```bash
npx expo start
```

Instala **Expo Go** en tu celular (Play Store / App Store) y escanea el código QR.

## Pantallas (fase 1)

| Pestaña / pantalla | Qué hace |
|---|---|
| Login / Registro | Cuenta de cliente con consentimiento (términos y aviso de privacidad) |
| Inicio | Buscador, oficios, carrusel de mejores reseñas y mejor calificados |
| Buscar | Filtro por oficio y ciudad |
| Profesional | Perfil, precio final, garantía, reseñas y botón "Solicitar" |
| Solicitar | Fecha, hora, ubicación, descripción, urgencia, cotización y foto |
| Carrito | Mismo carrito de la web, desglose y confirmación con políticas |
| Mis servicios | Estado de cada solicitud y cotización |
| Perfil | Datos, privacidad, políticas y cerrar sesión |

En la fase 1, el chat, el pago y las reseñas se abren en la web. En la fase 2 serán nativos.

## Estructura

```
App.js                 Proveedores (sesión, carrito) + navegación
src/api/cliente.js     Llamadas al servidor (token JWT)
src/context/           Sesión (token en SecureStore) y contador del carrito
src/navigation/        Pestañas y pantallas
src/screens/           Pantallas
src/components/        Botones, campos, tarjetas...
src/theme.js           Colores de PRAXO
```
