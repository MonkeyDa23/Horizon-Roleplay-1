
// src/components/admin/StorePanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { getProducts, saveProduct, deleteProduct, getProductCategories, saveProductCategories, sendDiscordLog } from '../../lib/api';
import type { Product, ProductCategory } from '../../types';
import { useTranslations } from '../../contexts/TranslationsContext';
import { usePersistentState } from '../../hooks/usePersistentState'; // Imported Hook
import Modal from '../Modal';
import { Loader2, Plus, Edit, Trash2, GripVertical, AlertCircle } from 'lucide-react';

interface EditingProductData extends Product {
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
}

interface EditableCategory extends ProductCategory {
    nameEn: string;
    nameAr: string;
}

const StorePanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { translations, loading: translationsLoading, refreshTranslations } = useTranslations();
    const { config } = useConfig();
    const { user } = useAuth();
    
    // PERSISTENT STATE: Keeps active view and edits safe
    const [activeView, setActiveView] = usePersistentState<'products' | 'categories'>('vixel_admin_store_view', 'products');
    const [categories, setCategories] = usePersistentState<EditableCategory[]>('vixel_admin_store_categories_draft', []);
    const [editingProduct, setEditingProduct] = usePersistentState<EditingProductData | null>('vixel_admin_store_product_draft', null);
    
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const fetchData = useCallback(async () => {
        if (translationsLoading) return;
        setIsLoading(true);
        try {
            const [productsData, categoriesData] = await Promise.all([getProducts(), getProductCategories()]);
            setProducts(productsData);
            
            // Only overwrite local draft if it's empty, otherwise keep user's unsaved changes for categories
            setCategories((prev) => {
                if (prev.length > 0) return prev; 
                return categoriesData.map(c => ({
                    ...c,
                    nameEn: translations[c.nameKey]?.en || '',
                    nameAr: translations[c.nameKey]?.ar || '',
                }));
            });

        } catch (error) {
            showToast('Failed to load store data', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast, translations, translationsLoading, setCategories]);

    useEffect(() => {
        // Initial load only if we don't have data or force refresh needed
        if (products.length === 0) fetchData();
        else setIsLoading(false);
    }, [fetchData, products.length]);

    // Product Handlers
    const handleCreateNewProduct = () => {
        const newId = crypto.randomUUID();
        setEditingProduct({
            id: newId,
            nameKey: `product_${newId}_name`, nameEn: '', nameAr: '',
            descriptionKey: `product_${newId}_desc`, descriptionEn: '', descriptionAr: '',
            price: 0, imageUrl: '', category_id: null,
        });
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct({
            ...product,
            nameEn: translations[product.nameKey]?.en || '',
            nameAr: translations[product.nameKey]?.ar || '',
            descriptionEn: translations[product.descriptionKey]?.en || '',
            descriptionAr: translations[product.descriptionKey]?.ar || '',
        });
    };

    const handleSaveProduct = async () => {
        if (!editingProduct || !user) return;
        setIsSaving(true);
        try {
            const isNew = !products.find(p => p.id === editingProduct.id);
            await saveProduct(editingProduct);
            
            // Clear draft explicitly on save
            setEditingProduct(null); 
            
            await refreshTranslations();
            await fetchData();
            
            showToast('Product saved!', 'success');

            // --- DETAILED LOG ---
            const embed = {
                title: isNew ? "🆕 منتج جديد" : "🛒 تحديث منتج",
                description: `قام المشرف **${user.username}** ${isNew ? 'بإضافة' : 'بتعديل'} منتج في المتجر.\n\n**الاسم:** ${editingProduct.nameAr || editingProduct.nameEn}\n**السعر:** $${editingProduct.price}\n**الوصف:** ${editingProduct.descriptionAr || editingProduct.descriptionEn}`,
                color: isNew ? 0x22C55E : 0xFFA500,
                author: { name: user.username, icon_url: user.avatar },
                thumbnail: { url: editingProduct.imageUrl },
                timestamp: new Date().toISOString(),
                footer: { text: "سجل المتجر" }
            };
            await sendDiscordLog(config, embed, 'admin');

        } catch (error) {
            showToast(`Error: ${(error as Error).message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProduct = async (product: Product) => {
        if (!user) return;
        if (window.confirm(`Delete "${t(product.nameKey)}"? This is irreversible.`)) {
            try {
                await deleteProduct(product.id);
                
                const embed = {
                    title: "🗑️ حذف منتج",
                    description: `قام المشرف **${user.username}** بحذف المنتج **${t(product.nameKey)}** نهائياً من المتجر.`,
                    color: 0xEF4444, // Red
                    author: { name: user.username, icon_url: user.avatar },
                    thumbnail: { url: product.imageUrl },
                    timestamp: new Date().toISOString(),
                    footer: { text: "سجل المتجر" }
                };
                await sendDiscordLog(config, embed, 'admin');

                showToast('Product deleted!', 'success');
                // Refresh list
                const updatedProducts = await getProducts();
                setProducts(updatedProducts);
            } catch (error) {
                showToast(`Error: ${(error as Error).message}`, 'error');
            }
        }
    };

    // Category Handlers
    const handleSaveCategories = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const dataToSave = categories.map((cat, index) => ({
                id: cat.id,
                nameKey: cat.nameKey,
                nameEn: cat.nameEn,
                nameAr: cat.nameAr,
                position: index,
            }));
            await saveProductCategories(dataToSave);
            await refreshTranslations();
            
            // Force clear draft so we get fresh data next time
            localStorage.removeItem('vixel_admin_store_categories_draft');
            
            await fetchData();
            
            showToast('Categories saved!', 'success');

            const embed = {
                title: "📂 تحديث أقسام المتجر",
                description: `قام المشرف **${user.username}** بتحديث هيكلة أقسام المتجر.\n\n**عدد الأقسام الحالية:** ${categories.length}`,
                color: 0xFFA500, // Orange
                author: { name: user.username, icon_url: user.avatar },
                timestamp: new Date().toISOString(),
                footer: { text: "سجل المتجر" }
            };
            await sendDiscordLog(config, embed, 'admin');

        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCategoryChange = (index: number, field: 'nameEn' | 'nameAr', value: string) => {
        const newCategories = [...categories];
        newCategories[index] = { ...newCategories[index], [field]: value };
        setCategories(newCategories);
    };

    const addCategory = () => {
        const newId = crypto.randomUUID();
        const newCategory: EditableCategory = {
            id: newId,
            nameKey: `prod_cat_${newId}_name`,
            nameEn: 'New Category',
            nameAr: 'قسم جديد',
            position: categories.length,
            products: [],
        };
        setCategories([...categories, newCategory]);
    };

    const deleteCategory = (index: number) => {
        setCategories(categories.filter((_, i) => i !== index));
    };

    if (isLoading || translationsLoading) {
        return <div className="flex justify-center items-center py-20"><Loader2 size={40} className="text-brand-cyan animate-spin" /></div>;
    }

    return (
        <div className="animate-fade-in-up">
            <div className="flex items-center gap-4 mb-6 border-b-2 border-brand-light-blue/50">
                <button onClick={() => setActiveView('products')} className={`py-3 px-6 font-bold text-lg transition-colors ${activeView === 'products' ? 'text-white border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-white'}`}>{t('products_management')}</button>
                <button onClick={() => setActiveView('categories')} className={`py-3 px-6 font-bold text-lg transition-colors ${activeView === 'categories' ? 'text-white border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-white'}`}>{t('product_categories_management')}</button>
            </div>

            {activeView === 'products' && (
                <div>
                    <div className="flex justify-end mb-6">
                        <button onClick={handleCreateNewProduct} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
                            <Plus size={20} /> {t('add_new_product')}
                        </button>
                    </div>
                    <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                                <thead className="border-b border-brand-light-blue/50 text-gray-300 bg-brand-light-blue/30">
                                    <tr>
                                        <th className="p-4">Product Name</th>
                                        <th className="p-4">Category</th>
                                        <th className="p-4">Price</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product) => (
                                        <tr key={product.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/20 transition-colors">
                                            <td className="p-4 font-semibold text-white">{t(product.nameKey)}</td>
                                            <td className="p-4 text-gray-400">{product.category_id ? t(categories.find(c => c.id === product.category_id)?.nameKey || '') : '-'}</td>
                                            <td className="p-4 text-brand-cyan font-bold">${product.price.toFixed(2)}</td>
                                            <td className="p-4 text-right">
                                                <div className="inline-flex gap-4">
                                                    <button onClick={() => handleEditProduct(product)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button>
                                                    <button onClick={() => handleDeleteProduct(product)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            
            {activeView === 'categories' && (
                 <div>
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 text-gray-400 bg-brand-dark p-2 rounded">
                            <AlertCircle size={16} />
                            <span className="text-sm">يتم حفظ الترتيب والأسماء تلقائياً في المسودة. اضغط حفظ لتطبيق التغييرات.</span>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={addCategory} className="bg-blue-500/80 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition-colors flex items-center gap-2"><Plus size={18} /> {t('add_category')}</button>
                            <button onClick={handleSaveCategories} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}</button>
                        </div>
                    </div>
                     <div className="space-y-4">
                        {categories.map((cat, index) => (
                            <div key={cat.id} className="bg-brand-dark-blue p-3 rounded-lg border border-brand-light-blue/50 flex items-center gap-4">
                                <GripVertical className="cursor-grab text-gray-500" />
                                <div className="flex-grow grid grid-cols-2 gap-3">
                                    <input type="text" value={cat.nameEn} onChange={(e) => handleCategoryChange(index, 'nameEn', e.target.value)} placeholder={t('category_name_en')} className="vixel-input" />
                                    <input type="text" dir="rtl" value={cat.nameAr} onChange={(e) => handleCategoryChange(index, 'nameAr', e.target.value)} placeholder={t('category_name_ar')} className="vixel-input" />
                                </div>
                                <button onClick={() => deleteCategory(index)} className="text-red-500 hover:text-red-400"><Trash2 size={20} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {editingProduct && (
                <Modal isOpen={!!editingProduct} onClose={() => { if(window.confirm('Discard unsaved changes?')) setEditingProduct(null); }} title={t(editingProduct.nameEn ? 'edit_product' : 'create_product')} maxWidth="lg">
                    <div className="space-y-4 text-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1 font-semibold text-gray-300">{t('name_en')}</label>
                                <input type="text" value={editingProduct.nameEn} onChange={(e) => setEditingProduct({ ...editingProduct, nameEn: e.currentTarget.value })} className="vixel-input" />
                            </div>
                            <div>
                                <label className="block mb-1 font-semibold text-gray-300">{t('name_ar')}</label>
                                <input type="text" dir="rtl" value={editingProduct.nameAr} onChange={(e) => setEditingProduct({ ...editingProduct, nameAr: e.currentTarget.value })} className="vixel-input" />
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block mb-1 font-semibold text-gray-300">{t('description_en')}</label>
                                <textarea value={editingProduct.descriptionEn} onChange={(e) => setEditingProduct({ ...editingProduct, descriptionEn: e.currentTarget.value })} className="vixel-input h-24" />
                            </div>
                            <div>
                                <label className="block mb-1 font-semibold text-gray-300">{t('description_ar')}</label>
                                <textarea dir="rtl" value={editingProduct.descriptionAr} onChange={(e) => setEditingProduct({ ...editingProduct, descriptionAr: e.currentTarget.value })} className="vixel-input h-24" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1 font-semibold text-gray-300">{t('price')}</label>
                                <input type="number" value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.currentTarget.value) || 0 })} className="vixel-input" />
                            </div>
                            <div>
                                <label className="block mb-1 font-semibold text-gray-300">{t('product_category')}</label>
                                <select value={editingProduct.category_id || ''} onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.currentTarget.value || null })} className="vixel-input appearance-none">
                                    <option value="">{t('no_category')}</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.nameEn}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('image_url')}</label>
                            <input type="text" value={editingProduct.imageUrl} onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.currentTarget.value })} className="vixel-input" />
                        </div>
                        <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                            <button onClick={() => { if(window.confirm('Discard unsaved changes?')) setEditingProduct(null); }} disabled={isSaving} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                            <button onClick={handleSaveProduct} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white min-w-[8rem] flex justify-center">
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
