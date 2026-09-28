// public/js/main.js
// Punto de entrada del JS que corre en el navegador (no en el servidor).
// Aqui inicializaras logica adicional del cliente conforme la vayas necesitando.

console.log('main.js cargado correctamente');

// =====================================================
// WHATSAPP
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    const whatsappButton =
        document.getElementById("whatsappButton");

    if (!whatsappButton) {
        return;
    }


    // =================================================
    // TU NÚMERO DE WHATSAPP
    // =================================================


    const numeroWhatsApp = "527721442528";


    // =================================================
    // MENSAJE AUTOMÁTICO
    // =================================================

    const mensaje = `
Hola 👋

Vi su página de PRAXO y me gustaría recibir más información.
    `;


    // Convertir mensaje para URL
    const mensajeCodificado =
        encodeURIComponent(mensaje.trim());


    // Crear URL de WhatsApp
    const whatsappURL =
        `https://wa.me/${numeroWhatsApp}?text=${mensajeCodificado}`;


    // Asignar URL al botón
    whatsappButton.href = whatsappURL;

});