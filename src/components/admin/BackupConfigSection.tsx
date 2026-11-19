import React, { useState, useRef } from 'react';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Download,
  FileJson,
  HardDrive,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import {
  BackupScheduleConfig,
  BackupHistoryEntry,
  FullBackupPackage,
  formatBytes,
  getNextScheduledLabel,
  downloadLatestCachedBackup,
  validateBackupJsonFile,
  applyBackupPackageRestore,
} from '../../services/backupService';

interface BackupConfigSectionProps {
  config: BackupScheduleConfig;
  history: BackupHistoryEntry[];
  liveCounts: {
    members: number;
    transactions: number;
    retraits: number;
    financements: number;
    caisseMouvements: number;
    auditLogs: number;
    pendingQueue: number;
  };
  onSaveConfig: (nextConfig: BackupScheduleConfig) => void;
  onRunBackupNow: () => Promise<void>;
  onClearHistory: () => void;
  onRestoreComplete: () => Promise<void>;
}

export const BackupConfigSection: React.FC<BackupConfigSectionProps> = ({
  config,
  history,
  liveCounts,
  onSaveConfig,
  onRunBackupNow,
  onClearHistory,
  onRestoreComplete,
}) => {
  const [draft, setDraft] = useState<BackupScheduleConfig>(config);
  const [isExporting, setIsExporting] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pendingRestorePkg, setPendingRestorePkg] = useState<FullBackupPackage | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasUnsavedChanges =
    draft.enabled !== config.enabled ||
    draft.scheduledTime !== config.scheduledTime ||
    draft.autoDownload !== config.autoDownload ||
    draft.includeLocalStorage !== config.includeLocalStorage ||
    draft.includeIndexedDB !== config.includeIndexedDB ||
    draft.includeSecurityHashes !== config.includeSecurityHashes ||
    draft.retentionCount !== config.retentionCount;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.includeLocalStorage && !draft.includeIndexedDB) {
      setSaveNotice('Sélectionnez au moins IndexedDB ou localStorage.');
      return;
    }
    const merged: BackupScheduleConfig = {
      ...config,
      enabled: draft.enabled,
      scheduledTime: draft.scheduledTime || '18:00',
      autoDownload: draft.autoDownload,
      includeLocalStorage: draft.includeLocalStorage,
      includeIndexedDB: draft.includeIndexedDB,
      includeSecurityHashes: draft.includeSecurityHashes,
      retentionCount: draft.retentionCount,
    };
    onSaveConfig(merged);
    setSaveNotice('Configuration enregistrée');
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleRunNow = async () => {
    setIsExporting(true);
    try {
      await onRunBackupNow();
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setRestoreError(null);
    setPendingRestorePkg(null);
    if (!file) return;

    try {
      const text = await file.text();
      const validation = await validateBackupJsonFile(text);
      if (!validation.valid || !validation.pkg) {
        setRestoreError(validation.error || 'Fichier JSON invalide.');
        return;
      }
      setPendingRestorePkg(validation.pkg);
    } catch {
      setRestoreError('Impossible de lire le fichier sélectionné.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestorePkg) return;
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await applyBackupPackageRestore(pendingRestorePkg);
      await onRestoreComplete();
      setPendingRestorePkg(null);
      setSaveNotice('État local restauré avec succès');
      setTimeout(() => setSaveNotice(null), 4000);
    } catch {
      setRestoreError('Échec lors de la restauration IndexedDB / localStorage.');
    } finally {
      setIsRestoring(false);
    }
  };

  const nextRunLabel = getNextScheduledLabel(draft);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-display font-bold text-charcoal dark:text-white tracking-tight">
            Sauvegardes Locales Automatisées
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
            Planifiez une sauvegarde quotidienne complète d&apos;IndexedDB et du stockage local vers un package JSON téléchargeable et vérifiable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {config.lastBackupFilename && (
            <button
              type="button"
              onClick={() => downloadLatestCachedBackup(config.lastBackupFilename)}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 hover:border-lapis/50 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileJson size={14} />
              Télécharger dernière archive
            </button>
          )}
          <button
            type="button"
            disabled={isExporting}
            onClick={handleRunNow}
            className="px-5 py-2.5 rounded-xl bg-lapis text-white text-xs font-bold shadow-lg shadow-lapis/20 hover:bg-lapis/90 transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            Exporter JSON maintenant
          </button>
        </div>
      </div>

      {/* Bandeau métriques synthétiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">Planification quotidienne</div>
          <div className="text-lg font-display font-bold text-charcoal dark:text-white flex items-center gap-2">
            {draft.enabled ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>Active</span>
              </>
            ) : (
              <span>Désactivée</span>
            )}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">{nextRunLabel}</div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">Dernière sauvegarde</div>
          <div className="text-lg font-display font-bold text-charcoal dark:text-white tabular-nums">
            {config.lastBackupAt
              ? new Date(config.lastBackupAt).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Aucune'}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {config.lastBackupFilename || 'En attente de premier export'}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">Périmètre actuel</div>
          <div className="text-lg font-display font-bold text-charcoal dark:text-white tabular-nums">
            {liveCounts.members + liveCounts.transactions + liveCounts.financements + liveCounts.retraits} dossiers
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            {liveCounts.members} adhérents · {liveCounts.transactions} tx · {liveCounts.pendingQueue} file IDB
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">Volume dernier export</div>
          <div className="text-lg font-display font-bold text-charcoal dark:text-white tabular-nums">
            {config.lastBackupSizeBytes ? formatBytes(config.lastBackupSizeBytes) : '—'}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            Rétention : {draft.retentionCount} entrées
          </div>
        </div>
      </div>

      {/* Configuration & Restauration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Panneau gauche : Planification & Périmètre */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <CalendarClock size={18} className="text-lapis shrink-0" />
              <div>
                <h2 className="text-base font-display font-bold text-charcoal dark:text-white">
                  Paramètres de planification quotidienne
                </h2>
                <p className="text-xs text-slate-500">
                  Exécution automatique chaque jour à l&apos;heure configurée (avec rattrapage à l&apos;ouverture).
                </p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                className="w-4 h-4 accent-lapis rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-charcoal dark:text-slate-200">
                Activer
              </span>
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label
                htmlFor="backup-time"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Heure quotidienne (locale 24h)
              </label>
              <input
                id="backup-time"
                type="time"
                value={draft.scheduledTime}
                onChange={(e) => setDraft({ ...draft, scheduledTime: e.target.value })}
                className="w-full h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono tabular-nums text-charcoal dark:text-white outline-none focus:ring-2 ring-lapis/30"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="backup-retention"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Historique local conservé
              </label>
              <select
                id="backup-retention"
                value={draft.retentionCount}
                onChange={(e) => setDraft({ ...draft, retentionCount: Number(e.target.value) })}
                className="w-full h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-charcoal dark:text-white outline-none focus:ring-2 ring-lapis/30"
              >
                <option value={7}>7 dernières sauvegardes</option>
                <option value={14}>14 dernières sauvegardes</option>
                <option value={30}>30 dernières sauvegardes</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Contenu du package JSON & comportement
            </div>

            <label className="flex items-start gap-3 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.includeIndexedDB}
                onChange={(e) => setDraft({ ...draft, includeIndexedDB: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-lapis rounded cursor-pointer"
              />
              <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong className="text-charcoal dark:text-white block">Base IndexedDB (pmes_dosso_offline_db)</strong>
                Inclut les snapshots hors-ligne (admin_records) et la file de synchronisation en attente (pending_sync_queue).
              </span>
            </label>

            <label className="flex items-start gap-3 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.includeLocalStorage}
                onChange={(e) => setDraft({ ...draft, includeLocalStorage: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-lapis rounded cursor-pointer"
              />
              <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong className="text-charcoal dark:text-white block">Stockage localStorage complet (pmes_dosso_*)</strong>
                Inclut utilisateurs, adhérents, transactions, retraits, financements, mouvements de caisse, zones, corporations et audit.
              </span>
            </label>

            <label className="flex items-start gap-3 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.autoDownload}
                onChange={(e) => setDraft({ ...draft, autoDownload: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-lapis rounded cursor-pointer"
              />
              <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong className="text-charcoal dark:text-white block">Téléchargement automatique du fichier .json</strong>
                Déclenche le téléchargement local du package JSON dès que l&apos;échéance quotidienne est atteinte.
              </span>
            </label>

            <label className="flex items-start gap-3 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.includeSecurityHashes}
                onChange={(e) => setDraft({ ...draft, includeSecurityHashes: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-lapis rounded cursor-pointer"
              />
              <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong className="text-charcoal dark:text-white block">Conserver les hachages PIN / mots de passe</strong>
                Nécessaire pour restaurer l&apos;accès des comptes sans réinitialisation des codes PIN.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500">
              {saveNotice ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{saveNotice}</span>
              ) : hasUnsavedChanges ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Modifications non enregistrées</span>
              ) : (
                <span>Configuration synchronisée localement</span>
              )}
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-charcoal dark:bg-white text-white dark:text-charcoal text-xs font-bold hover:opacity-90 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              Enregistrer la planification
            </button>
          </div>
        </form>

        {/* Panneau droit : Vérification & Restauration JSON */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
              <div>
                <h2 className="text-base font-display font-bold text-charcoal dark:text-white">
                  Vérifier ou restaurer une archive
                </h2>
                <p className="text-xs text-slate-500">
                  Importez un fichier JSON exporté pour contrôler son intégrité ou restaurer l&apos;état local.
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-lapis text-center transition cursor-pointer space-y-1.5"
            >
              <Upload size={20} className="mx-auto text-slate-400" />
              <div className="text-xs font-semibold text-charcoal dark:text-white">
                Sélectionner un package .json
              </div>
              <div className="text-[11px] text-slate-400">
                Format PMES-AGR Dosso (IndexedDB + localStorage)
              </div>
            </button>

            {restoreError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{restoreError}</span>
              </div>
            )}

            {pendingRestorePkg && (
              <div className="p-4 rounded-xl bg-paper dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                <div className="font-bold text-charcoal dark:text-white flex items-center justify-between">
                  <span>Archive prête pour restauration</span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    v{pendingRestorePkg.schemaVersion}
                  </span>
                </div>
                <div className="text-slate-500 space-y-1 tabular-nums">
                  <div>
                    Date : {new Date(pendingRestorePkg.exportedAt).toLocaleString('fr-FR')}
                  </div>
                  <div>
                    Contenu : {pendingRestorePkg.summary.members} adhérents ·{' '}
                    {pendingRestorePkg.summary.transactions} transactions ·{' '}
                    {pendingRestorePkg.summary.localStorageKeys} clés locales
                  </div>
                  <div className="font-mono text-[10px] truncate text-slate-400">
                    SHA-256 : {pendingRestorePkg.checksumSha256}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isRestoring}
                    onClick={handleConfirmRestore}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60"
                  >
                    <RotateCcw size={13} />
                    {isRestoring ? 'Restauration...' : 'Confirmer la restauration'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRestorePkg(null)}
                    className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 font-semibold hover:text-charcoal dark:hover:text-white transition whitespace-nowrap cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
            <HardDrive size={14} className="shrink-0 text-slate-400" />
            <span>Empreinte SHA-256 calculée localement à chaque export JSON.</span>
          </div>
        </div>
      </div>

      {/* Historique des sauvegardes */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Archive size={16} className="text-slate-400" />
            <h2 className="text-sm font-display font-bold text-charcoal dark:text-white">
              Historique des packages générés ({history.length})
            </h2>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs font-semibold text-slate-500 hover:text-rose-500 transition whitespace-nowrap cursor-pointer"
            >
              Effacer l&apos;historique
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">
              Aucune sauvegarde locale enregistrée pour le moment.
            </p>
            <button
              type="button"
              onClick={handleRunNow}
              className="px-4 py-2 rounded-xl bg-lapis text-white text-xs font-bold inline-flex items-center gap-2 hover:bg-lapis/90 transition cursor-pointer"
            >
              <Download size={14} />
              Créer une première sauvegarde JSON
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper dark:bg-slate-950/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Date & Heure</th>
                  <th className="px-6 py-3.5 font-semibold">Mode</th>
                  <th className="px-6 py-3.5 font-semibold">Fichier</th>
                  <th className="px-6 py-3.5 font-semibold">Données</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Taille</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Empreinte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3.5 font-mono tabular-nums text-charcoal dark:text-slate-200 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {item.trigger === 'scheduled' ? 'Automatique' : 'Manuelle'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-charcoal dark:text-white truncate max-w-[220px]">
                      {item.filename}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 tabular-nums whitespace-nowrap">
                      {item.recordCounts.members} adh. · {item.recordCounts.transactions} tx ·{' '}
                      {item.recordCounts.localStorageKeys} clés
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono tabular-nums text-charcoal dark:text-slate-200 whitespace-nowrap">
                      {formatBytes(item.sizeBytes)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {item.checksum.slice(0, 12)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
