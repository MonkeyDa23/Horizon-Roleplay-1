import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useCart } from '../contexts/CartContext';
import { useConfig } from '../contexts/ConfigContext';
import { getProductsWithCategories } from '../lib/api';
import type { Product, ProductCategory } from '../types';
import { ShoppingCart, PlusCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import SEO from '../components/SEO';
// FIX: Switched to namespace import for react-router-dom to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';

const StorePage: React.FC = () => {
  const { t } = useLocalization();
  const { addToCart } = useCart();
  const { config } = useConfig();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault(); // Prevent navigation when clicking the add to cart button
    e.stopPropagation();
    addToCart(product);
    showToast(t('item_added_to_cart', { itemName: t(product.nameKey) }), 'success');
  };
  
  const SkeletonCard: React.FC = () => (
    <div className="glass-panel p-1 animate-pulse">
      <div className="h-48 bg-background-light rounded-lg"></div>
      <div className="p-5">
        <div className="h-8 bg-background-light rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-background-light rounded w-full mb-2"></div>
        <div className="h-4 bg-background-light rounded w-1/2 mb-4"></div>
        <div className="flex justify-between items-center mt-auto">
          <div className="h-8 bg-background-light rounded w-1/3"></div>
          <div className="h-10 bg-primary-blue/20 rounded-md w-2/5"></div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <>
          <div className="h-10 bg-background-light rounded w-1/3 mb-6 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </>
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
    return categories.map(category => (
      <div key={category.id} className="mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 border-l-4 border-primary-blue pl-4">{t(category.nameKey)}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {category.products.map((product, index) => (
            <ReactRouterDOM.Link 
              to={`/store/${product.id}`}
              key={product.id} 
              className="block glass-panel overflow-hidden group hover:shadow-glow-blue hover:-translate-y-2 animate-stagger"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex flex-col h-full">
                  <div className="h-56 overflow-hidden">
                      <img src={product.imageUrl} alt={t(product.nameKey)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-in-out" />
                  </div>
                  <div className="p-6 flex flex-col flex-grow">
                      <h2 className="text-2xl font-bold text-white mb-2">{t(product.nameKey)}</h2>
                      <p className="text-text-secondary flex-grow mb-4 text-sm">{t(product.descriptionKey)}</p>
                      <div className="flex justify-between items-center mt-auto">
                          <p className="text-3xl font-bold text-primary-blue">${product.price.toFixed(2)}</p>
                          <button 
                              onClick={(e) => handleAddToCart(e, product)}
                              className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-all duration-300 flex items-center gap-2 z-10 transform group-hover:scale-105"
                              aria-label={`${t('add_to_cart')} ${t(product.nameKey)}`}
                          >
                              <PlusCircle size={20}/>
                              <span className="hidden sm:inline">{t('add_to_cart')}</span>
                          </button>
                      </div>
                  </div>
              </div>
            </ReactRouterDOM.Link>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('store')}`}
        description={`Browse and purchase exclusive VIP packages, in-game cash, and custom items for the ${communityName} server.`}
        keywords={`store, shop, vip, cash, items, perks, ${communityName.toLowerCase()}`}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-16 animate-fade-in-up">
          <div className="inline-block p-4 bg-background-light rounded-full mb-4 border-2 border-border-color shadow-lg">
            <ShoppingCart className="text-primary-blue" size={48} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{t('page_title_store', { communityName: config.COMMUNITY_NAME })}</h1>
        </div>
        
        {renderContent()}
      </div>
    </>
  );
};

export default StorePage;