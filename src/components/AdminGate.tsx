// src/components/AdminGate.tsx
import React, { useState } from 'react';
import { useAdminGate } from '../contexts/AdminGateContext';
import { useConfig } from '../hooks/useConfig';
import { useLocalization } from '../hooks/useLocalization';
import { useToast } from '../hooks/useToast';
import { verifyAdminPassword } from '../lib/api';
import Modal from './Modal';
import { Loader2, KeyRound } from 'lucide-react';

const AdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isVerified, verify } = useAdminGate();
    const { config } = useConfig();
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // If no password is set in the config, or if the user is already verified, grant access.
    if (!config.admin_password || isVerified) {
        return <>{children}</>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const success = await verifyAdminPassword(password);
            if (success) {
                verify();
            } else {
                showToast(t('admin_gate_incorrect'), 'error');
                setPassword('');
            }
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Modal isOpen={true} onClose={() => {}} title={t('admin_gate_title')}>
            <div className="text-center">
                <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-brand-light-blue mb-6">
                    <KeyRound className="w-8 h-8 text-brand-cyan"/>
                </div>
                <p className="text-gray-300 mb-6">{t('admin_gate_prompt')}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="admin-password" className="sr-only">{t('admin_gate_password')}</label>
                        <input
                            id="admin-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.currentTarget.value)}
                            className="w-full bg-brand-light-blue p-3 rounded-md border border-gray-600 text-center text-lg tracking-widest"
                            autoFocus
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={isLoading || !password}
                        className="w-full bg-brand-cyan text-brand-dark font-bold py-3 rounded-lg shadow-glow-cyan hover:bg-white transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : t('admin_gate_enter')}
                    </button>
                </form>
            </div>
        </Modal>
    );
};

export default AdminGate;