// public/js/auth.js

// Este archivo maneja la lógica de registro de usuarios en el lado del cliente.

const formRegistro = document.getElementById('formRegistro');

if (formRegistro) {

  formRegistro.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const correo = document.getElementById('correo').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const tipoUsuario = document.getElementById('tipoUsuario').value;
    const mensaje = document.getElementById('mensajeRegistro');


    // Validaciones básicas

    if (!nombre || !correo || !password || !confirmPassword) {

      mostrarMensaje(
        'Completa todos los campos obligatorios.',
        'danger'
      );

      return;
    }


    if (password.length < 8) {

      mostrarMensaje(
        'La contraseña debe tener al menos 8 caracteres.',
        'danger'
      );

      return;
    }


    if (password !== confirmPassword) {

      mostrarMensaje(
        'Las contraseñas no coinciden.',
        'danger'
      );

      return;
    }


    // Datos comunes
    const datosRegistro = {
      nombre,
      correo,
      password,
      tipoUsuario
    };


    // Datos adicionales del prestador
    if (tipoUsuario === 'prestador') {

      datosRegistro.oficio =
        document.getElementById('oficio').value;

      datosRegistro.telefono =
        document.getElementById('telefono').value.trim();

      datosRegistro.ciudad =
        document.getElementById('ciudad').value.trim();

      datosRegistro.descripcion =
        document.getElementById('descripcion').value.trim();


      if (
        !datosRegistro.oficio ||
        !datosRegistro.telefono ||
        !datosRegistro.ciudad
      ) {

        mostrarMensaje(
          'Completa la información de tu servicio.',
          'danger'
        );

        return;
      }
    }


    try {

      const respuesta = await fetch(
        '/api/auth/registro',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify(datosRegistro)
        }
      );


      const datos = await respuesta.json();


      if (!respuesta.ok) {

        mostrarMensaje(
          datos.mensaje ||
          'No fue posible crear la cuenta.',
          'danger'
        );

        return;
      }


      mostrarMensaje(
        datos.mensaje ||
        'Cuenta creada. Revisa tu correo para verificarla.',
        'success'
      );


      formRegistro.reset();


    } catch (error) {

      console.error(
        'Error en registro:',
        error
      );

      mostrarMensaje(
        'No se pudo conectar con el servidor.',
        'danger'
      );

    }

  });

}


function mostrarMensaje(texto, tipo) {

  const mensaje =
    document.getElementById('mensajeRegistro');

  if (!mensaje) {
    return;
  }

  mensaje.textContent = texto;

  mensaje.className =
    `alert alert-${tipo}`;
}

// Mostrar/ocultar contraseña
const btnMostrarPassword = document.getElementById('btnMostrarPassword');
const passwordInput = document.getElementById('password');

if (btnMostrarPassword && passwordInput) {

  btnMostrarPassword.addEventListener('click', () => {

    const icono = btnMostrarPassword.querySelector('i');

    if (passwordInput.type === 'password') {

      passwordInput.type = 'text';

      icono.classList.remove('bi-eye');
      icono.classList.add('bi-eye-slash');

      btnMostrarPassword.setAttribute(
        'aria-label',
        'Ocultar contraseña'
      );

    } else {

      passwordInput.type = 'password';

      icono.classList.remove('bi-eye-slash');
      icono.classList.add('bi-eye');

      btnMostrarPassword.setAttribute(
        'aria-label',
        'Mostrar contraseña'
      );
    }
  });
}


// Mostrar/ocultar confirmación de contraseña
const btnMostrarConfirmPassword =
  document.getElementById('btnMostrarConfirmPassword');

const confirmPasswordInput =
  document.getElementById('confirmPassword');

if (btnMostrarConfirmPassword && confirmPasswordInput) {

  btnMostrarConfirmPassword.addEventListener('click', () => {

    const icono =
      btnMostrarConfirmPassword.querySelector('i');

    if (confirmPasswordInput.type === 'password') {

      confirmPasswordInput.type = 'text';

      icono.classList.remove('bi-eye');
      icono.classList.add('bi-eye-slash');

      btnMostrarConfirmPassword.setAttribute(
        'aria-label',
        'Ocultar confirmación de contraseña'
      );

    } else {

      confirmPasswordInput.type = 'password';

      icono.classList.remove('bi-eye-slash');
      icono.classList.add('bi-eye');

      btnMostrarConfirmPassword.setAttribute(
        'aria-label',
        'Mostrar confirmación de contraseña'
      );
    }
  });
}

// Mostrar/ocultar contraseña del formulario de Login
const btnMostrarPasswordLogin =
  document.getElementById('btnMostrarPasswordLogin');

const passwordLogin =
  document.getElementById('passwordLogin');

if (btnMostrarPasswordLogin && passwordLogin) {

  btnMostrarPasswordLogin.addEventListener('click', () => {

    const icono =
      btnMostrarPasswordLogin.querySelector('i');

    if (passwordLogin.type === 'password') {

      passwordLogin.type = 'text';

      icono.classList.remove('bi-eye');
      icono.classList.add('bi-eye-slash');

      btnMostrarPasswordLogin.setAttribute(
        'aria-label',
        'Ocultar contraseña'
      );

    } else {

      passwordLogin.type = 'password';

      icono.classList.remove('bi-eye-slash');
      icono.classList.add('bi-eye');

      btnMostrarPasswordLogin.setAttribute(
        'aria-label',
        'Mostrar contraseña'
      );
    }
  });
}

// Javascript para manejar el formulario de login
const formLogin = document.getElementById('formLogin');

if (formLogin) {

  formLogin.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    const correo =
      document.getElementById('correoLogin').value.trim();

    const password =
      document.getElementById('passwordLogin').value;

    // Validación básica
    if (!correo || !password) {

      mostrarMensajeLogin(
        'Ingresa tu correo y contraseña.',
        'danger'
      );

      return;
    }


    try {

      const respuesta = await fetch('/api/auth/login', {

        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          correo,
          password
        })

      });


      const datos = await respuesta.json();


      if (!respuesta.ok) {

        mostrarMensajeLogin(
          datos.mensaje || 'No fue posible iniciar sesión.',
          'danger'
        );

        return;
      }


      mostrarMensajeLogin(
        datos.mensaje || 'Inicio de sesión correcto.',
        'success'
      );


      // Más adelante aquí podremos redirigir
      // al usuario después del login.

    } catch (error) {

      console.error('Error en login:', error);

      mostrarMensajeLogin(
        'No se pudo conectar con el servidor.',
        'danger'
      );

    }

  });

}

function mostrarMensajeLogin(texto, tipo) {

  const mensaje =
    document.getElementById('mensajeLogin');

  if (!mensaje) {
    return;
  }

  mensaje.textContent = texto;

  mensaje.className = `alert alert-${tipo}`;
}