// discord-bot/src/controlPanel.ts

export const CONTROL_PANEL_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vixel Bot Control Panel</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --cyan: #00f2ea;
            --dark: #0a0f18;
            --dark-blue: #101827;
            --light-blue: #1c2942;
            --text: #e5e7eb;
            --text-dark: #9ca3af;
            --red: #ef4444;
            --green: #22c55e;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Poppins', sans-serif;
            background-color: var(--dark);
            color: var(--text);
            line-height: 1.6;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .container {
            width: 100%;
            max-width: 800px;
        }
        h1, h2 { color: var(--cyan); text-shadow: 0 0 8px rgba(0, 242, 234, 0.4); }
        h1 { font-size: 2.5rem; text-align: center; margin-bottom: 0.5rem; }
        .subtitle { text-align: center; color: var(--text-dark); margin-bottom: 2rem; }
        .card {
            background-color: var(--dark-blue);
            border: 1px solid var(--light-blue);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        h2 { font-size: 1.5rem; margin-bottom: 1rem; border-bottom: 2px solid var(--cyan); padding-bottom: 0.5rem; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-dark); }
        input, select, textarea {
            width: 100%;
            background-color: var(--light-blue);
            border: 1px solid #374151;
            border-radius: 6px;
            padding: 0.75rem;
            color: var(--text);
            font-size: 1rem;
            font-family: 'Poppins', sans-serif;
            transition: all 0.2s ease;
        }
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: var(--cyan);
            box-shadow: 0 0 0 3px rgba(0, 242, 234, 0.2);
        }
        textarea { resize: vertical; min-height: 80px; }
        .btn {
            background-color: var(--cyan);
            color: var(--dark-blue);
            font-weight: 700;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        .btn:hover { background-color: white; box-shadow: 0 0 15px 0 rgba(0, 242, 234, 0.5); }
        .btn:disabled { background-color: #374151; color: #6b7280; cursor: not-allowed; box-shadow: none; }
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: var(--light-blue);
            border-radius: 6px;
        }
        .status-dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: var(--text-dark);
            box-shadow: 0 0 8px var(--text-dark);
        }
        .status-dot.online { background-color: var(--green); box-shadow: 0 0 8px var(--green); }
        .status-dot.offline { background-color: var(--red); box-shadow: 0 0 8px var(--red); }
        .status-text { font-weight: 600; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .auth-overlay {
            position: fixed;
            inset: 0;
            background-color: rgba(10, 15, 24, 0.9);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            padding: 1rem;
        }
        .auth-modal {
            max-width: 400px;
            width: 100%;
        }
        .hidden { display: none; }
        .toast {
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            padding: 1rem 1.5rem;
            border-radius: 6px;
            color: white;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 101;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .toast.show { opacity: 1; transform: translate(-50%, -1rem); }
        .toast.success { background-color: var(--green); }
        .toast.error { background-color: var(--red); }
        .spinner {
            width: 1.2em; height: 1.2em;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="auth-overlay" id="auth-overlay">
        <div class="card auth-modal">
            <h2>Control Panel Access</h2>
            <div class="form-group">
                <label for="apiKey">API Secret Key</label>
                <input type="password" id="apiKey" placeholder="Enter the bot's API_SECRET_KEY">
            </div>
            <button class="btn" id="unlockBtn">Unlock</button>
        </div>
    </div>

    <div class="container hidden" id="main-content">
        <h1>Vixel Bot Control Panel</h1>
        <p class="subtitle">Real-time bot management and testing.</p>
        
        <div class="card">
            <h2>Bot Status</h2>
            <div class="grid">
                <div class="status-indicator">
                    <div id="status-dot" class="status-dot"></div>
                    <span id="status-text" class="status-text">Checking...</span>
                </div>
                <div id="bot-info">
                    <p><strong>Bot:</strong> <span id="bot-username">...</span></p>
                    <p><strong>Guild:</strong> <span id="guild-name">...</span></p>
                    <p><strong>Members:</strong> <span id="member-count">...</span></p>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>Set Bot Presence</h2>
            <div class="grid">
                <div class="form-group">
                    <label for="status">Status</label>
                    <select id="status">
                        <option value="online">Online</option>
                        <option value="idle">Idle</option>
                        <option value="dnd">Do Not Disturb</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="activityType">Activity Type</label>
                    <select id="activityType">
                        <option value="Playing">Playing</option>
                        <option value="Watching">Watching</option>
                        <option value="Listening">Listening to</option>
                        <option value="Competing">Competing in</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label for="activityName">Activity Name</label>
                <input type="text" id="activityName" placeholder="e.g., Vixel Roleplay">
            </div>
            <button class="btn" id="updatePresenceBtn">Update Presence</button>
        </div>

        <div class="card">
            <h2>Send Test Message</h2>
            <div class="form-group">
                <label for="channelId">Channel ID</label>
                <input type="text" id="channelId" placeholder="Enter the target channel ID">
            </div>
            <div class="form-group">
                <label for="messageContent">Message Content</label>
                <textarea id="messageContent" placeholder="Your test message here..."></textarea>
            </div>
            <button class="btn" id="sendMessageBtn">Send Message</button>
        </div>
    </div>
    
    <div id="toast" class="toast"></div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const authOverlay = document.getElementById('auth-overlay');
            const mainContent = document.getElementById('main-content');
            const unlockBtn = document.getElementById('unlockBtn');
            const apiKeyInput = document.getElementById('apiKey');

            const statusDot = document.getElementById('status-dot');
            const statusText = document.getElementById('status-text');
            const botUsername = document.getElementById('bot-username');
            const guildName = document.getElementById('guild-name');
            const memberCount = document.getElementById('member-count');
            
            const updatePresenceBtn = document.getElementById('updatePresenceBtn');
            const sendMessageBtn = document.getElementById('sendMessageBtn');

            const toast = document.getElementById('toast');

            let API_KEY = null;

            function showToast(message, type = 'success') {
                toast.textContent = message;
                toast.className = 'toast show ' + type;
                setTimeout(() => {
                    toast.className = 'toast';
                }, 3000);
            }

            // FIX: Renamed 'response' to 'fetchResponse' and expanded error handling to avoid potential linter/parser issues.
            async function apiFetch(endpoint, options = {}) {
                const reqOptions = { ...options };
                reqOptions.headers = {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + API_KEY,
                    ...(reqOptions.headers || {})
                };

                const fetchResponse = await fetch(endpoint, reqOptions);
                
                if (!fetchResponse.ok) {
                    let errorData;
                    try {
                        errorData = await fetchResponse.json();
                    } catch (e) {
                        errorData = { error: 'An unknown error occurred' };
                    }
                    throw new Error(errorData.error || `Request failed with status ${fetchResponse.status}`);
                }
                return fetchResponse.json();
            }

            async function checkStatus() {
                try {
                    const data = await apiFetch('/api/status');
                    statusDot.className = 'status-dot online';
                    statusText.textContent = 'Connected';
                    botUsername.textContent = data.username;
                    guildName.textContent = data.guildName;
                    memberCount.textContent = data.memberCount;
                } catch (error) {
                    statusDot.className = 'status-dot offline';
                    statusText.textContent = 'Disconnected';
                    botUsername.textContent = 'N/A';
                    guildName.textContent = 'N/A';
                    memberCount.textContent = 'N/A';
                    showToast('Failed to get bot status: ' + error.message, 'error');
                }
            }

            function unlockPanel() {
                const key = apiKeyInput.value;
                if (!key) {
                    showToast('API Key is required.', 'error');
                    return;
                }
                sessionStorage.setItem('vixel-bot-apikey', key);
                API_KEY = key;
                authOverlay.classList.add('hidden');
                mainContent.classList.remove('hidden');
                checkStatus();
            }
            
            unlockBtn.addEventListener('click', unlockPanel);
            apiKeyInput.addEventListener('keypress', (e) => {
                if(e.key === 'Enter') unlockPanel();
            });

            if (sessionStorage.getItem('vixel-bot-apikey')) {
                API_KEY = sessionStorage.getItem('vixel-bot-apikey');
                authOverlay.classList.add('hidden');
                mainContent.classList.remove('hidden');
                checkStatus();
            }

            updatePresenceBtn.addEventListener('click', async () => {
                const btnOriginalText = updatePresenceBtn.innerHTML;
                updatePresenceBtn.disabled = true;
                updatePresenceBtn.innerHTML = '<div class="spinner"></div> Updating...';
                try {
                    const payload = {
                        status: document.getElementById('status').value,
                        activityType: document.getElementById('activityType').value,
                        activityName: document.getElementById('activityName').value,
                    };
                    const result = await apiFetch('/api/set-presence', { method: 'POST', body: JSON.stringify(payload) });
                    showToast('Presence updated successfully!', 'success');
                } catch (error) {
                    showToast('Error updating presence: ' + error.message, 'error');
                } finally {
                    updatePresenceBtn.disabled = false;
                    updatePresenceBtn.innerHTML = btnOriginalText;
                }
            });

            sendMessageBtn.addEventListener('click', async () => {
                 const btnOriginalText = sendMessageBtn.innerHTML;
                sendMessageBtn.disabled = true;
                sendMessageBtn.innerHTML = '<div class="spinner"></div> Sending...';
                 try {
                    const payload = {
                        channelId: document.getElementById('channelId').value,
                        message: document.getElementById('messageContent').value,
                    };
                    if(!payload.channelId || !payload.message) {
                        throw new Error('Channel ID and message are required.');
                    }
                    const result = await apiFetch('/api/send-test-message', { method: 'POST', body: JSON.stringify(payload) });
                    showToast(result.message, 'success');
                } catch (error) {
                    showToast('Error sending message: ' + error.message, 'error');
                } finally {
                    sendMessageBtn.disabled = false;
                    sendMessageBtn.innerHTML = btnOriginalText;
                }
            });
        });
    </script>
</body>
</html>
`;