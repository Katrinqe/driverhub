let map = L.map("map", {
  zoomControl: false,
}).setView([52.52, 13.405], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "",
}).addTo(map);

let watchId = null;
let route = [];
let polyline = L.polyline([], { color: "#5fa9ff", weight: 4 }).addTo(map);

let startTime = null;
let distance = 0;
let driving = false;

const speedEl = document.getElementById("speed");
const distanceEl = document.getElementById("distance");
const timeEl = document.getElementById("time");
const driveButton = document.getElementById("driveButton");

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

driveButton.addEventListener("click", () => {
  if (!driving) startDrive();
  else stopDrive();
});

function startDrive() {
  driving = true;
  startTime = Date.now();
  distance = 0;
  route = [];
  polyline.setLatLngs([]);

  driveButton.textContent = "Stop Drive";

  watchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude, speed } = pos.coords;

      map.setView([latitude, longitude], 17);

      route.push([latitude, longitude]);
      polyline.addLatLng([latitude, longitude]);

      if (route.length > 1) {
        const last = route[route.length - 2];
        distance += haversine(last[0], last[1], latitude, longitude);
      }

      speedEl.textContent = speed ? (speed * 3.6).toFixed(1) : "0";
      distanceEl.textContent = distance.toFixed(2);
      timeEl.textContent = Math.floor((Date.now() - startTime) / 60000);
    },
    err => {
      alert("Location access is required.");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
    }
  );
}

function stopDrive() {
  driving = false;
  navigator.geolocation.clearWatch(watchId);
  driveButton.textContent = "Start Drive";
}
