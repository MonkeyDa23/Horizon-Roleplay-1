// src/components/admin/WidgetsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getDiscordWidgets, saveDiscordWidgets } from '../../lib/api';
import type { DiscordWidget } from '../../types';
import { Loader2, Plus, GripVertical, Trash2 } from 'lucide-react';
import Modal from '../Modal';

type EditingWidget = Omit<DiscordWidget, 'id' | 'position'> & { id?: string };

const WidgetsPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [widgets, setWidgets] = useState<DiscordWidget[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingWidget, setEditingWidget] = useState<EditingWidget | null>(null);

    const fetchWidgets = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getDiscordWidgets();
            setWidgets(data);
        } catch (error) {
            showToast('Failed to load Discord widgets.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchWidgets();
    }, [fetchWidgets]);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const widgetsToSave = widgets.map((widget, index) => ({
                server_name: widget.server_name,
                server_id: widget.server_id,
                invite_url: widget.invite_url,
                position: index,
            }));
            await saveDiscordWidgets(widgetsToSave);
            await fetchWidgets(); // Refetch to get fresh data with IDs
            showToast('Widgets saved successfully!', 'success');
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

        const newWidgets = editingWidget.id 
            ? widgets.map(w => w.id === (editingWidget as DiscordWidget).id ? { ...w, ...editingWidget } : w)
            : [...widgets, { ...editingWidget, id: crypto.randomUUID(), position: widgets.length }];
        
        setWidgets(newWidgets as DiscordWidget[]);
        setEditingWidget(null);
    };

    const deleteWidget = (id: string) => {
        setWidgets(widgets.filter(w => w.id !== id));
    };

    if (isLoading) {
        return <div className="flex justify-center items-center py-20"><Loader2 size={40} className="text-brand-cyan animate-spin" /></div>;
    }
    
    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <p className="text-gray-400">Manage the Discord server widgets shown on the 'About Us' page.</p>
                <div className="flex gap-4">
                     <button onClick={() => handleOpenModal()} className="bg-blue-500/80 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition-colors flex items-center gap-2">
                        <Plus size={18} /> Add Widget
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                        {isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}
                    </button>
                </div>
            </div>
            
            <div className="space-y-4">
                {widgets.length > 0 ? widgets.map((widget) => (
                    <div key={widget.id} className="bg-brand-dark-blue p-3 rounded-lg border border-brand-light-blue/50 flex items-center gap-4">
                        <GripVertical className="cursor-grab text-gray-500" />
                        <div className="flex-grow">
                            <p className="font-bold text-white text-lg">{widget.server_name}</p>
                            <p className="text-sm text-gray-400">ID: {widget.server_id}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => handleOpenModal(widget)} className="text-gray-300 hover:text-brand-cyan">Edit</button>
                            <button onClick={() => deleteWidget(widget.id)} className="text-red-500 hover:text-red-400"><Trash2 size={20} /></button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10 text-gray-400">No widgets configured yet. Click "Add Widget" to create one.</div>
                )}
            </div>

            {editingWidget && (
                <Modal isOpen={!!editingWidget} onClose={() => setEditingWidget(null)} title={editingWidget.id ? 'Edit Widget' : 'Add Widget'}>
                    <div className="space-y-4">
                        <div>
                            <label className="block font-semibold mb-1">Server Name</label>
                            <input type="text" value={editingWidget.server_name} onChange={e => setEditingWidget({...editingWidget, server_name: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                        </div>
                         <div>
                            <label className="block font-semibold mb-1">Server ID</label>
                            <input type="text" value={editingWidget.server_id} onChange={e => setEditingWidget({...editingWidget, server_id: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                        </div>
                         <div>
                            <label className="block font-semibold mb-1">Invite URL</label>
                            <input type="text" value={editingWidget.invite_url} onChange={e => setEditingWidget({...editingWidget, invite_url: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                        </div>
                        <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                             <button onClick={() => setEditingWidget(null)} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                             <button onClick={handleModalSave} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white">Save</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default WidgetsPanel;
