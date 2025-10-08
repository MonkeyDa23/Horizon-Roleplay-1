import React, { useState, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { getMtaPlayerLogs } from '../lib/api';
import type { MtaLogEntry } from '../types';
import { Loader2, History, AlertTriangle } from 'lucide-react';

interface MtaLogsPanelProps {
    userId: string;
}

const MtaLogsPanel: React.FC<MtaLogsPanelProps> = ({ userId }) => {
    const { t } = useLocalization();
    const [logs, setLogs] = useState<MtaLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const fetchedLogs = await getMtaPlayerLogs(userId);
                setLogs(fetchedLogs);
            } catch (err) {
                setError(t('error_loading_logs'));
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [userId, t]);

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <Loader2 size={32} className="animate-spin text-brand-cyan" />
                    <p className="mt-4">{t('loading_logs')}</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-48 text-red-400">
                    <AlertTriangle size={32} />
                    <p className="mt-4 font-semibold">{error}</p>
                </div>
            );
        }

        if (logs.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <History size={32} />
                    <p className="mt-4">{t('no_logs_found_for_player')}</p>
                </div>
            );
        }

        return (
            <div className="space-y-3 max-h-96 overflow-y-auto p-1 pr-3">
                {logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                        <p className="text-gray-500 flex-shrink-0 w-28 text-right font-mono text-xs pt-1">
                            {new Date(log.timestamp).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </p>
                        <div className="w-px bg-brand-light-blue/50 self-stretch"></div>
                        <p className="text-gray-300">{log.text}</p>
                    </div>
                ))}
            </div>
        );
    };
    
    return (
        <div>
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                <History className="text-brand-cyan" />
                {t('mta_player_logs')}
            </h3>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 p-4">
                {renderContent()}
            </div>
        </div>
    );
};

export default MtaLogsPanel;