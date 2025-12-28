// Config
const CONFIG = {
    workTime: 25 * 60,
    breakTime: 5 * 60,
    autoStartBreak: false
};

// State
let state = {
    timeLeft: CONFIG.workTime,
    isWorking: true,
    isRunning: false,
    timerId: null,
    totalSessions: 0
};

// History State
let historyData = [];

// DOM Elements
const timerDisplay = document.getElementById('timer-display');
const progressRing = document.getElementById('progress-ring');
const toggleBtn = document.getElementById('toggle-btn');
const toggleText = document.getElementById('toggle-text');
const playIcon = document.getElementById('play-icon');
const resetBtn = document.getElementById('reset-btn');
const skipBtn = document.getElementById('skip-btn');
const statusDot = document.getElementById('status-dot');
const modeText = document.getElementById('mode-text');
const bgGlow = document.getElementById('bg-glow');
const cycleCount = document.getElementById('cycle-count');
const historyList = document.getElementById('history-list');
const taskInput = document.getElementById('task-input');
const clearHistoryBtn = document.getElementById('clear-history');

// Settings DOM
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const inputWork = document.getElementById('setting-work');
const inputBreak = document.getElementById('setting-break');
const inputAuto = document.getElementById('setting-auto');

// Confirm Modal DOM
const confirmModal = document.getElementById('confirm-modal');
const confirmPanel = document.getElementById('confirm-panel');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');

let pendingConfirmAction = null;

// Audio (Simple Beep)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(type = 'normal') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'finish') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } else {
        oscillator.type = 'triangle'; // click sound
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    }
}

// Logic
const circumference = progressRing.r.baseVal.value * 2 * Math.PI;
progressRing.style.strokeDasharray = `${circumference} ${circumference}`;

function updateDisplay() {
    const minutes = Math.floor(state.timeLeft / 60);
    const seconds = state.timeLeft % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    timerDisplay.textContent = timeString;
    document.title = `(${timeString}) ${state.isWorking ? '專注' : '休息'}`;

    // Dynamic Font Scaling
    if (timeString.length >= 7) { // 1000:00+
        timerDisplay.style.fontSize = '3.5rem';
    } else if (timeString.length >= 6) { // 100:00+
        timerDisplay.style.fontSize = '4.5rem';
    } else {
        timerDisplay.style.fontSize = ''; // Default (text-7xl is 4.5rem, but let's stick to default style)
    }

    // Ring Progress
    const totalTime = state.isWorking ? CONFIG.workTime : CONFIG.breakTime;
    const offset = circumference - (state.timeLeft / totalTime) * circumference;
    progressRing.style.strokeDashoffset = offset;
}

function updateTheme() {
    if (state.isWorking) {
        // Yellow Theme
        statusDot.classList.replace('bg-blue-500', 'bg-yellow-500');
        statusDot.classList.replace('shadow-[0_0_10px_rgba(59,130,246,0.5)]', 'shadow-[0_0_10px_rgba(234,179,8,0.5)]');
        progressRing.style.stroke = '#EAB308'; // Yellow-500
        bgGlow.classList.replace('bg-blue-500/10', 'bg-yellow-500/10');
        toggleBtn.classList.replace('bg-blue-600', 'bg-yellow-500'); // Button bg
        toggleBtn.classList.replace('hover:bg-blue-500', 'hover:bg-yellow-400');
        toggleBtn.classList.replace('shadow-blue-600/20', 'shadow-yellow-500/20');
        toggleBtn.classList.replace('text-white', 'text-black'); // Text contrast
        modeText.textContent = "專注模式";
    } else {
        // Blue Theme
        statusDot.classList.replace('bg-yellow-500', 'bg-blue-500');
        statusDot.classList.replace('shadow-[0_0_10px_rgba(234,179,8,0.5)]', 'shadow-[0_0_10px_rgba(59,130,246,0.5)]');
        progressRing.style.stroke = '#3B82F6'; // Blue-500
        bgGlow.classList.replace('bg-yellow-500/10', 'bg-blue-500/10');
        toggleBtn.classList.replace('bg-yellow-500', 'bg-blue-600');
        toggleBtn.classList.replace('hover:bg-yellow-400', 'hover:bg-blue-500');
        toggleBtn.classList.replace('shadow-yellow-500/20', 'shadow-blue-600/20');
        toggleBtn.classList.replace('text-black', 'text-white');
        modeText.textContent = "休息時間";
    }
}

// History Storage Logic
function loadHistory() {
    const today = new Date().toDateString(); // e.g., "Sun Dec 28 2025"
    const saved = JSON.parse(localStorage.getItem('pomodoroProHistory') || '{}');

    // Check if new day (if last saved date !== today, reset)
    if (saved.date !== today) {
        historyData = [];
        saveHistory(); // Clear it
    } else {
        historyData = saved.sessions || [];
    }

    state.totalSessions = historyData.length;
    cycleCount.textContent = `#${state.totalSessions + 1}`;
    renderHistory();
}

function saveHistory() {
    const today = new Date().toDateString();
    localStorage.setItem('pomodoroProHistory', JSON.stringify({
        date: today,
        sessions: historyData
    }));
}

// --- Custom Confirmation Modal Logic ---
function showConfirm(title, message, callback) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    pendingConfirmAction = callback;

    confirmModal.classList.remove('hidden');
    setTimeout(() => {
        confirmModal.classList.remove('opacity-0');
        confirmPanel.classList.remove('scale-95');
    }, 10);
}

function hideConfirm() {
    confirmModal.classList.add('opacity-0');
    confirmPanel.classList.add('scale-95');
    setTimeout(() => {
        confirmModal.classList.add('hidden');
    }, 300);
}

confirmOkBtn.onclick = () => {
    if (pendingConfirmAction) pendingConfirmAction();
    hideConfirm();
};
confirmCancelBtn.onclick = hideConfirm;


function clearHistory() {
    showConfirm("清除所有紀錄", "確定要刪除今日所有番茄鐘紀錄嗎？", () => {
        historyData = [];
        saveHistory();
        state.totalSessions = 0;
        cycleCount.textContent = `#1`;
        renderHistory();
    });
}

function deleteHistoryItem(index) {
    showConfirm("刪除紀錄", "確定要刪除這筆番茄鐘紀錄嗎？", () => {
        historyData.splice(index, 1); // Remove item
        saveHistory();
        state.totalSessions = historyData.length;
        cycleCount.textContent = `#${state.totalSessions + 1}`;
        renderHistory();
    });
}
// ---------------------------------------

function renderHistory() {
    historyList.innerHTML = '';

    if (historyData.length === 0) {
        historyList.innerHTML = '<div class="text-gray-600 text-sm italic py-2 w-full text-center">尚未完成任何番茄鐘</div>';
        return;
    }

    // Reverse loop to show newest first
    for (let i = historyData.length - 1; i >= 0; i--) {
        const h = historyData[i];
        const item = document.createElement('div');
        item.className = "flex-shrink-0 bg-gray-700/50 backdrop-blur px-3 py-2 rounded-lg border border-gray-600 flex flex-col items-start min-w-[100px] animate-fade-in relative group cursor-pointer hover:bg-gray-700 transition";
        item.title = "點擊刪除";

        item.innerHTML = `
            <span class="text-xs text-gray-400 font-mono">${h.timeStr}</span>
            <span class="text-sm font-bold text-gray-200 truncate w-full max-w-[120px]">${h.task}</span>
        `;

        // Click to delete
        item.onclick = () => deleteHistoryItem(i);

        historyList.appendChild(item);
    }
}

function addToHistory() {
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const taskName = taskInput.value || '專注';

    historyData.push({ timeStr, task: taskName });
    saveHistory();

    state.totalSessions = historyData.length;
    cycleCount.textContent = `#${state.totalSessions + 1}`;
    renderHistory();
}


function switchMode() {
    if (state.isWorking) {
        // Work finished -> Break
        addToHistory();
        state.isWorking = false;
        state.timeLeft = CONFIG.breakTime;
        playBeep('finish');

        if (CONFIG.autoStartBreak) {
            startTimer();
        } else {
            stopTimer(); // Wait for user
        }
    } else {
        // Break finished -> Work
        state.isWorking = true;
        state.timeLeft = CONFIG.workTime;
        playBeep('finish');
        stopTimer(); // Always pause before Work starts
    }
    updateTheme();
    updateDisplay();
}

function toggleTimer() {
    if (state.isRunning) {
        stopTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (state.isRunning) return;
    state.isRunning = true;

    toggleText.textContent = "暫停";
    playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>'; // Pause Icon
    playBeep('normal');

    state.timerId = setInterval(() => {
        state.timeLeft--;
        updateDisplay();

        if (state.timeLeft < 0) {
            clearInterval(state.timerId);
            switchMode();
        }
    }, 1000);
}

function stopTimer() {
    state.isRunning = false;
    clearInterval(state.timerId);
    toggleText.textContent = "開始";
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>'; // Play Icon
}

function resetTimer() {
    stopTimer();
    state.timeLeft = state.isWorking ? CONFIG.workTime : CONFIG.breakTime;
    updateDisplay();
}

function skipTimer() {
    stopTimer();
    // Simulate finish
    switchMode();
}

// Modal Logic
function openSettings() {
    settingsModal.classList.remove('hidden');
    // small delay for transition
    setTimeout(() => {
        settingsModal.classList.remove('opacity-0');
        settingsPanel.classList.remove('scale-95');
    }, 10);
}

function closeSettings() {
    settingsModal.classList.add('opacity-0');
    settingsPanel.classList.add('scale-95');
    setTimeout(() => {
        settingsModal.classList.add('hidden');
    }, 300);
}

function saveSettings() {
    // Get raw values
    let wRaw = inputWork.value;
    let bRaw = inputBreak.value;

    let w = parseInt(wRaw);
    let b = parseInt(bRaw);

    // Strict Validation for Work
    if (wRaw === '' || isNaN(w)) {
        alert("專注時間只能輸入 1 到 1440 的數字！");
        w = 25; // Default
    } else if (w < 1) {
        alert("專注時間只能輸入 1 到 1440 的數字！");
        w = 25; // Default for < 1
    } else if (w > 1440) {
        alert("專注時間只能輸入 1 到 1440 的數字！");
        w = 1440; // Max
    }

    // Strict Validation for Break
    if (bRaw === '' || isNaN(b)) {
        alert("休息時間只能輸入 1 到 1440 的數字！");
        b = 5; // Default
    } else if (b < 1) {
        alert("休息時間只能輸入 1 到 1440 的數字！");
        b = 5; // Default for < 1
    } else if (b > 1440) {
        alert("休息時間只能輸入 1 到 1440 的數字！");
        b = 1440; // Max
    }

    // Update inputs
    inputWork.value = w;
    inputBreak.value = b;

    CONFIG.workTime = w * 60;
    CONFIG.breakTime = b * 60;
    CONFIG.autoStartBreak = inputAuto.checked;

    // Apply changes if timer not running or reset
    if (!state.isRunning) {
        resetTimer();
    }
    closeSettings();
}

// Init
updateDisplay();
loadHistory(); // Load on start

// Listeners
toggleBtn.addEventListener('click', toggleTimer);
resetBtn.addEventListener('click', resetTimer);
skipBtn.addEventListener('click', skipTimer);
clearHistoryBtn.addEventListener('click', clearHistory);

settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', saveSettings);
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
});
