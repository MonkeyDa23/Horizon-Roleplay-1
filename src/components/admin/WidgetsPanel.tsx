/**
 * Nova Roleplay - Official Website
 * Admin Discord Widgets Panel
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { getDiscordWidgets, saveDiscordWidgets, sendDiscordLog } from '../../lib/api';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { DiscordWidget } from '../../types';
import { Loader2, Plus, GripVertical, Trash2, AlertCircle, LayoutGrid, Save, Edit2, ExternalLink } from 'lucide-react';
import Modal from '../Modal';

type EditingWidget = {
    id?: string;
    server_name: string;
    server_id: string;
    invite_url: string;
};

const WidgetsPanel: React.FC = () => {
    const { t, dir } = useLocalization();
    const { showToast } = useToast();
    const { config, branding } = useConfig();
    const { user } = useAuth();
    
    const [widgets, setWidgets] = usePersistentState<DiscordWidget[]>('vixel_admin_widgets_draft', []);
    const [editingWidget, setEditingWidget] = useState<EditingWidget | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchWidgets = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getDiscordWidgets();
            setWidgets(prev => prev.length > 0 ? prev : data);
        } catch (error) {
            showToast('Failed to load Discord widgets.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast, setWidgets]);

    useEffect(() => {
        if (widgets.length === 0) fetchWidgets();
        else setIsLoading(false);
    }, [fetchWidgets, widgets.length]);
    
    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const widgetsToSave = widgets.map((widget, index) => ({
                server_name: widget.server_name,
                server_id: widget.server_id,
                invite_url: widget.invite_url,
                position: index,
            }));
            await saveDiscordWidgets(widgetsToSave);
            
            localStorage.removeItem('vixel_admin_widgets_draft');
            const data = await getDiscordWidgets();
            setWidgets(data); 
            
            showToast('Widgets saved successfully!', 'success');

            const embed = {
                title: "🖼️ تحديث ودجتات الديسكورد",
                description: `قام المشرف **${user.username}** بتحديث قائمة سيرفرات الديسكورد (Widgets).\n\n**العدد الحالي:** ${widgets.length}`,
                color: 0x5865F2, // Discord Blue
                author: { name: user.username, icon_url: user.avatar },
                timestamp: new Date().toISOString(),
                footer: { text: "سجل الإعدادات" }
            };
            await sendDiscordLog(config, embed, 'admin');
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenModal = (widget?: DiscordWidget) => {
        if (widget) {
            setEditingWidget(widget);
        } else {
            setEditingWidget({ server_name: '', server_id: '', invite_url: '' });
        }
    };

    const handleModalSave = () => {
        if (!editingWidget) return;
        if (!editingWidget.server_name || !editingWidget.server_id) {
          showToast('Server Name and ID are required.', 'warning');
          return;
        }

        const newWidgets = editingWidget.id 
            ? widgets.map(w => w.id === (editingWidget as DiscordWidget).id ? { ...w, ...editingWidget } : w)
            : [...widgets, { ...editingWidget, id: crypto.randomUUID(), position: widgets.length }];
        
        setWidgets(newWidgets as DiscordWidget[]);
        setEditingWidget(null);
    };

    const deleteWidget = (id: string) => {
        if(window.confirm('Delete this widget?')) {
            setWidgets(widgets.filter(w => w.id !== id));
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up" dir={dir}>
            {/* Header / Stats */}
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] flex flex-col md:flex-row gap-8 items-center justify-between shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/10 shadow-inner">
                        <LayoutGrid className="text-blue-500" size={32} />
                    </div>
                    <div>
                        <div className="text-4xl font-black text-white">{widgets.length}</div>
                        <div className="text-text-secondary text-xs uppercase font-black tracking-widest mt-1">{t('active_widgets')}</div>
                    </div>
                </div>

                <div className="flex gap-4">
                     <button 
                        onClick={() => handleOpenModal()} 
                        className="bg-white/5 text-white border border-white/10 font-black py-4 px-8 rounded-2xl hover:bg-white/10 transition-all flex items-center gap-3 active:scale-95"
                    >
                        <Plus size={24} /> {t('add_widget')}
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving || isLoading} 
                        style={{ backgroundColor: branding.primaryColor }}
                        className="text-brand-dark font-black py-4 px-10 rounded-2xl hover:scale-105 transition-all shadow-xl min-w-[10rem] flex justify-center disabled:opacity-30 disabled:grayscale active:scale-95"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={24} /> : (
                            <div className="flex items-center gap-3">
                                <Save size={24} />
                                {t('save_settings')}
                            </div>
                        )}
                    </button>
                </div>
            </div>

            {/* Warning Area */}
            <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-3xl flex items-center gap-4 text-blue-200">
                <AlertCircle className="flex-shrink-0" size={24} />
                <p className="text-sm font-black opacity-80">{t('widgets_draft_hint') || 'التعديلات محفوظة كمسودة حتى تضغط حفظ لتطبيقها على الموقع.'}</p>
            </div>
            
            {/* Widgets List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center py-20"><Loader2 size={64} className="animate-spin opacity-20" style={{ color: branding.primaryColor }} /></div>
                ) : widgets.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {widgets.map((widget) => (
                        <div key={widget.id} className="bg-white/[0.02] p-6 rounded-[32px] border border-white/5 flex flex-col md:flex-row items-center gap-8 shadow-xl group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-6 flex-grow">
                                <GripVertical className="text-white/10 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 text-white/20">
                                  <LayoutGrid size={32} />
                                </div>
                                <div className="flex-grow">
                                    <p className="text-2xl font-black text-white mb-1 uppercase tracking-tight">{widget.server_name}</p>
                                    <div className="flex items-center gap-4">
                                      <p className="text-xs font-mono text-text-secondary opacity-60 tracking-widest uppercase">ID: {widget.server_id}</p>
                                      {widget.invite_url && (
                                        <a href={widget.invite_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 font-bold flex items-center gap-1 hover:underline">
                                          Invite Link <ExternalLink size={10} />
                                        </a>
                                      )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button 
                                    onClick={() => handleOpenModal(widget)} 
                                    className="flex-grow md:flex-none px-6 py-4 bg-white/5 text-white hover:bg-white/10 rounded-2xl transition-all border border-white/10 font-bold flex items-center justify-center gap-2"
                                >
                                    <Edit2 size={18} /> {t('edit')}
                                </button>
                                <button 
                                    onClick={() => deleteWidget(widget.id)} 
                                    className="p-4 bg-red-500/5 text-red-500 hover:bg-red-500/10 rounded-2xl transition-all border border-red-500/10 hover:border-red-500/20 active:scale-95"
                                >
                                    <Trash2 size={24} />
                                </button>
                            </div>
                        </div>
                    ))}
                  </div>
                ) : (
                    <div className="bg-white/[0.02] border border-white/5 rounded-[40px] py-32 text-center text-text-secondary shadow-lg">
                        <div className="flex flex-col items-center gap-6">
                            <LayoutGrid size={80} className="opacity-5" />
                            <p className="text-2xl font-black">{t('no_widgets_found')}...</p>
                            <button onClick={() => handleOpenModal()} className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white font-black text-sm border border-white/10 transition-all">
                                {t('add_widget')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingWidget && (
                <Modal isOpen={!!editingWidget} onClose={() => setEditingWidget(null)} title={editingWidget.id ? t('edit_widget') : t('add_widget')}>
                   <div className="p-8 space-y-8" dir={dir}>
                        <div className="grid grid-cols-1 gap-8">
                             <div className="space-y-4">
                                <label className="text-xs font-black uppercase text-text-secondary opacity-40 tracking-widest">{t('server_name')}</label>
                                <input 
                                    type="text" 
                                    value={editingWidget.server_name} 
                                    onChange={e => setEditingWidget({...editingWidget, server_name: e.currentTarget.value})} 
                                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-lg text-white focus:outline-none transition-all shadow-inner"
                                    placeholder="Nova Main Server..."
                                />
                            </div>
                             <div className="space-y-4">
                                <label className="text-xs font-black uppercase text-text-secondary opacity-40 tracking-widest">{t('server_id')}</label>
                                <input 
                                    type="text" 
                                    value={editingWidget.server_id} 
                                    onChange={e => setEditingWidget({...editingWidget, server_id: e.currentTarget.value})} 
                                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-lg text-white focus:outline-none transition-all shadow-inner"
                                    placeholder="812345678901234567..."
                                />
                            </div>
                             <div className="space-y-4">
                                <label className="text-xs font-black uppercase text-text-secondary opacity-40 tracking-widest">{t('invite_url')}</label>
                                <input 
                                    type="text" 
                                    value={editingWidget.invite_url} 
                                    onChange={e => setEditingWidget({...editingWidget, invite_url: e.currentTarget.value})} 
                                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-lg text-white focus:outline-none transition-all shadow-inner"
                                    placeholder="https://discord.gg/..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-6 pt-10 border-t border-white/5">
                            <button onClick={() => setEditingWidget(null)} className="bg-white/5 text-text-secondary font-black py-4 px-10 rounded-2xl hover:bg-white/10 transition-all active:scale-95">Cancel</button>
                            <button 
                                onClick={handleModalSave} 
                                style={{ backgroundColor: branding.primaryColor }}
                                className="text-brand-dark font-black py-4 px-12 rounded-2xl hover:scale-105 transition-all shadow-2xl active:scale-95"
                            >
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default WidgetsPanel;
