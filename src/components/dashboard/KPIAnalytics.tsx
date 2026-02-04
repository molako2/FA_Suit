import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Download, Eye, EyeOff, BarChart3, TrendingUp } from 'lucide-react';
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

interface TimesheetEntry {
  user_id: string;
  matter_id: string;
  date: string;
  minutes_rounded: number;
  billable: boolean;
}

interface Profile {
  id: string;
  email: string;
  name: string;
  rate_cents: number | null;
}

interface Matter {
  id: string;
  code: string;
  label: string;
  client_id: string;
  rate_cents: number | null;
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

interface KPIAnalyticsProps {
  entries: TimesheetEntry[];
  profiles: Profile[];
  matters: Matter[];
  clients: Client[];
  invoices: Invoice[];
  defaultRateCents: number;
}

type GroupByOption = 'collaborator' | 'client' | 'matter';

interface KPIRow {
  key: string;
  collaboratorId?: string;
  collaboratorName?: string;
  clientId?: string;
  clientCode?: string;
  clientName?: string;
  matterId?: string;
  matterCode?: string;
  matterLabel?: string;
  billableMinutes: number;
  billableRevenueCents: number;
  invoicedRevenueCents: number;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
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

export function KPIAnalytics({ 
  entries, 
  profiles, 
  matters, 
  clients, 
  invoices,
  defaultRateCents 
}: KPIAnalyticsProps) {
  const [periodFrom, setPeriodFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [periodTo, setPeriodTo] = useState<Date>(() => new Date());
  
  // Grouping options
  const [groupByCollaborator, setGroupByCollaborator] = useState(true);
  const [groupByClient, setGroupByClient] = useState(false);
  const [groupByMatter, setGroupByMatter] = useState(false);
  
  // Filters
  const [filterCollaborator, setFilterCollaborator] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterMatter, setFilterMatter] = useState<string>('all');
  
  const [showPreview, setShowPreview] = useState(false);

  // Filter entries by period and filters
  const filteredEntries = useMemo(() => {
    const fromStr = format(periodFrom, 'yyyy-MM-dd');
    const toStr = format(periodTo, 'yyyy-MM-dd');
    
    return entries.filter(e => {
      if (!e.billable) return false;
      if (e.date < fromStr || e.date > toStr) return false;
      if (filterCollaborator !== 'all' && e.user_id !== filterCollaborator) return false;
      
      const matter = matters.find(m => m.id === e.matter_id);
      if (filterClient !== 'all' && matter?.client_id !== filterClient) return false;
      if (filterMatter !== 'all' && e.matter_id !== filterMatter) return false;
      
      return true;
    });
  }, [entries, periodFrom, periodTo, filterCollaborator, filterClient, filterMatter, matters]);

  // Filter invoices by period
  const filteredInvoices = useMemo(() => {
    const fromStr = format(periodFrom, 'yyyy-MM-dd');
    const toStr = format(periodTo, 'yyyy-MM-dd');
    
    return invoices.filter(inv => {
      if (inv.status !== 'issued') return false;
      if (!inv.issue_date) return false;
      if (inv.issue_date < fromStr || inv.issue_date > toStr) return false;
      
      const matter = matters.find(m => m.id === inv.matter_id);
      if (filterClient !== 'all' && matter?.client_id !== filterClient) return false;
      if (filterMatter !== 'all' && inv.matter_id !== filterMatter) return false;
      
      return true;
    });
  }, [invoices, periodFrom, periodTo, filterClient, filterMatter, matters]);

  // Calculate KPI data with grouping
  const kpiData = useMemo<KPIRow[]>(() => {
    const grouped = new Map<string, KPIRow>();
    
    // Ensure at least one grouping is selected
    const hasGrouping = groupByCollaborator || groupByClient || groupByMatter;
    
    filteredEntries.forEach(entry => {
      const matter = matters.find(m => m.id === entry.matter_id);
      const client = matter ? clients.find(c => c.id === matter.client_id) : null;
      const profile = profiles.find(p => p.id === entry.user_id);
      
      // Build key based on grouping
      const keyParts: string[] = [];
      if (groupByCollaborator) keyParts.push(entry.user_id);
      if (groupByClient) keyParts.push(client?.id || 'unknown');
      if (groupByMatter) keyParts.push(entry.matter_id);
      
      const key = hasGrouping ? keyParts.join('|') : 'total';
      
      // Calculate rate
      const rateCents = profile?.rate_cents || matter?.rate_cents || defaultRateCents;
      const revenueCents = Math.round((entry.minutes_rounded * rateCents) / 60);
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          collaboratorId: groupByCollaborator ? entry.user_id : undefined,
          collaboratorName: groupByCollaborator ? (profile?.name || 'Inconnu') : undefined,
          clientId: groupByClient ? client?.id : undefined,
          clientCode: groupByClient ? (client?.code || '-') : undefined,
          clientName: groupByClient ? (client?.name || '-') : undefined,
          matterId: groupByMatter ? entry.matter_id : undefined,
          matterCode: groupByMatter ? (matter?.code || '-') : undefined,
          matterLabel: groupByMatter ? (matter?.label || '-') : undefined,
          billableMinutes: 0,
          billableRevenueCents: 0,
          invoicedRevenueCents: 0,
        });
      }
      
      const row = grouped.get(key)!;
      row.billableMinutes += entry.minutes_rounded;
      row.billableRevenueCents += revenueCents;
    });

    // Add invoiced revenue
    filteredInvoices.forEach(inv => {
      const matter = matters.find(m => m.id === inv.matter_id);
      const client = matter ? clients.find(c => c.id === matter.client_id) : null;
      
      // For invoiced revenue, we need to match with entries' collaborators if grouped
      if (groupByCollaborator) {
        // Distribute invoice to matching rows (simplified - add to all collaborators for that matter)
        grouped.forEach((row, key) => {
          if (groupByMatter && row.matterId === inv.matter_id) {
            row.invoicedRevenueCents += inv.total_ht_cents;
          } else if (!groupByMatter && groupByClient && row.clientId === client?.id) {
            row.invoicedRevenueCents += inv.total_ht_cents;
          }
        });
      } else {
        const keyParts: string[] = [];
        if (groupByClient) keyParts.push(client?.id || 'unknown');
        if (groupByMatter) keyParts.push(inv.matter_id);
        
        const key = keyParts.length > 0 ? keyParts.join('|') : 'total';
        
        if (grouped.has(key)) {
          grouped.get(key)!.invoicedRevenueCents += inv.total_ht_cents;
        } else if (!groupByCollaborator) {
          // Create row for invoice-only data
          grouped.set(key, {
            key,
            clientId: groupByClient ? client?.id : undefined,
            clientCode: groupByClient ? (client?.code || '-') : undefined,
            clientName: groupByClient ? (client?.name || '-') : undefined,
            matterId: groupByMatter ? inv.matter_id : undefined,
            matterCode: groupByMatter ? (matter?.code || '-') : undefined,
            matterLabel: groupByMatter ? (matter?.label || '-') : undefined,
            billableMinutes: 0,
            billableRevenueCents: 0,
            invoicedRevenueCents: inv.total_ht_cents,
          });
        }
      }
    });
    
    return Array.from(grouped.values()).sort((a, b) => b.billableRevenueCents - a.billableRevenueCents);
  }, [filteredEntries, filteredInvoices, groupByCollaborator, groupByClient, groupByMatter, matters, clients, profiles, defaultRateCents]);

  // Totals
  const totals = useMemo(() => {
    return kpiData.reduce((acc, row) => ({
      billableMinutes: acc.billableMinutes + row.billableMinutes,
      billableRevenueCents: acc.billableRevenueCents + row.billableRevenueCents,
      invoicedRevenueCents: acc.invoicedRevenueCents + row.invoicedRevenueCents,
    }), { billableMinutes: 0, billableRevenueCents: 0, invoicedRevenueCents: 0 });
  }, [kpiData]);

  // Export CSV
  const handleExport = () => {
    if (kpiData.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    const headers: string[] = [];
    if (groupByCollaborator) headers.push('Collaborateur');
    if (groupByClient) headers.push('Code Client', 'Nom Client');
    if (groupByMatter) headers.push('Code Dossier', 'Libellé Dossier');
    headers.push('Minutes Facturables', 'Heures', 'CA Facturable (MAD)', 'CA Facturé (MAD)');
    
    const rows = kpiData.map(row => {
      const r: (string | number)[] = [];
      if (groupByCollaborator) r.push(row.collaboratorName || '');
      if (groupByClient) {
        r.push(row.clientCode || '');
        r.push(row.clientName || '');
      }
      if (groupByMatter) {
        r.push(row.matterCode || '');
        r.push(row.matterLabel || '');
      }
      r.push(row.billableMinutes);
      r.push((row.billableMinutes / 60).toFixed(2));
      r.push((row.billableRevenueCents / 100).toFixed(2));
      r.push((row.invoicedRevenueCents / 100).toFixed(2));
      return r;
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(escapeCSV).join(';'))
    ].join('\n');

    const groupingParts: string[] = [];
    if (groupByCollaborator) groupingParts.push('collab');
    if (groupByClient) groupingParts.push('client');
    if (groupByMatter) groupingParts.push('dossier');
    
    const filename = `kpi_${groupingParts.join('_')}_${format(periodFrom, 'yyyy-MM-dd')}_${format(periodTo, 'yyyy-MM-dd')}.csv`;
    downloadCSV(csvContent, filename);
    toast.success('Export KPI téléchargé');
  };

  // Get matters filtered by client
  const filteredMattersForSelect = useMemo(() => {
    if (filterClient === 'all') return matters;
    return matters.filter(m => m.client_id === filterClient);
  }, [matters, filterClient]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>KPI Chiffre d'Affaires</CardTitle>
            <CardDescription>Analyse CA facturable et facturé avec critères croisés</CardDescription>
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

        {/* Grouping Options */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Regrouper par</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="groupCollab" 
                checked={groupByCollaborator}
                onCheckedChange={(checked) => setGroupByCollaborator(checked === true)}
              />
              <label htmlFor="groupCollab" className="text-sm cursor-pointer">Collaborateur</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="groupClient" 
                checked={groupByClient}
                onCheckedChange={(checked) => setGroupByClient(checked === true)}
              />
              <label htmlFor="groupClient" className="text-sm cursor-pointer">Client</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="groupMatter" 
                checked={groupByMatter}
                onCheckedChange={(checked) => setGroupByMatter(checked === true)}
              />
              <label htmlFor="groupMatter" className="text-sm cursor-pointer">Dossier</label>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="grid gap-2">
            <Label className="text-sm">Filtrer par collaborateur</Label>
            <Select value={filterCollaborator} onValueChange={setFilterCollaborator}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label className="text-sm">Filtrer par client</Label>
            <Select value={filterClient} onValueChange={(v) => {
              setFilterClient(v);
              setFilterMatter('all'); // Reset matter when client changes
            }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {clients.map(c => (
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Heures Facturables</div>
            <div className="text-2xl font-bold">{formatMinutes(totals.billableMinutes)}</div>
          </div>
          <div className="bg-accent/10 rounded-lg p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> CA Facturable
            </div>
            <div className="text-2xl font-bold text-accent">{formatCents(totals.billableRevenueCents)}</div>
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
                  {groupByCollaborator && <TableHead>Collaborateur</TableHead>}
                  {groupByClient && <TableHead>Client</TableHead>}
                  {groupByMatter && <TableHead>Dossier</TableHead>}
                  <TableHead className="text-right">Heures</TableHead>
                  <TableHead className="text-right">CA Facturable</TableHead>
                  <TableHead className="text-right">CA Facturé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiData.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={(groupByCollaborator ? 1 : 0) + (groupByClient ? 1 : 0) + (groupByMatter ? 1 : 0) + 3} 
                      className="text-center text-muted-foreground py-8"
                    >
                      Aucune donnée pour cette sélection
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {kpiData.slice(0, 50).map((row) => (
                      <TableRow key={row.key}>
                        {groupByCollaborator && (
                          <TableCell className="font-medium">{row.collaboratorName}</TableCell>
                        )}
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
                        <TableCell className="text-right">{formatMinutes(row.billableMinutes)}</TableCell>
                        <TableCell className="text-right font-medium text-accent">
                          {formatCents(row.billableRevenueCents)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatCents(row.invoicedRevenueCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell 
                        colSpan={(groupByCollaborator ? 1 : 0) + (groupByClient ? 1 : 0) + (groupByMatter ? 1 : 0)}
                      >
                        TOTAL
                      </TableCell>
                      <TableCell className="text-right">{formatMinutes(totals.billableMinutes)}</TableCell>
                      <TableCell className="text-right text-accent">{formatCents(totals.billableRevenueCents)}</TableCell>
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
