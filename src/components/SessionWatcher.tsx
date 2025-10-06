import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useLocalization } from '../hooks/useLocalization';
import { revalidateSession } from '../lib/api';
import type { User } from '../types';

const SessionWatcher = () => {
    const { user, updateUser, logout } = useAuth();
    const { showToast } = useToast();
    const { t } = useLocalization();
    const previousUser = useRef<User | null>(user);

    useEffect(() => {
        if (!user) {
            previousUser.current = null;
            return;
        }

        const validateSession = async () => {
            try {
                // Ensure there is a user to validate before making an API call
                if (!previousUser.current) return;

                const freshUser = await revalidateSession(previousUser.current);
                
                // Only proceed if there's an actual change
                if (JSON.stringify(freshUser) !== JSON.stringify(previousUser.current)) {
                    
                    // Check for specific changes to show toasts
                    if (freshUser.isAdmin && !previousUser.current?.isAdmin) {
                        showToast(t('admin_granted'), 'success');
                    } else if (!freshUser.isAdmin && previousUser.current?.isAdmin) {
                        showToast(t('admin_revoked'), 'info');
                    } else if (freshUser.primaryRole?.id !== previousUser.current?.primaryRole?.id) {
                        showToast(t('role_updated', { roleName: freshUser.primaryRole?.name || 'Member' }), 'info');
                    }

                    updateUser(freshUser);
                }
            } catch (error) {
                console.error("Background session validation failed:", error);
                const errorString = error instanceof Error ? error.message : '';
                // If user is not found in guild or forbidden, log them out.
                if (errorString.includes('404') || errorString.includes('403')) {
                    showToast('Your session has expired as you are no longer in the Discord server.', 'error');
                    logout();
                }
            }
        };
        
        const intervalId = setInterval(validateSession, 30000); // Check every 30 seconds

        return () => clearInterval(intervalId);

    }, [user?.id, updateUser, logout, showToast, t]);

    // Keep track of the user state between intervals to compare against the fresh data
    useEffect(() => {
        previousUser.current = user;
    }, [user]);

    return null; // This component does not render anything
};

export default SessionWatcher;
