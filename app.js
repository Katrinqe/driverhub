// --- STATE VARIABLES ---
let map, marker, watchId, intervalId;
let detailMap, detailPolyline; 
let startTime;
let path = []; 
let currentDistance = 0;
let currentMaxSpeed = 0;
let isDriving = false;

// --- DOM ELEMENTS ---
const app = {
    splash: document.getElementById('splash-screen'),
    nav: document.getElementById('main-nav'),
    welcomeMsg: document.getElementById('welcome-msg'), // Neu für Begrüßung
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

// --- INIT (Startsequenz) ---
window.addEventListener('load', () => {
    // 1. Smart Greeting setzen
    setSmartGreeting();

    // 2. Splash Screen entfernen nach Animation
    setTimeout(() => {
        app.splash.style.opacity = '0';
        setTimeout(() => app.splash.style.display = 'none', 800);
    }, 2200); 

    // 3. Daten aus Speicher laden
    renderGarage();
});

// --- SMART GREETING LOGIC ---
function setSmartGreeting() {
    const hour = new Date().getHours();
    let greeting = "SYSTEM ONLINE";

    if (hour >= 5 && hour < 12) {
        greeting = "GOOD MORNING, DRIVER";
    } else if (hour >= 12 && hour < 18) {
        greeting = "READY FOR THE ROAD?";
    } else if (hour >= 18 && hour < 22) {
        greeting = "GOOD EVENING";
    } else {
        greeting = "NIGHT RIDER MODE";
    }
    
    app.welcomeMsg.innerText = "INITIALIZING...";
    
    // Kleiner "Hack"-Effekt: Text wechselt nach kurzem Delay
    setTimeout(() => {
        app.welcomeMsg.innerText = greeting;
        app.welcomeMsg.style.opacity = 1; 
    }, 1500);
}

// --- NAVIGATION SYSTEM ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Button Click Animation verhindern wenn schon aktiv
        if(btn.classList.contains('active')) return;

        const targetId = btn.getAttribute('data-target');
        
        // Active State UI
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Screen Switch
        showMainScreen(targetId);
    });
});

function showMainScreen(id) {
    app.screens.home.classList.remove('active');
    app.screens.garage.classList.remove('active');
    app.screens[id.split('-')[0]].classList.add('active'); // home-screen -> home
}

// Drive UI Actions
document.getElementById('btn-start').addEventListener('click', () => {
    // Kurzes Feedback bevor es losgeht
    const btn = document.getElementById('btn-start');
    btn.innerText = "IGNITION...";
    
    setTimeout(() => {
        app.screens.drive.style.display = 'flex'; 
        app.nav.style.display = 'none'; 
        startTracking();
        btn.innerText = "START ENGINE"; // Reset Text
    }, 800);
});

document.getElementById('btn-stop').addEventListener('click', () => {
    stopTracking();
    app.screens.drive.style.display = 'none';
    app.screens.summary.style.display = 'flex';
});

document.getElementById('btn-save-drive').addEventListener('click', () => {
    saveDriveToStorage();
    app.screens.summary.style.display = 'none';
    app.nav.style.display = 'flex'; 
    
    // Automatisch zur Garage wechseln
    document.querySelectorAll('.nav-item')[1].click(); 
});

// Detail View Actions
document.getElementById('btn-close-detail').addEventListener('click', () => {
    app.screens.detail.style.display = 'none';
    if(detailMap) { detailMap.remove(); detailMap = null; }
});

document.getElementById('btn-reset-data').addEventListener('click', () => {
    if(confirm("Factory Reset: Alle Fahrten löschen?")) {
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
        // Dark Mode Map Layer
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
        const dist = map.distance(lastPoint, newLatLng);
        currentDistance += dist;
        app.display.dist.innerText = (currentDistance / 1000).toFixed(2) + " km";
    }
    path.push(newLatLng);
    
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

    const diff = new Date() - startTime;
    const durationHours = diff / (1000 * 60 * 60);
    const distKm = currentDistance / 1000;
    
    let avgSpeed = 0;
    if(durationHours > 0 && distKm > 0) {
        avgSpeed = (distKm / durationHours).toFixed(1);
    }

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
        pathData: path 
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
                <h4 style="color:white; margin-bottom:4px;">${dateStr} • ${drive.duration}</h4>
                <span style="color:#888; font-size:0.8rem;">Avg ${drive.avgSpeed} km/h</span>
            </div>
            <div class="right-side" style="text-align:right;">
                <span class="dist" style="color:#4a90e2; font-weight:700; font-size:1.1rem; display:block;">${drive.distance.toFixed(1)} km</span>
                <span style="color:#666; font-size:0.8rem;">Max ${drive.maxSpeed}</span>
            </div>
        `;
        
        item.addEventListener('click', () => openDetailView(drive));
        list.appendChild(item);
    });

    document.getElementById('total-km').innerText = totalKm.toFixed(1);
    document.getElementById('total-drives').innerText = drives.length;
}

// --- DETAIL MAP VIEW ---

function openDetailView(drive) {
    app.screens.detail.style.display = 'block';
    
    document.getElementById('detail-dist').innerText = drive.distance.toFixed(1);
    document.getElementById('detail-max').innerText = drive.maxSpeed;
    document.getElementById('detail-avg').innerText = drive.avgSpeed;

    setTimeout(() => {
        if(!detailMap) {
            detailMap = L.map('detail-map', { zoomControl: false });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(detailMap);
        }
        
        detailMap.eachLayer((layer) => {
            if (!!layer.toGeoJSON) { detailMap.removeLayer(layer); }
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(detailMap);

        if(drive.pathData && drive.pathData.length > 0) {
            const polyline = L.polyline(drive.pathData, {color: '#4a90e2', weight: 5}).addTo(detailMap);
            detailMap.fitBounds(polyline.getBounds(), {padding: [50, 50]});
        }
    }, 100);
}
