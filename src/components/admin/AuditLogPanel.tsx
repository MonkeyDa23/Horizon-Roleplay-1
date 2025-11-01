// src/components/admin/AuditLogPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getAuditLogs } from '../../lib/api';
import type { AuditLogEntry } from '../../types';
import { Loader2 } from 'lucide-react';

const Panel: React.FC<{ children: React.ReactNode; isLoading: boolean, loadingText: string }> = ({ children, isLoading, loadingText }) => {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 justify-center items-center py-20 min-h-[300px]">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
                <p className="text-gray-400">{loadingText}</p>
            </div>
        );
    }
    return <div className="animate-fade-in-up">{children}</div>;
}

const AuditLogPanel: React.FC = () => {
    const { t } = useLocalization();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            setLogs(await getAuditLogs());
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    return (
        <Panel isLoading={isLoading} loadingText={t('loading_audit_logs')}>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="border-b border-brand-light-blue/50 text-gray-300 bg-brand-light-blue/30">
                            <tr>
                                <th className="p-4">{t('log_timestamp')}</th>
                                <th className="p-4">{t('log_admin')}</th>
                                <th className="p-4">{t('log_action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length > 0 ? logs.map(log => (
                                <tr key={log.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/20 transition-colors">
                                    <td className="p-4 text-sm text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="p-4 font-semibold text-white">{log.admin_username}</td>
                                    <td className="p-4 text-gray-300">{log.action}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan={3} className="p-8 text-center text-gray-400">{t('no_logs_found')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Panel>
    );
};

export default AuditLogPanel;
