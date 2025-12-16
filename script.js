const firebaseConfig = {
    apiKey: "AIzaSyD5pKzbwiM4NRGGyFV1uWIS6dZG30u8ueg",
    authDomain: "driverhub-5a567.firebaseapp.com",
    projectId: "driverhub-5a567",
    storageBucket: "driverhub-5a567.firebasestorage.app",
    messagingSenderId: "977759380742",
    appId: "1:977759380742:web:cc6c0bf4123492aaf62a87",
    measurementId: "G-QWC0ZFBVFT"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db_fire = firebase.firestore();
const storage = firebase.storage();

let currentUser = null; 
let currentUserName = ""; 
let isSignup = false;

const app = {
    splash: document.getElementById('splash-screen'),
    nav: document.getElementById('main-nav'),
    greet: document.getElementById('greeting-text'),
    locText: document.getElementById('loc-text'),
    tempText: document.getElementById('weather-temp'),
    weatherIcon: document.getElementById('weather-icon'),
    copilotTrigger: document.getElementById('copilot-trigger'),
    authScreen: document.getElementById('auth-screen'),
    
    screens: {
        home: document.getElementById('home-screen'),
        garage: document.getElementById('garage-screen'),
        perf: document.getElementById('perf-screen'),
        music: document.getElementById('music-screen'),
        community: document.getElementById('community-screen'),
        drive: document.getElementById('drive-screen'),
        summary: document.getElementById('summary-screen'),
        detail: document.getElementById('detail-screen'),
        nav: document.getElementById('nav-screen')
    },
    display: {
        speed: document.getElementById('live-speed'),
        time: document.getElementById('live-time'),
        dist: document.getElementById('live-dist'),
        sumDist: document.getElementById('sum-dist'),
        sumSpeed: document.getElementById('sum-speed'),
        sumAvg: document.getElementById('sum-avg'),
        sumTime: document.getElementById('sum-time')
    },
    perf: {
        speed: document.getElementById('perf-live-speed'),
        gVal: document.getElementById('max-g-val'),
        btn: document.getElementById('btn-arm-perf'),
        status: document.getElementById('perf-status-text'),
        list: document.getElementById('perf-history-list'),
        box50: document.getElementById('box-0-50'),
        box100: document.getElementById('box-0-100'),
        val50: document.getElementById('val-0-50'),
        val100: document.getElementById('val-0-100')
    },
    music: {
        title: document.getElementById('track-title'),
        artist: document.getElementById('track-artist'),
        playBtn: document.getElementById('btn-play-pause'),
        prevBtn: document.getElementById('btn-prev'),
        nextBtn: document.getElementById('btn-next'),
        volSlider: document.getElementById('vol-slider'),
        list: document.getElementById('playlist-container'),
        aura: document.getElementById('music-aura'),
        fileInput: document.getElementById('file-input')
    },
    comm: {
        feed: document.getElementById('friends-only-feed'),
        postInput: document.getElementById('post-input'),
        postBtn: document.getElementById('btn-post'),
        mainView: document.getElementById('social-main-view'),
        profileView: document.getElementById('profile-view'),
        chatView: document.getElementById('chat-view'),
        search: document.getElementById('user-search'),
        results: document.getElementById('search-results')
    }
};

function escapeHtml(text) { if (!text) return ""; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

window.addEventListener('load', () => {
    setTimeout(() => { 
        if(app.splash) {
            app.splash.style.opacity = '0'; 
            setTimeout(() => {
                app.splash.style.display = 'none';
                manualRefreshWeather(); 
            }, 800); 
        }
    }, 2200);
    
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            app.authScreen.classList.add('hidden');
            if(window.initUserProfile) initUserProfile(); 
            if(window.loadFriendsFeed) loadFriendsFeed(); 
        } else {
            app.authScreen.classList.remove('hidden');
        }
    });

    if(window.renderGarage) renderGarage();
    if(window.renderPerfHistory) renderPerfHistory();
    if(window.initMusicPlayer) { initMusicPlayer(); loadMusicFromDB(); }
    updateTimeGreeting();
    if(window.initCoPilot) initCoPilot();

    setInterval(manualRefreshWeather, 60000); 
});

document.getElementById('auth-switch-btn').addEventListener('click', () => { isSignup = !isSignup; document.getElementById('btn-login-email').style.display=isSignup?'none':'block'; document.getElementById('btn-signup-email').style.display=isSignup?'block':'none'; });
document.getElementById('btn-login-email').addEventListener('click', () => auth.signInWithEmailAndPassword(document.getElementById('auth-email').value, document.getElementById('auth-pass').value).catch(err => alert(err.message)));
document.getElementById('btn-signup-email').addEventListener('click', () => { const e = document.getElementById('auth-email').value; const p = document.getElementById('auth-pass').value; auth.createUserWithEmailAndPassword(e, p).then(cred => { db_fire.collection('users').doc(cred.user.uid).set({ email: e, username: e.split('@')[0], searchKey: e.split('@')[0].toLowerCase(), joined: new Date() }); }).catch(err => alert(err.message)); });
document.getElementById('btn-login-google').addEventListener('click', () => { const provider = new firebase.auth.GoogleAuthProvider(); auth.signInWithPopup(provider).catch(err => alert("Google Login Error: " + err.message)); });

document.querySelectorAll('.nav-item').forEach(btn => { 
    btn.addEventListener('click', (e) => { 
        const targetId = btn.getAttribute('data-target'); 
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active')); 
        btn.classList.add('active'); 
        Object.values(app.screens).forEach(s => { if(s && !s.classList.contains('screen-overlay')) s.classList.remove('active'); }); 
        if(app.screens[targetId.split('-')[0]]) { app.screens[targetId.split('-')[0]].classList.add('active'); } 
    }); 
});

function manualRefreshWeather() { app.locText.innerText = "Locating..."; app.tempText.innerText = "--°"; if(navigator.geolocation) { navigator.geolocation.getCurrentPosition(initWeatherLoc, err => { console.log("GPS Fehler", err); app.locText.innerText = "No GPS"; }, {enableHighAccuracy:false, timeout:10000}); } else { app.locText.innerText = "Not Supported"; } }
function updateTimeGreeting() { 
    const h = new Date().getHours(); 
    let txt = "WELCOME"; 
    if (h >= 5 && h < 12) txt = "GOOD MORNING"; else if (h >= 12 && h < 18) txt = "GOOD AFTERNOON"; else if (h >= 18 && h < 22) txt = "GOOD EVENING"; else txt = "NIGHT CRUISE"; 
    // FIX: Leerzeichen oder <br>
    if (currentUserName) { app.greet.innerHTML = `${txt}<br><span class="greeting-username">${escapeHtml(currentUserName).toUpperCase()}</span>`; } 
    else { app.greet.innerText = txt; } 
}
function initWeatherLoc(pos) { const lat = pos.coords.latitude; const lng = pos.coords.longitude; fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`).then(r => r.json()).then(d => { app.locText.innerText = d.address.city || d.address.town || "Location Found"; }); fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`).then(r => r.json()).then(d => { const t = Math.round(d.current_weather.temperature); const c = d.current_weather.weathercode; app.tempText.innerText = t + "°"; if(c <= 1) app.weatherIcon.className = "fa-solid fa-sun"; else if(c <= 3) app.weatherIcon.className = "fa-solid fa-cloud-sun"; else app.weatherIcon.className = "fa-solid fa-cloud"; }); }
