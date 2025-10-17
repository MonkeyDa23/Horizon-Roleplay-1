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
    const lastValidationTime = useRef<number>(0);
    const isValidating = useRef(false);

    useEffect(() => {
        if (!user) {
            previousUser.current = null;
            return;
        }

        const validate = async () => {
            if (isValidating.current) return;
            isValidating.current = true;
            try {
                const freshUser = await revalidateSession();
                
                // FIX: Replaced non-existent 'isSuperAdmin' with a check on the 'permissions' set.
                if (freshUser.isAdmin !== user.isAdmin || freshUser.permissions.has('_super_admin') !== user.permissions.has('_super_admin')) {
                    
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
            } finally {
                lastValidationTime.current = Date.now();
                isValidating.current = false;
            }
        };
        
        const handleFocus = () => {
            // Only revalidate on focus if it hasn't been done in the last 5 minutes
            if (Date.now() - lastValidationTime.current > 300000) {
                validate();
            }
        };

        window.addEventListener('focus', handleFocus);
        
        // A much less aggressive interval for background polling to avoid rate limits.
        const intervalId = setInterval(validate, 300000); // 5 minutes

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };

    }, [user, updateUser, logout, showToast, t]);

    useEffect(() => {
        previousUser.current = user;
    }, [user]);

    return null; // This component does not render anything
};

export default SessionWatcher;