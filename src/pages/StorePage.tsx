import React, { useState, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useCart } from '../hooks/useCart';
import { useConfig } from '../hooks/useConfig';
import { getProducts } from '../lib/api';
import type { Product } from '../types';
import { ShoppingCart, PlusCircle } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import SEO from '../components/SEO';
// FIX: Switched to named import for react-router-dom components as per standard usage.
import { Link } from 'react-router-dom';

const StorePage: React.FC = () => {
  const { t } = useLocalization();
  const { addToCart } = useCart();
  const { config } = useConfig();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const communityName = config.COMMUNITY_NAME;

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const fetchedProducts = await getProducts();
        setProducts(fetchedProducts);
      } catch (error) {
        console.error("Failed to fetch products:", error);
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
    <div className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg overflow-hidden flex flex-col animate-pulse">
      <div className="h-48 bg-brand-light-blue"></div>
      <div className="p-6 flex flex-col flex-grow">
        <div className="h-8 bg-brand-light-blue rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-brand-light-blue rounded w-full mb-2"></div>
        <div className="h-4 bg-brand-light-blue rounded w-1/2 mb-4"></div>
        <div className="flex justify-between items-center mt-auto">
          <div className="h-8 bg-brand-light-blue rounded w-1/3"></div>
          <div className="h-10 bg-brand-cyan/20 rounded-md w-2/5"></div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('store')}`}
        description={`Browse and purchase exclusive VIP packages, in-game cash, and custom items for the ${communityName} server.`}
        keywords={`store, shop, vip, cash, items, perks, ${communityName.toLowerCase()}`}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
            <ShoppingCart className="text-brand-cyan" size={48} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">{t('page_title_store', { communityName: config.COMMUNITY_NAME })}</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {isLoading ? (
            [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          ) : (
            products.map((product) => (
              // FIX: Use named import 'Link' instead of 'ReactRouterDOM.Link'.
              <Link 
                to={`/store/${product.id}`}
                key={product.id} 
                className="block bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg overflow-hidden group transition-all duration-300 hover:shadow-glow-cyan hover:-translate-y-1"
              >
                <div className="flex flex-col h-full">
                    <div className="h-48 overflow-hidden">
                        <img src={product.imageUrl} alt={t(product.nameKey)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="p-6 flex flex-col flex-grow">
                        <h2 className="text-2xl font-bold text-white mb-2">{t(product.nameKey)}</h2>
                        <p className="text-gray-400 flex-grow mb-4">{t(product.descriptionKey)}</p>
                        <div className="flex justify-between items-center mt-auto">
                            <p className="text-2xl font-bold text-brand-cyan">${product.price.toFixed(2)}</p>
                            <button 
                                onClick={(e) => handleAddToCart(e, product)}
                                className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white hover:shadow-glow-cyan transition-all duration-300 flex items-center gap-2 z-10"
                                aria-label={`${t('add_to_cart')} ${t(product.nameKey)}`}
                            >
                                <PlusCircle size={20}/>
                                <span>{t('add_to_cart')}</span>
                            </button>
                        </div>
                    </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default StorePage;