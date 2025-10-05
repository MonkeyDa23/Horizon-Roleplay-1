import React, { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { CONFIG } from '../lib/config';
import type { User } from '../types';

// ===================================================================================
// --- SIMULATED BACKEND: OAUTH2 CALLBACK HANDLER ---
// ===================================================================================
// This page's entire purpose is to act like a backend server after a user
// authorizes the app on Discord. It fixes the "Invalid authentication request" bug
// by correctly validating the state from localStorage and handling the HashRouter URL.
//
// IN A REAL, SECURE APPLICATION:
// 1. Discord would redirect to a real backend URL (e.g., `https://api.yourdomain.com/auth/discord/callback?code=...`).
// 2. The backend would take the `code` and securely exchange it for an `access_token`.
// 3. Using the token, it would fetch user identity and guild-specific roles.
// 4. The backend would then create a secure session (e.g., JWT) for the frontend.
//
// This component SIMULATES this flow for demonstration purposes and provides a clear
// roadmap for a backend developer.
// ===================================================================================

const AuthCallbackPage: React.FC = () => {
    const [status, setStatus] = useState('Processing login...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const processAuth = async () => {
            // For HashRouter, params are in the hash part of the URL after '?'.
            const paramsString = window.location.hash.split('?')[1];
            if (!paramsString) {
                 setError('Invalid authentication request. No parameters found.');
                 return;
            }
            
            const params = new URLSearchParams(paramsString);
            const code = params.get('code');
            const state = params.get('state');
            
            // Get state from localStorage, which is shared between the main window and popup.
            const storedState = localStorage.getItem('oauth_state');

            // --- Step 1: Validate the request (CRITICAL FIX) ---
            if (!code || !state || state !== storedState) {
                const errorMessage = 'Invalid authentication request. Please try logging in again.';
                setError(errorMessage);
                if (window.opener) {
                   window.opener.postMessage({ type: 'auth-error', error: errorMessage }, window.location.origin);
                   window.close();
                }
                return;
            }
            localStorage.removeItem('oauth_state');

            try {
                // --- Step 2: (SIMULATED) Exchange code for access token ---
                setStatus('Verifying identity...');
                await new Promise(resolve => setTimeout(resolve, 500));
                // In a real backend:
                // const tokenResponse = await fetch('https://discord.com/api/oauth2/token', { ... });
                // const { access_token } = await tokenResponse.json();

                // --- Step 3: (SIMULATED) Fetch user identity ---
                setStatus('Fetching user profile...');
                await new Promise(resolve => setTimeout(resolve, 500));
                // In a real backend:
                // const userResponse = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
                // const userData = await userResponse.json();
                
                // MOCKING for demo purposes
                const mockUserData = {
                    id: '1328693484798083183',
                    username: 'AdminUser',
                    avatar: '1a2b3c4d5e6f7g8h9i0j'
                };

                // --- Step 4: (SIMULATED) Check if user is an admin ---
                setStatus('Checking permissions...');
                await new Promise(resolve => setTimeout(resolve, 500));
                // In a real backend, you would fetch the user's roles for your specific guild:
                // const guildMemberResponse = await fetch(`https://discord.com/api/guilds/${CONFIG.DISCORD_SERVER_ID}/members/${userData.id}`, { ... });
                // const guildMemberData = await guildMemberResponse.json();
                // const userRoleIds = guildMemberData.roles;
                // const isAdmin = userRoleIds.some(roleId => CONFIG.ADMIN_ROLE_IDS.includes(roleId));

                // MOCKING for demo purposes
                const isAdmin = mockUserData.id === "1328693484798083183";
                
                // --- Step 5: Construct the final User object ---
                const finalUser: User = {
                    id: mockUserData.id,
                    username: mockUserData.username,
                    avatar: `https://cdn.discordapp.com/avatars/${mockUserData.id}/${mockUserData.avatar}.png`,
                    isAdmin: isAdmin,
                };

                // --- Step 6: Send the user data back to the main window and close ---
                if (window.opener) {
                    window.opener.postMessage({ type: 'auth-success', user: finalUser }, window.location.origin);
                    window.close();
                } else {
                     setError("Could not communicate with the main application window.");
                }

            } catch (e) {
                const errorMessage = "An unexpected error occurred during login.";
                console.error("Auth processing error:", e);
                setError(errorMessage);
                 if (window.opener) {
                   window.opener.postMessage({ type: 'auth-error', error: errorMessage }, window.location.origin);
                   setTimeout(() => window.close(), 3000);
                }
            }
        };

        processAuth();
    }, []);
    
    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark text-white p-4 text-center">
            <Loader size={48} className="text-brand-cyan animate-spin" />
            <p className="mt-4 text-lg font-semibold">{error || status}</p>
            {!error && <p className="text-gray-400 text-sm">Please wait, this window will close automatically.</p>}
            {error && <button onClick={() => window.close()} className="mt-4 bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded">Close</button>}
        </div>
    );
};

export default AuthCallbackPage;
