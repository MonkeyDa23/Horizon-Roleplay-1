
// src/components/admin/UserLookupPanel.tsx
import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { lookupUser, banUser, unbanUser } from '../../lib/api';
import type { UserLookupResult, DiscordRole } from '../../types';
import Modal from '../Modal';
import { Loader2, Search, User, Ban, CheckCircle } from 'lucide-react';

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
    const [discordId, setDiscordId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchResult, setSearchResult] = useState<UserLookupResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isBanModalOpen, setBanModalOpen] = useState(false);
    const [banReason, setBanReason] = useState('');
    const [banDuration, setBanDuration] = useState<number | null>(null);

    const handleSearch = async () => {
        if (!discordId) return;
        setIsLoading(true);
        setError(null);
        setSearchResult(null);
        try {
            const result = await lookupUser(discordId);
            if ((result as any).error) {
                throw new Error((result as any).error);
            }
            setSearchResult(result);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleBan = async () => {
        if (!searchResult || !banReason) return;
        try {
            await banUser(searchResult.id, banReason, banDuration);
            showToast('User banned successfully.', 'success');
            setBanModalOpen(false);
            handleSearch(); // Refresh user data
        } catch (err) {
            showToast((err as Error).message, 'error');
        }
    };

    const handleUnban = async () => {
        if (!searchResult) return;
        // FIX: Guard against window access in non-browser environments.
        if (typeof window !== 'undefined' && (window as any).confirm('Are you sure you want to unban this user?')) {
            try {
                await unbanUser(searchResult.id);
                showToast('User unbanned successfully.', 'success');
                handleSearch(); // Refresh user data
            } catch (err) {
                showToast((err as Error).message, 'error');
            }
        }
    };

    return (
        <div className="animate-fade-in-up">
            <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                <div className="flex gap-4">
                    <input 
                        type="text"
                        value={discordId}
                        // FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property.
                        onChange={(e) => setDiscordId((e.currentTarget as HTMLInputElement).value)}
                        placeholder={t('discord_id_placeholder')}
                        className="w-full bg-brand-light-blue p-3 rounded-md border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
                    />
                    <button onClick={handleSearch} disabled={isLoading || !discordId} className="bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                        {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                        <span>{t('search')}</span>
                    </button>
                </div>
            </div>

            <div className="mt-8">
                {error && <div className="text-center text-red-400 p-8 bg-red-500/10 rounded-lg">{error}</div>}
                {searchResult && (
                    <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 text-center">
                            <img src={searchResult.avatar} alt={searchResult.username} className="w-32 h-32 rounded-full mx-auto border-4 border-brand-cyan" />
                            <h3 className="text-2xl font-bold mt-4">{searchResult.username}</h3>
                            {searchResult.highestRole && <div className="mt-2"><RoleBadge role={searchResult.highestRole} /></div>}
                            <div className="mt-6 flex gap-4 justify-center">
                                {searchResult.is_banned ? (
                                    <button onClick={handleUnban} className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-500 flex items-center gap-2"><CheckCircle size={18}/> {t('unban')}</button>
                                ) : (
                                    <button onClick={() => setBanModalOpen(true)} className="bg-red-600 text-white font-bold py-2 px-4 rounded-md hover:bg-red-500 flex items-center gap-2"><Ban size={18}/> {t('ban')}</button>
                                )}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                             <h4 className="text-xl font-bold mb-3">{t('discord_roles')}</h4>
                             <div className="flex flex-wrap gap-2 p-3 bg-brand-dark rounded-md">
                                {searchResult.roles.map(r => <RoleBadge key={r.id} role={r} />)}
                            </div>
                            {searchResult.is_banned && (
                                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                    <h4 className="font-bold text-red-300">{t('banned_indefinitely')}</h4>
                                    <p><strong>{t('reason')}:</strong> {searchResult.ban_reason}</p>
                                    {searchResult.ban_expires_at && <p><strong>{t('ban_expires')}:</strong> {new Date(searchResult.ban_expires_at).toLocaleString()}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Modal isOpen={isBanModalOpen} onClose={() => setBanModalOpen(false)} title={t('confirm_ban')}>
                <div className="space-y-4">
                    <div>
                        <label className="block font-semibold mb-1">{t('reason')}</label>
                        {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                        <input type="text" value={banReason} onChange={e => setBanReason((e.currentTarget as HTMLInputElement).value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                    </div>
                    <div>
                        <label className="block font-semibold mb-1">{t('duration')} (in hours)</label>
                        {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                        <input type="number" onChange={e => setBanDuration(parseInt((e.currentTarget as HTMLInputElement).value) || null)} placeholder="Leave empty for permanent" className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                    </div>
                     <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                        <button onClick={() => setBanModalOpen(false)} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                        <button onClick={handleBan} disabled={!banReason} className="bg-red-600 text-white font-bold py-2 px-6 rounded-md hover:bg-red-500 disabled:opacity-50">
                            {t('confirm_ban')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UserLookupPanel;