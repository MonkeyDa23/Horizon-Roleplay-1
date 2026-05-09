/**
 * Nova Roleplay - Official Website
 * Admin Security Monitoring Panel
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, Clock, User, Globe, Activity, Search, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useConfig } from '../../contexts/ConfigContext';

interface SecurityEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  ip_address: string;
  user_agent: string;
  details: any;
  created_at: string;
  profiles?: {
    username: string;
    discord_id: string;
  };
}

const SecurityPanel: React.FC = () => {
  const { t, language } = useLocalization();
  const isArabic = language === 'ar';
  const { branding } = useConfig();
  
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'>('ALL');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('security_events')
        .select('*, profiles(username, discord_id)', { count: 'exact' });

      if (severityFilter !== 'ALL') {
        query = query.eq('severity', severityFilter);
      }

      if (searchTerm) {
        query = query.or(`event_type.ilike.%${searchTerm}%,ip_address.ilike.%${searchTerm}%`);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;
      setEvents(data as any[] || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching security events:', error);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, page, searchTerm, pageSize]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const getSeverityIcon = (severity: string, size = 20) => {
    switch (severity) {
      case 'CRITICAL': return <ShieldAlert className="text-red-500" size={size} />;
      case 'WARNING': return <AlertTriangle className="text-yellow-500" size={size} />;
      default: return <ShieldCheck className="text-blue-500" size={size} />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const base = "px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2.5 shadow-sm";
    switch (severity) {
      case 'CRITICAL':
        return <span className={`${base} bg-red-500/10 text-red-500 border border-red-500/20`}>{getSeverityIcon(severity, 18)} {severity}</span>;
      case 'WARNING':
        return <span className={`${base} bg-yellow-500/10 text-yellow-500 border border-yellow-500/20`}>{getSeverityIcon(severity, 18)} {severity}</span>;
      default:
        return <span className={`${base} bg-blue-500/10 text-blue-500 border border-blue-500/20`}>{getSeverityIcon(severity, 18)} {severity}</span>;
    }
  };

  return (
    <div className="space-y-10" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] flex items-center gap-6 shadow-xl">
          <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/10 shadow-inner">
            <Activity className="text-blue-500" size={32} />
          </div>
          <div>
            <div className="text-4xl font-black text-white">{totalCount}</div>
            <div className="text-text-secondary text-xs uppercase font-black tracking-widest mt-1">{t('total_events')}</div>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] flex items-center gap-6 shadow-xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center border border-red-500/10 shadow-inner">
            <ShieldAlert className="text-red-500" size={32} />
          </div>
          <div>
            <div className="text-4xl font-black text-white">{events.filter(e => e.severity === 'CRITICAL').length}</div>
            <div className="text-text-secondary text-xs uppercase font-black tracking-widest mt-1">{t('critical_threats')}</div>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] flex items-center gap-6 shadow-xl">
          <div className="w-16 h-16 bg-brand-cyan/10 rounded-3xl flex items-center justify-center border border-brand-cyan/10 shadow-inner">
            <ShieldCheck style={{ color: branding.primaryColor }} size={32} />
          </div>
          <div>
            <div className="text-4xl font-black text-white">Active</div>
            <div className="text-text-secondary text-xs uppercase font-black tracking-widest mt-1">{t('security_status')}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[40px] flex flex-col md:flex-row gap-6 items-center justify-between shadow-2xl backdrop-blur-xl">
        <form onSubmit={handleSearch} className="relative w-full md:max-w-md">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary opacity-40" size={24} />
          <input 
            type="text" 
            placeholder={t('search_logs')} 
            className="w-full bg-white/5 border border-white/10 rounded-[24px] py-4 pl-16 pr-6 text-lg text-white focus:border-white/20 outline-none transition-all shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>

        <div className="flex items-center gap-3">
          {(['ALL', 'INFO', 'WARNING', 'CRITICAL'] as const).map(sev => (
            <button 
              key={sev} 
              onClick={() => { setSeverityFilter(sev); setPage(1); }}
              className={`px-6 py-3 rounded-2xl text-xs font-black transition-all ${severityFilter === sev ? 'bg-white text-brand-dark shadow-xl scale-105' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
            >
              {sev}
            </button>
          ))}
          <button 
            onClick={() => fetchEvents()} 
            disabled={loading}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-text-secondary transition-all active:scale-95 border border-white/5"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={24} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01]">
                <th className="px-8 py-6 text-xs font-black uppercase text-text-secondary tracking-widest">{t('event')}</th>
                <th className="px-8 py-6 text-xs font-black uppercase text-text-secondary tracking-widest">{t('applicant')}</th>
                <th className="px-8 py-6 text-xs font-black uppercase text-text-secondary tracking-widest">{t('severity')}</th>
                <th className="px-8 py-6 text-xs font-black uppercase text-text-secondary tracking-widest">{t('ip_client')}</th>
                <th className="px-8 py-6 text-xs font-black uppercase text-text-secondary tracking-widest">{t('submitted_on')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-8"><div className="h-16 bg-white/5 rounded-3xl w-full"></div></td>
                  </tr>
                ))
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-32 text-center text-text-secondary">
                    <div className="flex flex-col items-center gap-6">
                      <Shield size={80} className="opacity-5" />
                      <p className="text-2xl font-black">{t('no_security_logs')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-8">
                      <div className="font-black text-white text-lg mb-1">{event.event_type}</div>
                      <div className="text-xs text-text-secondary truncate max-w-[300px] opacity-60 font-mono" title={JSON.stringify(event.details)}>
                        {JSON.stringify(event.details)}
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      {event.profiles ? (
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black text-lg border border-white/5" style={{ color: branding.primaryColor }}>
                            {event.profiles.username?.[0] || 'U'}
                          </div>
                          <div>
                            <div className="text-base font-black text-white leading-none mb-1">{event.profiles.username}</div>
                            <div className="text-xs text-text-secondary font-mono opacity-60">{event.profiles.discord_id}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 opacity-40">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black text-lg border border-white/5">S</div>
                          <span className="text-text-secondary text-sm font-black italic">System / Unknown</span>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-8">
                      {getSeverityBadge(event.severity)}
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex items-center gap-3 text-white font-black">
                        <Globe size={20} className="text-text-secondary opacity-40" />
                        <span className="text-sm font-mono tracking-wider">{event.ip_address || '---.---.---.---'}</span>
                      </div>
                      <div className="text-[10px] text-text-secondary opacity-30 mt-2 truncate max-w-[200px] font-medium italic">
                        {event.user_agent}
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex items-center gap-3 text-text-secondary font-black">
                        <Clock size={20} className="opacity-40" />
                        <span className="text-sm">{new Date(event.created_at).toLocaleString(isArabic ? 'ar' : 'en')}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-10 py-8 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
          <div className="text-sm text-text-secondary font-black">
            {isArabic ? `عرض ${events.length} من أصل ${totalCount}` : `Showing ${events.length} of ${totalCount}`}
          </div>
          <div className="flex items-center gap-4">
            <button 
              disabled={page === 1 || loading} 
              onClick={() => setPage(p => p - 1)} 
              className="p-4 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-2xl text-white transition-all active:scale-90 border border-white/5"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl font-black text-white border border-white/10 shadow-inner">
               {page}
            </div>
            <button 
              disabled={page * pageSize >= totalCount || loading} 
              onClick={() => setPage(p => p + 1)} 
              className="p-4 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-2xl text-white transition-all active:scale-90 border border-white/5"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityPanel;
