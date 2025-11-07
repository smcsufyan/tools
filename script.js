// Switching Logic
document.getElementById('showMetronome').addEventListener('click', () => {
    document.getElementById('metronomeSection').classList.remove('hidden');
    document.getElementById('tunerSection').classList.add('hidden');
    document.getElementById('showMetronome').classList.add('active');
    document.getElementById('showTuner').classList.remove('active');
    
    // Stop tuner if active
    if (tunerRunning) stopTuner();
});

document.getElementById('showTuner').addEventListener('click', () => {
    document.getElementById('tunerSection').classList.remove('hidden');
    document.getElementById('metronomeSection').classList.add('hidden');
    document.getElementById('showTuner').classList.add('active');
    document.getElementById('showMetronome').classList.remove('active');
    
    // Stop metronome if active
    if (isPlaying) startStopMetronome();
    
    // Start tuner (will ask for mic permission)
    if (!tunerRunning) startTuner();
});
