// ==========================================================================
// PHASE 3: TACTICAL TELEMETRY ENGINE
// ==========================================================================

import { 
  firebaseConfig, 
  SECRET_PIN, 
  baselineAttendance, 
  slots, 
  timetable, 
  academicPlanner 
} from './config.js';

import './media.js';

let attendanceData = JSON.parse(JSON.stringify(baselineAttendance));
let loggedDailyActions = {};
let activeDayOrder = null;
let isEditMode = false;
let historyStack = [];

let totalAttended = 0;
let totalConducted = 0;
let totalSafeBunks = 0;
let clearancePercentage = 100;

const cashSfx = document.getElementById('cash-sfx');
const biwaSfx = document.getElementById('biwa-sfx');

function playAudioCue(audioEl) {
  if (!audioEl) return;
  audioEl.currentTime = 0;
  audioEl.volume = 0.8;
  audioEl.play().catch(() => {});
}

function triggerHaptic(type = 'light') {
  if (!navigator.vibrate) return;
  if (type === 'light') navigator.vibrate(25);
  if (type === 'success') navigator.vibrate([20, 30, 20]);
  if (type === 'undo') navigator.vibrate([50, 40]);
}

function getTodayDateStr() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)).toISOString().split('T')[0];
}

function getTodayDayOrder() {
  return academicPlanner[getTodayDateStr()] || 1;
}

function calculateMargin(attended, conducted) {
  if (conducted === 0) return { text: "No logs yet", safe: true, bunks: 0 };
  const perc = (attended / conducted) * 100;
  if (perc >= 75) {
    const canBunk = Math.floor((attended - (0.75 * conducted)) / 0.75);
    return { 
      text: canBunk > 0 ? `+${canBunk} Safe Bunks` : `On the Edge (0)`, 
      safe: true, 
      bunks: canBunk 
    };
  } else {
    const mustAttend = Math.ceil(((0.75 * conducted) - attended) / 0.25);
    return { 
      text: `Deficit: Attend ${mustAttend}`, 
      safe: false, 
      bunks: 0 
    };
  }
}

function renderSchedule() {
  if (activeDayOrder === null) activeDayOrder = getTodayDayOrder();
  const container = document.getElementById('schedule-container');
  if (!container) return;
  container.innerHTML = '';

  const today = getTodayDateStr();
  const dayClasses = timetable[activeDayOrder];

  if (!dayClasses) {
    container.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:12px;">No sessions scheduled for Day Order ${activeDayOrder}.</div>`;
    return;
  }

  for (const [slotNum, code] of Object.entries(dayClasses)) {
    const sub = attendanceData[code] || { name: code };
    const logKey = `${today}_D${activeDayOrder}_S${slotNum}_${code}`;
    const loggedStatus = loggedDailyActions[logKey];

    let actionUI = '';
    if (loggedStatus === 'attended') {
      actionUI = `<div style="padding:8px; border-radius:8px; background:rgba(56,189,248,0.12); color:var(--accent-cyan); font-size:11px; font-weight:700; text-align:center;">Attended</div>`;
    } else if (loggedStatus === 'missed') {
      actionUI = `<div style="padding:8px; border-radius:8px; background:rgba(239,68,68,0.12); color:var(--accent-red); font-size:11px; font-weight:700; text-align:center;">Missed</div>`;
    } else if (isEditMode) {
      actionUI = `
        <div style="display:flex; gap:8px;">
          <button class="btn-tactical" style="flex:1; justify-content:center; background:rgba(56,189,248,0.18); color:var(--accent-cyan);" data-log-class="${code}" data-slot="${slotNum}" data-status="attended">Attend</button>
          <button class="btn-tactical" style="flex:1; justify-content:center; background:rgba(239,68,68,0.18); color:var(--accent-red);" data-log-class="${code}" data-slot="${slotNum}" data-status="missed">Miss</button>
        </div>`;
    } else {
      actionUI = `<div style="padding:8px; border-radius:8px; background:rgba(255,255,255,0.03); color:var(--text-muted); font-size:11px; text-align:center;">Locked (View Only)</div>`;
    }

    container.innerHTML += `
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:var(--radius-sm); padding:12px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="font-size:10px; color:var(--text-muted); font-family:'Share Tech Mono', monospace;">SLOT ${slotNum} • ${code}</div>
            <div style="font-size:13px; font-weight:700; margin-top:2px;">${sub.name}</div>
          </div>
          <span style="font-size:10px; background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-family:'Share Tech Mono', monospace;">${slots[slotNum]?.str || ''}</span>
        </div>
        ${actionUI}
      </div>`;
  }

  if (window.lucide) window.lucide.createIcons();
}

function renderMatrix() {
  const container = document.getElementById('matrix-container');
  if (!container) return;
  container.innerHTML = '';

  totalAttended = 0;
  totalConducted = 0;
  totalSafeBunks = 0;

  for (const [code, data] of Object.entries(attendanceData)) {
    totalAttended += data.attended;
    totalConducted += data.conducted;

    const perc = data.conducted === 0 ? 100 : ((data.attended / data.conducted) * 100);
    const margin = calculateMargin(data.attended, data.conducted);
    totalSafeBunks += margin.bunks;

    const percColor = perc >= 90 ? 'var(--accent-cyan)' : perc >= 75 ? 'var(--accent-amber)' : 'var(--accent-red)';
    const marginColor = margin.safe ? 'var(--accent-cyan)' : 'var(--accent-red)';

    let extraRowUI = isEditMode ? `
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.08); padding-top:8px; margin-top:4px;">
        <span style="font-size:10px; color:var(--text-muted);">EXTRA SLOT</span>
        <div style="display:flex; gap:6px;">
          <button class="btn-tactical" style="padding:4px 8px; font-size:10px;" data-surprise-class="${code}" data-status="attended">+ Attend</button>
          <button class="btn-tactical" style="padding:4px 8px; font-size:10px;" data-surprise-class="${code}" data-status="missed">+ Miss</button>
        </div>
      </div>` : '';

    container.innerHTML += `
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:var(--radius-sm); padding:12px; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:13px; font-weight:700;">${data.name}</span>
          <span style="font-family:'Share Tech Mono', monospace; font-size:13px; font-weight:800; color:${percColor};">${perc.toFixed(1)}%</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px;">
          <span style="color:var(--text-muted);">${data.attended} / ${data.conducted} Logged</span>
          <span style="color:${marginColor}; font-weight:600;">${margin.text}</span>
        </div>
        ${extraRowUI}
      </div>`;
  }

  updateSquidGameTally();
  if (window.lucide) window.lucide.createIcons();
}

function updateSquidGameTally() {
  clearancePercentage = totalConducted === 0 ? 100 : (totalAttended / totalConducted) * 100;
  
  const digitsContainer = document.getElementById('squid-digits');
  if (digitsContainer) {
    const formatted = clearancePercentage.toFixed(1).padStart(4, '0');
    digitsContainer.innerHTML = formatted.split('').map(char => {
      return char === '.' 
        ? `<span class="dot">.</span>` 
        : `<span>${char}</span>`;
    }).join('') + `<span class="percent">%</span>`;

    digitsContainer.style.color = clearancePercentage >= 75 ? 'var(--accent-amber)' : 'var(--accent-red)';
  }

  const rankEl = document.querySelector('.rank-indicator');
  if (rankEl) {
    if (clearancePercentage >= 90) {
      rankEl.textContent = 'S-RANK';
      rankEl.style.color = 'var(--accent-purple)';
    } else if (clearancePercentage >= 80) {
      rankEl.textContent = 'A-RANK';
      rankEl.style.color = 'var(--accent-cyan)';
    } else if (clearancePercentage >= 75) {
      rankEl.textContent = 'B-RANK';
      rankEl.style.color = 'var(--accent-amber)';
    } else {
      rankEl.textContent = 'E-RANK';
      rankEl.style.color = 'var(--accent-red)';
    }
  }
}

let countsRef = null;
let logsRef = null;

function initFirebase() {
  if (!window.firebase || window.firebase.apps.length > 0) return;
  try {
    window.firebase.initializeApp(firebaseConfig);
    const db = window.firebase.database();
    countsRef = db.ref('attendance_counts');
    logsRef = db.ref('daily_logs');

    countsRef.on('value', (snap) => {
      if (snap.exists()) attendanceData = snap.val();
      else countsRef.set(baselineAttendance);
      renderMatrix();
    });

    logsRef.on('value', (snap) => {
      loggedDailyActions = snap.exists() ? snap.val() : {};
      renderSchedule();
    });
  } catch (err) {
    console.warn("Using offline local attendance cache.", err);
    renderMatrix();
    renderSchedule();
  }
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-trigger]');
  const logBtn = e.target.closest('[data-log-class]');
  const surpriseBtn = e.target.closest('[data-surprise-class]');

  if (trigger) {
    const action = trigger.dataset.trigger;

    if (action !== 'audio-toggle' && action !== 'audio-next' && action !== 'audio-prev') {
      triggerHaptic('light');
    }

    if (action === 'open-telemetry') {
      document.getElementById('telemetry-drawer')?.classList.add('active');
      document.body.classList.add('drawer-open'); // Triggers ghosting fix
    }
    if (action === 'close-telemetry') {
      document.getElementById('telemetry-drawer')?.classList.remove('active');
      document.body.classList.remove('drawer-open'); // Reverts ghosting fix
    }
    if (action === 'license-modal') {
      const modal = document.getElementById('hunter-modal');
      document.getElementById('hunter-mana').textContent = totalAttended;
      document.getElementById('hunter-rate').textContent = `${clearancePercentage.toFixed(1)}%`;
      document.getElementById('hunter-buffer').textContent = `${totalSafeBunks} Safe Bunks`;
      modal?.classList.remove('hidden');
    }
    if (action === 'close-license') {
      document.getElementById('hunter-modal')?.classList.add('hidden');
    }
    
    // OPTICAL INFINITY CASTLE TRIGGER
    if (action === 'domain-expansion') {
      playAudioCue(biwaSfx);
      
      const isCastleActive = document.body.classList.toggle('infinity-castle');
      const layer = document.getElementById('cinematic-layer');
      const banner = document.getElementById('domain-hud-banner');
      
      const isDesktop = window.innerWidth >= 1024;
      const activeVideo = isDesktop 
        ? document.getElementById('castle-video-desktop') 
        : document.getElementById('castle-video-mobile');
      const inactiveVideo = isDesktop 
        ? document.getElementById('castle-video-mobile') 
        : document.getElementById('castle-video-desktop');

      if (isCastleActive) {
        layer?.classList.add('active');
        banner?.classList.add('active');

        const targetSrc = isDesktop ? 'Assets/infinity_castle_desktop.mp4' : 'Assets/infinity_castle_mobile.mp4';
        if (activeVideo.getAttribute('src') !== targetSrc) {
          activeVideo.src = targetSrc;
        }
        
        activeVideo.play().catch(err => console.warn("Autoplay note:", err.message));
        if (inactiveVideo) inactiveVideo.pause();
      } else {
        layer?.classList.remove('active');
        banner?.classList.remove('active');
        if (activeVideo) activeVideo.pause();
        if (inactiveVideo) inactiveVideo.pause();
      }
    }
  } 

  if (logBtn && isEditMode) {
    triggerHaptic('success');
    playAudioCue(cashSfx);

    const code = logBtn.dataset.logClass;
    const slotNum = logBtn.dataset.slot;
    const status = logBtn.dataset.status;
    const logKey = `${getTodayDateStr()}_D${activeDayOrder}_S${slotNum}_${code}`;

    historyStack.push({ type: 'slot', code, slotNum, logKey, previousData: JSON.parse(JSON.stringify(attendanceData)) });
    document.getElementById('undoBtn')?.classList.remove('hidden');

    if (!attendanceData[code]) attendanceData[code] = { name: code, attended: 0, conducted: 0 };
    if (status === 'attended') {
      attendanceData[code].attended++;
      attendanceData[code].conducted++;
    } else {
      attendanceData[code].conducted++;
    }

    loggedDailyActions[logKey] = status;
    renderSchedule();
    renderMatrix();

    if (countsRef) countsRef.set(attendanceData);
    if (logsRef) logsRef.child(logKey).set(status);
  }

  if (surpriseBtn && isEditMode) {
    triggerHaptic('success');
    playAudioCue(cashSfx);

    const code = surpriseBtn.dataset.surpriseClass;
    const status = surpriseBtn.dataset.status;

    historyStack.push({ type: 'surprise', code, previousData: JSON.parse(JSON.stringify(attendanceData)) });
    document.getElementById('undoBtn')?.classList.remove('hidden');

    if (status === 'attended') {
      attendanceData[code].attended++;
      attendanceData[code].conducted++;
    } else {
      attendanceData[code].conducted++;
    }

    renderMatrix();
    if (countsRef) countsRef.set(attendanceData);
  }
});

document.getElementById('lockToggleBtn')?.addEventListener('click', () => {
  const btn = document.getElementById('lockToggleBtn');
  if (isEditMode) {
    isEditMode = false;
    btn.innerHTML = '<i data-lucide="lock"></i> <span>View Only</span>';
    btn.classList.remove('unlocked');
    document.getElementById('undoBtn')?.classList.add('hidden');
    renderSchedule();
    renderMatrix();
  } else {
    const pin = prompt("Enter PIN to unlock Edit Mode:");
    if (pin === SECRET_PIN) {
      isEditMode = true;
      btn.innerHTML = '<i data-lucide="unlock"></i> <span>Edit Mode</span>';
      btn.classList.add('unlocked');
      triggerHaptic('success');
      renderSchedule();
      renderMatrix();
    }
  }
  if (window.lucide) window.lucide.createIcons();
});

document.getElementById('undoBtn')?.addEventListener('click', () => {
  if (historyStack.length === 0 || !isEditMode) return;
  triggerHaptic('undo');

  const last = historyStack.pop();
  attendanceData = last.previousData;

  if (last.type === 'slot') {
    delete loggedDailyActions[last.logKey];
    if (logsRef) logsRef.child(last.logKey).remove();
  }

  if (countsRef) countsRef.set(attendanceData);
  renderSchedule();
  renderMatrix();

  if (historyStack.length === 0) {
    document.getElementById('undoBtn')?.classList.add('hidden');
  }
});

document.getElementById('daySelector')?.addEventListener('change', (e) => {
  const val = e.target.value;
  activeDayOrder = val === 'auto' ? getTodayDayOrder() : parseInt(val);
  renderSchedule();
});

setInterval(() => {
  const now = new Date();
  const clockEl = document.getElementById('liveClock');
  if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });

  const currentMins = (now.getHours() * 60) + now.getMinutes();
  const banner = document.getElementById('slotStatusText');
  const timeRemaining = document.getElementById('slotTimeRemaining');

  if (!banner || !timeRemaining) return;

  if (!activeDayOrder || !timetable[activeDayOrder]) {
    banner.textContent = "No classes in session";
    timeRemaining.textContent = "";
    return;
  }

  let activeFound = false;
  for (const [slotNum, slotData] of Object.entries(slots)) {
    if (currentMins >= slotData.start && currentMins < slotData.end) {
      const code = timetable[activeDayOrder][slotNum];
      banner.textContent = `Live: ${attendanceData[code]?.name || "Break"}`;
      timeRemaining.textContent = `${slotData.end - currentMins}m left`;
      activeFound = true;
      break;
    }
  }

  if (!activeFound) {
    banner.textContent = `Campus Day Order ${activeDayOrder}`;
    timeRemaining.textContent = "Outside Hours";
  }
}, 1000);

function bootTelemetry() {
  if (window.lucide) window.lucide.createIcons();
  initFirebase();
  renderSchedule();
  renderMatrix();

  // SEAMLESS LOOP ENGINE (Eliminates the Black Blink)
  ['castle-video-desktop', 'castle-video-mobile'].forEach(id => {
    const vid = document.getElementById(id);
    if (vid) {
      vid.addEventListener('timeupdate', function() {
        // Trigger the wrap exactly 0.25s before hardware EOF to prevent black decodes
        if (this.duration && this.currentTime >= this.duration - 0.25) {
          this.currentTime = 0.05; // Skips frame 0 which can sometimes render black
          this.play().catch(()=>{});
        }
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootTelemetry);
} else {
  bootTelemetry();
}
