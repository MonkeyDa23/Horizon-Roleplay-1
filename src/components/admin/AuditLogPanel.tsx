/**
 * Nova Roleplay - Official Website
 * Admin Audit Log Panel
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { getAuditLogs } from '../../lib/api';
import type { AuditLogEntry } from '../../types';
import { Loader2, ShieldCheck, User, Clock, Search, RefreshCw, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

const AuditLogPanel: React.FC = () => {
    const { t, language } = useLocalization();
    const isArabic = language === 'ar';
    const { branding } = useConfig();
    const { showToast } = useToast();
    
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getAuditLogs();
            setLogs(data);
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const filteredLogs = logs.filter(log => 
        log.admin_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredLogs.length / pageSize);
    const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className="space-y-8 animate-fade-in-up" dir={isArabic ? 'rtl' : 'ltr'}>
            {/* Header Controls */}
            <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[40px] flex flex-col md:flex-row gap-6 items-center justify-between shadow-2xl backdrop-blur-xl">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary opacity-40" size={24} />
                    <input 
                        type="text" 
                        placeholder={t('search_logs')} 
                        className="w-full bg-white/5 border border-white/10 rounded-[24px] py-4 pl-16 pr-6 text-lg text-white focus:border-white/20 outline-none transition-all shadow-inner"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    />
                </div>

                <button 
                    onClick={fetchLogs} 
                    disabled={isLoading}
                    className="p-5 bg-white/5 hover:bg-white/10 rounded-2xl text-text-secondary transition-all active:scale-95 border border-white/5 flex items-center gap-3 font-black text-sm"
                >
                    <RefreshCw className={isLoading ? 'animate-spin' : ''} size={24} />
                    {t('refresh')}
                </button>
            </div>

            {/* Table Area */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-3xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.01]">
                                <th className="px-10 py-6 text-xs font-black uppercase text-text-secondary tracking-widest">{t('log_timestamp')}</th>
                                <th className="px-10 py-6 text-xs font-black uppercase text-text-secondary tracking-widest">{t('log_admin')}</th>
                                <th className="px-10 py-6 text-xs font-black uppercase text-text-secondary tracking-widest">{t('log_action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={3} className="px-10 py-8"><div className="h-14 bg-white/5 rounded-3xl w-full"></div></td>
                                    </tr>
                                ))
                            ) : paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-10 py-32 text-center text-text-secondary">
                                        <div className="flex flex-col items-center gap-6">
                                            <FileText size={80} className="opacity-5" />
                                            <p className="text-2xl font-black">{t('no_logs_found')}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-4 text-text-secondary group-hover:text-white transition-colors">
                                                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <Clock size={20} />
                                                </div>
                                                <span className="text-sm font-black font-mono">{new Date(log.timestamp).toLocaleString(isArabic ? 'ar' : 'en')}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black text-lg border border-white/5" style={{ color: branding.primaryColor }}>
                                                    {log.admin_username?.[0] || 'A'}
                                                </div>
                                                <div className="text-base font-black text-white">{log.admin_username}</div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <p className="text-lg text-gray-300 font-medium leading-relaxed max-w-2xl">{log.action}</p>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-10 py-10 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
                        <div className="text-sm text-text-secondary font-black">
                            {isArabic ? `عرض صفحة ${page} من ${totalPages}` : `Showing page ${page} of ${totalPages}`}
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                disabled={page === 1 || isLoading} 
                                onClick={() => setPage(p => p - 1)} 
                                className="p-4 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-2xl text-white transition-all active:scale-90 border border-white/5"
                            >
                                <ChevronLeft size={24} className={isArabic ? 'rotate-180' : ''} />
                            </button>
                            <div className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl font-black text-white border border-white/10 shadow-inner">
                                {page}
                            </div>
                            <button 
                                disabled={page >= totalPages || isLoading} 
                                onClick={() => setPage(p => p + 1)} 
                                className="p-4 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-2xl text-white transition-all active:scale-90 border border-white/5"
                            >
                                <ChevronRight size={24} className={isArabic ? 'rotate-180' : ''} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogPanel;
