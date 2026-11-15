import React, { useState } from 'react';
import { Clock, Users, Play, Calendar, CheckCircle2 } from 'lucide-react';
import type { PrototypeMediaItem } from '../types';
import { useT } from '../i18n';

interface CastMember {
  name: string;
  role: string;
  avatarUrl: string;
}

interface FilmScreeningDossierProps {
  item: PrototypeMediaItem;
  onPlayScreening?: (timeSlot: string) => void;
  className?: string;
}

export function FilmScreeningDossier({
  item,
  onPlayScreening,
  className = ''
}: FilmScreeningDossierProps) {
  const { t } = useT();

  const [selectedSlot, setSelectedSlot] = useState<string>('8:00 PM');
  const [reservedSlot, setReservedSlot] = useState<string | null>(null);

  const screeningSlots = [
    { id: 'slot-1', labelEn: 'Screening', time: '1:30 AM', badge: 'LATE NIGHT' },
    { id: 'slot-2', labelEn: 'Screening', time: '10:00 AM', badge: 'MATINEE' },
    { id: 'slot-3', labelEn: 'Screening', time: '3:30 PM', badge: 'AFTERNOON' },
    { id: 'slot-4', labelEn: 'Screening', time: '8:00 PM', badge: 'PRIME TIME' }
  ];

  const rawCast = (item as unknown as { castMembers?: CastMember[] }).castMembers;
  // Cast members list with high-fashion circular avatars and roles
  const castMembers: CastMember[] = rawCast && rawCast.length > 0
    ? rawCast
    : [
        {
          name: 'Michael Fassbender',
          role: 'Magneto / Erik Lehnsherr',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces'
        },
        {
          name: 'James McAvoy',
          role: 'Professor Charles Xavier',
          avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces'
        },
        {
          name: 'Jennifer Lawrence',
          role: 'Raven / Mystique',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'
        },
        {
          name: 'Oscar Isaac',
          role: 'En Sabah Nur / Apocalypse',
          avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=faces'
        },
        {
          name: 'Nicholas Hoult',
          role: 'Hank McCoy / Beast',
          avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&h=100&fit=crop&crop=faces'
        },
        {
          name: 'Sophie Turner',
          role: 'Jean Grey / Phoenix',
          avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces'
        }
      ];

  const handleSelect = (time: string) => {
    setSelectedSlot(time);
    setReservedSlot(time);
    if (onPlayScreening) {
      onPlayScreening(time);
    }
  };

  return (
    <div
      className={`rounded-3xl bg-[#0B0C10]/95 border border-[rgba(212,175,55,0.28)] p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(212,175,55,0.15)] space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.18)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[#D4AF37]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-cinzel text-sm sm:text-base font-bold tracking-wider text-[#D4AF37]">
              FILM SCREENING ROOM HUB
            </h3>
            <p className="text-[10px] text-[#A3AEC2]">
              {t('VIP screening schedule & authentic talent portfolio', 'جدول سانس‌های سینما و مشخصات ستارگان')}
            </p>
          </div>
        </div>
        <span className="text-[9px] font-mono tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
          {reservedSlot ? `PASS: ${reservedSlot}` : 'AUDITORIUM 01'}
        </span>
      </div>

      {/* 1. Screening Options (2x2 Grid) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-cinzel font-bold text-slate-200 tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>{t('Screening Options', 'سانس‌های پخش سینمایی')}</span>
          </span>
          <span className="text-[10px] text-[#A3AEC2]">
            {t('Instant Theater Seat Reservation', 'انتخاب سانس یا رزرو فوری')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {screeningSlots.map((slot) => {
            const isSelected = selectedSlot === slot.time;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleSelect(slot.time)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? 'border-[#D4AF37] bg-gradient-to-r from-[#241e12] to-[#12131a] shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                    : 'border-[rgba(212,175,55,0.2)] bg-black/40 hover:bg-[#151722] hover:border-[rgba(212,175,55,0.45)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-[#A3AEC2] uppercase">
                    {slot.labelEn}
                  </span>
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[rgba(212,175,55,0.15)] text-[#D4AF37]">
                    {slot.badge}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-cinzel text-sm sm:text-base font-black text-[#F5B942]">
                    {slot.time}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Cast Dossier with Avatars */}
      <div className="space-y-3 pt-2 border-t border-[rgba(212,175,55,0.14)]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-cinzel font-bold text-slate-200 tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>{t('Cast', 'بازیگران و ستارگان')}</span>
          </span>
          <span className="text-[10px] text-[#A3AEC2]">
            {castMembers.length} {t('Performers', 'هنرمند')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
          {castMembers.map((actor, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-black/35 border border-[rgba(212,175,55,0.18)] hover:border-[rgba(212,175,55,0.4)] transition-colors"
            >
              <img
                src={actor.avatarUrl}
                alt={actor.name}
                className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]/50 shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">{actor.name}</p>
                <p className="text-[10px] font-mono text-[#D4AF37] truncate">{actor.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center pt-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[#8E9BB3]">
          {t('Film Information Dossier', 'شناسنامه و پرونده سینمایی اثر')}
        </p>
      </div>
    </div>
  );
}
