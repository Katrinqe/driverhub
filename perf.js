// --- PERFORMANCE MODULE ---
let perfWatchId = null;
let perfState = 'idle'; // idle, armed, running, finished
let perfStartTime = 0;
let result50 = null;
let result100 = null;
let maxG = 0;

// Speech Synthesis Helper
let synth = window.speechSynthesis;
function speak(text) { if (!synth) return; const utter = new SpeechSynthesisUtterance(text); synth.speak(utter); }

// Event Listener
app.perf.btn.addEventListener('click', () => { 
    if(perfState === 'idle' || perfState === 'finished') { 
        perfState = 'armed'; 
        app.perf.btn.innerText = "READY"; 
        app.perf.btn.classList.add('armed'); 
        app.perf.status.innerText = "Launch when ready!"; 
        app.perf.val50.innerText = "--.- s"; 
        app.perf.val100.innerText = "--.- s"; 
        app.perf.box50.classList.remove('active'); 
        app.perf.box100.classList.remove('active'); 
        maxG = 0; result50 = null; result100 = null; 
        
        // Sensoren anfragen (iOS 13+ braucht Permission)
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { 
            DeviceMotionEvent.requestPermission().then(s => { if (s === 'granted') startPerfSensors(); }).catch(console.error); 
        } else { 
            startPerfSensors(); 
        } 
        
        if (navigator.geolocation) { 
            perfWatchId = navigator.geolocation.watchPosition(updatePerfLogic, err => console.warn(err), {enableHighAccuracy: true}); 
        } 
    } else { 
        resetPerfMode(); 
    } 
});

function startPerfSensors() { window.addEventListener('devicemotion', handleMotion); }

function handleMotion(event) { 
    if(perfState !== 'running') return; 
    const x = event.acceleration.x || 0; 
    const y = event.acceleration.y || 0; 
    const z = event.acceleration.z || 0; 
    const totalAccel = Math.sqrt(x*x + y*y + z*z); 
    const currentG = totalAccel / 9.81; 
    if(currentG > maxG) { 
        maxG = currentG; 
        app.perf.gVal.innerText = maxG.toFixed(2) + " G"; 
    } 
}

function updatePerfLogic(position) { 
    const speedKmh = (position.coords.speed || 0) * 3.6; 
    app.perf.speed.innerText = speedKmh.toFixed(0); 
    
    if(perfState === 'armed') { 
        if(speedKmh > 2.0) { 
            perfState = 'running'; 
            perfStartTime = Date.now(); 
            app.perf.btn.innerText = "GO!"; 
            app.perf.status.innerText = "Recording..."; 
        } 
    } else if(perfState === 'running') { 
        const duration = (Date.now() - perfStartTime) / 1000; 
        
        // 0-50 Messung
        if(!result50 && speedKmh >= 50) { 
            result50 = duration.toFixed(2); 
            app.perf.val50.innerText = result50 + " s"; 
            app.perf.box50.classList.add('active'); 
        } 
        
        // 0-100 Messung
        if(!result100 && speedKmh >= 100) { 
            result100 = duration.toFixed(2); 
            app.perf.val100.innerText = result100 + " s"; 
            app.perf.box100.classList.add('active'); 
            perfState = 'finished'; 
            app.perf.btn.innerText = "RESET"; 
            app.perf.btn.classList.remove('armed'); 
            app.perf.status.innerText = "Run Complete!"; 
            speak("Hundert erreicht in " + result100.replace('.', ',') + " Sekunden."); 
            savePerfRun(); 
        } 
    } 
}

function resetPerfMode() { 
    perfState = 'idle'; 
    app.perf.btn.innerText = "ARM"; 
    app.perf.btn.classList.remove('armed'); 
    app.perf.status.innerText = "Tap to arm, then launch."; 
    if(perfWatchId) navigator.geolocation.clearWatch(perfWatchId); 
    window.removeEventListener('devicemotion', handleMotion); 
    app.perf.speed.innerText = "0"; 
}

function savePerfRun() { 
    const run = { id: Date.now(), date: new Date().toISOString(), res50: result50, res100: result100, maxG: maxG.toFixed(2) }; 
    let runs = JSON.parse(localStorage.getItem('dh_perf_v1')) || []; 
    runs.unshift(run); 
    localStorage.setItem('dh_perf_v1', JSON.stringify(runs)); 
    renderPerfHistory(); 
}

// Wird global aufgerufen beim Start
window.renderPerfHistory = function() { 
    let runs = JSON.parse(localStorage.getItem('dh_perf_v1')) || []; 
    const list = app.perf.list; 
    list.innerHTML = ''; 
    runs.forEach(run => { 
        const dateStr = new Date(run.date).toLocaleDateString('de-DE'); 
        const item = document.createElement('div'); 
        item.className = 'drive-item'; 
        item.innerHTML = `<div><h5>${dateStr}</h5><span>Max ${run.maxG} G</span></div><div class="right-side"><span style="color:#ff3b30; font-weight:bold;">0-100: ${run.res100}s</span><br><span style="font-size:0.75rem">0-50: ${run.res50}s</span></div>`; 
        list.appendChild(item); 
    }); 
}
