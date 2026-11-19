import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { compressImageFile } from '../utils/imageUtils';

export interface PhotoUploadResult {
  url: string;
  storageProvider: 'firebase-storage' | 'inline-compressed';
  error?: string;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Compresse la photo d'un adhérent puis l'envoie vers Firebase Storage (`members/{memberId}/avatar_...jpg`).
 * En cas d'indisponibilité (hors-ligne, Storage non encore activé ou règles bloquantes),
 * bascule automatiquement sur le JPEG compressé en base64 pour ne pas bloquer l'enregistrement.
 */
export async function uploadMemberPhoto(
  memberId: string,
  source: File | string
): Promise<PhotoUploadResult> {
  const compressedDataUrl =
    typeof source === 'string'
      ? source
      : await compressImageFile(source, 600, 600, 0.85);

  if (!compressedDataUrl.startsWith('data:image/')) {
    return {
      url: compressedDataUrl,
      storageProvider: 'inline-compressed',
    };
  }

  try {
    const safeMemberId = memberId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `members/${safeMemberId}/avatar_${Date.now()}.jpg`;
    const storageRef = ref(storage, storagePath);
    const blob = dataUrlToBlob(compressedDataUrl);

    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: blob.type || 'image/jpeg',
      customMetadata: {
        memberId: safeMemberId,
        app: 'pmes-agr-dosso',
      },
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    return {
      url: downloadUrl,
      storageProvider: 'firebase-storage',
    };
  } catch (err: any) {
    const code = err?.code || '';
    let reason = err?.message || 'Firebase Storage indisponible';

    if (code === 'storage/unauthorized') {
      reason = 'Règles Firebase Storage non autorisées (connectez-vous ou vérifiez storage.rules).';
    } else if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found') {
      reason = 'Firebase Storage doit être activé dans la Console Firebase.';
    }

    console.warn('[Firebase Storage] Fallback image compressée:', code, reason);
    return {
      url: compressedDataUrl,
      storageProvider: 'inline-compressed',
      error: reason,
    };
  }
}
