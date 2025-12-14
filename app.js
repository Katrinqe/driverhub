// --- STATE ---
let map, marker, watchId, intervalId, detailMap;
let startTime, path = [], currentDistance = 0, currentMaxSpeed = 0, isDriving = false;

// --- DOM ELEMENTS ---
const app = {
    splash: document.getElementById('splash-screen'),
    nav: document.getElementById('main-nav'),
    greet: document.getElementById('greeting-text'),
    locText: document.getElementById('loc-text'),
    tempText: document.getElementById('weather-temp'),
    weatherIcon: document.getElementById('weather-icon'),
    weatherWidget: document.getElementById('status-widget'),
    
    // NEW MACHINE INPUTS
    carInput: document.getElementById('car-name-input'),
    carTypeBtn: document.getElementById('btn-car-type'),
    carIcon: document.getElementById('car-icon'),

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
    setTimeout(() => {
        app.splash.style.opacity = '0';
        setTimeout(() => app.splash.style.display = 'none', 800);
    }, 2200);

    renderGarage();
    updateTimeGreeting();
    loadCarSettings(); // Lade Auto-Info

    if(navigator.geolocation) navigator.geolocation.getCurrentPosition(initWeatherLoc, err => console.log(err));
});

// --- MACHINE LOGIC ---
const iconTypes = ["fa-car", "fa-car-side", "fa-truck-pickup", "fa-motorcycle"];
let currentIconIndex = 0;

// Load saved data
function loadCarSettings() {
    const savedName = localStorage.getItem('dh_car_name');
    const savedType = localStorage.getItem('dh_car_type');
    
    if(savedName) app.carInput.value = savedName;
    if(savedType) {
        currentIconIndex = iconTypes.indexOf(savedType);
        if(currentIconIndex === -1) currentIconIndex = 0;
        app.carIcon.className = `fa-solid ${iconTypes[currentIconIndex]}`;
    }
}

// Icon Switcher click
app.carTypeBtn.addEventListener('click', () => {
    currentIconIndex = (currentIconIndex + 1) % iconTypes.length;
    const newClass = iconTypes[currentIconIndex];
    app.carIcon.className = `fa-solid ${newClass}`;
    localStorage.setItem('dh_car_type', newClass);
});

// Name Input save on change
app.carInput.addEventListener('input', () => {
    localStorage.setItem('dh_car_name', app.carInput.value);
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
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`).then(r => r.json()).then(d => {
        app.locText.innerText = d.address.city || d.address.town || "Located";
    });
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`).then(r => r.json()).then(d => {
        const t = Math.round(d.current_weather.temperature);
        const c = d.current_weather.weathercode;
        app.tempText.innerText = t + "°";
        app.weatherIcon.className = c<=1?"fa-solid fa-sun":c<=3?"fa-solid fa-cloud-sun":"fa-solid fa-cloud";
    });
}

// --- NAV & ACTIONS (STANDARD) ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showMainScreen(btn.getAttribute('data-target'));
    });
});

function showMainScreen(id) {
    app.screens.home.classList.remove('active');
    app.screens.garage.classList.remove('active');
    app.screens[id.split('-')[0]].classList.add('active');
}

document.getElementById('btn-start').addEventListener('click', () => {
    app.screens.drive.style.display = 'flex'; app.nav.style.display = 'none'; startTracking();
});

document.getElementById('btn-stop').addEventListener('click', () => {
    stopTracking(); app.screens.drive.style.display = 'none'; app.screens.summary.style.display = 'flex';
});

document.getElementById('btn-save-drive').addEventListener('click', () => {
    saveDriveToStorage(); app.screens.summary.style.display = 'none'; app.nav.style.display = 'flex';
    document.querySelectorAll('.nav-item')[1].click(); 
});

document.getElementById('btn-close-detail').addEventListener('click', () => {
    app.screens.detail.style.display = 'none'; if(detailMap) { detailMap.remove(); detailMap = null; }
});

document.getElementById('btn-reset-data').addEventListener('click', () => {
    if(confirm("Reset All?")) { localStorage.removeItem('dh_drives_v2'); renderGarage(); }
});

// --- TRACKING ---
function startTracking() {
    isDriving = true; startTime = new Date(); path = []; currentDistance = 0; currentMaxSpeed = 0;
    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(map);
        marker = L.marker([0, 0], {icon: L.divIcon({className: 'c', html: "<div style='background-color:#4a90e2;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 15px #4a90e2'></div>", iconSize: [20, 20]})}).addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 200);
    intervalId = setInterval(() => {
        const diff = new Date() - startTime;
        app.display.time.innerText = new Date(diff).toISOString().substr(11, 8);
    }, 1000);
    if (navigator.geolocation) watchId = navigator.geolocation.watchPosition(updatePosition, handleError, {enableHighAccuracy: true});
}

function updatePosition(pos) {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    const s = Math.max(0, (pos.coords.speed || 0) * 3.6).toFixed(0);
    if (parseFloat(s) > currentMaxSpeed) currentMaxSpeed = parseFloat(s);
    app.display.speed.innerText = s;
    const pt = [lat, lng]; marker.setLatLng(pt); map.setView(pt, 18);
    if (path.length > 0) {
        currentDistance += map.distance(path[path.length - 1], pt);
        app.display.dist.innerText = (currentDistance / 1000).toFixed(2) + " km";
    }
    path.push(pt);
    L.polyline(path, {color: '#4a90e2', weight: 5}).addTo(map);
}

function stopTracking() {
    isDriving = false; clearInterval(intervalId); navigator.geolocation.clearWatch(watchId);
    const diff = new Date() - startTime;
    const dist = currentDistance / 1000;
    const dur = diff / 3600000;
    app.display.sumDist.innerText = dist.toFixed(2);
    app.display.sumSpeed.innerText = currentMaxSpeed;
    app.display.sumAvg.innerText = dur > 0 ? (dist / dur).toFixed(1) : 0;
    app.display.sumTime.innerText = new Date(diff).toISOString().substr(11, 8);
}

function handleError(err) { console.warn(err); }

function saveDriveToStorage() {
    const diff = new Date() - startTime;
    const dist = currentDistance / 1000;
    const dur = diff / 3600000;
    const drive = {
        id: Date.now(), date: startTime.toISOString(), distance: parseFloat(dist.toFixed(2)),
        maxSpeed: currentMaxSpeed, avgSpeed: dur > 0 ? (dist / dur).toFixed(1) : 0,
        duration: new Date(diff).toISOString().substr(11, 8), pathData: path
    };
    let d = JSON.parse(localStorage.getItem('dh_drives_v2')) || [];
    d.unshift(drive); localStorage.setItem('dh_drives_v2', JSON.stringify(d));
    renderGarage();
}

function renderGarage() {
    let d = JSON.parse(localStorage.getItem('dh_drives_v2')) || [];
    let t = 0; const list = document.getElementById('drives-list'); list.innerHTML = '';
    d.forEach(x => {
        t += x.distance;
        const div = document.createElement('div'); div.className = 'drive-item';
        div.innerHTML = `<div><h4>${new Date(x.date).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})} • ${x.duration}</h4><span>Avg ${x.avgSpeed} km/h</span></div><div class="right-side"><span class="dist">${x.distance.toFixed(1)} km</span><span>Max ${x.maxSpeed}</span></div>`;
        div.onclick = () => openDetailView(x);
        list.appendChild(div);
    });
    document.getElementById('total-km').innerText = t.toFixed(1);
    document.getElementById('total-drives').innerText = d.length;
}

function openDetailView(x) {
    app.screens.detail.style.display = 'block';
    document.getElementById('detail-dist').innerText = x.distance.toFixed(1);
    document.getElementById('detail-max').innerText = x.maxSpeed;
    document.getElementById('detail-avg').innerText = x.avgSpeed;
    setTimeout(() => {
        if(!detailMap) { detailMap = L.map('detail-map', { zoomControl: false }); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMap); }
        detailMap.eachLayer(l => { if (!!l.toGeoJSON) detailMap.removeLayer(l); });
        if(x.pathData && x.pathData.length) {
            const line = L.polyline(x.pathData, {color: '#4a90e2', weight: 5}).addTo(detailMap);
            detailMap.fitBounds(line.getBounds(), {padding: [50, 50]});
        }
    }, 100);
}
