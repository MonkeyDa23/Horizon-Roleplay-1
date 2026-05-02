import React from 'react';
import { motion } from 'motion/react';
import { Settings, MessageSquare, Discord as DiscordIcon } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';

const MaintenancePage: React.FC = () => {
  const { config } = useConfig();

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6 font-['Cairo']" dir="rtl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-cyan/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-blue/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center relative z-10"
      >
        <div className="mb-8 flex justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="p-4 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan"
          >
            <Settings size={64} />
          </motion.div>
        </div>

        <h1 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight">نحن في مهمة عمل!</h1>
        
        <div className="bg-background-light/50 backdrop-blur-xl border border-white/10 p-8 rounded-[40px] mb-8 shadow-2xl">
          <p className="text-xl text-gray-300 leading-relaxed mb-8">
            {config.MAINTENANCE_MESSAGE_AR || 'الموقع حالياً تحت الصيانة لتحسين تجربتكم. سنعود قريباً!'}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href={config.DISCORD_INVITE_URL || '#'} 
              className="flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-white hover:text-[#5865F2] text-white px-8 py-4 rounded-2xl font-bold transition-all duration-300 group"
            >
              <span>تابونا على الديسكورد</span>
              <MessageSquare size={20} className="group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>

        <p className="text-gray-500 font-medium">Nova Roleplay &copy; {new Date().getFullYear()}</p>
      </motion.div>
    </div>
  );
};

export default MaintenancePage;
