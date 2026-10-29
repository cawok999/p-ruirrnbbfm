// Мини-игры: гитарное соло (ритм, три струны) и тест «Насколько ты знаешь Сашу»
// Сцена запускает игру полем minigame: { type: 'rhythm' | 'quiz', title, win, lose, ... }

function startMinigame(cfg) {
    const overlay = document.getElementById('minigame-overlay');
    overlay.style.display = 'flex';
    if (cfg.type === 'rhythm') startRhythm(cfg, overlay);
    else startQuiz(cfg, overlay);
}

function finishMinigame(cfg, won) {
    const overlay = document.getElementById('minigame-overlay');
    overlay.style.display = 'none';
    overlay.innerHTML = '';
    if (won && cfg.winLove) changeLove(cfg.winLove);
    renderScene(won ? cfg.win : cfg.lose);
}

function showMinigameResult(overlay, cfg, won, title, text) {
    overlay.querySelector('.mg-box').innerHTML = `
        <div class="mg-result">
            <div class="mg-result-icon">${won ? '🤘' : '😵'}</div>
            <h2>${title}</h2>
            <p>${text}</p>
            <button class="mg-btn" id="mg-continue">Дальше →</button>
        </div>`;
    playUISound(won ? 'item' : 'danger');
    document.getElementById('mg-continue').onclick = () => finishMinigame(cfg, won);
}

// --- ГИТАРНОЕ СОЛО ---
const RHYTHM_LANES = ['Ми', 'Си', 'Соль'];
const RHYTHM_KEYS = ['a', 's', 'd', 'arrowleft', 'arrowdown', 'arrowright', '1', '2', '3'];
const RHYTHM_WIN = 60;      // % точности для победы
const PERFECT_MS = 110;
const GOOD_MS = 220;

// Детерминированный генератор: один и тот же seed → одни и те же ноты при каждом переигрывании
function seededRandom(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Ноты по сетке битов трека: cfg.bpm, cfg.offset (мс до первого бита), cfg.beats (сколько битов играть)
function buildRhythmNotes(cfg, travel) {
    const easy = cfg.difficulty === 'easy';
    const rand = seededRandom(cfg.seed || 1);
    const beatMs = 60000 / cfg.bpm;
    const firstBeat = Math.ceil((travel + 1500 - cfg.offset) / beatMs);
    const notes = [];
    let lastLane = -1, repeats = 0;
    const lane = () => {
        let l = Math.floor(rand() * 3);
        if (l === lastLane && ++repeats >= 2) { l = (l + 1 + Math.floor(rand() * 2)) % 3; }
        if (l !== lastLane) repeats = 0;
        lastLane = l;
        return l;
    };
    for (let b = firstBeat; b < firstBeat + cfg.beats; b++) {
        const time = cfg.offset + b * beatMs;
        if (easy) {
            // репетиция: нота на каждый второй бит, иногда и на нечётный
            if (b % 2 === 0 || rand() < 0.15) notes.push({ lane: lane(), time });
        } else {
            // концерт: нота на каждый бит, иногда пауза, иногда восьмая между битами
            if (rand() < 0.1) continue;
            notes.push({ lane: lane(), time });
            if (rand() < 0.15) notes.push({ lane: lane(), time: time + beatMs / 2 });
        }
    }
    return notes.map(n => ({ ...n, el: null, state: 'wait' }));
}

// Трек ритм-игры начинает грузиться ещё при входе в сцену (renderScene), чтобы на медленном интернете
// музыка была готова к нажатию «Играть»
const rhythmTracks = {};
function preloadRhythmTrack(src) {
    if (!rhythmTracks[src]) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = src;
        rhythmTracks[src] = audio;
    }
    return rhythmTracks[src];
}

function startRhythm(cfg, overlay) {
    const travel = cfg.difficulty === 'easy' ? 1900 : 1450;  // мс, за которые нота долетает до линии
    const notes = buildRhythmNotes(cfg, travel);
    const total = notes.length;
    const endTime = notes[notes.length - 1].time + 700;

    // Своя музыка мини-игры с начала трека; фоновая на паузе. Часы игры идут по треку.
    activePlayer.pause();
    inactivePlayer.pause();
    let song = audioEnabled && cfg.track ? preloadRhythmTrack(cfg.track) : null;

    overlay.innerHTML = `
        <div class="mg-box rhythm">
            <div class="mg-title">${cfg.title}</div>
            <div class="mg-stats"><span>Точность: <b id="rh-acc">0%</b></span><span id="rh-combo"></span></div>
            <div class="rh-field" id="rh-field">
                <div class="rh-lane"></div><div class="rh-lane"></div><div class="rh-lane"></div>
                <div class="rh-line"></div>
                <div class="rh-feedback" id="rh-feedback">Приготовься...</div>
            </div>
            <div class="rh-pads">
                ${RHYTHM_LANES.map((name, i) => `<button class="rh-pad" data-lane="${i}">${name}</button>`).join('')}
            </div>
            <button class="mg-giveup" id="rh-giveup">Сдаться</button>
        </div>`;

    const field = document.getElementById('rh-field');
    const feedback = document.getElementById('rh-feedback');
    const accEl = document.getElementById('rh-acc');
    const comboEl = document.getElementById('rh-combo');
    let points = 0, judged = 0, combo = 0, running = true, rafId = null;
    let start = performance.now();

    // Время игры = позиция в треке (если музыка играет), иначе — обычные часы
    function clock() {
        const now = performance.now() - start;
        if (song && !song.paused && song.currentTime > 0) {
            const songMs = song.currentTime * 1000;
            // currentTime обновляется рывками — подстраиваемся только при заметном расхождении
            if (Math.abs(songMs - now) > 60) { start = performance.now() - songMs; return songMs; }
        }
        return now;
    }

    const laneWidth = () => field.clientWidth / 3;
    const lineY = () => field.clientHeight - 34;

    function flash(text, cls) {
        feedback.innerText = text;
        feedback.className = 'rh-feedback show ' + cls;
    }

    function updateStats() {
        accEl.innerText = Math.round(points / total * 100) + '%';
        comboEl.innerText = combo >= 3 ? '🔥 x' + combo : '';
    }

    function judge(note, quality) {
        note.state = quality;
        judged++;
        if (quality === 'miss') {
            combo = 0;
            flash('Мимо', 'miss');
            if (note.el) note.el.classList.add('missed');
        } else {
            points += quality === 'perfect' ? 1 : 0.6;
            combo++;
            flash(quality === 'perfect' ? 'Идеально!' : 'Норм', quality);
            if (note.el) note.el.classList.add('hit');
        }
        updateStats();
    }

    function hitLane(lane) {
        if (!running) return;
        const pad = overlay.querySelector(`.rh-pad[data-lane="${lane}"]`);
        pad.classList.add('pressed');
        setTimeout(() => pad.classList.remove('pressed'), 90);
        const now = clock();
        const note = notes.find(n => n.state === 'wait' && n.lane === lane && Math.abs(n.time - now) <= GOOD_MS);
        if (note) judge(note, Math.abs(note.time - now) <= PERFECT_MS ? 'perfect' : 'good');
    }

    function frame() {
        if (!running) return;
        const now = clock();
        const y0 = lineY();
        notes.forEach(n => {
            const appear = n.time - travel;
            if (now < appear) return;
            if (!n.el) {
                n.el = document.createElement('div');
                n.el.className = 'rh-note';
                n.el.style.left = (n.lane * laneWidth() + laneWidth() / 2) + 'px';
                field.appendChild(n.el);
            }
            const y = (now - appear) / travel * y0;
            n.el.style.transform = `translate(-50%, ${y}px)`;
            if (n.state === 'wait' && now > n.time + GOOD_MS) judge(n, 'miss');
            if (n.state !== 'wait' && now > n.time + 400 && n.el.parentNode) n.el.remove();
        });
        if (now > endTime) return finish(false);
        rafId = requestAnimationFrame(frame);
    }

    function onKey(e) {
        if (!e.key) return;
        const i = RHYTHM_KEYS.indexOf(e.key.toLowerCase());
        if (i >= 0) { e.preventDefault(); hitLane(i % 3); }
    }

    function finish(gaveUp) {
        running = false;
        cancelAnimationFrame(rafId);
        document.removeEventListener('keydown', onKey);
        if (song) { song.pause(); song = null; }
        const acc = gaveUp ? 0 : Math.round(points / total * 100);
        if (!gaveUp) recordRhythm(acc);
        const won = acc >= RHYTHM_WIN;
        showMinigameResult(overlay, cfg, won,
            won ? 'Зал взрывается!' : 'Не сегодня...',
            gaveUp ? 'Ты опускаешь гитару и уходишь со сцены.' : `Точность: <b>${acc}%</b> (нужно ${RHYTHM_WIN}%)`);
    }

    overlay.querySelectorAll('.rh-pad').forEach(pad => {
        pad.addEventListener('pointerdown', e => { e.preventDefault(); hitLane(+pad.dataset.lane); });
    });
    document.getElementById('rh-giveup').onclick = () => finish(true);
    document.addEventListener('keydown', onKey);

    // Ноты пускаем, когда музыка реально заиграла; не дождались за 6 с — играем без музыки, но без рассинхрона
    let started = false;
    function begin() {
        if (started || !running) return;
        started = true;
        start = performance.now() - (song ? song.currentTime * 1000 : 0);
        flash('Поехали!', 'perfect');
        rafId = requestAnimationFrame(frame);
    }
    if (song) {
        feedback.innerText = 'Загрузка музыки...';
        song.currentTime = 0;
        song.addEventListener('playing', begin, { once: true });
        song.play().catch(() => { song = null; begin(); });
        setTimeout(() => {
            if (started) return;
            if (song) song.pause();
            song = null;
            begin();
        }, 6000);
    } else {
        begin();
    }
}

// --- ТЕСТ ---
function startQuiz(cfg, overlay) {
    const questions = cfg.questions;
    let index = 0, score = 0;

    function showQuestion() {
        const q = questions[index];
        const order = q.answers.map((_, i) => i).sort(() => Math.random() - 0.5);
        overlay.innerHTML = `
            <div class="mg-box quiz">
                <div class="mg-title">${cfg.title}</div>
                <div class="mg-stats"><span>Вопрос ${index + 1} из ${questions.length}</span><span>✅ ${score}</span></div>
                <div class="quiz-question">${q.question}</div>
                <div class="quiz-answers">
                    ${order.map(i => `<button class="quiz-answer" data-i="${i}">${q.answers[i]}</button>`).join('')}
                </div>
            </div>`;
        overlay.querySelectorAll('.quiz-answer').forEach(btn => {
            btn.onclick = () => {
                const chosen = +btn.dataset.i;
                overlay.querySelectorAll('.quiz-answer').forEach(b => {
                    b.disabled = true;
                    if (+b.dataset.i === q.correct) b.classList.add('right');
                });
                if (chosen === q.correct) {
                    score++;
                    playUISound('item');
                } else {
                    btn.classList.add('wrong');
                    playUISound('danger');
                }
                setTimeout(() => {
                    index++;
                    if (index < questions.length) showQuestion();
                    else finish();
                }, 1000);
            };
        });
    }

    function finish() {
        recordQuiz(score, questions.length);
        const won = score >= cfg.pass;
        showMinigameResult(overlay, cfg, won,
            `${score} из ${questions.length}`,
            won ? 'Ты знаешь его лучше, чем он сам.' : 'Кажется, надо внимательнее читать переписку...');
    }

    showQuestion();
}
