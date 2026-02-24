// 1. Core Utility Functions (Top Level)
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
        // Force reset animation
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

// 2. Global Action Functions (Attached to window for HTML onclick)
window.requestNewCode = function() {
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

// 3. UI Update Logic (Called from Lua)
window.updateUI = function(data) {
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const notLinkedView = document.getElementById('not-linked-view');
    const linkedView = document.getElementById('linked-view');
    const codeBox = document.getElementById('code-box');

    if (!statusBadge || !statusText) return;

    if (data.isLinked) {
        statusBadge.className = 'status-badge linked';
        statusText.innerText = 'مربوط';
        
        if (notLinkedView) notLinkedView.classList.add('hidden');
        if (linkedView) linkedView.classList.remove('hidden');

        const avatar = document.getElementById('user-avatar');
        if (avatar) avatar.src = data.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        const name = document.getElementById('user-name');
        if (name) name.innerText = data.username || 'Unknown';
        
        const id = document.getElementById('user-id');
        if (id) id.innerText = 'ID: ' + (data.discordId || '000000000');
    } else {
        statusBadge.className = 'status-badge not-linked';
        statusText.innerText = 'غير مربوط';
        
        if (notLinkedView) notLinkedView.classList.remove('hidden');
        if (linkedView) linkedView.classList.add('hidden');

        if (data.code) {
            if (codeBox) codeBox.classList.remove('hidden');
            const codeEl = document.getElementById('linking-code');
            if (codeEl) codeEl.innerText = data.code;
        } else {
            if (codeBox) codeBox.classList.add('hidden');
        }
    }
};
