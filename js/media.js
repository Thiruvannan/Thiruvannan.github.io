// ==========================================================================
// PHASE 4: TACTICAL MEDIA ENGINE
// ==========================================================================

const bgAudio = document.getElementById('bg-audio');
const trackNameLabel = document.getElementById('track-name');
const playBtn = document.querySelector('.play-btn');

// EXACT paths matching your GitHub repository structure
const audioTracks = [
  { title: "Aalaporan Thamizhan", src: "Audio/Aalaporan-Thamizhan.mp3" },
  { title: "Kannukulla", src: "Audio/Kannukulla.mp3" },
  { title: "Pesamale", src: "Audio/Pesamale.mp3" },
  { title: "Under the Tree", src: "Audio/SiM_-_Under_the_Tree_Attack_on_Titan_(mp3.pm).mp3" },
  { title: "Thamarai Poovukum", src: "Audio/Thamarai Poovukum.mp3" }
];

let currentTrackIndex = 0;

// ==========================================================================
// AUDIO CONTROLLER
// ==========================================================================

function updateAudioUI(isPlaying) {
  if (!playBtn) return;
  
  if (isPlaying) {
    playBtn.innerHTML = '<i data-lucide="pause"></i>';
    document.getElementById('acoustic-dock')?.classList.add('playing');
  } else {
    playBtn.innerHTML = '<i data-lucide="play"></i>';
    document.getElementById('acoustic-dock')?.classList.remove('playing');
  }
  if (window.lucide) window.lucide.createIcons();
}

function loadTrack(index) {
  if (!bgAudio || audioTracks.length === 0) return;
  
  // Wrap index to handle looping
  if (index >= audioTracks.length) index = 0;
  if (index < 0) index = audioTracks.length - 1;
  
  currentTrackIndex = index;
  const track = audioTracks[currentTrackIndex];
  
  // Use encodeURI to safely handle spaces and special characters in filenames
  bgAudio.src = encodeURI(track.src);
  if (trackNameLabel) trackNameLabel.textContent = track.title;
}

function toggleAudio() {
  if (!bgAudio) return;
  
  if (bgAudio.paused) {
    if (!bgAudio.src) loadTrack(0);
    bgAudio.play().then(() => updateAudioUI(true)).catch(() => {});
  } else {
    bgAudio.pause();
    updateAudioUI(false);
  }
}

function playNextTrack() {
  loadTrack(currentTrackIndex + 1);
  bgAudio.play().then(() => updateAudioUI(true)).catch(() => {});
}

function playPrevTrack() {
  loadTrack(currentTrackIndex - 1);
  bgAudio.play().then(() => updateAudioUI(true)).catch(() => {});
}

// Bind Audio Ended Event
if (bgAudio) {
  bgAudio.addEventListener('ended', playNextTrack);
}

// ==========================================================================
// TACTICAL LONG-PRESS VISION (EREN)
// ==========================================================================

let pressTimer = null;
let holdIndicatorTimer = null;
let touchStartX = 0;
let touchStartY = 0;
let wasAudioPlaying = false;

const holdReticle = document.getElementById('hold-reticle');
const visionContainer = document.getElementById('vision-container');
const visionVideo = document.getElementById('vision-video');

function isInteractiveTarget(target) {
  return target.closest('button') || 
         target.closest('a') || 
         target.closest('select') || 
         target.closest('.tactical-menu') ||
         target.closest('#telemetry-drawer') ||
         target.closest('#acoustic-dock');
}

function startHold(x, y, target) {
  if (isInteractiveTarget(target)) return;

  touchStartX = x;
  touchStartY = y;

  holdIndicatorTimer = setTimeout(() => {
    if (holdReticle) {
      holdReticle.style.left = `${x}px`;
      holdReticle.style.top = `${y}px`;
      holdReticle.classList.add('holding');
    }
  }, 300);

  pressTimer = setTimeout(() => {
    if (holdReticle) holdReticle.classList.remove('holding');
    triggerVision();
  }, 1200);
}

function cancelHold() {
  clearTimeout(holdIndicatorTimer);
  clearTimeout(pressTimer);
  if (holdReticle) holdReticle.classList.remove('holding');
}

function triggerVision() {
  if (!visionContainer || !visionVideo) return;
  
  if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

  wasAudioPlaying = bgAudio && !bgAudio.paused;
  if (wasAudioPlaying) bgAudio.pause();

  visionContainer.classList.add('active');
  
  // Directly load the Eren edit (bypassing the broken GitHub API logic)
  visionVideo.src = encodeURI("Videos/Landscape/what eren really, REALLY saw [KCKfWNLSn_I].webm");
  visionVideo.play().catch(() => {});
}

function closeVision() {
  if (!visionContainer) return;
  
  visionContainer.classList.remove('active');
  if (visionVideo) {
    visionVideo.pause();
    visionVideo.removeAttribute('src');
    visionVideo.load();
  }
  
  if (wasAudioPlaying && bgAudio) {
    bgAudio.play().catch(() => {});
  }
}

// Bind Touch/Mouse Events for Long Press
document.body.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    startHold(e.touches[0].clientX, e.touches[0].clientY, e.target);
  }
}, { passive: true });

document.body.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1) {
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 15 || dy > 15) cancelHold();
  }
}, { passive: true });

document.body.addEventListener('touchend', cancelHold, { passive: true });
document.body.addEventListener('mousedown', (e) => {
  if (e.button === 0) startHold(e.clientX, e.clientY, e.target);
});
document.body.addEventListener('mousemove', (e) => {
  const dx = Math.abs(e.clientX - touchStartX);
  const dy = Math.abs(e.clientY - touchStartY);
  if (dx > 15 || dy > 15) cancelHold();
});
document.body.addEventListener('mouseup', cancelHold);

// Close Vision on Click/End
if (visionContainer) visionContainer.addEventListener('click', closeVision);
if (visionVideo) visionVideo.addEventListener('ended', closeVision);

// ==========================================================================
// EXPORT & BINDINGS
// ==========================================================================

// Attach audio controls to the global document listener we set up in main.js
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-trigger]');
  if (trigger) {
    const action = trigger.dataset.trigger;
    
    // Play audio haptic buzz
    if (action === 'audio-toggle' || action === 'audio-next' || action === 'audio-prev') {
      if (navigator.vibrate) navigator.vibrate(20);
    }
    
    if (action === 'audio-toggle') toggleAudio();
    if (action === 'audio-next') playNextTrack();
    if (action === 'audio-prev') playPrevTrack();
  }
});

// Initialize first track name on load
document.addEventListener('DOMContentLoaded', () => {
  if (audioTracks.length > 0 && trackNameLabel) {
    trackNameLabel.textContent = audioTracks[0].title;
  }
});