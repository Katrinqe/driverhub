// --- KONFIGURATION ---
const CONFIG = {
    // OpenStreetMap API für Stadt-Namen (kostenlos)
    geoApi: "https://nominatim.openstreetmap.org/reverse?format=json",
    tileLayer: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// --- GLOBALE VARIABLEN ---
let map, marker, watchId, intervalId, pathLine;
let startTime;
let path = [];
let currentDist = 0;
let currentMaxSpeed = 0;
let isDriving = false;
let hasCityName = false; // Damit wir die Stadt nur 1x abfragen

// --- DOM ELEMENTS ---
const els = {
    screens: {
        home: document.getElementById('home-screen'),
        drive: document.getElementById('drive-ui'),
        garage: document.getElementById('garage-screen'),
        summary: document.getElementById('summary-screen')
    },
    display: {
        speed: document.getElementById('d-speed'),
        time: document.getElementById('d-time'),
        dist: document.getElementById('d-dist'),
        loc: document.getElementById('current-location'),
        greet: document.getElementById('greeting-text')
    },
    summary: {
        dist: document.getElementById('s-dist'),
        speed: document.getElementById('s-speed'),
        avg: document.getElementById('s-avg'),
        time: document.getElementById('s-time')
    },
    nav: document.getElementById('navbar')
};

// --- INITIALISIERUNG ---
window.addEventListener('load', () => {
    initMap();
    setGreeting();
    loadGarage();
    
    // Sofort GPS starten für Hintergrund-Map & Stadt-Name
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(onLocationUpdate, onError, {
            enableHighAccuracy: true,
            maximumAge: 10000
        });
    }
});

function initMap() {
    // Karte erstellen (im Hintergrund Div)
    map = L.map('map-background', {
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: true
    }).setView([51.1657, 10.4515], 13); // Default Start: DE

    L.tileLayer(CONFIG.tileLayer, {
        detectRetina: true,
        maxZoom: 19
    }).addTo(map);

    // Marker Style
    const carIcon = L.divIcon({
        className: 'custom-car-icon',
        html: `<div style="
            width: 20px; height: 20px; 
            background: #4a90e2; 
            border: 3px solid white; 
            border-radius: 50%; 
            box-shadow: 0 0 15px #4a90e2;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    marker = L.marker([0, 0], {icon: carIcon}).addTo(map);
}

function setGreeting() {
    const hour = new Date().getHours();
    let text = "Welcome Back";
    if (hour >= 5 && hour < 12) text = "Good Morning";
    else if (hour >= 12 && hour < 18) text = "Good Afternoon";
    else if (hour >= 18 && hour < 22) text = "Good Evening";
    else text = "Night Rider";
    
    els.display.greet.innerText = text;
}

// --- CORE LOGIK: STANDORT UPDATE ---
function onLocationUpdate(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const speed = Math.max(0, (pos.coords.speed || 0) * 3.6); // km/h
    
    const latLng = [lat, lng];

    // 1. Marker & Map bewegen
    marker.setLatLng(latLng);
    
    // Zoom Logik: Wenn wir fahren nah dran, sonst weiter weg (Übersicht)
    if(isDriving) {
        map.setView(latLng, 18);
    } else {
        // Nur zentrieren, wenn wir noch nie zentriert haben oder Karte weit weg ist
        if(!hasCityName) map.setView(latLng, 15);
    }

    // 2. Stadt Name holen (Nur einmal am Anfang)
    if (!hasCityName) {
        getCityName(lat, lng);
        hasCityName = true;
    }

    // 3. TRACKING (Nur wenn Drive Mode an ist)
    if (isDriving) {
        updateDriveStats(latLng, speed);
    }
}

// Stadtname von API holen
async function getCityName(lat, lng) {
    try {
        const res = await fetch(`${CONFIG.geoApi}&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        // Wir suchen Stadt, Dorf oder Gemeinde
        const city = data.address.city || data.address.town || data.address.village || "Unknown Location";
        els.display.loc.innerText = city;
    } catch (e) {
        els.display.loc.innerText = "GPS Active";
    }
}

function updateDriveStats(latLng, speedKmh) {
    // Max Speed
    if (speedKmh > currentMaxSpeed) currentMaxSpeed = speedKmh;
    
    // Distanz
    if (path.length > 0) {
        const lastPoint = path[path.length - 1];
        const dist = map.distance(lastPoint, latLng);
        currentDist += dist;
    }
    path.push(latLng);

    // UI Updates
    els.display.speed.innerText = speedKmh.toFixed(0);
    els.display.dist.innerText = (currentDist / 1000).toFixed(2) + " km";

    // Linie zeichnen
    if (!pathLine) {
        pathLine = L.polyline(path, {color: '#4a90e2', weight: 5}).addTo(map);
    } else {
        pathLine.setLatLngs(path);
    }
}

// --- BUTTON ACTIONS ---

// START
document.getElementById('btn-start').addEventListener('click', () => {
    isDriving = true;
    startTime = new Date();
    path = [];
    currentDist = 0;
    currentMaxSpeed = 0;
    
    // UI Switch
    switchScreen('drive');
    els.nav.style.display = 'none'; // Nav ausblenden
    
    // Map Filter entfernen (Klar machen)
    document.getElementById('map-background').style.filter = "none";
    
    // Timer starten
    intervalId = setInterval(() => {
        const diff = new Date() - startTime;
        els.display.time.innerText = new Date(diff).toISOString().substr(11, 8);
    }, 1000);
});

// STOP
document.getElementById('btn-stop').addEventListener('click', () => {
    isDriving = false;
    clearInterval(intervalId);
    
    // Summary berechnen
    const diff = new Date() - startTime;
    const distKm = currentDist / 1000;
    const durationHrs = diff / 3600000;
    const avgSpeed = durationHrs > 0 ? (distKm / durationHrs).toFixed(1) : 0;
    
    els.summary.dist.innerText = distKm.toFixed(2);
    els.summary.speed.innerText = currentMaxSpeed.toFixed(0);
    els.summary.avg.innerText = avgSpeed;
    els.summary.time.innerText = new Date(diff).toISOString().substr(11, 8);

    // Map wieder dunkel machen
    document.getElementById('map-background').style.filter = "invert(100%) hue-rotate(180deg) brightness(75%) contrast(85%) grayscale(20%)";
    
    switchScreen('summary');
});

// SAVE & CLOSE
document.getElementById('btn-save').addEventListener('click', () => {
    saveToGarage();
    els.nav.style.display = 'flex'; // Nav wieder an
    
    // Nav Button auf Garage setzen
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.nav-btn')[1].classList.add('active');
    
    switchScreen('garage');
});

// RESET
document.getElementById('btn-reset').addEventListener('click', () => {
    if(confirm("Delete History?")) {
        localStorage.removeItem('dh_garage');
        loadGarage();
    }
});

// NAV SWITCHER
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        
        // Buttons updaten
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Screen wechseln
        switchScreen(target.split('-')[0]);
    });
});

// Helper: Screen Manager
function switchScreen(name) {
    // Alle Overlay-Screens ausblenden
    Object.values(els.screens).forEach(s => s.classList.remove('active'));
    
    // Ziel Screen aktivieren
    if(name === 'home') els.screens.home.classList.add('active');
    if(name === 'drive') els.screens.drive.classList.add('active');
    if(name === 'garage') els.screens.garage.classList.add('active');
    if(name === 'summary') els.screens.summary.classList.add('active');
    
    // Map-Linie entfernen wenn nicht Drive
    if(name !== 'drive' && pathLine) {
        pathLine.remove();
        pathLine = null;
    }
}

// --- DATA STORAGE ---
function saveToGarage() {
    const diff = new Date() - startTime;
    const entry = {
        date: startTime.toISOString(),
        dist: currentDist / 1000,
        max: currentMaxSpeed,
        time: new Date(diff).toISOString().substr(11, 8)
    };
    
    let data = JSON.parse(localStorage.getItem('dh_garage')) || [];
    data.unshift(entry); // Neuester oben
    localStorage.setItem('dh_garage', JSON.stringify(data));
    loadGarage();
}

function loadGarage() {
    const data = JSON.parse(localStorage.getItem('dh_garage')) || [];
    
    // Stats berechnen
    let totalKm = 0;
    data.forEach(d => totalKm += d.dist);
    
    document.getElementById('g-total-km').innerText = totalKm.toFixed(1) + " km";
    document.getElementById('g-total-trips').innerText = data.length;
    
    // Liste rendern
    const list = document.getElementById('drive-list');
    list.innerHTML = '';
    
    data.forEach(d => {
        const date = new Date(d.date);
        const dateStr = date.toLocaleDateString('de-DE', {day: '2-digit', month: 'short'});
        
        const item = document.createElement('div');
        item.className = 'drive-item';
        item.innerHTML = `
            <div>
                <span style="color:white; font-weight:700;">${dateStr}</span>
                <span style="color:#888; font-size:0.8rem; margin-left:10px;">${d.time}</span>
            </div>
            <div style="text-align:right;">
                <span style="color:#4a90e2; font-weight:700;">${d.dist.toFixed(1)} km</span>
            </div>
        `;
        list.appendChild(item);
    });
}

function onError(err) {
    console.warn("GPS Error", err);
    els.display.loc.innerText = "GPS Error";
}
