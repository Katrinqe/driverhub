// --- NAVI ACTIVE LOGIC (3.19.1 - MODULAR) ---
let navMap = null;
let routingControl = null;
let navStartCoords = null; 
let navDestCoords = null;
let searchTimeout = null;
let activeNavWatchId = null;
let currentRouteData = null;
let navMeMarker = null; // Blauer Punkt
let isNavFollowing = true;

// Search Logic
const navInput = document.getElementById('nav-setup-input');
const resultsBox = document.getElementById('nav-api-results');
if(navInput) {
    navInput.addEventListener('input', (e) => {
        const term = e.target.value;
        if(term.length < 3) { resultsBox.style.display = 'none'; return; }
        if(searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${term}`)
                .then(r => r.json()).then(data => {
                    resultsBox.innerHTML = "";
                    if(data.length > 0) {
                        resultsBox.style.display = 'block';
                        data.forEach(place => {
                            const div = document.createElement('div');
                            div.style.padding = "15px"; div.style.borderBottom = "1px solid #444"; div.style.cursor = "pointer"; div.style.color = "white";
                            div.innerText = place.display_name;
                            div.onclick = () => selectDestination(place.lat, place.lon, place.display_name);
                            resultsBox.appendChild(div);
                        });
                    } else { resultsBox.style.display = 'none'; }
                });
        }, 500);
    });
}

function openNaviMode() {
    app.nav.style.display = 'none'; 
    document.getElementById('nav-setup-screen').style.display = 'flex';
    const startText = document.getElementById('nav-setup-start');
    startText.innerText = "Suche GPS..."; startText.style.color = "#888";
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            navStartCoords = [pos.coords.latitude, pos.coords.longitude];
            startText.innerText = "Standort gefunden ✅"; startText.style.color = "#30d158";
        }, err => { startText.innerText = "GPS Fehler"; startText.style.color = "#ff3b30"; }, { enableHighAccuracy: true });
    } else { startText.innerText = "Kein GPS Support"; }
}

function closeNaviSetup() { document.getElementById('nav-setup-screen').style.display = 'none'; app.nav.style.display = 'flex'; }
function selectDestination(lat, lon, name) {
    navDestCoords = [parseFloat(lat), parseFloat(lon)];
    navInput.value = name; resultsBox.style.display = 'none';
    const btn = document.getElementById('btn-launch-route'); if(btn) btn.style.display = 'block';
}

function launchMapNavigation() {
    if(!navStartCoords || !navDestCoords) { alert("Warte auf GPS oder Ziel..."); return; }
    document.getElementById('nav-setup-screen').style.display = 'none';
    app.screens.nav.style.display = 'flex';
    document.getElementById('nav-active-ui').style.display = 'flex';
    isNavFollowing = true;
    document.getElementById('btn-nav-recenter').style.display = 'none';

    setTimeout(() => {
        if(navMap) { navMap.remove(); navMap = null; }
        navMap = L.map('nav-map', { zoomControl: false }).setView(navStartCoords, 18);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(navMap);

        navMap.on('dragstart', () => { isNavFollowing = false; document.getElementById('btn-nav-recenter').style.display = 'flex'; });

        routingControl = L.Routing.control({
            waypoints: [ L.latLng(navStartCoords[0], navStartCoords[1]), L.latLng(navDestCoords[0], navDestCoords[1]) ],
            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
            lineOptions: { styles: [{color: '#30d158', opacity: 0.8, weight: 8}] },
            createGeocoder: function() { return null; }, routeWhileDragging: false, addWaypoints: false, show: false,
            createMarker: function(i, wp) {
                if (i === 0) return null; // Kein Start-Marker, wir nutzen unseren eigenen
                return L.marker(wp.latLng, { draggable: false });
            }
        }).addTo(navMap);

        const iconHtml = '<div class="blue-pulse"></div>';
        const pulseIcon = L.divIcon({ className: 'nav-my-loc', html: iconHtml, iconSize: [20, 20] });
        navMeMarker = L.marker(navStartCoords, { icon: pulseIcon, zIndexOffset: 1000 }).addTo(navMap);

        routingControl.on('routesfound', function(e) {
            const route = e.routes[0]; currentRouteData = route;
            updateNavHUD(route.summary.totalDistance, route.summary.totalTime, "Folge der Route");
        });
        startNavTracking();
    }, 500);
}

function startNavTracking() {
    if(activeNavWatchId) navigator.geolocation.clearWatch(activeNavWatchId);
    activeNavWatchId = navigator.geolocation.watchPosition(pos => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        if(navMeMarker) navMeMarker.setLatLng([lat, lng]);
        if(navMap && isNavFollowing) navMap.setView([lat, lng], 18, { animate: true, duration: 1 });
        checkSpeedLimitNavi(lat, lng);
        if(currentRouteData && currentRouteData.instructions) {
             const nextStep = currentRouteData.instructions[0]; 
             document.getElementById('nav-instruction-text').innerText = nextStep.text || "Dem Straßenverlauf folgen";
        }
    }, err => console.warn(err), { enableHighAccuracy: true, maximumAge: 1000 });
}

function recenterNavMap() {
    isNavFollowing = true; document.getElementById('btn-nav-recenter').style.display = 'none';
    if(navMeMarker) navMap.setView(navMeMarker.getLatLng(), 18, { animate: true });
}

function checkSpeedLimitNavi(lat, lon) {
    const query = `[out:json]; way(around:15, ${lat}, ${lon})["maxspeed"]; out tags;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`).then(r => r.json()).then(data => {
        const sign = document.getElementById('nav-limit-sign');
        const val = document.getElementById('nav-limit-value');
        if(!sign) return;
        if (data.elements && data.elements.length > 0) {
            let speed = data.elements[0].tags.maxspeed;
            if(speed && speed !== "none" && !isNaN(parseInt(speed))) {
                sign.style.display = 'flex'; val.innerText = parseInt(speed); return;
            }
        }
        sign.style.display = 'none';
    }).catch(e => {});
}

function updateNavHUD(dist, time, instr) {
    let distStr = dist > 1000 ? (dist/1000).toFixed(1)+" km" : Math.round(dist)+" m";
    document.getElementById('nav-dist-remaining').innerText = distStr;
    document.getElementById('nav-time-remaining').innerText = Math.round(time/60)+" min";
    if(instr) document.getElementById('nav-instruction-text').innerText = instr;
}

function closeNaviMode() {
    if(activeNavWatchId) { navigator.geolocation.clearWatch(activeNavWatchId); activeNavWatchId = null; }
    document.getElementById('nav-active-ui').style.display = 'none'; app.screens.nav.style.display = 'none'; app.nav.style.display = 'flex'; 
    if(navMap) { navMap.remove(); navMap = null; navMeMarker = null; }
    document.querySelectorAll('.nav-item')[0].click();
}
