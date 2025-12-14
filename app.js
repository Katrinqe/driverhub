// --- STATE VARIABLES ---
let map, marker, watchId, intervalId;
let detailMap;
let startTime;
let path = [];
let currentDistance = 0;
let currentMaxSpeed = 0;
let isDriving = false;

// --- DOM ELEMENTS ---
const app = {
    splash: document.getElementById('splash-screen'),
    nav: document.getElementById('main-nav'),
    greet: document.getElementById('greeting-text'),
    locText: document.getElementById('loc-text'),
    tempText: document.getElementById('weather-temp'),
    weatherIcon: document.getElementById('weather-icon'),
    weatherWidget: document.getElementById('status-widget'), // ID korrigiert

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
    // 1. SPLASH SCREEN (WICHTIG!)
    setTimeout(() => {
        app.splash.style.opacity = '0';
        setTimeout(() => app.splash.style.display = 'none', 800);
    }, 2200);

    // 2. Data & UI
    renderGarage();
    updateTimeGreeting();

    // 3. GPS & Wetter
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(initWeatherLoc, err => console.log(err));
    }
});

// --- WEATHER & GREETING ---
function updateTimeGreeting() {
    const h = new Date().getHours();
    let txt = "WELCOME";
    if (h >= 5 && h < 12) txt = "GOOD MORNING";
    else if (h >= 12 && h < 18) txt = "GOOD AFTERNOON";
    else if (h >= 18 && h < 22) txt = "GOOD EVENING";
    else txt = "NIGHT CRUISE";
    app.greet.innerText = txt;
}

function initWeatherLoc(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    
    // City
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(r => r.json())
        .then(d => {
            app.locText.innerText = d.address.city || d.address.town || "Location Found";
        });

    // Weather
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
        .then(r => r.json())
        .then(d => {
            const t = Math.round(d.current_weather.temperature);
            const c = d.current_weather.weathercode;
            app.tempText.innerText = t + "°";
            
            if(c <= 1) app.weatherIcon.className = "fa-solid fa-sun";
            else if(c <= 3) app.weatherIcon.className = "fa-solid fa-cloud-sun";
            else app.weatherIcon.className = "fa-solid fa-cloud";
        });
}

// --- NAV & SCREENS ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-target');
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showMainScreen(targetId);
    });
});

function showMainScreen(id) {
    app.screens.home.classList.remove('active');
    app.screens.garage.classList.remove('active');
    app.screens[id.split('-')[0]].classList.add('active');
}

// --- ACTIONS ---
document.getElementById('btn-start').addEventListener('click', () => {
    app.screens.drive.style.display = 'flex';
    app.nav.style.display = 'none';
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
    app.nav.style.display = 'flex';
    document.querySelectorAll('.nav-item')[1].click(); 
});

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

// --- TRACKING ---
function startTracking() {
    isDriving = true;
    startTime = new Date();
    path = [];
    currentDistance = 0;
    currentMaxSpeed = 0;

    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(map);
        marker = L.marker([0, 0], {icon: L.divIcon({className: 'c', html: "<div style='background-color:#4a90e2; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #4a90e2;'></div>", iconSize: [20, 20]})}).addTo(map);
    }
    
    setTimeout(() => { map.invalidateSize(); }, 200);
    intervalId = setInterval(updateTimer, 1000);

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(updatePosition, handleError, {enableHighAccuracy: true});
    }
}

function updatePosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const speedKmh = Math.max(0, (position.coords.speed || 0) * 3.6).toFixed(0);

    if (parseFloat(speedKmh) > currentMaxSpeed) currentMaxSpeed = parseFloat(speedKmh);
    app.display.speed.innerText = speedKmh;
    
    const newLatLng = [lat, lng];
    marker.setLatLng(newLatLng);
    map.setView(newLatLng, 18);

    if (path.length > 0) {
        currentDistance += map.distance(path[path.length - 1], newLatLng);
        app.display.dist.innerText = (currentDistance / 1000).toFixed(2) + " km";
    }
    path.push(newLatLng);
    L.polyline(path, {color: '#4a90e2', weight: 5}).addTo(map);
}

function updateTimer() {
    const diff = new Date() - startTime;
    app.display.time.innerText = new Date(diff).toISOString().substr(11, 8);
}

function stopTracking() {
    isDriving = false;
    clearInterval(intervalId);
    navigator.geolocation.clearWatch(watchId);

    const diff = new Date() - startTime;
    const distKm = currentDistance / 1000;
    const durationHours = diff / (1000 * 60 * 60);
    const avgSpeed = (durationHours > 0) ? (distKm / durationHours).toFixed(1) : 0;

    app.display.sumDist.innerText = distKm.toFixed(2);
    app.display.sumSpeed.innerText = currentMaxSpeed;
    app.display.sumAvg.innerText = avgSpeed;
    app.display.sumTime.innerText = new Date(diff).toISOString().substr(11, 8);
}

function handleError(err) { console.warn(err); }

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
        const dateStr = new Date(drive.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        
        const item = document.createElement('div');
        item.className = 'drive-item';
        item.innerHTML = `<div><h4>${dateStr} • ${drive.duration}</h4><span>Avg ${drive.avgSpeed} km/h</span></div><div class="right-side"><span class="dist">${drive.distance.toFixed(1)} km</span><span>Max ${drive.maxSpeed}</span></div>`;
        item.addEventListener('click', () => openDetailView(drive));
        list.appendChild(item);
    });

    document.getElementById('total-km').innerText = totalKm.toFixed(1);
    document.getElementById('total-drives').innerText = drives.length;
}

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
        detailMap.eachLayer((layer) => { if (!!layer.toGeoJSON) { detailMap.removeLayer(layer); } });
        if(drive.pathData && drive.pathData.length > 0) {
            const polyline = L.polyline(drive.pathData, {color: '#4a90e2', weight: 5}).addTo(detailMap);
            detailMap.fitBounds(polyline.getBounds(), {padding: [50, 50]});
        }
    }, 100);
}
