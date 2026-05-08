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
    { to: '/applies', text: t('nav_applies') || t('applies') || 'Apps' },
    { to: '/about', text: t('nav_about') || t('about_us') || 'About' },
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
        <div className="bg-brand-dark/80 border-b border-white/5 backdrop-blur-3xl px-4 py-3 shadow-2xl">
          <div className="max-w-7xl mx-auto grid grid-cols-3 items-center">
            
            {/* Left Side: Tools & Profile (Ends up on Left in RTL) */}
            <div className="flex items-center gap-2 sm:gap-3 justify-start order-1 lg:order-1">
              {/* Profile / Login */}
              {user ? (
                <div className="relative">
                  <button 
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
                    className="flex items-center gap-2 pl-1 pr-3 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full transition-all"
                  >
                    <img src={user.avatar} alt={user.username} className="w-7 h-7 rounded-full border border-white/10" />
                    <span className="text-[11px] font-black text-white hidden sm:block tracking-tighter">{user.username}</span>
                    <ChevronDown size={10} className={`text-text-secondary transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {userDropdownOpen && (
                    <div className="absolute top-full mt-3 left-0 bg-brand-dark border border-white/10 p-2 w-52 rounded-[24px] shadow-2xl animate-fade-in-up origin-top-left z-50">
                      <UserMenuLink to="/profile" icon={User} onClick={closeAllMenus}>{t('my_profile')}</UserMenuLink>
                      <UserMenuLink to="/my-applications" icon={FileText} onClick={closeAllMenus}>{t('my_applications')}</UserMenuLink>
                      {hasPermission('admin_panel') && (
                        <UserMenuLink to="/admin" icon={UserCog} onClick={closeAllMenus}>{t('admin_panel')}</UserMenuLink>
                      )}
                      <div className="h-[1px] bg-white/5 my-2"></div>
                      <button 
                        onClick={logout}
                        className="flex items-center gap-3 w-full text-start px-4 py-2 text-xs font-black text-red-500 hover:bg-red-500/10 rounded-[12px] transition-all"
                      >
                        <LogOut size={16} className="opacity-60" />
                        {t('logout')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => setLoginCaptchaOpen(true)}
                  disabled={loading}
                  className="h-9 px-4 rounded-xl flex items-center gap-2 font-black text-xs text-brand-dark transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  <DiscordLogo className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('login')}</span>
                </button>
              )}

              {/* Currency Selector */}
              <div className="relative hidden md:block">
                <button 
                  onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                  onBlur={() => setTimeout(() => setCurrencyDropdownOpen(false), 200)}
                  className="h-9 px-3 flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl text-white font-black text-[10px] hover:bg-white/10 transition-all uppercase"
                >
                  <Coins size={14} style={{ color: branding.primaryColor }} />
                  {currency}
                </button>
              </div>

              {/* Shopping Cart */}
              <button 
                onClick={() => setCartOpen(true)}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
              >
                <ShoppingCart size={16} className="text-text-secondary" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full font-black text-[8px] text-brand-dark" style={{ backgroundColor: branding.primaryColor }}>
                    {totalItems}
                  </span>
                )}
              </button>

              {/* Language Selector */}
              <div className="relative">
                <button 
                  onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  onBlur={() => setTimeout(() => setLangDropdownOpen(false), 200)}
                  className="h-9 px-3 flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl text-white font-black text-[10px] hover:bg-white/10 transition-all uppercase"
                >
                  <Globe size={14} style={{ color: branding.primaryColor }} />
                  {language}
                </button>
              </div>
            </div>

            {/* Middle: Navigation Links */}
            <div className="hidden lg:flex items-center justify-center gap-6 xl:gap-8 order-2">
              {navLinks.map((link) => (
                <NavLink key={link.to} to={link.to}>{link.text}</NavLink>
              ))}
            </div>

            {/* Right Side: Logo & Website Name (Ends up on Right in RTL) */}
            <div className="flex items-center gap-4 justify-end order-3">
               <Link to="/" className="flex items-center gap-3 group/logo">
                <div className="text-end hidden sm:block">
                  <h1 className="text-[12px] font-black text-white tracking-tighter leading-none">{branding.siteName}</h1>
                  <p className="text-[9px] text-text-secondary font-bold opacity-60">Community Platform</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover/logo:scale-110 transition-all overflow-hidden ring-2 ring-white/5">
                  <img src={branding.logoUrl} alt={branding.siteName} className="h-full w-full object-cover" />
                </div>
              </Link>

              {/* Mobile Menu Icon */}
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-text-secondary"
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

      <CartModal isOpen={isCartOpen} onClose={() => setCartOpen(false)} />
      <LoginCaptchaModal isOpen={isLoginCaptchaOpen} onClose={() => setLoginCaptchaOpen(false)} />
    </>
  );
};

export default Navbar;
