// Фоновые частицы, синтез UI-звуков, тосты, лайтбокс

// --- ФОНОВАЯ АНИМАЦИЯ ЧАСТИЦ ---
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

for (let i = 0; i < 38; i++) {
    particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 14 + 6,
        speedY: Math.random() * 0.7 + 0.25,
        speedX: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.4 + 0.15,
        type: Math.random() > 0.35 ? '❤' : '❄'
    });
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        ctx.font = `${p.size}px sans-serif`;
        ctx.fillStyle = p.type === '❤' 
            ? `rgba(255, 20, 147, ${p.opacity})` 
            : `rgba(255, 220, 245, ${p.opacity})`;
        ctx.fillText(p.type, p.x, p.y);
        p.y -= p.speedY;
        p.x += Math.sin(p.y * 0.02) * 0.3 + p.speedX;
        if (p.y < -20) {
            p.y = canvas.height + 20;
            p.x = Math.random() * canvas.width;
        }
    });
    requestAnimationFrame(animateParticles);
}
animateParticles();

// --- СИНТЕЗАТОР ЗВУКОВ ИНТЕРФЕЙСА (WEB AUDIO API) ---
let audioCtx = null;
function playUISound(type) {
    if (!audioEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.start(now); osc.stop(now + 0.06);
        } else if (type === 'item') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880, now + 0.09);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
            osc.start(now); osc.stop(now + 0.26);
        } else if (type === 'danger') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.linearRampToValueAtTime(90, now + 0.22);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.start(now); osc.stop(now + 0.22);
        }
    } catch (e) {}
}

// --- ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ (ТОСТЫ) ---
function showToast(message, icon = '✨') {
    const container = document.getElementById('toast-container');
    // На телефоне больше трёх уведомлений закрывают шапку — убираем самое старое
    while (container.children.length >= 3) container.firstElementChild.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span style="font-size:20px">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3200);
}

// --- ЛАЙТБОКС КАРТИНОК ---
function openLightbox(src) {
    if (!src) return;
    playUISound('click');
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox-modal').style.display = 'flex';
}
function closeLightbox() {
    document.getElementById('lightbox-modal').style.display = 'none';
}

