import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useLocalization } from '../hooks/useLocalization';
// FIX: Corrected import path for revalidateSession.
import { revalidateSession } from '../lib/api';
import type { User } from '../types';

const SessionWatcher = () => {
    // FIX: Added updateUser to correctly update session state.
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
                // The user object from context might be stale, so use the ref which is updated more frequently.
                const userToValidate = previousUser.current;
                if (!userToValidate) return;

                const freshUser = await revalidateSession(userToValidate);
                
                // Only proceed if there's an actual change
                if (JSON.stringify(freshUser) !== JSON.stringify(userToValidate)) {
                    
                    // Check for specific changes to show toasts
                    if (freshUser.isAdmin && !userToValidate?.isAdmin) {
                        showToast(t('admin_granted'), 'success');
                    } else if (!freshUser.isAdmin && userToValidate?.isAdmin) {
                        showToast(t('admin_revoked'), 'info');
                    // FIX: Check for primaryRole changes based on the updated User type.
                    } else if (freshUser.primaryRole?.id !== userToValidate?.primaryRole?.id) {
                        showToast(t('role_updated', { roleName: freshUser.primaryRole?.name || 'Member' }), 'info');
                    }

                    updateUser(freshUser);
                }
            } catch (error) {
                console.error("Background session validation failed:", error);
                const errorStatus = (error as any)?.status;
                // If user is not found in guild or unauthorized, log them out.
                if (errorStatus === 404 || errorStatus === 403) {
                    showToast(t('session_expired_not_in_guild'), 'error');
                    logout();
                }
            }
        };
        
        // A 7-second interval is a stable compromise that avoids Discord API rate limits
        // while still providing reasonably fast role updates for users.
        const intervalId = setInterval(validateSession, 7000); // Check every 7 seconds

        return () => clearInterval(intervalId);

    }, [user?.id, updateUser, logout, showToast, t]);

    // Keep track of the user state between intervals to compare against the fresh data
    useEffect(() => {
        previousUser.current = user;
    }, [user]);

    return null; // This component does not render anything
};

export default SessionWatcher;
