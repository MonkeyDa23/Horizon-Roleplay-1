import React, { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { CONFIG } from '../lib/config';
import type { User, DiscordRole } from '../types';
import { MOCK_DISCORD_ROLES, MOCK_GUILD_MEMBERS } from '../lib/mockData';

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
                 if (window.opener) {
                   window.opener.postMessage({ type: 'auth-error', error: 'Invalid authentication request. No parameters found.' }, window.location.origin);
                   window.close();
                 }
                 return;
            }
            
            const params = new URLSearchParams(paramsString);
            const code = params.get('code');
            const state = params.get('state');
            
            // Get state from localStorage, which is shared between the main window and popup.
            const storedState = localStorage.getItem('oauth_state');

            // --- Step 1: Validate the request (CRITICAL FIX) ---
            if (!code || !state || state !== storedState) {
                const errorMessage = 'Invalid authentication state. Please try logging in again.';
                setError(errorMessage);
                if (window.opener) {
                   window.opener.postMessage({ type: 'auth-error', error: errorMessage }, window.location.origin);
                   window.close();
                }
                return;
            }
            localStorage.removeItem('oauth_state');

            try {
                // --- Step 2 & 3: (SIMULATED) Exchange code & fetch user identity ---
                setStatus('Verifying identity & fetching profile...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // In this simulation, we'll cycle through our mock users on each login
                // to make testing different roles (admin, vip, member) easier.
                const mockUserIds = Object.keys(MOCK_GUILD_MEMBERS);
                const loginCount = parseInt(localStorage.getItem('login_count') || '0', 10);
                const mockUserId = mockUserIds[loginCount % mockUserIds.length];
                localStorage.setItem('login_count', (loginCount + 1).toString());


                // --- Step 4: (SIMULATED) Fetch guild-specific info (roles) ---
                setStatus('Checking server roles...');
                await new Promise(resolve => setTimeout(resolve, 500));

                const mockGuildMember = MOCK_GUILD_MEMBERS[mockUserId];
                let isAdmin = false;
                let primaryRole: DiscordRole | undefined = undefined;

                if (!mockGuildMember) {
                    throw new Error(`Mock data for user ID ${mockUserId} not found in mockData.ts.`);
                }

                const userRoleIds = new Set(mockGuildMember.roles);

                // Determine admin status by checking if any of the user's roles are in the admin list
                isAdmin = CONFIG.ADMIN_ROLE_IDS.some(adminRoleId => userRoleIds.has(adminRoleId));

                // Determine the user's primary role by finding their highest-positioned role
                const userRoles = MOCK_DISCORD_ROLES
                    .filter(role => userRoleIds.has(role.id))
                    .sort((a, b) => b.position - a.position); // Sort descending by position

                if (userRoles.length > 0) {
                    const highestRole = userRoles[0];
                    primaryRole = {
                        id: highestRole.id,
                        name: highestRole.name,
                        color: highestRole.color,
                    };
                }

                // --- Step 5: Construct the final User object ---
                const finalUser: User = {
                    id: mockUserId,
                    username: mockGuildMember.username,
                    avatar: mockGuildMember.avatar,
                    isAdmin: isAdmin,
                    primaryRole: primaryRole,
                };

                // --- Step 6: Send the user data back to the main window and close ---
                if (window.opener) {
                    window.opener.postMessage({ type: 'auth-success', user: finalUser }, window.location.origin);
                    window.close();
                } else {
                     setError("Could not communicate with the main application window.");
                }

            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during login.";
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