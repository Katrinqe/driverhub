let map, marker, watchId, intervalId, detailMap;
let startTime, path = [], currentDistance = 0, currentMaxSpeed = 0, isDriving = false;
let isMapFollowing = true; 
let currentLat = 0, currentLng = 0;
let lastLimitCheck = 0;

document.getElementById('btn-start').addEventListener('click', () => { app.screens.drive.style.display = 'flex'; app.nav.style.display = 'none'; startTracking(); });
document.getElementById('btn-stop').addEventListener('click', () => { stopTracking(); app.screens.drive.style.display = 'none'; app.screens.summary.style.display = 'flex'; });
document.getElementById('btn-save-drive').addEventListener('click', () => { saveDriveToStorage(); app.screens.summary.style.display = 'none'; app.nav.style.display = 'flex'; document.querySelectorAll('.nav-item')[4].click(); });
document.getElementById('btn-close-detail').addEventListener('click', () => { app.screens.detail.style.display = 'none'; if(detailMap) { detailMap.remove(); detailMap = null; } });
document.getElementById('btn-reset-data').addEventListener('click', () => { if(confirm("Alles löschen?")) { localStorage.removeItem('dh_drives_v2'); renderGarage(); } });

// --- TRACKING ---
function startTracking() { 
    isDriving = true; startTime = new Date(); path = []; currentDistance = 0; currentMaxSpeed = 0; isMapFollowing = true; 
    document.getElementById('btn-recenter').style.display = 'none'; 
    if (map) { map.remove(); map = null; }
    const mapContainer = document.getElementById('map'); if (mapContainer) { mapContainer.innerHTML = ""; }
    setTimeout(() => {
        map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13); 
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map); 
        marker = L.marker([0, 0], {icon: L.divIcon({className: 'c', html: "<div style='background-color:#4a90e2; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #4a90e2;'></div>", iconSize: [20, 20]})}).addTo(map); 
        map.on('dragstart', () => { if(isDriving) { isMapFollowing = false; document.getElementById('btn-recenter').style.display = 'flex'; } });
        map.invalidateSize(); intervalId = setInterval(updateTimer, 1000); 
        if (navigator.geolocation) { watchId = navigator.geolocation.watchPosition(updatePosition, err => console.warn(err), {enableHighAccuracy: true}); } 
    }, 500); 
}

function triggerRecenter(e) { if(e) { e.stopPropagation(); e.preventDefault(); } isMapFollowing = true; document.getElementById('btn-recenter').style.display = 'none'; if(map && currentLat !== 0 && currentLng !== 0) { map.setView([currentLat, currentLng], 18); } }
function updatePosition(position) { 
    if (!map) return; 
    const lat = position.coords.latitude; const lng = position.coords.longitude; currentLat = lat; currentLng = lng;
    const speedKmh = Math.max(0, (position.coords.speed || 0) * 3.6).toFixed(0); 
    if (parseFloat(speedKmh) > currentMaxSpeed) currentMaxSpeed = parseFloat(speedKmh); 
    app.display.speed.innerText = speedKmh; 
    const newLatLng = [lat, lng]; if(marker) marker.setLatLng(newLatLng); 
    if(isDriving) { checkSpeedLimit(lat, lng); }
    if(isMapFollowing) { map.setView(newLatLng, 18); }
    path.push(newLatLng);
}
function updateTimer() { const diff = new Date() - startTime; app.display.time.innerText = new Date(diff).toISOString().substr(11, 8); }
function stopTracking() { isDriving = false; clearInterval(intervalId); if(watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; } if(map) { map.remove(); map = null; marker = null; } const diff = new Date() - startTime; const distKm = currentDistance / 1000; const durationHours = diff / (1000 * 60 * 60); const avgSpeed = (durationHours > 0) ? (distKm / durationHours).toFixed(1) : 0; app.display.sumDist.innerText = distKm.toFixed(2); app.display.sumSpeed.innerText = currentMaxSpeed; app.display.sumAvg.innerText = avgSpeed; app.display.sumTime.innerText = new Date(diff).toISOString().substr(11, 8); }

// --- GARAGE LIST ---
function saveDriveToStorage() { const diff = new Date() - startTime; const distKm = currentDistance / 1000; const durationHours = diff / (1000 * 60 * 60); const avgSpeed = (durationHours > 0) ? (distKm / durationHours).toFixed(1) : 0; const newDrive = { id: Date.now(), date: startTime.toISOString(), distance: parseFloat(distKm.toFixed(2)), maxSpeed: currentMaxSpeed, avgSpeed: avgSpeed, duration: new Date(diff).toISOString().substr(11, 8), pathData: path }; let drives = JSON.parse(localStorage.getItem('dh_drives_v2')) || []; drives.unshift(newDrive); localStorage.setItem('dh_drives_v2', JSON.stringify(drives)); renderGarage(); }
function renderGarage() { let drives = JSON.parse(localStorage.getItem('dh_drives_v2')) || []; let totalKm = 0; const list = document.getElementById('drives-list'); list.innerHTML = ''; drives.forEach(drive => { totalKm += drive.distance; const dateStr = new Date(drive.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); const item = document.createElement('div'); item.className = 'drive-item'; item.innerHTML = `<div><h5>${dateStr} • ${drive.duration}</h4><span>Avg ${drive.avgSpeed} km/h</span></div><div class="right-side"><span class="dist">${drive.distance.toFixed(1)} km</span><span>Max ${drive.maxSpeed}</span></div>`; item.addEventListener('click', () => openDetailView(drive)); list.appendChild(item); }); document.getElementById('total-km').innerText = totalKm.toFixed(1); document.getElementById('total-drives').innerText = drives.length; }
function openDetailView(drive) { app.screens.detail.style.display = 'block'; document.getElementById('detail-dist').innerText = drive.distance.toFixed(1); document.getElementById('detail-max').innerText = drive.maxSpeed; document.getElementById('detail-avg').innerText = drive.avgSpeed; setTimeout(() => { if(!detailMap) { detailMap = L.map('detail-map', { zoomControl: false }); L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(detailMap); } detailMap.eachLayer((layer) => { if (!!layer.toGeoJSON) { detailMap.removeLayer(layer); } }); if(drive.pathData && drive.pathData.length > 0) { const polyline = L.polyline(drive.pathData, {color: '#4a90e2', weight: 5}).addTo(detailMap); detailMap.fitBounds(polyline.getBounds(), {padding: [50, 50]}); } }, 100); }

// --- SPEED LIMIT API (Shared) ---
function checkSpeedLimit(lat, lon) { const now = Date.now(); if (now - lastLimitCheck < 8000) return; lastLimitCheck = now; const query = `[out:json]; way(around:15, ${lat}, ${lon})["maxspeed"]; out tags;`; const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`; fetch(url).then(response => response.json()).then(data => { if (data.elements && data.elements.length > 0) { let speed = data.elements[0].tags.maxspeed; if(speed === "none") { document.getElementById('limit-sign').style.display = 'none'; } else { speed = parseInt(speed); if(!isNaN(speed)) { document.getElementById('limit-sign').style.display = 'flex'; document.getElementById('limit-value').innerText = speed; } } } else { document.getElementById('limit-sign').style.display = 'none'; } }).catch(err => console.log("Limit API Error:", err)); }
