// src/components/CartModal.tsx
import React, { useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useCart } from '../contexts/CartContext';
import { useConfig } from '../contexts/ConfigContext';
import Modal from './Modal';
import { X, Trash2, ShoppingBag, Plus, Minus } from 'lucide-react';
import DiscordLogo from './icons/DiscordLogo';


interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CartModal: React.FC<CartModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLocalization();
  const { cartItems, removeFromCart, updateQuantity, totalItems, totalPrice, clearCart } = useCart();
  const { config } = useConfig();
  const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
  
  if (!isOpen) return null;

  const handleCheckout = () => {
    setCheckoutModalOpen(true);
  };

  const closeAllModals = () => {
    setCheckoutModalOpen(false);
    onClose();
  };
  
  const handleOpenTicket = () => {
    // FIX: Guard against window access in non-browser environments.
    if (typeof window !== 'undefined') {
      // FIX: Cast window to any to bypass potential tsconfig lib errors for 'open'.
      (window as any).open(config.DISCORD_INVITE_URL, '_blank');
    }
    clearCart();
    closeAllModals();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      <div
        className="fixed top-0 end-0 bg-background-dark/80 backdrop-blur-xl border-l border-border-color w-full max-w-md h-full flex flex-col shadow-2xl shadow-black/50 animate-slide-in z-[1000]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-heading"
      >
        <div className="p-6 border-b border-border-color flex justify-between items-center flex-shrink-0">
          <h2 id="cart-heading" className="text-2xl font-bold text-primary-blue flex items-center gap-3">
            <ShoppingBag size={28}/>
            {t('your_cart')} ({totalItems})
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-text-secondary hover:text-white hover:bg-white/10 transition-colors">
            <X size={24} />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6">
            <ShoppingBag size={64} className="text-background-light mb-4"/>
            <p className="text-xl text-text-secondary font-semibold">{t('empty_cart')}</p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto p-6 space-y-6">
            {cartItems.map(item => (
              <div key={item.id} className="flex items-start gap-4">
                <img src={item.imageUrl} alt={t(item.nameKey)} className="w-24 h-24 rounded-md object-cover border-2 border-border-color" />
                <div className="flex-grow flex flex-col h-24">
                  <h3 className="text-lg font-semibold text-white">{t(item.nameKey)}</h3>
                  <p className="text-primary-blue font-bold">${item.price.toFixed(2)}</p>
                  <div className="flex items-center gap-3 mt-auto">
                    <div className="flex items-center border border-border-color rounded-md bg-background-light/50">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 text-text-secondary hover:text-white"><Minus size={16} /></button>
                        <span className="px-3 font-bold text-text-primary">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 text-text-secondary hover:text-white"><Plus size={16} /></button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-400 ml-auto p-2 rounded-full hover:bg-red-500/20" aria-label={t('remove')}>
                        <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {cartItems.length > 0 && (
          <div className="p-6 border-t border-border-color space-y-4 flex-shrink-0 bg-background-dark/80">
            <div className="flex justify-between items-center text-xl">
              <span className="text-text-secondary font-semibold">{t('subtotal')}:</span>
              <span className="font-bold text-white text-2xl">${totalPrice.toFixed(2)}</span>
            </div>
            <button onClick={handleCheckout} className="w-full bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-4 rounded-lg shadow-glow-blue hover:opacity-90 transition-all duration-300 text-lg">
              {t('checkout')}
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
      `}</style>
    
      <Modal isOpen={isCheckoutModalOpen} onClose={closeAllModals} title={t('checkout_via_discord')}>
        <div className="text-center">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-background-light border-2 border-border-color mb-6">
                <DiscordLogo className="w-8 h-8 text-white"/>
            </div>
            <p className="text-text-secondary mb-8 leading-relaxed">
                {t('checkout_instructions')}
            </p>
            <button
                onClick={handleOpenTicket}
                className="group flex items-center justify-center gap-3 w-full p-4 bg-[#5865F2] text-white font-bold rounded-lg hover:bg-[#4f5bda] transition-all duration-300 text-lg transform hover:scale-105"
            >
                <DiscordLogo className="w-7 h-7 transition-transform duration-300 group-hover:scale-110" />
                <span>{t('open_ticket')}</span>
            </button>
        </div>
      </Modal>
    </>
  );
};

export default CartModal;