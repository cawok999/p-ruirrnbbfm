// Вход по паролю: экран #lock-screen поверх всего, пока не введён пароль.
// Это не настоящая защита (файлы игры всё равно публичные) — просто чтобы случайный человек не открыл игру.
// В коде хранится не сам пароль, а его хэш. Сменить пароль: в консоли браузера lockHash('новый') → вставить в LOCK_HASH.

const LOCK_HASH = '1b4380f1';                  // lockHash('пангоды')
const LOCK_KEY = 'angela-quest-unlocked-v1';

// FNV-1a: работает и с file:// (в отличие от crypto.subtle)
function lockHash(text) {
    let h = 2166136261;
    for (const ch of text.trim().toLowerCase().replace(/ё/g, 'е')) {
        h ^= ch.codePointAt(0);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16);
}

function isUnlocked() {
    try { return localStorage.getItem(LOCK_KEY) === LOCK_HASH; } catch (e) { return false; }
}

function tryUnlock() {
    const input = document.getElementById('lock-input');
    const box = document.querySelector('.lock-box');
    if (lockHash(input.value) === LOCK_HASH) {
        try { localStorage.setItem(LOCK_KEY, LOCK_HASH); } catch (e) {}
        document.getElementById('lock-screen').style.display = 'none';
        return;
    }
    document.getElementById('lock-error').style.display = 'block';
    box.classList.remove('shake-screen');
    void box.offsetWidth;
    box.classList.add('shake-screen');
    input.select();
}

if (isUnlocked()) {
    document.getElementById('lock-screen').style.display = 'none';
} else {
    document.getElementById('lock-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') tryUnlock();
    });
}
