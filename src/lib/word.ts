// Word document generation for invoices - CM2A template
import {
  Document,
  Packer,
  Paragraph,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  ImageRun,
  TabStopType,
  TabStopPosition,
  PageNumber,
  Header,
  Footer,
} from 'docx';
import { saveAs } from 'file-saver';

// ── Formatting helpers ──────────────────────────────────────────

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatMinutesToHours(minutes: number): string {
  const hours = (minutes / 60).toFixed(2);
  return `${hours} h`;
}

// ── Number to words (French) ────────────────────────────────────

function numberToWordsFR(amount: number): string {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  if (amount === 0) return 'zéro';
  if (amount < 0) return 'moins ' + numberToWordsFR(-amount);

  let words = '';

  if (amount >= 1000000) {
    const millions = Math.floor(amount / 1000000);
    words += (millions === 1 ? 'un million' : numberToWordsFR(millions) + ' millions') + ' ';
    amount %= 1000000;
  }

  if (amount >= 1000) {
    const thousands = Math.floor(amount / 1000);
    words += (thousands === 1 ? 'mille' : numberToWordsFR(thousands) + ' mille') + ' ';
    amount %= 1000;
  }

  if (amount >= 100) {
    const hundreds = Math.floor(amount / 100);
    words += (hundreds === 1 ? 'cent' : units[hundreds] + ' cent') + ' ';
    amount %= 100;
  }

  if (amount >= 20) {
    const ten = Math.floor(amount / 10);
    const unit = amount % 10;
    if (ten === 7 || ten === 9) {
      words += tens[ten] + '-' + units[10 + unit];
    } else if (ten === 8 && unit === 0) {
      words += 'quatre-vingts';
    } else {
      words += tens[ten] + (unit === 1 && ten !== 8 ? '-et-' : (unit > 0 ? '-' : '')) + units[unit];
    }
  } else if (amount > 0) {
    words += units[amount];
  }

  return words.trim();
}

function amountToWordsFR(cents: number): string {
  const dirhams = Math.floor(cents / 100);
  const centimes = cents % 100;

  let result = numberToWordsFR(dirhams) + ' dirham' + (dirhams > 1 ? 's' : '');
  if (centimes > 0) {
    result += ' et ' + numberToWordsFR(centimes) + ' centime' + (centimes > 1 ? 's' : '');
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ── Types ───────────────────────────────────────────────────────

interface InvoiceLine {
  label: string;
  minutes: number;
  rate_cents: number;
  vat_rate: number;
  amount_ht_cents: number;
  vat_cents: number;
  amount_ttc_cents: number;
}

interface InvoiceWordData {
  number: string | null;
  status: string;
  period_from: string;
  period_to: string;
  issue_date: string | null;
  lines: InvoiceLine[];
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  paid: boolean;
  payment_date: string | null;
}

export interface WordExportParams {
  invoice: InvoiceWordData;
  cabinetName: string;
  cabinetAddress: string | null;
  cabinetIban: string | null;
  cabinetMentions: string | null;
  clientName: string;
  clientAddress: string | null;
  clientVatNumber: string | null;
  matterCode: string;
  matterLabel: string;
}

// ── Style constants ─────────────────────────────────────────────

const BLUE = '1e3a8a';
const RED = 'dc2626';
const GRAY = '6b7280';
const LIGHT_GRAY = 'F3F4F6';
const TEXT_GRAY = '666666';

const borderNone = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const borderTable = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
};

// ── Image loader ────────────────────────────────────────────────

async function loadImageAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await blob.arrayBuffer();
  } catch (error) {
    console.error('Failed to load image for Word export:', error);
    return null;
  }
}

// ── Colored bar (top/bottom) as a 3-column table ────────────────

function createColorBar(): DocxTable {
  return new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({
        height: { value: 300, rule: 'exact' as any },
        children: [
          new DocxTableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: BLUE },
            borders: borderNone,
            children: [new Paragraph({ children: [] })],
          }),
          new DocxTableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: GRAY },
            borders: borderNone,
            children: [new Paragraph({ children: [] })],
          }),
          new DocxTableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: RED },
            borders: borderNone,
            children: [new Paragraph({ children: [] })],
          }),
        ],
      }),
    ],
  });
}

// ── Spacer paragraph ────────────────────────────────────────────

function spacer(size = 6): Paragraph {
  return new Paragraph({ spacing: { after: size * 20 }, children: [] });
}

// ── Main export function ────────────────────────────────────────

export async function exportInvoiceWord(params: WordExportParams): Promise<void> {
  const { invoice, cabinetName, cabinetAddress, clientName, clientAddress, clientVatNumber, matterCode, matterLabel, cabinetIban, cabinetMentions } = params;

  const statusLabel: Record<string, string> = {
    draft: 'BROUILLON',
    issued: '',
    cancelled: 'ANNULÉE',
  };

  // Load logo
  const logoBuffer = await loadImageAsArrayBuffer('/cm2a-logo.png');

  // ── Top colored bar ──
  const topBar = createColorBar();

  // ── Header: Logo + Company name + Contact info ──
  const headerChildren: (TextRun | ImageRun)[] = [];
  if (logoBuffer) {
    headerChildren.push(
      new ImageRun({
        data: logoBuffer,
        transformation: { width: 70, height: 70 },
        type: 'png',
      })
    );
  }

  const headerTable = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({
        children: [
          // Left: Logo + CM2A Consulting
          new DocxTableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              ...(logoBuffer ? [new Paragraph({
                children: [
                  new ImageRun({
                    data: logoBuffer,
                    transformation: { width: 70, height: 70 },
                    type: 'png',
                  }),
                ],
              })] : []),
              new Paragraph({
                spacing: { before: 40 },
                children: [
                  new TextRun({ text: 'CM2A', bold: true, size: 36, color: BLUE }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Consulting', bold: true, size: 36, color: RED }),
                ],
              }),
            ],
          }),
          // Right: Contact info
          new DocxTableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: '📞 +212 808 56 40 38', size: 16, color: TEXT_GRAY })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: '✉️ contact@cm2a.ma', size: 16, color: TEXT_GRAY })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: '🌐 www.cm2a.ma', size: 16, color: TEXT_GRAY })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Client section (right-aligned) ──
  const clientParagraphs = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "A l'aimable attention de", size: 18, color: TEXT_GRAY, italics: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: clientName, bold: true, size: 22 })],
    }),
    ...(clientAddress ? [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: clientAddress, size: 18 })],
    })] : []),
    ...(clientVatNumber ? [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `ICE: ${clientVatNumber}`, size: 18 })],
    })] : []),
  ];

  // ── Date (centered) ──
  const dateParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 300 },
    children: [
      new TextRun({
        text: `Casablanca, le ${invoice.issue_date ? formatDate(invoice.issue_date) : '_______________'}`,
        size: 20,
      }),
    ],
  });

  // ── FACTURE badge ──
  const invoiceBadge: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: '  FACTURE  ',
          bold: true,
          size: 22,
          color: 'FFFFFF',
          shading: { type: ShadingType.SOLID, color: GRAY },
        }),
        ...(statusLabel[invoice.status] ? [
          new TextRun({ text: '  ' }),
          new TextRun({
            text: `  ${statusLabel[invoice.status]}  `,
            bold: true,
            size: 18,
            color: 'FFFFFF',
            shading: { type: ShadingType.SOLID, color: RED },
          }),
        ] : []),
      ],
    }),
    new Paragraph({
      children: [new TextRun({ text: `N/FAC : ${invoice.number || '___________'}`, size: 18, color: TEXT_GRAY })],
    }),
  ];

  // ── Description / Matter info ──
  const descriptionParagraphs = [
    spacer(4),
    new Paragraph({
      children: [
        new TextRun({ text: 'Services professionnels rendus', size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 60 },
      children: [
        new TextRun({ text: 'Dossier : ', bold: true, size: 20 }),
        new TextRun({ text: `${matterCode} - ${matterLabel}`, size: 20 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Période : ', bold: true, size: 20 }),
        new TextRun({ text: `${formatDate(invoice.period_from)} au ${formatDate(invoice.period_to)}`, size: 20 }),
      ],
    }),
    spacer(4),
  ];

  // ── Lines table ──
  const hasTimeLines = invoice.lines.some(l => l.minutes > 0);

  const tableHeaderRow = new DocxTableRow({
    children: [
      new DocxTableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, size: 18 })] })],
        width: { size: hasTimeLines ? 40 : 70, type: WidthType.PERCENTAGE },
        borders: borderTable,
        shading: { type: ShadingType.SOLID, color: LIGHT_GRAY },
      }),
      ...(hasTimeLines ? [
        new DocxTableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Heures', bold: true, size: 18 })] })],
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: borderTable,
          shading: { type: ShadingType.SOLID, color: LIGHT_GRAY },
        }),
        new DocxTableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Taux', bold: true, size: 18 })] })],
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: borderTable,
          shading: { type: ShadingType.SOLID, color: LIGHT_GRAY },
        }),
      ] : []),
      new DocxTableCell({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Montant HT', bold: true, size: 18 })] })],
        width: { size: hasTimeLines ? 30 : 30, type: WidthType.PERCENTAGE },
        borders: borderTable,
        shading: { type: ShadingType.SOLID, color: LIGHT_GRAY },
      }),
    ],
  });

  const tableDataRows = invoice.lines.map(line => new DocxTableRow({
    children: [
      new DocxTableCell({
        children: [new Paragraph({ children: [new TextRun({ text: line.label, size: 18 })] })],
        borders: borderTable,
      }),
      ...(hasTimeLines ? [
        new DocxTableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: line.label.startsWith('Frais -') ? '-' : formatMinutesToHours(line.minutes), size: 18 })] })],
          borders: borderTable,
        }),
        new DocxTableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: line.label.startsWith('Frais -') ? '-' : formatCents(line.rate_cents), size: 18 })] })],
          borders: borderTable,
        }),
      ] : []),
      new DocxTableCell({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCents(line.amount_ht_cents), size: 18 })] })],
        borders: borderTable,
      }),
    ],
  }));

  const linesTable = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows],
  });

  // ── Totals (right-aligned table) ──
  const vatRate = invoice.lines.length > 0 ? invoice.lines[0].vat_rate : 20;

  const totalsTable = new DocxTable({
    width: { size: 45, type: WidthType.PERCENTAGE },
    rows: [
      createTotalRow('Montant HT', formatCents(invoice.total_ht_cents), false),
      createTotalRow(`TVA ${vatRate}%`, formatCents(invoice.total_vat_cents), false),
      createTotalRow('Total TTC', formatCents(invoice.total_ttc_cents), true),
    ],
  });

  const totalsParagraphs = [
    spacer(4),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [],
    }),
  ];

  // ── Amount in words ──
  const amountWordsParagraph = new Paragraph({
    spacing: { before: 200, after: 200 },
    children: [
      new TextRun({
        text: `Arrêté la présente facture à la somme de ${amountToWordsFR(invoice.total_ttc_cents)}`,
        italics: true,
        size: 20,
      }),
    ],
  });

  // ── Stamp section (right-aligned) ──
  const stampTable = new DocxTable({
    width: { size: 40, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({
        children: [
          new DocxTableCell({
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'CM2A CONSULTING', bold: true, size: 20, color: BLUE })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'SARL AU', size: 14, color: TEXT_GRAY })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: '15, Bd. Med Zerktouni Rés. Prestige', size: 14, color: TEXT_GRAY })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Etg 4 Appt 12 Casablanca', size: 14, color: TEXT_GRAY })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'RC 471315 - ICE 002465969000025', size: 14, color: TEXT_GRAY })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Payment info ──
  const paymentParagraphs = [
    spacer(4),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Valeur en votre aimable règlement à réception de la présente', bold: true, size: 14, color: TEXT_GRAY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Règlement par chèque à libeller au nom de « CM2A CONSULTING »', size: 14, color: TEXT_GRAY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Règlement par virement sur le compte de « CM2A CONSULTING »', size: 14, color: TEXT_GRAY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'AttijariWafa Bank – Agence CASA C.I.L', size: 14, color: TEXT_GRAY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Compte n° 007780000048200000049063', bold: true, size: 14, color: TEXT_GRAY })],
    }),
    ...(cabinetIban ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60 },
      children: [new TextRun({ text: `IBAN : ${cabinetIban}`, size: 14, color: TEXT_GRAY })],
    })] : []),
  ];

  // ── Footer content ──
  const footerParagraphs = [
    spacer(6),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'CM2A Consulting SARLAU au capital de 100.000 DH', bold: true, size: 12, color: RED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Société d'audit et d'expertise comptable inscrite à l'Ordre des Experts-Comptables du Maroc", size: 12, color: RED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Adresse : 15 Bd Med Zerktouni | Résidence Prestige | 4ème étage - n°12 Casablanca', size: 12, color: RED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'TP: 36340816 | RC: 471315 | IF: 45939905  ICE: 002465969000025', size: 12, color: RED })],
    }),
  ];

  // ── Bottom colored bar ──
  const bottomBar = createColorBar();

  // ── Build right-aligned layout for totals + stamp ──
  // Use a layout table to push totals to the right
  const totalsLayout = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({
        children: [
          new DocxTableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [new Paragraph({ children: [] })],
          }),
          new DocxTableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              createTotalParagraph('Montant HT', formatCents(invoice.total_ht_cents), false),
              createTotalParagraph(`TVA ${vatRate}%`, formatCents(invoice.total_vat_cents), false),
              createTotalParagraph('Total TTC', formatCents(invoice.total_ttc_cents), true),
            ],
          }),
        ],
      }),
    ],
  });

  // Stamp layout (right-aligned)
  const stampLayout = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({
        children: [
          new DocxTableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [new Paragraph({ children: [] })],
          }),
          new DocxTableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'CM2A CONSULTING', bold: true, size: 20, color: BLUE })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'SARL AU', size: 14, color: TEXT_GRAY })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: '15, Bd. Med Zerktouni Rés. Prestige', size: 14, color: TEXT_GRAY })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Etg 4 Appt 12 Casablanca', size: 14, color: TEXT_GRAY })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'RC 471315 - ICE 002465969000025', size: 14, color: TEXT_GRAY })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Assemble document ──
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 400, bottom: 400, left: 700, right: 700 },
        },
      },
      children: [
        topBar,
        spacer(4),
        headerTable,
        spacer(6),
        ...clientParagraphs,
        dateParagraph,
        ...invoiceBadge,
        ...descriptionParagraphs,
        linesTable,
        spacer(4),
        totalsLayout,
        spacer(2),
        amountWordsParagraph,
        spacer(4),
        stampLayout,
        ...paymentParagraphs,
        ...footerParagraphs,
        spacer(2),
        bottomBar,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Facture_${invoice.number || 'Brouillon'}.docx`);
}

// ── Helper: total row paragraph ─────────────────────────────────

function createTotalRow(label: string, value: string, isFinal: boolean): DocxTableRow {
  return new DocxTableRow({
    children: [
      new DocxTableCell({
        borders: {
          ...borderNone,
          bottom: { style: BorderStyle.SINGLE, size: isFinal ? 2 : 1, color: isFinal ? '333333' : 'EEEEEE' },
        },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold: isFinal, size: isFinal ? 22 : 18 })],
        })],
      }),
      new DocxTableCell({
        borders: {
          ...borderNone,
          bottom: { style: BorderStyle.SINGLE, size: isFinal ? 2 : 1, color: isFinal ? '333333' : 'EEEEEE' },
        },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: value, bold: isFinal, size: isFinal ? 22 : 18 })],
        })],
      }),
    ],
  });
}

function createTotalParagraph(label: string, value: string, isFinal: boolean): Paragraph {
  const separator = '                    ';
  return new Paragraph({
    spacing: { after: 40 },
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({ text: label, bold: isFinal, size: isFinal ? 22 : 18 }),
      new TextRun({ text: separator }),
      new TextRun({ text: value, bold: isFinal, size: isFinal ? 22 : 18 }),
    ],
    ...(isFinal ? { border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: '333333', space: 1 } } } : {}),
  });
}
