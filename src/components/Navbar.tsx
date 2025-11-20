import React, { useState } from 'react';
import { NavLink as RouterNavLink, Link, useNavigate } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useConfig } from '../contexts/ConfigContext';
import Logo from './Logo';
import CartModal from './CartModal';
import LoginCaptchaModal from './LoginCaptchaModal';
import { Globe, ChevronDown, LogIn, LogOut, Loader2, ShoppingCart, UserCog, FileText, User, Menu, X } from 'lucide-react';

const NavLink: React.FC<{ to: string; children: React.ReactNode; onClick?: () => void }> = ({ to, children, onClick }) => (
    <RouterNavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
            `relative text-text-primary hover:text-white transition-colors duration-300 font-medium after:content-[''] after:absolute after:bottom-[-6px] after:left-0 after:w-full after:h-[3px] after:bg-primary-blue after:scale-x-0 after:origin-center after:transition-transform after:duration-300 after:rounded-full ${isActive ? 'text-white after:scale-x-100' : 'hover:after:scale-x-50'}`
        }
        end={to === '/'}
    >
        {children}
    </RouterNavLink>
);

const UserMenuLink: React.FC<{ to: string; children: React.ReactNode; icon: React.ElementType; onClick?: () => void }> = ({ to, children, icon: Icon, onClick }) => (
     <Link to={to} onClick={onClick} className="flex items-center gap-3 w-full text-start px-4 py-2.5 text-sm text-text-primary hover:bg-primary-blue/20 hover:text-white rounded-md transition-colors">
       <Icon size={18} />
       {children}
     </Link>
);


const Navbar: React.FC = () => {
  const { language, setLanguage, t } = useLocalization();
  const { user, login, logout, loading, hasPermission } = useAuth();
  const { totalItems } = useCart();
  const { config } = useConfig();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isLoginCaptchaOpen, setLoginCaptchaOpen] = useState(false);


  const navLinks = [
    { to: '/', text: t('home') },
    { to: '/store', text: t('store') },
    { to: '/rules', text: t('rules') },
    { to: '/applies', text: t('applies') },
    { to: '/about', text: t('about_us') },
  ];
  
  const closeAllMenus = () => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    setLangDropdownOpen(false);
  }

  return (
    <>
      <header className="sticky top-4 z-50 mx-auto max-w-7xl w-[calc(100%-2rem)] animate-fade-in-up" style={{ animationDelay: '100ms', opacity: 0 }}>
        <div className="glass-panel">
            <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
              <Link to="/" className="flex items-center gap-3 flex-shrink-0">
                <Logo className="h-10 w-10" />
                <h1 className="text-xl font-bold text-white tracking-wider hidden sm:block">{config.COMMUNITY_NAME}</h1>
              </Link>
              
              <div className="hidden lg:flex items-center gap-10">
                {navLinks.map((link) => (
                    <NavLink key={link.to} to={link.to}>{link.text}</NavLink>
                ))}
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4">
                  <button
                    onClick={() => setCartOpen(true)}
                    className="relative text-text-primary hover:text-white transition-colors"
                    aria-label={t('your_cart')}
                  >
                    <ShoppingCart size={22} />
                    {totalItems > 0 && (
                      <span className="absolute -top-2 -end-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-blue text-xs font-bold text-background-dark">
                        {totalItems}
                      </span>
                    )}
                  </button>
                
                <div className="relative">
                  <button
                    onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                    onBlur={() => setTimeout(() => setLangDropdownOpen(false), 200)}
                    className="flex items-center gap-1 text-text-primary hover:text-white transition-colors p-2 rounded-md"
                  >
                    <Globe size={20} />
                    <ChevronDown size={16} className={`transition-transform duration-300 ${langDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {langDropdownOpen && (
                    <div className="absolute top-full mt-3 end-0 glass-panel p-2 w-36 animate-fade-in-up origin-top-right">
                      <button onClick={() => { setLanguage('en'); closeAllMenus(); }} className="block w-full text-start px-3 py-2 text-sm text-text-primary hover:bg-primary-blue/20 hover:text-white rounded-md transition-colors">English</button>
                      <button onClick={() => { setLanguage('ar'); closeAllMenus(); }} className="block w-full text-start px-3 py-2 text-sm text-text-primary hover:bg-primary-blue/20 hover:text-white rounded-md transition-colors">العربية</button>
                    </div>
                  )}
                </div>

                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
                      className="flex items-center gap-2 hover:bg-background-light/50 p-1 rounded-full transition-colors"
                    >
                      <img src={user.avatar} alt={user.username} className="w-9 h-9 rounded-full border-2 border-primary-blue" />
                       <ChevronDown size={16} className={`transition-transform text-text-primary ${userDropdownOpen ? 'rotate-180' : ''} hidden sm:block`} />
                    </button>
                    {userDropdownOpen && (
                       <div className="absolute top-full mt-3 end-0 glass-panel p-2 w-56 animate-fade-in-up space-y-1 origin-top-right">
                         <div className="px-4 py-2 border-b border-border-color mb-1">
                            <p className="text-sm text-text-secondary">{t('welcome')}</p>
                            <p className="font-semibold text-white truncate">{user.username}</p>
                         </div>
                         <UserMenuLink to="/profile" icon={User} onClick={closeAllMenus}>{t('my_profile')}</UserMenuLink>
                         <UserMenuLink to="/my-applications" icon={FileText} onClick={closeAllMenus}>{t('my_applications')}</UserMenuLink>
                         {hasPermission('admin_panel') && (
                            <UserMenuLink to="/admin" icon={UserCog} onClick={closeAllMenus}>{t('admin_panel')}</UserMenuLink>
                         )}
                         <div className="w-full h-px bg-border-color my-1"></div>
                         <button onClick={logout} className="flex items-center gap-3 w-full text-start px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-md transition-colors">
                           <LogOut size={18} />
                           {t('logout')}
                         </button>
                       </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setLoginCaptchaOpen(true)}
                    disabled={loading}
                    className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-2 px-5 rounded-lg hover:opacity-90 hover:shadow-glow-blue transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                  >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                    <span className="hidden sm:inline">{t('login_discord')}</span>
                  </button>
                )}

                <div className="lg:hidden">
                     <button onClick={() => setMobileMenuOpen(true)} className="text-text-primary hover:text-white transition-colors">
                         <Menu size={28} />
                     </button>
                </div>
              </div>
            </div>
        </div>
      </header>
      {/* Mobile Menu */}
      <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ease-in-out ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-lg" onClick={() => setMobileMenuOpen(false)}></div>
        <div className={`relative w-full max-w-xs h-full bg-background-light ml-auto p-6 flex flex-col transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex justify-between items-center mb-10">
                <Link to="/" onClick={closeAllMenus} className="flex items-center gap-2">
                    <Logo className="w-8 h-8"/>
                    <h2 className="font-bold text-white text-lg">{config.COMMUNITY_NAME}</h2>
                </Link>
                <button onClick={() => setMobileMenuOpen(false)} className="text-text-primary hover:text-white"><X size={28}/></button>
            </div>
            <nav className="flex flex-col gap-6 text-xl">
                 {navLinks.map((link, index) => (
                    <RouterNavLink 
                        key={link.to}
                        to={link.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) => `block py-2 transition-all duration-300 ${isActive ? 'text-primary-blue font-bold' : 'text-text-secondary hover:text-white'}`}
                        style={{ animation: `fade-in-up 0.5s ${index * 0.1}s ease-out backwards` }}
                    >
                      {link.text}
                    </RouterNavLink>
                ))}
            </nav>
        </div>
      </div>

      <CartModal isOpen={isCartOpen} onClose={() => setCartOpen(false)} />
      <LoginCaptchaModal isOpen={isLoginCaptchaOpen} onClose={() => setLoginCaptchaOpen(false)} />
    </>
  );
};

export default Navbar;