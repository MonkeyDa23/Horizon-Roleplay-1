import React, { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { getDiscordRoles } from '../lib/api';
import type { User } from '../types';
import { useConfig } from '../hooks/useConfig';

// These constants are copied from AuthContext.
const MOCK_ADMIN_ID = "1423683069893673050"; 
const PERMISSIONS = {
  ADMINISTRATOR: (1 << 3), // 8 or 0x8
};

const AuthCallbackPage: React.FC = () => {
    const { config, configLoading } = useConfig();
    const [message, setMessage] = useState('Processing login...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (configLoading) {
            return;
        }

        const handleAuthCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const state = params.get('state');

            if (!window.opener || !code || !state) {
                setError('Invalid request. This window will close shortly.');
                setTimeout(() => window.close(), 3000);
                return;
            }

            try {
                const storedState = sessionStorage.getItem('oauth_state');

                if (state !== storedState) {
                    window.opener.postMessage({ type: 'auth-error', error: 'Invalid OAuth state.' }, window.location.origin);
                    window.close();
                    return;
                }
                
                sessionStorage.removeItem('oauth_state');
                
                // --- MOCK API CALLS for Discord data ---
                try {
                    // In a real app, you'd exchange the code for a token on your backend.
                    // Here, we simulate fetching user data since we have the "code".
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const mockBasicUser = {
                        id: MOCK_ADMIN_ID,
                        username: 'AdminUser',
                        avatar: '1a2b3c4d5e6f7g8h9i0j',
                    };

                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Mock role and permission check
                    const mockGuildMember = { roles: ['role_admin_123'] };
                    const mockGuildRoles = [
                        { id: 'role_admin_123', name: 'Server Admin', permissions: PERMISSIONS.ADMINISTRATOR.toString() },
                    ];
                    let userIsAdmin = false;
                    for (const userRoleId of mockGuildMember.roles) {
                        const roleDetails = mockGuildRoles.find(r => r.id === userRoleId);
                        if (roleDetails) {
                            const permissions = parseInt(roleDetails.permissions, 10);
                            if ((permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR) {
                                userIsAdmin = true;
                                break;
                            }
                        }
                    }

                    const discordRoles = await getDiscordRoles(mockBasicUser.id);
                    const roles = discordRoles.map(r => r.id);
                    const superAdminRoles = config.SUPER_ADMIN_ROLE_IDS || [];
                    const isSuperAdmin = roles.some(roleId => superAdminRoles.includes(roleId));

                    const finalUser: User = {
                        id: mockBasicUser.id,
                        username: mockBasicUser.username,
                        avatar: `https://cdn.discordapp.com/avatars/${mockBasicUser.id}/${mockBasicUser.avatar}.png`,
                        isAdmin: userIsAdmin,
                        isSuperAdmin: isSuperAdmin,
                        discordRoles: discordRoles,
                        roles: roles,
                    };
                    window.opener.postMessage({ type: 'auth-success', user: finalUser }, window.location.origin);
                
                } catch (e) {
                    window.opener.postMessage({ type: 'auth-error', error: 'Failed to fetch user data.' }, window.location.origin);
                }

            } catch (sessionError) {
                console.error("Session Storage is not available.", sessionError);
                window.opener.postMessage({ type: 'auth-error', error: 'Session Storage is not available.' }, window.location.origin);
            } finally {
                setTimeout(() => window.close(), 500);
            }
        };

        handleAuthCallback();

    }, [config, configLoading]);

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center h-screen w-screen bg-brand-dark z-[100]">
            <Loader size={48} className="text-brand-cyan animate-spin" />
            <p className="mt-4 text-white text-lg">{error || message}</p>
            {!error && <p className="text-gray-400">Please wait, this window will close automatically.</p>}
        </div>
    );
};

export default AuthCallbackPage;
