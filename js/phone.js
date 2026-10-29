// Телефон Анжелы: Чаты, Галерея, Заметки, Ачивки, Альбом, Концовки, Титры
// Тексты (заметки, контакты, титры) — в js/phone_data.js

const PHONE_APPS = [
    { id: 'chats', icon: '💬', name: 'Чаты' },
    { id: 'gallery', icon: '🖼️', name: 'Галерея' },
    { id: 'notes', icon: '📝', name: 'Заметки' },
    { id: 'achievements', icon: '🏅', name: 'Ачивки' },
    { id: 'album', icon: '📖', name: 'Альбом' },
    { id: 'endings', icon: '🏆', name: 'Концовки' },
    { id: 'credits', icon: '🎵', name: 'Титры' }
];

let phoneApp = null;
let phoneChat = null;

function sashaHistory() {
    const lines = [];
    // В порядке, в котором сцены впервые увидены, — это и есть хронология переписки
    getMeta().seen.filter(id => scenes[id] && scenes[id].chapter === 2).forEach(id => {
        scenes[id].text.forEach(line => {
            const m = line.match(/^<span class='chat-from-(sasha|me)'>[^<]*?(?:· ([\d:]+))?<\/span>([\s\S]*)$/);
            if (!m) return;
            const msg = (m[1] === 'me' ? 'out:' : 'in:') + m[3] + (m[2] ? '|' + m[2] : '');
            if (!lines.includes(msg)) lines.push(msg);
        });
    });
    return lines.length ? lines : ['in:ты спишь|02:14'];
}

function openPhone(app) {
    playUISound('click');
    document.getElementById('phone-overlay').style.display = 'flex';
    phoneChat = null;
    renderPhone(app || null);
}

function closePhone() {
    document.getElementById('phone-overlay').style.display = 'none';
}

function phoneBack() {
    playUISound('click');
    if (phoneChat) { phoneChat = null; renderPhone('chats'); }
    else renderPhone(null);
}

function renderPhone(app) {
    phoneApp = app;
    if (app !== 'chats') phoneChat = null;
    const screen = document.getElementById('phone-screen');
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const statusBar = `<div class="phone-status"><span>${time}</span><span>📶 🔋 12%</span></div>`;

    if (!app) {
        const achCount = getMeta().ach.length + '/' + ACHIEVEMENTS.length;
        screen.innerHTML = statusBar + `
            <div class="phone-wallpaper">
                <div class="phone-clock">${time}</div>
                <div class="phone-date">Пангоды · ${now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
                <div class="phone-apps">
                    ${PHONE_APPS.map(a => `
                        <button class="phone-app" onclick="playUISound('click'); renderPhone('${a.id}')">
                            <span class="phone-app-icon">${a.icon}</span>
                            <span>${a.name}</span>
                            ${a.id === 'achievements' ? `<span class="phone-badge">${achCount}</span>` : ''}
                            ${a.id === 'endings' ? `<span class="phone-badge">${foundEndings().length}/${allEndings().length}</span>` : ''}
                        </button>`).join('')}
                </div>
            </div>
            <button class="phone-close" onclick="closePhone()">Убрать телефон</button>`;
        return;
    }

    const title = phoneChat ? PHONE_CONTACTS.find(c => c.id === phoneChat).name : PHONE_APPS.find(a => a.id === app).name;
    screen.innerHTML = statusBar + `
        <div class="phone-header">
            <button class="phone-back" onclick="phoneBack()">‹</button>
            <span>${title}</span>
            <button class="phone-x" onclick="closePhone()">✕</button>
        </div>
        <div class="phone-body" id="phone-body"></div>`;
    const body = document.getElementById('phone-body');

    if (app === 'chats' && phoneChat) renderPhoneChat(body);
    else if (app === 'chats') renderPhoneContacts(body);
    else if (app === 'gallery') renderPhoneGallery(body);
    else if (app === 'notes') renderPhoneNotes(body);
    else if (app === 'achievements') renderPhoneAchievements(body);
    else if (app === 'album') renderPhoneAlbum(body);
    else if (app === 'credits') renderPhoneCredits(body);
    else if (app === 'endings') {
        body.innerHTML = '<ul class="phone-list" id="phone-endings"></ul>';
        renderEndingsList(document.getElementById('phone-endings'));
    }
}

function renderPhoneContacts(body) {
    body.innerHTML = PHONE_CONTACTS.map(c => {
        const last = c.messages().slice(-1)[0].replace(/^(in|out):/, '').split('|')[0];
        return `<button class="phone-contact" onclick="playUISound('click'); phoneChat='${c.id}'; renderPhone('chats')">
            <span class="phone-avatar">${c.avatar}</span>
            <span class="phone-contact-text"><b>${c.pinned ? '📌 ' : ''}${c.name}</b><small>${last.replace(/<[^>]+>/g, '')}</small></span>
        </button>`;
    }).join('');
}

function renderPhoneChat(body) {
    const contact = PHONE_CONTACTS.find(c => c.id === phoneChat);
    body.className = 'phone-body phone-chat';
    body.innerHTML = contact.messages().map(msg => {
        const out = msg.startsWith('out:');
        const [text, time] = msg.replace(/^(in|out):/, '').split('|');
        return `<div class="phone-msg ${out ? 'out' : 'in'}">${text}${time ? `<small>${time}</small>` : ''}</div>`;
    }).join('');
    body.scrollTop = body.scrollHeight;
}

function renderPhoneGallery(body) {
    const images = getMeta().images;
    if (!images.length) {
        body.innerHTML = '<p class="phone-empty">Пока пусто. Фото появляются по ходу игры.</p>';
        return;
    }
    body.innerHTML = `<p class="phone-hint">Фото из игры: ${images.length}. Нажми, чтобы открыть.</p>
        <div class="phone-gallery">${images.map(src => `<img src="${src}" alt="" loading="lazy" onclick="openLightbox(this.src)">`).join('')}</div>`;
}

function renderPhoneNotes(body) {
    const notes = PHONE_NOTES.filter(n => !n.unlock || n.unlock());
    body.innerHTML = notes.map(n => `<div class="phone-note">${n.text.replace(/\n/g, '<br>')}</div>`).join('');
}

function renderPhoneAchievements(body) {
    const got = getMeta().ach;
    body.innerHTML = `<p class="phone-hint">Открыто ${got.length} из ${ACHIEVEMENTS.length}</p>` +
        ACHIEVEMENTS.map(a => {
            const ok = got.includes(a.id);
            return `<div class="phone-ach ${ok ? '' : 'locked'}">
                <span class="phone-ach-icon">${ok ? a.icon : '🔒'}</span>
                <span><b>${a.title}</b><small>${a.desc}</small></span>
            </div>`;
        }).join('');
}

function renderPhoneCredits(body) {
    body.innerHTML = `<p class="phone-hint">Музыка Главы 2</p>` +
        MUSIC_CREDITS.map(c => `<div class="phone-ach">
            <span class="phone-ach-icon">🎵</span>
            <span><b>«${c.title}» — Kevin MacLeod (incompetech.com)</b><small>${c.where}</small></span>
        </div>`).join('') +
        `<p class="phone-hint">Licensed under Creative Commons: By Attribution 4.0 License<br>
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">creativecommons.org/licenses/by/4.0</a></p>`;
}

function renderPhoneAlbum(body) {
    const open = ALBUM.filter(card => card.unlock()).length;
    body.innerHTML = `<p class="phone-hint">Воспоминаний: ${open} из ${ALBUM.length}</p>` +
        ALBUM.map(card => {
            if (!card.unlock()) {
                return `<div class="album-card locked"><b>🔒 ${card.date}</b><small>${card.hint}</small></div>`;
            }
            const lines = card.lines.map(l => {
                if (l.startsWith('in:')) return `<div class="phone-msg in">${l.slice(3)}</div>`;
                if (l.startsWith('out:')) return `<div class="phone-msg out">${l.slice(4)}</div>`;
                return `<p>${l}</p>`;
            }).join('');
            return `<div class="album-card">
                <img src="img/album/${card.id}.jpg" alt="" onerror="this.remove()" onclick="openLightbox(this.src)">
                <div class="album-date">${card.date}</div>
                <b class="album-title">${card.title}</b>
                <div class="album-lines">${lines}</div>
            </div>`;
        }).join('');
}
