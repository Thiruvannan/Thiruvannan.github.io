import { firebaseConfig, SECRET_PIN, subjectIcons, baselineAttendance, slots, timetable, academicPlanner } from './config.js';
import { syncRepoMedia, initMediaEngine } from './media.js';

let myData = JSON.parse(JSON.stringify(baselineAttendance));
let loggedDailyActions = {};
let activeDayOrder = null;
let isEditMode = false;
let historyStack = [];

let globalHunterPerc = 100;
let globalHunterAttended = 0;
let globalHunterBunks = 0;
let lastKnownAttended = 0;

function triggerHaptic(type = 'light') {
  if (!navigator.vibrate) return;
  if (type === 'light') navigator.vibrate(35);
  if (type === 'success') navigator.vibrate([30, 40, 30]);
  if (type === 'undo') navigator.vibrate([60, 50]);
  if (type === 'domain') navigator.vibrate([15, 40, 15]);
}

function getTodayDateStr() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)).toISOString().split('T')[0];
}

function getTodayDayOrder() { return academicPlanner[getTodayDateStr()] || null; }

function calculateMargin(attended, conducted) {
  if (conducted === 0) return { text: "No classes yet", safe: true, bunks: 0 };
  const perc = (attended / conducted) * 100;
  if (perc >= 75) {
    const canBunk = Math.floor((attended - (0.75 * conducted)) / 0.75);
    return { text: canBunk > 0 ? `Can bunk ${canBunk}` : `On the edge (0 bunks)`, safe: true, bunks: canBunk };
  } else {
    const mustAttend = Math.ceil(((0.75 * conducted) - attended) / 0.25);
    return { text: `Deficit: Attend ${mustAttend}`, safe: false, bunks: 0 };
  }
}

setInterval(() => {
  const now = new Date();
  const clockEl = document.getElementById('liveClock');
  if(clockEl) clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
}, 1000);

function initFirebaseApp() {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  const countsRef = db.ref('attendance_counts');
  const logsRef = db.ref('daily_logs');

  countsRef.on('value', (snapshot) => {
    if (snapshot.exists()) myData = snapshot.val();
    else countsRef.set(baselineAttendance);
    renderMatrix();
  });

  logsRef.on('value', (snapshot) => {
    loggedDailyActions = snapshot.exists() ? snapshot.val() : {};
    if (window.innerWidth >= 1024 || document.getElementById('tracker-view').style.display === 'block') renderUI();
  });

  window.logClass = (code, slotNum, status) => {
    if (!isEditMode) return; 
    triggerHaptic('success');

    const cashSfx = document.getElementById('cash-sfx');
    cashSfx.volume = 1.0;
    
    const logKey = `${getTodayDateStr()}_D${activeDayOrder}_S${slotNum}_${code}`;
    historyStack.push({ type: 'slot', code, slotNum, logKey, previousData: JSON.parse(JSON.stringify(myData)) });
    document.getElementById('undoBtn').style.display = 'inline-flex';
    
    if (!myData[code]) myData[code] = { name: code, attended: 0, conducted: 0 };
    if (status === 'attended') {
      myData[code].attended++;
      myData[code].conducted++;
      cashSfx.currentTime = 0;
      cashSfx.play().catch(()=>{}); 
    } else {
      myData[code].conducted++;
    }
    
    loggedDailyActions[logKey] = status;
    renderUI(); renderMatrix(); countsRef.set(myData); logsRef.child(logKey).set(status);
  };

  window.logSurprise = (code, status) => {
    if (!isEditMode || !myData[code]) return; triggerHaptic('success');
    historyStack.push({ type: 'surprise', code, previousData: JSON.parse(JSON.stringify(myData)) });
    document.getElementById('undoBtn').style.display = 'inline-flex';
    status === 'attended' ? (myData[code].attended++, myData[code].conducted++) : myData[code].conducted++;
    renderMatrix(); countsRef.set(myData);
  };

  window.undoLastAction = () => {
    if (historyStack.length === 0 || !isEditMode) return; triggerHaptic('undo');
    const last = historyStack.pop();
    myData = last.previousData;
    if (last.type === 'slot') { delete loggedDailyActions[last.logKey]; logsRef.child(last.logKey).remove(); }
    countsRef.set(myData); renderUI(); renderMatrix();
    if (historyStack.length === 0) document.getElementById('undoBtn').style.display = 'none';
  };
}

function updateSquidGameTallyAndHunterBadge() {
  let totalAttended = 0, totalConducted = 0, totalBunks = 0;
  for (const key in myData) { 
    totalAttended += myData[key].attended; 
    totalConducted += myData[key].conducted; 
    totalBunks += calculateMargin(myData[key].attended, myData[key].conducted).bunks;
  }
  const globalPerc = totalConducted === 0 ? 100 : ((totalAttended / totalConducted) * 100);
  
  globalHunterPerc = globalPerc.toFixed(1);
  globalHunterAttended = totalAttended;
  globalHunterBunks = totalBunks;

  const board = document.getElementById('globalSquidBoard');
  const digitsContainer = document.getElementById('squid-digits');
  
  const percString = globalPerc.toFixed(1).padStart(4, '0');
  digitsContainer.innerHTML = percString.split('').map(ch => `<span class="squid-digit">${ch}</span>`).join('') + `<span class="squid-digit">%</span>`;

  if (globalPerc < 75) board.classList.add('eliminated');
  else board.classList.remove('eliminated');
  
  lastKnownAttended = totalAttended;

  const badge = document.getElementById('hunter-badge');
  badge.className = '';
  if (globalPerc >= 90) badge.classList.add('rank-s');
  else if (globalPerc >= 80) badge.classList.add('rank-a');
  else if (globalPerc >= 75) badge.classList.add('rank-b');
  else badge.classList.add('rank-e');
}

function renderUI() {
  if (activeDayOrder === null) activeDayOrder = getTodayDayOrder();
  const container = document.getElementById("schedule-container"); container.innerHTML = "";
  if (!activeDayOrder) { container.innerHTML = `<div class="class-card"><p style="text-align:center; color:rgba(255,255,255,0.6); font-size: 14px; font-weight:600;">No classes scheduled today.</p></div>`; return; }
  
  const today = getTodayDateStr(), dayClasses = timetable[activeDayOrder];
  for (const [slotNum, code] of Object.entries(dayClasses)) {
    const sub = myData[code] || { name: code }, logKey = `${today}_D${activeDayOrder}_S${slotNum}_${code}`, previousAction = loggedDailyActions[logKey];
    let actionUI = '';
    
    if (previousAction === 'attended') actionUI = `<div class="logged-status" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);"><i data-lucide="check-circle-2"></i> Logged: Attended</div>`;
    else if (previousAction === 'missed') actionUI = `<div class="logged-status" style="background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3);"><i data-lucide="x-circle"></i> Logged: Missed</div>`;
    else if (isEditMode) actionUI = `<div class="btn-row"><button class="btn-log" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);" onclick="logClass('${code}', '${slotNum}', 'attended')"><i data-lucide="check"></i> Attended</button><button class="btn-log" style="background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3);" onclick="logClass('${code}', '${slotNum}', 'missed')"><i data-lucide="x"></i> Missed</button></div>`;
    else actionUI = `<div class="logged-status" style="background: rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.45); border: 1px dashed rgba(255,255,255,0.18);"><i data-lucide="lock"></i> View Only (Unlock to Log)</div>`;
    
    container.innerHTML += `
      <div class="class-card">
        <div class="class-header">
          <div><div class="class-code">${code} • SLOT ${slotNum}</div><div class="class-name">${sub.name}</div></div>
          <div class="class-time">${slots[slotNum].str}</div>
        </div>
        ${actionUI}
      </div>`;
  }
  window.lucide.createIcons();
}

function renderMatrix() {
  const container = document.getElementById("matrix-container"); container.innerHTML = "";
  for (const [code, data] of Object.entries(myData)) {
    const perc = data.conducted === 0 ? 100 : ((data.attended / data.conducted) * 100);
    const margin = calculateMargin(data.attended, data.conducted);
    
    let rankUI = '';
    if (perc >= 90) { rankUI = `<div class="aot-badge" style="color: #38bdf8; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3);"><span class="neon-shape shape-circle">○</span> ${perc.toFixed(1)}%</div>`; }
    else if (perc >= 75) { rankUI = `<div class="aot-badge" style="color: #fbbf24; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3);"><span class="neon-shape shape-triangle">△</span> ${perc.toFixed(1)}%</div>`; }
    else { rankUI = `<div class="aot-badge" style="color: #ef4444; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4);"><span class="neon-shape shape-square">□</span> ${perc.toFixed(1)}%</div>`; }

    const marginUI = margin.safe 
      ? `<span class="matrix-margin" style="color: #38bdf8; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3);">${margin.text}</span>`
      : `<span class="matrix-margin" style="color: #fb7185; background: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.35);">${margin.text}</span>`;

    let extraRowUI = isEditMode ? `<div class="extra-row"><span class="extra-label">Extra / Makeup Slot</span><div class="extra-btns"><button class="btn-extra" onclick="logSurprise('${code}', 'attended')">+ Attend</button><button class="btn-extra" onclick="logSurprise('${code}', 'missed')">+ Miss</button></div></div>` : '';

    container.innerHTML += `
      <div class="matrix-card">
        <div class="matrix-top"><span class="matrix-name">${data.name}</span>${rankUI}</div>
        <div class="matrix-mid">
          <span class="matrix-stats"><span>${data.attended} / ${data.conducted}</span></span>
          ${marginUI}
        </div>
        ${extraRowUI}
      </div>`;
  }
  updateSquidGameTallyAndHunterBadge();
  window.lucide.createIcons();
}

// BIND HTML EVENTS TO WINDOW
window.toggleEditMode = () => {
  const lockBtn = document.getElementById('lockToggleBtn');
  if (isEditMode) {
    isEditMode = false;
    lockBtn.innerHTML = '<i data-lucide="lock" style="width:14px;"></i> View Only';
    lockBtn.classList.remove('unlocked');
    triggerHaptic('light');
    document.getElementById('undoBtn').style.display = 'none';
    renderUI(); renderMatrix();
  } else {
    const pin = prompt("Enter PIN to unlock Edit Mode:");
    if (pin === SECRET_PIN) {
      isEditMode = true;
      lockBtn.innerHTML = '<i data-lucide="unlock" style="width:14px;"></i> Edit Mode';
      lockBtn.classList.add('unlocked');
      triggerHaptic('success');
      renderUI(); renderMatrix();
    }
  }
  window.lucide.createIcons();
};

window.toggleView = (viewId) => {
  if (window.innerWidth >= 1024) return;
  triggerHaptic('light');
  const switchFn = () => {
    document.getElementById('id-view').style.display = viewId === 'id-view' ? 'block' : 'none';
    document.getElementById('tracker-view').style.display = viewId === 'tracker-view' ? 'block' : 'none';
    if (viewId === 'tracker-view') window.forceDayOrder();
  };
  document.startViewTransition ? document.startViewTransition(switchFn) : switchFn();
};

window.forceDayOrder = () => {
  const val = document.getElementById("daySelector").value;
  activeDayOrder = (val === "auto") ? getTodayDayOrder() : parseInt(val);
  renderUI();
};

window.toggleHunterLicense = (show) => {
  const modal = document.getElementById('hunter-modal');
  const title = document.getElementById('hunter-rank-title');
  if (show) {
    triggerHaptic('light');
    document.getElementById('hunter-mana').textContent = globalHunterAttended;
    document.getElementById('hunter-rate').textContent = `${globalHunterPerc}%`;
    document.getElementById('hunter-buffer').textContent = `${globalHunterBunks} Safe Bunks`;

    if (globalHunterPerc >= 90) { title.textContent = "S-RANK MONARCH"; title.style.color = "#a855f7"; }
    else if (globalHunterPerc >= 80) { title.textContent = "A-RANK ELITE"; title.style.color = "#38bdf8"; }
    else if (globalHunterPerc >= 75) { title.textContent = "B-RANK SURVIVOR"; title.style.color = "#fbbf24"; }
    else { title.textContent = "E-RANK (RED GATE)"; title.style.color = "#ef4444"; }
    modal.style.display = 'flex';
  } else {
    triggerHaptic('light');
    modal.style.display = 'none';
  }
};

window.triggerCashSound = () => {
  const cashSfx = document.getElementById('cash-sfx');
  cashSfx.volume = 1.0;
  cashSfx.currentTime = 0;
  cashSfx.play().catch(()=>{});
  triggerHaptic('light');
};

window.triggerInfinityCastle = () => {
  triggerHaptic('domain');
  const isActivating = !document.body.classList.contains('infinity-castle');
  
  const biwaSfx = document.getElementById('biwa-sfx');
  biwaSfx.volume = 1.0;
  biwaSfx.currentTime = 0;
  biwaSfx.play().catch(()=>{});

  const vidDesktop = document.getElementById('castle-video-desktop');
  const vidMobile = document.getElementById('castle-video-mobile');

  if (isActivating) {
    document.body.classList.add('infinity-castle');
    // Explicit trigger logic to bypass iOS Low Power Mode limitations
    if (window.innerWidth >= 1024) {
      vidDesktop.play().catch(()=>{});
    } else {
      vidMobile.play().catch(()=>{});
    }
  } else {
    document.body.classList.remove('infinity-castle');
    vidDesktop.pause();
    vidMobile.pause();
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  console.log("⚡ System Initializing...");
  initFirebaseApp();
  await syncRepoMedia();
  initMediaEngine(triggerHaptic);
  
  if (window.innerWidth >= 1024) window.forceDayOrder();
  
  setInterval(() => {
    const now = new Date(), currentMins = (now.getHours() * 60) + now.getMinutes();
    const banner = document.getElementById('slotStatusText'), timeRemaining = document.getElementById('slotTimeRemaining');
    if (!activeDayOrder || !timetable[activeDayOrder]) { banner.textContent = "No classes in session"; timeRemaining.textContent = ""; return; }
    let activeFound = false;
    for (const [slotNum, slotData] of Object.entries(slots)) {
      if (currentMins >= slotData.start && currentMins < slotData.end) {
        const code = timetable[activeDayOrder][slotNum];
        banner.textContent = `Live: ${myData[code]?.name || "Break"}`;
        timeRemaining.textContent = `${slotData.end - currentMins}m left`;
        activeFound = true; break;
      }
    }
    if (!activeFound) { banner.textContent = "Campus Day Order " + activeDayOrder; timeRemaining.textContent = "Outside Hours"; }
  }, 30000);
});
