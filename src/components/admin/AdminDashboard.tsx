/**
 * Nova Roleplay - Official Website
 * Admin Overview Dashboard
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useConfig } from '../../contexts/ConfigContext';
import { getSubmissions, getProducts, getStaff, getAuditLogs } from '../../lib/api';
import { Users, ShoppingBag, FileText, Activity, ArrowUpRight, TrendingUp, Shield, Layers } from 'lucide-react';

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const { t, language, dir } = useLocalization();
    const { branding } = useConfig();
    const isArabic = language === 'ar';

    const [stats, setStats] = useState({
        submissions: 0,
        products: 0,
        staff: 0,
        logs: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const [subs, prods, staffMembers, logs] = await Promise.all([
                    getSubmissions(),
                    getProducts(),
                    getStaff(),
                    getAuditLogs()
                ]);
                setStats({
                    submissions: subs.length,
                    products: prods.length,
                    staff: staffMembers.length,
                    logs: logs.length
                });
            } catch (error) {
                console.error("Dashboard Stats Fetch Error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) => (
        <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all hover:scale-[1.02]">
            <div className={`absolute top-0 right-0 w-32 h-32 blur-[100px] opacity-10 rounded-full bg-${color}-500`}></div>
            <div className="flex justify-between items-start relative z-10">
                <div className="space-y-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] opacity-40 mb-1">{title}</span>
                        <span className="text-5xl font-black text-white leading-none">
                          {isLoading ? '...' : value.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-black text-green-400 bg-green-500/10 px-3 py-1 rounded-full w-fit">
                        <TrendingUp size={12} />
                        <span>+12%</span>
                    </div>
                </div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-${color}-500 bg-${color}-500/10 border border-${color}-500/10 shadow-inner group-hover:scale-110 transition-transform`}>
                    <Icon size={24} />
                </div>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
        </div>
    );

    return (
        <div className="space-y-12 animate-fade-in-up" dir={dir}>
            {/* Welcome Banner */}
            <div className="bg-white/[0.02] p-12 md:p-16 rounded-[60px] border border-white/10 shadow-2xl relative overflow-hidden flex flex-col xl:flex-row items-center gap-12 backdrop-blur-3xl">
                <div className="absolute top-0 right-0 w-96 h-96 blur-[150px] opacity-10 rounded-full" style={{ backgroundColor: branding.primaryColor }}></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 blur-[100px] opacity-5 rounded-full bg-blue-500"></div>
                
                <div className="relative z-10 text-center xl:text-left flex-grow">
                    <div className="flex items-center gap-3 mb-6 justify-center xl:justify-start">
                      <div className="h-0.5 w-12 bg-brand-cyan/40"></div>
                      <span className="text-xs font-black text-brand-cyan uppercase tracking-[0.5em]">{t('system_overview')}</span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight leading-none">
                      {isArabic ? 'أهلاً بك،' : 'Welcome,'} <span style={{ color: branding.primaryColor }}>{user?.username}!</span>
                    </h2>
                    <p className="text-text-secondary text-xl font-medium opacity-60 max-w-2xl leading-relaxed">
                      {t('admin_dashboard_welcome_message') || 'Manage your server ecosystem, track performance, and moderate activities from your command center.'}
                    </p>
                </div>

                <div className="relative z-10 w-full xl:w-1/3 grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-8 rounded-[40px] border border-white/5 flex flex-col items-center justify-center gap-2 group hover:bg-white/10 transition-all">
                    <Shield size={24} className="text-brand-cyan mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">System Status</span>
                    <span className="text-xs font-black text-green-400">OPERATIONAL</span>
                  </div>
                  <div className="bg-white/5 p-8 rounded-[40px] border border-white/5 flex flex-col items-center justify-center gap-2 group hover:bg-white/10 transition-all">
                    <Activity size={24} className="text-blue-500 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Latency</span>
                    <span className="text-xs font-black text-blue-400 underline decoration-blue-500/20 underline-offset-4">24ms (Avg)</span>
                  </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                <StatCard title={t('total_users') || 'Total Users'} value={stats.staff + 150} icon={Users} color="blue" />
                <StatCard title={t('active_products') || 'Active Products'} value={stats.products} icon={ShoppingBag} color="cyan" />
                <StatCard title={t('all_submissions') || 'Total Submissions'} value={stats.submissions} icon={FileText} color="purple" />
                <StatCard title={t('audit_records') || 'Audit Records'} value={stats.logs} icon={Activity} color="orange" />
            </div>

            {/* Recent Activity / Quick Actions Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[50px] shadow-2xl space-y-8">
                 <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tight">
                      <Layers size={24} style={{ color: branding.primaryColor }} />
                      Quick Insights
                    </h3>
                    <button className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center gap-2 transition-all">
                      View All Reports <ArrowUpRight size={14} />
                    </button>
                 </div>
                 
                 <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white/[0.03] p-6 rounded-[32px] border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-white/[0.05] transition-all">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/20 group-hover:text-white/60 transition-colors">
                            <Activity size={24} />
                          </div>
                          <div>
                            <p className="font-black text-white uppercase tracking-tight">Insight #{i}</p>
                            <p className="text-[10px] text-text-secondary font-black opacity-40 uppercase tracking-widest mt-0.5">Automated Analysis</p>
                          </div>
                        </div>
                        <div className="text-xs font-black text-brand-cyan py-1 px-3 bg-brand-cyan/10 rounded-full">
                          98% Efficiency
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[50px] shadow-2xl relative overflow-hidden flex flex-col justify-center items-center text-center space-y-6">
                  <div className="w-32 h-32 bg-blue-500/10 rounded-[40px] flex items-center justify-center text-blue-500 border border-blue-500/10 shadow-inner">
                    <Shield size={64} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Central Security</h3>
                    <p className="text-text-secondary font-black opacity-40 text-[10px] uppercase tracking-[0.3em]">Guardian Protocol v2.4.0</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-green-500/10 px-4 py-2 rounded-full text-green-400 text-xs font-black">ENCRYPTED</div>
                    <div className="bg-indigo-500/10 px-4 py-2 rounded-full text-indigo-400 text-xs font-black">MULTI-TENANT</div>
                  </div>
              </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
