/**
 * Nova Roleplay - Official Website
 * Character Detail Page
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import { 
  User, Calendar, Clock, Star, Wallet, Building2, Car, 
  ChevronLeft, Loader2, Shield, Info, Activity,
  Users, MapPin
} from 'lucide-react';
import SEO from '../components/SEO';
import type { MtaCharacter, MtaVehicle, MtaProperty } from '../types';

interface CharacterDetails {
  character: MtaCharacter;
  vehicles: MtaVehicle[];
  properties: MtaProperty[];
}

const InfoItem = ({ icon: Icon, label, value, color = "text-white", brandingColor }: any) => (
  <div className="flex items-center gap-6 bg-white/[0.02] border border-white/5 p-6 rounded-3xl hover:bg-white/[0.05] transition-all">
    <div 
      className="w-14 h-14 rounded-2xl flex items-center justify-center text-text-secondary shadow-inner border border-white/5"
      style={{ backgroundColor: brandingColor ? `${brandingColor}11` : undefined }}
    >
      <Icon size={28} style={{ color: brandingColor }} />
    </div>
    <div>
      <div className="text-sm text-text-secondary font-black uppercase tracking-widest mb-1 opacity-60">{label}</div>
      <div className={`text-xl font-black ${color}`}>{value}</div>
    </div>
  </div>
);

const CharacterDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, dir } = useLocalization();
  const { branding } = useConfig();
  const [data, setData] = useState<CharacterDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const communityName = branding.siteName || 'Nova Roleplay';

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/mta/character/${id}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch character details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={64} className="animate-spin opacity-20" style={{ color: branding.primaryColor }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 space-y-8">
        <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center border border-white/10">
          <User size={48} className="opacity-20 translate-y-1" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-white">Character Not Found</h1>
          <p className="text-text-secondary text-lg">الشخصية المطلوبة غير موجودة أو تم حذفها.</p>
        </div>
        <button onClick={() => navigate(-1)} className="px-10 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black flex items-center gap-3 transition-all border border-white/5 shadow-xl">
          <ChevronLeft size={24} className={dir === 'rtl' ? 'rotate-180' : ''} /> 
          {t('go_back') || 'العودة للخلف'}
        </button>
      </div>
    );
  }

  const { character, vehicles, properties } = data;

  return (
    <div className="min-h-screen pt-32 pb-24 px-6" dir={dir}>
      <SEO 
        title={`${character.name} - ${t('character_details') || 'تفاصيل الشخصية'}`} 
        description={`عرض تفاصيل وإحصائيات شخصية ${character.name} في مجتمع ${communityName}.`}
      />
      
      <div className="max-w-6xl mx-auto space-y-16">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-3 text-text-secondary hover:text-white transition-all font-black group text-lg"
        >
          <ChevronLeft size={24} className={`group-hover:-translate-x-2 transition-transform ${dir === 'rtl' ? 'rotate-180 group-hover:translate-x-2' : ''}`} />
          {t('back_to_profile') || 'العودة للملف الشخصي'}
        </button>

        {/* Character Header */}
        <div className="glass-panel p-12 relative overflow-hidden flex flex-col md:flex-row items-center gap-12 border-white/10">
          <div className="absolute top-0 right-0 w-96 h-96 blur-[120px] rounded-full -mr-48 -mt-48 opacity-20" style={{ backgroundColor: branding.primaryColor }}></div>
          
          <div className="w-40 h-40 bg-white/5 rounded-[48px] flex items-center justify-center text-white font-black text-7xl border border-white/10 shadow-2xl relative z-10">
            {character.name.charAt(0)}
          </div>
          
          <div className="text-center md:text-start flex-1 space-y-4 relative z-10">
            <h1 className="text-5xl md:text-7xl font-black text-white leading-none">{character.name}</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <span className="bg-white/5 px-6 py-2 rounded-2xl text-base font-black text-text-secondary border border-white/5 shadow-inner">
                ID: {character.id}
              </span>
              <span className="px-6 py-2 rounded-2xl text-base font-black border border-white/10 shadow-xl" style={{ backgroundColor: `${branding.primaryColor}22`, color: branding.primaryColor }}>
                {character.job}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Stats */}
          <div className="lg:col-span-2 space-y-12">
            <section className="space-y-10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-white shadow-inner border border-white/5">
                  <Info size={30} style={{ color: branding.primaryColor }} />
                </div>
                <h3 className="text-3xl font-black text-white">{t('personal_info') || 'المعلومات الشخصية'}</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InfoItem icon={Shield} label="رقم الهوية" value={character.id} brandingColor={branding.primaryColor} />
                <InfoItem icon={User} label="الجنس" value={character.gender === 'Male' ? 'ذكر' : 'أنثى'} brandingColor={branding.primaryColor} />
                <InfoItem icon={Calendar} label="تاريخ الميلاد" value={character.dob} brandingColor={branding.primaryColor} />
                <InfoItem icon={Activity} label="العمر" value={`${character.age} سنة`} brandingColor={branding.primaryColor} />
                <InfoItem icon={Star} label="الجنسية" value={character.nationality} brandingColor={branding.primaryColor} />
                <InfoItem icon={MapPin} label="مكان الإقامة" value="لوس سانتوس" brandingColor={branding.primaryColor} />
              </div>
            </section>

            <section className="space-y-10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-white shadow-inner border border-white/5">
                  <Activity size={30} style={{ color: branding.primaryColor }} />
                </div>
                <h3 className="text-3xl font-black text-white">{t('game_stats') || 'إحصائيات الشخصية'}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InfoItem icon={Clock} label="وقت اللعب" value={`${character.playtime_hours} ساعة`} brandingColor={branding.primaryColor} />
                <InfoItem icon={Star} label="المستوى" value={character.level} brandingColor={branding.primaryColor} />
                <InfoItem icon={Shield} label="الرتبة" value={character.job} brandingColor={branding.primaryColor} />
                <InfoItem icon={Users} label="المنظمة (الفاكشن)" value={character.sector || "مواطن"} brandingColor={branding.primaryColor} />
                <InfoItem icon={Wallet} label="الكاش" value={`$${character.cash.toLocaleString()}`} color="text-green-400" brandingColor={branding.primaryColor} />
                <InfoItem icon={Building2} label="البنك" value={`$${character.bank.toLocaleString()}`} color="text-brand-cyan" brandingColor={branding.primaryColor} />
              </div>
            </section>
          </div>

          {/* ASSETS */}
          <div className="space-y-12">
            <section className="glass-panel p-10 space-y-8 border-white/5">
              <h3 className="text-2xl font-black text-white flex items-center gap-4">
                <Car size={32} style={{ color: branding.primaryColor }} />
                {t('vehicles') || 'المركبات'} ({vehicles.length})
              </h3>
              <div className="space-y-4">
                {vehicles.length > 0 ? vehicles.map(v => (
                  <div key={v.id} className="bg-white/5 p-6 rounded-[32px] border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all">
                    <div>
                      <div className="text-white font-black text-lg mb-1">{v.model}</div>
                      <div className="text-[10px] font-black uppercase text-text-secondary tracking-widest">Plate: {v.plate}</div>
                    </div>
                    <div className="text-xs font-black px-3 py-1 rounded-lg bg-black/40 text-white/40">#{v.id}</div>
                  </div>
                )) : (
                  <div className="text-base text-text-secondary italic text-center py-8 bg-white/5 rounded-[32px] border border-dashed border-white/10">لا توجد مركبات مسجلة</div>
                )}
              </div>
            </section>

            <section className="glass-panel p-10 space-y-8 border-white/5">
              <h3 className="text-2xl font-black text-white flex items-center gap-4">
                <Building2 size={32} style={{ color: branding.primaryColor }} />
                {t('properties') || 'العقارات'} ({properties.length})
              </h3>
              <div className="space-y-4">
                {properties.length > 0 ? properties.map(p => (
                  <div key={p.id} className="bg-white/5 p-6 rounded-[32px] border border-white/5 flex flex-col gap-1 group hover:bg-white/10 transition-all">
                    <div className="text-white font-black text-lg">{p.name}</div>
                    <div className="text-xs font-black text-text-secondary flex items-center gap-2">
                       <MapPin size={12} style={{ color: branding.primaryColor }} />
                       {p.address}
                    </div>
                  </div>
                )) : (
                  <div className="text-base text-text-secondary italic text-center py-8 bg-white/5 rounded-[32px] border border-dashed border-white/10">لا توجد عقارات مسجلة</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterDetailPage;
