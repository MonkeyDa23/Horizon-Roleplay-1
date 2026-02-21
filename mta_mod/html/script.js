document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');

    // --- Functions to render UI states ---

    const renderLoading = () => {
        mainContent.innerHTML = `<p>Loading...</p>`;
    };

    const renderUnlinked = () => {
        mainContent.innerHTML = `
            <div class="status unlinked">غير مربوط</div>
            <p>اربط حسابك للاستفادة من الميزات الكاملة.</p>
            <button id="generate-btn" class="btn btn-primary">توليد كود</button>
        `;
        document.getElementById('generate-btn').addEventListener('click', () => {
            mta.triggerEvent('onClientRequestLinkCode');
        });
    };

    const renderLinked = (discordUser) => {
        mainContent.innerHTML = `
            <div class="status linked">مربوط</div>
            <div class="discord-info">
                <img src="${discordUser.avatar}" alt="Discord Avatar">
                <div class="text">
                    <div class="username">${discordUser.username}</div>
                    <div class="discord-id">ID: ${discordUser.discordId}</div>
                </div>
            </div>
            <button id="unlink-btn" class="btn btn-danger">إلغاء الربط</button>
        `;
        document.getElementById('unlink-btn').addEventListener('click', () => {
            mta.triggerEvent('onClientRequestUnlink');
        });
    };

    const renderCode = (code) => {
        mainContent.innerHTML = `
            <p>استخدم هذا الكود في الموقع لربط حسابك.</p>
            <div class="code-box" id="code-box">
                <div class="blur-overlay">مرر لنسخ الكود</div>
                <div class="code">${code}</div>
            </div>
            <p>الكود صالح لمدة 5 دقائق.</p>
        `;
        document.getElementById('code-box').addEventListener('click', () => {
            mta.triggerEvent('onClientCopyCode', code);
        });
    };

    const renderCooldown = (message) => {
        mainContent.innerHTML = `
            <div class="status unlinked">غير مربوط</div>
            <p class="cooldown-message">${message}</p>
            <button class="btn btn-primary" disabled>توليد كود</button>
        `;
    };

    // --- MTA Event Listeners ---

    // Initial state sent from client.lua
    window.addEventListener('mta.updateUI', (e) => {
        const { state, data } = e.detail;
        switch (state) {
            case 'loading':
                renderLoading();
                break;
            case 'unlinked':
                renderUnlinked();
                break;
            case 'linked':
                renderLinked(data.discordUser);
                break;
            case 'cooldown':
                renderCooldown(data.message);
                break;
            case 'showCode':
                renderCode(data.code);
                break;
        }
    });
});
