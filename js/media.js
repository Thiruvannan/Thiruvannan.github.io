class ShuffleDeck {
  constructor(items = []) {
    this.source = [...items];
    this.queue = [];
    this.lastPlayed = null;
    this.refill();
  }
  setItems(newItems) {
    if (!newItems || newItems.length === 0) return;
    this.source = [...newItems];
    this.refill();
  }
  refill() {
    this.queue = [...this.source];
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    if (this.queue.length > 1 && this.queue[0] === this.lastPlayed) {
      const first = this.queue.shift();
      this.queue.push(first);
    }
  }
  next() {
    if (this.source.length === 0) return null;
    if (this.queue.length === 0) this.refill();
    const item = this.queue.shift();
    this.lastPlayed = item;
    return item;
  }
}

export const landscapeDeck = new ShuffleDeck();
export const portraitDeck = new ShuffleDeck();
export const audioDeck = new ShuffleDeck([
  { title: "Aalaporan Thamizhan", artist: "A.R. Rahman", src: "Audio/Aalaporan-Thamizhan-MassTamilan.com.mp3" },
  { title: "Kannukulla", artist: "Indie OST", src: "Audio/Kannukulla.mp3" },
  { title: "Pesamale", artist: "OST Mix", src: "Audio/Pesamale(KoshalWorld.Com).mp3" },
  { title: "Under the Tree", artist: "SiM (Attack on Titan)", src: "Audio/SiM_-_Under_the_Tree_Attack_on_Titan_(mp3.pm).mp3" },
  { title: "Thamarai Poovukum", artist: "Classic Tamil", src: "Audio/Thamarai Poovukum.mp3" }
]);

export async function syncRepoMedia() {
  const repoBase = "https://api.github.com/repos/Thiruvannan/Thiruvannan.github.io/contents";
  const isMedia = (name, exts) => exts.some(ext => name.toLowerCase().endsWith(ext));

  try {
    const resLand = await fetch(`${repoBase}/Videos/Landscape`);
    if (resLand.ok) {
      const files = await resLand.json();
      const urls = files.filter(f => isMedia(f.name, ['.mp4', '.webm', '.mov', '.mkv'])).map(f => `Videos/Landscape/${encodeURIComponent(f.name)}`);
      if (urls.length > 0) landscapeDeck.setItems(urls);
    }

    const resPort = await fetch(`${repoBase}/Videos/Portrait`);
    if (resPort.ok) {
      const files = await resPort.json();
      const urls = files.filter(f => isMedia(f.name, ['.mp4', '.webm', '.mov', '.mkv'])).map(f => `Videos/Portrait/${encodeURIComponent(f.name)}`);
      if (urls.length > 0) portraitDeck.setItems(urls);
    }

    const resAud = await fetch(`${repoBase}/Audio`);
    if (resAud.ok) {
      const files = await resAud.json();
      const tracks = files.filter(f => isMedia(f.name, ['.mp3', '.wav', '.ogg', '.m4a'])).map(f => {
        const cleanName = f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        return { title: cleanName, artist: "SRM Hub OST", src: `Audio/${encodeURIComponent(f.name)}` };
      });
      if (tracks.length > 0) audioDeck.setItems(tracks);
    }
  } catch (err) { console.log("Using cached media deck."); }
}

export function initMediaEngine(triggerHapticFn) {
  const audioPlayer = document.getElementById('bg-audio');
  const playBtn = document.getElementById('play-pause-btn');
  const musicWidget = document.getElementById('floating-music-player');
  const artProgress = document.querySelector('.art-progress');
  const trackLabel = document.getElementById('track-name');
  
  let currentTrack = null;
  let showRingTimer = null;
  let pressTimer = null;
  let holdStartCoords = { x: 0, y: 0 };
  let wasMusicPlayingBeforeVision = false;

  const visionContainer = document.getElementById('vision-container');
  const visionVideo = document.getElementById('vision-video');
  const holdIndicator = document.getElementById('hold-indicator');

  // MUSIC PLAYER LOGIC
  function updatePlayerUI(isPlaying) {
    if (isPlaying) {
      playBtn.innerHTML = '<i data-lucide="pause"></i>';
      musicWidget.classList.add('playing');
    } else {
      playBtn.innerHTML = '<i data-lucide="play"></i>';
      musicWidget.classList.remove('playing');
    }
    window.lucide.createIcons();
  }

  function loadNextShuffledTrack() {
    currentTrack = audioDeck.next();
    if (!currentTrack) return;
    audioPlayer.src = currentTrack.src;
    trackLabel.textContent = currentTrack.title; // Only the song title
    
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: "SRM Hub OST",
        artwork: [{ src: "https://github.com/Thiruvannan.png", sizes: "512x512", type: "image/png" }]
      });
      navigator.mediaSession.setActionHandler('play', () => { audioPlayer.play(); updatePlayerUI(true); });
      navigator.mediaSession.setActionHandler('pause', () => { audioPlayer.pause(); updatePlayerUI(false); });
      navigator.mediaSession.setActionHandler('nexttrack', playNextTrack);
      navigator.mediaSession.setActionHandler('previoustrack', playNextTrack);
    }
  }

  function toggleMusic() {
    triggerHapticFn('light');
    if (audioPlayer.paused) {
      if (!audioPlayer.src || !currentTrack) loadNextShuffledTrack();
      audioPlayer.play().then(() => updatePlayerUI(true)).catch(() => {});
    } else {
      audioPlayer.pause();
      updatePlayerUI(false);
    }
  }

  function playNextTrack() {
    triggerHapticFn('light');
    loadNextShuffledTrack();
    audioPlayer.play().then(() => updatePlayerUI(true)).catch(() => {});
  }

  audioPlayer.addEventListener('timeupdate', () => {
    const perc = (audioPlayer.currentTime / audioPlayer.duration) * 100 || 0;
    artProgress.style.setProperty('--progress', `${perc}%`);
  });
  audioPlayer.addEventListener('ended', playNextTrack);

  let musicTouchStartX = 0;
  musicWidget.addEventListener('touchstart', e => musicTouchStartX = e.touches[0].clientX, {passive: true});
  musicWidget.addEventListener('touchend', e => {
    if (Math.abs(musicTouchStartX - e.changedTouches[0].clientX) > 40) playNextTrack();
  }, {passive: true});

  // VISION ENGINE LOGIC
  function isInteractiveElement(target) {
    return target.closest('a') || target.closest('select') || target.closest('#floating-music-player') || target.closest('#hunter-badge') || target.closest('.ios-row') || target.closest('button');
  }

  function startHold(x, y, target) {
    if (isInteractiveElement(target)) return;
    holdStartCoords = { x, y };
    showRingTimer = setTimeout(() => {
      holdIndicator.style.left = `${x}px`;
      holdIndicator.style.top = `${y}px`;
      holdIndicator.classList.add('holding');
    }, 300);
    pressTimer = setTimeout(() => {
      holdIndicator.classList.remove('holding');
      triggerVision();
    }, 1500);
  }

  function cancelHold() {
    clearTimeout(showRingTimer);
    clearTimeout(pressTimer);
    holdIndicator.classList.remove('holding');
  }

  function triggerVision() {
    triggerHapticFn('success');
    wasMusicPlayingBeforeVision = !audioPlayer.paused;
    if (wasMusicPlayingBeforeVision) audioPlayer.pause();

    const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;
    const activeDeck = isMobileViewport ? portraitDeck : landscapeDeck;
    const chosenVideoSrc = activeDeck.next();
    
    if (!chosenVideoSrc) return;
    visionVideo.src = chosenVideoSrc;
    visionContainer.classList.add('active');
    visionVideo.play().catch(() => {});
  }

  function closeVision() {
    if (!visionContainer.classList.contains('active')) return;
    visionContainer.classList.remove('active');
    visionVideo.pause();
    visionVideo.removeAttribute('src');
    visionVideo.load();
    if (wasMusicPlayingBeforeVision) audioPlayer.play().catch(() => {});
  }

  document.body.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) startHold(e.touches[0].clientX, e.touches[0].clientY, e.target);
    else cancelHold();
  }, { passive: true });
  document.body.addEventListener('touchmove', cancelHold, { passive: true });
  document.body.addEventListener('touchend', cancelHold, { passive: true });
  document.body.addEventListener('mousedown', (e) => {
    if (e.button === 0) startHold(e.clientX, e.clientY, e.target);
  });
  document.body.addEventListener('mousemove', (e) => {
    if (Math.hypot(e.clientX - holdStartCoords.x, e.clientY - holdStartCoords.y) > 15) cancelHold();
  });
  document.body.addEventListener('mouseup', cancelHold);
  
  visionContainer.addEventListener('click', closeVision);
  visionVideo.addEventListener('ended', closeVision);

  // Expose triggers to window for HTML onclicks
  window.toggleMusic = toggleMusic;
  window.playNextRandomTrack = playNextTrack;
}
