import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { motion } from 'framer-motion';
import { 
  User, Calendar, Clock, Star, Wallet, Building2, Car, 
  ChevronLeft, Loader2, Shield, Info, Activity
} from 'lucide-react';
import SEO from '../components/SEO';
import type { MtaCharacter, MtaVehicle, MtaProperty } from '../types';

interface CharacterDetails {
  character: MtaCharacter;
  vehicles: MtaVehicle[];
  properties: MtaProperty[];
}

const CharacterDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLocalization();
  const [data, setData] = useState<CharacterDetails | null>(null);
  const [loading, setLoading] = useState(true);

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
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-bold text-white mb-4">Character not found</h1>
        <button onClick={() => navigate(-1)} className="text-brand-cyan flex items-center gap-2">
          <ChevronLeft size={20} /> Go Back
        </button>
      </div>
    );
  }

  const { character, vehicles, properties } = data;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <SEO title={`${character.name} - Details`} />
      
      <div className="max-w-5xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-text-secondary hover:text-brand-cyan transition-colors mb-8 group"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          العودة للملف الشخصي
        </button>

        {/* Character Header */}
        <div className="bg-card-bg border border-border-color rounded-2xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="w-24 h-24 bg-brand-cyan/10 rounded-2xl flex items-center justify-center text-brand-cyan font-bold text-4xl border border-brand-cyan/20">
              {character.name.charAt(0)}
            </div>
            <div className="text-center md:text-right flex-1">
              <h1 className="text-4xl font-bold text-white mb-2">{character.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <span className="bg-white/5 px-3 py-1 rounded-full text-sm text-text-secondary border border-white/10">
                  ID: {character.id}
                </span>
                <span className="bg-brand-cyan/10 px-3 py-1 rounded-full text-sm text-brand-cyan border border-brand-cyan/20">
                  {character.job}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: General Info & Stats */}
          <div className="md:col-span-2 space-y-8">
            {/* General Info */}
            <section className="bg-card-bg border border-border-color rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <Info className="text-brand-cyan" />
                المعلومات العامة
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InfoItem icon={Shield} label="رقم الشخصية" value={character.id} />
                <InfoItem icon={User} label="الجنس" value={character.gender} />
                <InfoItem icon={Calendar} label="تاريخ الميلاد" value={character.dob} />
                <InfoItem icon={Activity} label="العمر" value={`${character.age} سنة`} />
                <InfoItem icon={Star} label="الاسم الكامل" value={character.name} />
                <InfoItem icon={Star} label="الجنسية" value={character.nationality} />
              </div>
            </section>

            {/* Game Stats */}
            <section className="bg-card-bg border border-border-color rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <Activity className="text-brand-cyan" />
                إحصائيات اللعبة
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InfoItem icon={Clock} label="وقت اللعب" value={`${character.playtime_hours} ساعة`} />
                <InfoItem icon={Star} label="المستوى" value={character.level} />
                <InfoItem icon={Shield} label="الوظيفة" value={character.job} />
                <InfoItem icon={Users} label="القطاع (عصابة/فاكشن)" value={character.sector || "لا يوجد"} />
                <InfoItem icon={Wallet} label="الأموال في الحقيبة" value={`$${character.cash.toLocaleString()}`} color="text-green-400" />
                <InfoItem icon={Building2} label="الأموال في البنك" value={`$${character.bank.toLocaleString()}`} color="text-brand-cyan" />
              </div>
            </section>
          </div>

          {/* Right Column: Assets */}
          <div className="space-y-8">
            {/* Vehicles */}
            <section className="bg-card-bg border border-border-color rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Car size={20} className="text-brand-cyan" />
                المركبات ({vehicles.length})
              </h3>
              <div className="space-y-3">
                {vehicles.length > 0 ? vehicles.map(v => (
                  <div key={v.id} className="bg-white/5 p-3 rounded-xl border border-white/10 flex justify-between items-center">
                    <div>
                      <div className="text-white font-medium">{v.model}</div>
                      <div className="text-xs text-text-secondary">Plate: {v.plate}</div>
                    </div>
                    <div className="text-xs text-brand-cyan font-mono">#{v.id}</div>
                  </div>
                )) : (
                  <div className="text-sm text-text-secondary italic">لا توجد مركبات مسجلة</div>
                )}
              </div>
            </section>

            {/* Properties */}
            <section className="bg-card-bg border border-border-color rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Building2 size={20} className="text-brand-cyan" />
                العقارات ({properties.length})
              </h3>
              <div className="space-y-3">
                {properties.length > 0 ? properties.map(p => (
                  <div key={p.id} className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <div className="text-white font-medium">{p.name}</div>
                    <div className="text-xs text-text-secondary">{p.address}</div>
                  </div>
                )) : (
                  <div className="text-sm text-text-secondary italic">لا توجد عقارات مسجلة</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ icon: Icon, label, value, color = "text-white" }: any) => (
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-text-secondary">
      <Icon size={20} />
    </div>
    <div>
      <div className="text-xs text-text-secondary mb-0.5">{label}</div>
      <div className={`font-bold ${color}`}>{value}</div>
    </div>
  </div>
);

export default CharacterDetailPage;
