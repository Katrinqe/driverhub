// --- 1. CONFIGURATION ---
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

// --- 2. GLOBAL VARIABLES ---
let map, marker, watchId, intervalId, detailMap;
let startTime, path = [], currentDistance = 0, currentMaxSpeed = 0, isDriving = false;
let perfWatchId = null, perfState = 'idle', perfStartTime = 0;
let result50 = null, result100 = null, maxG = 0;
const playlist = []; let currentTrackIdx = 0; const audioPlayer = new Audio(); let isPlaying = false;
let recognition = null; let isListening = false; let synth = window.speechSynthesis;
let currentUser = null; 
let currentUserName = ""; 

// TRACKING & MAP VARS
let isMapFollowing = true; 
let lastLimitCheck = 0; 
let currentLat = 0, currentLng = 0;

// NAVI VARS
let navMap = null;
let routingControl = null;
let navWatchId = null;

// Social Vars
let viewingUserUid = null; 
let activeChatId = null;
let feedUnsubscribe = null;

// --- 3. DOM ELEMENTS ---
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
        profileIcon: document.getElementById('user-profile-icon'),
        search: document.getElementById('user-search'),
        results: document.getElementById('search-results')
    }
};

// --- 4. INITIALIZATION ---
window.addEventListener('load', () => {
    setTimeout(() => { 
        app.splash.style.opacity = '0'; 
        setTimeout(() => {
            app.splash.style.display = 'none';
            manualRefreshWeather(); 
        }, 800); 
    }, 2200);
    
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            app.authScreen.classList.add('hidden');
            initUserProfile(); 
            loadFriendsFeed(); 
        } else {
            app.authScreen.classList.remove('hidden');
        }
    });

    renderGarage(); renderPerfHistory(); initMusicPlayer(); updateTimeGreeting(); initCoPilot(); loadMusicFromDB();
    setInterval(manualRefreshWeather, 60000); 
    
    // NAVI BUTTON LOGIC
    const btnNavStart = document.getElementById('btn-nav-start');
    if (btnNavStart) {
        btnNavStart.addEventListener('click', () => {
            app.screens.nav.style.display = 'flex';
            app.nav.style.display = 'none'; 
            initNavMap();
        });
    }
    
    const btnCloseNav = document.getElementById('btn-close-nav');
    if (btnCloseNav) {
        btnCloseNav.addEventListener('click', () => {
            app.screens.nav.style.display = 'none';
            app.nav.style.display = 'flex'; 
            if(navMap) { navMap.remove(); navMap = null; }
            if(navWatchId) { navigator.geolocation.clearWatch(navWatchId); navWatchId = null; }
        });
    }

    // START GUIDANCE BUTTON
    const btnStartGuidance = document.getElementById('btn-start-guidance');
    if (btnStartGuidance) {
        btnStartGuidance.addEventListener('click', () => {
            const container = document.querySelector('.leaflet-routing-container');
            if(container) container.style.display = 'none';
            
            btnStartGuidance.style.display = 'none';
            startNaviFollow();
        });
    }
});

// --- 5. SOCIAL LOGIC ---
function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.refreshSocial = function() {
    if(!currentUser) return;
    const btn = document.querySelector('.fa-rotate-right');
    btn.style.transition = "transform 0.5s";
    btn.style.transform = "rotate(360deg)";
    setTimeout(() => btn.style.transform = "rotate(0deg)", 500);
    loadFriendsFeed();
    loadChatInbox();
};

window.switchSocialTab = function(tabName) {
    document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('tab-feed').style.display = 'none';
    document.getElementById('tab-friends').style.display = 'none';
    document.getElementById('tab-chats').style.display = 'none';
    
    if(tabName === 'feed') {
        document.getElementById('tab-feed').style.display = 'block';
    } else if(tabName === 'friends') {
        document.getElementById('tab-friends').style.display = 'block';
        loadFriendsList();
    } else if(tabName === 'chats') {
        document.getElementById('tab-chats').style.display = 'block';
        loadChatInbox(); 
    } else if(tabName === 'profile') {
        if(currentUser) openProfile(currentUser.uid);
    }
};

function initUserProfile() {
    db_fire.collection('users').doc(currentUser.uid).onSnapshot(doc => {
        if (!doc.exists) {
            const baseData = {
                email: currentUser.email,
                username: currentUser.email.split('@')[0],
                bio: "DriverHub User",
                photoURL: "",
                followers: 0,
                following: 0,
                searchKey: currentUser.email.split('@')[0].toLowerCase(), 
                joined: new Date()
            };
            db_fire.collection('users').doc(currentUser.uid).set(baseData, {merge:true});
        } else {
            const data = doc.data();
            if(data.username) {
                currentUserName = data.username;
                updateTimeGreeting();
            }
            if(data.photoURL) {
                app.comm.profileIcon.style.backgroundImage = `url('${data.photoURL}')`;
                app.comm.profileIcon.style.backgroundSize = 'cover';
                app.comm.profileIcon.classList.remove('fa-user-circle');
                app.comm.profileIcon.classList.remove('fa-solid');
            }
        }
    });
}

function loadChatInbox() {
    const list = document.getElementById('chats-list-container');
    list.innerHTML = "<p style='color:#666;text-align:center;'>Lade...</p>";
    db_fire.collection('chats').where('participants', 'array-contains', currentUser.uid).onSnapshot(snap => {
        list.innerHTML = "";
        if(snap.empty) {
            list.innerHTML = "<p style='color:#666;text-align:center;'>Keine Nachrichten vorhanden.</p>";
            return;
        }
        snap.forEach(doc => {
            const chatData = doc.data();
            const partnerUid = chatData.participants.find(uid => uid !== currentUser.uid);
            db_fire.collection('users').doc(partnerUid).get().then(uDoc => {
                const uData = uDoc.data() || {username: "Unknown"};
                const d = document.createElement('div');
                d.className = 'list-item-row';
                d.innerHTML = `<div class="s-avatar" style="${uData.photoURL ? `background-image:url('${uData.photoURL}')` : `background:var(--accent-blue)`}"></div><div class="list-info"><span class="list-name">${escapeHtml(uData.username)}</span><span class="list-sub">Chat öffnen</span></div>`;
                d.onclick = () => { viewingUserUid = partnerUid; startChat(partnerUid, uData.username); };
                list.appendChild(d);
            });
        });
    });
}

function loadFriendsList() {
    const list = document.getElementById('friends-list-container');
    list.innerHTML = "<p style='color:#666;text-align:center;'>Lade...</p>";
    db_fire.collection('follows').where('followerId', '==', currentUser.uid).get().then(snap => {
        list.innerHTML = "";
        if(snap.empty) {
            list.innerHTML = "<p style='color:#666;text-align:center;'>Du folgst niemandem.</p>";
            return;
        }
        snap.forEach(fDoc => {
            const fUid = fDoc.data().followingId;
            db_fire.collection('users').doc(fUid).get().then(uDoc => {
                const uData = uDoc.data();
                const d = document.createElement('div');
                d.className = 'list-item-row';
                d.innerHTML = `<div class="s-avatar" style="${uData.photoURL ? `background-image:url('${uData.photoURL}')` : `background:var(--accent-blue)`}"></div><div class="list-info"><span class="list-name">${escapeHtml(uData.username)}</span><span class="list-sub">${escapeHtml(uData.bio || "")}</span></div>`;
                d.onclick = () => openProfile(uDoc.id);
                list.appendChild(d);
            });
        });
    });
}

app.comm.postBtn.addEventListener('click', () => {
    const txt = app.comm.postInput.value; if(!txt) return;
    if(txt.length > 300) { alert("Text zu lang!"); return; }
    db_fire.collection('users').doc(currentUser.uid).get().then(doc => {
        const uData = doc.data() || {};
        db_fire.collection('posts').add({ text: txt, uid: currentUser.uid, author: uData.username || "User", authorPic: uData.photoURL || "", likes: [], timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        app.comm.postInput.value = "";
    });
});

function loadFriendsFeed() {
    if(feedUnsubscribe) feedUnsubscribe();
    db_fire.collection('follows').where('followerId', '==', currentUser.uid).get().then(snap => {
        const followingIds = [];
        snap.forEach(doc => followingIds.push(doc.data().followingId));
        followingIds.push(currentUser.uid); 
        feedUnsubscribe = db_fire.collection('posts').orderBy('timestamp', 'desc').limit(50).onSnapshot(postSnap => {
            const container = app.comm.feed;
            const msg = document.getElementById('no-friends-msg');
            const currentScroll = container.parentElement.scrollTop;
            container.innerHTML = "";
            let hasPosts = false;
            postSnap.forEach(doc => {
                const post = doc.data();
                if(followingIds.includes(post.uid)) { renderPost(post, container, doc.id); hasPosts = true; }
            });
            if(!hasPosts) { container.appendChild(msg); msg.style.display = 'block'; } else { msg.style.display = 'none'; }
            container.parentElement.scrollTop = currentScroll;
        });
    });
}

function renderPost(post, container, postId) {
    const date = post.timestamp ? new Date(post.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "Now";
    let avaStyle = `background: var(--accent-blue);`;
    let avaContent = post.author.charAt(0).toUpperCase();
    if(post.authorPic) { avaStyle = `background-image: url('${post.authorPic}');`; avaContent = ""; }
    const likes = post.likes || [];
    const isLiked = likes.includes(currentUser.uid);
    const likeIconClass = isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart";
    const likeColorClass = isLiked ? "liked" : "";
    const div = document.createElement('div'); div.className = 'post-card';
    let deleteBtn = "";
    if(post.uid === currentUser.uid) { deleteBtn = `<button class="btn-delete-post" onclick="deletePost('${postId}')"><i class="fa-solid fa-trash"></i></button>`; }
    div.innerHTML = `<div class="post-header" onclick="openProfile('${post.uid}')"><div class="post-avatar" style="${avaStyle}">${avaContent}</div><span class="post-user">${escapeHtml(post.author)}</span><span class="post-date">${date}</span></div>${deleteBtn}<div class="post-content">${escapeHtml(post.text)}</div><div class="post-actions"><span class="action-btn ${likeColorClass}" onclick="toggleLike('${postId}', ${isLiked})"><i class="${likeIconClass}"></i> ${likes.length} Like${likes.length !== 1 ? 's' : ''}</span></div>`;
    container.appendChild(div);
}

window.toggleLike = function(postId, currentlyLiked) {
    const postRef = db_fire.collection('posts').doc(postId);
    if (currentlyLiked) { postRef.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) }).catch(err => console.error(err)); } 
    else { postRef.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) }).catch(err => console.error(err)); }
};

window.deletePost = function(postId) { if(confirm("Post löschen?")) { db_fire.collection('posts').doc(postId).delete(); } };

document.getElementById('btn-back-feed').addEventListener('click', () => {
    app.comm.profileView.style.display = 'none'; app.comm.mainView.style.display = 'block'; app.comm.chatView.style.display = 'none';
    document.getElementById('comm-title').innerText = "Community";
    document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.social-tab:first-child').classList.add('active');
    document.getElementById('tab-feed').style.display = 'block'; document.getElementById('tab-friends').style.display = 'none'; document.getElementById('tab-chats').style.display = 'none';
});

function openProfile(uid) {
    viewingUserUid = uid;
    const isMe = (currentUser.uid === uid);
    app.comm.mainView.style.display = 'none'; app.comm.profileView.style.display = 'block'; app.comm.chatView.style.display = 'none';
    document.getElementById('comm-title').innerText = isMe ? "Mein Profil" : "Profil";
    const pName = document.getElementById('p-name'); const pBio = document.getElementById('p-bio'); const pImg = document.getElementById('p-header-img');
    const btnEditImg = document.getElementById('btn-edit-img'); const btnEditBio = document.getElementById('btn-edit-bio'); const btnFollow = document.getElementById('btn-follow-action'); const btnMsg = document.getElementById('btn-msg-action'); const postList = document.getElementById('profile-posts-list');
    pName.innerText = "Lade..."; pBio.innerText = "..."; pImg.style.backgroundImage = "none"; postList.innerHTML = "";
    db_fire.collection('users').doc(uid).onSnapshot(doc => {
        if(!doc.exists) return;
        const data = doc.data();
        pName.innerText = data.username; pBio.innerText = data.bio || "Keine Bio.";
        if(data.photoURL) pImg.style.backgroundImage = `url('${data.photoURL}')`;
        document.getElementById('p-followers').innerText = data.followers || 0; document.getElementById('p-following').innerText = data.following || 0;
    });
    db_fire.collection('posts').where('uid', '==', uid).orderBy('timestamp', 'desc').limit(10).get().then(snap => { snap.forEach(doc => renderPost(doc.data(), postList, doc.id)); });
    if(isMe) { btnEditImg.style.display = 'flex'; btnEditBio.style.display = 'inline-block'; btnFollow.style.display = 'none'; btnMsg.style.display = 'none'; document.getElementById('profile-post-section').style.display = 'block'; } 
    else { btnEditImg.style.display = 'none'; btnEditBio.style.display = 'none'; btnFollow.style.display = 'inline-block'; btnMsg.style.display = 'inline-block'; document.getElementById('profile-post-section').style.display = 'none'; checkIfFollowing(uid); }
}

document.getElementById('btn-edit-bio').addEventListener('click', () => { const newBio = prompt("Neue Bio:", document.getElementById('p-bio').innerText); if(newBio !== null) { if(newBio.length > 100) { alert("Zu lang!"); return; } db_fire.collection('users').doc(currentUser.uid).set({ bio: newBio }, { merge: true }); } });
document.getElementById('btn-edit-img').addEventListener('click', () => document.getElementById('profile-img-input').click());
document.getElementById('profile-img-input').addEventListener('change', function(e) {
    const file = e.target.files[0]; if(!file) return;
    const storageRef = storage.ref(`profiles/${currentUser.uid}`);
    const uploadTask = storageRef.put(file);
    uploadTask.on('state_changed', (snap) => { console.log("Upload läuft..."); }, (err) => { alert("Fehler: " + err.message); }, () => { uploadTask.snapshot.ref.getDownloadURL().then((url) => { db_fire.collection('users').doc(currentUser.uid).set({ photoURL: url }, { merge: true }); }); });
});

document.getElementById('btn-follow-action').addEventListener('click', () => {
    if(!viewingUserUid) return;
    const followRef = db_fire.collection('follows').where('followerId', '==', currentUser.uid).where('followingId', '==', viewingUserUid);
    followRef.get().then(snap => {
        if(snap.empty) {
            db_fire.collection('follows').add({ followerId: currentUser.uid, followingId: viewingUserUid });
            db_fire.collection('users').doc(viewingUserUid).set({ followers: firebase.firestore.FieldValue.increment(1) }, {merge:true});
            db_fire.collection('users').doc(currentUser.uid).set({ following: firebase.firestore.FieldValue.increment(1) }, {merge:true});
            updateFollowBtn(true);
        } else {
            snap.forEach(doc => doc.ref.delete());
            db_fire.collection('users').doc(viewingUserUid).set({ followers: firebase.firestore.FieldValue.increment(-1) }, {merge:true});
            db_fire.collection('users').doc(currentUser.uid).set({ following: firebase.firestore.FieldValue.increment(-1) }, {merge:true});
            updateFollowBtn(false);
        }
    });
});

function checkIfFollowing(uid) { db_fire.collection('follows').where('followerId', '==', currentUser.uid).where('followingId', '==', uid).onSnapshot(snap => updateFollowBtn(!snap.empty)); }
function updateFollowBtn(isFollowing) { const btn = document.getElementById('btn-follow-action'); if(isFollowing) { btn.innerText = "Folge ich"; btn.classList.add('following'); } else { btn.innerText = "Folgen"; btn.classList.remove('following'); } }

app.comm.search.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase(); const resBox = app.comm.results; if(term.length < 2) { resBox.style.display = 'none'; return; }
    db_fire.collection('users').limit(20).get().then(snap => {
        resBox.innerHTML = ""; let count = 0;
        snap.forEach(doc => { const u = doc.data(); if(u.username && u.username.toLowerCase().includes(term) && doc.id !== currentUser.uid) { count++; const d = document.createElement('div'); d.className = 'search-item'; const img = u.photoURL ? `background-image:url('${u.photoURL}')` : `background:var(--accent-blue)`; d.innerHTML = `<div class="s-avatar" style="${img}"></div><span>${escapeHtml(u.username)}</span>`; d.onclick = () => { resBox.style.display = 'none'; app.comm.search.value = ""; openProfile(doc.id); }; resBox.appendChild(d); } });
        if(count > 0) resBox.style.display = 'block'; else resBox.style.display = 'none';
    });
});

document.getElementById('btn-msg-action').addEventListener('click', () => startChat(viewingUserUid, document.getElementById('p-name').innerText));
document.getElementById('btn-close-chat').addEventListener('click', () => { app.comm.chatView.style.display = 'none'; app.comm.mainView.style.display = 'block'; activeChatId = null; });
document.getElementById('chat-send').addEventListener('click', sendChatMessage);

function startChat(partnerUid, partnerName) {
    const ids = [currentUser.uid, partnerUid].sort(); activeChatId = ids.join("_");
    db_fire.collection('chats').doc(activeChatId).set({ participants: ids }, {merge:true});
    app.comm.profileView.style.display = 'none'; app.comm.mainView.style.display = 'none'; app.comm.chatView.style.display = 'block';
    document.getElementById('chat-partner-name').innerText = partnerName; loadMessages();
}
function loadMessages() {
    const msgBox = document.getElementById('chat-messages'); msgBox.innerHTML = "";
    db_fire.collection('chats').doc(activeChatId).collection('messages').orderBy('timestamp').onSnapshot(snap => {
        msgBox.innerHTML = ""; snap.forEach(doc => { const m = doc.data(); const bubble = document.createElement('div'); bubble.className = `chat-bubble ${m.senderId === currentUser.uid ? 'me' : 'them'}`; bubble.innerText = m.text; msgBox.appendChild(bubble); }); msgBox.scrollTop = msgBox.scrollHeight;
    });
}
function sendChatMessage() {
    const input = document.getElementById('chat-input'); const txt = input.value; if(!txt || !activeChatId) return; if(txt.length > 500) { alert("Zu lang."); return; }
    db_fire.collection('chats').doc(activeChatId).collection('messages').add({ text: txt, senderId: currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() }); input.value = "";
}

// --- ORIGINAL MODULES (SHORTENED FOR SPACE, SAME LOGIC) ---
document.getElementById('auth-switch-btn').addEventListener('click', () => { isSignup = !isSignup; if(isSignup) { document.getElementById('btn-login-email').style.display='none'; document.getElementById('btn-signup-email').style.display='block'; } else { document.getElementById('btn-login-email').style.display='block'; document.getElementById('btn-signup-email').style.display='none'; } });
document.getElementById('btn-login-email').addEventListener('click', () => auth.signInWithEmailAndPassword(document.getElementById('auth-email').value, document.getElementById('auth-pass').value).catch(err => alert(err.message)));
document.getElementById('btn-signup-email').addEventListener('click', () => { const e = document.getElementById('auth-email').value; const p = document.getElementById('auth-pass').value; auth.createUserWithEmailAndPassword(e, p).then(cred => { db_fire.collection('users').doc(cred.user.uid).set({ email: e, username: e.split('@')[0], searchKey: e.split('@')[0].toLowerCase(), joined: new Date() }); }).catch(err => alert(err.message)); });
document.getElementById('btn-login-google').addEventListener('click', () => { const provider = new firebase.auth.GoogleAuthProvider(); auth.signInWithPopup(provider).catch(err => alert("Google Login Error: " + err.message)); });

document.getElementById('btn-start').addEventListener('click', () => { app.screens.drive.style.display = 'flex'; app.nav.style.display = 'none'; startTracking(); });
document.getElementById('btn-stop').addEventListener('click', () => { stopTracking(); app.screens.drive.style.display = 'none'; app.screens.summary.style.display = 'flex'; });
document.getElementById('btn-save-drive').addEventListener('click', () => { saveDriveToStorage(); app.screens.summary.style.display = 'none'; app.nav.style.display = 'flex'; document.querySelectorAll('.nav-item')[4].click(); });

// --- SMART LAZY START (PRESERVED STABLE) ---
function startTracking() { 
    isDriving = true; startTime = new Date(); path = []; currentDistance = 0; currentMaxSpeed = 0; isMapFollowing = true; 
    document.getElementById('btn-recenter').style.display = 'none'; 
    
    // NUKLEAR OPTION: Wenn Map schon da ist, töten.
    if (map) { 
        map.remove(); 
        map = null;
    }
    
    // WICHTIG: 500ms warten bis Fenster offen, dann Größe fixen
    setTimeout(() => {
        // Frische Karte erstellen
        map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13); 
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map); 
        marker = L.marker([0, 0], {icon: L.divIcon({className: 'c', html: "<div style='background-color:#4a90e2; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #4a90e2;'></div>", iconSize: [20, 20]})}).addTo(map); 
        
        map.on('dragstart', () => {
            if(isDriving) {
                isMapFollowing = false;
                document.getElementById('btn-recenter').style.display = 'flex'; 
            }
        });

        // Wichtig: Jetzt Größe neu berechnen
        map.invalidateSize();
        
        // Timer starten
        intervalId = setInterval(updateTimer, 1000); 
        if (navigator.geolocation) { watchId = navigator.geolocation.watchPosition(updatePosition, handleError, {enableHighAccuracy: true}); } 
    }, 500); // 500ms warten
}

function updatePosition(position) { 
    // Sicherheitscheck: Wenn Map noch nicht fertig geladen (wegen Timeout), nichts tun
    if (!map) return; 

    const lat = position.coords.latitude; const lng = position.coords.longitude; 
    const speedKmh = Math.max(0, (position.coords.speed || 0) * 3.6).toFixed(0); 
    if (parseFloat(speedKmh) > currentMaxSpeed) currentMaxSpeed = parseFloat(speedKmh); 
    app.display.speed.innerText = speedKmh; 
    
    const newLatLng = [lat, lng]; 
    
    if(marker) marker.setLatLng(newLatLng); 
    
    if(isDriving) {
        checkSpeedLimit(lat, lng);
    }

    if(isMapFollowing) {
        map.setView(newLatLng, 18); 
    }

    if (path.length > 0) { currentDistance += map.distance(path[path.length - 1], newLatLng); app.display.dist.innerText = (currentDistance / 1000).toFixed(2) + " km"; } 
    path.push(newLatLng); 
}

function updateTimer() { const diff = new Date() - startTime; app.display.time.innerText = new Date(diff).toISOString().substr(11, 8); }

// --- STOP TRACKING ZERSTÖRT KARTE ---
function stopTracking() { 
    isDriving = false; 
    clearInterval(intervalId); 
    
    if(watchId) { 
        navigator.geolocation.clearWatch(watchId); 
        watchId = null; 
    }
    
    if(map) {
        map.remove(); 
        map = null;   
        marker = null;
    }

    const diff = new Date() - startTime; 
    const distKm = currentDistance / 1000; 
    const durationHours = diff / (1000 * 60 * 60); 
    const avgSpeed = (durationHours > 0) ? (distKm / durationHours).toFixed(1) : 0; 
    app.display.sumDist.innerText = distKm.toFixed(2); 
    app.display.sumSpeed.innerText = currentMaxSpeed; 
    app.display.sumAvg.innerText = avgSpeed; 
    app.display.sumTime.innerText = new Date(diff).toISOString().substr(11, 8); 
}

// --- RECENTER FUNCTION CALLED BY HTML ONCLICK ---
function triggerRecenter(e) {
    if(e) { e.stopPropagation(); e.preventDefault(); }
    isMapFollowing = true;
    document.getElementById('btn-recenter').style.display = 'none';
    if(map && marker) { 
        map.setView(marker.getLatLng(), 18); 
    }
}

// --- NAVI SANDBOX LOGIC (NEU) ---
function initNavMap() {
    // 500ms wait for transition
    setTimeout(() => {
        // Falls schon eine Navi-Karte da ist, zerstören
        if(navMap) {
             navMap.remove();
             navMap = null;
        }

        navMap = L.map('nav-map', { zoomControl: false }).setView([51.1657, 10.4515], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(navMap);
        
        // Versuchen, sofort GPS zu holen für den Startpunkt
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                
                // Routing Control erstellen
                try {
                    routingControl = L.Routing.control({
                        waypoints: [
                            L.latLng(lat, lng), // Start = GPS
                            null                // Ziel = Leer (für Eingabe)
                        ],
                        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
                        lineOptions: { styles: [{color: '#bf5af2', opacity: 0.8, weight: 6}] },
                        geocoder: L.Control.Geocoder.nominatim(), // SUCHE AKTIVIERT
                        routeWhileDragging: true,
                        show: true,
                        collapsible: true,
                        language: 'de'
                    }).addTo(navMap);
                    
                    // Event Listener: Wenn Route gefunden, zeige START Button
                    routingControl.on('routesfound', function(e) {
                         const btn = document.getElementById('btn-start-guidance');
                         if(btn) btn.style.display = 'block';
                    });

                    // Karte auf User zentrieren
                    navMap.setView([lat, lng], 15);
                } catch(e) {
                    console.log("Routing Error: ", e);
                }

            }, err => {
                console.warn("Navi GPS Error", err);
                // Fallback ohne GPS
                routingControl = L.Routing.control({
                    waypoints: [ null, null ],
                    geocoder: L.Control.Geocoder.nominatim(),
                    router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
                     lineOptions: { styles: [{color: '#bf5af2', opacity: 0.8, weight: 6}] }
                }).addTo(navMap);
            });
        }
        
        navMap.invalidateSize();
    }, 500);
}

// Wenn man auf "START ROUTE" klickt
function startNaviFollow() {
    if(navMap && routingControl) {
        const waypoints = routingControl.getWaypoints();
        if(waypoints && waypoints[0].latLng) {
            navMap.setView(waypoints[0].latLng, 18);
        }
        
        if (navigator.geolocation) { 
            if(navWatchId) navigator.geolocation.clearWatch(navWatchId);
            
            navWatchId = navigator.geolocation.watchPosition(pos => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                // Navi Karte bewegen
                if(navMap) navMap.setView([lat, lng], 18);
            }, err => {}, {enableHighAccuracy: true}); 
        } 
    }
}

function handleError(err) { console.warn(err); }
function saveDriveToStorage() { const diff = new Date() - startTime; const distKm = currentDistance / 1000; const durationHours = diff / (1000 * 60 * 60); const avgSpeed = (durationHours > 0) ? (distKm / durationHours).toFixed(1) : 0; const newDrive = { id: Date.now(), date: startTime.toISOString(), distance: parseFloat(distKm.toFixed(2)), maxSpeed: currentMaxSpeed, avgSpeed: avgSpeed, duration: new Date(diff).toISOString().substr(11, 8), pathData: path }; let drives = JSON.parse(localStorage.getItem('dh_drives_v2')) || []; drives.unshift(newDrive); localStorage.setItem('dh_drives_v2', JSON.stringify(drives)); renderGarage(); }
function renderGarage() { let drives = JSON.parse(localStorage.getItem('dh_drives_v2')) || []; let totalKm = 0; const list = document.getElementById('drives-list'); list.innerHTML = ''; drives.forEach(drive => { totalKm += drive.distance; const dateStr = new Date(drive.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); const item = document.createElement('div'); item.className = 'drive-item'; item.innerHTML = `<div><h4>${dateStr} • ${drive.duration}</h4><span>Avg ${drive.avgSpeed} km/h</span></div><div class="right-side"><span class="dist">${drive.distance.toFixed(1)} km</span><span>Max ${drive.maxSpeed}</span></div>`; item.addEventListener('click', () => openDetailView(drive)); list.appendChild(item); }); document.getElementById('total-km').innerText = totalKm.toFixed(1); document.getElementById('total-drives').innerText = drives.length; }

function openDetailView(drive) { 
    app.screens.detail.style.display = 'block'; 
    document.getElementById('detail-dist').innerText = drive.distance.toFixed(1); 
    document.getElementById('detail-max').innerText = drive.maxSpeed; 
    document.getElementById('detail-avg').innerText = drive.avgSpeed; 
    setTimeout(() => { 
        if(!detailMap) { 
            detailMap = L.map('detail-map', { zoomControl: false }); 
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(detailMap); 
        } 
        detailMap.eachLayer((layer) => { if (!!layer.toGeoJSON) { detailMap.removeLayer(layer); } }); 
        if(drive.pathData && drive.pathData.length > 0) { const polyline = L.polyline(drive.pathData, {color: '#4a90e2', weight: 5}).addTo(detailMap); detailMap.fitBounds(polyline.getBounds(), {padding: [50, 50]}); } 
    }, 100); 
}

document.getElementById('btn-close-detail').addEventListener('click', () => { app.screens.detail.style.display = 'none'; if(detailMap) { detailMap.remove(); detailMap = null; } });
document.getElementById('btn-reset-data').addEventListener('click', () => { if(confirm("Alles löschen?")) { localStorage.removeItem('dh_drives_v2'); renderGarage(); } });

app.perf.btn.addEventListener('click', () => { if(perfState === 'idle' || perfState === 'finished') { perfState = 'armed'; app.perf.btn.innerText = "READY"; app.perf.btn.classList.add('armed'); app.perf.status.innerText = "Launch when ready!"; app.perf.val50.innerText = "--.- s"; app.perf.val100.innerText = "--.- s"; app.perf.box50.classList.remove('active'); app.perf.box100.classList.remove('active'); maxG = 0; result50 = null; result100 = null; if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { DeviceMotionEvent.requestPermission().then(s => { if (s === 'granted') startPerfSensors(); }).catch(console.error); } else { startPerfSensors(); } if (navigator.geolocation) { perfWatchId = navigator.geolocation.watchPosition(updatePerfLogic, handleError, {enableHighAccuracy: true}); } } else { resetPerfMode(); } });
function startPerfSensors() { window.addEventListener('devicemotion', handleMotion); }
function handleMotion(event) { if(perfState !== 'running') return; const x = event.acceleration.x || 0; const y = event.acceleration.y || 0; const z = event.acceleration.z || 0; const totalAccel = Math.sqrt(x*x + y*y + z*z); const currentG = totalAccel / 9.81; if(currentG > maxG) { maxG = currentG; app.perf.gVal.innerText = maxG.toFixed(2) + " G"; } }
function updatePerfLogic(position) { const speedKmh = (position.coords.speed || 0) * 3.6; app.perf.speed.innerText = speedKmh.toFixed(0); if(perfState === 'armed') { if(speedKmh > 2.0) { perfState = 'running'; perfStartTime = Date.now(); app.perf.btn.innerText = "GO!"; app.perf.status.innerText = "Recording..."; } } else if(perfState === 'running') { const duration = (Date.now() - perfStartTime) / 1000; if(!result50 && speedKmh >= 50) { result50 = duration.toFixed(2); app.perf.val50.innerText = result50 + " s"; app.perf.box50.classList.add('active'); } if(!result100 && speedKmh >= 100) { result100 = duration.toFixed(2); app.perf.val100.innerText = result100 + " s"; app.perf.box100.classList.add('active'); perfState = 'finished'; app.perf.btn.innerText = "RESET"; app.perf.btn.classList.remove('armed'); app.perf.status.innerText = "Run Complete!"; speak("Hundert erreicht in " + result100.replace('.', ',') + " Sekunden."); savePerfRun(); } } }
function resetPerfMode() { perfState = 'idle'; app.perf.btn.innerText = "ARM"; app.perf.btn.classList.remove('armed'); app.perf.status.innerText = "Tap to arm, then launch."; if(perfWatchId) navigator.geolocation.clearWatch(perfWatchId); window.removeEventListener('devicemotion', handleMotion); app.perf.speed.innerText = "0"; }
function savePerfRun() { const run = { id: Date.now(), date: new Date().toISOString(), res50: result50, res100: result100, maxG: maxG.toFixed(2) }; let runs = JSON.parse(localStorage.getItem('dh_perf_v1')) || []; runs.unshift(run); localStorage.setItem('dh_perf_v1', JSON.stringify(runs)); renderPerfHistory(); }
function renderPerfHistory() { let runs = JSON.parse(localStorage.getItem('dh_perf_v1')) || []; const list = app.perf.list; list.innerHTML = ''; runs.forEach(run => { const dateStr = new Date(run.date).toLocaleDateString('de-DE'); const item = document.createElement('div'); item.className = 'drive-item'; item.innerHTML = `<div><h5>${dateStr}</h5><span>Max ${run.maxG} G</span></div><div class="right-side"><span style="color:#ff3b30; font-weight:bold;">0-100: ${run.res100}s</span><br><span style="font-size:0.75rem">0-50: ${run.res50}s</span></div>`; list.appendChild(item); }); }

function manualRefreshWeather() { app.locText.innerText = "Locating..."; app.tempText.innerText = "--°"; if(navigator.geolocation) { navigator.geolocation.getCurrentPosition(initWeatherLoc, err => { console.log("GPS Fehler", err); app.locText.innerText = "No GPS"; }, {enableHighAccuracy:false, timeout:10000}); } else { app.locText.innerText = "Not Supported"; } }

// --- SPEED LIMIT LOGIC (OVERPASS API) ---
function checkSpeedLimit(lat, lon) { const now = Date.now(); if (now - lastLimitCheck < 8000) return; lastLimitCheck = now; const query = `[out:json]; way(around:15, ${lat}, ${lon})["maxspeed"]; out tags;`; const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`; fetch(url).then(response => response.json()).then(data => { if (data.elements && data.elements.length > 0) { let speed = data.elements[0].tags.maxspeed; if(speed === "none") { document.getElementById('limit-sign').style.display = 'none'; } else { speed = parseInt(speed); if(!isNaN(speed)) { document.getElementById('limit-sign').style.display = 'flex'; document.getElementById('limit-value').innerText = speed; } } } else { document.getElementById('limit-sign').style.display = 'none'; } }).catch(err => console.log("Limit API Error:", err)); }
