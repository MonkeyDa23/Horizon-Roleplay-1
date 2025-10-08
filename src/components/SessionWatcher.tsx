import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useLocalization } from '../hooks/useLocalization';
import { revalidateSession, ApiError } from '../lib/api';
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

        const validate = async () => {
            try {
                const freshUser = await revalidateSession();
                
                // Only update and notify if there's an actual change in permissions
                if (freshUser.isSuperAdmin !== user.isSuperAdmin || freshUser.isAdmin !== user.isAdmin) {
                    
                    if (freshUser.isAdmin && !user.isAdmin) {
                        showToast(t('admin_granted'), 'success');
                    } else if (!freshUser.isAdmin && user.isAdmin) {
                        showToast(t('admin_revoked'), 'info');
                    }

                    updateUser(freshUser);
                }
            } catch (error) {
                console.error("Background session validation failed:", error);
                if (error instanceof ApiError && (error.status === 404 || error.status === 401)) {
                    showToast(t('session_expired_not_in_guild'), 'error');
                    logout();
                }
            }
        };
        
        // A 7-second interval is a stable compromise that avoids Discord API rate limits
        // while still providing reasonably fast role updates for users.
        const intervalId = setInterval(validate, 7000);

        return () => clearInterval(intervalId);

    }, [user, updateUser, logout, showToast, t]);

    // Keep track of the user state between intervals to compare against the fresh data
    useEffect(() => {
        previousUser.current = user;
    }, [user]);

    return null; // This component does not render anything
};

export default SessionWatcher;