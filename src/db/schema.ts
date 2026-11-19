import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

// Users table (Firebase Auth linked)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  nom: text('nom'),
  role: text('role').default('AGENT'), // 'ADMIN' | 'AGENT' | 'TRESORIER' | 'MAIRE'
  zone: text('zone'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Corporations table with planned admission fees
export const corporations = pgTable('corporations', {
  id: text('id').primaryKey(),
  nom: text('nom').notNull(),
  emoji: text('emoji').notNull(),
  categorie: text('categorie').notNull(),
  membres: integer('membres').default(0),
  fraisAdhesion: integer('frais_adhesion').default(5000).notNull(),
  description: text('description'),
});

// Zones table
export const zones = pgTable('zones', {
  id: text('id').primaryKey(),
  nom: text('nom').notNull(),
  description: text('description'),
  agentPrincipal: text('agent_principal'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Members table
export const members = pgTable('members', {
  id: text('id').primaryKey(),
  nom: text('nom').notNull(),
  telephone: text('telephone').notNull().unique(),
  pin: text('pin').notNull(),
  livret: text('livret').notNull().unique(),
  zone: text('zone').notNull(),
  corporationId: text('corporation_id').references(() => corporations.id),
  corporationNom: text('corporation_nom'),
  corporationEmoji: text('corporation_emoji'),
  solde: integer('solde').default(0).notNull(),
  status: text('status').default('en_attente').notNull(), // 'valide' | 'en_attente' | 'rejete'
  photo: text('photo'),
  activite: text('activite'),
  notes: text('notes'),
  objectifMontant: integer('objectif_montant'),
  objectifDate: text('objectif_date'),
  objectifLabel: text('objectif_label'),
  dateNaissance: text('date_naissance'),
  lieuNaissance: text('lieu_naissance'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Transactions table
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  memberId: text('member_id').references(() => members.id).notNull(),
  memberNom: text('member_nom'),
  memberLivret: text('member_livret'),
  type: text('type').notNull(), // 'depot' | 'retrait' | 'financement' | 'remboursement' | 'frais' | 'adhesion'
  montant: integer('montant').notNull(),
  date: text('date').notNull(),
  agent: text('agent').notNull(),
  zone: text('zone').notNull(),
  validated: boolean('validated').default(true),
  soldeAvant: integer('solde_avant'),
  soldeApres: integer('solde_apres'),
  reference: text('reference'),
  description: text('description'),
});

// Demandes de Retrait table
export const retraits = pgTable('retraits', {
  id: text('id').primaryKey(),
  memberId: text('member_id').references(() => members.id).notNull(),
  montant: integer('montant').notNull(),
  motif: text('motif').notNull(),
  status: text('status').default('en_attente').notNull(), // 'en_attente' | 'valide' | 'rejete'
  date: text('date').notNull(),
  dateTraitement: text('date_traitement'),
  agentValidateur: text('agent_validateur'),
  motifRejet: text('motif_rejet'),
});

// Demandes de Financement table (Mourabaha, Moudaraba, Qard Al Hassane)
export const financements = pgTable('financements', {
  id: text('id').primaryKey(),
  memberId: text('member_id').references(() => members.id).notNull(),
  montant: integer('montant').notNull(),
  dureeMois: integer('duree_mois').notNull(),
  motif: text('motif').notNull(),
  status: text('status').default('en_attente').notNull(), // 'en_attente' | 'valide' | 'rejete' | 'decaissed'
  date: text('date').notNull(),
  financementType: text('financement_type').notNull(), // 'mourabaha' | 'moudaraba' | 'qard_al_hassane'
  frequence: text('frequence').default('mensuel'),
  montantTotal: integer('montant_total').notNull(),
  montantRembourse: integer('montant_rembourse').default(0),
  margeBeneficiaire: integer('marge_beneficiaire'),
  partageProfitPct: integer('partage_profit_pct'),
  coutAchat: integer('cout_achat'),
  echeancesJson: text('echeances_json'),
  decaissedFromCaisse: boolean('decaissed_from_caisse').default(false),
  agentValidateur: text('agent_validateur'),
  dateTraitement: text('date_traitement'),
});

// Caisse Mouvements (Autonome Financements AGR)
export const caisseMouvements = pgTable('caisse_mouvements', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  type: text('type').notNull(), // 'adhesion' | 'remboursement' | 'decaissement' | 'dotation_initiale'
  montant: integer('montant').notNull(),
  memberId: text('member_id'),
  memberNom: text('member_nom'),
  corporationNom: text('corporation_nom'),
  financementId: text('financement_id'),
  description: text('description').notNull(),
  agent: text('agent').notNull(),
});

// Relations
export const membersRelations = relations(members, ({ one, many }) => ({
  corporation: one(corporations, {
    fields: [members.corporationId],
    references: [corporations.id],
  }),
  transactions: many(transactions),
  retraits: many(retraits),
  financements: many(financements),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  member: one(members, {
    fields: [transactions.memberId],
    references: [members.id],
  }),
}));

export const retraitsRelations = relations(retraits, ({ one }) => ({
  member: one(members, {
    fields: [retraits.memberId],
    references: [members.id],
  }),
}));

export const financementsRelations = relations(financements, ({ one }) => ({
  member: one(members, {
    fields: [financements.memberId],
    references: [members.id],
  }),
}));
