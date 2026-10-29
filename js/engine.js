// Движок: старт, печать текста, показ выборов, рендер сцены

// Сцена, выбранная игроком последней, и её мини-игра (если есть) — для showChoices
let currentMinigame = null;
let currentMapScene = false;

function openGameScreen() {
    document.getElementById('init-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    document.getElementById('phone-btn').style.display = 'flex';
}

// Новая игра со стартового экрана перезапишет сохранение — спрашиваем, если оно есть
function confirmOverwrite() {
    return !loadProgress() || confirm('Начать заново? Сохранённый прогресс («Продолжить») будет потерян. Найденные концовки и ачивки останутся.');
}

function startGame() {
    if (!confirmOverwrite()) return;
    openGameScreen();
    lastCheckpoint = 'start';
    resetSpecialItems();

    toggleAudio(true);
    renderScene('start');
}

function startChapter2() {
    if (!confirmOverwrite()) return;
    openGameScreen();
    lastCheckpoint = 'ch2_start';

    toggleAudio(true);
    renderScene('ch2_start');
}

function continueGame() {
    const save = loadProgress();
    if (!save) return startGame();
    openGameScreen();
    lastCheckpoint = save.checkpoint;
    restoreItems(save);

    toggleAudio(true);
    showToast('Продолжаем с последнего чекпоинта', '⏩');
    renderScene(save.checkpoint);
}

function toggleModal(modalId) {
    playUISound('click');
    const modal = document.getElementById(modalId);
    const backdrop = document.getElementById('modal-backdrop');
    const isHidden = (modal.style.display === 'none' || modal.style.display === '');
    modal.style.display = isHidden ? 'block' : 'none';
    backdrop.style.display = isHidden ? 'block' : 'none';
    setTimeout(() => { backdrop.style.opacity = isHidden ? '1' : '0'; }, 10);
}

function toggleInventory() {
    toggleModal('inventory-modal');
}

function closeModals() {
    ['inventory-modal'].forEach(id => {
        if (document.getElementById(id).style.display === 'block') toggleModal(id);
    });
}

function skipTyping() {
    if (!isTyping || skipRequested) return;
    playUISound('click');
    skipRequested = true;
    if (typeInterval) clearTimeout(typeInterval);

    const textDiv = document.getElementById('text');
    const cursor = document.getElementById('cursor');
    if (cursor) cursor.remove();

    // Дописываем абзац, прерванный на середине
    if (typingNode) typingNode.innerHTML = typingLine;

    while (currentParagraphs.length > 0) {
        let line = currentParagraphs.shift();
        let p = document.createElement('p');
        styleParagraph(p, line);
        p.style.opacity = 1;
        p.innerHTML = line;
        textDiv.appendChild(p);
    }

    document.getElementById('reading-progress').style.width = '100%';
    showChoices();
}

// Оформление абзаца по разметке внутри него (диалог, романтика, сообщения чата)
function styleParagraph(p, line) {
    if (line.includes('name-tag')) p.classList.add('dialogue-line');
    if (line.includes('heart-tag')) p.classList.add('romance-line');
    if (line.includes('chat-from-sasha')) p.classList.add('chat-in');
    if (line.includes('chat-from-me')) p.classList.add('chat-out');
}

function showChoices() {
    const choicesDiv = document.getElementById('choices');
    choicesDiv.innerHTML = '';
    choicesDiv.classList.toggle('map-grid', currentMapScene);

    // Сцена с мини-игрой: вместо выборов — одна кнопка запуска
    if (currentMinigame) {
        const cfg = currentMinigame;
        let btn = document.createElement('button');
        btn.className = 'choice-btn minigame-btn';
        btn.style.display = 'block';  // .choice-btn по умолчанию скрыта (display: none) до анимации появления
        btn.innerHTML = cfg.button || '▶ Играть';
        btn.onclick = () => {
            btn.disabled = true;
            playUISound('click');
            startMinigame(cfg);
        };
        choicesDiv.appendChild(btn);
        typingFinished([cfg.win, cfg.lose]);
        return;
    }

    currentChoicesData.forEach((choice, idx) => {
        if (choice.requires && !hasItem(choice.requires)) return;
        if (choice.minLove !== undefined && love < choice.minLove) return;

        let btn = document.createElement('button');
        btn.className = 'choice-btn ' + (choice.class || '');
        btn.style.display = 'block'; 
        btn.style.animationDelay = (idx * 0.07) + 's';
        btn.innerHTML = choice.text;
        // Уже пройдено (например, место на карте) — показываем галочку и не даём зайти снова
        if (choice.doneFlag && flags[choice.doneFlag]) {
            btn.classList.add('done');
            btn.innerHTML = '✓ ' + choice.text;
            btn.disabled = true;
            choicesDiv.appendChild(btn);
            return;
        }
        btn.onclick = () => {
            // Защита от двойного нажатия
            btn.disabled = true;
            playUISound('click');
            if (activePlayer.paused && currentBGM && audioEnabled) activePlayer.play().catch(e => {});

            // Последствия выбора (глава 2)
            if (choice.love) changeLove(choice.love);
            if (choice.give) giveItem(choice.give);
            if (choice.take) takeItem(choice.take);
            if (choice.flag) flags[choice.flag] = true;

            // next может быть функцией: развилка по симпатии/предметам
            const next = typeof choice.next === 'function' ? choice.next() : choice.next;
            if (next === 'check_checkpoint') {
                showToast('Загрузка последнего чекпоинта...', '⏪');
                restoreCheckpointState();
                renderScene(lastCheckpoint);
            } else {
                renderScene(next);
            }
        };
        choicesDiv.appendChild(btn);
    });
    typingFinished(currentChoicesData.map(c => c.next).filter(n => typeof n === 'string'));
}

// Печать закончена: прячем «Пропустить», заранее грузим картинки сцен, куда можно пойти дальше
function typingFinished(nextIds) {
    isTyping = false;
    document.getElementById('skip-btn').style.display = 'none';
    document.getElementById('text').classList.remove('typing');
    nextIds.forEach(id => {
        const scene = scenes[id];
        if (!scene || !scene.image) return;
        const img = new Image();
        if (scene.imageFallback) img.onerror = () => { new Image().src = scene.imageFallback; };
        img.src = scene.image;
    });
}

// Тап по тексту во время печати = «Пропустить печать»
document.getElementById('text').addEventListener('click', () => {
    if (isTyping) skipTyping();
});

function processNextParagraph() {
    if (currentParagraphs.length === 0) {
        document.getElementById('reading-progress').style.width = '100%';
        showChoices();
        return;
    }

    const completed = totalParagraphsInScene - currentParagraphs.length;
    const pct = Math.round((completed / totalParagraphsInScene) * 100);
    document.getElementById('reading-progress').style.width = pct + '%';

    let line = currentParagraphs.shift();
    let textDiv = document.getElementById('text');
    let pNode = document.createElement('p');
    styleParagraph(pNode, line);
    pNode.style.opacity = 1;
    textDiv.appendChild(pNode);
    typingNode = pNode;
    typingLine = line;

    if (skipRequested) {
        pNode.innerHTML = line;
        processNextParagraph();
        return;
    }

    // Разметка вставляется сразу, а текстовые узлы дописываются по символу — без пересборки innerHTML
    pNode.innerHTML = line;
    const parts = [];
    const walker = document.createTreeWalker(pNode, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) parts.push({ node: walker.currentNode, text: walker.currentNode.data });
    parts.forEach(part => { part.node.data = ''; });
    const cursor = document.createElement('span');
    cursor.id = 'cursor';
    cursor.className = 'cursor';
    let partIndex = 0, charIndex = 0;

    function typeChar() {
        if (skipRequested) {
            pNode.innerHTML = line;
            processNextParagraph();
            return;
        }

        if (partIndex < parts.length) {
            const part = parts[partIndex];
            charIndex++;
            part.node.data = part.text.slice(0, charIndex);
            part.node.after(cursor);
            if (charIndex >= part.text.length) { partIndex++; charIndex = 0; }
            typeInterval = setTimeout(typeChar, 5);
        } else {
            cursor.remove();
            typeInterval = setTimeout(processNextParagraph, 200);
        }
    }
    typeChar();
}

function renderScene(sceneId) {
    if (typeInterval) {
        clearTimeout(typeInterval);
        typeInterval = null;
    }
    
    isTyping = true;
    skipRequested = false;
    
    const scene = scenes[sceneId];
    if (!scene) return;

    const gameContainer = document.getElementById('game-container');
    
    if (scene.checkpoint && lastCheckpoint !== sceneId) {
        lastCheckpoint = sceneId;
        showToast('Чекпоинт сохранен', '💾');
    }

    if (scene.bgm === 'audio/boss.mp3' || scene.bgmFallback === 'audio/boss.mp3') {
        gameContainer.classList.add('boss-mode');
        playUISound('danger');
    } else {
        gameContainer.classList.remove('boss-mode');
    }

    if (scene.shake) {
        gameContainer.classList.remove('shake-screen');
        void gameContainer.offsetWidth;
        gameContainer.classList.add('shake-screen');
    }
    
    if (scene.onEnter) {
        scene.onEnter();
    }

    // Сохраняем после onEnter, чтобы предметы в сохранении совпадали с тем, что выдала сцена
    if (scene.checkpoint) saveProgress(sceneId);
    if (scene.ending) markEnding(sceneId);
    recordSceneSeen(sceneId);
    checkAchievements();
    currentMinigame = scene.minigame || null;
    currentMapScene = !!scene.map;
    if (currentMinigame && currentMinigame.track) preloadRhythmTrack(currentMinigame.track);

    document.getElementById('loc-display').innerText = scene.loc;
    document.getElementById('skip-btn').style.display = 'block';
    document.getElementById('text').classList.add('typing');
    document.getElementById('reading-progress').style.width = '0%';
    
    playBGM(scene.bgm, scene.bgmFallback);

    const imgElement = document.getElementById('scene-image');
    const placeholder = document.getElementById('art-placeholder');
    const zoomHint = document.getElementById('art-zoom-hint');
    
    // Та же картинка, что уже показана: не перезагружаем — Safari на повторный src может не прислать onload,
    // и картинка осталась бы прозрачной
    const sameImage = scene.image && imgElement.style.display !== 'none' && imgElement.complete &&
        imgElement.naturalWidth > 0 && [scene.image, scene.imageFallback].includes(imgElement.getAttribute('src'));
    if (sameImage) {
        imgElement.style.opacity = '1';
    } else if (scene.image) {
        imgElement.style.opacity = '0';
        imgElement.src = scene.image;
        imgElement.style.display = 'block';
        zoomHint.style.display = 'block';
        placeholder.style.display = 'none';
        imgElement.onload = () => {
            imgElement.style.opacity = '1';
            recordImageSeen(imgElement.getAttribute('src'));
        };
        imgElement.onerror = function() {
            // Новой картинки ещё нет — показываем запасную
            if (scene.imageFallback && !imgElement.src.endsWith(scene.imageFallback)) {
                imgElement.src = scene.imageFallback;
                return;
            }
            imgElement.style.display = 'none';
            zoomHint.style.display = 'none';
            placeholder.style.display = 'block';
            placeholder.innerHTML = "Нужна картинка:<br><span style='color: #ff1493; font-family: monospace;'>" + scene.image + "</span>";
        };
    } else {
        imgElement.style.display = 'none';
        zoomHint.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.innerText = "(Картинка не требуется)";
    }

    const choicesDiv = document.getElementById('choices');
    const textDiv = document.getElementById('text');
    const mainScroll = document.getElementById('main-scroll-container');
    choicesDiv.innerHTML = '';
    textDiv.innerHTML = '';
    
    // Сбрасываем скролл строго в самое начало новой сцены
    textDiv.scrollTop = 0;
    if (mainScroll) mainScroll.scrollTop = 0;

    currentParagraphs = [...scene.text];
    totalParagraphsInScene = currentParagraphs.length || 1;
    currentChoicesData = scene.choices;

    processNextParagraph();
}
