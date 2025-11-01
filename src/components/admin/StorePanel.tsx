// src/components/admin/StorePanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getProducts, saveProduct, deleteProduct } from '../../lib/api';
import type { Product } from '../../types';
import { useTranslations } from '../../hooks/useTranslations';
import Modal from '../Modal';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';

interface EditingProductData extends Product {
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
}

const StorePanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { translations, refreshTranslations } = useTranslations();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingProduct, setEditingProduct] = useState<EditingProductData | null>(null);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            setProducts(await getProducts());
        } catch (error) {
            showToast('Failed to load products', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleCreateNew = () => {
        const newId = crypto.randomUUID();
        setEditingProduct({
            id: newId,
            nameKey: `product_${newId}_name`,
            nameEn: '',
            nameAr: '',
            descriptionKey: `product_${newId}_desc`,
            descriptionEn: '',
            descriptionAr: '',
            price: 0,
            imageUrl: ''
        });
    };

    const handleEdit = (product: Product) => {
        setEditingProduct({
            ...product,
            nameEn: translations[product.nameKey]?.en || '',
            nameAr: translations[product.nameKey]?.ar || '',
            descriptionEn: translations[product.descriptionKey]?.en || '',
            descriptionAr: translations[product.descriptionKey]?.ar || '',
        });
    };

    const handleSave = async () => {
        if (!editingProduct) return;
        setIsSaving(true);
        try {
            await saveProduct(editingProduct);
            setEditingProduct(null);
            showToast('Product saved!', 'success');
            await refreshTranslations();
            fetchProducts();
        } catch (error) {
            showToast(`Error: ${(error as Error).message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (product: Product) => {
        if (window.confirm(`Delete "${t(product.nameKey)}"? This is irreversible.`)) {
            try {
                await deleteProduct(product.id);
                showToast('Product deleted!', 'success');
                fetchProducts();
            } catch (error) {
                showToast(`Error: ${(error as Error).message}`, 'error');
            }
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-end mb-6">
                <button onClick={handleCreateNew} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
                    <Plus size={20} /> {t('add_new_product')}
                </button>
            </div>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="border-b border-brand-light-blue/50 text-gray-300 bg-brand-light-blue/30">
                            <tr>
                                <th className="p-4">{t('product_name')}</th>
                                <th className="p-4">{t('price')}</th>
                                <th className="p-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product) => (
                                <tr key={product.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/20 transition-colors">
                                    <td className="p-4 font-semibold text-white">{t(product.nameKey)}</td>
                                    <td className="p-4 text-brand-cyan font-bold">${product.price.toFixed(2)}</td>
                                    <td className="p-4 text-right">
                                        <div className="inline-flex gap-4">
                                            <button onClick={() => handleEdit(product)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button>
                                            <button onClick={() => handleDelete(product)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {editingProduct && (
                <Modal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title={t(editingProduct.nameEn ? 'edit_product' : 'create_product')} maxWidth="lg">
                    <div className="space-y-4 text-white">
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('name_en')}</label>
                            <input type="text" value={editingProduct.nameEn} onChange={(e) => setEditingProduct({ ...editingProduct, nameEn: e.target.value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('name_ar')}</label>
                            <input type="text" dir="rtl" value={editingProduct.nameAr} onChange={(e) => setEditingProduct({ ...editingProduct, nameAr: e.target.value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('description_en')}</label>
                            <input type="text" value={editingProduct.descriptionEn} onChange={(e) => setEditingProduct({ ...editingProduct, descriptionEn: e.target.value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('description_ar')}</label>
                            <input type="text" dir="rtl" value={editingProduct.descriptionAr} onChange={(e) => setEditingProduct({ ...editingProduct, descriptionAr: e.target.value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('price')}</label>
                            <input type="number" value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('image_url')}</label>
                            <input type="text" value={editingProduct.imageUrl} onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                        <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                            <button onClick={() => setEditingProduct(null)} disabled={isSaving} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white min-w-[8rem] flex justify-center">
                                {isSaving ? <Loader2 className="animate-spin"/> : t('save_product')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default StorePanel;
