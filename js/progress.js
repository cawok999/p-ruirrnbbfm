// Прогресс: сохранение чекпоинта и предметов, коллекция найденных концовок (localStorage)

const SAVE_KEY = 'angela-quest-save-v1';
const ENDINGS_KEY = 'angela-quest-endings-v1';

// localStorage может быть недоступен (приватный режим) — тогда игра просто работает без сохранений
function storageGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}
function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

// --- СОХРАНЕНИЕ ---
// Состояние на последнем чекпоинте — к нему откатываемся после смерти
let checkpointState = null;

function saveProgress(sceneId) {
    checkpointState = {
        checkpoint: sceneId, chapter: currentChapter, love: love,
        items: [...inventory], flags: { ...flags }
    };
    storageSet(SAVE_KEY, checkpointState);
}

function restoreCheckpointState() {
    if (checkpointState && checkpointState.checkpoint === lastCheckpoint) restoreItems(checkpointState);
}

function loadProgress() {
    const save = storageGet(SAVE_KEY);
    return (save && scenes[save.checkpoint] && save.checkpoint !== 'start') ? save : null;
}

function restoreItems(save) {
    setChapter(save.chapter || 1);
    love = save.love || 0;
    inventory = Array.isArray(save.items) ? save.items.filter(id => ITEMS[id]) : [];
    // Сохранения до 2026-10-29: предметы гл.1 лежали отдельными флагами
    ['keychain', 'cola', 'drawing'].forEach(id => { if (save[id] && !inventory.includes(id)) inventory.push(id); });
    flags = { ...(save.flags || {}) };
    checkpointState = save;
    updateLoveMeter();
    renderInventory();
}

// --- КОНЦОВКИ ---
let foundEndingsCache = null;

function allEndings() {
    const key = id => scenes[id].chapter * 100 + scenes[id].ending.order;
    return Object.keys(scenes)
        .filter(id => scenes[id].ending)
        .sort((a, b) => key(a) - key(b));
}

function endingKind(sceneId) {
    const { chapter, ending } = scenes[sceneId];
    if (chapter === 1) {
        return ending.secret ? 'Секретная концовка' : 'Истинная концовка ' + ending.order;
    }
    return 'Глава ' + chapter + ' · ' + (ending.secret ? 'Секретная концовка' : 'Концовка');
}

function foundEndings() {
    if (!foundEndingsCache) {
        const saved = storageGet(ENDINGS_KEY);
        foundEndingsCache = Array.isArray(saved) ? saved.filter(id => scenes[id] && scenes[id].ending) : [];
    }
    return foundEndingsCache;
}

function markEnding(sceneId) {
    const found = foundEndings();
    if (found.includes(sceneId)) return;
    found.push(sceneId);
    storageSet(ENDINGS_KEY, found);
    updateEndingsBadge();
    showToast(`Новая концовка! Открыто ${found.length} из ${allEndings().length}`, '🏆');
}

function updateEndingsBadge() {
    const text = foundEndings().length + '/' + allEndings().length;
    document.querySelectorAll('.endings-count').forEach(el => { el.innerText = text; });
}

function renderEndingsList(list) {
    const found = foundEndings();
    list.innerHTML = '';
    allEndings().forEach(id => {
        const ending = scenes[id].ending;
        const kind = endingKind(id);
        const li = document.createElement('li');
        if (found.includes(id)) {
            li.innerHTML = `${ending.secret ? '🔮' : '🏆'} <b>${ending.title}</b> <br><small>${kind}</small>`;
        } else {
            li.className = 'ending-locked';
            li.innerHTML = `🔒 <b>???</b> <br><small>${kind} — ещё не найдена</small>`;
        }
        list.appendChild(li);
    });
}

// --- СТАРТОВЫЙ ЭКРАН ---
function initStartScreen() {
    updateEndingsBadge();
    const save = loadProgress();
    if (save) {
        document.getElementById('continue-btn').style.display = 'inline-block';
        document.getElementById('continue-loc').innerText = scenes[save.checkpoint].loc;
        document.getElementById('start-btn').innerText = '↺ Глава 1 заново';
    }
}
