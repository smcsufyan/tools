const bpmSlider = document.getElementById('bpmSlider');
const bpmValue = document.getElementById('bpmValue');
const startStopBtn = document.getElementById('startStopBtn');
const bpmUp = document.getElementById('bpmUp');
const bpmDown = document.getElementById('bpmDown');
const beatIndicator = document.getElementById('beatIndicator');

let tempo = 120;
let isPlaying = false;
let intervalId = null;

// Web Audio API for precise timing
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let nextNoteTime = 0.0; // The time when the next note is due.
let lookahead = 25.0; // How frequently to call scheduling function (in milliseconds)
let scheduleAheadTime = 0.1; // How far ahead to schedule audio (in seconds)

// Create a simple click sound (oscillator)
function playClick(time) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Set frequency (high pitch for metronome)
    oscillator.frequency.setValueAtTime(440, time); 
    
    // Connect to speakers
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set volume
    gainNode.gain.setValueAtTime(1, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05); // quick fade out

    // Start and stop the click
    oscillator.start(time);
    oscillator.stop(time + 0.05);
}

// Function to schedule the next beat
function scheduler() {
    while (nextNoteTime < audioContext.currentTime + scheduleAheadTime ) {
        playClick(nextNoteTime);
        updateBeatIndicator();
        
        // Calculate the time for the next beat
        let secondsPerBeat = 60.0 / tempo;
        nextNoteTime += secondsPerBeat;
    }
}

// Visual indicator flash
function updateBeatIndicator() {
    beatIndicator.classList.add('active');
    setTimeout(() => {
        beatIndicator.classList.remove('active');
    }, 50); 
}

// Main function to start and stop the metronome
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
        
        // Reset and start scheduler
        nextNoteTime = audioContext.currentTime;
        intervalId = setInterval(scheduler, lookahead);
    }
}

// Event Listeners
bpmSlider.addEventListener('input', (e) => {
    tempo = parseInt(e.target.value);
    bpmValue.textContent = tempo;
    if (isPlaying) {
        // Re-calculate the next note time immediately after changing tempo
        nextNoteTime = audioContext.currentTime; 
    }
});

bpmUp.addEventListener('click', () => {
    if (tempo < 240) {
        tempo++;
        bpmSlider.value = tempo;
        bpmValue.textContent = tempo;
        if (isPlaying) {
            nextNoteTime = audioContext.currentTime;
        }
    }
});

bpmDown.addEventListener('click', () => {
    if (tempo > 40) {
        tempo--;
        bpmSlider.value = tempo;
        bpmValue.textContent = tempo;
        if (isPlaying) {
            nextNoteTime = audioContext.currentTime;
        }
    }
});

startStopBtn.addEventListener('click', startStopMetronome);

// Initialize display with current tempo
bpmValue.textContent = tempo;
