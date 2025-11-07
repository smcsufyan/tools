// ==============================================================================
// 1. GLOBAL SETUP AND UTILITIES
// ==============================================================================

// Shared Web Audio Context
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// ==============================================================================
// 2. TOOL SWITCHING LOGIC
// ==============================================================================

const metronomeSection = document.getElementById('metronomeSection');
const tunerSection = document.getElementById('tunerSection');
const showMetronomeBtn = document.getElementById('showMetronome');
const showTunerBtn = document.getElementById('showTuner');

showMetronomeBtn.addEventListener('click', () => {
    metronomeSection.classList.remove('hidden');
    tunerSection.classList.add('hidden');
    showMetronomeBtn.classList.add('active');
    showTunerBtn.classList.remove('active');
    
    // Stop Tuner when switching to Metronome
    if (tunerRunning) stopTuner();
});

showTunerBtn.addEventListener('click', () => {
    tunerSection.classList.remove('hidden');
    metronomeSection.classList.add('hidden');
    showTunerBtn.classList.add('active');
    showMetronomeBtn.classList.remove('active');
    
    // Stop Metronome when switching to Tuner
    if (isPlaying) startStopMetronome();
    
    // Start Tuner (will ask for mic permission)
    if (!tunerRunning) startTuner();
});


// ==============================================================================
// 3. METRONOME LOGIC
// ==============================================================================

const bpmSlider = document.getElementById('bpmSlider');
const bpmValue = document.getElementById('bpmValue');
const startStopBtn = document.getElementById('startStopBtn');
const bpmUp = document.getElementById('bpmUp');
const bpmDown = document.getElementById('bpmDown');
const beatIndicator = document.getElementById('beatIndicator');

let tempo = 120;
let isPlaying = false;
let intervalId = null;
let nextNoteTime = 0.0;
let lookahead = 25.0; 
let scheduleAheadTime = 0.1; 
let currentBeat = 0; 
let beatsPerMeasure = 4; 

function playClick(time, frequency) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.frequency.setValueAtTime(frequency, time); 
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    gainNode.gain.setValueAtTime(1, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    oscillator.start(time);
    oscillator.stop(time + 0.05);
}

function updateBeatIndicator() {
    beatIndicator.classList.add('active');
    setTimeout(() => {
        beatIndicator.classList.remove('active');
    }, 50); 
}

function scheduler() {
    while (nextNoteTime < audioContext.currentTime + scheduleAheadTime ) {
        // High pitch for the first beat (880Hz), normal for others (440Hz)
        let frequency = (currentBeat % beatsPerMeasure === 0) ? 880 : 440; 
        
        playClick(nextNoteTime, frequency); 
        updateBeatIndicator();
        
        currentBeat = (currentBeat + 1) % beatsPerMeasure; 
        
        let secondsPerBeat = 60.0 / tempo;
        nextNoteTime += secondsPerBeat;
    }
}

function startStopMetronome() {
    if (isPlaying) {
        // STOP
        clearInterval(intervalId);
        isPlaying = false;
        startStopBtn.textContent = 'START';
        startStopBtn.classList.remove('stop');
        startStopBtn.classList.add('start');
    } else {
        // START
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        isPlaying = true;
        startStopBtn.textContent = 'STOP';
        startStopBtn.classList.remove('start');
        startStopBtn.classList.add('stop');
        
        currentBeat = 0; 
        nextNoteTime = audioContext.currentTime;
        intervalId = setInterval(scheduler, lookahead);
    }
}

// Event Listeners for Metronome
bpmSlider.addEventListener('input', (e) => {
    tempo = parseInt(e.target.value);
    bpmValue.textContent = tempo;
    if (isPlaying) {
        nextNoteTime = audioContext.currentTime;
    }
});

bpmUp.addEventListener('click', () => {
    if (tempo < 240) {
        tempo++;
        bpmSlider.value = tempo;
        bpmValue.textContent = tempo;
        if (isPlaying) { nextNoteTime = audioContext.currentTime; }
    }
});

bpmDown.addEventListener('click', () => {
    if (tempo > 40) {
        tempo--;
        bpmSlider.value = tempo;
        bpmValue.textContent = tempo;
        if (isPlaying) { nextNoteTime = audioContext.currentTime; }
    }
});

startStopBtn.addEventListener('click', startStopMetronome);
bpmValue.textContent = tempo;


// ==============================================================================
// 4. TUNER LOGIC
// ==============================================================================

const tunerStatus = document.getElementById('tunerStatus');
const noteDisplay = document.getElementById('noteName');
const detuneBar = document.getElementById('detuneBar');

let tunerRunning = false;
let mediaStreamSource;
let analyser;

// Simple Autocorrelation function for pitch detection
function autoCorrelate(buf, sampleRate) {
    const MIN_SAMPLES = 4;  
    const MAX_SAMPLES = 1000;
    const SIZE = buf.length;
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;
    
    // Calculate RMS for volume threshold
    for (let i = 0; i < SIZE; i++) {
        rms += buf[i] * buf[i];
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // Too quiet

    // Calculate correlation
    for (let offset = MIN_SAMPLES; offset <= MAX_SAMPLES; offset++) {
        let correlation = 0;
        for (let i = 0; i < SIZE - offset; i++) {
            correlation += buf[i] * buf[i + offset];
        }

        if (correlation > best_correlation) {
            best_correlation = correlation;
            best_offset = offset;
        }
    }
    
    // Simple interpolation for better accuracy
    if (best_correlation > 0.99) {
        const shift = (buf[best_offset + 1] - buf[best_offset - 1]) / (2 * buf[best_offset] - buf[best_offset - 1] - buf[best_offset + 1]);
        return sampleRate / (best_offset + shift);
    }
    
    return sampleRate / best_offset;
}

// Tuner Update Loop
function updateTuner() {
    if (!tunerRunning || !analyser) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const frequency = autoCorrelate(buffer, audioContext.sampleRate);

    if (frequency == -1 || frequency < 50) {
        noteDisplay.textContent = '--';
        detuneBar.style.left = '50%';
        tunerStatus.textContent = "No sound detected...";
        detuneBar.style.backgroundColor = '#333';
    } else {
        // Calculate the closest MIDI note number (A4 = 69)
        const note = Math.round(12 * (Math.log(frequency / 440) / Math.log(2))) + 69;
        
        // Find the note name (C, C#, D, etc.)
        const noteName = noteStrings[note % 12];
        
        // Calculate the difference in cents
        const exactFrequency = 440 * Math.pow(2, (note - 69) / 12);
        const cents = 1200 * Math.log(frequency / exactFrequency) / Math.log(2);
        
        noteDisplay.textContent = noteName;
        
        // Update Detune Bar position
        let barPosition = 50 + cents / 50 * 40; // Scale cents for bar movement
        barPosition = Math.min(Math.max(barPosition, 10), 90); // Clamp between 10% and 90%
        detuneBar.style.left = barPosition + '%';

        if (Math.abs(cents) < 5) { // Perfect tune within 5 cents
            tunerStatus.textContent = "In Tune!";
            detuneBar.style.backgroundColor = '#28a745'; // Green
        } else if (cents < 0) {
            tunerStatus.textContent = `${Math.round(cents)} cents (Flat)`;
            detuneBar.style.backgroundColor = '#dc3545'; // Red (Flat)
        } else {
            tunerStatus.textContent = `+${Math.round(cents)} cents (Sharp)`;
            detuneBar.style.backgroundColor = '#ffc107'; // Yellow (Sharp)
        }
    }
    
    requestAnimationFrame(updateTuner);
}

// Start Tuner function
function startTuner() {
    if (tunerRunning) return;
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaStreamSource = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            
            // Set up analyser for pitch detection
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8; 
            mediaStreamSource.connect(analyser);
            
            tunerRunning = true;
            tunerStatus.textContent = "Microphone ON. Start playing...";
            updateTuner(); // Start the analysis loop
        })
        .catch(err => {
            tunerStatus.textContent = "Microphone permission denied. Please allow access.";
            console.error("Error accessing microphone:", err);
        });
}

function stopTuner() {
    if (!tunerRunning) return;
    tunerRunning = false;
    if (mediaStreamSource && mediaStreamSource.mediaStream) {
        mediaStreamSource.mediaStream.getTracks().forEach(track => track.stop());
    }
    tunerStatus.textContent = "Tuner Off";
    noteDisplay.textContent = '--';
    detuneBar.style.left = '50%';
}
