import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useLocalization } from '../hooks/useLocalization';
import { revalidateSession, ApiError } from '../lib/api';

const SessionWatcher = () => {
    const { user, updateUser, logout } = useAuth();
    const { showToast } = useToast();
    const { t } = useLocalization();
    const lastValidationTime = useRef<number>(0);
    const isValidating = useRef(false);

    useEffect(() => {
        if (!user) {
            return;
        }

        const validate = async () => {
            if (isValidating.current) return;
            isValidating.current = true;
            try {
                const freshUser = await revalidateSession();
                
                // Compare permission sets to detect changes
                const oldPerms = user.permissions;
                const newPerms = freshUser.permissions;
                if (oldPerms.size !== newPerms.size || ![...oldPerms].every(p => newPerms.has(p))) {
                    if (newPerms.has('admin_panel') && !oldPerms.has('admin_panel')) {
                        showToast(t('admin_granted'), 'success');
                    } else if (!newPerms.has('admin_panel') && oldPerms.has('admin_panel')) {
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
            if (Date.now() - lastValidationTime.current > 60000) { // 1 minute
                validate();
            }
        };

        window.addEventListener('focus', handleFocus);
        const intervalId = setInterval(validate, 60000); // 1 minute

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };

    }, [user, updateUser, logout, showToast, t]);

    return null;
};

export default SessionWatcher;
