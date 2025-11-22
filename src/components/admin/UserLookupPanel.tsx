
// src/components/admin/UserLookupPanel.tsx
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { lookupUser, banUser, unbanUser, addBalance, createInvoice, getUserInvoices, sendDiscordLog, getProducts } from '../../lib/api';
import type { UserLookupResult, DiscordRole, Invoice, Product } from '../../types';
import Modal from '../Modal';
import { Loader2, Search, User, Ban, CheckCircle, Coins, Receipt, PlusCircle, Trash2 } from 'lucide-react';

const RoleBadge: React.FC<{ role: DiscordRole }> = ({ role }) => {
    const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 125 ? 'text-black' : 'text-white';
    return <span className={`px-2 py-1 text-xs font-bold rounded-md ${textColor}`} style={{ backgroundColor: color }}>{role.name}</span>;
};

const UserLookupPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { user: adminUser } = useAuth();
    const { config } = useConfig();
    
    const [discordId, setDiscordId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchResult, setSearchResult] = useState<UserLookupResult | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    // Ban Modal
    const [isBanModalOpen, setBanModalOpen] = useState(false);
    const [banReason, setBanReason] = useState('');
    const [banDuration, setBanDuration] = useState<number | null>(null);

    // Balance Modal
    const [isBalanceModalOpen, setBalanceModalOpen] = useState(false);
    const [balanceAmount, setBalanceAmount] = useState<number>(0);
    const [isProcessingBalance, setIsProcessingBalance] = useState(false);

    // Invoice Modal
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

    // --- Ban Handlers ---
    const handleBan = async () => {
        if (!searchResult || !searchResult.id) return;
        try {
            await banUser(searchResult.id, banReason, banDuration);
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
                showToast('User unbanned successfully.', 'success');
                handleSearch();
            } catch (err) {
                showToast((err as Error).message, 'error');
            }
        }
    };

    // --- Balance Handlers ---
    const handleAddBalance = async () => {
        if (!searchResult || !searchResult.id) return;
        setIsProcessingBalance(true);
        try {
            await addBalance(searchResult.id, balanceAmount, `Added by admin ${adminUser?.username}`);
            showToast(t('balance_added_success'), 'success');
            setBalanceModalOpen(false);
            handleSearch(); // Refresh UI
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setIsProcessingBalance(false);
        }
    };

    // --- Invoice Handlers ---
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
            
            // Send DM Notification
            const dmEmbed = {
                title: "🧾 فاتورة شراء جديدة",
                description: `مرحباً **${searchResult.username}**،\n\nتم إصدار فاتورة جديدة لحسابك من قبل الإدارة.`,
                color: 0x00F2EA,
                fields: [
                    { name: "🛒 المنتجات", value: invoiceItems.map(i => `- ${i.productName}`).join('\n') },
                    { name: "💰 الإجمالي", value: `$${totalAmount.toFixed(2)}` },
                    { name: "📅 التاريخ", value: new Date().toLocaleDateString() }
                ],
                thumbnail: { url: invoiceItems[0]?.imageUrl || config.LOGO_URL },
                timestamp: new Date().toISOString(),
                footer: { text: config.COMMUNITY_NAME }
            };
            await sendDiscordLog(config, dmEmbed, 'dm', searchResult.discordId);

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
        <div className="animate-fade-in-up">
            <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 mb-8">
                <div className="flex flex-col md:flex-row gap-4">
                    <input 
                        type="text" 
                        placeholder={t('discord_id_placeholder')} 
                        value={discordId} 
                        onChange={(e) => setDiscordId(e.target.value)} 
                        className="vixel-input flex-grow"
                    />
                    <button onClick={handleSearch} disabled={!discordId || isLoading} className="bg-brand-cyan text-brand-dark font-bold py-3 px-8 rounded-md hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-w-[120px]">
                        {isLoading ? <Loader2 className="animate-spin" /> : <><Search size={20} /> {t('search')}</>}
                    </button>
                </div>
                {error && <p className="text-red-400 mt-4 bg-red-500/10 p-3 rounded-md border border-red-500/30">{error}</p>}
            </div>

            {searchResult && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: User Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 text-center">
                            <img src={searchResult.avatar} alt={searchResult.username} className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-brand-cyan shadow-glow-cyan" />
                            <h2 className="text-2xl font-bold text-white">{searchResult.username}</h2>
                            <p className="text-gray-400 mb-4 text-sm font-mono select-all bg-black/20 inline-block px-2 rounded mt-1">{searchResult.discordId}</p>
                            
                            {/* Balance Display */}
                            <div className="bg-brand-dark p-3 rounded-lg border border-brand-light-blue/30 mb-6 flex items-center justify-center gap-2 text-accent-cyan">
                                <Coins size={20} />
                                <span className="font-bold text-xl">${searchResult.balance.toLocaleString()}</span>
                            </div>

                            <div className="flex flex-wrap gap-2 justify-center mb-6">
                                {searchResult.roles.map(role => <RoleBadge key={role.id} role={role} />)}
                            </div>

                            {searchResult.is_banned ? (
                                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg mb-6">
                                    <p className="text-red-400 font-bold flex items-center justify-center gap-2"><Ban size={20} /> BANNED</p>
                                    <p className="text-sm text-red-300 mt-1">{searchResult.ban_reason}</p>
                                    <p className="text-xs text-red-300/70 mt-2">Expires: {searchResult.ban_expires_at ? new Date(searchResult.ban_expires_at).toLocaleString() : 'Never'}</p>
                                    <button onClick={handleUnban} className="mt-3 w-full bg-red-500 text-white py-2 rounded font-bold hover:bg-red-600 transition-colors">{t('unban')}</button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <button onClick={() => setBanModalOpen(true)} className="w-full bg-brand-dark border border-red-500 text-red-500 py-2 rounded font-bold hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                                        <Ban size={18} /> {t('ban')}
                                    </button>
                                    <button onClick={() => setBalanceModalOpen(true)} className="w-full bg-brand-dark border border-accent-cyan text-accent-cyan py-2 rounded font-bold hover:bg-accent-cyan hover:text-black transition-colors flex items-center justify-center gap-2">
                                        <PlusCircle size={18} /> {t('add_balance')}
                                    </button>
                                    <button onClick={openInvoiceModal} className="w-full bg-brand-dark border border-brand-light-blue text-brand-light-blue py-2 rounded font-bold hover:bg-brand-light-blue hover:text-white transition-colors flex items-center justify-center gap-2">
                                        <Receipt size={18} /> {t('create_invoice')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Invoice History */}
                    <div className="lg:col-span-2">
                        <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 h-full">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Receipt /> {t('invoice_history')}</h3>
                            {invoices.length > 0 ? (
                                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {invoices.map(inv => (
                                        <div key={inv.id} className="bg-brand-dark p-4 rounded-lg border border-gray-700 hover:border-brand-cyan/50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="text-xs text-gray-500 font-mono">{inv.id}</p>
                                                    <p className="text-sm text-gray-400">{new Date(inv.created_at).toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-brand-cyan text-lg">${inv.total_amount.toLocaleString()}</p>
                                                    <p className="text-xs text-gray-500">By: {inv.admin_username}</p>
                                                </div>
                                            </div>
                                            <div className="border-t border-gray-700 pt-2 mt-2">
                                                {inv.products && (inv.products as any[]).map((p, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm text-gray-300">
                                                        <span>{p.productName}</span>
                                                        <span>${p.price}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-gray-500">{t('no_invoices_yet')}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Ban Modal */}
            <Modal isOpen={isBanModalOpen} onClose={() => setBanModalOpen(false)} title={t('ban')}>
                <div className="space-y-4">
                    <input type="text" placeholder={t('reason')} value={banReason} onChange={(e) => setBanReason(e.target.value)} className="vixel-input" />
                    <input type="number" placeholder={`${t('duration')} (hours) - Leave empty for permanent`} value={banDuration || ''} onChange={(e) => setBanDuration(parseInt(e.target.value) || null)} className="vixel-input" />
                    <button onClick={handleBan} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-500">{t('confirm_ban')}</button>
                </div>
            </Modal>

            {/* Add Balance Modal */}
            <Modal isOpen={isBalanceModalOpen} onClose={() => setBalanceModalOpen(false)} title={t('add_balance')}>
                <div className="space-y-4">
                    <div className="text-center mb-4">
                        <p className="text-gray-400">{t('current_balance')}</p>
                        <p className="text-3xl font-bold text-accent-cyan">${searchResult?.balance.toLocaleString()}</p>
                    </div>
                    <input type="number" placeholder={t('amount')} value={balanceAmount} onChange={(e) => setBalanceAmount(parseFloat(e.target.value))} className="vixel-input text-center text-2xl font-bold" />
                    <button onClick={handleAddBalance} disabled={isProcessingBalance} className="w-full bg-accent-cyan text-black font-bold py-3 rounded-lg hover:bg-white flex justify-center items-center gap-2">
                        {isProcessingBalance ? <Loader2 className="animate-spin" /> : t('add_balance')}
                    </button>
                </div>
            </Modal>

            {/* Create Invoice Modal */}
            <Modal isOpen={isInvoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} title={t('create_invoice')} maxWidth="3xl">
                <div className="flex flex-col md:flex-row gap-6 max-h-[70vh]">
                    {/* Product Selection */}
                    <div className="w-full md:w-1/2 space-y-4 overflow-y-auto pr-2">
                        <h4 className="font-bold text-gray-300 border-b border-gray-600 pb-2">{t('select_products')}</h4>
                        {availableProducts.map(prod => (
                            <div key={prod.id} className="flex items-center justify-between bg-brand-dark p-3 rounded border border-gray-700 cursor-pointer hover:border-brand-cyan" onClick={() => addToInvoice(prod)}>
                                <div className="flex items-center gap-3">
                                    <img src={prod.imageUrl} className="w-10 h-10 rounded object-cover" />
                                    <div>
                                        <p className="font-bold text-sm">{t(prod.nameKey)}</p>
                                        <p className="text-xs text-accent-cyan">${prod.price}</p>
                                    </div>
                                </div>
                                <PlusCircle size={18} className="text-gray-400" />
                            </div>
                        ))}
                    </div>

                    {/* Invoice Cart */}
                    <div className="w-full md:w-1/2 bg-brand-dark-blue p-4 rounded border border-brand-light-blue flex flex-col">
                        <h4 className="font-bold text-white border-b border-gray-600 pb-2 mb-4">{t('products_in_invoice')}</h4>
                        <div className="flex-grow overflow-y-auto space-y-2 mb-4">
                            {selectedInvoiceProducts.map((prod, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-brand-dark p-2 rounded">
                                    <span className="text-sm">{t(prod.nameKey)}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-sm">${prod.price}</span>
                                        <button onClick={() => removeFromInvoice(idx)} className="text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-gray-600 pt-4">
                            <div className="flex justify-between text-xl font-bold text-white mb-4">
                                <span>{t('total_amount')}</span>
                                <span className="text-accent-cyan">${selectedInvoiceProducts.reduce((acc, p) => acc + p.price, 0).toFixed(2)}</span>
                            </div>
                            <button onClick={handleCreateInvoice} disabled={isProcessingInvoice || selectedInvoiceProducts.length === 0} className="w-full bg-brand-cyan text-black font-bold py-3 rounded hover:bg-white flex justify-center items-center gap-2 disabled:opacity-50">
                                {isProcessingInvoice ? <Loader2 className="animate-spin" /> : t('create_invoice')}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UserLookupPanel;
