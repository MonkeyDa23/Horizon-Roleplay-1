// Handle UI updates from Lua
function updateUI(data) {
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const notLinkedView = document.getElementById('not-linked-view');
    const linkedView = document.getElementById('linked-view');
    const btnGenerate = document.getElementById('btn-generate');
    const codeBox = document.getElementById('code-box');

    if (data.isLinked) {
        statusBadge.className = 'status-badge linked';
        statusText.innerText = 'مربوط';
        notLinkedView.classList.add('hidden');
        linkedView.classList.remove('hidden');
        btnGenerate.classList.add('hidden');

        document.getElementById('user-avatar').src = data.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
        document.getElementById('user-name').innerText = data.username || 'Unknown';
        document.getElementById('user-id').innerText = 'ID: ' + (data.discordId || '000000000');
    } else {
        statusBadge.className = 'status-badge not-linked';
        statusText.innerText = 'غير مربوط';
        notLinkedView.classList.remove('hidden');
        linkedView.classList.add('hidden');
        btnGenerate.classList.remove('hidden');

        if (data.code) {
            codeBox.classList.remove('hidden');
            document.getElementById('linking-code').innerText = data.code;
            btnGenerate.innerHTML = '<i class="fas fa-sync-alt"></i> تحديث الكود';
        } else {
            codeBox.classList.add('hidden');
            btnGenerate.innerHTML = '<i class="fas fa-plus-circle"></i> إنشاء كود ربط';
        }
    }
}

// Buttons Listeners
document.getElementById('btn-generate').addEventListener('click', () => {
    mta.triggerEvent('onClientRequestNewCode');
});

document.getElementById('btn-refresh').addEventListener('click', () => {
    mta.triggerEvent('onClientRequestStatusUpdate');
});

document.getElementById('btn-copy-code').addEventListener('click', () => {
    const code = document.getElementById('linking-code').innerText;
    if (code && code !== '------') {
        copyToClipboard(code, "تم نسخ الكود بنجاح!");
    }
});

// Social Links
const DISCORD_URL = "https://discord.gg/vixel";
const WEBSITE_URL = "https://florida-rp.com";

document.getElementById('copy-discord').addEventListener('click', () => {
    copyToClipboard(DISCORD_URL, "تم نسخ رابط الديسكورد!");
});

document.getElementById('copy-website').addEventListener('click', () => {
    copyToClipboard(WEBSITE_URL, "تم نسخ رابط الموقع!");
});

function copyToClipboard(text, message) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    
    const notify = document.getElementById('notification');
    const notifyText = document.getElementById('notification-text');
    notifyText.innerText = message || 'تم النسخ بنجاح!';
    notify.classList.remove('hidden');
    setTimeout(() => notify.classList.add('hidden'), 2500);
}

// Listen for messages from Lua
window.addEventListener('message', (event) => {
    if (event.data.type === 'update') {
        updateUI(event.data.payload);
    }
});
