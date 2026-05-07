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
  CheckCircle 
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
      className="flex items-center gap-4 w-full text-start px-5 py-4 text-sm font-black text-text-secondary hover:bg-white/[0.05] hover:text-white rounded-[20px] transition-all group"
    >
      <Icon size={20} className="opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: branding.primaryColor }} />
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
    { to: '/', text: t('nav_home') || t('home') || 'Home' },
    { to: '/store', text: t('nav_store') || t('store') || 'Store' },
    { to: '/rules', text: t('nav_rules') || t('rules') || 'Rules' },
    { to: '/applies', text: t('nav_applies') || t('applies') || 'Applications' },
    { to: '/about', text: t('nav_about') || t('about_us') || 'About Us' },
  ];

  const closeAllMenus = () => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    setLangDropdownOpen(false);
    setCurrencyDropdownOpen(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 z-[60] w-full" dir={dir}>
        <div className="bg-brand-dark/80 border-b border-white/5 backdrop-blur-3xl px-6 py-4 shadow-2xl">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            
            <Link to="/" className="flex items-center gap-4 group/logo">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover/logo:scale-110 transition-all duration-500">
                <img src={branding.logoUrl} alt={branding.siteName} className="h-8 w-8 object-contain" />
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white truncate max-w-[150px] sm:max-w-xs">{branding.siteName}</h1>
            </Link>

            <div className="hidden lg:flex items-center gap-8 xl:gap-12">
              {navLinks.map((link) => (
                <NavLink key={link.to} to={link.to}>{link.text}</NavLink>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* Cart */}
              <button 
                onClick={() => setCartOpen(true)}
                className="relative w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
              >
                <ShoppingCart size={22} className="text-text-secondary group-hover:text-white transition-colors" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-xl font-black text-[10px] text-brand-dark shadow-xl" style={{ backgroundColor: branding.primaryColor }}>
                    {totalItems}
                  </span>
                )}
              </button>

              {/* Currency */}
              <div className="relative">
                <button 
                  onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                  onBlur={() => setTimeout(() => setCurrencyDropdownOpen(false), 200)}
                  className="h-12 px-5 flex items-center gap-2 bg-white/5 border border-white/5 rounded-2xl text-white font-black text-xs hover:bg-white/10 transition-all cursor-pointer"
                >
                  <Coins size={18} style={{ color: branding.primaryColor }} />
                  <span className="hidden sm:inline bg-transparent opacity-80 uppercase">{currency}</span>
                  <ChevronDown size={14} className={`opacity-40 transition-transform duration-500 ${currencyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {currencyDropdownOpen && (
                  <div className="absolute top-full mt-4 right-0 bg-brand-dark border border-white/10 p-3 w-44 rounded-[32px] animate-fade-in-up origin-top shadow-2xl">
                    {(['USD', 'JOD', 'SAR', 'EGP'] as Currency[]).map((cur) => (
                      <button 
                        key={cur}
                        onClick={() => { setCurrency(cur); closeAllMenus(); }}
                        className={`flex items-center justify-between w-full text-start px-5 py-3 text-sm font-black rounded-2xl transition-all ${currency === cur ? 'text-brand-dark' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
                        style={{ backgroundColor: currency === cur ? branding.primaryColor : undefined }}
                      >
                        <span>{t(`currency_${cur.toLowerCase()}` as any) || cur}</span>
                        {currency === cur && <CheckCircle size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Language */}
              <div className="relative">
                <button 
                  onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  onBlur={() => setTimeout(() => setLangDropdownOpen(false), 200)}
                  className="h-12 px-5 flex items-center gap-2 bg-white/5 border border-white/5 rounded-2xl text-white font-black text-xs hover:bg-white/10 transition-all cursor-pointer"
                >
                  <Globe size={18} style={{ color: branding.primaryColor }} />
                  <span className="hidden sm:inline opacity-80 uppercase">{language.toUpperCase()}</span>
                  <ChevronDown size={14} className={`opacity-40 transition-transform duration-500 ${langDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {langDropdownOpen && (
                  <div className="absolute top-full mt-4 right-0 bg-brand-dark border border-white/10 p-3 w-44 rounded-[32px] animate-fade-in-up origin-top shadow-2xl">
                    <button onClick={() => { setLanguage('en'); closeAllMenus(); }} className={`block w-full text-start px-5 py-3 text-sm font-black rounded-2xl transition-all ${language === 'en' ? 'text-white bg-white/10' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}>English</button>
                    <button onClick={() => { setLanguage('ar'); closeAllMenus(); }} className={`block w-full text-start px-5 py-3 text-sm font-black rounded-2xl transition-all ${language === 'ar' ? 'text-white bg-white/10' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}>العربية</button>
                  </div>
                )}
              </div>

              {/* User Menu / Login */}
              {user ? (
                <div className="relative">
                  <button 
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
                    className="flex items-center gap-3 pl-1 pr-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full transition-all group"
                  >
                    <div className="relative">
                      <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full border-2 border-white/5 group-hover:border-white/20 transition-all" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-brand-dark rounded-full"></div>
                    </div>
                    <div className="text-start hidden sm:block">
                      <p className="text-[10px] font-black text-text-secondary uppercase opacity-40 leading-none mb-1">{t('welcome')}</p>
                      <p className="text-sm font-black text-white leading-none">{user.username}</p>
                    </div>
                    <ChevronDown size={14} className={`text-text-secondary transition-transform duration-500 ${userDropdownOpen ? 'rotate-180' : ''} hidden sm:block`} />
                  </button>
                  {userDropdownOpen && (
                    <div className="absolute top-full mt-4 right-0 bg-brand-dark border border-white/10 p-3 w-64 rounded-[40px] animate-fade-in-up origin-top-right shadow-2xl">
                      <UserMenuLink to="/profile" icon={User} onClick={closeAllMenus}>{t('my_profile')}</UserMenuLink>
                      <UserMenuLink to="/my-applications" icon={FileText} onClick={closeAllMenus}>{t('my_applications')}</UserMenuLink>
                      {hasPermission('admin_panel') && (
                        <UserMenuLink to="/admin" icon={UserCog} onClick={closeAllMenus}>{t('admin_panel')}</UserMenuLink>
                      )}
                      <div className="h-[1px] bg-white/5 my-3 mx-4"></div>
                      <button 
                        onClick={logout}
                        className="flex items-center gap-4 w-full text-start px-5 py-4 text-sm font-black text-red-500 hover:bg-red-500/10 rounded-[20px] transition-all group"
                      >
                        <LogOut size={20} className="opacity-60 group-hover:opacity-100 transition-all" />
                        {t('logout')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => setLoginCaptchaOpen(true)}
                  disabled={loading}
                  className="relative overflow-hidden group h-12 px-8 rounded-2xl flex items-center gap-3 font-black text-sm text-brand-dark transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <DiscordLogo className="w-5 h-5" />}
                  <span className="hidden sm:inline">{t('login')}</span>
                </button>
              )}

              {/* Mobile Menu Toggle */}
              <div className="lg:hidden">
                <button 
                  onClick={() => setMobileMenuOpen(true)}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all text-text-secondary"
                >
                  <Menu size={28} />
                </button>
              </div>
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

      <CartModal isOpen={isCartOpen} onClose={() => setCartOpen(false)} />
      <LoginCaptchaModal isOpen={isLoginCaptchaOpen} onClose={() => setLoginCaptchaOpen(false)} />
    </>
  );
};

export default Navbar;
