/**
 * Florida Roleplay - Official Website
 * Store Page
 * Copyright (c) 2024 Florida Roleplay. All rights reserved.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useCart } from '../contexts/CartContext';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { getProductsWithCategories, revalidateSession } from '../lib/api';
import type { Product, ProductCategory } from '../types';
import { ShoppingCart, PlusCircle, AlertTriangle, Wallet } from 'lucide-react';
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
    showToast(t('item_added_to_cart', { itemName: t(product.nameKey) }), 'success');
  };

  return (
    <Link 
      to={`/store/${product.id}`}
      key={product.id} 
      className="block bg-white/[0.03] border border-white/10 rounded-[40px] overflow-hidden group hover:shadow-2xl transition-all duration-500 animate-stagger h-full"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-col h-full min-h-[400px]">
          <div className="h-64 overflow-hidden bg-black/50 relative">
              <img src={product.imageUrl} alt={t(product.nameKey)} className="w-full h-full object-cover p-0 group-hover:scale-110 transition-transform duration-700 ease-in-out" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark to-transparent opacity-60"></div>
          </div>
          <div className="p-8 flex flex-col flex-grow">
              <h2 className="text-2xl font-black text-white mb-3 leading-tight tracking-tight">{t(product.nameKey)}</h2>
              <p className="text-text-secondary flex-grow mb-6 text-sm line-clamp-3 leading-relaxed opacity-80">{t(product.descriptionKey)}</p>
              <div className="flex justify-between items-center mt-auto pt-6 border-t border-white/5">
                  <p className="text-3xl font-black" style={{ color: branding.primaryColor }}>{formatPrice(product.price)}</p>
                  <button 
                      onClick={handleAddToCart}
                      className="px-6 py-3 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-lg text-brand-dark shadow-brand-cyan/20"
                      style={{ backgroundColor: branding.primaryColor }}
                      aria-label={`${t('add_to_cart')} ${t(product.nameKey)}`}
                  >
                      <PlusCircle size={20} className="inline-block relative -top-px mr-2" />
                      <span className="hidden sm:inline">{t('add_to_cart')}</span>
                  </button>
              </div>
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
  const communityName = branding.siteName;

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedCategories = await getProductsWithCategories();
        setCategories(fetchedCategories || []);
        
        // Important: Refresh user session to get the absolute latest balance
        if (user) {
            try {
                const freshUser = await revalidateSession();
                updateUser(freshUser);
            } catch (e) { console.warn("Balance refresh failed", e); }
        }

      } catch (err) {
        console.error("Failed to fetch products:", err);
        setError((err as Error).message || "An unknown error occurred while fetching store items.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const displayedProducts = useMemo(() => {
    if (selectedCategoryId === 'all') {
      return categories.flatMap(category => category.products);
    }
    return categories.find(category => category.id === selectedCategoryId)?.products || [];
  }, [selectedCategoryId, categories]);

  const SkeletonCard: React.FC = () => (
    <div className="bg-white/[0.03] border border-white/10 rounded-[40px] p-1 animate-pulse h-[450px]">
      <div className="h-64 bg-white/5 rounded-t-[32px]"></div>
      <div className="p-8">
        <div className="h-8 bg-white/5 rounded-2xl w-3/4 mb-4"></div>
        <div className="h-4 bg-white/5 rounded-xl w-full mb-2"></div>
        <div className="h-4 bg-white/5 rounded-xl w-1/2 mb-6"></div>
        <div className="flex justify-between items-center mt-auto">
          <div className="h-10 bg-white/5 rounded-2xl w-1/3"></div>
          <div className="h-12 bg-white/5 rounded-2xl w-2/5"></div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      );
    }
    if (error) {
      return (
        <div className="bg-red-500/10 border border-red-500/20 p-20 rounded-[50px] text-center text-red-400">
          <AlertTriangle size={64} className="mx-auto mb-6 opacity-50" />
          <h2 className="text-3xl font-black mb-4">{t('store_load_failed')}</h2>
          <p className="text-lg opacity-80">{error}</p>
        </div>
      );
    }
    if (categories.length === 0) {
      return (
        <div className="bg-white/[0.03] border border-white/10 p-20 rounded-[50px] text-center text-text-secondary">
          <ShoppingCart size={64} className="mx-auto mb-6 opacity-20" />
          <h2 className="text-3xl font-black mb-4">{t('store_empty')}</h2>
          <p className="text-lg opacity-80">{t('store_empty_desc')}</p>
        </div>
      );
    }
    return (
      <div key={selectedCategoryId} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {displayedProducts.map((product, index) => (
          <ProductCard key={product.id} product={product} index={index} />
        ))}
      </div>
    );
  };

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('store')}`}
        description={t('store_seo_desc', { communityName })}
        keywords={`store, shop, vip, cash, items, perks, ${(communityName || "").toLowerCase()}`}
      />
      <div className="container mx-auto px-6 py-24 max-w-[1400px]" dir={dir}>
        <div className="flex flex-col xl:flex-row justify-between items-center mb-24 gap-12">
            <div className={`text-center flex flex-col md:flex-row items-center gap-8 ${dir === 'rtl' ? 'md:text-right' : 'md:text-left'}`}>
                <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center border border-white/10 shadow-2xl relative">
                    <div className="absolute inset-0 blur-2xl opacity-20 rounded-full" style={{ backgroundColor: branding.primaryColor }}></div>
                    <ShoppingCart style={{ color: branding.primaryColor }} size={48} className="relative z-10" />
                </div>
                <div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-4">
                      {t('store_title')}
                    </h1>
                    <p className="text-text-secondary text-xl font-medium opacity-80 tracking-tight">{t('store_subtitle')}</p>
                </div>
            </div>

            {user && (
                <div className="bg-white/[0.03] border border-white/10 p-2 rounded-[40px] flex items-center gap-2">
                  <div className="px-8 py-6 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10" style={{ backgroundColor: `${branding.primaryColor}11` }}>
                          <Wallet style={{ color: branding.primaryColor }} size={32} />
                      </div>
                      <div>
                          <p className="text-[10px] text-text-secondary uppercase font-black tracking-widest mb-1 opacity-60">{t('your_balance')}</p>
                          <p className="text-4xl font-black text-white tracking-tighter">{formatPrice(user.balance)}</p>
                      </div>
                  </div>
                </div>
            )}
        </div>
        
        {/* Category Filter Buttons */}
        {!isLoading && !error && categories.length > 0 && (
           <div className="flex flex-wrap justify-center gap-3 mb-20">
              <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-8 py-4 text-sm font-black rounded-2xl transition-all duration-300 transform border-2 ${selectedCategoryId === 'all' ? 'text-brand-dark border-transparent shadow-2xl' : 'bg-white/5 text-text-secondary border-transparent hover:bg-white/10 hover:text-white'}`}
                  style={{ 
                    backgroundColor: selectedCategoryId === 'all' ? branding.primaryColor : undefined,
                    boxShadow: selectedCategoryId === 'all' ? `0 20px 40px -10px ${branding.primaryColor}44` : 'none'
                  }}
              >
                  {t('all_items')}
              </button>
              {categories.map(category => (
                  <button
                      key={category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`px-8 py-4 text-sm font-black rounded-2xl transition-all duration-300 transform border-2 ${selectedCategoryId === category.id ? 'text-brand-dark border-transparent shadow-2xl' : 'bg-white/5 text-text-secondary border-transparent hover:bg-white/10 hover:text-white'}`}
                      style={{ 
                        backgroundColor: selectedCategoryId === category.id ? branding.primaryColor : undefined,
                        boxShadow: selectedCategoryId === category.id ? `0 20px 40px -10px ${branding.primaryColor}44` : 'none'
                      }}
                  >
                      {t(category.nameKey)}
                  </button>
              ))}
          </div>
        )}

        {renderContent()}
      </div>
    </>
  );
};

export default StorePage;
