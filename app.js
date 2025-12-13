// --- CONFIG & API ENDPOINTS ---
const CONFIG = {
    geoApi: "https://nominatim.openstreetmap.org/reverse?format=json",
    weatherApi: "https://api.open-meteo.com/v1/forecast?current_weather=true",
    tileLayer: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// --- GLOBALE VARIABLEN ---
let map, marker, watchId, intervalId, pathLine, detailMap;
let startTime;
let path = [];
let currentDist = 0;
let currentMaxSpeed = 0;
let isDriving = false;
let hasLocationData = false; // Damit wir Wetter/Stadt nur 1x laden

// --- DOM ELEMENTE ---
const els = {
    screens: {
        home: document.getElementById('home-screen'),
        drive: document.getElementById('drive-screen'), // Korrigierte ID
        garage: document.getElementById('garage-screen'),
        summary: document.getElementById('summary-screen'),
        detail: document.getElementById('detail-screen')
    },
    display: {
        speed: document.getElementById('d-speed'),
        time: document.getElementById('d-time'),
        dist: document.getElementById('d-dist'),
        loc: document.getElementById('current-location'),
        greet: document.getElementById('greeting-text'),
        temp: document.getElementById('weather-temp'),
        icon: document.getElementById('weather-icon')
    },
    summary: {
        dist: document.getElementById('s-dist'),
        speed: document.getElementById('s-speed'),
        avg: document.getElementById('s-avg'),
        time: document.getElementById('s-time')
    },
    nav: document.getElementById('navbar')
};

// --- STARTUP ---
window.addEventListener('load', () => {
    initMap();
    setGreeting();
    loadGarage();
    
    // GPS Starten (für Hintergrund-Map & Wetter)
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(onLocationUpdate, onError, {
            enableHighAccuracy: true,
            maximumAge: 10000
        });
    }
});

function initMap() {
    map = L.map('map', { // Wir nutzen das Div im Drive-Screen auch für Background
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: true
    }).setView([51.1657, 10.4515], 13); // Start DE

    L.tileLayer(CONFIG.tileLayer, { maxZoom: 19 }).addTo(map);

    const carIcon = L.divIcon({
        className: 'custom-car',
        html: `<div style="width:20px;height:20px;background:#4a90e2;border:3px solid white;border-radius:50%;box-shadow:0 0 15px #4a90e2;"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10]
    });

    marker = L.marker([0, 0], {icon: carIcon}).addTo(map);
}

function setGreeting() {
    const h = new Date().getHours();
    let text = "Welcome";
    if (h >= 5 && h < 12) text = "Good Morning";
    else if (h >= 12 && h < 18) text = "Good Afternoon";
    else if (h >= 18 && h < 22) text = "Good Evening";
    else text = "Night Cruise";
    els.display.greet.innerText = text;
}

// --- CORE: LOCATION UPDATE ---
function onLocationUpdate(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const speed = Math.max(0, (pos.coords.speed || 0) * 3.6);
    const latLng = [lat, lng];

    // Map & Marker bewegen
    marker.setLatLng(latLng);

    if (isDriving) {
        // Drive Mode: Zoom nah dran
        map.setView(latLng, 18);
        updateDriveStats(latLng, speed);
    } else {
        // Menu Mode: Zoom weiter weg (nur beim ersten Mal zentrieren)
        if (!hasLocationData) map.setView(latLng, 15);
    }

    // Wetter & Stadt holen (nur 1x)
    if (!hasLocationData) {
        fetchLocationInfo(lat, lng);
        hasLocationData = true;
    }
}

async function fetchLocationInfo(lat, lng) {
    try {
        // 1. Stadt Name
        const resGeo = await fetch(`${CONFIG.geoApi}&lat=${lat}&lon=${lng}`);
        const dataGeo = await resGeo.json();
        const city = dataGeo.address.city || dataGeo.address.town || dataGeo.address.village || "Unknown Area";
        els.display.loc.innerText = city;

        // 2. Wetter
        const resWeather = await fetch(`${CONFIG.weatherApi}&latitude=${lat}&longitude=${lng}`);
        const dataWeather = await resWeather.json();
        const temp = Math.round(dataWeather.current_weather.temperature);
        const code = dataWeather.current_weather.weathercode;
        
        els.display.temp.innerText = temp + "°";
        
        // Icon Logik (Simpel)
        let iconClass = "fa-cloud";
        if(code <= 1) iconClass = "fa-sun";
        else if(code <= 3) iconClass = "fa-cloud-sun";
        else if(code <= 60) iconClass = "fa-cloud-rain";
        else if(code <= 80) iconClass = "fa-snowflake";
        
        els.display.icon.className = `fa-solid ${iconClass}`;
        
    } catch (e) {
        console.log("Weather/Loc Error", e);
    }
}

function updateDriveStats(latLng, speedKmh) {
    if (speedKmh > currentMaxSpeed) currentMaxSpeed = speedKmh;
    
    // Speed Update
    els.display.speed.innerText = speedKmh.toFixed(0);

    // Distanz
    if (path.length > 0) {
        const last = path[path.length - 1];
        const dist = map.distance(last, latLng);
        currentDist += dist;
        els.display.dist.innerText = (currentDist / 1000).toFixed(2) + " km";
    }
    path.push(latLng);

    // Linie zeichnen
    if (!pathLine) {
        pathLine = L.polyline(path, {color: '#4a90e2', weight: 5}).addTo(map);
    } else {
        pathLine.setLatLngs(path);
    }
}

// --- ACTIONS ---

// START
document.getElementById('btn-start').addEventListener('click', () => {
    isDriving = true;
    startTime = new Date();
    path = [];
    currentDist = 0;
    currentMaxSpeed = 0;

    // UI Switch
    switchScreen('drive');
    els.nav.style.display = 'none';

    // Map "aufwecken" (Filter entfernen)
    document.getElementById('map').style.filter = "none";
    map.invalidateSize(); // Wichtig damit Leaflet weiß, dass es jetzt fullscreen ist

    // Timer
    intervalId = setInterval(() => {
        const diff = new Date() - startTime;
        els.display.time.innerText = new Date(diff).toISOString().substr(11, 8);
    }, 1000);
});

// STOP
document.getElementById('btn-stop').addEventListener('click', () => {
    isDriving = false;
    clearInterval(intervalId);

    // Summary Data
    const diff = new Date() - startTime;
    const distKm = currentDist / 1000;
    const hrs = diff / 3600000;
    const avg = hrs > 0 ? (distKm / hrs).toFixed(1) : 0;

    els.summary.dist.innerText = distKm.toFixed(2);
    els.summary.speed.innerText = currentMaxSpeed.toFixed(0);
    els.summary.avg.innerText = avg;
    els.summary.time.innerText = new Date(diff).toISOString().substr(11, 8);

    // Map wieder "schlafen legen" (Dark Mode)
    document.getElementById('map').style.filter = "invert(100%) hue-rotate(180deg) brightness(85%) contrast(90%)";
    if(pathLine) { pathLine.remove(); pathLine = null; }

    switchScreen('summary');
});

// SAVE
document.getElementById('btn-save').addEventListener('click', () => {
    const diff = new Date() - startTime;
    const entry = {
        date: startTime.toISOString(),
        dist: currentDist / 1000,
        max: currentMaxSpeed,
        path: path // Pfad speichern für Detail View
    };
    
    let data = JSON.parse(localStorage.getItem('dh_garage')) || [];
    data.unshift(entry);
    localStorage.setItem('dh_garage', JSON.stringify(data));
    
    loadGarage();
    els.nav.style.display = 'flex';
    document.querySelectorAll('.nav-btn')[1].click(); // Zu Garage wechseln
});

// RESET
document.getElementById('btn-reset').addEventListener('click', () => {
    if(confirm("Delete All Data?")) {
        localStorage.removeItem('dh_garage');
        loadGarage();
    }
});

// DETAIL VIEW
document.getElementById('btn-close-detail').addEventListener('click', () => {
    els.screens.detail.style.display = 'none';
    if(detailMap) { detailMap.remove(); detailMap = null; }
});

// NAV SWITCHER
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchScreen(target.split('-')[0]);
    });
});

function switchScreen(name) {
    Object.values(els.screens).forEach(s => s.classList.remove('active'));
    // Home und Garage sind "Glas-Overlay" Screens über der Map
    if(name === 'home' || name === 'garage') {
        els.screens[name].classList.add('active');
        // Map Container muss sichtbar sein für den Hintergrund
        document.getElementById('drive-screen').style.display = 'flex'; 
        // Aber Overlay UI verstecken
        document.querySelector('.drive-overlay-top').style.display = 'none';
        document.querySelector('.drive-overlay-bottom').style.display = 'none';
    } 
    else if (name === 'drive') {
        els.screens.drive.classList.add('active');
        document.getElementById('drive-screen').style.display = 'flex';
        document.querySelector('.drive-overlay-top').style.display = 'flex';
        document.querySelector('.drive-overlay-bottom').style.display = 'flex';
    }
    else {
        els.screens[name].classList.add('active');
    }
}

function loadGarage() {
    const data = JSON.parse(localStorage.getItem('dh_garage')) || [];
    let total = 0;
    data.forEach(d => total += d.dist);
    
    document.getElementById('g-total-km').innerText = total.toFixed(1) + " km";
    document.getElementById('g-total-trips').innerText = data.length;

    const list = document.getElementById('drive-list');
    list.innerHTML = '';
    
    data.forEach(d => {
        const date = new Date(d.date).toLocaleDateString('de-DE', {day:'2-digit', month:'short'});
        const div = document.createElement('div');
        div.className = 'drive-item';
        div.innerHTML = `<div><span style="color:white;font-weight:700;">${date}</span></div><div><span style="color:#4a90e2;font-weight:700;">${d.dist.toFixed(1)} km</span></div>`;
        
        div.onclick = () => {
            els.screens.detail.style.display = 'flex';
            document.getElementById('detail-dist').innerText = d.dist.toFixed(1);
            document.getElementById('detail-max').innerText = d.max.toFixed(0);
            
            setTimeout(() => {
                if(!detailMap) {
                    detailMap = L.map('detail-map', {zoomControl:false}).setView([0,0], 13);
                    L.tileLayer(CONFIG.tileLayer).addTo(detailMap);
                }
                detailMap.eachLayer(l => {if(!!l.toGeoJSON) detailMap.removeLayer(l)}); // Clear old lines
                if(d.path && d.path.length) {
                    const line = L.polyline(d.path, {color:'#4a90e2', weight:5}).addTo(detailMap);
                    detailMap.fitBounds(line.getBounds(), {padding:[50,50]});
                }
            }, 200);
        };
        list.appendChild(div);
    });
}

function onError(err) { console.log("GPS Error", err); }
