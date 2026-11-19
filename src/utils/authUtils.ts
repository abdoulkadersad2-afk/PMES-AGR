import bcrypt from 'bcryptjs';

/**
 * Utility for password and PIN hashing
 */
export const hashData = async (plainText: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
};

export const compareData = async (plainText: string, hashed: string): Promise<boolean> => {
  if (!hashed) return false;
  
  // Backward compatibility: If it doesn't look like a bcrypt hash, compare plain text
  if (!hashed.startsWith('$2a$') && !hashed.startsWith('$2b$') && !hashed.startsWith('$2y$')) {
    return plainText === hashed;
  }

  try {
    return await bcrypt.compare(plainText, hashed);
  } catch (error) {
    console.error('Error comparing hash:', error);
    return false;
  }
};

/**
 * For 4-digit PINs, standard bcrypt is very slow for bulk operations 
 * but since we only compare one at a time, it's fine.
 * If performance is an issue, a simpler hash with salt could be used,
 * but bcrypt is the security gold standard.
 */
