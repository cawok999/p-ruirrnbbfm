// Ачивки, просмотренные сцены и картинки, рекорды мини-игр — общие для всех прохождений (localStorage)

const META_KEY = 'angela-quest-meta-v1';
let meta = null;

function getMeta() {
    if (!meta) {
        const saved = storageGet(META_KEY) || {};
        meta = {
            seen: Array.isArray(saved.seen) ? saved.seen : [],
            images: Array.isArray(saved.images) ? saved.images : [],
            ach: Array.isArray(saved.ach) ? saved.ach : [],
            rhythmBest: saved.rhythmBest || 0,
            quizPerfect: !!saved.quizPerfect,
            loveBest: saved.loveBest || 0
        };
    }
    return meta;
}

function saveMeta() {
    storageSet(META_KEY, getMeta());
}

function hasSeen(sceneId) {
    return getMeta().seen.includes(sceneId);
}

function recordSceneSeen(sceneId) {
    const m = getMeta();
    if (!m.seen.includes(sceneId)) {
        m.seen.push(sceneId);
        saveMeta();
    }
}

function recordImageSeen(src) {
    const m = getMeta();
    if (src && !m.images.includes(src)) {
        m.images.push(src);
        saveMeta();
    }
}

function recordLove(value) {
    const m = getMeta();
    if (value > m.loveBest) {
        m.loveBest = value;
        saveMeta();
        checkAchievements();
    }
}

function recordRhythm(accuracy) {
    const m = getMeta();
    m.rhythmBest = Math.max(m.rhythmBest, accuracy);
    saveMeta();
    checkAchievements();
}

function recordQuiz(score, total) {
    const m = getMeta();
    if (score === total) m.quizPerfect = true;
    saveMeta();
    checkAchievements();
}

// --- Наборы сцен для проверок ---
const isDeathScene = id => !!scenes[id].death;
const chapterOf = id => scenes[id].chapter;

// Сцены, куда ведут только секретные выборы
function secretScenes() {
    const secret = new Set(), normal = new Set();
    Object.values(scenes).forEach(s => (s.choices || []).forEach(c => {
        if (typeof c.next !== 'string') return;
        (c.class === 'secret-btn' ? secret : normal).add(c.next);
    }));
    return [...secret].filter(id => !normal.has(id));
}

const allSeen = filter => Object.keys(scenes).filter(filter).every(hasSeen);
const allEndingsFound = chapter => allEndings()
    .filter(id => scenes[id].chapter === chapter)
    .every(id => foundEndings().includes(id));

const ACHIEVEMENTS = [
    { id: 'first_death', icon: '💀', title: 'Первая кровь', desc: 'Умереть в первый раз',
      check: () => getMeta().seen.some(id => scenes[id] && isDeathScene(id)) },
    { id: 'deaths_1', icon: '⚰️', title: 'Бессмертная (почти)', desc: 'Найти все смерти Главы 1',
      check: () => allSeen(id => chapterOf(id) === 1 && isDeathScene(id)) },
    { id: 'deaths_2', icon: '🪦', title: 'Профессиональная неудачница', desc: 'Найти все смерти Главы 2',
      check: () => allSeen(id => chapterOf(id) === 2 && isDeathScene(id)) },
    { id: 'endings_1', icon: '🏆', title: 'Глава 1: 100%', desc: 'Открыть все концовки Главы 1',
      check: () => allEndingsFound(1) },
    { id: 'endings_2', icon: '👑', title: 'Глава 2: 100%', desc: 'Открыть все концовки Главы 2',
      check: () => allEndingsFound(2) },
    { id: 'secrets', icon: '🔮', title: 'Охотница за секретами', desc: 'Пройти все секретные выборы',
      check: () => secretScenes().every(hasSeen) },
    { id: 'rock_star', icon: '🎸', title: 'Рок-звезда Пангод', desc: 'Сыграть соло с точностью 90% и выше',
      check: () => getMeta().rhythmBest >= 90 },
    { id: 'sasha_expert', icon: '🧠', title: 'Знаток Саши', desc: 'Пройти тест про Сашу без единой ошибки',
      check: () => getMeta().quizPerfect },
    { id: 'explorer', icon: '🗺️', title: 'Картограф Пангод', desc: 'Побывать во всех местах на карте',
      check: () => allSeen(id => scenes[id].mapPlace) },
    { id: 'zhorik', icon: '🐶', title: 'Друг Жорика', desc: 'Навестить Жорика в гараже',
      check: () => hasSeen('ch2_map_garage') },
    { id: 'max_love', icon: '💗', title: 'Любовь на максимум', desc: 'Набрать 10 симпатии Саши',
      check: () => getMeta().loveBest >= 10 },
    { id: 'pink', icon: '🩷', title: 'Розовая банда', desc: 'Покраситься в розовый всей компанией',
      check: () => hasSeen('ch2_pink_gang') }
];

function checkAchievements() {
    const m = getMeta();
    ACHIEVEMENTS.forEach(a => {
        if (!m.ach.includes(a.id) && a.check()) {
            m.ach.push(a.id);
            saveMeta();
            playUISound('item');
            showToast('Ачивка: ' + a.title, a.icon);
        }
    });
}
