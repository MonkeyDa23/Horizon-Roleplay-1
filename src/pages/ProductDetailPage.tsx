// src/pages/ProductDetailPage.tsx
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useLocalization } from '../hooks/useLocalization';
import { useCart } from '../hooks/useCart';
import { getProductById } from '../lib/api';
import type { Product } from '../types';
import { Loader2, PlusCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import SEO from '../components/SEO';
import { useConfig } from '../hooks/useConfig';

const ProductDetailPage: React.FC = () => {
    const { productId } = ReactRouterDOM.useParams<{ productId: string }>();
    const navigate = ReactRouterDOM.useNavigate();
    const { t } = useLocalization();
    const { addToCart } = useCart();
    const { showToast } = useToast();
    const { config } = useConfig();
    const [product, setProduct] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!productId) {
            navigate('/store');
            return;
        }
        const fetchProduct = async () => {
            setIsLoading(true);
            try {
                const fetchedProduct = await getProductById(productId);
                setProduct(fetchedProduct);
            } catch (error) {
                console.error("Failed to fetch product:", error);
                navigate('/store'); // Redirect if product not found
            } finally {
                setIsLoading(false);
            }
        };
        fetchProduct();
    }, [productId, navigate]);

    const handleAddToCart = () => {
        if (product) {
            addToCart(product);
            showToast(t('item_added_to_cart', { itemName: t(product.nameKey) }), 'success');
        }
    };
    
    if (isLoading) {
        return (
            <div className="container mx-auto px-6 py-16 flex justify-center items-center h-96">
                <Loader2 size={48} className="text-brand-cyan animate-spin" />
            </div>
        );
    }

    if (!product) {
        // This will be briefly visible before the redirect happens
        return <div className="text-center py-20">{t('product_not_found')}</div>;
    }

    return (
        <>
            <SEO
                title={`${config.COMMUNITY_NAME} - ${t(product.nameKey)}`}
                description={t(product.descriptionKey)}
                image={product.imageUrl}
            />
            <div className="container mx-auto px-6 py-16">
                <button onClick={() => navigate('/store')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={20} />
                    Back to Store
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 bg-brand-dark-blue p-8 rounded-lg border border-brand-light-blue/50">
                    <div className="animate-fade-in-left">
                        <img 
                            src={product.imageUrl} 
                            alt={t(product.nameKey)}
                            className="w-full h-auto object-cover rounded-lg shadow-2xl shadow-black/50 border-2 border-brand-light-blue"
                        />
                    </div>
                    <div className="flex flex-col justify-center animate-fade-in-right">
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{t(product.nameKey)}</h1>
                        <p className="text-lg text-gray-300 mb-6">{t(product.descriptionKey)}</p>
                        
                        <div className="mt-auto flex items-center gap-8 pt-6 border-t border-brand-light-blue/50">
                            <p className="text-4xl font-bold text-brand-cyan">${product.price.toFixed(2)}</p>
                            <button
                                onClick={handleAddToCart}
                                className="bg-brand-cyan text-brand-dark font-bold py-3 px-8 rounded-md hover:bg-white hover:shadow-glow-cyan transition-all duration-300 flex items-center gap-2 text-lg"
                                aria-label={`${t('add_to_cart')} ${t(product.nameKey)}`}
                            >
                                <PlusCircle size={24}/>
                                <span>{t('add_to_cart')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fade-in-left { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes fade-in-right { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .animate-fade-in-left { animation: fade-in-left 0.6s ease-out forwards; }
                .animate-fade-in-right { animation: fade-in-right 0.6s ease-out forwards; animation-delay: 0.2s; opacity: 0; }
            `}</style>
        </>
    );
};

export default ProductDetailPage;