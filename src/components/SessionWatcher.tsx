
import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useLocalization } from '../hooks/useLocalization';
import { revalidateSession, ApiError } from '../lib/api';

const SessionWatcher = () => {
    const { user, updateUser, logout } = useAuth();
    const { showToast } = useToast();
    const { t } = useLocalization();
    const lastValidationTime = useRef<number>(Date.now());
    const isValidating = useRef(false);

    useEffect(() => {
        // FIX: Guard against window access in non-browser environments.
        if (!user || typeof window === 'undefined') {
            return;
        }

        const validate = async () => {
            if (isValidating.current) return;
            isValidating.current = true;
            try {
                const freshUser = await revalidateSession();
                
                const hadAdminAccess = (user.permissions || []).indexOf('admin_panel') !== -1;
                const nowHasAdminAccess = (freshUser.permissions || []).indexOf('admin_panel') !== -1;

                if (hadAdminAccess !== nowHasAdminAccess) {
                    if (nowHasAdminAccess) {
                        showToast(t('admin_granted'), 'success');
                    } else {
                        showToast(t('admin_revoked'), 'info');
                    }
                }
                // Also update user if roles/permissions changed to keep UI in sync
                if (JSON.stringify(user.permissions) !== JSON.stringify(freshUser.permissions)) {
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
            // Only re-validate if it's been more than 60 seconds since the last check
            if (Date.now() - lastValidationTime.current > 60000) { 
                validate();
            }
        };

        window.addEventListener('focus', handleFocus);
        // Keep a periodic check as a fallback (e.g., every 5 minutes)
        const intervalId = setInterval(validate, 5 * 60 * 1000); 

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };

    }, [user, updateUser, logout, showToast, t]);

    return null;
};

export default SessionWatcher;
