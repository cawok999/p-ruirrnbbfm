// Самопроверка игры: открой index.html?check=1 — поверх игры появится отчёт (и он же в консоли).
// Ничего не меняет в игре и сохранениях. Гонять перед каждым коммитом.

(async function devCheck() {
    const errors = [], warnings = [], info = [];
    const ids = Object.keys(scenes);
    const LOVE_SAMPLES = [-5, 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 20];

    // Куда может вести выбор: строка, функция (перебираем значения симпатии) или мини-игра
    function targetsOf(scene) {
        const out = [];
        if (scene.minigame) out.push(scene.minigame.win, scene.minigame.lose);
        (scene.choices || []).forEach(c => {
            if (typeof c.next === 'function') {
                const saved = love;
                LOVE_SAMPLES.forEach(l => { love = l; out.push(c.next()); });
                love = saved;
            } else {
                out.push(c.next);
            }
        });
        return [...new Set(out)];
    }

    // 1. Битые переходы и сцены-тупики
    const edges = {};
    ids.forEach(id => {
        const scene = scenes[id];
        edges[id] = targetsOf(scene).filter(t => t !== 'check_checkpoint');
        edges[id].forEach(t => { if (!scenes[t]) errors.push(`${id} → «${t}»: такой сцены нет`); });
        if (!scene.minigame && !(scene.choices || []).length) errors.push(`${id}: нет ни выборов, ни мини-игры`);
        if (!scene.text || !scene.text.length) warnings.push(`${id}: пустой text`);
        if (!scene.loc) warnings.push(`${id}: нет loc`);
    });

    // 2. Недостижимые сцены
    const seen = new Set(['start', 'ch2_start']);
    const queue = [...seen];
    while (queue.length) edges[queue.shift()].forEach(t => { if (scenes[t] && !seen.has(t)) { seen.add(t); queue.push(t); } });
    ids.filter(id => !seen.has(id)).forEach(id => errors.push(`${id}: недостижима от start / ch2_start`));

    // 3. Предметы
    const itemIds = v => (Array.isArray(v) ? v : [v]).filter(Boolean);
    ids.forEach(id => {
        const scene = scenes[id];
        (scene.choices || []).forEach(c => ['requires', 'give', 'take'].forEach(k =>
            itemIds(c[k]).forEach(item => { if (!ITEMS[item]) errors.push(`${id}: ${k} неизвестного предмета «${item}»`); })));
        if (scene.onEnter) {
            const src = scene.onEnter.toString();
            [...src.matchAll(/(?:giveItem|takeItem)\('([^']+)'/g)].forEach(m => {
                if (!ITEMS[m[1]]) errors.push(`${id}: onEnter трогает неизвестный предмет «${m[1]}»`);
            });
        }
    });

    // 4. Смерти, главы, концовки
    ids.forEach(id => {
        const scene = scenes[id];
        const hasDeathBtn = (scene.choices || []).some(c => c.class === 'death-btn');
        if (hasDeathBtn !== !!scene.death) errors.push(`${id}: кнопка смерти и поле death: true не совпадают`);
        if (scene.chapter !== 1 && scene.chapter !== 2) errors.push(`${id}: нет главы (сцену добавили не через addScenes?)`);
    });
    const orders = {};
    allEndings().forEach(id => {
        const key = scenes[id].chapter + ':' + scenes[id].ending.order;
        if (orders[key]) errors.push(`концовки ${orders[key]} и ${id}: одинаковый order в одной главе`);
        orders[key] = id;
    });

    // 5. Запретное: Полина — нигде (сцены, предметы, альбом, телефон)
    const texts = [
        ...ids.map(id => [id, JSON.stringify(scenes[id].text) + scenes[id].loc + JSON.stringify(scenes[id].choices.map(c => c.text))]),
        ['ITEMS', JSON.stringify(ITEMS)],
        ['ALBUM', JSON.stringify(ALBUM)],
        ['PHONE_NOTES', JSON.stringify(PHONE_NOTES)],
        ...PHONE_CONTACTS.filter(c => c.id !== 'sasha').map(c => ['PHONE_CONTACTS:' + c.id, c.name + JSON.stringify(c.messages())])
    ];
    texts.forEach(([where, text]) => { if (/полин/i.test(text)) errors.push(`${where}: упоминание Полины`); });

    // 6. Альбом и ачивки не падают
    ALBUM.forEach(card => { try { card.unlock(); } catch (e) { errors.push(`ALBUM.${card.id}: unlock() падает: ${e.message}`); } });
    ACHIEVEMENTS.forEach(a => { try { a.check(); } catch (e) { errors.push(`ACHIEVEMENTS.${a.id}: check() падает: ${e.message}`); } });

    // 7. Файлы картинок и музыки (запасной есть → предупреждение, нет → ошибка)
    const assets = new Map();
    ids.forEach(id => {
        const s = scenes[id];
        if (s.image) assets.set(s.image, { id, fallback: s.imageFallback });
        if (s.imageFallback) assets.set(s.imageFallback, { id });
        if (s.bgm) assets.set(s.bgm, { id, fallback: s.bgmFallback });
        if (s.bgmFallback) assets.set(s.bgmFallback, { id });
        if (s.minigame && s.minigame.track) assets.set(s.minigame.track, { id });
    });
    const missingWithFallback = [];
    if (location.protocol.startsWith('http')) {
        await Promise.all([...assets].map(async ([path, ref]) => {
            const ok = await fetch(path, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
            if (ok) return;
            if (ref.fallback) missingWithFallback.push(path);
            else errors.push(`${ref.id}: файла ${path} нет, и запасного тоже`);
        }));
    } else {
        info.push('Файлы не проверены: открой через сервер (http://), а не двойным кликом');
    }
    if (missingWithFallback.length) warnings.push(`Ещё не залиты (играют запасные): ${missingWithFallback.sort().join(', ')}`);

    info.push(`Сцен: ${ids.length} (гл.1: ${ids.filter(i => scenes[i].chapter === 1).length}, гл.2: ${ids.filter(i => scenes[i].chapter === 2).length})`);
    info.push(`Концовок: ${allEndings().length}, смертей: ${ids.filter(i => scenes[i].death).length}, чекпоинтов: ${ids.filter(i => scenes[i].checkpoint).length}`);
    info.push(`Предметов: ${Object.keys(ITEMS).length}, ачивок: ${ACHIEVEMENTS.length}, карточек альбома: ${ALBUM.length}`);

    // Отчёт
    console.group('%cСамопроверка игры', 'font-weight:bold');
    errors.forEach(e => console.error(e));
    warnings.forEach(w => console.warn(w));
    info.forEach(i => console.info(i));
    console.groupEnd();
    window.devCheckResult = { errors, warnings, info };

    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:12px;z-index:9999;overflow:auto;background:#fff;border:4px solid ' +
        (errors.length ? '#ff2a55' : '#3dbf75') + ';border-radius:16px;padding:16px;font:14px/1.5 monospace;color:#222';
    const list = (title, items, color) => items.length
        ? `<h3 style="color:${color};margin:12px 0 4px">${title} (${items.length})</h3><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>` : '';
    box.innerHTML = `<b style="font-size:18px">${errors.length ? '❌ Есть ошибки' : '✅ Всё в порядке'}</b>
        <button onclick="this.parentNode.remove()" style="float:right;font-size:16px">Закрыть</button>` +
        list('Ошибки', errors, '#ff2a55') + list('Предупреждения', warnings, '#c98a00') + list('Сводка', info, '#555');
    document.body.appendChild(box);
})();
