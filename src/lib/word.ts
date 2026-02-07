// Word document generation for invoices
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
  HeadingLevel,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';

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

interface WordExportParams {
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

const borderNone = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const borderAll = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
};

export async function exportInvoiceWord(params: WordExportParams): Promise<void> {
  const { invoice, cabinetName, cabinetAddress, clientName, clientAddress, clientVatNumber, matterCode, matterLabel, cabinetIban, cabinetMentions } = params;

  const statusLabel: Record<string, string> = {
    draft: 'BROUILLON',
    issued: 'ÉMISE',
    cancelled: 'ANNULÉE',
  };

  // Header paragraphs
  const headerParagraphs = [
    new Paragraph({
      children: [
        new TextRun({ text: cabinetName, bold: true, size: 32, color: '1e3a8a' }),
      ],
    }),
    ...(cabinetAddress ? [new Paragraph({
      children: [new TextRun({ text: cabinetAddress, size: 18, color: '666666' })],
    })] : []),
    new Paragraph({ children: [] }),
  ];

  // Client section
  const clientParagraphs = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "A l'attention de", size: 18, color: '666666', italics: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: clientName, bold: true, size: 24 })],
    }),
    ...(clientAddress ? [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: clientAddress, size: 18 })],
    })] : []),
    ...(clientVatNumber ? [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `ICE: ${clientVatNumber}`, size: 18 })],
    })] : []),
    new Paragraph({ children: [] }),
  ];

  // Invoice title
  const titleParagraphs = [
    new Paragraph({
      children: [
        new TextRun({ text: 'FACTURE', bold: true, size: 28, color: '1e3a8a' }),
        new TextRun({ text: `  ${statusLabel[invoice.status] || ''}`, bold: true, size: 20, color: 'dc2626' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `N° : ${invoice.number || '(Brouillon)'}`, size: 20 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Date : ${invoice.issue_date ? formatDate(invoice.issue_date) : '_______________'}`,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Dossier : ${matterCode} - ${matterLabel}`,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Période : ${formatDate(invoice.period_from)} au ${formatDate(invoice.period_to)}`,
          size: 20,
        }),
      ],
    }),
    new Paragraph({ children: [] }),
  ];

  // Lines table
  const hasTimeLines = invoice.lines.some(l => l.minutes > 0);

  const tableHeaderRow = new DocxTableRow({
    children: [
      new DocxTableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, size: 18 })] })],
        width: { size: 40, type: WidthType.PERCENTAGE },
        borders: borderAll,
        shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
      }),
      ...(hasTimeLines ? [
        new DocxTableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Heures', bold: true, size: 18 })] })],
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: borderAll,
          shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
        }),
        new DocxTableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Taux', bold: true, size: 18 })] })],
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: borderAll,
          shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
        }),
      ] : []),
      new DocxTableCell({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Montant HT', bold: true, size: 18 })] })],
        width: { size: hasTimeLines ? 30 : 60, type: WidthType.PERCENTAGE },
        borders: borderAll,
        shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
      }),
    ],
  });

  const tableDataRows = invoice.lines.map(line => new DocxTableRow({
    children: [
      new DocxTableCell({
        children: [new Paragraph({ children: [new TextRun({ text: line.label, size: 18 })] })],
        borders: borderAll,
      }),
      ...(hasTimeLines ? [
        new DocxTableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: line.label.startsWith('Frais -') ? '-' : formatMinutesToHours(line.minutes), size: 18 })] })],
          borders: borderAll,
        }),
        new DocxTableCell({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: line.label.startsWith('Frais -') ? '-' : formatCents(line.rate_cents), size: 18 })] })],
          borders: borderAll,
        }),
      ] : []),
      new DocxTableCell({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCents(line.amount_ht_cents), size: 18 })] })],
        borders: borderAll,
      }),
    ],
  }));

  const linesTable = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows],
  });

  // Totals
  const vatRate = invoice.lines.length > 0 ? invoice.lines[0].vat_rate : 20;
  const totalsParagraphs = [
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `Montant HT : ${formatCents(invoice.total_ht_cents)}`, size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `TVA ${vatRate}% : ${formatCents(invoice.total_vat_cents)}`, size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `Total TTC : ${formatCents(invoice.total_ttc_cents)}`, bold: true, size: 24 })],
    }),
    new Paragraph({ children: [] }),
  ];

  // Payment info
  const paymentParagraphs = [
    ...(cabinetIban ? [new Paragraph({
      children: [new TextRun({ text: `IBAN : ${cabinetIban}`, size: 16, color: '666666' })],
    })] : []),
    ...(cabinetMentions ? [new Paragraph({
      children: [new TextRun({ text: cabinetMentions, size: 14, color: '999999', italics: true })],
    })] : []),
  ];

  const doc = new Document({
    sections: [{
      children: [
        ...headerParagraphs,
        ...clientParagraphs,
        ...titleParagraphs,
        linesTable,
        ...totalsParagraphs,
        ...paymentParagraphs,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Facture_${invoice.number || 'Brouillon'}.docx`);
}
