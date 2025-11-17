// src/components/CartModal.tsx
import React, { useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useCart } from '../contexts/CartContext';
import { useConfig } from '../contexts/ConfigContext';
import Modal from './Modal';
import { Trash2, ShoppingBag, Plus, Minus, Send } from 'lucide-react';
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
  
  const handleCheckout = () => {
    onClose(); // Close cart modal
    setCheckoutModalOpen(true); // Open checkout modal
  };
  
  const handleOpenTicket = () => {
    // FIX: Guard against window access in non-browser environments.
    if (typeof window !== 'undefined') {
      // FIX: Cast window to any to bypass potential tsconfig lib errors for 'open'.
      (window as any).open(config.DISCORD_INVITE_URL, '_blank');
    }
    clearCart();
    setCheckoutModalOpen(false);
  };

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={`${t('your_cart')} (${totalItems})`} 
        maxWidth="2xl"
      >
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-12">
            <ShoppingBag size={64} className="text-text-secondary/50 mb-6"/>
            <p className="text-2xl text-text-secondary font-semibold">{t('empty_cart')}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex-grow overflow-y-auto max-h-[50vh] pr-4 -mr-4 space-y-4">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center gap-4 bg-background-dark/50 p-3 rounded-lg">
                  <img src={item.imageUrl} alt={t(item.nameKey)} className="w-20 h-20 rounded-md object-cover border-2 border-border-color" />
                  <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-white">{t(item.nameKey)}</h3>
                    <p className="text-primary-blue font-bold text-lg">${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-border-color rounded-md bg-background-light">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 text-text-secondary hover:text-white"><Minus size={16} /></button>
                      <span className="px-3 font-bold text-text-primary">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 text-text-secondary hover:text-white"><Plus size={16} /></button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-400 p-2 rounded-full hover:bg-red-500/20" aria-label={t('remove')}>
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-border-color flex justify-between items-center">
              <div>
                <span className="text-text-secondary font-semibold text-lg">{t('subtotal')}:</span>
                <span className="font-bold text-white text-3xl ml-3">${totalPrice.toFixed(2)}</span>
              </div>
              <button onClick={handleCheckout} className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-8 rounded-lg shadow-glow-blue hover:opacity-90 transition-all duration-300 text-lg">
                {t('checkout')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    
      <Modal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} title={t('checkout_via_discord')}>
        <div className="text-center p-4">
            <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-full bg-gradient-to-br from-primary-blue to-accent-cyan mb-8 shadow-lg shadow-primary-blue/30">
                <DiscordLogo className="w-12 h-12 text-background-dark"/>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Complete Your Purchase on Discord</h2>
            <p className="text-text-secondary mb-8 leading-relaxed max-w-md mx-auto">
                {t('checkout_instructions')}
            </p>
            <button
                onClick={handleOpenTicket}
                className="group flex items-center justify-center gap-3 w-full p-4 bg-[#5865F2] text-white font-bold rounded-lg hover:bg-[#4f5bda] transition-all duration-300 text-lg transform hover:scale-105"
            >
                <Send className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1" />
                <span>{t('open_ticket')}</span>
            </button>
        </div>
      </Modal>
    </>
  );
};

export default CartModal;