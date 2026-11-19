export type UserRole = 'ADMIN' | 'AGENT' | 'TRESORIER' | 'MAIRE';

export interface User {
  id: string;
  username: string;
  nom: string;
  role: UserRole;
  zone: string;
  password?: string;
  created_at?: string;
  telephone?: string;
}

export type MemberStatus = 'valide' | 'en_attente' | 'rejete' | 'suspendu';

export interface Member {
  id: string;
  nom: string;
  telephone: string;
  pin: string; // 4 digits
  livret: string; // PMES-XXX-XXXX
  zone: string;
  corporationId?: string;
  corporationNom?: string;
  corporationEmoji?: string;
  solde: number; // in FCFA
  status: MemberStatus;
  created_at: string;
  notes?: string;
  activite?: string;
  photo?: string; // Base64 data URL or photo URL
  objectif_montant?: number;
  objectif_date?: string;
  objectif_label?: string;
  date_naissance?: string;
  lieu_naissance?: string;
}

export type TransactionType = 'depot' | 'retrait' | 'financement' | 'remboursement' | 'frais' | 'adhesion' | 'investissement';

export interface Transaction {
  id: string;
  uid?: string;
  member_id: string;
  member_nom?: string;
  member_livret?: string;
  type: TransactionType;
  montant: number; // FCFA
  date: string;
  agent: string; // username
  zone: string;
  validated: boolean;
  solde_apres?: number;
  solde_avant?: number;
  reference?: string;
  description?: string;
}

export type DemandeStatus = 'en_attente' | 'valide' | 'rejete' | 'decaissed';

export interface DemandeRetrait {
  id: string;
  uid?: string;
  member_id: string;
  montant: number;
  motif: string;
  status: DemandeStatus;
  date: string;
  type: 'retrait';
  date_traitement?: string;
  agent_validateur?: string;
  motif_rejet?: string;
}

export interface Echeance {
  numero: number;
  date: string;
  montant: number;
  paye: boolean;
  date_paiement?: string;
}

export type FinancementType = 'mourabaha' | 'moudaraba' | 'qard_al_hassane';

export interface DemandeFinancement {
  id: string;
  uid?: string;
  member_id: string;
  montant: number; // Montant financé demandé
  duree_mois: number;
  motif: string; // Projet d'activité génératrice de revenus
  status: DemandeStatus;
  date: string;
  type: 'financement';
  financement_type: FinancementType; // Mourabaha, Moudaraba, Qard Al Hassane
  // Details specifiques par type de financement
  marge_beneficiaire?: number; // Pour Mourabaha : marge commerciale en F CFA (0% pour Qard al-Hassane)
  partage_profit_pct?: number; // Pour Moudaraba : répartition du profit (ex: 30% caisse / 70% entrepreneur)
  cout_achat?: number; // Pour Mourabaha : coût d'achat du bien/équipement
  frequence?: 'hebdomadaire' | 'mensuel';
  montant_total?: number; // Montant total à rembourser (SANS taux de 5%, pur principe islamique/solidaire)
  montant_rembourse?: number;
  echeances?: Echeance[];
  date_traitement?: string;
  agent_validateur?: string;
  decaissed_from_caisse?: boolean;
}

export interface Corporation {
  id: string;
  nom: string;
  emoji: string;
  categorie: string;
  membres: number;
  description?: string;
  frais_adhesion: number; // Frais d'adhésion planifiés par l'admin (en FCFA), alimente la Caisse Financement
}

export interface CaisseMouvement {
  id: string;
  date: string;
  type: 'adhesion' | 'remboursement' | 'decaissement' | 'dotation_initiale' | 'cotisation_sante' | 'assistance_sociale' | 'investissement_flux';
  montant: number; // FCFA
  member_id?: string;
  member_nom?: string;
  corporation_nom?: string;
  financement_id?: string;
  description: string;
  agent: string;
  motif_social?: 'accident' | 'maladie' | 'accouchement' | 'deces';
}

export type InvestissementStatus = 'ouvert' | 'ferme' | 'cloture' | 'annule';

export interface InvestissementProjet {
  id: string;
  titre: string;
  description: string;
  montant_cible: number;
  montant_actuel: number;
  participation_min: number;
  date_limite: string; // Date de fin de collecte
  date_echeance: string; // Date de vente/retour sur investissement
  profit_estime_pct: number;
  status: InvestissementStatus;
  created_at: string;
  createur: string;
  nb_participants: number;
  photo?: string;
}

export interface InvestissementParticipation {
  id: string;
  projet_id: string;
  member_id: string;
  member_nom: string;
  member_livret: string;
  montant: number;
  date: string;
  status: 'actif' | 'rembourse';
  gain_reel?: number;
}

export interface ZoneItem {
  id: string;
  nom: string;
  description: string;
  agent_principal?: string;
  created_at?: string;
}

export type SyncStatus = 'local' | 'connecting' | 'connected' | 'error' | 'syncing';

export interface ReceiptData {
  transactionId: string;
  type: TransactionType;
  reference: string;
  date: string;
  memberNom: string;
  memberLivret: string;
  memberTelephone: string;
  zone: string;
  montant: number;
  soldeAvant?: number;
  soldeApres?: number;
  agentNom: string;
  motif?: string;
}
export interface AuditLog {
  id: string;
  uid?: string;
  date: string;
  action: string;
  acteur: string;
  role: UserRole;
  details: string;
  cible?: string;
  categorie: 'critique' | 'info' | 'securite';
}
