// --- STATE VARIABLES (Speicher) ---
let map = null;
let marker = null;
let watchId = null;
let intervalId = null;
let detailMap = null; // Für die Detail-Ansicht
let startTime = null;
let path = []; // Speichert die Route
let currentDistance = 0;
let currentMaxSpeed = 0;
let isDriving = false;

// --- DOM ELEMENTS (Verknüpfungen zum HTML) ---
// Wir holen uns alle Elemente sicher ab
const app = {
    splash: document.getElementById('splash-screen'),
    nav: document.getElementById('main-nav'),
    
    // Text Elemente
    greet: document.getElementById('greeting-text'),
    locText: document.getElementById('loc-text'),
    tempText: document.getElementById('weather-temp'),
    weatherIcon: document.getElementById('weather-icon'),
    weatherWidget: document.getElementById('status-widget'),

    // Screens
    screens: {
        home: document.getElementById('home-screen'),
        garage: document.getElementById('garage-screen'),
        drive: document.getElementById('drive-screen'),
        summary: document.getElementById('summary-screen'),
        detail: document.getElementById('detail-screen')
    },

    // Display während der Fahrt
    display: {
        speed: document.getElementById('live-speed'),
        time: document.getElementById('live-time'),
        dist: document.getElementById('live-dist'),
        sumDist: document.getElementById('sum-dist'),
        sumSpeed: document.getElementById('sum-speed'),
        sumAvg: document.getElementById('sum-avg'),
        sumTime: document.getElementById('sum-time')
    }
};

// --- STARTUP (Wenn die App lädt) ---
window.addEventListener('load', function() {
    
    // 1. Splash Screen Timer (Logo Animation)
    setTimeout(function() {
        if(app.splash) {
            app.splash.style.opacity = '0';
            setTimeout(function() { app.splash.style.display = 'none'; }, 800);
        }
    }, 2200);

    // 2. Daten laden
    renderGarage();
    updateTimeGreeting();

    // 3. GPS & Wetter starten
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(initWeatherLoc, function(err){
            console.log("GPS Init Error: ", err);
        });
    }
});

// --- WETTER & BEGRÜßUNG ---
function updateTimeGreeting() {
    const h = new Date().getHours();
    let txt = "WELCOME";
    if (h >= 5 && h < 12) txt = "GOOD MORNING";
    else if (h >= 12 && h < 18) txt = "GOOD AFTERNOON";
    else if (h >= 18 && h < 22) txt = "GOOD EVENING";
    else txt = "NIGHT CRUISE";
    
    if(app.greet) app.greet.innerText = txt;
}

function initWeatherLoc(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    
    // 1. Stadt Name holen
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng)
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if(app.locText) app.locText.innerText = d.address.city || d.address.town || "Located";
        })
        .catch(function(e) { console.log("Loc Error", e); });

    // 2. Wetter holen
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current_weather=true')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if(d.current_weather) {
                const t = Math.round(d.current_weather.temperature);
                const c = d.current_weather.weathercode;
                
                if(app.tempText) app.tempText.innerText = t + "°";
                
                // Icon setzen
                let iconClass = "fa-cloud";
                if(c <= 1) iconClass = "fa-sun";
                else if(c <= 3) iconClass = "fa-cloud-sun";
                else if(c <= 60) iconClass = "fa-cloud-rain";
                else if(c <= 80) iconClass = "fa-snowflake";
                else if(c > 80) iconClass = "fa-bolt";

                if(app.weatherIcon) {
                    app.weatherIcon.className = "fa-solid " + iconClass;
                    // Widget sichtbar machen
                    if(app.weatherWidget) app.weatherWidget.style.display = 'flex';
                }
            }
        })
        .catch(function(e) { console.log("Weather Error", e); });
}

// --- NAVIGATION (Buttons unten) ---
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(function(btn) {
    btn.addEventListener('click', function() {
        const targetId = btn.getAttribute('data-target');
        
        // Active Klasse wechseln
        navItems.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');

        // Screen wechseln
        showMainScreen(targetId);
    });
});

function showMainScreen(id) {
    // Verstecke alle Haupt-Screens
    if(app.screens.home) app.screens.home.classList.remove('active');
    if(app.screens.garage) app.screens.garage.classList.remove('active');
    
    // Zeige den gewählten (Schutz vor null)
    const target = id.split('-')[0]; // "home" oder "garage"
    if(app.screens[target]) app.screens[target].classList.add('active');
}

// --- BUTTON EVENT LISTENERS ---

// Start Button
const btnStart = document.getElementById('btn-start');
if(btnStart) {
    btnStart.addEventListener('click', function() {
        app.screens.drive.style.display = 'flex';
        app.nav.style.display = 'none';
        startTracking();
    });
}

// Stop Button
const btnStop = document.getElementById('btn-stop');
if(btnStop) {
    btnStop.addEventListener('click', function() {
        stopTracking();
        app.screens.drive.style.display = 'none';
        app.screens.summary.style.display = 'flex';
    });
}

// Save Button
const btnSave = document.getElementById('btn-save-drive');
if(btnSave) {
    btnSave.addEventListener('click', function() {
        saveDriveToStorage();
        app.screens.summary.style.display = 'none';
        app.nav.style.display = 'flex';
        // Simuliere Klick auf Garage-Button
        const garageBtn = document.querySelectorAll('.nav-item')[1];
        if(garageBtn) garageBtn.click();
    });
}

// Close Detail Button
const btnCloseDetail = document.getElementById('btn-close-detail');
if(btnCloseDetail) {
    btnCloseDetail.addEventListener('click', function() {
        app.screens.detail.style.display = 'none';
        if(detailMap) { detailMap.remove(); detailMap = null; }
    });
}

// Reset Button
const btnReset = document.getElementById('btn-reset-data');
if(btnReset) {
    btnReset.addEventListener('click', function() {
        if(confirm("Alle Fahrten löschen?")) {
            localStorage.removeItem('dh_drives_v2');
            renderGarage();
        }
    });
}

// --- TRACKING ENGINE ---

function startTracking() {
    isDriving = true;
    startTime = new Date();
    path = [];
    currentDistance = 0;
    currentMaxSpeed = 0;

    // Karte initialisieren
    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(map);
        
        const carIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:#4a90e2; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #4a90e2;'></div>",
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        marker = L.marker([0, 0], {icon: carIcon}).addTo(map);
    }
    
    // Fix: Map Größe neu berechnen, da sie vorher unsichtbar war
    setTimeout(function() { map.invalidateSize(); }, 200);

    intervalId = setInterval(updateTimer, 1000);

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(updatePosition, function(err){console.warn(err);}, {
            enableHighAccuracy: true
        });
    }
}

function updatePosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    // Speed in km/h umrechnen (verhindert negative Werte)
    const speedMs = position.coords.speed || 0;
    const speedKmh = Math.max(0, speedMs * 3.6).toFixed(0);

    if (parseFloat(speedKmh) > currentMaxSpeed) currentMaxSpeed = parseFloat(speedKmh);

    // UI Update
    if(app.display.speed) app.display.speed.innerText = speedKmh;
    
    const newLatLng = [lat, lng];
    if(marker) marker.setLatLng(newLatLng);
    if(map) map.setView(newLatLng, 18);

    // Distanz
    if (path.length > 0) {
        // Leaflet distanceTo braucht LatLng Objekt, wir erzeugen eins temporär
        const prev = L.latLng(path[path.length - 1]);
        const curr = L.latLng(newLatLng);
        const dist = prev.distanceTo(curr);
        currentDistance += dist;
        if(app.display.dist) app.display.dist.innerText = (currentDistance / 1000).toFixed(2) + " km";
    }
    path.push(newLatLng);
    
    if(map) L.polyline(path, {color: '#4a90e2', weight: 5, opacity: 0.8}).addTo(map);
}

function updateTimer() {
    const diff = new Date() - startTime;
    const date = new Date(diff);
    // Zeit formatieren
    const timeStr = date.toISOString().substr(11, 8);
    if(app.display.time) app.display.time.innerText = timeStr;
}

function stopTracking() {
    isDriving = false;
    clearInterval(intervalId);
    if(watchId) navigator.geolocation.clearWatch(watchId);

    // Stats berechnen
    const diff = new Date() - startTime;
    const distKm = currentDistance / 1000;
    const durationHours = diff / (1000 * 60 * 60); // ms in stunden
    
    // Durchschnitt berechnen (Schutz vor Division durch 0)
    let avgSpeed = 0;
    if(durationHours > 0 && distKm > 0) {
        avgSpeed = (distKm / durationHours).toFixed(1);
    }

    // UI Updates
    if(app.display.sumDist) app.display.sumDist.innerText = distKm.toFixed(2);
    if(app.display.sumSpeed) app.display.sumSpeed.innerText = currentMaxSpeed;
    if(app.display.sumAvg) app.display.sumAvg.innerText = avgSpeed;
    if(app.display.sumTime) app.display.sumTime.innerText = new Date(diff).toISOString().substr(11, 8);
}

// --- SPEICHERN & LADEN ---

function saveDriveToStorage() {
    const diff = new Date() - startTime;
    const distKm = currentDistance / 1000;
    const durationHours = diff / (1000 * 60 * 60);
    
    let avgSpeed = 0;
    if(durationHours > 0) avgSpeed = (distKm / durationHours).toFixed(1);

    const newDrive = {
        id: Date.now(),
        date: startTime.toISOString(),
        distance: parseFloat(distKm.toFixed(2)),
        maxSpeed: currentMaxSpeed,
        avgSpeed: avgSpeed,
        duration: new Date(diff).toISOString().substr(11, 8),
        pathData: path // Pfad speichern
    };

    // Laden, Hinzufügen, Speichern
    let drives = JSON.parse(localStorage.getItem('dh_drives_v2')) || [];
    drives.unshift(newDrive);
    localStorage.setItem('dh_drives_v2', JSON.stringify(drives));
    
    renderGarage();
}

function renderGarage() {
    let drives = JSON.parse(localStorage.getItem('dh_drives_v2')) || [];
    let totalKm = 0;
    
    const list = document.getElementById('drives-list');
    if(!list) return;
    
    list.innerHTML = '';

    drives.forEach(function(drive) {
        totalKm += drive.distance;
        
        const dateObj = new Date(drive.date);
        const dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        
        const item = document.createElement('div');
        item.className = 'drive-item';
        // HTML für Listenelement
        item.innerHTML = '<div>' +
                         '<h4>' + dateStr + ' • ' + drive.duration + '</h4>' +
                         '<span>Avg ' + drive.avgSpeed + ' km/h</span>' +
                         '</div>' +
                         '<div class="right-side">' +
                         '<span class="dist">' + drive.distance.toFixed(1) + ' km</span>' +
                         '<span>Max ' + drive.maxSpeed + '</span>' +
                         '</div>';
        
        // Klick Event
        item.addEventListener('click', function() { openDetailView(drive); });
        list.appendChild(item);
    });

    const elTotalKm = document.getElementById('total-km');
    const elTotalDrives = document.getElementById('total-drives');
    if(elTotalKm) elTotalKm.innerText = totalKm.toFixed(1);
    if(elTotalDrives) elTotalDrives.innerText = drives.length;
}

// --- DETAIL VIEW ---

function openDetailView(drive) {
    if(app.screens.detail) app.screens.detail.style.display = 'block';
    
    document.getElementById('detail-dist').innerText = drive.distance.toFixed(1);
    document.getElementById('detail-max').innerText = drive.maxSpeed;
    document.getElementById('detail-avg').innerText = drive.avgSpeed;

    // Map Timeout (damit div sichtbar ist)
    setTimeout(function() {
        if(!detailMap) {
            detailMap = L.map('detail-map', { zoomControl: false });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(detailMap);
        }
        
        // Alte Layer entfernen
        detailMap.eachLayer(function(layer) {
            if (!!layer.toGeoJSON) { detailMap.removeLayer(layer); }
        });
        
        // Background Tile wieder hinzufügen (wird manchmal mitgelöscht)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(detailMap);

        // Linie zeichnen
        if(drive.pathData && drive.pathData.length > 0) {
            const polyline = L.polyline(drive.pathData, {color: '#4a90e2', weight: 5}).addTo(detailMap);
            detailMap.fitBounds(polyline.getBounds(), {padding: [50, 50]});
        }
    }, 100);
}
