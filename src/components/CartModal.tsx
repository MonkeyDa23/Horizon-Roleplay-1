// src/components/CartModal.tsx
import React, { useState } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useCart } from '../hooks/useCart';
import { useConfig } from '../hooks/useConfig';
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
    window.open(config.DISCORD_INVITE_URL, '_blank');
    clearCart();
    closeAllModals();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999]"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      <div
        className="fixed top-0 end-0 bg-brand-dark-blue w-full max-w-md h-full flex flex-col shadow-2xl shadow-black/50 animate-slide-in z-[1000]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-heading"
      >
        <div className="p-6 border-b border-brand-light-blue flex justify-between items-center flex-shrink-0">
          <h2 id="cart-heading" className="text-2xl font-bold text-brand-cyan flex items-center gap-3">
            <ShoppingBag size={28}/>
            {t('your_cart')} ({totalItems})
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6">
            <ShoppingBag size={64} className="text-brand-light-blue mb-4"/>
            <p className="text-xl text-gray-400 font-semibold">{t('empty_cart')}</p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto p-6 space-y-6">
            {cartItems.map(item => (
              <div key={item.id} className="flex items-start gap-4">
                <img src={item.imageUrl} alt={t(item.nameKey)} className="w-24 h-24 rounded-md object-cover border-2 border-brand-light-blue" />
                <div className="flex-grow flex flex-col h-24">
                  <h3 className="text-lg font-semibold text-white">{t(item.nameKey)}</h3>
                  <p className="text-brand-cyan font-bold">${item.price.toFixed(2)}</p>
                  <div className="flex items-center gap-3 mt-auto">
                    <div className="flex items-center border border-gray-600 rounded-md">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 text-gray-400 hover:text-white"><Minus size={16} /></button>
                        <span className="px-3 font-bold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 text-gray-400 hover:text-white"><Plus size={16} /></button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-400 ml-auto" aria-label={t('remove')}>
                        <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {cartItems.length > 0 && (
          <div className="p-6 border-t border-brand-light-blue space-y-4 flex-shrink-0 bg-brand-dark">
            <div className="flex justify-between items-center text-xl">
              <span className="text-gray-300 font-semibold">{t('subtotal')}:</span>
              <span className="font-bold text-white text-2xl">${totalPrice.toFixed(2)}</span>
            </div>
            <button onClick={handleCheckout} className="w-full bg-brand-cyan text-brand-dark font-bold py-4 rounded-lg shadow-glow-cyan hover:bg-white transition-all duration-300 text-lg">
              {t('checkout')}
            </button>
          </div>
        )}
      </div>
      <style>{`
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
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-brand-light-blue mb-6">
                <DiscordLogo className="w-8 h-8 text-white"/>
            </div>
            <p className="text-gray-300 mb-8 leading-relaxed">
                {t('checkout_instructions')}
            </p>
            <button
                onClick={handleOpenTicket}
                className="flex items-center justify-center gap-3 w-full p-4 bg-[#5865F2] text-white font-bold rounded-lg hover:bg-[#4f5bda] transition-colors duration-300 text-lg"
            >
                <DiscordLogo className="w-7 h-7" />
                <span>{t('open_ticket')}</span>
            </button>
        </div>
      </Modal>
    </>
  );
};

export default CartModal;