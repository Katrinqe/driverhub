// Screens
const startScreen = document.getElementById("startScreen");
const driveScreen = document.getElementById("driveScreen");
const statsScreen = document.getElementById("statsScreen");

const startDriveBtn = document.getElementById("startDriveBtn");
const endDriveBtn = document.getElementById("endDriveBtn");
const backHomeBtn = document.getElementById("backHomeBtn");

// Stats
const speedEl = document.getElementById("speed");
const distanceEl = document.getElementById("distance");
const timeEl = document.getElementById("time");

const totalDistanceEl = document.getElementById("totalDistance");
const avgSpeedEl = document.getElementById("avgSpeed");
const totalTimeEl = document.getElementById("totalTime");

// Map
let map = L.map('map').setView([0,0], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

let tracking = false;
let watchID = null;
let startTime = 0;
let totalDistance = 0;
let lastPos = null;
let speedSum = 0;
let speedCount = 0;

// Event Listeners
startDriveBtn.addEventListener("click", startDrive);
endDriveBtn.addEventListener("click", endDrive);
backHomeBtn.addEventListener("click", () => {
  statsScreen.classList.remove("active");
  startScreen.classList.add("active");
});

// Functions
function startDrive(){
  startScreen.classList.remove("active");
  driveScreen.classList.add("active");

  tracking = true;
  startTime = Date.now();
  totalDistance = 0;
  lastPos = null;
  speedSum = 0;
  speedCount = 0;

  if(navigator.geolocation){
    watchID = navigator.geolocation.watchPosition(updatePosition, err => {
      alert("GPS Error: " + err.message);
    }, { enableHighAccuracy: true });
  } else {
    alert("GPS not supported");
  }
}

function endDrive(){
  tracking = false;
  navigator.geolocation.clearWatch(watchID);

  // Durchschnittsgeschwindigkeit
  const avgSpeed = speedCount > 0 ? (speedSum / speedCount).toFixed(1) : 0;

  driveScreen.classList.remove("active");
  statsScreen.classList.add("active");

  totalDistanceEl.innerText = totalDistance.toFixed(2);
  avgSpeedEl.innerText = avgSpeed;
  const elapsed = (Date.now() - startTime)/60000;
  totalTimeEl.innerText = elapsed.toFixed(1);
}

function updatePosition(pos){
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  const speed = pos.coords.speed ? pos.coords.speed * 3.6 : 0;

  speedEl.innerText = speed.toFixed(1);

  // Durchschnitt
  speedSum += speed;
  speedCount++;

  if(lastPos){
    const R = 6371; // km
    const dLat = (lat - lastPos.lat) * Math.PI / 180;
    const dLon = (lon - lastPos.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lastPos.lat*Math.PI/180) * Math.cos(lat*Math.PI/180) *
              Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    totalDistance += d;
  }

  lastPos = {lat, lon};
  distanceEl.innerText = totalDistance.toFixed(2);

  const elapsed = (Date.now() - startTime)/60000;
  timeEl.innerText = elapsed.toFixed(1);

  // Map update
  map.setView([lat, lon], 16);
  L.circle([lat, lon], {radius:5, color:'red'}).addTo(map);
}
