/**
 * Nova Roleplay - Official Website
 * Navigation Bar Component
 */
import React, { useState, useRef } from 'react';
import { NavLink as RouterNavLink, Link } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useConfig } from '../contexts/ConfigContext';
import { useCurrency } from '../contexts/CurrencyContext';
import type { Currency } from '../types';
import CartModal from './CartModal';
import LoginCaptchaModal from './LoginCaptchaModal';
import { 
  Globe, 
  ChevronDown, 
  LogOut, 
  Loader2, 
  ShoppingCart, 
  UserCog, 
  FileText, 
  User, 
  Menu, 
  X, 
  Coins, 
  CheckCircle,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DiscordLogo from './icons/DiscordLogo';

const NavLink: React.FC<{ to: string; children: React.ReactNode; onClick?: () => void }> = ({ to, children, onClick }) => {
  const { branding } = useConfig();
  return (
    <RouterNavLink 
      to={to} 
      onClick={onClick}
      className={({ isActive }) => 
        `relative text-text-secondary hover:text-white transition-all duration-500 font-extrabold group py-2 ${isActive ? 'text-white' : 'opacity-60 hover:opacity-100'}`
      }
      end={to === '/'}
    >
      {children}
      <span className="absolute -bottom-1 left-0 w-full h-1 rounded-full bg-primary-blue transition-all duration-500 origin-left scale-x-0 group-hover:scale-x-100" style={{ backgroundColor: branding.primaryColor }}></span>
    </RouterNavLink>
  );
};

const UserMenuLink: React.FC<{ to: string; children: React.ReactNode; icon: React.ElementType; onClick?: () => void }> = ({ to, children, icon: Icon, onClick }) => {
  const { branding } = useConfig();
  return (
    <Link 
      to={to} 
      onClick={onClick} 
      className="flex items-center gap-6 w-full text-start px-8 py-6 text-xl font-black text-text-secondary hover:bg-white/[0.05] hover:text-white rounded-[32px] transition-all group"
    >
      <Icon size={32} className="opacity-40 group-hover:opacity-100 transition-all" style={{ color: branding.primaryColor }} />
      {children}
    </Link>
  );
};

const Navbar: React.FC = () => {
  const { language, setLanguage, t, dir } = useLocalization();
  const { currency, setCurrency } = useCurrency();
  const { user, logout, loading, hasPermission } = useAuth();
  const { totalItems } = useCart();
  const { branding } = useConfig();
  
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isLoginCaptchaOpen, setLoginCaptchaOpen] = useState(false);

  const navLinks = [
    { to: '/', text: t('nav_home') || 'Home' },
    { to: '/store', text: t('nav_store') || 'Store' },
    { to: '/rules', text: t('nav_rules') || 'Rules' },
    { to: '/applies', text: t('nav_applies') || 'Apps' },
    { to: '/about', text: t('nav_about') || 'About' },
  ];

  const closeAllMenus = () => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    setLangDropdownOpen(false);
    setCurrencyDropdownOpen(false);
  };

  const isRTL = dir === 'rtl';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[60] px-4 pt-4 sm:px-6 sm:pt-6" dir={dir}>
        <div className="max-w-[1600px] mx-auto">
          <div className="bg-brand-dark/40 backdrop-blur-3xl rounded-[40px] border border-white/5 p-2 px-6 md:px-10 flex items-center justify-between shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
            
            {/* 1. Branding (End in AR, Start in EN) */}
            <div className={`flex items-center gap-4 flex-1 ${isRTL ? 'justify-end order-last' : 'justify-start order-first'}`}>
              <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/5 border border-white/10 p-0.5 shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50"></div>
                  {branding.logoUrl ? (
                    <img 
                      src={branding.logoUrl} 
                      alt="" 
                      className="w-full h-full object-cover rounded-full" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center rounded-full" style={{ backgroundColor: `${branding.primaryColor}22` }}>
                      <Globe style={{ color: branding.primaryColor }} size={24} />
                    </div>
                  )}
                  <div className="absolute inset-0 border-2 border-white/10 rounded-full group-hover:border-white/30 transition-colors"></div>
                </div>
                <div className="hidden md:block">
                  <h1 className="text-lg md:text-xl font-black text-white leading-none tracking-tight">{branding.siteName}</h1>
                  <span className="text-[10px] font-black opacity-40 uppercase tracking-widest" style={{ color: branding.primaryColor }}>Community</span>
                </div>
              </Link>
            </div>

            {/* 2. Middle Nav (Hidden on Mobile) */}
            <div className="hidden lg:flex items-center justify-center p-1.5 bg-white/[0.03] rounded-[24px] border border-white/5 shadow-inner">
              <div className="flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-4 py-2 rounded-xl text-[12px] font-black transition-all whitespace-nowrap ${
                      location.pathname === link.to
                        ? 'text-brand-dark shadow-xl'
                        : 'text-text-secondary hover:text-white hover:bg-white/5'
                    }`}
                    style={{ 
                      backgroundColor: location.pathname === link.to ? branding.primaryColor : undefined,
                    }}
                  >
                    {link.text}
                  </Link>
                ))}
              </div>
            </div>

            {/* 3. Actions (Start in AR, End in EN) */}
            <div className={`flex items-center gap-3 md:gap-4 flex-1 ${isRTL ? 'justify-start order-first' : 'justify-end order-last'}`}>
              
              <div className="hidden sm:flex items-center gap-2">
                {/* Language Selector */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setLangDropdownOpen(!langDropdownOpen);
                      setCurrencyDropdownOpen(false);
                      setUserDropdownOpen(false);
                    }}
                    className="h-12 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 text-[10px] font-black text-white transition-all shadow-inner active:scale-95"
                  >
                    <Globe size={32} style={{ color: branding.primaryColor }} />
                    <span className="text-2xl">{language.toUpperCase()}</span>
                  </button>
                  <AnimatePresence>
                    {langDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={`absolute top-full mt-3 bg-brand-dark border border-white/10 rounded-[32px] p-2 w-48 shadow-2xl z-50 ${isRTL ? 'right-0' : 'left-0'}`}
                        onMouseLeave={() => setLangDropdownOpen(false)}
                      >
                        <button 
                          onClick={() => { setLanguage('en'); setLangDropdownOpen(false); }}
                          className={`w-full px-6 py-4 rounded-2xl text-lg font-black text-left flex justify-between items-center ${language === 'en' ? 'bg-white/10 text-white' : 'text-text-secondary hover:bg-white/5 hover:text-white transition-all'}`}
                        >
                          EN {language === 'en' && <CheckCircle size={18} style={{ color: branding.primaryColor }} />}
                        </button>
                        <button 
                          onClick={() => { setLanguage('ar'); setLangDropdownOpen(false); }}
                          className={`w-full px-6 py-4 rounded-2xl text-lg font-black text-right flex justify-between items-center ${language === 'ar' ? 'bg-white/10 text-white' : 'text-text-secondary hover:bg-white/5 hover:text-white transition-all'}`}
                        >
                          AR {language === 'ar' && <CheckCircle size={18} style={{ color: branding.primaryColor }} />}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Currency Selector */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setCurrencyDropdownOpen(!currencyDropdownOpen);
                      setLangDropdownOpen(false);
                      setUserDropdownOpen(false);
                    }}
                    className="h-12 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 text-[10px] font-black text-white transition-all shadow-inner active:scale-95"
                  >
                    <Coins size={32} style={{ color: branding.primaryColor }} />
                    <span className="text-2xl">{currency}</span>
                  </button>
                  <AnimatePresence>
                    {currencyDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={`absolute top-full mt-3 bg-brand-dark border border-white/10 rounded-[32px] p-2 w-48 shadow-2xl z-50 ${isRTL ? 'right-0' : 'left-0'}`}
                        onMouseLeave={() => setCurrencyDropdownOpen(false)}
                      >
                        {['USD', 'EGP', 'SAR', 'JOD'].map((curr) => (
                          <button 
                            key={curr}
                            onClick={() => { setCurrency(curr as any); setCurrencyDropdownOpen(false); }}
                            className={`w-full px-6 py-4 rounded-2xl text-lg font-black flex justify-between items-center ${currency === curr ? 'bg-white/10 text-white' : 'text-text-secondary hover:bg-white/5 hover:text-white transition-all'}`}
                          >
                            <span>{curr}</span>
                            {currency === curr && <CheckCircle size={18} style={{ color: branding.primaryColor }} />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Cart Button */}
              <button 
                onClick={() => setCartOpen(true)}
                className="relative w-14 h-14 flex items-center justify-center rounded-[20px] bg-white/5 border border-white/10 hover:bg-white/10 active:scale-90 transition-all font-black shadow-inner"
              >
                <ShoppingCart size={32} className="text-text-secondary" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full font-black text-[10px] text-brand-dark shadow-xl ring-2 ring-brand-dark" style={{ backgroundColor: branding.primaryColor }}>
                    {totalItems}
                  </span>
                )}
              </button>

              {/* Profile / Login */}
              {!loading && (
                user ? (
                  <div className="relative">
                    <button 
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all shadow-inner active:scale-95"
                    >
                      <img src={user.avatar} alt="" className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/10 shadow-lg" />
                      <div className="hidden xl:block md:mx-1">
                        <div className="text-[12px] font-black text-white leading-none truncate max-w-[120px]">{user.username}</div>
                      </div>
                    </button>
                    <AnimatePresence>
                      {userDropdownOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className={`absolute top-full mt-3 bg-brand-dark border border-white/10 p-2 w-56 rounded-[24px] shadow-2xl z-50 ${isRTL ? 'right-0' : 'left-0'}`}
                        >
                          <Link to="/profile" onClick={closeAllMenus} className="flex items-center gap-4 px-6 py-4 text-lg font-black text-white hover:bg-white/5 rounded-2xl transition-all mb-1 group">
                            <User size={28} className="opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: branding.primaryColor }} /> 
                            {t('my_profile')}
                          </Link>
                          {hasPermission('admin_panel') && (
                            <Link to="/admin" onClick={closeAllMenus} className="flex items-center gap-4 px-6 py-4 text-lg font-black text-white hover:bg-white/5 rounded-2xl transition-all mb-1 group">
                              <Shield size={28} className="opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: branding.primaryColor }} /> 
                              {t('admin_panel')}
                            </Link>
                          )}
                          <hr className="border-white/5 my-2 mx-4" />
                          <button onClick={logout} className="flex items-center gap-4 px-6 py-4 text-lg font-black text-red-500 hover:bg-red-500/5 w-full rounded-2xl transition-all group">
                            <LogOut size={28} className="opacity-40 group-hover:opacity-100 transition-opacity" /> 
                            {t('logout')}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <button 
                    onClick={() => setLoginCaptchaOpen(true)}
                    className="h-12 px-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black text-[12px] text-white transition-all shadow-inner flex items-center gap-3 active:scale-95"
                  >
                    <DiscordLogo className="w-6 h-6 opacity-40" />
                    <span>{t('login')}</span>
                  </button>
                )
              )}

              {/* Mobile Toggle */}
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white active:scale-90 transition-all font-black"
              >
                <Menu size={20} />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-brand-dark/80 backdrop-blur-2xl px-6 py-24 flex flex-col justify-center items-center"
            dir={dir}
          >
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-10 right-10 w-16 h-16 flex items-center justify-center rounded-[32px] bg-white/5 border border-white/10 text-white"
            >
              <X size={32}/>
            </button>
            <nav className="flex flex-col gap-10 text-center">
              {navLinks.map((link, index) => (
                <motion.div 
                  key={link.to}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link 
                    to={link.to} 
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-4xl md:text-6xl font-black transition-opacity"
                    style={{ color: location.pathname === link.to ? branding.primaryColor : 'white' }}
                  >
                    {link.text}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {currencyDropdownOpen && (
        <div className="fixed inset-0 z-[49]" onClick={() => setCurrencyDropdownOpen(false)}></div>
      )}
      {langDropdownOpen && (
        <div className="fixed inset-0 z-[49]" onClick={() => setLangDropdownOpen(false)}></div>
      )}

      <CartModal isOpen={isCartOpen} onClose={() => setCartOpen(false)} />
      <LoginCaptchaModal isOpen={isLoginCaptchaOpen} onClose={() => setLoginCaptchaOpen(false)} />
    </>
  );
};

export default Navbar;
