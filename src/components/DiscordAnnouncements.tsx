import React, { useState, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
// FIX: Added 'getDiscordAnnouncements' to imports.
import { getDiscordAnnouncements } from '../lib/api';
import type { DiscordAnnouncement } from '../types';
import { Loader2, Megaphone, AlertTriangle } from 'lucide-react';

const DiscordAnnouncements: React.FC = () => {
    const { t } = useLocalization();
    const [announcements, setAnnouncements] = useState<DiscordAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnnouncements = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getDiscordAnnouncements();
                setAnnouncements(data);
            } catch (err) {
                setError('Failed to load announcements.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnnouncements();
    }, []);

    const timeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex justify-center items-center py-20">
                    <Loader2 size={40} className="animate-spin text-brand-cyan" />
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-red-400">
                    <AlertTriangle size={40} />
                    <p className="mt-4 font-semibold">{error}</p>
                </div>
            );
        }
        return (
            <div className="space-y-6">
                {announcements.map(announcement => (
                    <a key={announcement.id} href={announcement.url} target="_blank" rel="noopener noreferrer" className="block bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-6 hover:bg-brand-light-blue/50 hover:border-brand-cyan/50 transition-all duration-300 shadow-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <img src={announcement.author.avatarUrl} alt={announcement.author.name} className="w-10 h-10 rounded-full" />
                            <div>
                                <p className="font-bold text-white">{announcement.author.name}</p>
                                <p className="text-xs text-gray-400">{timeAgo(announcement.timestamp)}</p>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-brand-cyan mb-2">{announcement.title}</h3>
                        <p className="text-gray-300 whitespace-pre-wrap">{announcement.content}</p>
                    </a>
                ))}
            </div>
        );
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
                <Megaphone size={32} className="text-brand-cyan" />
                {t('community_announcements')}
            </h2>
            {renderContent()}
        </div>
    );
};

export default DiscordAnnouncements;