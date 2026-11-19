import React, { useState } from 'react';
import {
  User,
  Member,
  Corporation,
  ZoneItem,
  CaisseMouvement,
  SyncStatus,
  UserRole,
} from '../../types';
import {
  Building2,
  Cloud,
  HeartPulse,
  Key,
  MapPin,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  Download,
} from 'lucide-react';

interface AdminSettingsSectionProps {
  currentUser: User;
  users: User[];
  members: Member[];
  corporations: Corporation[];
  zones: ZoneItem[];
  caisseMouvements: CaisseMouvement[];
  syncStatus: SyncStatus;
  isOnline: boolean;
  onTestFirebase: () => void;
  onPushToFirebase: () => void;
  onPullFromFirebase: () => void;
  onAddCorporation: (nom: string, emoji: string, categorie: string, fraisAdhesion?: number) => void;
  onUpdateCorporationFrais: (corpoId: string, fraisAdhesion: number) => void;
  onAddZone: (nom: string, description: string) => void;
  onSaveUser: (userData: Partial<User>) => Promise<void>;
  onDeleteUser: (userId: string) => void;
  onUpdatePassword: (userId: string, currentPass: string, newPass: string) => Promise<boolean>;
  onAddHealthContribution: (memberId: string, montant: number, note?: string) => void;
  onAddSocialAssistance: (
    memberId: string,
    montant: number,
    motif: 'accident' | 'maladie' | 'accouchement' | 'deces',
    note?: string
  ) => void;
}

export const AdminSettingsSection: React.FC<AdminSettingsSectionProps> = ({
  currentUser,
  users,
  members,
  corporations,
  zones,
  caisseMouvements,
  syncStatus,
  isOnline,
  onTestFirebase,
  onPushToFirebase,
  onPullFromFirebase,
  onAddCorporation,
  onUpdateCorporationFrais,
  onAddZone,
  onSaveUser,
  onDeleteUser,
  onUpdatePassword,
  onAddHealthContribution,
  onAddSocialAssistance,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const canManageSocial = isAdmin || currentUser.role === 'TRESORIER';

  // Fonds social state
  const [socialMemberId, setSocialMemberId] = useState('');
  const [socialAmount, setSocialAmount] = useState('');
  const [socialType, setSocialType] = useState<'cotisation' | 'assistance'>('cotisation');
  const [socialMotif, setSocialMotif] = useState<'accident' | 'maladie' | 'accouchement' | 'deces'>('maladie');
  const [socialNote, setSocialNote] = useState('');

  // Corporation form
  const [corpoNom, setCorpoNom] = useState('');
  const [corpoEmoji, setCorpoEmoji] = useState('🏪');
  const [corpoCat, setCorpoCat] = useState('Commerce');
  const [corpoFrais, setCorpoFrais] = useState('5000');

  // Zone form
  const [zoneNom, setZoneNom] = useState('');
  const [zoneDesc, setZoneDesc] = useState('');

  // User form
  const [newUsername, setNewUsername] = useState('');
  const [newUserNom, setNewUserNom] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('AGENT');
  const [newUserZone, setNewUserZone] = useState(zones[0]?.nom || 'Dosso Centre');
  const [newUserPass, setNewUserPass] = useState('');

  // Password change
  const [currPass, setCurrPass] = useState('');
  const [nextPass, setNextPass] = useState('');
  const [passMsg, setPassMsg] = useState('');

  const soldeSocial = caisseMouvements
    .filter((m) => m.type === 'cotisation_sante' || m.type === 'assistance_sociale')
    .reduce((sum, m) => sum + (m.type === 'cotisation_sante' ? m.montant : -m.montant), 0);

  return (
    <div className="space-y-10 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-display font-bold text-charcoal dark:text-white tracking-tight">
          Administration, Réseau & Fonds Social
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Synchronisation cloud, caisse santé communautaire, corporations, zones et gestion des accès.
        </p>
      </div>

      {/* Synchronisation Firebase & Fonds Social */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Cloud size={18} className="text-lapis" />
              <div>
                <h2 className="text-base font-display font-bold text-charcoal dark:text-white">
                  Synchronisation Firebase Firestore
                </h2>
                <p className="text-xs text-slate-500">
                  État actuel : {isOnline ? syncStatus : 'Hors-ligne'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onTestFirebase}
              className="px-4 py-2.5 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-2 hover:border-lapis/50 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} /> Tester la connexion
            </button>
            <button
              type="button"
              onClick={onPullFromFirebase}
              className="px-4 py-2.5 rounded-xl bg-lapis/10 text-lapis text-xs font-bold flex items-center gap-2 hover:bg-lapis hover:text-white transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download size={14} /> Importer depuis Firebase
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={onPushToFirebase}
                className="px-4 py-2.5 rounded-xl bg-lapis text-white text-xs font-bold flex items-center gap-2 hover:bg-lapis/90 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload size={14} /> Pousser vers Firebase
              </button>
            )}
          </div>
        </div>

        {/* Fonds Social & Santé */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <HeartPulse size={18} className="text-emerald-600" />
              <div>
                <h2 className="text-base font-display font-bold text-charcoal dark:text-white">
                  Fonds Social & Santé
                </h2>
                <p className="text-xs text-slate-500 tabular-nums">
                  Disponible : {soldeSocial.toLocaleString()} F CFA
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-paper dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setSocialType('cotisation')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  socialType === 'cotisation'
                    ? 'bg-white dark:bg-slate-900 text-charcoal dark:text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Cotisation
              </button>
              {canManageSocial && (
                <button
                  type="button"
                  onClick={() => setSocialType('assistance')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    socialType === 'assistance'
                      ? 'bg-white dark:bg-slate-900 text-charcoal dark:text-white shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  Aide sociale
                </button>
              )}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amt = Number(socialAmount);
              if (!socialMemberId || !amt || amt <= 0) return;
              if (socialType === 'cotisation') {
                onAddHealthContribution(socialMemberId, amt, socialNote || undefined);
              } else {
                onAddSocialAssistance(socialMemberId, amt, socialMotif, socialNote || undefined);
              }
              setSocialAmount('');
              setSocialNote('');
            }}
            className="grid sm:grid-cols-2 gap-3"
          >
            <select
              value={socialMemberId}
              onChange={(e) => setSocialMemberId(e.target.value)}
              required
              className="h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              <option value="">Sélectionner un adhérent...</option>
              {members.filter((m) => m.status === 'valide').map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom} ({m.livret})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="100"
              placeholder="Montant (F CFA)"
              value={socialAmount}
              onChange={(e) => setSocialAmount(e.target.value)}
              required
              className="h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums"
            />
            {socialType === 'assistance' && (
              <select
                value={socialMotif}
                onChange={(e) => setSocialMotif(e.target.value as any)}
                className="h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                <option value="maladie">Motif : Maladie</option>
                <option value="accident">Motif : Accident</option>
                <option value="accouchement">Motif : Accouchement</option>
                <option value="deces">Motif : Décès</option>
              </select>
            )}
            <input
              type="text"
              placeholder="Note / justificatif (optionnel)"
              value={socialNote}
              onChange={(e) => setSocialNote(e.target.value)}
              className={`h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs ${
                socialType === 'cotisation' ? 'sm:col-span-2' : ''
              }`}
            />
            <button
              type="submit"
              className="sm:col-span-2 h-10 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
            >
              {socialType === 'cotisation'
                ? 'Encaisser la cotisation santé'
                : 'Décaisser l\'assistance sociale'}
            </button>
          </form>
        </div>
      </div>

      {/* Corporations & Zones */}
      {isAdmin && (
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-4">
              <Building2 size={18} className="text-gold" />
              <h2 className="text-base font-display font-bold text-charcoal dark:text-white">
                Corporations & Barèmes ({corporations.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-56 overflow-y-auto">
              {corporations.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-charcoal dark:text-white truncate">
                      {c.emoji} {c.nom}
                    </div>
                    <div className="text-slate-400">{c.categorie}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {(c.frais_adhesion || 5000).toLocaleString()} F
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCorporationFrais(c.id, (c.frais_adhesion || 5000) + 1000)
                      }
                      className="px-2 py-1 rounded bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:border-lapis cursor-pointer"
                      title="Augmenter de 1000 F"
                    >
                      +1000
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!corpoNom.trim()) return;
                onAddCorporation(
                  corpoNom.trim(),
                  corpoEmoji || '🏪',
                  corpoCat,
                  Number(corpoFrais) || 5000
                );
                setCorpoNom('');
              }}
              className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800"
            >
              <input
                type="text"
                placeholder="Nom corporation"
                value={corpoNom}
                onChange={(e) => setCorpoNom(e.target.value)}
                required
                className="col-span-2 h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <input
                type="number"
                placeholder="Frais"
                value={corpoFrais}
                onChange={(e) => setCorpoFrais(e.target.value)}
                className="h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums"
              />
              <button
                type="submit"
                className="h-10 px-3 rounded-xl bg-lapis text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Ajouter
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-4">
              <MapPin size={18} className="text-lapis" />
              <h2 className="text-base font-display font-bold text-charcoal dark:text-white">
                Zones de Collecte ({zones.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-56 overflow-y-auto">
              {zones.map((z) => (
                <div key={z.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-charcoal dark:text-white">{z.nom}</div>
                    <div className="text-slate-400">{z.description}</div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    @{z.agent_principal || 'equipe'}
                  </span>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!zoneNom.trim()) return;
                onAddZone(zoneNom.trim(), zoneDesc.trim() || 'Zone de collecte Dosso');
                setZoneNom('');
                setZoneDesc('');
              }}
              className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800"
            >
              <input
                type="text"
                placeholder="Nom de la zone"
                value={zoneNom}
                onChange={(e) => setZoneNom(e.target.value)}
                required
                className="h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <input
                type="text"
                placeholder="Description"
                value={zoneDesc}
                onChange={(e) => setZoneDesc(e.target.value)}
                className="h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <button
                type="submit"
                className="h-10 px-3 rounded-xl bg-lapis text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Ajouter
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Équipe & Mot de passe */}
      <div className="grid lg:grid-cols-12 gap-8">
        {isAdmin && (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-4">
              <Shield size={18} className="text-lapis" />
              <h2 className="text-base font-display font-bold text-charcoal dark:text-white">
                Comptes Staff & Rôles ({users.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-56 overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-charcoal dark:text-white">{u.nom}</div>
                    <div className="text-slate-400">
                      @{u.username} · {u.role} · {u.zone}
                    </div>
                  </div>
                  {u.id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => onDeleteUser(u.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                      title="Supprimer ce compte"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newUsername.trim() || !newUserNom.trim()) return;
                await onSaveUser({
                  username: newUsername.trim(),
                  nom: newUserNom.trim(),
                  role: newUserRole,
                  zone: newUserZone,
                  password: newUserPass || '1234',
                });
                setNewUsername('');
                setNewUserNom('');
                setNewUserPass('');
              }}
              className="grid sm:grid-cols-5 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800"
            >
              <input
                type="text"
                placeholder="Nom complet"
                value={newUserNom}
                onChange={(e) => setNewUserNom(e.target.value)}
                required
                className="h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <input
                type="text"
                placeholder="Identifiant"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                className="h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="h-10 px-2 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              >
                <option value="AGENT">AGENT</option>
                <option value="TRESORIER">TRESORIER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MAIRE">MAIRE</option>
              </select>
              <input
                type="password"
                placeholder="Mot de passe"
                value={newUserPass}
                onChange={(e) => setNewUserPass(e.target.value)}
                className="h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <button
                type="submit"
                className="h-10 px-3 rounded-xl bg-lapis text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <UserPlus size={14} /> Créer
              </button>
            </form>
          </div>
        )}

        <div className={`${isAdmin ? 'lg:col-span-5' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5`}>
          <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-4">
            <Key size={18} className="text-gold" />
            <h2 className="text-base font-display font-bold text-charcoal dark:text-white">
              Sécurité de mon compte
            </h2>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await onUpdatePassword(currentUser.id, currPass, nextPass);
              setPassMsg(ok ? 'Mot de passe mis à jour.' : 'Mot de passe actuel incorrect.');
              if (ok) {
                setCurrPass('');
                setNextPass('');
              }
            }}
            className="space-y-3"
          >
            <input
              type="password"
              placeholder="Mot de passe actuel"
              value={currPass}
              onChange={(e) => setCurrPass(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
            <input
              type="password"
              placeholder="Nouveau mot de passe"
              value={nextPass}
              onChange={(e) => setNextPass(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
            {passMsg && <div className="text-xs text-slate-500">{passMsg}</div>}
            <button
              type="submit"
              className="w-full h-10 px-4 rounded-xl bg-charcoal dark:bg-white text-white dark:text-charcoal text-xs font-bold cursor-pointer"
            >
              Mettre à jour mon mot de passe
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
