// Состояние игры, инвентарь, фоновая музыка с кроссфейдом

// --- НАДЕЖНЫЙ АУДИОПЛЕЕР С БЕЗОПАСНЫМ КРОССФЕЙДОМ ---
let currentBGM = null;
let audioPlayer1 = new Audio();
let audioPlayer2 = new Audio();
let activePlayer = audioPlayer1;
let inactivePlayer = audioPlayer2;
audioPlayer1.loop = true;
audioPlayer2.loop = true;
let audioEnabled = false;
let crossfadeTimer = null;

let isTyping = false;
let skipRequested = false;
let typeInterval = null;
let typingNode = null;   // абзац, который сейчас печатается
let typingLine = '';     // его полный текст
let currentParagraphs = [];
let currentChoicesData = [];
let totalParagraphsInScene = 1;

let lastCheckpoint = 'start';

// Прохождение: глава, шкала симпатии Саши (гл.2), предметы в сумочке (описания — ITEMS в js/items.js)
let currentChapter = 1;
let love = 0;
let inventory = [];
let flags = {};          // отметки прохождения (например, посещённые места на карте): choice.flag / doneFlag

function updateInventoryBadge() {
    document.getElementById('inv-count').innerText = 4 + inventory.length;
}

// Сброс состояния прохождения (вызывается в onEnter первой сцены каждой главы)
function resetSpecialItems() {
    love = 0;
    inventory = [];
    flags = {};
    renderInventory();
    updateLoveMeter();
    setChapter(1);
}

function setChapter(n) {
    currentChapter = n;
    document.getElementById('love-meter').style.display = n === 2 ? 'flex' : 'none';
}

function updateLoveMeter() {
    document.getElementById('love-value').innerText = love;
}

function changeLove(delta) {
    love += delta;
    updateLoveMeter();
    recordLove(love);
    if (delta > 0) showToast('Саша это запомнит', '💗+' + delta);
    else showToast('Саша это запомнит', '💔' + delta);
}

// id или массив id — тогда нужны все
function hasItem(id) {
    return Array.isArray(id) ? id.every(x => inventory.includes(x)) : inventory.includes(id);
}

// toast: свой текст уведомления; false — без уведомления
function giveItem(id, toast) {
    if (hasItem(id)) return;
    inventory.push(id);
    renderInventory();
    if (toast === false) return;
    playUISound('item');
    showToast(toast || 'В сумочке: ' + ITEMS[id].name, ITEMS[id].icon);
}

function takeItem(id) {
    inventory = inventory.filter(x => x !== id);
    renderInventory();
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    list.querySelectorAll('.game-item').forEach(li => li.remove());
    inventory.forEach(id => {
        const item = ITEMS[id];
        const li = document.createElement('li');
        li.className = 'game-item';
        li.innerHTML = `${item.icon} <b>${item.name}</b> <br><small>${item.desc}</small>`;
        list.appendChild(li);
    });
    updateInventoryBadge();
}

function toggleAudio(forceEnable = false) {
    const btn = document.getElementById('audio-btn');
    const icon = document.getElementById('audio-icon');
    const text = document.getElementById('audio-text');

    if (audioEnabled && !forceEnable) {
        if (crossfadeTimer) clearInterval(crossfadeTimer);
        activePlayer.pause();
        inactivePlayer.pause();
        audioEnabled = false;
        icon.innerText = "🔇";
        text.innerText = "ВЫКЛ";
        btn.classList.add('muted');
    } else {
        audioEnabled = true;
        if (activePlayer.src && activePlayer.src !== window.location.href) {
            try { activePlayer.volume = 1; } catch(e) {}
            activePlayer.play().catch(e => {});
        }
        icon.innerText = "🔊";
        text.innerText = "ЗВУК";
        btn.classList.remove('muted');
        playUISound('click');
    }
}

// fallbackPath играет, если trackPath не найден (например, новый трек ещё не залит)
function playBGM(trackPath, fallbackPath) {
    if (crossfadeTimer) {
        clearInterval(crossfadeTimer);
        crossfadeTimer = null;
    }

    if (!trackPath) {
        activePlayer.pause();
        inactivePlayer.pause();
        currentBGM = null;
        return;
    }

    if (currentBGM === trackPath) {
        if (audioEnabled && activePlayer.paused) {
            activePlayer.play().catch(e => {});
        }
        return;
    }

    currentBGM = trackPath;

    const onMissing = () => {
        if (fallbackPath && currentBGM === trackPath) playBGM(fallbackPath);
    };

    if (!audioEnabled) {
        activePlayer.onerror = onMissing;
        activePlayer.src = trackPath;
        return;
    }

    // Мгновенно меняем местами ссылки на плееры, чтобы исключить гонку при быстрых кликах
    let oldPlayer = activePlayer;
    activePlayer = inactivePlayer;
    inactivePlayer = oldPlayer;

    inactivePlayer.onerror = null;
    activePlayer.onerror = onMissing;
    activePlayer.src = trackPath;
    let volumeSupported = true;
    try {
        activePlayer.volume = 0;
    } catch (e) {
        volumeSupported = false;
    }

    activePlayer.play().catch(e => {});

    if (!volumeSupported) {
        inactivePlayer.pause();
        return;
    }

    let step = 0;
    crossfadeTimer = setInterval(() => {
        step++;
        let progress = Math.min(1, step / 12);
        try {
            activePlayer.volume = progress;
            inactivePlayer.volume = Math.max(0, 1 - progress);
        } catch (e) {
            inactivePlayer.pause();
            clearInterval(crossfadeTimer);
            crossfadeTimer = null;
            return;
        }
        if (progress >= 1) {
            inactivePlayer.pause();
            clearInterval(crossfadeTimer);
            crossfadeTimer = null;
        }
    }, 45);
}

// Все сцены игры. Файлы js/scenes/*.js добавляют свои через addScenes(номер главы, { id: сцена, ... })
const scenes = {};

function addScenes(chapter, batch) {
    Object.entries(batch).forEach(([id, scene]) => {
        scene.chapter = chapter;
        scenes[id] = scene;
    });
}
