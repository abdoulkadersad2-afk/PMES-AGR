/**
 * Service de notifications pour PMES-AGR Dosso
 * Gère les permissions et l'affichage des notifications PWA
 */

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('Ce navigateur ne supporte pas les notifications bureau');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export interface NotificationOptions {
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
}

export const showLocalNotification = async (title: string, options: NotificationOptions) => {
  // 1. Vérifier la permission
  if (Notification.permission !== 'granted') {
    const ok = await requestNotificationPermission();
    if (!ok) return;
  }

  // 2. Tenter d'utiliser le Service Worker pour la notification (meilleur pour PWA)
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration) {
      registration.showNotification(title, {
        ...options,
        icon: options.icon || '/pwa-192x192.png',
        badge: '/icon.svg',
        vibrate: [200, 100, 200],
      } as any);
      return;
    }
  }

  // Fallback sur l'API Notification standard
  new Notification(title, options);
};

/**
 * Logique spécifique pour les administrateurs
 */
export const notifyAdminNewRequest = (type: 'retrait' | 'financement', memberNom: string, montant: number) => {
  const title = type === 'retrait' ? '🔔 Nouvelle Demande de Retrait' : '💰 Nouveau Dossier de Financement';
  const body = `${memberNom} a soumis une demande de ${montant.toLocaleString()} F CFA. Action requise pour validation.`;
  
  showLocalNotification(title, {
    body,
    tag: `new-request-${type}-${Date.now()}`,
    data: { type, url: '/admin-space' }
  });
};
