document.addEventListener("DOMContentLoaded", function() {
    
    // Coordenadas exactas del ITSOEH (Destino)
    const coordenadasOficina = [-99.2217, 20.2055]; 
    const contenedorMapa = document.getElementById('map');

    // 1. Aseguramos que el contenedor sea relativo para poder poner cosas flotantes encima
    contenedorMapa.style.position = 'relative';

    // 2. Creamos el panel de navegación estilo Google Maps/Uber
    const panelRuta = document.createElement('div');
    panelRuta.className = 'card shadow position-absolute';
    // Lo centramos en la parte inferior
    panelRuta.style.bottom = '20px';
    panelRuta.style.left = '50%';
    panelRuta.style.transform = 'translateX(-50%)';
    panelRuta.style.zIndex = '1';
    panelRuta.style.display = 'none'; // Oculto hasta que se calcule la ruta
    panelRuta.innerHTML = `
        <div class="card-body p-2 d-flex align-items-center gap-3">
            <div class="text-center px-2">
                <h5 class="mb-0 fw-bold text-success" id="tiempo-ruta">-- min</h5>
                <small class="text-muted fw-semibold" id="distancia-ruta">-- km</small>
            </div>
            <!-- Botón que abre Google Maps nativo en el celular -->
            <a href="https://www.google.com/maps/dir/?api=1&destination=${coordenadasOficina[1]},${coordenadasOficina[0]}" 
               target="_blank" 
               class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm">
                <i class="bi bi-geo-alt-fill"></i> Iniciar
            </a>
        </div>
    `;
    contenedorMapa.appendChild(panelRuta);

    // 3. Inicializar el mapa
    const map = new maplibregl.Map({
        container: 'map', 
        style: 'https://tiles.openfreemap.org/styles/liberty', 
        center: coordenadasOficina, 
        zoom: 15, 
        scrollZoom: false 
    });

    map.addControl(new maplibregl.NavigationControl());

    // 4. Marcador de las oficinas (Azul)
    new maplibregl.Marker({ color: "#0000FF" }) 
        .setLngLat(coordenadasOficina)
        .setPopup(new maplibregl.Popup({ offset: 25 })
            .setHTML("<div class='text-center'><strong>Oficinas PRAXO</strong><br><small class='text-muted'>ITSOEH</small></div>")) 
        .addTo(map);

    // 5. Geolocalización y trazado
    map.on('load', () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const origenCoords = [position.coords.longitude, position.coords.latitude];

                    new maplibregl.Marker({ color: "#FF0000" })
                        .setLngLat(origenCoords)
                        .setPopup(new maplibregl.Popup().setText("Estás aquí"))
                        .addTo(map);

                    await trazarRuta(origenCoords, coordenadasOficina);
                },
                (error) => console.warn("Ubicación denegada o no disponible."),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
            );
        }
    });

    // 6. Función para dibujar ruta y calcular tiempos
    async function trazarRuta(inicio, fin) {
        const url = `https://router.project-osrm.org/route/v1/driving/${inicio[0]},${inicio[1]};${fin[0]},${fin[1]}?overview=full&geometries=geojson`;

        try {
            const respuesta = await fetch(url);
            const datos = await respuesta.json();
            
            // Extraer la ruta, la distancia y el tiempo
            const geometriaRuta = datos.routes[0].geometry;
            const distanciaMetros = datos.routes[0].distance;
            const duracionSegundos = datos.routes[0].duration;

            // Convertir a kilómetros y minutos redondos
            const distanciaKm = (distanciaMetros / 1000).toFixed(1);
            const tiempoMin = Math.round(duracionSegundos / 60);

            // Mostrar el panel flotante y actualizar los textos
            document.getElementById('tiempo-ruta').innerText = tiempoMin + ' min';
            document.getElementById('distancia-ruta').innerText = distanciaKm + ' km';
            panelRuta.style.display = 'block';

            map.addSource('ruta', {
                'type': 'geojson',
                'data': { 'type': 'Feature', 'properties': {}, 'geometry': geometriaRuta }
            });

            map.addLayer({
                'id': 'linea-ruta',
                'type': 'line',
                'source': 'ruta',
                'layout': { 'line-join': 'round', 'line-cap': 'round' },
                'paint': { 'line-color': '#0d6efd', 'line-width': 5, 'line-opacity': 0.8 }
            });

            const bounds = new maplibregl.LngLatBounds(inicio, inicio);
            bounds.extend(fin);
            map.fitBounds(bounds, { padding: 50 });

        } catch (error) {
            console.error("Error al calcular la ruta: ", error);
        }
    }
});