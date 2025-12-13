// --- STATE VARIABLES ---
let map, marker, watchId, intervalId;
let detailMap, detailPolyline; // Für Detail View
let startTime;
let path = []; // Speichert [lat, lng]
let currentDistance = 0;
let currentMaxSpeed = 0;
let isDriving = false;

// --- DOM ELEMENTS ---
const app = {
    splash: document.getElementById('splash-screen'),
    nav: document.getElementById('main-nav'),
    screens: {
        home: document.getElementById('home-screen'),
        garage: document.getElementById('garage-screen'),
        drive: document.getElementById('drive-screen'),
        summary: document.getElementById('summary-screen'),
        detail: document.getElementById('detail-screen')
    },
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

// --- INIT ---
window.addEventListener('load', () => {
    // 1. Splash Screen Timer
    setTimeout(() => {
        app.splash.style.opacity = '0';
        setTimeout(() => app.splash.style.display = 'none', 800);
    }, 2200); // Intro läuft 2.2 Sekunden

    // 2. Daten laden
    renderGarage();
});

// --- NAVIGATION SYSTEM ---
// Bottom Nav Click Handling
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-target');
        
        // Active State UI
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Screen Switch
        showMainScreen(targetId);
    });
});

function showMainScreen(id) {
    // Nur Home und Garage sind Main Screens
    app.screens.home.classList.remove('active');
    app.screens.garage.classList.remove('active');
    app.screens[id.split('-')[0]].classList.add('active');
}

// Drive UI Actions
document.getElementById('btn-start').addEventListener('click', () => {
    app.screens.drive.style.display = 'flex'; // Overlay an
    app.nav.style.display = 'none'; // Nav ausblenden beim Fahren
    startTracking();
});

document.getElementById('btn-stop').addEventListener('click', () => {
    stopTracking();
    app.screens.drive.style.display = 'none';
    app.screens.summary.style.display = 'flex';
});

document.getElementById('btn-save-drive').addEventListener('click', () => {
    saveDriveToStorage();
    app.screens.summary.style.display = 'none';
    app.nav.style.display = 'flex'; // Nav wieder an
    
    // Gehe zur Garage
    document.querySelectorAll('.nav-item')[1].click(); 
});

// Detail View Actions
document.getElementById('btn-close-detail').addEventListener('click', () => {
    app.screens.detail.style.display = 'none';
    if(detailMap) { detailMap.remove(); detailMap = null; }
});

document.getElementById('btn-reset-data').addEventListener('click', () => {
    if(confirm("Alles löschen?")) {
        localStorage.removeItem('dh_drives_v2');
        renderGarage();
    }
});

// --- TRACKING ENGINE ---

function startTracking() {
    isDriving = true;
    startTime = new Date();
    path = [];
    currentDistance = 0;
    currentMaxSpeed = 0;

    // Map initialisieren
    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(map);
        
        const carIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:#4a90e2; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #4a90e2;'></div>",
            iconSize: [20, 20], iconAnchor: [10, 10]
        });
        marker = L.marker([0, 0], {icon: carIcon}).addTo(map);
    }

    intervalId = setInterval(updateTimer, 1000);

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(updatePosition, handleError, {
            enableHighAccuracy: true, maximumAge: 0
        });
    }
}

function updatePosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const speedMs = position.coords.speed || 0; 
    const speedKmh = Math.max(0, (speedMs * 3.6).toFixed(0));

    if (parseFloat(speedKmh) > currentMaxSpeed) currentMaxSpeed = parseFloat(speedKmh);

    app.display.speed.innerText = speedKmh;
    
    const newLatLng = [lat, lng];
    marker.setLatLng(newLatLng);
    map.setView(newLatLng, 18);

    if (path.length > 0) {
        const lastPoint = path[path.length - 1];
        // Leaflet distanceTo needs LatLng object
        const dist = map.distance(lastPoint, newLatLng);
        currentDistance += dist;
        app.display.dist.innerText = (currentDistance / 1000).toFixed(2) + " km";
    }
    path.push(newLatLng);
    
    // Polyline zeichnen (nur die letzten Punkte um Performance zu sparen, oder alles)
    L.polyline(path, {color: '#4a90e2', weight: 5, opacity: 0.8}).addTo(map);
}

function updateTimer() {
    const diff = new Date() - startTime;
    const date = new Date(diff);
    app.display.time.innerText = date.toISOString().substr(11, 8);
}

function stopTracking() {
    isDriving = false;
    clearInterval(intervalId);
    navigator.geolocation.clearWatch(watchId);

    // Berechnungen für Summary
    const diff = new Date() - startTime; // ms
    const durationHours = diff / (1000 * 60 * 60);
    const distKm = currentDistance / 1000;
    
    let avgSpeed = 0;
    if(durationHours > 0 && distKm > 0) {
        avgSpeed = (distKm / durationHours).toFixed(1);
    }

    // UI füllen
    app.display.sumDist.innerText = distKm.toFixed(2);
    app.display.sumSpeed.innerText = currentMaxSpeed;
    app.display.sumAvg.innerText = avgSpeed;
    app.display.sumTime.innerText = new Date(diff).toISOString().substr(11, 8);
}

function handleError(err) { console.warn(err); }

// --- DATA & STORAGE ---

function saveDriveToStorage() {
    const diff = new Date() - startTime;
    const distKm = currentDistance / 1000;
    const durationHours = diff / (1000 * 60 * 60);
    const avgSpeed = (durationHours > 0) ? (distKm / durationHours).toFixed(1) : 0;

    const newDrive = {
        id: Date.now(),
        date: startTime.toISOString(),
        distance: parseFloat(distKm.toFixed(2)),
        maxSpeed: currentMaxSpeed,
        avgSpeed: avgSpeed,
        duration: new Date(diff).toISOString().substr(11, 8),
        pathData: path // Array von [lat, lng]
    };

    let drives = JSON.parse(localStorage.getItem('dh_drives_v2')) || [];
    drives.unshift(newDrive);
    localStorage.setItem('dh_drives_v2', JSON.stringify(drives));
    renderGarage();
}

function renderGarage() {
    let drives = JSON.parse(localStorage.getItem('dh_drives_v2')) || [];
    let totalKm = 0;
    
    const list = document.getElementById('drives-list');
    list.innerHTML = '';

    drives.forEach(drive => {
        totalKm += drive.distance;
        
        const dateObj = new Date(drive.date);
        const dateStr = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        
        const item = document.createElement('div');
        item.className = 'drive-item';
        item.innerHTML = `
            <div>
                <h4>${dateStr} • ${drive.duration}</h4>
                <span>Avg ${drive.avgSpeed} km/h</span>
            </div>
            <div class="right-side">
                <span class="dist">${drive.distance.toFixed(1)} km</span>
                <span>Max ${drive.maxSpeed}</span>
            </div>
        `;
        
        // Klick Event für Detail View
        item.addEventListener('click', () => openDetailView(drive));
        list.appendChild(item);
    });

    document.getElementById('total-km').innerText = totalKm.toFixed(1);
    document.getElementById('total-drives').innerText = drives.length;
}

// --- DETAIL MAP VIEW ---

function openDetailView(drive) {
    app.screens.detail.style.display = 'block';
    
    // Werte setzen
    document.getElementById('detail-dist').innerText = drive.distance.toFixed(1);
    document.getElementById('detail-max').innerText = drive.maxSpeed;
    document.getElementById('detail-avg').innerText = drive.avgSpeed;

    // Karte Timeout (weil Container erst sichtbar sein muss)
    setTimeout(() => {
        if(!detailMap) {
            detailMap = L.map('detail-map', { zoomControl: false });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(detailMap);
        }
        
        // Alte Layer entfernen
        detailMap.eachLayer((layer) => {
            if (!!layer.toGeoJSON) { detailMap.removeLayer(layer); }
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(detailMap);

        // Pfad zeichnen
        if(drive.pathData && drive.pathData.length > 0) {
            const polyline = L.polyline(drive.pathData, {color: '#4a90e2', weight: 5}).addTo(detailMap);
            detailMap.fitBounds(polyline.getBounds(), {padding: [50, 50]});
        }
    }, 100);
}
