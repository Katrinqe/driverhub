let tracking = false;
let watchID = null;

const speedEl = document.getElementById("speed");
const distanceEl = document.getElementById("distance");
const timeEl = document.getElementById("time");

let startTime = 0;
let totalDistance = 0;
let lastPos = null;

// Leaflet Map
const map = L.map('map').setView([0,0], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

document.getElementById("startDrive").addEventListener("click", () => {
  if (!tracking) {
    startDrive();
  } else {
    stopDrive();
  }
});

function startDrive() {
  tracking = true;
  startTime = Date.now();
  totalDistance = 0;
  lastPos = null;
  document.getElementById("startDrive").innerText = "Stop Drive";

  if (navigator.geolocation) {
    watchID = navigator.geolocation.watchPosition(updatePosition, err => {
      alert("GPS Error: " + err.message);
    }, { enableHighAccuracy: true });
  } else {
    alert("GPS not supported");
  }
}

function stopDrive() {
  tracking = false;
  navigator.geolocation.clearWatch(watchID);
  document.getElementById("startDrive").innerText = "Start Drive";
}

function updatePosition(pos) {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  const speed = pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(1) : 0;

  speedEl.innerText = speed;

  if (lastPos) {
    const R = 6371; // km
    const dLat = (lat - lastPos.lat) * Math.PI / 180;
    const dLon = (lon - lastPos.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lastPos.lat*Math.PI/180) * Math.cos(lat*Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    totalDistance += d;
  }

  lastPos = { lat, lon };
  distanceEl.innerText = totalDistance.toFixed(2);

  const elapsed = (Date.now() - startTime) / 60000;
  timeEl.innerText = elapsed.toFixed(1);

  // Map update
  map.setView([lat, lon], 16);
  L.marker([lat, lon]).addTo(map); // Auto Icon später anpassen
}

