import { 
  Member, User, Transaction, DemandeRetrait, DemandeFinancement, 
  ZoneItem, Corporation, CaisseMouvement, SyncStatus 
} from '../types';

export interface DatabaseState {
  corporations: Corporation[];
  zones: ZoneItem[];
  members: Member[];
  transactions: Transaction[];
  retraits?: DemandeRetrait[];
  financements: DemandeFinancement[];
  caisseMouvements: CaisseMouvement[];
}

// 1. Initial Auto-Seed: Populate PostgreSQL if tables are empty
export async function seedCloudSqlDatabase(seedData: {
  initialCorporations: Corporation[];
  initialZones: ZoneItem[];
  initialMembers: Member[];
  initialTransactions: Transaction[];
  initialRetraits?: DemandeRetrait[];
  initialFinancements: DemandeFinancement[];
  initialCaisseMouvements: CaisseMouvement[];
}): Promise<boolean> {
  try {
    const res = await fetch('/api/db/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(seedData),
    });
    return res.ok;
  } catch (err) {
    console.warn('Auto-seed ping failed (offline or server starting):', err);
    return false;
  }
}

// 2. Fetch all state from PostgreSQL
export async function fetchAllFromCloudSql(): Promise<DatabaseState | null> {
  try {
    const res = await fetch('/api/db/sync-all');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch from Cloud SQL backend:', err);
    return null;
  }
}

// 3. Mutate Member in Cloud SQL
export async function dbSaveMember(member: Member): Promise<boolean> {
  try {
    const res = await fetch('/api/db/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save member in Cloud SQL:', err);
    return false;
  }
}

export async function dbUpdateMember(id: string, updates: Partial<Member>): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/members/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to update member ${id} in Cloud SQL:`, err);
    return false;
  }
}

export async function dbDeleteMember(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/members/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to delete member ${id} in Cloud SQL:`, err);
    return false;
  }
}

// 4. Mutate Transaction in Cloud SQL
export async function dbSaveTransaction(tx: Transaction): Promise<boolean> {
  try {
    const res = await fetch('/api/db/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save transaction in Cloud SQL:', err);
    return false;
  }
}

export async function dbUpdateTransaction(id: string, updates: Partial<Transaction>): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/transactions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to update transaction ${id} in Cloud SQL:`, err);
    return false;
  }
}

// 4b. Mutate Retrait in Cloud SQL
export async function dbSaveRetrait(dr: DemandeRetrait): Promise<boolean> {
  try {
    const res = await fetch('/api/db/retraits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dr),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save retrait in Cloud SQL:', err);
    return false;
  }
}

export async function dbUpdateRetrait(id: string, updates: Partial<DemandeRetrait>): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/retraits/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to update retrait ${id} in Cloud SQL:`, err);
    return false;
  }
}

// 5. Mutate Financement in Cloud SQL
export async function dbSaveFinancement(df: DemandeFinancement): Promise<boolean> {
  try {
    const res = await fetch('/api/db/financements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(df),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save financement in Cloud SQL:', err);
    return false;
  }
}

export async function dbUpdateFinancement(id: string, updates: Partial<DemandeFinancement>): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/financements/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to update financement ${id} in Cloud SQL:`, err);
    return false;
  }
}

export async function dbDeleteFinancement(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/financements/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to delete financement ${id} in Cloud SQL:`, err);
    return false;
  }
}

// 6. Mutate Caisse Mouvement in Cloud SQL
export async function dbSaveCaisseMouvement(cm: CaisseMouvement): Promise<boolean> {
  try {
    const res = await fetch('/api/db/caisse-mouvements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cm),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save caisse mouvement in Cloud SQL:', err);
    return false;
  }
}

// 7. Mutate Corporation in Cloud SQL
export async function dbSaveCorporation(c: Corporation): Promise<boolean> {
  try {
    const res = await fetch('/api/db/corporations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save corporation in Cloud SQL:', err);
    return false;
  }
}

export async function dbUpdateCorporation(id: string, updates: Partial<Corporation>): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/corporations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to update corporation ${id} in Cloud SQL:`, err);
    return false;
  }
}

// 8. Mutate Zone in Cloud SQL
export async function dbSaveZone(z: ZoneItem): Promise<boolean> {
  try {
    const res = await fetch('/api/db/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(z),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save zone in Cloud SQL:', err);
    return false;
  }
}
