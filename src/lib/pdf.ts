// PDF Generation utilities for FlowAssist
// Uses browser print capabilities for PDF generation

import type { Invoice, CreditNote, InvoiceLine, CabinetSettings, Client, Matter } from '@/types';
import { escapeHtml } from '@/lib/utils';

// Local formatCents function
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}

// Convert number to words in French
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

// Function to load image and convert to base64
async function loadImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load logo:', error);
    return '';
  }
}

// CM2A Invoice Template
function generateInvoiceHTML(data: InvoicePDFData, logoBase64: string): string {
  const { invoice, settings, client, matter } = data;
  
  const statusLabel = {
    draft: 'BROUILLON',
    issued: '',
    cancelled: 'ANNULÉE'
  }[invoice.status];

  // Calculate VAT rate from lines (assuming same rate for all)
  const vatRate = invoice.lines.length > 0 ? invoice.lines[0].vatRate : 20;

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Facture ${invoice.number || 'Brouillon'}</title>
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          font-size: 11pt;
          line-height: 1.5;
          color: #333;
          background: white;
          min-height: 100vh;
          position: relative;
        }
        .page {
          position: relative;
          min-height: 100vh;
          padding: 0;
        }
        /* Top colored bar */
        .top-bar {
          height: 20px;
          display: flex;
        }
        .top-bar-blue { background: #1e3a8a; flex: 1; }
        .top-bar-gray { background: #6b7280; flex: 1; }
        .top-bar-red { background: #dc2626; flex: 1; }
        
        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          padding: 20px 40px;
          align-items: flex-start;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-img {
          height: 70px;
          width: auto;
        }
        .company-name {
          font-size: 24pt;
          font-weight: bold;
          line-height: 1.1;
        }
        .company-name .cm2a { color: #1e3a8a; }
        .company-name .consulting { color: #dc2626; }
        .contact-info {
          text-align: right;
          font-size: 9pt;
          color: #666;
        }
        .contact-info div {
          margin-bottom: 2px;
        }
        .contact-icon {
          color: #dc2626;
          margin-right: 5px;
        }
        
        /* Main content */
        .content {
          padding: 20px 40px;
        }
        
        /* Client section */
        .client-section {
          text-align: right;
          margin-bottom: 20px;
        }
        .client-label {
          font-size: 10pt;
          color: #666;
        }
        .client-name {
          font-weight: bold;
          font-size: 12pt;
        }
        
        /* Date */
        .date-section {
          text-align: center;
          margin: 30px 0;
        }
        
        /* Invoice badge */
        .invoice-badge-section {
          margin: 30px 0;
        }
        .invoice-badge {
          display: inline-block;
          background: #6b7280;
          color: #fff;
          padding: 5px 15px;
          font-weight: bold;
          font-size: 11pt;
        }
        .invoice-number {
          margin-top: 5px;
          color: #666;
        }
        ${statusLabel ? `
        .status-badge {
          display: inline-block;
          background: #dc2626;
          color: white;
          padding: 3px 10px;
          font-size: 9pt;
          margin-left: 10px;
        }
        ` : ''}
        
        /* Description */
        .description-section {
          margin: 40px 0;
        }
        .description-title {
          font-size: 12pt;
          margin-bottom: 20px;
        }
        
        /* Watermark */
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.08;
          font-size: 120pt;
          font-weight: bold;
          color: #1e3a8a;
          pointer-events: none;
          z-index: 0;
          white-space: nowrap;
        }
        .watermark .consulting { color: #dc2626; }
        
        /* Lines table */
        .lines-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          position: relative;
          z-index: 1;
        }
        .lines-table th {
          background: #f3f4f6;
          padding: 10px;
          text-align: left;
          font-size: 10pt;
          border-bottom: 2px solid #ddd;
        }
        .lines-table td {
          padding: 10px;
          border-bottom: 1px solid #eee;
        }
        .lines-table .right {
          text-align: right;
        }
        
        /* Totals section */
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin: 30px 0;
          position: relative;
          z-index: 1;
        }
        .totals-table {
          width: 300px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .total-row.final {
          font-weight: bold;
          font-size: 12pt;
          border-bottom: 2px solid #333;
        }
        
        /* Amount in words */
        .amount-words {
          font-style: italic;
          margin: 20px 0;
          position: relative;
          z-index: 1;
        }
        
        /* Stamp section */
        .stamp-section {
          display: flex;
          justify-content: flex-end;
          margin: 30px 0;
          position: relative;
          z-index: 1;
        }
        .stamp-box {
          text-align: center;
          padding: 10px;
        }
        .stamp-company {
          font-weight: bold;
          color: #1e3a8a;
        }
        .stamp-details {
          font-size: 8pt;
          color: #666;
        }
        
        /* Payment info */
        .payment-section {
          margin-top: 15px;
          text-align: center;
          font-size: 7pt;
          position: relative;
          z-index: 1;
          line-height: 1.2;
        }
        .payment-section p {
          margin: 1px 0;
        }
        .payment-bold {
          font-weight: bold;
        }
        
        /* Footer */
        .footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
        }
        .footer-content {
          background: white;
          padding: 5px 40px;
          text-align: center;
          font-size: 6pt;
          color: #dc2626;
          line-height: 1.1;
        }
        .footer-content p {
          margin: 0;
        }
        .footer-company {
          font-weight: bold;
        }
        .bottom-bar {
          height: 20px;
          display: flex;
        }
        .bottom-bar-blue { background: #1e3a8a; flex: 1; }
        .bottom-bar-gray { background: #6b7280; flex: 1; }
        .bottom-bar-red { background: #dc2626; flex: 1; }
        
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Top bar -->
        <div class="top-bar">
          <div class="top-bar-blue"></div>
          <div class="top-bar-gray"></div>
          <div class="top-bar-red"></div>
        </div>
        
        <!-- Header -->
        <div class="header">
          <div class="logo-section">
            ${logoBase64 ? `<img class="logo-img" src="${logoBase64}" alt="CM2A Logo" />` : ''}
            <div class="company-name">
              <span class="cm2a">CM2A</span><br>
              <span class="consulting">Consulting</span>
            </div>
          </div>
          <div class="contact-info">
            <div><span class="contact-icon">📞</span>+212 808 56 40 38</div>
            <div><span class="contact-icon">✉️</span>contact@cm2a.ma</div>
            <div><span class="contact-icon">🌐</span>www.cm2a.ma</div>
          </div>
        </div>
        
        <!-- Content -->
        <div class="content">
          <!-- Client -->
          <div class="client-section">
            <div class="client-label">A l'aimable attention de</div>
            <div class="client-name">${escapeHtml(client.name)}</div>
            ${client.address ? `<div>${escapeHtml(client.address)}</div>` : ''}
            ${client.vatNumber ? `<div>ICE: ${escapeHtml(client.vatNumber)}</div>` : ''}
          </div>
          
          <!-- Date -->
          <div class="date-section">
            Casablanca, le ${invoice.issueDate ? formatDate(invoice.issueDate) : '_______________'}
          </div>
          
          <!-- Invoice badge -->
          <div class="invoice-badge-section">
            <span class="invoice-badge">FACTURE</span>
            ${statusLabel ? `<span class="status-badge">${statusLabel}</span>` : ''}
            <div class="invoice-number">N/FAC : ${invoice.number || '___________'}</div>
          </div>
          
          <!-- Watermark -->
          <div class="watermark">
            CM2A<br><span class="consulting">Consulting</span>
          </div>
          
          <!-- Description / Lines -->
          <div class="description-section">
            ${invoice.lines.length > 0 && invoice.lines.some(l => l.minutes > 0) ? `
              <table class="lines-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th class="right">Heures</th>
                    <th class="right">Taux</th>
                    <th class="right">Montant HT</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoice.lines.map(line => `
                    <tr>
                      <td>${escapeHtml(line.label)}</td>
                      <td class="right">${line.label.startsWith('Frais -') ? '-' : formatMinutesToHours(line.minutes)}</td>
                      <td class="right">${line.label.startsWith('Frais -') ? '-' : formatCents(line.rateCents)}</td>
                      <td class="right">${formatCents(line.amountHtCents)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div class="description-title">Service professionnels rendus</div>
              <p><strong>Dossier:</strong> ${escapeHtml(matter.code)} - ${escapeHtml(matter.label)}</p>
              <p><strong>Période:</strong> ${formatDate(invoice.periodFrom)} au ${formatDate(invoice.periodTo)}</p>
            `}
          </div>
          
          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-table">
              <div class="total-row">
                <span>Montant HT</span>
                <span>${formatCents(invoice.totalHtCents)}</span>
              </div>
              <div class="total-row">
                <span>TVA ${vatRate}%</span>
                <span>${formatCents(invoice.totalVatCents)}</span>
              </div>
              <div class="total-row final">
                <span>Total TTC</span>
                <span>${formatCents(invoice.totalTtcCents)}</span>
              </div>
            </div>
          </div>
          
          <!-- Amount in words -->
          <div class="amount-words">
            <em>Arrêté la présente facture à la somme de ${amountToWordsFR(invoice.totalTtcCents)}</em>
          </div>
          
          <!-- Stamp -->
          <div class="stamp-section">
            <div class="stamp-box">
              <div class="stamp-company">CM2A CONSULTING</div>
              <div class="stamp-details">SARL AU</div>
              <div class="stamp-details">15, Bd. Med Zerktouni Rés. Prestige</div>
              <div class="stamp-details">Etg 4 Appt 12 Casablanca</div>
              <div class="stamp-details">RC 471315 - ICE 002465969000025</div>
            </div>
          </div>
          
          <!-- Payment info -->
          <div class="payment-section">
            <p class="payment-bold">Valeur en votre aimable règlement à réception de la présente</p>
            <p>Règlement par chèque à libeller au nom de « CM2A CONSULTING »</p>
            <p>Règlement par virement sur le compte de « CM2A CONSULTING »</p>
            <p>AttijariWafa Bank – Agence CASA C.I.L</p>
            <p class="payment-bold">Compte n° 007780000048200000049063</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-content">
            <p class="footer-company">CM2A Consulting SARLAU au capital de 100.000 DH</p>
            <p>Société d'audit et d'expertise comptable inscrite à l'Ordre des Experts-Comptables du Maroc</p>
            <p>Adresse : 15 Bd Med Zerktouni | Résidence Prestige | 4ème étage - n°12 Casablanca |</p>
            <p>TP: 36340816 | RC: 471315 | IF: 45939905  ICE: 002465969000025</p>
          </div>
          <div class="bottom-bar">
            <div class="bottom-bar-blue"></div>
            <div class="bottom-bar-gray"></div>
            <div class="bottom-bar-red"></div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCreditNoteHTML(data: CreditNotePDFData, logoBase64: string): string {
  const { creditNote, invoice, settings, client, matter } = data;

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Avoir ${creditNote.number}</title>
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          font-size: 11pt;
          line-height: 1.5;
          color: #333;
          background: white;
          min-height: 100vh;
          position: relative;
        }
        .page {
          position: relative;
          min-height: 100vh;
          padding: 0;
        }
        /* Top colored bar */
        .top-bar {
          height: 20px;
          display: flex;
        }
        .top-bar-blue { background: #1e3a8a; flex: 1; }
        .top-bar-gray { background: #6b7280; flex: 1; }
        .top-bar-red { background: #dc2626; flex: 1; }
        
        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          padding: 20px 40px;
          align-items: flex-start;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-img {
          height: 70px;
          width: auto;
        }
        .company-name {
          font-size: 24pt;
          font-weight: bold;
          line-height: 1.1;
        }
        .company-name .cm2a { color: #1e3a8a; }
        .company-name .consulting { color: #dc2626; }
        .contact-info {
          text-align: right;
          font-size: 9pt;
          color: #666;
        }
        .contact-info div {
          margin-bottom: 2px;
        }
        .contact-icon {
          color: #dc2626;
          margin-right: 5px;
        }
        
        /* Main content */
        .content {
          padding: 20px 40px;
        }
        
        /* Client section */
        .client-section {
          text-align: right;
          margin-bottom: 20px;
        }
        .client-label {
          font-size: 10pt;
          color: #666;
        }
        .client-name {
          font-weight: bold;
          font-size: 12pt;
        }
        
        /* Date */
        .date-section {
          text-align: center;
          margin: 30px 0;
        }
        
        /* Invoice badge */
        .invoice-badge-section {
          margin: 30px 0;
        }
        .invoice-badge {
          display: inline-block;
          background: #dc2626;
          color: white;
          padding: 5px 15px;
          font-weight: bold;
          font-size: 11pt;
        }
        .invoice-number {
          margin-top: 5px;
          color: #666;
        }
        .reference {
          margin-top: 10px;
          padding: 8px 15px;
          background: #fef2f2;
          border-left: 3px solid #dc2626;
          display: inline-block;
        }
        
        /* Watermark */
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.08;
          font-size: 120pt;
          font-weight: bold;
          color: #1e3a8a;
          pointer-events: none;
          z-index: 0;
          white-space: nowrap;
        }
        .watermark .consulting { color: #dc2626; }
        
        /* Reason section */
        .reason-section {
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 15px;
          border-radius: 5px;
          margin: 30px 0;
          position: relative;
          z-index: 1;
        }
        .reason-label {
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 5px;
        }
        
        /* Totals section */
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin: 30px 0;
          position: relative;
          z-index: 1;
        }
        .totals-table {
          width: 300px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .total-row.final {
          font-weight: bold;
          font-size: 12pt;
          border-bottom: 2px solid #dc2626;
          color: #dc2626;
        }
        
        /* Amount in words */
        .amount-words {
          font-style: italic;
          margin: 20px 0;
          position: relative;
          z-index: 1;
        }
        
        /* Stamp section */
        .stamp-section {
          display: flex;
          justify-content: flex-end;
          margin: 30px 0;
          position: relative;
          z-index: 1;
        }
        .stamp-box {
          text-align: center;
          padding: 10px;
        }
        .stamp-company {
          font-weight: bold;
          color: #1e3a8a;
        }
        .stamp-details {
          font-size: 8pt;
          color: #666;
        }
        
        /* Footer */
        .footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
        }
        .footer-content {
          background: white;
          padding: 5px 40px;
          text-align: center;
          font-size: 6pt;
          color: #dc2626;
          line-height: 1.1;
        }
        .footer-content p {
          margin: 0;
        }
        .footer-company {
          font-weight: bold;
        }
        .bottom-bar {
          height: 20px;
          display: flex;
        }
        .bottom-bar-blue { background: #1e3a8a; flex: 1; }
        .bottom-bar-gray { background: #6b7280; flex: 1; }
        .bottom-bar-red { background: #dc2626; flex: 1; }
        
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Top bar -->
        <div class="top-bar">
          <div class="top-bar-blue"></div>
          <div class="top-bar-gray"></div>
          <div class="top-bar-red"></div>
        </div>
        
        <!-- Header -->
        <div class="header">
          <div class="logo-section">
            ${logoBase64 ? `<img class="logo-img" src="${logoBase64}" alt="CM2A Logo" />` : ''}
            <div class="company-name">
              <span class="cm2a">CM2A</span><br>
              <span class="consulting">Consulting</span>
            </div>
          </div>
          <div class="contact-info">
            <div><span class="contact-icon">📞</span>+212 808 56 40 38</div>
            <div><span class="contact-icon">✉️</span>contact@cm2a.ma</div>
            <div><span class="contact-icon">🌐</span>www.cm2a.ma</div>
          </div>
        </div>
        
        <!-- Content -->
        <div class="content">
          <!-- Client -->
          <div class="client-section">
            <div class="client-label">A l'aimable attention de</div>
            <div class="client-name">${escapeHtml(client.name)}</div>
            ${client.address ? `<div>${escapeHtml(client.address)}</div>` : ''}
            ${client.vatNumber ? `<div>ICE: ${escapeHtml(client.vatNumber)}</div>` : ''}
          </div>
          
          <!-- Date -->
          <div class="date-section">
            Casablanca, le ${formatDate(creditNote.issueDate)}
          </div>
          
          <!-- Invoice badge -->
          <div class="invoice-badge-section">
            <span class="invoice-badge">AVOIR</span>
            <div class="invoice-number">N° : ${creditNote.number}</div>
            <div class="reference">Réf. Facture : ${invoice.number}</div>
          </div>
          
          <!-- Watermark -->
          <div class="watermark">
            CM2A<br><span class="consulting">Consulting</span>
          </div>
          
          ${creditNote.reason ? `
            <div class="reason-section">
              <div class="reason-label">Motif de l'avoir</div>
              <div>${escapeHtml(creditNote.reason)}</div>
            </div>
          ` : ''}
          
          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-table">
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
          </div>
          
          <!-- Amount in words -->
          <div class="amount-words">
            <em>Arrêté le présent avoir à la somme de ${amountToWordsFR(creditNote.totalTtcCents)}</em>
          </div>
          
          <!-- Stamp -->
          <div class="stamp-section">
            <div class="stamp-box">
              <div class="stamp-company">CM2A CONSULTING</div>
              <div class="stamp-details">SARL AU</div>
              <div class="stamp-details">15, Bd. Med Zerktouni Rés. Prestige</div>
              <div class="stamp-details">Etg 4 Appt 12 Casablanca</div>
              <div class="stamp-details">RC 471315 - ICE 002465969000025</div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-content">
            <p class="footer-company">CM2A Consulting SARLAU au capital de 100.000 DH</p>
            <p>Société d'audit et d'expertise comptable inscrite à l'Ordre des Experts-Comptables du Maroc</p>
            <p>Adresse : 15 Bd Med Zerktouni | Résidence Prestige | 4ème étage - n°12 Casablanca |</p>
            <p>TP: 36340816 | RC: 471315 | IF: 45939905  ICE: 002465969000025</p>
          </div>
          <div class="bottom-bar">
            <div class="bottom-bar-blue"></div>
            <div class="bottom-bar-gray"></div>
            <div class="bottom-bar-red"></div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function printInvoicePDF(data: InvoicePDFData): Promise<void> {
  const logoBase64 = await loadImageAsBase64('/cm2a-logo.png');
  const html = generateInvoiceHTML(data, logoBase64);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

export async function printCreditNotePDF(data: CreditNotePDFData): Promise<void> {
  const logoBase64 = await loadImageAsBase64('/cm2a-logo.png');
  const html = generateCreditNoteHTML(data, logoBase64);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
