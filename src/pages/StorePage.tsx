
import React, { useState, useEffect, useMemo } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useCart } from '../contexts/CartContext';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { getProductsWithCategories } from '../lib/api';
import type { Product, ProductCategory } from '../types';
import { ShoppingCart, PlusCircle, AlertTriangle, Wallet } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';

const ProductCard: React.FC<{ product: Product, index: number }> = ({ product, index }) => {
  const { t } = useLocalization();
  const { addToCart } = useCart();
  const { showToast } = useToast();

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
      className="block glass-panel overflow-hidden group hover:shadow-glow-blue hover:-translate-y-2 animate-stagger"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-col h-full">
          <div className="h-40 overflow-hidden bg-background-dark/50">
              <img src={product.imageUrl} alt={t(product.nameKey)} className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500 ease-in-out" />
          </div>
          <div className="p-4 flex flex-col flex-grow">
              <h2 className="text-lg font-bold text-white mb-1 leading-tight">{t(product.nameKey)}</h2>
              <p className="text-text-secondary flex-grow mb-3 text-xs line-clamp-2">{t(product.descriptionKey)}</p>
              <div className="flex justify-between items-center mt-auto">
                  <p className="text-xl font-bold text-primary-blue">${product.price.toFixed(2)}</p>
                  <button 
                      onClick={handleAddToCart}
                      className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-1.5 px-3 rounded-lg hover:opacity-90 transition-all duration-300 flex items-center gap-1 z-10 transform group-hover:scale-105 text-sm"
                      aria-label={`${t('add_to_cart')} ${t(product.nameKey)}`}
                  >
                      <PlusCircle size={16}/>
                      <span className="hidden sm:inline">{t('add_to_cart')}</span>
                  </button>
              </div>
          </div>
      </div>
    </Link>
  );
};

const StorePage: React.FC = () => {
  const { t } = useLocalization();
  const { config } = useConfig();
  const { user } = useAuth();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const communityName = config.COMMUNITY_NAME;

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedCategories = await getProductsWithCategories();
        setCategories(fetchedCategories || []);
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
    <div className="glass-panel p-1 animate-pulse">
      <div className="h-40 bg-background-light rounded-lg"></div>
      <div className="p-4">
        <div className="h-6 bg-background-light rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-background-light rounded w-full mb-1"></div>
        <div className="h-3 bg-background-light rounded w-1/2 mb-3"></div>
        <div className="flex justify-between items-center mt-auto">
          <div className="h-6 bg-background-light rounded w-1/3"></div>
          <div className="h-8 bg-primary-blue/20 rounded-md w-2/5"></div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      );
    }
    if (error) {
      return (
        <div className="glass-panel p-10 text-center text-red-400">
          <AlertTriangle size={48} className="mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Failed to Load Store</h2>
          <p>{error}</p>
        </div>
      );
    }
    if (categories.length === 0) {
      return (
        <div className="glass-panel p-10 text-center text-text-secondary">
          <h2 className="text-2xl">The store is currently empty.</h2>
          <p>Please check back later!</p>
        </div>
      );
    }
    return (
      <div key={selectedCategoryId} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
        description={`Browse and purchase exclusive VIP packages, in-game cash, and custom items for the ${communityName} server.`}
        keywords={`store, shop, vip, cash, items, perks, ${communityName.toLowerCase()}`}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 animate-fade-in-up gap-6">
            <div className="text-center md:text-start flex items-center gap-4">
                <div className="p-3 bg-background-light rounded-full border-2 border-border-color shadow-lg">
                    <ShoppingCart className="text-primary-blue" size={32} />
                </div>
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('page_title_store', { communityName: config.COMMUNITY_NAME })}</h1>
                </div>
            </div>
            {user && (
                <div className="glass-panel px-6 py-3 flex items-center gap-3 bg-gradient-to-r from-primary-blue/10 to-transparent border-primary-blue/30">
                    <Wallet className="text-accent-cyan" size={24} />
                    <div>
                        <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">{t('your_balance')}</p>
                        <p className="text-2xl font-bold text-white">${user.balance.toLocaleString()}</p>
                    </div>
                </div>
            )}
        </div>
        
        {/* Category Filter Buttons */}
        {!isLoading && !error && categories.length > 0 && (
           <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-12 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-300 transform hover:scale-105 ${selectedCategoryId === 'all' ? 'bg-primary-blue text-background-dark shadow-glow-blue' : 'glass-panel text-white hover:bg-primary-blue/20'}`}
              >
                  All
              </button>
              {categories.map(category => (
                  <button
                      key={category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-300 transform hover:scale-105 ${selectedCategoryId === category.id ? 'bg-primary-blue text-background-dark shadow-glow-blue' : 'glass-panel text-white hover:bg-primary-blue/20'}`}
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
