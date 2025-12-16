let db; 
const playlist = []; 
let currentTrackIdx = 0; 
const audioPlayer = new Audio(); 
let isPlaying = false;

const request = indexedDB.open("DriverHubDB", 1);
request.onupgradeneeded = function(event) { db = event.target.result; db.createObjectStore("music", { keyPath: "id" }); };
request.onsuccess = function(event) { db = event.target.result; }; // Laden passiert in script.js onLoad

function saveTrackToDB(track) { const transaction = db.transaction(["music"], "readwrite"); transaction.objectStore("music").add(track); }
function loadMusicFromDB() { const transaction = db.transaction(["music"], "readonly"); const req = transaction.objectStore("music").getAll(); req.onsuccess = function() { if(req.result && req.result.length > 0) { req.result.forEach(t => playlist.push(t)); playlist.sort((a,b) => b.id - a.id); renderPlaylist(); if(playlist.length > 0) loadTrack(0, false); } }; }

function initMusicPlayer() { 
    app.music.playBtn.addEventListener('click', togglePlay); 
    app.music.nextBtn.addEventListener('click', nextTrack); 
    app.music.prevBtn.addEventListener('click', prevTrack); 
    app.music.volSlider.addEventListener('input', (e) => { audioPlayer.volume = e.target.value; }); 
    app.music.fileInput.addEventListener('change', function(e) { 
        const file = e.target.files[0]; if (!file) return; 
        const reader = new FileReader(); 
        reader.onload = function(e) { 
            const audioData = e.target.result; 
            const newTrack = { id: Date.now(), title: file.name.replace(/\.[^/.]+$/, ""), artist: "Local File", src: audioData }; 
            saveTrackToDB(newTrack); playlist.unshift(newTrack); renderPlaylist(); loadTrack(0, true); 
        }; reader.readAsDataURL(file); 
    }); 
    audioPlayer.addEventListener('error', (e) => { console.error("Audio Error", e); isPlaying = false; updatePlayBtn(); }); 
}

function renderPlaylist() { 
    app.music.list.innerHTML = ""; 
    playlist.forEach((track, index) => { 
        const div = document.createElement('div'); div.className = 'track-row'; 
        if(index === currentTrackIdx) div.classList.add('active'); 
        div.innerHTML = `<div><h5>${track.title}</h5><p>${track.artist}</p></div><i class="fa-solid fa-play" style="font-size:0.8rem"></i>`; 
        div.addEventListener('click', () => loadTrack(index)); app.music.list.appendChild(div); 
    }); 
}

function loadTrack(index, autoPlay = true) { 
    if(index < 0 || index >= playlist.length) return; 
    currentTrackIdx = index; const track = playlist[index]; 
    audioPlayer.src = track.src; app.music.title.innerText = track.title; app.music.artist.innerText = track.artist; 
    renderPlaylist(); 
    if(autoPlay) { audioPlayer.play().then(() => { isPlaying = true; updatePlayBtn(); }).catch(e => { isPlaying = false; updatePlayBtn(); }); } 
}

function togglePlay() { if(playlist.length === 0) { alert("Bitte erst Musik laden!"); return; } if(isPlaying) { audioPlayer.pause(); isPlaying = false; } else { audioPlayer.play(); isPlaying = true; } updatePlayBtn(); }
function updatePlayBtn() { if(isPlaying) { app.music.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; app.music.aura.classList.add('playing'); } else { app.music.playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; app.music.aura.classList.remove('playing'); } }
function nextTrack() { let next = currentTrackIdx + 1; if(next >= playlist.length) next = 0; loadTrack(next); }
function prevTrack() { let prev = currentTrackIdx - 1; if(prev < 0) prev = playlist.length - 1; loadTrack(prev); }
