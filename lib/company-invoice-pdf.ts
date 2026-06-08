import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface CompanyInvoicePdfItem {
  designation: string;
  sessionCount: number;
  learnerCount: number;
  unitPrice: number;
  totalHT: number;
}

export interface CompanyInvoicePdfData {
  reference: string;
  invoiceDate: string;
  totalHT: number;
  discount: number;
  totalDiscountHT: number;
  vat: number;
  totalTTC: number;
  paymentMethod: string;
  companyName: string;
  companyAddress?: string;
  companyOwner?: string;
  companyRC?: string;
  companyNIF?: string;
  companyNIS?: string;
  items: CompanyInvoicePdfItem[];
}

const SUPPLIER_INFO = {
  name: 'Brain Care',
  owner: 'Sabrina MOKRANE',
  address: 'BT 12 URBA 2000 EI Achour Alger Algerie',
  rc: 'R.C. N° : 16/00-4958914A19',
  nif: 'NIF : 279421201996194',
  art: 'Art : 16510 78 0966',
  email: 's.mokrane@coachingwellnesscenter.com',
  web: 'www.coachingwellnesscenter.com',
};

function formatNumber(value: number) {
  return Number(value || 0).toFixed(2);
}

function numberToFrench(n: number): string {
  const units = [
    'zero', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
  ];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

  if (n < 20) return units[n];

  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;

    if (ten === 7) {
      if (unit === 1) return 'soixante et onze';
      return `soixante-${numberToFrench(10 + unit)}`;
    }
    if (ten === 8) {
      if (unit === 0) return 'quatre-vingts';
      return `quatre-vingt-${units[unit]}`;
    }
    if (ten === 9) {
      return `quatre-vingt-${numberToFrench(10 + unit)}`;
    }

    if (unit === 0) return tens[ten];
    if (unit === 1) return `${tens[ten]} et un`;
    return `${tens[ten]}-${units[unit]}`;
  }

  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const prefix = hundred === 1 ? 'cent' : `${units[hundred]} cent`;
    if (rest === 0) {
      return hundred === 1 ? 'cent' : `${prefix}s`;
    }
    return `${prefix} ${numberToFrench(rest)}`;
  }

  if (n < 1000000) {
    const thousand = Math.floor(n / 1000);
    const rest = n % 1000;
    const prefix = thousand === 1 ? 'mille' : `${numberToFrench(thousand)} mille`;
    if (rest === 0) return prefix;
    return `${prefix} ${numberToFrench(rest)}`;
  }

  const million = Math.floor(n / 1000000);
  const rest = n % 1000000;
  const prefix = million === 1 ? 'un million' : `${numberToFrench(million)} millions`;
  if (rest === 0) return prefix;
  return `${prefix} ${numberToFrench(rest)}`;
}

function formatAmountInWords(amount: number) {
  const value = Number(amount || 0);
  const dinars = Math.floor(value);
  const cents = Math.round((value - dinars) * 100);

  const dinarsWords = `${numberToFrench(dinars)} DA`;
  if (cents > 0) {
    return `${dinarsWords} et ${numberToFrench(cents)} centimes`;
  }
  return dinarsWords;
}

function capitalizeSentence(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function generateCompanyInvoicePdf(invoice: CompanyInvoicePdfData) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const margin = 15;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const paymentFixed = 'Par cheque ou virement bancaire';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(SUPPLIER_INFO.name, margin, 20);

  pdf.setFontSize(11);
  pdf.text(SUPPLIER_INFO.owner, margin, 26);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(SUPPLIER_INFO.address, margin, 31);
  pdf.text(SUPPLIER_INFO.rc, margin, 36);
  pdf.text(SUPPLIER_INFO.nif, margin, 41);
  pdf.text(SUPPLIER_INFO.art, margin, 46);
  pdf.text(`Email: ${SUPPLIER_INFO.email}`, margin, 51);
  pdf.text(`Web: ${SUPPLIER_INFO.web}`, margin, 56);

  const clientX = pageWidth - margin - 70;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(`Client: ${invoice.companyName}`, clientX, 24, { maxWidth: 70 });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  let clientLine = 30;
  if (invoice.companyAddress) {
    pdf.text(invoice.companyAddress, clientX, clientLine, { maxWidth: 70 });
    clientLine += 5;
  }
  if (invoice.companyOwner) {
    pdf.text(`Proprietaire: ${invoice.companyOwner}`, clientX, clientLine, { maxWidth: 70 });
    clientLine += 5;
  }
  if (invoice.companyRC) {
    pdf.text(`RC: ${invoice.companyRC}`, clientX, clientLine);
    clientLine += 5;
  }
  if (invoice.companyNIF) {
    pdf.text(`NIF: ${invoice.companyNIF}`, clientX, clientLine);
    clientLine += 5;
  }
  if (invoice.companyNIS) {
    pdf.text(`NIS: ${invoice.companyNIS}`, clientX, clientLine);
  }

  const infoBoxY = 66;
  pdf.setDrawColor(30, 64, 71);
  pdf.setFillColor(18, 66, 74);
  pdf.rect(margin, infoBoxY, 60, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Facture', margin + 18, infoBoxY + 6);

  pdf.setDrawColor(0);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.rect(margin, infoBoxY + 8, 60, 18);
  pdf.text(`Ref : ${invoice.reference}`, margin + 4, infoBoxY + 14);
  pdf.text(`Date : ${new Date(invoice.invoiceDate).toLocaleDateString('fr-FR')}`, margin + 4, infoBoxY + 20);

  const tableStartY = infoBoxY + 35;
  const rows = invoice.items.map((item) => [
    item.designation,
    String(item.sessionCount),
    String(item.learnerCount),
    formatNumber(item.unitPrice),
    formatNumber(item.totalHT),
  ]);

  autoTable(pdf, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [[
      'ITEM',
      'Nombre de seances',
      'Nb apprenants',
      'P.U./heure (HT)',
      'TOTAL HT',
    ]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
    headStyles: { fillColor: [18, 66, 74], textColor: [255, 255, 255], halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 30 },
    },
  });

  const afterTableY = (pdf as any).lastAutoTable.finalY;
  const totalsX = pageWidth - margin - 70;
  const totalsWidth = 70;
  const lineHeight = 6;

  pdf.setFillColor(223, 237, 234);
  pdf.rect(totalsX, afterTableY, totalsWidth, lineHeight, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOTAL (HT)', totalsX + 2, afterTableY + 4.5);
  pdf.text(formatNumber(invoice.totalHT), totalsX + totalsWidth - 2, afterTableY + 4.5, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.rect(totalsX, afterTableY + lineHeight, totalsWidth, lineHeight);
  pdf.text('REMISE', totalsX + 2, afterTableY + lineHeight + 4.5);
  pdf.text(formatNumber(invoice.discount), totalsX + totalsWidth - 2, afterTableY + lineHeight + 4.5, { align: 'right' });

  pdf.setFillColor(223, 237, 234);
  pdf.rect(totalsX, afterTableY + lineHeight * 2, totalsWidth, lineHeight, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOTAL REMISE (HT)', totalsX + 2, afterTableY + lineHeight * 2 + 4.5);
  pdf.text(formatNumber(invoice.totalDiscountHT), totalsX + totalsWidth - 2, afterTableY + lineHeight * 2 + 4.5, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.rect(totalsX, afterTableY + lineHeight * 3, totalsWidth, lineHeight);
  pdf.text('TVA', totalsX + 2, afterTableY + lineHeight * 3 + 4.5);
  pdf.text(formatNumber(invoice.vat), totalsX + totalsWidth - 2, afterTableY + lineHeight * 3 + 4.5, { align: 'right' });

  pdf.setFillColor(191, 218, 232);
  pdf.rect(totalsX, afterTableY + lineHeight * 4, totalsWidth, lineHeight, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOTAL (TTC)', totalsX + 2, afterTableY + lineHeight * 4 + 4.5);
  pdf.text(formatNumber(invoice.totalTTC), totalsX + totalsWidth - 2, afterTableY + lineHeight * 4 + 4.5, { align: 'right' });

  const footerY = afterTableY + lineHeight * 5 + 4;
  const footerWidth = pageWidth - margin * 2;
  const colLeft = footerWidth * 0.46;
  const colRight = footerWidth - colLeft;
  const footerHeight = 12;
  const paymentHeight = 10;

  pdf.setDrawColor(0);
  pdf.rect(margin, footerY, footerWidth, footerHeight);
  pdf.line(margin + colLeft, footerY, margin + colLeft, footerY + footerHeight);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Arretee la presente facture a la somme de', margin + 2, footerY + 7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    capitalizeSentence(formatAmountInWords(invoice.totalTTC)),
    margin + colLeft + 2,
    footerY + 7,
    { maxWidth: colRight - 4 }
  );

  const paymentY = footerY + footerHeight;
  pdf.rect(margin, paymentY, footerWidth, paymentHeight);
  pdf.line(margin + colLeft, paymentY, margin + colLeft, paymentY + paymentHeight);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Moyen de paiement', margin + 2, paymentY + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.text(paymentFixed, margin + colLeft + 2, paymentY + 6, { maxWidth: colRight - 4 });

  pdf.save(`facture-${invoice.reference}.pdf`);
}
