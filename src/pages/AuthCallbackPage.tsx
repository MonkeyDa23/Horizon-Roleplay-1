import React, { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { CONFIG } from '../lib/config';
import type { User, DiscordRole } from '../types';
import { MOCK_DISCORD_ROLES, MOCK_GUILD_MEMBERS } from '../lib/mockData';

// ===================================================================================
// --- SIMULATED BACKEND: OAUTH2 CALLBACK HANDLER ---
// ===================================================================================
// This page's entire purpose is to act like a backend server after a user
// authorizes the app on Discord. It now correctly handles clean URLs from BrowserRouter.
//
// IN A REAL, SECURE APPLICATION:
// 1. Discord would redirect to a real backend URL (e.g., `https://api.yourdomain.com/auth/discord/callback?code=...`).
// 2. The backend would take the `code` and securely exchange it for an `access_token`.
// 3. Using the token, it would fetch user identity and guild-specific roles.
// 4. The backend would then create a secure session (e.g., JWT) for the frontend.
//
// This component SIMULATES this flow for demonstration purposes.
// ===================================================================================

const AuthCallbackPage: React.FC = () => {
    const [status, setStatus] = useState('Processing login...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const processAuth = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const state = params.get('state');
            const storedState = localStorage.getItem('oauth_state');

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
                // --- SIMULATION STEP ---
                // To provide a consistent development experience, we will always log in as the user
                // with the Founder/Admin role from our mock data.
                // To test a different user, change the ID below to another one from `src/lib/mockData.ts`.
                const mockUserId = '1328693484798083183';
                
                setStatus('Verifying identity & fetching roles...');
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                const mockGuildMember = MOCK_GUILD_MEMBERS[mockUserId];
                if (!mockGuildMember) {
                    throw new Error(`Mock data for user ID ${mockUserId} not found in mockData.ts.`);
                }
                
                const userRoleIds = new Set(mockGuildMember.roles);
                const isAdmin = CONFIG.ADMIN_ROLE_IDS.some(adminRoleId => userRoleIds.has(adminRoleId));

                const userRoles = MOCK_DISCORD_ROLES
                    .filter(role => userRoleIds.has(role.id))
                    .sort((a, b) => b.position - a.position);

                const primaryRole: DiscordRole | undefined = userRoles.length > 0 ? {
                    id: userRoles[0].id,
                    name: userRoles[0].name,
                    color: userRoles[0].color,
                } : undefined;

                const finalUser: User = {
                    id: mockUserId,
                    username: mockGuildMember.username,
                    avatar: mockGuildMember.avatar,
                    isAdmin: isAdmin,
                    primaryRole: primaryRole,
                };
                
                if (window.opener) {
                    window.opener.postMessage({ type: 'auth-success', user: finalUser }, window.location.origin);
                    window.close();
                } else {
                     setError("Could not communicate with the main application window.");
                }

            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
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
            {!error && <p className="text-gray-400 text-sm">This window will close automatically.</p>}
            {error && <button onClick={() => window.close()} className="mt-4 bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded">Close</button>}
        </div>
    );
};

export default AuthCallbackPage;
