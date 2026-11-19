import express from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { 
  users, members, corporations, zones, transactions, retraits, financements, caisseMouvements 
} from './src/db/schema.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { eq } from 'drizzle-orm';
import {
  sendOtpCode,
  verifyOtpCode,
  dispatchSmsMessage,
  detectOtpProvider,
  normalizePhoneE164,
} from './src/services/otpServer.ts';

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

// AUTH USER SYNC: Link Firebase Auth to PostgreSQL
app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || `${uid}@pmes-dosso.ne`;
    const nom = req.body?.nom || req.user?.name || 'Utilisateur';

    if (!uid) {
      return res.status(400).json({ error: 'UID manquant' });
    }

    const user = await getOrCreateUser(uid, email, nom);
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Error syncing auth user to PostgreSQL:', error);
    res.status(500).json({ error: error.message || 'Erreur synchronisation utilisateur' });
  }
});

// INITIAL DB SEEDING: Pre-fill PostgreSQL if empty
app.post('/api/db/seed', async (req, res) => {
  try {
    const { 
      initialCorporations, initialZones, initialMembers, 
      initialTransactions, initialRetraits, initialFinancements, initialCaisseMouvements 
    } = req.body;

    // Check if corporations exist
    const existingCorpos = await db.select().from(corporations);
    if (existingCorpos.length === 0 && Array.isArray(initialCorporations) && initialCorporations.length > 0) {
      for (const c of initialCorporations) {
        await db.insert(corporations).values({
          id: c.id,
          nom: c.nom,
          emoji: c.emoji,
          categorie: c.categorie,
          membres: c.membres || 0,
          fraisAdhesion: c.frais_adhesion || 5000,
          description: c.description,
        }).onConflictDoNothing();
      }
    }

    // Check if zones exist
    const existingZones = await db.select().from(zones);
    if (existingZones.length === 0 && Array.isArray(initialZones) && initialZones.length > 0) {
      for (const z of initialZones) {
        await db.insert(zones).values({
          id: z.id,
          nom: z.nom,
          description: z.description,
          agentPrincipal: z.agent_principal,
        }).onConflictDoNothing();
      }
    }

    // Check if members exist
    const existingMembers = await db.select().from(members);
    if (existingMembers.length === 0 && Array.isArray(initialMembers) && initialMembers.length > 0) {
      for (const m of initialMembers) {
        await db.insert(members).values({
          id: m.id,
          nom: m.nom,
          telephone: m.telephone,
          pin: m.pin,
          livret: m.livret,
          zone: m.zone,
          corporationId: m.corporationId,
          corporationNom: m.corporationNom,
          corporationEmoji: m.corporationEmoji,
          solde: m.solde || 0,
          status: m.status || 'valide',
          photo: m.photo,
          activite: m.activite,
          notes: m.notes,
          objectifMontant: m.objectif_montant ?? null,
          objectifDate: m.objectif_date ?? null,
          objectifLabel: m.objectif_label ?? null,
          dateNaissance: m.date_naissance ?? null,
          lieuNaissance: m.lieu_naissance ?? null,
          ...(m.created_at && !Number.isNaN(new Date(m.created_at).getTime())
            ? { createdAt: new Date(m.created_at) }
            : {}),
        }).onConflictDoNothing();
      }
    }

    // Check if transactions exist
    const existingTxs = await db.select().from(transactions);
    if (existingTxs.length === 0 && Array.isArray(initialTransactions) && initialTransactions.length > 0) {
      for (const t of initialTransactions) {
        await db.insert(transactions).values({
          id: t.id,
          memberId: t.member_id,
          memberNom: t.member_nom,
          memberLivret: t.member_livret,
          type: t.type,
          montant: t.montant,
          date: t.date,
          agent: t.agent,
          zone: t.zone,
          validated: t.validated ?? true,
          soldeAvant: t.solde_avant,
          soldeApres: t.solde_apres,
          reference: t.reference,
          description: t.description,
        }).onConflictDoNothing();
      }
    }

    // Check if retraits exist
    const existingRetraits = await db.select().from(retraits);
    if (existingRetraits.length === 0 && Array.isArray(initialRetraits) && initialRetraits.length > 0) {
      for (const r of initialRetraits) {
        await db.insert(retraits).values({
          id: r.id,
          memberId: r.member_id,
          montant: r.montant,
          motif: r.motif,
          status: r.status || 'en_attente',
          date: r.date,
          dateTraitement: r.date_traitement ?? null,
          agentValidateur: r.agent_validateur ?? null,
          motifRejet: r.motif_rejet ?? null,
        }).onConflictDoNothing();
      }
    }

    // Check if financements exist
    const existingFinancements = await db.select().from(financements);
    if (existingFinancements.length === 0 && Array.isArray(initialFinancements) && initialFinancements.length > 0) {
      for (const f of initialFinancements) {
        await db.insert(financements).values({
          id: f.id,
          memberId: f.member_id,
          montant: f.montant,
          dureeMois: f.duree_mois,
          motif: f.motif,
          status: f.status,
          date: f.date,
          financementType: f.financement_type || 'qard_al_hassane',
          frequence: f.frequence || 'mensuel',
          montantTotal: f.montant_total || f.montant,
          montantRembourse: f.montant_rembourse || 0,
          margeBeneficiaire: f.marge_beneficiaire,
          partageProfitPct: f.partage_profit_pct,
          coutAchat: f.cout_achat,
          echeancesJson: f.echeances ? JSON.stringify(f.echeances) : null,
          decaissedFromCaisse: f.decaissed_from_caisse ?? false,
          agentValidateur: f.agent_validateur,
          dateTraitement: f.date_traitement,
        }).onConflictDoNothing();
      }
    }

    // Check if caisse mouvements exist
    const existingMouvements = await db.select().from(caisseMouvements);
    if (existingMouvements.length === 0 && Array.isArray(initialCaisseMouvements) && initialCaisseMouvements.length > 0) {
      for (const cm of initialCaisseMouvements) {
        await db.insert(caisseMouvements).values({
          id: cm.id,
          date: cm.date,
          type: cm.type,
          montant: cm.montant,
          memberId: cm.member_id,
          memberNom: cm.member_nom,
          corporationNom: cm.corporation_nom,
          financementId: cm.financement_id,
          description: cm.description,
          agent: cm.agent,
        }).onConflictDoNothing();
      }
    }

    res.json({ success: true, message: 'Base de données PostgreSQL initialisée avec succès' });
  } catch (error: any) {
    console.error('Error seeding database:', error);
    res.status(500).json({ error: error.message || 'Erreur initialisation base' });
  }
});

// FULL DATA SYNC ENDPOINT: Get all current state from PostgreSQL
app.get('/api/db/sync-all', async (_req, res) => {
  try {
    const [
      corposList, zonesList, membersList, txsList, retraitsList, financementsList, mouvementsList
    ] = await Promise.all([
      db.select().from(corporations),
      db.select().from(zones),
      db.select().from(members),
      db.select().from(transactions),
      db.select().from(retraits),
      db.select().from(financements),
      db.select().from(caisseMouvements),
    ]);

    const byDateDesc = (a: { date?: string }, b: { date?: string }) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    };

    // Map back to camel/snake case format expected by front
    const mappedCorpos = corposList.map(c => ({
      id: c.id,
      nom: c.nom,
      emoji: c.emoji,
      categorie: c.categorie,
      membres: c.membres ?? 0,
      frais_adhesion: c.fraisAdhesion,
      description: c.description ?? undefined,
    }));

    const mappedZones = zonesList.map(z => ({
      id: z.id,
      nom: z.nom,
      description: z.description ?? '',
      agent_principal: z.agentPrincipal ?? undefined,
      created_at: z.createdAt?.toISOString(),
    }));

    const mappedMembers = membersList.map(m => ({
      id: m.id,
      nom: m.nom,
      telephone: m.telephone,
      pin: m.pin,
      livret: m.livret,
      zone: m.zone,
      corporationId: m.corporationId ?? undefined,
      corporationNom: m.corporationNom ?? undefined,
      corporationEmoji: m.corporationEmoji ?? undefined,
      solde: m.solde,
      status: m.status as any,
      photo: m.photo ?? undefined,
      activite: m.activite ?? undefined,
      notes: m.notes ?? undefined,
      objectif_montant: m.objectifMontant ?? undefined,
      objectif_date: m.objectifDate ?? undefined,
      objectif_label: m.objectifLabel ?? undefined,
      date_naissance: m.dateNaissance ?? undefined,
      lieu_naissance: m.lieuNaissance ?? undefined,
      created_at: m.createdAt?.toISOString() || new Date().toISOString(),
    }));

    const mappedTransactions = txsList
      .map(t => ({
        id: t.id,
        member_id: t.memberId,
        member_nom: t.memberNom ?? undefined,
        member_livret: t.memberLivret ?? undefined,
        type: t.type as any,
        montant: t.montant,
        date: t.date,
        agent: t.agent,
        zone: t.zone,
        validated: t.validated ?? true,
        solde_avant: t.soldeAvant ?? undefined,
        solde_apres: t.soldeApres ?? undefined,
        reference: t.reference ?? undefined,
        description: t.description ?? undefined,
      }))
      .sort(byDateDesc);

    const mappedRetraits = retraitsList
      .map(r => ({
        id: r.id,
        member_id: r.memberId,
        montant: r.montant,
        motif: r.motif,
        status: r.status as any,
        date: r.date,
        type: 'retrait' as const,
        date_traitement: r.dateTraitement ?? undefined,
        agent_validateur: r.agentValidateur ?? undefined,
        motif_rejet: r.motifRejet ?? undefined,
      }))
      .sort(byDateDesc);

    const mappedFinancements = financementsList
      .map(f => {
        let echeances = undefined;
        try {
          if (f.echeancesJson) echeances = JSON.parse(f.echeancesJson);
        } catch {}
        return {
          id: f.id,
          member_id: f.memberId,
          montant: f.montant,
          duree_mois: f.dureeMois,
          motif: f.motif,
          status: f.status as any,
          date: f.date,
          type: 'financement' as const,
          financement_type: f.financementType as any,
          frequence: f.frequence as any,
          montant_total: f.montantTotal,
          montant_rembourse: f.montantRembourse ?? 0,
          marge_beneficiaire: f.margeBeneficiaire ?? undefined,
          partage_profit_pct: f.partageProfitPct ?? undefined,
          cout_achat: f.coutAchat ?? undefined,
          echeances,
          decaissed_from_caisse: f.decaissedFromCaisse ?? false,
          agent_validateur: f.agentValidateur ?? undefined,
          date_traitement: f.dateTraitement ?? undefined,
        };
      })
      .sort(byDateDesc);

    const mappedMouvements = mouvementsList
      .map(cm => ({
        id: cm.id,
        date: cm.date,
        type: cm.type as any,
        montant: cm.montant,
        member_id: cm.memberId ?? undefined,
        member_nom: cm.memberNom ?? undefined,
        corporation_nom: cm.corporationNom ?? undefined,
        financement_id: cm.financementId ?? undefined,
        description: cm.description,
        agent: cm.agent,
      }))
      .sort(byDateDesc);

    res.json({
      corporations: mappedCorpos,
      zones: mappedZones,
      members: mappedMembers,
      transactions: mappedTransactions,
      retraits: mappedRetraits,
      financements: mappedFinancements,
      caisseMouvements: mappedMouvements,
    });
  } catch (error: any) {
    console.error('Error syncing all tables from PostgreSQL:', error);
    res.status(500).json({ error: error.message || 'Erreur lecture globale base' });
  }
});

// CLOUD SQL REST API: INDIVIDUAL MUTATIONS
// 1. Members
app.post('/api/db/members', async (req, res) => {
  try {
    const m = req.body;
    await db.insert(members).values({
      id: m.id,
      nom: m.nom,
      telephone: m.telephone,
      pin: m.pin,
      livret: m.livret,
      zone: m.zone,
      corporationId: m.corporationId,
      corporationNom: m.corporationNom,
      corporationEmoji: m.corporationEmoji,
      solde: m.solde || 0,
      status: m.status || 'valide',
      photo: m.photo,
      activite: m.activite,
      notes: m.notes,
      objectifMontant: m.objectif_montant ?? null,
      objectifDate: m.objectif_date ?? null,
      objectifLabel: m.objectif_label ?? null,
      dateNaissance: m.date_naissance ?? null,
      lieuNaissance: m.lieu_naissance ?? null,
    }).onConflictDoUpdate({
      target: members.id,
      set: {
        nom: m.nom,
        telephone: m.telephone,
        pin: m.pin,
        zone: m.zone,
        corporationId: m.corporationId,
        corporationNom: m.corporationNom,
        corporationEmoji: m.corporationEmoji,
        solde: m.solde,
        status: m.status,
        photo: m.photo,
        activite: m.activite,
        notes: m.notes,
        objectifMontant: m.objectif_montant ?? null,
        objectifDate: m.objectif_date ?? null,
        objectifLabel: m.objectif_label ?? null,
        dateNaissance: m.date_naissance ?? null,
        lieuNaissance: m.lieu_naissance ?? null,
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error inserting/updating member:', error);
    res.status(500).json({ error: 'Erreur enregistrement membre' });
  }
});

app.patch('/api/db/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const updateObj: any = {};
    if (updates.nom !== undefined) updateObj.nom = updates.nom;
    if (updates.telephone !== undefined) updateObj.telephone = updates.telephone;
    if (updates.zone !== undefined) updateObj.zone = updates.zone;
    if (updates.corporationId !== undefined) updateObj.corporationId = updates.corporationId;
    if (updates.corporationNom !== undefined) updateObj.corporationNom = updates.corporationNom;
    if (updates.corporationEmoji !== undefined) updateObj.corporationEmoji = updates.corporationEmoji;
    if (updates.activite !== undefined) updateObj.activite = updates.activite;
    if (updates.notes !== undefined) updateObj.notes = updates.notes;
    if (updates.status !== undefined) updateObj.status = updates.status;
    if (updates.solde !== undefined) updateObj.solde = updates.solde;
    if (updates.pin !== undefined) updateObj.pin = updates.pin;
    if (updates.photo !== undefined) updateObj.photo = updates.photo;
    if (updates.objectif_montant !== undefined) updateObj.objectifMontant = updates.objectif_montant;
    if (updates.objectif_date !== undefined) updateObj.objectifDate = updates.objectif_date;
    if (updates.objectif_label !== undefined) updateObj.objectifLabel = updates.objectif_label;
    if (updates.date_naissance !== undefined) updateObj.dateNaissance = updates.date_naissance;
    if (updates.lieu_naissance !== undefined) updateObj.lieuNaissance = updates.lieu_naissance;

    if (Object.keys(updateObj).length === 0) {
      return res.json({ success: true });
    }

    await db.update(members).set(updateObj).where(eq(members.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Erreur mise à jour membre' });
  }
});

app.delete('/api/db/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(members).where(eq(members.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting member:', error);
    res.status(500).json({ error: 'Erreur suppression membre (des transactions ou financements y sont peut-être liés)' });
  }
});

// 2. Transactions
app.post('/api/db/transactions', async (req, res) => {
  try {
    const t = req.body;
    await db.insert(transactions).values({
      id: t.id,
      memberId: t.member_id,
      memberNom: t.member_nom,
      memberLivret: t.member_livret,
      type: t.type,
      montant: t.montant,
      date: t.date,
      agent: t.agent,
      zone: t.zone,
      validated: t.validated ?? true,
      soldeAvant: t.solde_avant,
      soldeApres: t.solde_apres,
      reference: t.reference,
      description: t.description,
    }).onConflictDoNothing();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error inserting transaction:', error);
    res.status(500).json({ error: 'Erreur enregistrement transaction' });
  }
});

app.patch('/api/db/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const updateObj: any = {};
    if (updates.montant !== undefined) updateObj.montant = updates.montant;
    if (updates.description !== undefined) updateObj.description = updates.description;
    if (updates.validated !== undefined) updateObj.validated = updates.validated;
    if (updates.solde_avant !== undefined) updateObj.soldeAvant = updates.solde_avant;
    if (updates.solde_apres !== undefined) updateObj.soldeApres = updates.solde_apres;
    if (updates.zone !== undefined) updateObj.zone = updates.zone;
    if (updates.agent !== undefined) updateObj.agent = updates.agent;
    if (updates.reference !== undefined) updateObj.reference = updates.reference;

    if (Object.keys(updateObj).length === 0) {
      return res.json({ success: true });
    }

    await db.update(transactions).set(updateObj).where(eq(transactions.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Erreur mise à jour transaction' });
  }
});

// 2b. Retraits
app.post('/api/db/retraits', async (req, res) => {
  try {
    const r = req.body;
    await db.insert(retraits).values({
      id: r.id,
      memberId: r.member_id,
      montant: r.montant,
      motif: r.motif,
      status: r.status || 'en_attente',
      date: r.date,
      dateTraitement: r.date_traitement ?? null,
      agentValidateur: r.agent_validateur ?? null,
      motifRejet: r.motif_rejet ?? null,
    }).onConflictDoNothing();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error inserting retrait:', error);
    res.status(500).json({ error: 'Erreur enregistrement demande de retrait' });
  }
});

app.patch('/api/db/retraits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const updateObj: any = {};
    if (updates.status !== undefined) updateObj.status = updates.status;
    if (updates.date_traitement !== undefined) updateObj.dateTraitement = updates.date_traitement;
    if (updates.agent_validateur !== undefined) updateObj.agentValidateur = updates.agent_validateur;
    if (updates.motif_rejet !== undefined) updateObj.motifRejet = updates.motif_rejet;

    if (Object.keys(updateObj).length === 0) {
      return res.json({ success: true });
    }

    await db.update(retraits).set(updateObj).where(eq(retraits.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating retrait:', error);
    res.status(500).json({ error: 'Erreur mise à jour demande de retrait' });
  }
});

// 3. Financements
app.post('/api/db/financements', async (req, res) => {
  try {
    const f = req.body;
    await db.insert(financements).values({
      id: f.id,
      memberId: f.member_id,
      montant: f.montant,
      dureeMois: f.duree_mois,
      motif: f.motif,
      status: f.status,
      date: f.date,
      financementType: f.financement_type || 'qard_al_hassane',
      frequence: f.frequence || 'mensuel',
      montantTotal: f.montant_total || f.montant,
      montantRembourse: f.montant_rembourse || 0,
      margeBeneficiaire: f.marge_beneficiaire,
      partageProfitPct: f.partage_profit_pct,
      coutAchat: f.cout_achat,
      echeancesJson: f.echeances ? JSON.stringify(f.echeances) : null,
      decaissedFromCaisse: f.decaissed_from_caisse ?? false,
      agentValidateur: f.agent_validateur,
      dateTraitement: f.date_traitement,
    }).onConflictDoNothing();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error inserting financement:', error);
    res.status(500).json({ error: 'Erreur enregistrement financement' });
  }
});

app.patch('/api/db/financements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const updateObj: any = {};
    if (updates.status !== undefined) updateObj.status = updates.status;
    if (updates.montant_rembourse !== undefined) updateObj.montantRembourse = updates.montant_rembourse;
    if (updates.echeances !== undefined) updateObj.echeancesJson = JSON.stringify(updates.echeances);
    if (updates.decaissed_from_caisse !== undefined) updateObj.decaissedFromCaisse = updates.decaissed_from_caisse;

    if (Object.keys(updateObj).length === 0) {
      return res.json({ success: true });
    }

    await db.update(financements).set(updateObj).where(eq(financements.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating financement:', error);
    res.status(500).json({ error: 'Erreur mise à jour financement' });
  }
});

app.delete('/api/db/financements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(financements).where(eq(financements.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting financement:', error);
    res.status(500).json({ error: 'Erreur suppression financement' });
  }
});

// 4. Caisse Mouvements
app.post('/api/db/caisse-mouvements', async (req, res) => {
  try {
    const cm = req.body;
    await db.insert(caisseMouvements).values({
      id: cm.id,
      date: cm.date,
      type: cm.type,
      montant: cm.montant,
      memberId: cm.member_id,
      memberNom: cm.member_nom,
      corporationNom: cm.corporation_nom,
      financementId: cm.financement_id,
      description: cm.description,
      agent: cm.agent,
    }).onConflictDoNothing();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error inserting caisse mouvement:', error);
    res.status(500).json({ error: 'Erreur enregistrement mouvement caisse' });
  }
});

// 5. Corporations (including fees and emojis)
app.post('/api/db/corporations', async (req, res) => {
  try {
    const c = req.body;
    await db.insert(corporations).values({
      id: c.id,
      nom: c.nom,
      emoji: c.emoji,
      categorie: c.categorie,
      membres: c.membres || 0,
      fraisAdhesion: c.frais_adhesion || 5000,
      description: c.description,
    }).onConflictDoUpdate({
      target: corporations.id,
      set: {
        nom: c.nom,
        emoji: c.emoji,
        categorie: c.categorie,
        fraisAdhesion: c.frais_adhesion || 5000,
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error saving corporation:', error);
    res.status(500).json({ error: 'Erreur enregistrement corporation' });
  }
});

app.patch('/api/db/corporations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const updateObj: any = {};
    if (updates.nom !== undefined) updateObj.nom = updates.nom;
    if (updates.categorie !== undefined) updateObj.categorie = updates.categorie;
    if (updates.membres !== undefined) updateObj.membres = updates.membres;
    if (updates.description !== undefined) updateObj.description = updates.description;
    if (updates.emoji !== undefined) updateObj.emoji = updates.emoji;
    if (updates.frais_adhesion !== undefined) updateObj.fraisAdhesion = updates.frais_adhesion;

    if (Object.keys(updateObj).length === 0) {
      return res.json({ success: true });
    }

    await db.update(corporations).set(updateObj).where(eq(corporations.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating corporation:', error);
    res.status(500).json({ error: 'Erreur mise à jour corporation' });
  }
});

// 6. Zones
app.post('/api/db/zones', async (req, res) => {
  try {
    const z = req.body;
    await db.insert(zones).values({
      id: z.id,
      nom: z.nom,
      description: z.description,
      agentPrincipal: z.agent_principal,
    }).onConflictDoNothing();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error saving zone:', error);
    res.status(500).json({ error: 'Erreur enregistrement zone' });
  }
});

// OTP & SMS SERVICE ENDPOINTS
app.get('/api/otp/status', (_req, res) => {
  const provider = detectOtpProvider();
  res.json({
    provider,
    live: provider !== 'sandbox',
  });
});

app.post('/api/otp/send', async (req, res) => {
  try {
    const { telephone } = req.body || {};
    if (!telephone || typeof telephone !== 'string') {
      return res.status(400).json({ success: false, error: 'Numéro de téléphone requis' });
    }

    const result = await sendOtpCode(telephone);
    if (!result.success) {
      const status = result.retryAfterSeconds ? 429 : 400;
      return res.status(status).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error('OTP Send Error:', error);
    res.status(500).json({ success: false, error: 'Erreur interne lors de l’envoi OTP' });
  }
});

app.post('/api/otp/verify', async (req, res) => {
  try {
    const { telephone, code } = req.body || {};
    if (!telephone || !code) {
      return res.status(400).json({ success: false, error: 'Téléphone et code requis' });
    }

    const result = await verifyOtpCode(String(telephone), String(code));
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error('OTP Verify Error:', error);
    res.status(500).json({ success: false, error: 'Erreur interne lors de la vérification OTP' });
  }
});

// SMS SERVICE PROXY (HTTP Gateway / Sandbox)
app.post('/api/sms/send', async (req, res) => {
  try {
    const { to, message } = req.body || {};
    if (!to || !message) {
      return res.status(400).json({ success: false, error: 'Destinataire et message requis' });
    }

    const e164 = normalizePhoneE164(String(to));
    if (!e164) {
      return res.status(400).json({ success: false, error: 'Numéro de téléphone invalide' });
    }

    const dispatch = await dispatchSmsMessage(e164, String(message));
    if (!dispatch.ok) {
      return res.status(502).json({
        success: false,
        provider: dispatch.provider,
        error: dispatch.error || 'Échec de l’envoi SMS',
      });
    }

    res.json({
      success: true,
      provider: dispatch.provider,
      message: 'SMS envoyé avec succès',
      provider_ref: dispatch.providerRef || `sms_${Date.now()}`,
    });
  } catch (error: any) {
    console.error('SMS Service Error:', error);
    res.status(500).json({ success: false, error: 'Erreur service SMS' });
  }
});

// Mount Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
