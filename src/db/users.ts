import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, nom?: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        nom,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(nom ? { nom } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database user upsert failed:", error);
    throw new Error("Failed to register or sync user", { cause: error });
  }
}
