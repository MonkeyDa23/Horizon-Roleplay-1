
// src/components/CartModal.tsx
import React, { useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useCart } from '../contexts/CartContext';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { processPurchase, sendDiscordLog, revalidateSession } from '../lib/api';
import Modal from './Modal';
import { Trash2, ShoppingBag, Plus, Minus, Send, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import DiscordLogo from './icons/DiscordLogo';


interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CartModal: React.FC<CartModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLocalization();
  const { cartItems, removeFromCart, updateQuantity, totalItems, totalPrice, clearCart } = useCart();
  const { config } = useConfig();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleCheckout = () => {
    onClose(); // Close cart modal
    setCheckoutModalOpen(true); // Open checkout modal
  };
  
  const handleOpenTicket = () => {
    if (typeof window !== 'undefined') {
      (window as any).open(config.DISCORD_INVITE_URL, '_blank');
    }
    clearCart();
    setCheckoutModalOpen(false);
  };

  const handleSecurePurchase = async () => {
      if (!user) return;
      setIsProcessing(true);
      try {
          const details = cartItems.map(i => `${i.quantity}x ${t(i.nameKey)}`).join(', ');
          
          // 1. Call Secure RPC
          await processPurchase(totalPrice, details);
          
          // 2. Refresh local user balance
          const freshUser = await revalidateSession();
          updateUser(freshUser);

          // 3. Log to STORE Channel
          const logEmbed = {
              title: "🛒 عملية شراء جديدة",
              description: `قام العضو **${user.username}** بشراء منتجات من المتجر.`,
              color: 0x00A9FF, // Blue
              fields: [
                  { name: "المنتجات", value: details },
                  { name: "المبلغ المخصوم", value: `$${totalPrice.toFixed(2)}`, inline: true },
                  { name: "الرصيد المتبقي", value: `$${freshUser.balance.toLocaleString()}`, inline: true }
              ],
              author: { name: user.username, icon_url: user.avatar },
              timestamp: new Date().toISOString(),
              footer: { text: "سجل المتجر" }
          };
          await sendDiscordLog(config, logEmbed, 'store');

          showToast(t('purchase_success_title'), 'success');
          clearCart();
          setCheckoutModalOpen(false);

      } catch (error) {
          console.error(error);
          showToast(t('purchase_failed') + ` ${(error as Error).message}`, 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  // Financial Logic (Robust)
  const userBalance = user && typeof user.balance === 'number' ? user.balance : 0;
  // If user has enough balance for the WHOLE cart, we enable direct purchase.
  // Otherwise, they can use balance as partial payment (ticket flow) - logic kept for flexibility
  const canFullyPay = userBalance >= totalPrice;
  
  const deduction = Math.min(userBalance, totalPrice);
  const remainingToPay = Math.max(0, totalPrice - deduction);
  const remainingBalance = Math.max(0, userBalance - deduction);

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
            <div className="flex-grow overflow-y-auto max-h-[50vh] pr-4 -mr-4 space-y-4 custom-scrollbar">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center gap-4 bg-background-dark/50 p-3 rounded-lg border border-white/5">
                  <img src={item.imageUrl} alt={t(item.nameKey)} className="w-20 h-20 rounded-md object-cover border border-border-color" />
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
            
            {/* Financial Summary Section */}
            <div className="mt-6 pt-6 border-t border-border-color space-y-3 bg-background-dark/30 p-5 rounded-lg border border-white/5">
                <div className="flex justify-between items-center text-gray-400 text-lg">
                    <span>{t('subtotal')}</span>
                    <span className="font-bold text-white">${totalPrice.toFixed(2)}</span>
                </div>
                
                {user && userBalance > 0 && (
                    <>
                        <div className="flex justify-between items-center text-accent-cyan text-lg">
                            <span className="flex items-center gap-2"><CreditCard size={20}/> {t('pay_from_balance')}</span>
                            <span className="font-bold">-${deduction.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-500 pt-2 border-t border-white/5">
                            <span>{t('remaining_balance')}</span>
                            <span className="font-mono">${remainingBalance.toFixed(2)}</span>
                        </div>
                    </>
                )}
                
                <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-2">
                    <span className="text-xl font-bold text-white">{t('amount_to_pay')}</span>
                    <span className={`text-4xl font-extrabold ${remainingToPay === 0 ? 'text-green-400' : 'text-primary-blue'}`}>${remainingToPay.toFixed(2)}</span>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={handleCheckout} 
                className={`w-full font-bold py-4 px-8 rounded-xl shadow-lg transition-all duration-300 text-xl flex justify-center items-center gap-3 ${remainingToPay === 0 ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-500/20' : 'bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark shadow-glow-blue hover:opacity-90'}`}
              >
                {remainingToPay === 0 ? <><CheckCircle size={24} /> {t('confirm_invoice')}</> : t('checkout')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    
      <Modal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} title={remainingToPay === 0 ? "Order Confirmation" : t('checkout_via_discord')}>
        <div className="text-center p-4">
            {remainingToPay === 0 ? (
                 <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-full bg-green-500/20 border-2 border-green-500 mb-8">
                    <CheckCircle className="w-12 h-12 text-green-400"/>
                </div>
            ) : (
                <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-full bg-gradient-to-br from-primary-blue to-accent-cyan mb-8 shadow-lg shadow-primary-blue/30">
                    <DiscordLogo className="w-12 h-12 text-background-dark"/>
                </div>
            )}
            
            <h2 className="text-3xl font-bold text-white mb-4">{remainingToPay === 0 ? "Order Ready!" : "Complete Your Purchase"}</h2>
            
            <p className="text-text-secondary mb-8 leading-relaxed max-w-md mx-auto text-lg">
                {remainingToPay === 0 
                    ? t('purchase_success_body')
                    : t('checkout_instructions')
                }
            </p>
            
            {remainingToPay === 0 ? (
                <button
                    onClick={handleSecurePurchase}
                    disabled={isProcessing}
                    className="group flex items-center justify-center gap-3 w-full p-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition-all duration-300 text-xl transform hover:scale-[1.02] shadow-xl"
                >
                    {isProcessing ? <Loader2 className="animate-spin" /> : <><CheckCircle className="w-6 h-6" /> <span>تأكيد الشراء (خصم من الرصيد)</span></>}
                </button>
            ) : (
                <button
                    onClick={handleOpenTicket}
                    className="group flex items-center justify-center gap-3 w-full p-4 bg-[#5865F2] text-white font-bold rounded-xl hover:bg-[#4f5bda] transition-all duration-300 text-xl transform hover:scale-[1.02] shadow-xl"
                >
                    <Send className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1" />
                    <span>{t('open_ticket')}</span>
                </button>
            )}
        </div>
      </Modal>
    </>
  );
};

export default CartModal;
