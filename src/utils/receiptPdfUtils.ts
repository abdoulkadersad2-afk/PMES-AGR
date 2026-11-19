import jsPDF from 'jspdf';
import { ReceiptData, TransactionType } from '../types';
import { captureElementToCanvas } from './pdfCanvasUtils';

export function getReceiptTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'depot':
      return "Reçu de Versement d'Épargne";
    case 'retrait':
      return "Bon de Retrait d'Épargne";
    case 'financement':
      return 'Reçu de Financement AGR';
    case 'remboursement':
      return 'Reçu de Remboursement';
    case 'adhesion':
      return "Reçu d'Adhésion Caisse";
    case 'frais':
      return 'Reçu de Frais de Gestion';
    case 'investissement':
      return "Certificat de Participation Coffre-Fort";
    default:
      return 'Reçu de Transaction';
  }
}

export function getReceiptAmountLabel(type: TransactionType): string {
  switch (type) {
    case 'depot':
    case 'remboursement':
    case 'adhesion':
    case 'frais':
      return 'MONTANT REÇU';
    case 'retrait':
    case 'financement':
      return 'MONTANT DÉCAISSÉ';
    case 'investissement':
      return 'MONTANT INVESTI';
    default:
      return 'MONTANT';
  }
}

function formatFcfaPlain(amount: number): string {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} F CFA`;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Génère un reçu PDF vectoriel officiel au format A4 (texte sélectionnable, léger et fiable).
 */
export function generateVectorReceiptPDF(
  receipt: ReceiptData,
  qrDataUrl?: string
): void {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;

  // En-tête institutionnel
  pdf.setFillColor(30, 58, 138); // Lapis #1E3A8A
  pdf.rect(0, 0, pageWidth, 34, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('PMES-AGR DOSSO', marginX, 15);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(226, 232, 240);
  pdf.text("Programme Municipal d'Épargne & d'Appui aux Activités Génératrices de Revenus", marginX, 22);
  pdf.text('Commune Urbaine de Dosso • République du Niger', marginX, 27.5);

  // Badge type d'opération
  let y = 46;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(marginX, y, contentWidth, 16, 2.5, 2.5, 'FD');

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12.5);
  pdf.text(getReceiptTypeLabel(receipt.type).toUpperCase(), marginX + 5, y + 10);

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(120, 53, 15); // Gold #78350F
  pdf.text(`Réf : ${receipt.reference}`, pageWidth - marginX - 5, y + 10, { align: 'right' });

  // Bloc informations transaction
  y += 26;
  pdf.setDrawColor(226, 232, 240);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(marginX, y, contentWidth, 66, 2.5, 2.5, 'FD');

  const parsedReceiptDate = new Date(receipt.date);
  const formattedReceiptDate = Number.isNaN(parsedReceiptDate.getTime())
    ? '---'
    : parsedReceiptDate.toLocaleString('fr-FR');

  const rows: Array<[string, string]> = [
    ['Date & Heure', formattedReceiptDate],
    ['Identifiant Transaction', receipt.transactionId],
    ['Titulaire du Livret', receipt.memberNom],
    ['Numéro de Livret', receipt.memberLivret],
    ['Téléphone', `+227 ${receipt.memberTelephone}`],
    ['Zone / Caisse', receipt.zone],
    ['Agent Opérateur', `@${receipt.agentNom}`],
  ];

  let rowY = y + 9;
  for (const [label, value] of rows) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, marginX + 6, rowY);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(value || '---'), pageWidth - marginX - 6, rowY, { align: 'right' });

    if (rowY < y + 58) {
      pdf.setDrawColor(241, 245, 249);
      pdf.line(marginX + 6, rowY + 2.5, pageWidth - marginX - 6, rowY + 2.5);
    }
    rowY += 8.5;
  }

  // Bloc financier
  y += 74;
  pdf.setFillColor(251, 249, 245); // Paper #FBF9F5
  pdf.setDrawColor(217, 119, 6);
  pdf.roundedRect(marginX, y, contentWidth, receipt.soldeAvant !== undefined || receipt.soldeApres !== undefined ? 40 : 24, 2.5, 2.5, 'FD');

  let finY = y + 10;
  if (receipt.soldeAvant !== undefined) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Solde précédent', marginX + 6, finY);
    pdf.setFont('courier', 'bold');
    pdf.text(formatFcfaPlain(receipt.soldeAvant), pageWidth - marginX - 6, finY, { align: 'right' });
    finY += 9;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(getReceiptAmountLabel(receipt.type), marginX + 6, finY);
  pdf.setTextColor(4, 120, 87); // Emerald
  pdf.setFontSize(14);
  pdf.text(formatFcfaPlain(receipt.montant), pageWidth - marginX - 6, finY, { align: 'right' });

  if (receipt.soldeApres !== undefined) {
    finY += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(120, 53, 15);
    pdf.text('NOUVEAU SOLDE DISPONIBLE', marginX + 6, finY);
    pdf.text(formatFcfaPlain(receipt.soldeApres), pageWidth - marginX - 6, finY, { align: 'right' });
  }

  y += (receipt.soldeAvant !== undefined || receipt.soldeApres !== undefined ? 48 : 32);

  // Motif / Observation
  if (receipt.motif) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text('OBSERVATION / MOTIF :', marginX, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 41, 59);
    const wrapped = pdf.splitTextToSize(receipt.motif, contentWidth);
    pdf.text(wrapped, marginX, y + 5.5);
    y += 8 + wrapped.length * 4.5;
  }

  // Pied de reçu + QR code si disponible + signatures
  y = Math.max(y + 8, 210);
  if (qrDataUrl) {
    try {
      pdf.addImage(qrDataUrl, 'PNG', marginX, y, 28, 28);
    } catch {
      // Ignore image insertion error
    }
  }

  const metaX = qrDataUrl ? marginX + 34 : marginX;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Vérification Numérique Officielle PMES-AGR Dosso', metaX, y + 7);
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Empreinte : PMES|${receipt.reference}|${receipt.memberLivret}|${receipt.montant}`,
    metaX,
    y + 13
  );
  pdf.text(
    `Document généré le ${new Date().toLocaleString('fr-FR')}`,
    metaX,
    y + 19
  );

  // Zone cachet & signature
  pdf.setDrawColor(203, 213, 225);
  pdf.line(pageWidth - marginX - 55, y + 24, pageWidth - marginX, y + 24);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Visa & Cachet de la Caisse', pageWidth - marginX - 27.5, y + 29, { align: 'center' });

  pdf.save(`PMES_RECU_A4_${sanitizeFilename(receipt.reference)}.pdf`);
}

/**
 * Télécharge un reçu de transaction en PDF (format Ticket 80mm ou A4 Officiel).
 */
export async function downloadReceiptPDF(
  receipt: ReceiptData,
  options: {
    format?: 'a4' | 'ticket';
    ticketElement?: HTMLElement | null;
    qrDataUrl?: string;
  } = {}
): Promise<void> {
  const { format = 'a4', ticketElement, qrDataUrl } = options;

  if (format === 'ticket' && ticketElement) {
    const canvas = await captureElementToCanvas(ticketElement, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 320,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgWidthMm = 80;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
    const x = (pdfWidth - imgWidthMm) / 2;
    const y = 10;

    pdf.addImage(imgData, 'PNG', x, y, imgWidthMm, imgHeightMm);
    pdf.save(`PMES_RECU_TICKET_${sanitizeFilename(receipt.reference)}.pdf`);
    return;
  }

  generateVectorReceiptPDF(receipt, qrDataUrl);
}
