import React from 'react';
import { Member } from '../../types';
import { APP_LOGO } from '../../data/initialData';
import { CheckCircle2, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { encodeMemberQRPayload } from '../../utils/qrUtils';

interface MemberCardProps {
  member: Member;
  currentPhoto?: string | null;
}

function formatCardDate(dateStr?: string): string {
  if (!dateStr) return '---';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('fr-FR');
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? '---' : parsed.toLocaleDateString('fr-FR');
}

export const MemberCard: React.FC<MemberCardProps> = ({ member, currentPhoto }) => {
  const photo = currentPhoto || member.photo;
  const qrPayload = encodeMemberQRPayload(member);

  return (
    <div className="member-card-container w-[460px] min-h-[316px] shrink-0 rounded-2xl p-5 bg-gradient-to-br from-[#0b1220] via-slate-900 to-[#181a28] border-2 border-amber-500/50 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
      {/* Official Logo Watermark in Background */}
      <img
        src={APP_LOGO}
        alt=""
        className="absolute right-0 -bottom-4 w-44 h-44 object-contain opacity-15 pointer-events-none select-none"
      />
      <div className="absolute -left-12 -top-12 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5 relative z-10">
        <div className="flex items-center gap-2.5">
          <img
            src={APP_LOGO}
            alt="Logo PMES-AGR Dosso"
            className="w-10 h-10 object-contain rounded-full shadow-md bg-black/40 ring-1 ring-amber-400/60 p-0.5 shrink-0"
          />
          <div>
            <div className="text-[8px] uppercase tracking-wider text-amber-300 font-bold font-mono">
              RÉPUBLIQUE DU NIGER • DOSSO
            </div>
            <div className="font-extrabold text-xs tracking-wide text-white font-display">
              PMES-AGR DOSSO
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
            member.status === 'valide'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            <CheckCircle2 className="w-2.5 h-2.5" />
            {member.status === 'valide' ? 'Validé' : 'Attente'}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="py-3 grid grid-cols-12 gap-4 items-center relative z-10 flex-1">
        {/* Enlarged Photo Frame */}
        <div className="col-span-5 flex flex-col items-center justify-center">
          <div className="w-[138px] h-[166px] rounded-2xl overflow-hidden border-2 border-amber-400/60 ring-1 ring-amber-300/20 shadow-xl relative bg-slate-950 flex items-center justify-center">
            {photo ? (
              <img src={photo} alt={member.nom} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center text-slate-500">
                <User className="w-10 h-10 opacity-40" />
                <span className="text-[9px] font-semibold uppercase tracking-wider opacity-60">Pas de photo</span>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="col-span-7 space-y-2 min-w-0">
          <div>
            <div className="text-[8px] text-amber-400/80 uppercase tracking-widest font-semibold">Numéro de Livret</div>
            <div className="text-sm font-mono font-black text-amber-300 truncate">{member.livret || 'N/A'}</div>
          </div>

          <div>
            <div className="text-[8px] text-slate-500 uppercase tracking-wider">Nom & Prénom</div>
            <div className="text-xs font-bold text-white truncate uppercase">{member.nom || '---'}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[8px] text-slate-500 uppercase tracking-wider">Né(e) le</div>
              <div className="text-[10px] font-semibold text-slate-200 tabular-nums">
                {formatCardDate(member.date_naissance)}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-slate-500 uppercase tracking-wider">À</div>
              <div className="text-[10px] font-semibold text-slate-200 truncate">
                {member.lieu_naissance || '---'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[8px] text-slate-500 uppercase tracking-wider">Téléphone</div>
              <div className="text-[10px] font-mono font-semibold text-slate-200 tabular-nums">+227 {member.telephone || '---'}</div>
            </div>
            <div>
              <div className="text-[8px] text-slate-500 uppercase tracking-wider">Zone</div>
              <div className="text-[10px] font-semibold text-slate-200 truncate">{member.zone || '---'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between relative z-10">
        <div className="text-[8px] text-slate-400 leading-tight">
          <div className="font-semibold text-slate-300">Commune Urbaine de Dosso</div>
          <div className="text-slate-500 mt-0.5 font-mono">
            ID : {member.id} · Adhésion : {formatCardDate(member.created_at)}
          </div>
        </div>
        <div className="w-12 h-12 bg-white p-1 rounded-lg flex items-center justify-center shrink-0">
          <QRCodeSVG
            value={qrPayload}
            size={40}
            level="M"
            bgColor="#ffffff"
            fgColor="#0f172a"
            includeMargin={false}
          />
        </div>
      </div>
    </div>
  );
};
