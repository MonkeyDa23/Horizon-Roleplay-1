/**
 * Nova Roleplay - Official Website
 * Store Page
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useCart } from '../contexts/CartContext';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { getProductsWithCategories, revalidateSession } from '../lib/api';
import type { Product, ProductCategory } from '../types';
import { ShoppingCart, PlusCircle, AlertTriangle, Wallet, Loader2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';
import { useCurrency } from '../contexts/CurrencyContext';

const ProductCard: React.FC<{ product: Product, index: number }> = ({ product, index }) => {
  const { t } = useLocalization();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();
  const { branding } = useConfig();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    showToast(t('item_added_to_cart', { itemName: t(product.nameKey) || product.id }), 'success');
  };

  return (
    <Link 
      to={`/store/${product.id}`} 
      className="bg-white/[0.03] border border-white/10 rounded-[48px] overflow-hidden group hover:shadow-2xl transition-all duration-500 animate-stagger flex flex-col h-full"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="h-72 overflow-hidden bg-black/50 relative">
        <img 
          src={product.imageUrl} 
          alt={t(product.nameKey)} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/80 to-transparent opacity-80"></div>
      </div>
      
      <div className="p-10 flex flex-col flex-grow space-y-6">
        <h2 className="text-3xl font-black text-white leading-tight">{t(product.nameKey) || product.id}</h2>
        <p className="text-text-secondary flex-grow text-base line-clamp-3 leading-relaxed opacity-70">
          {t(product.descriptionKey)}
        </p>
        
        <div className="flex justify-between items-center pt-8 border-t border-white/5">
          <p className="text-4xl font-black" style={{ color: branding.primaryColor }}>
            {formatPrice(product.price)}
          </p>
          <button 
            onClick={handleAddToCart}
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl hover:scale-110 active:scale-95"
            style={{ backgroundColor: branding.primaryColor }}
            aria-label={t('add_to_cart')}
          >
            <PlusCircle size={28} className="text-brand-dark" />
          </button>
        </div>
      </div>
    </Link>
  );
};

const StorePage: React.FC = () => {
  const { t, dir } = useLocalization();
  const { branding } = useConfig();
  const { user, updateUser } = useAuth();
  const { formatPrice } = useCurrency();
  
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const communityName = branding.siteName || 'Nova Roleplay';

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedCategories = await getProductsWithCategories();
        setCategories(fetchedCategories || []);
        
        if (user) {
          try {
            const freshUser = await revalidateSession();
            updateUser(freshUser);
          } catch (e) {
            console.warn("Balance refresh failed", e);
          }
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
        setError((err as Error).message || "An unknown error occurred while fetching store items.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const displayedProducts = useMemo(() => {
    if (selectedCategoryId === 'all') {
      return categories.flatMap(category => category.products);
    }
    return categories.find(category => category.id === selectedCategoryId)?.products || [];
  }, [selectedCategoryId, categories]);

  const SkeletonCard: React.FC = () => (
    <div className="glass-panel animate-pulse h-[550px] p-0 space-y-8">
      <div className="h-72 bg-white/5"></div>
      <div className="px-10 space-y-4">
        <div className="h-10 bg-white/5 rounded-2xl w-3/4"></div>
        <div className="h-6 bg-white/5 rounded-xl w-full"></div>
        <div className="h-6 bg-white/5 rounded-xl w-1/2"></div>
      </div>
      <div className="px-10 pt-10 flex justify-between items-center">
        <div className="h-12 bg-white/5 rounded-2xl w-1/3"></div>
        <div className="h-14 bg-white/5 rounded-2xl w-14"></div>
      </div>
    </div>
  );

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('store') || 'المتجر'}`} 
        description={`تسوق الآن في متجر ${communityName} الرسمي للحصول على أفضل المميزات الحصرية.`}
      />

      <div className="container-custom" dir={dir}>
        <div className="flex flex-col lg:flex-row justify-between items-center gap-12 mb-24">
          <div className={`space-y-6 text-center lg:text-start flex flex-col lg:flex-row items-center gap-10`}>
            <div className="w-28 h-28 bg-white/5 rounded-[40px] flex items-center justify-center border border-white/10 shadow-2xl relative">
              <div className="absolute inset-0 blur-2xl opacity-20 rounded-full" style={{ backgroundColor: branding.primaryColor }}></div>
              <ShoppingCart style={{ color: branding.primaryColor }} size={54} className="relative z-10" />
            </div>
            <div>
              <h1 className="text-5xl md:text-8xl font-black text-white mb-4 leading-tight">{t('store_title') || 'متجر المجتمع'}</h1>
              <p className="text-text-secondary text-2xl font-medium opacity-70">
                {t('store_subtitle') || 'دعمكم لنا يساعدنا على الاستمرار وتقديم الأفضل دائماً.'}
              </p>
            </div>
          </div>

          {user && (
            <div className="glass-panel p-2 flex items-center gap-2 rounded-[50px]">
              <div className="px-10 py-8 rounded-[48px] bg-white/[0.02] border border-white/5 flex items-center gap-8 shadow-inner">
                <div 
                  className="w-20 h-20 rounded-[28px] flex items-center justify-center border border-white/10" 
                  style={{ backgroundColor: `${branding.primaryColor}11` }}
                >
                  <Wallet style={{ color: branding.primaryColor }} size={40} />
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase font-black mb-1 opacity-50 tracking-widest">{t('your_balance')}</p>
                  <p className="text-5xl font-black text-white">{formatPrice(user.balance)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Categories Section */}
        {!isLoading && !error && categories.length > 0 && (
          <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-20">
            <button 
              onClick={() => setSelectedCategoryId('all')}
              className={`px-10 py-5 text-lg font-black rounded-3xl transition-all duration-300 border-2 ${selectedCategoryId === 'all' ? 'text-brand-dark border-transparent shadow-xl' : 'bg-white/5 text-text-secondary border-transparent hover:bg-white/10 hover:text-white'}`}
              style={{ backgroundColor: selectedCategoryId === 'all' ? branding.primaryColor : undefined }}
            >
              {t('all_items') || 'عرض الكل'}
            </button>
            {categories.map(category => (
              <button 
                key={category.id} 
                onClick={() => setSelectedCategoryId(category.id)}
                className={`px-10 py-5 text-lg font-black rounded-3xl transition-all duration-300 border-2 ${selectedCategoryId === category.id ? 'text-brand-dark border-transparent shadow-xl' : 'bg-white/5 text-text-secondary border-transparent hover:bg-white/10 hover:text-white'}`}
                style={{ backgroundColor: selectedCategoryId === category.id ? branding.primaryColor : undefined }}
              >
                {t(category.nameKey) || category.id}
              </button>
            ))}
          </div>
        )}

        {/* Products Grid */}
        <div className="min-h-[400px]">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="glass-panel p-20 text-center text-red-400 max-w-4xl mx-auto">
              <AlertTriangle size={80} className="mx-auto mb-8 opacity-20" />
              <h2 className="text-4xl font-black mb-6">{t('store_load_failed')}</h2>
              <p className="text-xl font-medium opacity-70">{error}</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="glass-panel p-24 text-center max-w-4xl mx-auto space-y-8">
              <ShoppingCart size={100} className="mx-auto opacity-5" />
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-white">{t('store_empty')}</h2>
                <p className="text-xl text-text-secondary font-medium">{t('store_empty_desc')}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {displayedProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default StorePage;
