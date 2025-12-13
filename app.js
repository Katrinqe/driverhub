// VARIABLEN
let map, marker, watchId, intervalId;
let startTime;
let path = []; // Speichert die Route
let totalDistance = 0;
let maxSpeed = 0;
let isDriving = false;

// DOM ELEMENTE
const screens = {
    start: document.getElementById('start-screen'),
    drive: document.getElementById('drive-screen'),
    stats: document.getElementById('stats-screen')
};

const display = {
    speed: document.getElementById('live-speed'),
    time: document.getElementById('live-time'),
    dist: document.getElementById('live-dist'),
    finalDist: document.getElementById('final-dist'),
    finalSpeed: document.getElementById('final-speed'),
    finalTime: document.getElementById('final-time')
};

// NAVIGATIONS LOGIK
function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    
    // Wenn Map sichtbar wird, muss sie aktualisiert werden
    if(screenName === 'drive' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

// 1. START DRIVE
document.getElementById('btn-start').addEventListener('click', () => {
    switchScreen('drive');
    startTracking();
});

// 2. STOP DRIVE
document.getElementById('btn-stop').addEventListener('click', () => {
    stopTracking();
    switchScreen('stats');
});

// 3. BACK HOME
document.getElementById('btn-home').addEventListener('click', () => {
    location.reload(); // Einfacher Reset der App
});

// TRACKING LOGIK
function startTracking() {
    isDriving = true;
    startTime = new Date();
    path = [];
    totalDistance = 0;
    maxSpeed = 0;

    // Karte initialisieren (Falls noch nicht geschehen)
    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13); // Default DE
        // OpenStreetMap Layer (Wird durch CSS dunkel gemacht)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; DriverHub'
        }).addTo(map);
        
        // Custom Icon für das Auto/Position
        const carIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:#4a90e2; width: 15px; height: 15px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #4a90e2;'></div>",
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        marker = L.marker([0, 0], {icon: carIcon}).addTo(map);
    }

    // Timer starten
    intervalId = setInterval(updateTimer, 1000);

    // GPS starten
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(updatePosition, handleError, {
            enableHighAccuracy: true,
            maximumAge: 0
        });
    } else {
        alert("GPS wird nicht unterstützt.");
    }
}

function updatePosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const speedMs = position.coords.speed || 0; // m/s
    const speedKmh = (speedMs * 3.6).toFixed(0); // km/h

    // Max Speed speichern
    if (parseFloat(speedKmh) > maxSpeed) maxSpeed = parseFloat(speedKmh);

    // UI Updates
    display.speed.innerText = speedKmh;
    
    // Position auf Karte
    const newLatLng = new L.LatLng(lat, lng);
    marker.setLatLng(newLatLng);
    map.setView(newLatLng, 18); // Zoom folgt dem Auto

    // Distanz berechnen (Einfache Version)
    if (path.length > 0) {
        const lastPoint = path[path.length - 1];
        const dist = newLatLng.distanceTo(lastPoint); // Meter
        totalDistance += dist;
        display.dist.innerText = (totalDistance / 1000).toFixed(1) + " km";
    }
    path.push(newLatLng);

    // Linie zeichnen
    L.polyline(path, {color: '#4a90e2', weight: 4}).addTo(map);
}

function updateTimer() {
    const now = new Date();
    const diff = now - startTime;
    const date = new Date(diff);
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    const sec = String(date.getUTCSeconds()).padStart(2, '0');
    // Stunden erst anzeigen wenn nötig
    const hrs = date.getUTCHours();
    
    display.time.innerText = hrs > 0 ? `${hrs}:${min}:${sec}` : `${min}:${sec}`;
}

function stopTracking() {
    isDriving = false;
    clearInterval(intervalId);
    navigator.geolocation.clearWatch(watchId);

    // Daten für Stats Screen füllen
    const diff = new Date() - startTime;
    const date = new Date(diff);
    
    display.finalDist.innerText = (totalDistance / 1000).toFixed(1);
    display.finalSpeed.innerText = maxSpeed;
    display.finalTime.innerText = date.toISOString().substr(11, 8);
}

function handleError(error) {
    console.warn('GPS Fehler(' + error.code + '): ' + error.message);
}
