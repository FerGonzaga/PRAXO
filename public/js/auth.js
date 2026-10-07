// -----------------------------------------
// REGISTRO (la verificacion llega por correo con un enlace, via Brevo)
// -----------------------------------------

const formRegistro = document.getElementById('formRegistro');

if (formRegistro) {

  formRegistro.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const correo = document.getElementById('correo').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const tipoUsuario = document.getElementById('tipoUsuario').value;

    if (!nombre || !correo || !password || !confirmPassword) {
      mostrarMensaje('Completa todos los campos.', 'danger');
      return;
    }

    if (password.length < 8) {
      mostrarMensaje('La contraseña debe tener al menos 8 caracteres.', 'danger');
      return;
    }

    if (password !== confirmPassword) {
      mostrarMensaje('Las contraseñas no coinciden.', 'danger');
      return;
    }

    const datosRegistro = { nombre, correo, password, tipoUsuario };

    if (tipoUsuario === 'prestador') {

      datosRegistro.oficio = document.getElementById('oficio').value;
      datosRegistro.telefono = document.getElementById('telefono').value.trim();
      datosRegistro.ciudad = document.getElementById('ciudad').value.trim();
      datosRegistro.descripcion = document.getElementById('descripcion').value.trim();

      if (!datosRegistro.oficio || !datosRegistro.telefono || !datosRegistro.ciudad) {
        mostrarMensaje('Completa la información de tu servicio.', 'danger');
        return;
      }

    }

    try {

      const respuesta = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosRegistro)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        mostrarMensaje(datos.mensaje || 'No fue posible crear la cuenta.', 'danger');
        return;
      }

      // Exito: redirige a la pagina dedicada de "revisa tu correo"
      const parametros = new URLSearchParams({
        correo,
        tipoUsuario
      });

      window.location.href = `/revisa-correo?${parametros.toString()}`;

    } catch (error) {
      console.error('Error en registro:', error);
      mostrarMensaje('No se pudo conectar con el servidor.', 'danger');
    }

  });

}


// -----------------------------------------
// LOGIN
// -----------------------------------------

const formLogin = document.getElementById('formLogin');

if (formLogin) {

  formLogin.addEventListener('submit', async (evento) => {

    // Esto es lo que faltaba: sin este preventDefault, el navegador
    // manda el formulario como GET y la contraseña queda en la URL.
    evento.preventDefault();

    const correo = document.getElementById('correoLogin').value.trim();
    const password = document.getElementById('passwordLogin').value;

    if (!correo || !password) {
      mostrarMensajeLogin('Completa correo y contraseña.', 'danger');
      return;
    }

    try {

      const respuesta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        mostrarMensajeLogin(datos.mensaje || 'No fue posible iniciar sesión.', 'danger');
        return;
      }

      // Cada tipo de usuario cae en su propia pantalla de opciones
      if (datos.tipoUsuario === 'prestador') {
        window.location.href = '/inicio-prestador';
      } else {
        window.location.href = '/inicio-cliente';
      }

    } catch (error) {
      console.error('Error en login:', error);
      mostrarMensajeLogin('No se pudo conectar con el servidor.', 'danger');
    }

  });

}


function mostrarMensajeLogin(texto, tipo) {

  const mensaje = document.getElementById('mensajeLogin');

  if (!mensaje) {
    return;
  }

  mensaje.textContent = texto;
  mensaje.className = `alert alert-${tipo}`;
}


// -----------------------------------------
// MOSTRAR/OCULTAR CONTRASEÑA (boton del ojo)
// -----------------------------------------

function activarToggleClave(idBoton, idInput) {

  const boton = document.getElementById(idBoton);
  const input = document.getElementById(idInput);

  if (!boton || !input) {
    return;
  }

  boton.addEventListener('click', () => {
    const icono = boton.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icono.className = 'bi bi-eye-slash';
    } else {
      input.type = 'password';
      icono.className = 'bi bi-eye';
    }
  });
}

activarToggleClave('btnMostrarPasswordLogin', 'passwordLogin');
activarToggleClave('btnMostrarPassword', 'password');
activarToggleClave('btnMostrarConfirmPassword', 'confirmPassword');


function mostrarMensaje(texto, tipo) {

  const mensaje = document.getElementById('mensajeRegistro');

  if (!mensaje) {
    return;
  }

  mensaje.textContent = texto;
  mensaje.className = `alert alert-${tipo}`;
}