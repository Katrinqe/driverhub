// CONFIG
const API = {
    geo: "https://nominatim.openstreetmap.org/reverse?format=json",
    weather: "https://api.open-meteo.com/v1/forecast?current_weather=true",
    tiles: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// STATE
let map, marker, interval, pathLine, detailMap;
let start, path = [], dist = 0, maxSpd = 0, driving = false;
let gotLoc = false;

// DOM
const ui = {
    home: document.getElementById('home-screen'),
    drive: document.getElementById('drive-screen'),
    summ: document.getElementById('summary-screen'),
    gar: document.getElementById('garage-screen'),
    det: document.getElementById('detail-screen'),
    nav: document.getElementById('navbar'),
    loc: document.getElementById('loc-text'),
    weath: document.getElementById('weather-text'),
    icon: document.getElementById('weather-icon'),
    spd: document.getElementById('d-speed'),
    time: document.getElementById('d-time'),
    dist: document.getElementById('d-dist')
};

window.onload = () => {
    // 1. Begrüßung
    const h = new Date().getHours();
    let g = "WELCOME";
    if(h>=5 && h<12) g="GOOD MORNING";
    else if(h>=12 && h<18) g="GOOD AFTERNOON";
    else if(h>=18 && h<22) g="GOOD EVENING";
    document.getElementById('greet-text').innerText = g;

    // 2. Daten laden
    loadGarage();

    // 3. GPS starten
    if(navigator.geolocation) {
        navigator.geolocation.watchPosition(updatePos, err => console.log(err), {enableHighAccuracy:true});
    }
};

function updatePos(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const spd = Math.max(0, (pos.coords.speed || 0)*3.6);

    // Wetter & Stadt (nur 1x)
    if(!gotLoc) {
        gotLoc = true;
        fetch(`${API.geo}&lat=${lat}&lon=${lng}`).then(r=>r.json()).then(d=>{
            ui.loc.innerText = d.address.city || d.address.town || "Unknown";
        });
        fetch(`${API.weather}&latitude=${lat}&longitude=${lng}`).then(r=>r.json()).then(d=>{
            ui.weath.innerText = Math.round(d.current_weather.temperature)+"°";
            const c = d.current_weather.weathercode;
            ui.icon.className = c<=1?"fa-solid fa-sun":"fa-solid fa-cloud";
        });
    }

    // Drive Mode Updates
    if(driving) {
        const pt = [lat, lng];
        marker.setLatLng(pt);
        map.setView(pt, 18);
        
        if(spd > maxSpd) maxSpd = spd;
        ui.spd.innerText = spd.toFixed(0);

        if(path.length>0) {
            dist += map.distance(path[path.length-1], pt);
            ui.dist.innerText = (dist/1000).toFixed(2)+" km";
        }
        path.push(pt);
        if(!pathLine) pathLine = L.polyline(path, {color:'#4a90e2', weight:5}).addTo(map);
        else pathLine.setLatLngs(path);
    }
}

// START
document.getElementById('btn-start').onclick = () => {
    driving = true; start = new Date(); path=[]; dist=0; maxSpd=0;
    
    show('drive-screen');
    ui.nav.style.display='none';
    
    // Init Map if needed
    if(!map) {
        map = L.map('map', {zoomControl:false}).setView([0,0], 13);
        L.tileLayer(API.tiles).addTo(map);
        marker = L.marker([0,0], {icon: L.divIcon({className:'c', html:'<div style="width:20px;height:20px;background:#4a90e2;border:3px solid white;border-radius:50%;"></div>'})}).addTo(map);
    }
    map.invalidateSize();

    interval = setInterval(() => {
        const d = new Date(new Date()-start);
        ui.time.innerText = d.toISOString().substr(11,8);
    }, 1000);
};

// STOP
document.getElementById('btn-stop').onclick = () => {
    driving = false; clearInterval(interval);
    
    const d = new Date(new Date()-start);
    document.getElementById('s-dist').innerText = (dist/1000).toFixed(2)+" km";
    document.getElementById('s-speed').innerText = maxSpd.toFixed(0);
    document.getElementById('s-time').innerText = d.toISOString().substr(11,8);
    
    if(pathLine) { pathLine.remove(); pathLine=null; }
    show('summary-screen');
};

// SAVE
document.getElementById('btn-save').onclick = () => {
    const entry = {
        d: new Date().toISOString(),
        km: dist/1000,
        mx: maxSpd,
        pt: path
    };
    let data = JSON.parse(localStorage.getItem('gh_data')) || [];
    data.unshift(entry);
    localStorage.setItem('gh_data', JSON.stringify(data));
    loadGarage();
    
    ui.nav.style.display='flex';
    document.querySelectorAll('.nav-btn')[1].click(); // Goto Garage
};

// NAV
document.querySelectorAll('.nav-btn').forEach(b => {
    b.onclick = () => {
        document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        show(b.getAttribute('data-target'));
    };
});

function show(id) {
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('active');
}

function loadGarage() {
    const data = JSON.parse(localStorage.getItem('gh_data')) || [];
    let tot=0; data.forEach(x=>tot+=x.km);
    document.getElementById('g-total').innerText = tot.toFixed(1);
    
    const l = document.getElementById('garage-list'); l.innerHTML='';
    data.forEach(x => {
        const div = document.createElement('div');
        div.className='drive-item';
        div.innerHTML = `<span>${new Date(x.d).toLocaleDateString()}</span><span style="color:#4a90e2;font-weight:700">${x.km.toFixed(1)} km</span>`;
        div.onclick = () => openDetail(x);
        l.appendChild(div);
    });
}

function openDetail(x) {
    show('detail-screen');
    document.getElementById('det-info').innerText = `${x.km.toFixed(1)} km • Max ${x.mx.toFixed(0)}`;
    ui.nav.style.display='none';
    
    setTimeout(() => {
        if(!detailMap) { detailMap = L.map('detail-map',{zoomControl:false}); L.tileLayer(API.tiles).addTo(detailMap); }
        detailMap.eachLayer(l=>{if(!!l.toGeoJSON) detailMap.removeLayer(l)});
        if(x.pt && x.pt.length) {
            const line = L.polyline(x.pt, {color:'#4a90e2', weight:5}).addTo(detailMap);
            detailMap.fitBounds(line.getBounds(), {padding:[50,50]});
        }
    }, 200);
}

document.getElementById('btn-back').onclick = () => {
    ui.nav.style.display='flex';
    document.querySelectorAll('.nav-btn')[1].click();
};
document.getElementById('btn-reset').onclick = () => {
    if(confirm('Clear?')) { localStorage.removeItem('gh_data'); loadGarage(); }
};
