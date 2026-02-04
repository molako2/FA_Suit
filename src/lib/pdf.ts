// PDF Generation utilities for FlowAssist
// Uses browser print capabilities for PDF generation

import type { Invoice, CreditNote, InvoiceLine, CabinetSettings, Client, Matter } from '@/types';
import { formatCents } from './storage';

interface InvoicePDFData {
  invoice: Invoice;
  settings: CabinetSettings;
  client: Client;
  matter: Matter;
}

interface CreditNotePDFData {
  creditNote: CreditNote;
  invoice: Invoice;
  settings: CabinetSettings;
  client: Client;
  matter: Matter;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function formatMinutesToHours(minutes: number): string {
  const hours = (minutes / 60).toFixed(2);
  return `${hours} h`;
}

function generateInvoiceHTML(data: InvoicePDFData): string {
  const { invoice, settings, client, matter } = data;
  
  const statusLabel = {
    draft: 'BROUILLON',
    issued: '',
    cancelled: 'ANNULÉE'
  }[invoice.status];

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Facture ${invoice.number || 'Brouillon'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          font-size: 11pt;
          line-height: 1.5;
          color: #1a365d;
          padding: 40px;
        }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .cabinet { text-align: left; }
        .cabinet-name { font-size: 18pt; font-weight: bold; color: #1a365d; }
        .cabinet-info { color: #4a5568; font-size: 10pt; white-space: pre-line; margin-top: 8px; }
        .invoice-info { text-align: right; }
        .invoice-title { font-size: 24pt; font-weight: bold; color: #1a365d; }
        .invoice-number { font-size: 14pt; color: #c9a227; margin-top: 4px; }
        .invoice-date { color: #4a5568; margin-top: 8px; }
        .status-badge { 
          display: inline-block;
          padding: 4px 12px;
          background: #fed7d7;
          color: #c53030;
          font-weight: bold;
          font-size: 10pt;
          border-radius: 4px;
          margin-top: 8px;
        }
        .client-section { 
          background: #f7fafc; 
          padding: 20px; 
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .section-label { font-size: 9pt; color: #718096; text-transform: uppercase; margin-bottom: 8px; }
        .client-name { font-size: 14pt; font-weight: bold; }
        .client-info { color: #4a5568; white-space: pre-line; }
        .matter-info { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
        .period { color: #718096; font-size: 10pt; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { 
          background: #1a365d; 
          color: white; 
          padding: 12px; 
          text-align: left; 
          font-size: 10pt;
        }
        th:last-child, th:nth-child(4), th:nth-child(5), th:nth-child(6) { text-align: right; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        td:last-child, td:nth-child(4), td:nth-child(5), td:nth-child(6) { text-align: right; }
        .totals { margin-left: auto; width: 300px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .total-row.final { 
          font-size: 14pt; 
          font-weight: bold; 
          color: #1a365d;
          border-bottom: 2px solid #1a365d;
          padding: 12px 0;
        }
        .footer { 
          margin-top: 40px; 
          padding-top: 20px; 
          border-top: 1px solid #e2e8f0;
          font-size: 9pt;
          color: #718096;
        }
        .iban { margin-top: 12px; font-family: monospace; }
        @media print {
          body { padding: 20px; }
          @page { margin: 15mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="cabinet">
          <div class="cabinet-name">${settings.name}</div>
          ${settings.address ? `<div class="cabinet-info">${settings.address}</div>` : ''}
        </div>
        <div class="invoice-info">
          <div class="invoice-title">FACTURE</div>
          <div class="invoice-number">${invoice.number || 'BROUILLON'}</div>
          ${invoice.issueDate ? `<div class="invoice-date">Date: ${formatDate(invoice.issueDate)}</div>` : ''}
          ${statusLabel ? `<div class="status-badge">${statusLabel}</div>` : ''}
        </div>
      </div>

      <div class="client-section">
        <div class="section-label">Facturer à</div>
        <div class="client-name">${client.name}</div>
        ${client.address ? `<div class="client-info">${client.address}</div>` : ''}
        ${client.vatNumber ? `<div class="client-info">TVA: ${client.vatNumber}</div>` : ''}
        <div class="matter-info">
          <strong>Dossier:</strong> ${matter.code} - ${matter.label}
          <div class="period">Période: ${formatDate(invoice.periodFrom)} au ${formatDate(invoice.periodTo)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Heures</th>
            <th>Taux horaire</th>
            <th>TVA</th>
            <th>HT</th>
            <th>TTC</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.lines.map(line => `
            <tr>
              <td>${line.label}</td>
              <td>${formatMinutesToHours(line.minutes)}</td>
              <td>${formatCents(line.rateCents)}</td>
              <td>${line.vatRate}%</td>
              <td>${formatCents(line.amountHtCents)}</td>
              <td>${formatCents(line.amountTtcCents)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Total HT</span>
          <span>${formatCents(invoice.totalHtCents)}</span>
        </div>
        <div class="total-row">
          <span>TVA</span>
          <span>${formatCents(invoice.totalVatCents)}</span>
        </div>
        <div class="total-row final">
          <span>Total TTC</span>
          <span>${formatCents(invoice.totalTtcCents)}</span>
        </div>
      </div>

      <div class="footer">
        ${settings.mentions ? `<p>${settings.mentions}</p>` : ''}
        ${settings.iban ? `<p class="iban">IBAN: ${settings.iban}</p>` : ''}
      </div>
    </body>
    </html>
  `;
}

function generateCreditNoteHTML(data: CreditNotePDFData): string {
  const { creditNote, invoice, settings, client, matter } = data;

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Avoir ${creditNote.number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          font-size: 11pt;
          line-height: 1.5;
          color: #1a365d;
          padding: 40px;
        }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .cabinet { text-align: left; }
        .cabinet-name { font-size: 18pt; font-weight: bold; color: #1a365d; }
        .cabinet-info { color: #4a5568; font-size: 10pt; white-space: pre-line; margin-top: 8px; }
        .invoice-info { text-align: right; }
        .invoice-title { font-size: 24pt; font-weight: bold; color: #c53030; }
        .invoice-number { font-size: 14pt; color: #c9a227; margin-top: 4px; }
        .invoice-date { color: #4a5568; margin-top: 8px; }
        .reference { 
          background: #fff5f5;
          color: #c53030;
          padding: 8px 16px;
          border-radius: 4px;
          margin-top: 12px;
          font-size: 10pt;
        }
        .client-section { 
          background: #f7fafc; 
          padding: 20px; 
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .section-label { font-size: 9pt; color: #718096; text-transform: uppercase; margin-bottom: 8px; }
        .client-name { font-size: 14pt; font-weight: bold; }
        .client-info { color: #4a5568; white-space: pre-line; }
        .reason-section {
          background: #fff5f5;
          border: 1px solid #fed7d7;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .reason-label { font-weight: bold; color: #c53030; margin-bottom: 4px; }
        .totals { margin-left: auto; width: 300px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .total-row.final { 
          font-size: 14pt; 
          font-weight: bold; 
          color: #c53030;
          border-bottom: 2px solid #c53030;
          padding: 12px 0;
        }
        .footer { 
          margin-top: 40px; 
          padding-top: 20px; 
          border-top: 1px solid #e2e8f0;
          font-size: 9pt;
          color: #718096;
        }
        @media print {
          body { padding: 20px; }
          @page { margin: 15mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="cabinet">
          <div class="cabinet-name">${settings.name}</div>
          ${settings.address ? `<div class="cabinet-info">${settings.address}</div>` : ''}
        </div>
        <div class="invoice-info">
          <div class="invoice-title">AVOIR</div>
          <div class="invoice-number">${creditNote.number}</div>
          <div class="invoice-date">Date: ${formatDate(creditNote.issueDate)}</div>
          <div class="reference">Réf. Facture: ${invoice.number}</div>
        </div>
      </div>

      <div class="client-section">
        <div class="section-label">Client</div>
        <div class="client-name">${client.name}</div>
        ${client.address ? `<div class="client-info">${client.address}</div>` : ''}
        ${client.vatNumber ? `<div class="client-info">TVA: ${client.vatNumber}</div>` : ''}
      </div>

      ${creditNote.reason ? `
        <div class="reason-section">
          <div class="reason-label">Motif de l'avoir</div>
          <div>${creditNote.reason}</div>
        </div>
      ` : ''}

      <div class="totals">
        <div class="total-row">
          <span>Total HT</span>
          <span>-${formatCents(creditNote.totalHtCents)}</span>
        </div>
        <div class="total-row">
          <span>TVA</span>
          <span>-${formatCents(creditNote.totalVatCents)}</span>
        </div>
        <div class="total-row final">
          <span>Total TTC</span>
          <span>-${formatCents(creditNote.totalTtcCents)}</span>
        </div>
      </div>

      <div class="footer">
        ${settings.mentions ? `<p>${settings.mentions}</p>` : ''}
      </div>
    </body>
    </html>
  `;
}

export function printInvoicePDF(data: InvoicePDFData): void {
  const html = generateInvoiceHTML(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

export function printCreditNotePDF(data: CreditNotePDFData): void {
  const html = generateCreditNoteHTML(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
