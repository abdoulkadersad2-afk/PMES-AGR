import { Corporation, Member, Transaction } from '../types';

/**
 * Utilities for exporting data from PMES-AGR Dosso
 */

export interface TransactionExportFilterOptions {
  members?: Member[];
  corporations?: Corporation[];
  dateStart?: string;
  dateEnd?: string;
  corporationId?: string;
}

const sanitizeSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

export const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Headers
  csvRows.push(
    headers
      .map((h) => `"${h.replace(/"/g, '""')}"`)
      .join(',')
  );

  // Data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const raw = row[header];
      const val = raw === null || raw === undefined ? '' : String(raw);
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  // UTF-8 BOM so accented French characters render cleanly in Excel / LibreOffice
  const csvContent = `\uFEFF${csvRows.join('\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const resolveTransactionMember = (
  tx: Transaction,
  members: Member[] = []
): Member | undefined => {
  const livretUpper = (tx.member_livret || '').trim().toUpperCase();
  return members.find(
    (m) =>
      m.id === tx.member_id ||
      (livretUpper && (m.livret || '').trim().toUpperCase() === livretUpper)
  );
};

export const resolveTransactionCorporation = (
  tx: Transaction,
  members: Member[] = [],
  corporations: Corporation[] = []
): { id: string; nom: string } => {
  const member = resolveTransactionMember(tx, members);
  if (!member) {
    return { id: '', nom: 'Non renseignée' };
  }
  const corp = corporations.find(
    (c) =>
      (member.corporationId && c.id === member.corporationId) ||
      (member.corporationNom &&
        c.nom.trim().toLowerCase() === member.corporationNom.trim().toLowerCase())
  );
  return {
    id: corp?.id || member.corporationId || '',
    nom: corp?.nom || member.corporationNom || 'Non renseignée',
  };
};

export const filterTransactions = (
  transactions: Transaction[],
  options: TransactionExportFilterOptions = {}
): Transaction[] => {
  const {
    members = [],
    corporations = [],
    dateStart,
    dateEnd,
    corporationId,
  } = options;

  const startMs = dateStart ? new Date(`${dateStart}T00:00:00`).getTime() : null;
  const endMs = dateEnd ? new Date(`${dateEnd}T23:59:59.999`).getTime() : null;
  const activeCorpFilter =
    corporationId && corporationId !== 'All' ? corporationId.trim() : '';
  const matchedFilterCorp = activeCorpFilter
    ? corporations.find(
        (c) =>
          c.id === activeCorpFilter ||
          c.nom.trim().toLowerCase() === activeCorpFilter.toLowerCase()
      )
    : undefined;

  return [...transactions]
    .filter((tx) => {
      const txMs = new Date(tx.date).getTime();
      if (startMs !== null && !Number.isNaN(startMs) && (Number.isNaN(txMs) || txMs < startMs)) {
        return false;
      }
      if (endMs !== null && !Number.isNaN(endMs) && (Number.isNaN(txMs) || txMs > endMs)) {
        return false;
      }

      if (activeCorpFilter) {
        const txCorp = resolveTransactionCorporation(tx, members, corporations);
        const matchesId = txCorp.id && txCorp.id === activeCorpFilter;
        const matchesCorpId =
          matchedFilterCorp && txCorp.id === matchedFilterCorp.id;
        const matchesName =
          txCorp.nom.trim().toLowerCase() ===
          (matchedFilterCorp?.nom || activeCorpFilter).trim().toLowerCase();
        if (!matchesId && !matchesCorpId && !matchesName) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
};

export const exportTransactionsToCSV = (
  transactions: Transaction[],
  options: TransactionExportFilterOptions & {
    applyFilters?: boolean;
    filenamePrefix?: string;
  } = {}
) => {
  const {
    members = [],
    corporations = [],
    dateStart,
    dateEnd,
    corporationId,
    applyFilters = true,
    filenamePrefix = 'pmes_transactions',
  } = options;

  const list = applyFilters
    ? filterTransactions(transactions, {
        members,
        corporations,
        dateStart,
        dateEnd,
        corporationId,
      })
    : [...transactions].sort((a, b) => {
        const ta = new Date(a.date).getTime();
        const tb = new Date(b.date).getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      });

  if (!list.length) return;

  const data = list.map((t) => {
    const member = resolveTransactionMember(t, members);
    const corp = resolveTransactionCorporation(t, members, corporations);
    const parsedDate = new Date(t.date);
    return {
      ID: t.id,
      Date: Number.isNaN(parsedDate.getTime()) ? '---' : parsedDate.toLocaleString('fr-FR'),
      Adherent: t.member_nom || member?.nom || 'Adhérent',
      Livret: t.member_livret || member?.livret || 'N/A',
      Corporation: corp.nom,
      Type: (t.type || 'autre').toUpperCase(),
      'Montant (F CFA)': t.montant,
      'Solde Avant': t.solde_avant ?? '',
      'Solde Apres': t.solde_apres ?? '',
      Reference: t.reference || `PMES-${t.id.slice(-6).toUpperCase()}`,
      Description: t.description || '',
      Agent: t.agent,
      Zone: t.zone || member?.zone || 'Dosso',
      Validee: t.validated ? 'Oui' : 'Non',
    };
  });

  const parts = [filenamePrefix];
  if (dateStart || dateEnd) {
    parts.push(`${dateStart || 'debut'}_au_${dateEnd || 'aujourdhui'}`);
  }
  if (corporationId && corporationId !== 'All') {
    const matched = corporations.find((c) => c.id === corporationId);
    parts.push(sanitizeSlug(matched?.nom || corporationId));
  }
  if (!dateStart && !dateEnd && (!corporationId || corporationId === 'All')) {
    parts.push('complet');
  }

  exportToCSV(data, parts.join('_'));
};

export const exportMembersToCSV = (members: Member[]) => {
  const data = members.map((m) => {
    const createdAt = new Date(m.created_at);
    return {
      ID: m.id,
      Nom: m.nom,
      Telephone: m.telephone,
      Livret: m.livret,
      Zone: m.zone,
      Corporation: m.corporationNom || 'Non renseignée',
      Solde: m.solde,
      Statut: m.status,
      'Date Inscription': Number.isNaN(createdAt.getTime())
        ? '---'
        : createdAt.toLocaleDateString('fr-FR'),
    };
  });
  exportToCSV(data, 'pmes_membres');
};
