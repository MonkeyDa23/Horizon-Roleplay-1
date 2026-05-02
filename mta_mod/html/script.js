function copyToClipboard(text, message) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    
    showToast(message || "تم النسخ!");
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.innerText = message;
        toast.classList.remove('hidden');
        toast.style.animation = 'none';
        toast.offsetHeight; 
        toast.style.animation = null;
        
        if (window.toastTimeout) clearTimeout(window.toastTimeout);
        window.toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2500);
    }
}

function triggerLua(eventName, ...args) {
    if (typeof mta !== 'undefined' && mta.triggerEvent) {
        mta.triggerEvent(eventName, ...args);
        return true;
    }
    return false;
}

let cooldownTimer = null;
let cooldownEndTime = 0;

function startCooldown(durationSeconds) {
    const btn = document.getElementById('generate-btn');
    const timerText = document.getElementById('timer-text');
    const timeLeftSpan = document.getElementById('time-left');
    
    if (btn) {
        btn.disabled = true;
        btn.classList.add('hidden');
    }
    
    if (timerText) timerText.classList.remove('hidden');

    cooldownEndTime = Date.now() + (durationSeconds * 1000);
    
    if (cooldownTimer) clearInterval(cooldownTimer);
    
    cooldownTimer = setInterval(() => {
        const now = Date.now();
        const diff = Math.ceil((cooldownEndTime - now) / 1000);
        
        if (diff <= 0) {
            clearInterval(cooldownTimer);
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('hidden');
                btn.innerText = "إنشاء كود جديد";
            }
            if (timerText) timerText.classList.add('hidden');
        } else {
            const m = Math.floor(diff / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            if (timeLeftSpan) timeLeftSpan.innerText = `${m}:${s}`;
        }
    }, 1000);
}

window.requestNewCode = function() {
    if (cooldownEndTime > Date.now()) return;
    showToast("جاري إنشاء كود جديد...");
    triggerLua('onClientRequestNewCode');
};

window.refreshStatus = function() {
    showToast("جاري تحديث الحالة...");
    triggerLua('onClientRequestStatusUpdate');
};

window.copyLinkingCode = function() {
    const codeEl = document.getElementById('linking-code');
    const code = codeEl ? codeEl.innerText : '';
    if (code && code !== '------') {
        copyToClipboard(code, "تم نسخ كود الربط!");
    } else {
        showToast("لا يوجد كود للنسخ حالياً");
    }
};

window.copyText = function(text, message) {
    copyToClipboard(text, message);
};

let discordUrl = "https://discord.gg/nova";
let websiteUrl = "https://novaroleplay.com";

window.updateSocials = function(discord, website) {
    discordUrl = discord;
    websiteUrl = website;
};

window.openDiscord = function() {
    copyToClipboard(discordUrl, 'تم نسخ رابط الديسكورد!');
};

window.openWebsite = function() {
    copyToClipboard(websiteUrl, 'تم نسخ رابط الموقع!');
};

window.updateUI = function(data) {
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const notLinkedView = document.getElementById('not-linked-view');
    const linkedView = document.getElementById('linked-view');
    const codeBox = document.getElementById('code-box');

    if (!statusBadge || !statusText) return;

    // إزالة حالة التحقق
    statusBadge.classList.remove('checking');

    if (data.error || data.code === "ERROR") {
        statusBadge.className = 'status-badge not-linked';
        statusText.innerText = data.error || 'فشل الاتصال';
        if (notLinkedView) notLinkedView.classList.remove('hidden');
        if (linkedView) linkedView.classList.add('hidden');
        return;
    }

    if (data.isLinked) {
        statusBadge.className = 'status-badge linked';
        statusText.innerText = 'مربوط';
        
        if (notLinkedView) notLinkedView.classList.add('hidden');
        if (linkedView) linkedView.classList.remove('hidden');

        const avatar = document.getElementById('user-avatar');
        if (avatar) {
            avatar.src = data.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
        }
        
        const name = document.getElementById('user-name');
        if (name) name.innerText = data.username || 'Unknown';
        
        const id = document.getElementById('user-id');
        if (id) id.innerText = 'ID: ' + (data.discordId || '000000000');
    } else {
        statusBadge.className = 'status-badge not-linked';
        statusText.innerText = 'غير مرتبط';
        
        if (notLinkedView) notLinkedView.classList.remove('hidden');
        if (linkedView) linkedView.classList.add('hidden');

        if (data.code && data.code !== "ERROR" && data.code !== "...") {
            if (codeBox) codeBox.classList.remove('hidden');
            const codeEl = document.getElementById('linking-code');
            if (codeEl) codeEl.innerText = data.code;
            
            const btn = document.getElementById('generate-btn');
            if (btn) btn.classList.add('hidden');
            
            const timerText = document.getElementById('timer-text');
            if (timerText) timerText.classList.remove('hidden');
            
            if (data.expiresAt) {
                const now = Math.floor(Date.now() / 1000);
                const remaining = data.expiresAt - now;
                if (remaining > 0) {
                    startCooldown(remaining);
                } else {
                    if (btn) {
                        btn.classList.remove('hidden');
                        btn.disabled = false;
                    }
                    if (timerText) timerText.classList.add('hidden');
                }
            }
        } else {
            if (codeBox) codeBox.classList.add('hidden');
            const btn = document.getElementById('generate-btn');
            if (btn) {
                btn.classList.remove('hidden');
                btn.disabled = false;
            }
            const timerText = document.getElementById('timer-text');
            if (timerText) timerText.classList.add('hidden');
        }
    }
};
