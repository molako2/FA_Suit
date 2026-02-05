 import React from 'react';
 
 interface CurrencyProps {
   cents: number;
   className?: string;
 }
 
 export function formatAmount(cents: number): string {
   return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 }
 
 export function Currency({ cents, className = '' }: CurrencyProps) {
   return (
     <span className={className}>
       {formatAmount(cents)} <span className="text-red-800">MAD</span>
     </span>
   );
 }