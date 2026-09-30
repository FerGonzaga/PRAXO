// -----------------------------------------
// REGISTRO
// -----------------------------------------

const formRegistro = document.getElementById('formRegistro');

if (formRegistro) {

  formRegistro.addEventListener('submit', async (evento) => {

    evento.preventDefault();


    // Datos generales
    const nombre =
      document.getElementById('nombre').value.trim();

    const correo =
      document.getElementById('correo').value.trim();

    const password =
      document.getElementById('password').value;

    const confirmPassword =
      document.getElementById('confirmPassword').value;

    const tipoUsuario =
      document.getElementById('tipoUsuario').value;


    // Mensaje
    const mensaje =
      document.getElementById('mensajeRegistro');


    // -----------------------------------------
    // VALIDACIONES
    // -----------------------------------------

    if (
      !nombre ||
      !correo ||
      !password ||
      !confirmPassword
    ) {

      mostrarMensaje(
        'Completa todos los campos.',
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


    // -----------------------------------------
    // DATOS A ENVIAR
    // -----------------------------------------

    const datosRegistro = {

      nombre,

      correo,

      password,

      tipoUsuario

    };


    // -----------------------------------------
    // DATOS EXTRA PARA PRESTADOR
    // -----------------------------------------

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


    // -----------------------------------------
    // ENVIAR AL SERVIDOR
    // -----------------------------------------

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


      // -----------------------------------------
      // ERROR
      // -----------------------------------------

      if (!respuesta.ok) {

        mostrarMensaje(
          datos.mensaje ||
          'No fue posible crear la cuenta.',
          'danger'
        );

        return;
      }


      // -----------------------------------------
      // ÉXITO
      // -----------------------------------------

      mostrarMensaje(
        datos.mensaje ||
        'Cuenta creada correctamente.',
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