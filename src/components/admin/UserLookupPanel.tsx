/**
 * Nova Roleplay - Official Website
 * Admin User Lookup Panel
 */
import React, { useState } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { lookupUser, banUser, unbanUser, addBalance, createInvoice, getUserInvoices, sendDiscordLog, getProducts, logAdminAction, logFinanceAction } from '../../lib/api';
import type { UserLookupResult, DiscordRole, Invoice, Product } from '../../types';
import Modal from '../Modal';
import { Loader2, Search, Ban, Coins, Receipt, PlusCircle, Trash2, User, UserX, ShieldCheck, CreditCard, History, Clock, FileText, ArrowRight } from 'lucide-react';

const RoleBadge: React.FC<{ role: DiscordRole }> = ({ role }) => {
    const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 125 ? 'text-black' : 'text-white';
    return (
        <span 
            className={`px-3 py-1 text-[10px] font-black rounded-full border border-white/10 shadow-sm ${textColor} uppercase tracking-wider`} 
            style={{ backgroundColor: color }}
        >
            {role.name}
        </span>
    );
};

const UserLookupPanel: React.FC = () => {
    const { t, language, dir } = useLocalization();
    const isArabic = language === 'ar';
    const { showToast } = useToast();
    const { user: adminUser } = useAuth();
    const { config, branding } = useConfig();
    
    const [discordId, setDiscordId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchResult, setSearchResult] = useState<UserLookupResult | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    const [isBanModalOpen, setBanModalOpen] = useState(false);
    const [banReason, setBanReason] = useState('');
    const [banDuration, setBanDuration] = useState<number | null>(null);

    const [isBalanceModalOpen, setBalanceModalOpen] = useState(false);
    const [balanceAmount, setBalanceAmount] = useState<number>(0);
    const [isProcessingBalance, setIsProcessingBalance] = useState(false);

    const [isInvoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [selectedInvoiceProducts, setSelectedInvoiceProducts] = useState<Product[]>([]);
    const [isProcessingInvoice, setIsProcessingInvoice] = useState(false);

    const handleSearch = async () => {
        if (!discordId) return;
        setIsLoading(true);
        setError(null);
        setSearchResult(null);
        setInvoices([]);
        try {
            const result = await lookupUser(discordId);
            setSearchResult(result);
            if (result.id) {
                const invs = await getUserInvoices(result.id);
                setInvoices(invs);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBan = async () => {
        if (!searchResult || !searchResult.id) return;
        try {
            await banUser(searchResult.id, banReason, banDuration);
            
            const { logSecurityEvent } = await import('../../lib/api');
            logSecurityEvent('USER_BANNED', 'CRITICAL', { targetId: searchResult.id, targetName: searchResult.username, reason: banReason, duration: banDuration });

            await logAdminAction(
                config, 
                adminUser!, 
                "حظر مستخدم", 
                `تم حظر العضو **${searchResult.username}**.\n**السبب:** ${banReason}\n**المدة:** ${banDuration ? banDuration + ' ساعة' : 'مؤبد'}`, 
                'ERROR'
            );

            const dmEmbed = {
                title: "⛔ تم حظر حسابك",
                description: `مرحباً **${searchResult.username}**،\n\nيؤسفنا إبلاغك بأنه تم حظر حسابك من الموقع.`,
                color: 0xEF4444,
                fields: [
                    { name: "السبب", value: banReason },
                    { name: "المدة", value: banDuration ? `${banDuration} ساعة` : "دائم" },
                    { name: "تاريخ الانتهاء", value: banDuration ? new Date(Date.now() + banDuration * 3600000).toLocaleString() : "غير محدد" }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: config.siteName }
            };
            await sendDiscordLog(config, dmEmbed, 'dm', searchResult.discordId);

            showToast('User banned successfully.', 'success');
            setBanModalOpen(false);
            handleSearch();
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const handleUnban = async () => {
        if (!searchResult || !searchResult.id) return;
        if (confirm('Are you sure you want to unban this user?')) {
            try {
                await unbanUser(searchResult.id);
                await logAdminAction(config, adminUser!, "رفع حظر", `تم رفع الحظر عن العضو **${searchResult.username}**.`, 'SUCCESS');
                showToast('User unbanned successfully.', 'success');
                handleSearch();
            } catch (err) {
                showToast((err as Error).message, 'error');
            }
        }
    };

    const handleAddBalance = async () => {
        if (!searchResult || !searchResult.id) return;
        setIsProcessingBalance(true);
        try {
            await addBalance(searchResult.id, balanceAmount, `Added by admin ${adminUser?.username}`);
            const { logSecurityEvent } = await import('../../lib/api');
            logSecurityEvent('BALANCE_MODIFIED', 'WARNING', { targetId: searchResult.id, amount: balanceAmount, action: 'ADD' });

            await logFinanceAction(
                config, 
                adminUser!, 
                { id: searchResult.discordId, name: searchResult.username }, 
                balanceAmount, 
                'Add Balance', 
                `شحن رصيد من قبل الإدارة`
            );

            showToast(t('balance_added_success'), 'success');
            setBalanceModalOpen(false);
            handleSearch();
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setIsProcessingBalance(false);
        }
    };

    const openInvoiceModal = async () => {
        setInvoiceModalOpen(true);
        if (availableProducts.length === 0) {
            const prods = await getProducts();
            setAvailableProducts(prods);
        }
    };

    const addToInvoice = (product: Product) => {
        setSelectedInvoiceProducts([...selectedInvoiceProducts, product]);
    };

    const removeFromInvoice = (index: number) => {
        const newProds = [...selectedInvoiceProducts];
        newProds.splice(index, 1);
        setSelectedInvoiceProducts(newProds);
    };

    const handleCreateInvoice = async () => {
        if (!searchResult || !searchResult.id || selectedInvoiceProducts.length === 0) return;
        setIsProcessingInvoice(true);
        const totalAmount = selectedInvoiceProducts.reduce((acc, p) => acc + p.price, 0);
        
        const invoiceItems = selectedInvoiceProducts.map(p => ({
            productName: t(p.nameKey),
            price: p.price,
            imageUrl: p.imageUrl
        }));

        try {
            await createInvoice(searchResult.id, invoiceItems, totalAmount);
            await logFinanceAction(
                config, 
                adminUser!, 
                { id: searchResult.discordId, name: searchResult.username }, 
                totalAmount, 
                'Invoice Created', 
                `فاتورة لمنتجات: ${invoiceItems.map(i => i.productName).join(', ')}`
            );

            showToast(t('invoice_created_success'), 'success');
            setInvoiceModalOpen(false);
            setSelectedInvoiceProducts([]);
            handleSearch();
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setIsProcessingInvoice(false);
        }
    };

    return (
        <div className="space-y-10 animate-fade-in-up" dir={dir}>
            {/* Search Header */}
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="relative flex-grow">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary opacity-40" size={28} />
                        <input 
                            type="text" 
                            placeholder={t('discord_id_placeholder') || 'Enter Discord ID...'} 
                            value={discordId} 
                            onChange={(e) => setDiscordId(e.target.value)} 
                            className="w-full bg-white/5 border-2 border-white/10 rounded-[28px] py-6 pl-16 pr-8 text-2xl text-white focus:outline-none focus:border-white/20 transition-all font-mono"
                        />
                    </div>
                    <button 
                        onClick={handleSearch} 
                        disabled={!discordId || isLoading} 
                        style={{ backgroundColor: branding.primaryColor }}
                        className="text-brand-dark font-black py-6 px-12 rounded-[28px] hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-4 disabled:opacity-30 disabled:grayscale active:scale-95 min-w-[180px]"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={32} /> : <><Search size={28} /> {t('lookup_user')}</>}
                    </button>
                </div>
                {error && <p className="text-red-400 mt-6 bg-red-500/10 p-5 rounded-2xl border border-red-500/20 font-bold animate-shake">{error}</p>}
            </div>

            {searchResult && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                    {/* User Profile Card */}
                    <div className="xl:col-span-4 self-start">
                        <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[50px] shadow-2xl text-center space-y-8 relative overflow-hidden backdrop-blur-3xl">
                            <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: branding.primaryColor }}></div>
                            
                            <div className="relative inline-block group">
                                <div className="absolute inset-0 blur-3xl opacity-30 group-hover:opacity-50 transition-opacity" style={{ backgroundColor: branding.primaryColor }}></div>
                                <img 
                                    src={searchResult.avatar} 
                                    alt={searchResult.username} 
                                    className="w-40 h-40 rounded-[48px] mx-auto border-4 border-white/10 relative z-10 shadow-glow pointer-events-none"
                                />
                            </div>

                            <div>
                                <h2 className="text-3xl font-black text-white">{searchResult.username}</h2>
                                <p className="text-xs text-text-secondary font-mono mt-3 opacity-40 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full inline-block select-all cursor-copy">
                                    {searchResult.discordId}
                                </p>
                            </div>
                            
                            <div className="bg-white/[0.03] p-6 rounded-[32px] border border-white/5 flex flex-col items-center gap-2 shadow-inner">
                                <p className="text-[10px] font-black text-text-secondary uppercase opacity-40 tracking-widest">{t('account_balance')}</p>
                                <div className="flex items-center gap-3 text-3xl font-black" style={{ color: branding.primaryColor }}>
                                    <Coins size={32} />
                                    <span>${searchResult.balance.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 justify-center">
                                {searchResult.roles.map(role => <RoleBadge key={role.id} role={role} />)}
                            </div>

                            <div className="pt-8 border-t border-white/5 space-y-4">
                                {searchResult.is_banned ? (
                                    <div className="space-y-4">
                                        <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-[32px] text-center">
                                            <div className="bg-red-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500 border border-red-500/20 shadow-inner">
                                                <UserX size={24} />
                                            </div>
                                            <h4 className="text-red-500 font-black text-xl mb-1 uppercase">{t('banned')}</h4>
                                            <p className="text-xs text-red-400 font-bold opacity-80 leading-relaxed px-4">{searchResult.ban_reason}</p>
                                            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-red-400/50 font-black uppercase">
                                                <Clock size={12} />
                                                <span>{searchResult.ban_expires_at ? new Date(searchResult.ban_expires_at).toLocaleString() : 'Permanent'}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleUnban} 
                                            className="w-full py-5 rounded-[24px] font-black text-lg bg-red-500 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all"
                                        >
                                            {t('unban_user')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        <button 
                                            onClick={() => setBanModalOpen(true)} 
                                            className="w-full py-4 rounded-2xl font-black text-sm bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3 active:scale-95"
                                        >
                                            <Ban size={20} /> {t('ban_user')}
                                        </button>
                                        <button 
                                            onClick={() => setBalanceModalOpen(true)} 
                                            className="w-full py-4 rounded-2xl font-black text-sm bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 hover:bg-brand-cyan hover:text-brand-dark transition-all flex items-center justify-center gap-3 active:scale-95"
                                            style={{ borderColor: `${branding.primaryColor}33`, color: branding.primaryColor }}
                                        >
                                            <PlusCircle size={20} /> {t('modify_balance')}
                                        </button>
                                        <button 
                                            onClick={openInvoiceModal} 
                                            className="w-full py-4 rounded-2xl font-black text-sm bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl"
                                        >
                                            <Receipt size={20} /> {t('create_invoice')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Content Area (Invoices) */}
                    <div className="xl:col-span-8">
                        <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[50px] shadow-2xl h-full backdrop-blur-3xl relative">
                            <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-4">
                                <History size={32} style={{ color: branding.primaryColor }} /> 
                                {t('transaction_history')}
                            </h3>

                            {invoices.length > 0 ? (
                                <div className="space-y-6 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
                                    {invoices.map(inv => (
                                        <div key={inv.id} className="bg-white/[0.02] p-8 rounded-[40px] border border-white/5 hover:border-white/10 transition-all group shadow-xl">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-white/5 pb-6 mb-6">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-3 text-xs text-text-secondary opacity-40 font-mono font-black uppercase">
                                                        <FileText size={14} />
                                                        ID: {inv.id}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-text-secondary font-black bg-white/5 px-4 py-2 rounded-full inline-block">
                                                        <Clock size={16} />
                                                        {new Date(inv.created_at).toLocaleString(isArabic ? 'ar' : 'en')}
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    <p className="text-3xl font-black" style={{ color: branding.primaryColor }}>
                                                        ${inv.total_amount.toLocaleString()}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-text-secondary font-black opacity-40 mt-1">
                                                        <User size={14} />
                                                        <span>By: {inv.admin_username}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {inv.products && (inv.products as any[]).map((p, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/20">
                                                                <CreditCard size={20} />
                                                            </div>
                                                            <span className="font-black text-white">{p.productName}</span>
                                                        </div>
                                                        <span className="font-black text-lg py-1 px-3 bg-white/5 rounded-xl border border-white/5">${p.price}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-40 text-text-secondary">
                                    <div className="flex flex-col items-center gap-8">
                                        <History size={100} className=" opacity-5" />
                                        <p className="text-3xl font-black opacity-20">{t('no_invoices_yet')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Ban Modal */}
            <Modal isOpen={isBanModalOpen} onClose={() => setBanModalOpen(false)} title={t('ban_user')}>
                <div className="p-8 space-y-8" dir={dir}>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-text-secondary opacity-40 tracking-widest">{t('ban_reason')}</label>
                        <input 
                            type="text" 
                            placeholder={t('reason_placeholder') || 'Enter ban reason...'} 
                            value={banReason} 
                            onChange={(e) => setBanReason(e.target.value)} 
                            className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-white/20 transition-all font-bold" 
                        />
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-text-secondary opacity-40 tracking-widest">{t('ban_duration_hours')} (0 = Permanent)</label>
                        <input 
                            type="number" 
                            placeholder="0" 
                            value={banDuration || ''} 
                            onChange={(e) => setBanDuration(parseInt(e.target.value) || null)} 
                            className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-white/20 transition-all font-black text-xl" 
                        />
                    </div>
                    <button 
                        onClick={handleBan} 
                        className="w-full py-5 rounded-[24px] font-black text-xl bg-red-600 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all mt-4"
                    >
                        {t('confirm_ban')}
                    </button>
                </div>
            </Modal>

            {/* Balance Modal */}
            <Modal isOpen={isBalanceModalOpen} onClose={() => setBalanceModalOpen(false)} title={t('modify_balance')}>
                <div className="p-8 space-y-10" dir={dir}>
                    <div className="text-center p-8 bg-black/20 rounded-[40px] border border-white/5 shadow-inner">
                        <p className="text-xs font-black text-text-secondary uppercase opacity-40 tracking-widest mb-2">{t('current_balance')}</p>
                        <p className="text-5xl font-black" style={{ color: branding.primaryColor }}>${searchResult?.balance.toLocaleString()}</p>
                    </div>
                    
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-text-secondary opacity-40 tracking-widest">{t('modify_amount')}</label>
                        <input 
                            type="number" 
                            placeholder="0" 
                            value={balanceAmount} 
                            onChange={(e) => setBalanceAmount(parseFloat(e.target.value))} 
                            className="w-full bg-white/5 border-2 border-white/10 rounded-[32px] p-8 text-center text-4xl font-black text-white focus:outline-none focus:border-white/20 transition-all shadow-glow-inner" 
                        />
                    </div>

                    <button 
                        onClick={handleAddBalance} 
                        disabled={isProcessingBalance} 
                        style={{ backgroundColor: branding.primaryColor }}
                        className="w-full py-6 rounded-[32px] font-black text-2xl text-brand-dark shadow-2xl hover:scale-105 active:scale-95 transition-all flex justify-center items-center gap-4 disabled:opacity-30 disabled:grayscale"
                    >
                        {isProcessingBalance ? <Loader2 className="animate-spin" size={32} /> : (
                            <>
                                <PlusCircle size={32} />
                                {t('apply_changes')}
                            </>
                        )}
                    </button>
                </div>
            </Modal>

            {/* Invoice Modal */}
            <Modal isOpen={isInvoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} title={t('create_invoice')} maxWidth="5xl">
                <div className="flex flex-col xl:flex-row gap-10 p-10 max-h-[85vh]" dir={dir}>
                    <div className="w-full xl:w-7/12 space-y-8 flex flex-col">
                        <div className="flex items-center gap-4 text-white font-black text-2xl pb-4 border-b border-white/5">
                            <PlusCircle size={28} style={{ color: branding.primaryColor }} />
                            {t('available_store_items')}
                        </div>
                        <div className="flex-grow overflow-y-auto pr-4 custom-scrollbar space-y-4">
                            {availableProducts.map(prod => (
                                <div 
                                    key={prod.id} 
                                    className="flex items-center justify-between bg-white/5 p-5 rounded-[32px] border border-white/5 cursor-pointer hover:border-white/20 hover:scale-[1.02] active:scale-95 transition-all group shadow-xl" 
                                    onClick={() => addToInvoice(prod)}
                                >
                                    <div className="flex items-center gap-5">
                                        <img src={prod.imageUrl} className="w-16 h-16 rounded-2xl object-cover border border-white/10 shadow-lg" />
                                        <div>
                                            <p className="font-black text-lg text-white mb-1">{t(prod.nameKey)}</p>
                                            <p className="text-xl font-black" style={{ color: branding.primaryColor }}>${prod.price}</p>
                                        </div>
                                    </div>
                                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <PlusCircle size={24} className="text-white" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full xl:w-5/12 bg-black/20 p-8 rounded-[45px] border border-white/5 flex flex-col shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 blur-[100px] opacity-10 rounded-full" style={{ backgroundColor: branding.primaryColor }}></div>
                        
                        <h4 className="font-black text-white text-2xl border-b border-white/5 pb-6 mb-8 flex items-center justify-between">
                            {t('invoice_summary')}
                            <span className="text-xs bg-white/10 px-3 py-1 rounded-full opacity-60">{selectedInvoiceProducts.length} Items</span>
                        </h4>

                        <div className="flex-grow overflow-y-auto space-y-4 mb-8 custom-scrollbar">
                            {selectedInvoiceProducts.length > 0 ? selectedInvoiceProducts.map((prod, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white/[0.03] p-5 rounded-2xl border border-white/5 animate-fade-in group">
                                    <div className="flex flex-col">
                                        <span className="font-black text-white text-sm mb-1">{t(prod.nameKey)}</span>
                                        <span className="text-xs font-mono opacity-40 font-bold tracking-widest uppercase mb-1">SKU: {prod.id.slice(0, 8)}</span>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <span className="font-black text-xl text-white">${prod.price}</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeFromInvoice(idx); }} 
                                            className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all opacity-40 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-10 gap-6">
                                    <History size={80} />
                                    <p className="text-xl font-black uppercase tracking-[0.2em]">Cart Empty</p>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-white/5 pt-8 space-y-6">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-black text-text-secondary uppercase tracking-[0.3em] opacity-40 mb-2">{t('net_total')}</span>
                                <div className="text-right">
                                    <span className="text-5xl font-black text-white tracking-tight">
                                        ${selectedInvoiceProducts.reduce((acc, p) => acc + p.price, 0).toFixed(0)}
                                    </span>
                                    <span className="text-xl font-black opacity-30">.00</span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleCreateInvoice} 
                                disabled={isProcessingInvoice || selectedInvoiceProducts.length === 0} 
                                style={{ backgroundColor: branding.primaryColor }}
                                className="w-full py-6 rounded-[32px] font-black text-2xl text-brand-dark shadow-2xl hover:scale-105 active:scale-95 transition-all flex justify-center items-center gap-4 disabled:opacity-30 disabled:grayscale"
                            >
                                {isProcessingInvoice ? <Loader2 className="animate-spin" size={32} /> : (
                                    <>
                                        <Receipt size={32} />
                                        {t('issue_invoice')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UserLookupPanel;
