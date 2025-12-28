// Config
const CONFIG = {
    workTime: 25 * 60,
    breakTime: 5 * 60,
    autoStartBreak: false,
    autoStartFocus: false
};

// State
let state = {
    timeLeft: CONFIG.workTime,
    endTime: null, // New: Target timestamp (ms)
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
const inputAutoFocus = document.getElementById('setting-auto-focus'); // New
const errorWork = document.getElementById('error-work');
const errorBreak = document.getElementById('error-break');

// Confirm Modal DOM
const confirmModal = document.getElementById('confirm-modal');
const confirmPanel = document.getElementById('confirm-panel');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');

let pendingConfirmAction = null;

// Audio (Beep + Notification)
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

        // System Notification
        if (Notification.permission === 'granted') {
            const title = state.isWorking ? "休息時間結束" : "專注時間結束";
            const body = state.isWorking ? "休息時間結束，該回到工作囉！" : "專注時間已結束，準備休息一下吧！";

            new Notification(title, {
                body: body,
                icon: 'icon/icon-512x512.png',
                requireInteraction: true
            });
        }
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
    if (timeString.length >= 7) {
        timerDisplay.style.fontSize = '3.5rem';
    } else if (timeString.length >= 6) {
        timerDisplay.style.fontSize = '4.5rem';
    } else {
        timerDisplay.style.fontSize = '';
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
        toggleBtn.classList.replace('text-black', 'text-white'); // Text contrast
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
    const today = new Date().toDateString();
    const saved = JSON.parse(localStorage.getItem('pomodoroProHistory') || '{}');

    if (saved.date !== today) {
        historyData = [];
        saveHistory();
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
        historyData.splice(index, 1);
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

    for (let i = historyData.length - 1; i >= 0; i--) {
        const h = historyData[i];
        const item = document.createElement('div');
        item.className = "flex-shrink-0 bg-gray-700/50 backdrop-blur px-3 py-2 rounded-lg border border-gray-600 flex flex-col items-start min-w-[100px] animate-fade-in relative group cursor-pointer hover:bg-gray-700 transition";
        item.title = "點擊刪除";

        item.innerHTML = `
            <span class="text-xs text-gray-400 font-mono">${h.timeStr}</span>
            <span class="text-sm font-bold text-gray-200 truncate w-full max-w-[120px]">${h.task}</span>
        `;
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
            stopTimer();
        }
    } else {
        // Break finished -> Work
        state.isWorking = true;
        state.timeLeft = CONFIG.workTime;
        playBeep('finish');

        if (CONFIG.autoStartFocus) {
            startTimer();
        } else {
            stopTimer();
        }
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

// Worker
let timerWorker = null;
try {
    timerWorker = new Worker('timer-worker.js');
} catch (e) {
    console.error("Worker init failed:", e);
}

// --- iOS Keep-Alive & Lock Screen Logic ---
// We use a dedicated AudioContext to generate an INFINITE stream of silence.
// This forces iOS to treat the app as a "Now Playing" audio source, preventing suspension
// on both Home Screen and Lock Screen, and enabling the Lock Screen Widget.
let keepAliveCtx = null;
let keepAliveSource = null;
let keepAliveAudio = new Audio();
keepAliveAudio.autoplay = true;
// Loop is not needed for stream, but good safety
keepAliveAudio.loop = true;

function initKeepAlive() {
    if (!keepAliveCtx) {
        keepAliveCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (keepAliveCtx.state === 'suspended') {
        keepAliveCtx.resume();
    }

    // Create a 0Hz Oscillator (Silence)
    if (!keepAliveSource) {
        const oscillator = keepAliveCtx.createOscillator();
        const dst = keepAliveCtx.createMediaStreamDestination();
        const gain = keepAliveCtx.createGain();

        // Ensure silence
        gain.gain.value = 0.001; // Not 0, to avoid "optimization" removing it? actually 0 is fine usually but 0.001 is safer
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(0, keepAliveCtx.currentTime);

        oscillator.connect(gain);
        gain.connect(dst);

        oscillator.start();
        keepAliveSource = oscillator;

        // Feed the stream into the Audio Element
        keepAliveAudio.srcObject = dst.stream;
        keepAliveAudio.play().catch(e => console.error("Keep-Alive Play Failed:", e));
    } else {
        keepAliveAudio.play().catch(e => console.error("Keep-Alive Resume Failed:", e));
    }
}

function stopKeepAlive() {
    keepAliveAudio.pause();
    // We don't destroy the context/oscillator, just pause the element and maybe suspend context
    // This allows quick resume without user interaction restrictions (since we already initialized)
}


// Wake Lock
let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log(`Wake Lock Error: ${err.name}, ${err.message}`);
    }
}

async function releaseWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
    }
}

// Media Session Helper
function updateMediaSession() {
    if ('mediaSession' in navigator) {
        const minutes = Math.floor(state.timeLeft / 60);
        const seconds = state.timeLeft % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Get Task Name or Default
        const currentTask = taskInput.value.trim() || (state.isWorking ? "專注事項" : "休息時間");
        const statusLabel = state.isWorking ? "🔥 專注中" : "☕ 休息中";

        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTask, // Primary Text: Task Name
            artist: `${statusLabel} - ${timeStr}`, // Secondary Text: Status + Time
            album: "AkiPomodoro",
            artwork: [
                { src: 'icon/icon-512x512.png', sizes: '512x512', type: 'image/png' }
            ]
        });

        navigator.mediaSession.playbackState = state.isRunning ? "playing" : "paused";

        // Setup Media Controls (Play/Pause/Next)
        navigator.mediaSession.setActionHandler('play', startTimer);
        navigator.mediaSession.setActionHandler('pause', stopTimer);
        navigator.mediaSession.setActionHandler('nexttrack', skipTimer);
    }
}


if (timerWorker) {
    timerWorker.onmessage = function (e) {
        if (e.data.type === 'TICK') {
            state.timeLeft = e.data.timeLeft;
            updateDisplay();
            // Update Media Session EVERY second for Lock Screen preview
            updateMediaSession();
        } else if (e.data.type === 'FINISH') {
            state.timeLeft = 0;
            updateDisplay();
            state.isRunning = false;
            switchMode();
        }
    };
} else {
    // Fallback if Worker fails.
    // Given the Oscillator Keep-Alive, main thread setInterval MIGHT actually work on iOS now, 
    // but Worker is still safer.
}

function startTimer() {
    if (state.isRunning) return;

    // Request notification permission
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Init iOS Keep-Alive (Must be direct result of user interaction)
    initKeepAlive();

    // Request Wake Lock
    requestWakeLock();

    state.isRunning = true;
    state.endTime = Date.now() + state.timeLeft * 1000;

    toggleText.textContent = "暫停";
    playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';

    // Play Start Beep
    playBeep('normal');

    // Update Media Session Immediately
    updateMediaSession();

    // Send to Worker
    if (timerWorker) {
        timerWorker.postMessage({ command: 'START', endTime: state.endTime });
    }
}

function stopTimer() {
    state.isRunning = false;
    if (timerWorker) {
        timerWorker.postMessage({ command: 'STOP' });
    }
    state.endTime = null;

    // Stop Audio & Release Lock
    stopKeepAlive();
    releaseWakeLock();

    toggleText.textContent = "開始";
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

    updateMediaSession(); // Update to "paused"
}
// Note: clearInterval logic is gone, handled by Worker now


function resetTimer() {
    stopTimer();
    state.timeLeft = state.isWorking ? CONFIG.workTime : CONFIG.breakTime;
    updateDisplay();
    updateMediaSession();
}

function skipTimer() {
    stopTimer();
    switchMode();
}

// Modal Logic
function openSettings() {
    settingsModal.classList.remove('hidden');
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

// Validation Helper
function validateInput(input, errorMsg) {
    let val = parseInt(input.value);

    // Clamp
    if (isNaN(val) || input.value.trim() === '') val = (input === inputWork ? 25 : 5);
    if (val < 1) val = 1;
    if (val > 1440) val = 1440;

    const raw = parseInt(input.value);
    if (input.value !== '' && (raw < 1 || raw > 1440)) {
        errorMsg.classList.remove('hidden');
    } else {
        errorMsg.classList.add('hidden');
    }

    input.value = val;
    return val;
}

function setupValidation(input, errorMsg) {
    input.addEventListener('blur', () => validateInput(input, errorMsg));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            validateInput(input, errorMsg);
            input.blur();
        }
    });
    input.addEventListener('input', () => errorMsg.classList.add('hidden'));
}
setupValidation(inputWork, errorWork);
setupValidation(inputBreak, errorBreak);

function saveSettings() {
    const w = validateInput(inputWork, errorWork);
    const b = validateInput(inputBreak, errorBreak);

    const oldWork = CONFIG.workTime;
    const oldBreak = CONFIG.breakTime;

    CONFIG.workTime = w * 60;
    CONFIG.breakTime = b * 60;
    CONFIG.autoStartBreak = inputAuto.checked;
    CONFIG.autoStartFocus = inputAutoFocus.checked;

    // Smart Reset Logic
    if (state.isWorking) {
        if (CONFIG.workTime !== oldWork) {
            stopTimer();
            state.timeLeft = CONFIG.workTime;
            updateDisplay();
        }
    } else {
        if (CONFIG.breakTime !== oldBreak) {
            stopTimer();
            state.timeLeft = CONFIG.breakTime;
            updateDisplay();
        }
    }

    closeSettings();
}

// Init
updateDisplay();；
loadHistory();

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