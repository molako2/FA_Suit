import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Download, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Matter {
  id: string;
  code: string;
  label: string;
  client_id: string;
  billing_type: string;
  flat_fee_cents: number | null;
}

interface Client {
  id: string;
  code: string;
  name: string;
}

interface Invoice {
  id: string;
  matter_id: string;
  status: string;
  period_from: string;
  period_to: string;
  issue_date: string | null;
  total_ht_cents: number;
}

interface KPIAnalyticsFlatFeeProps {
  matters: Matter[];
  clients: Client[];
  invoices: Invoice[];
}

interface KPIRow {
  key: string;
  clientId?: string;
  clientCode?: string;
  clientName?: string;
  matterId?: string;
  matterCode?: string;
  matterLabel?: string;
  flatFeeCents: number;
  invoicedRevenueCents: number;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}

function escapeCSV(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(content: string, filename: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function KPIAnalyticsFlatFee({ 
  matters, 
  clients, 
  invoices,
}: KPIAnalyticsFlatFeeProps) {
  const [periodFrom, setPeriodFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [periodTo, setPeriodTo] = useState<Date>(() => new Date());
  
  // Grouping options (no collaborator for flat fee)
  const [groupByClient, setGroupByClient] = useState(true);
  const [groupByMatter, setGroupByMatter] = useState(false);
  
  // Filters
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterMatter, setFilterMatter] = useState<string>('all');
  
  const [showPreview, setShowPreview] = useState(false);

  // Get only flat-fee matters
  const flatFeeMatters = useMemo(() => {
    return matters.filter(m => m.billing_type === 'flat_fee');
  }, [matters]);

  // Filter invoices by period and flat-fee matters only
  const filteredInvoices = useMemo(() => {
    const fromStr = format(periodFrom, 'yyyy-MM-dd');
    const toStr = format(periodTo, 'yyyy-MM-dd');
    
    const flatFeeMatterIds = new Set(flatFeeMatters.map(m => m.id));
    
    return invoices.filter(inv => {
      if (inv.status !== 'issued') return false;
      if (!inv.issue_date) return false;
      if (inv.issue_date < fromStr || inv.issue_date > toStr) return false;
      if (!flatFeeMatterIds.has(inv.matter_id)) return false;
      
      const matter = matters.find(m => m.id === inv.matter_id);
      if (filterClient !== 'all' && matter?.client_id !== filterClient) return false;
      if (filterMatter !== 'all' && inv.matter_id !== filterMatter) return false;
      
      return true;
    });
  }, [invoices, periodFrom, periodTo, filterClient, filterMatter, matters, flatFeeMatters]);

  // Calculate KPI data with grouping
  const kpiData = useMemo<KPIRow[]>(() => {
    const grouped = new Map<string, KPIRow>();
    
    const hasGrouping = groupByClient || groupByMatter;
    
    // First, add all flat-fee matters (for forfait amount)
    flatFeeMatters.forEach(matter => {
      const client = clients.find(c => c.id === matter.client_id);
      
      // Apply filters
      if (filterClient !== 'all' && matter.client_id !== filterClient) return;
      if (filterMatter !== 'all' && matter.id !== filterMatter) return;
      
      const keyParts: string[] = [];
      if (groupByClient) keyParts.push(client?.id || 'unknown');
      if (groupByMatter) keyParts.push(matter.id);
      
      const key = hasGrouping ? keyParts.join('|') : 'total';
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          clientId: groupByClient ? client?.id : undefined,
          clientCode: groupByClient ? (client?.code || '-') : undefined,
          clientName: groupByClient ? (client?.name || '-') : undefined,
          matterId: groupByMatter ? matter.id : undefined,
          matterCode: groupByMatter ? matter.code : undefined,
          matterLabel: groupByMatter ? matter.label : undefined,
          flatFeeCents: 0,
          invoicedRevenueCents: 0,
        });
      }
      
      const row = grouped.get(key)!;
      row.flatFeeCents += matter.flat_fee_cents || 0;
    });

    // Add invoiced revenue
    filteredInvoices.forEach(inv => {
      const matter = matters.find(m => m.id === inv.matter_id);
      const client = matter ? clients.find(c => c.id === matter.client_id) : null;
      
      const keyParts: string[] = [];
      if (groupByClient) keyParts.push(client?.id || 'unknown');
      if (groupByMatter) keyParts.push(inv.matter_id);
      
      const key = hasGrouping ? keyParts.join('|') : 'total';
      
      if (grouped.has(key)) {
        grouped.get(key)!.invoicedRevenueCents += inv.total_ht_cents;
      }
    });
    
    return Array.from(grouped.values()).sort((a, b) => b.flatFeeCents - a.flatFeeCents);
  }, [flatFeeMatters, filteredInvoices, groupByClient, groupByMatter, matters, clients, filterClient, filterMatter]);

  // Totals
  const totals = useMemo(() => {
    return kpiData.reduce((acc, row) => ({
      flatFeeCents: acc.flatFeeCents + row.flatFeeCents,
      invoicedRevenueCents: acc.invoicedRevenueCents + row.invoicedRevenueCents,
    }), { flatFeeCents: 0, invoicedRevenueCents: 0 });
  }, [kpiData]);

  // Export CSV
  const handleExport = () => {
    if (kpiData.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    const headers: string[] = [];
    if (groupByClient) headers.push('Code Client', 'Nom Client');
    if (groupByMatter) headers.push('Code Dossier', 'Libellé Dossier');
    headers.push('Forfait HT (MAD)', 'CA Facturé (MAD)');
    
    const rows = kpiData.map(row => {
      const r: (string | number)[] = [];
      if (groupByClient) {
        r.push(row.clientCode || '');
        r.push(row.clientName || '');
      }
      if (groupByMatter) {
        r.push(row.matterCode || '');
        r.push(row.matterLabel || '');
      }
      r.push((row.flatFeeCents / 100).toFixed(2));
      r.push((row.invoicedRevenueCents / 100).toFixed(2));
      return r;
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(escapeCSV).join(';'))
    ].join('\n');

    const groupingParts: string[] = ['forfait'];
    if (groupByClient) groupingParts.push('client');
    if (groupByMatter) groupingParts.push('dossier');
    
    const filename = `kpi_${groupingParts.join('_')}_${format(periodFrom, 'yyyy-MM-dd')}_${format(periodTo, 'yyyy-MM-dd')}.csv`;
    downloadCSV(csvContent, filename);
    toast.success('Export KPI forfait téléchargé');
  };

  // Get flat-fee matters filtered by client
  const filteredMattersForSelect = useMemo(() => {
    if (filterClient === 'all') return flatFeeMatters;
    return flatFeeMatters.filter(m => m.client_id === filterClient);
  }, [flatFeeMatters, filterClient]);

  // Get clients that have flat-fee matters
  const clientsWithFlatFee = useMemo(() => {
    const clientIds = new Set(flatFeeMatters.map(m => m.client_id));
    return clients.filter(c => clientIds.has(c.id));
  }, [clients, flatFeeMatters]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>KPI Chiffre d'Affaires - Facturation au forfait</CardTitle>
            <CardDescription>Analyse CA forfaitaire et facturé (dossiers au forfait uniquement)</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Period Selection */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 flex-wrap">
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Période</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-[150px] justify-start text-left font-normal")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(periodFrom, "dd MMM yyyy", { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={periodFrom}
                    onSelect={(date) => date && setPeriodFrom(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="self-center text-muted-foreground">→</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-[150px] justify-start text-left font-normal")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(periodTo, "dd MMM yyyy", { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={periodTo}
                    onSelect={(date) => date && setPeriodTo(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Grouping Options (no collaborator) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Regrouper par</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="groupClientForfait" 
                checked={groupByClient}
                onCheckedChange={(checked) => setGroupByClient(checked === true)}
              />
              <label htmlFor="groupClientForfait" className="text-sm cursor-pointer">Client</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="groupMatterForfait" 
                checked={groupByMatter}
                onCheckedChange={(checked) => setGroupByMatter(checked === true)}
              />
              <label htmlFor="groupMatterForfait" className="text-sm cursor-pointer">Dossier</label>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="grid gap-2">
            <Label className="text-sm">Filtrer par client</Label>
            <Select value={filterClient} onValueChange={(v) => {
              setFilterClient(v);
              setFilterMatter('all');
            }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {clientsWithFlatFee.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label className="text-sm">Filtrer par dossier</Label>
            <Select value={filterMatter} onValueChange={setFilterMatter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {filteredMattersForSelect.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-accent/10 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Forfaits HT</div>
            <div className="text-2xl font-bold text-accent">{formatCents(totals.flatFeeCents)}</div>
          </div>
          <div className="bg-primary/10 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">CA Facturé</div>
            <div className="text-2xl font-bold text-primary">{formatCents(totals.invoicedRevenueCents)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showPreview ? 'Masquer' : 'Prévisualiser'}
          </Button>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </Button>
        </div>

        {/* Preview Table */}
        {showPreview && (
          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {groupByClient && <TableHead>Client</TableHead>}
                  {groupByMatter && <TableHead>Dossier</TableHead>}
                  <TableHead className="text-right">Forfait HT</TableHead>
                  <TableHead className="text-right">CA Facturé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiData.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={(groupByClient ? 1 : 0) + (groupByMatter ? 1 : 0) + 2} 
                      className="text-center text-muted-foreground py-8"
                    >
                      Aucun dossier au forfait
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {kpiData.slice(0, 50).map((row) => (
                      <TableRow key={row.key}>
                        {groupByClient && (
                          <TableCell>
                            <Badge variant="outline">{row.clientCode}</Badge>
                            <span className="ml-2 text-muted-foreground text-sm">{row.clientName}</span>
                          </TableCell>
                        )}
                        {groupByMatter && (
                          <TableCell>
                            <span className="font-medium">{row.matterCode}</span>
                            <span className="ml-2 text-muted-foreground text-xs">
                              {(row.matterLabel?.length || 0) > 25 ? row.matterLabel?.slice(0, 25) + '...' : row.matterLabel}
                            </span>
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium text-accent">
                          {formatCents(row.flatFeeCents)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatCents(row.invoicedRevenueCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell 
                        colSpan={(groupByClient ? 1 : 0) + (groupByMatter ? 1 : 0)}
                      >
                        TOTAL
                      </TableCell>
                      <TableCell className="text-right text-accent">{formatCents(totals.flatFeeCents)}</TableCell>
                      <TableCell className="text-right text-primary">{formatCents(totals.invoicedRevenueCents)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
            {kpiData.length > 50 && (
              <div className="px-4 py-2 bg-muted/50 text-sm text-muted-foreground text-center">
                Affichage des 50 premières lignes sur {kpiData.length}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
