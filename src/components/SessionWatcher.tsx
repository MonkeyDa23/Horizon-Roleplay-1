
import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useLocalization } from '../hooks/useLocalization';
import { revalidateSession, ApiError } from '../lib/api';
import { useNavigate } from 'react-router-dom';

const SessionWatcher = () => {
    const { user, updateUser, logout, hasPermission } = useAuth();
    const { showToast } = useToast();
    const { t } = useLocalization();
    const navigate = useNavigate();
    const lastValidationTime = useRef<number>(Date.now());
    const isValidating = useRef(false);

    useEffect(() => {
        if (!user) {
            return;
        }

        const validate = async () => {
            if (isValidating.current) return;
            isValidating.current = true;
            try {
                const { user: freshUser, syncError } = await revalidateSession();
                if (syncError) {
                    // Silently log sync errors in the background, don't disrupt user
                    console.warn("Background sync warning:", syncError);
                }
                
                const hadAdminAccess = hasPermission('admin_panel');
                // Temporarily update user to check new permissions
                const nowHasAdminAccess = freshUser.permissions.includes('_super_admin') || freshUser.permissions.includes('admin_panel');

                // Update global user state silently
                updateUser(freshUser);

                if (hadAdminAccess && !nowHasAdminAccess) {
                    showToast(t('admin_revoked'), 'warning');
                    navigate('/'); // Navigate to home if admin access is lost
                } else if (!hadAdminAccess && nowHasAdminAccess) {
                    showToast(t('admin_granted'), 'success');
                }

            } catch (error) {
                console.error("Background session validation failed:", error);
                // If the error indicates the user is gone (404) or session is invalid (401), log them out.
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
            // Re-validate if it has been more than 2 minutes since the last check
            if (Date.now() - lastValidationTime.current > 120000) { 
                validate();
            }
        };

        // Run validation every 5 minutes in the background
        const intervalId = setInterval(validate, 300000); 
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };

    }, [user, updateUser, logout, showToast, t, navigate, hasPermission]);

    return null;
};

export default SessionWatcher;
