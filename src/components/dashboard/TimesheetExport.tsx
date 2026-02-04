import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Download, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import { exportDetailedTimesheetCSV, type TimesheetExportEntry, type TimesheetExportProfile, type TimesheetExportMatter, type TimesheetExportClient } from '@/lib/exports';
import { formatMinutesToHours } from '@/hooks/useTimesheet';
import { toast } from 'sonner';

interface TimesheetExportProps {
  entries: TimesheetExportEntry[];
  profiles: TimesheetExportProfile[];
  matters: TimesheetExportMatter[];
  clients: TimesheetExportClient[];
}

export function TimesheetExport({ entries, profiles, matters, clients }: TimesheetExportProps) {
  const [exportUserId, setExportUserId] = useState<string>('all');
  const [exportFrom, setExportFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [exportTo, setExportTo] = useState<Date>(() => new Date());
  const [showPreview, setShowPreview] = useState(false);

  // Filter entries based on export criteria
  const filteredEntries = useMemo(() => {
    const fromStr = format(exportFrom, 'yyyy-MM-dd');
    const toStr = format(exportTo, 'yyyy-MM-dd');
    
    return entries.filter(e => {
      const matchesUser = exportUserId === 'all' || e.user_id === exportUserId;
      const matchesDate = e.date >= fromStr && e.date <= toStr;
      return matchesUser && matchesDate;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, exportUserId, exportFrom, exportTo]);

  // Preview data with resolved names
  const previewData = useMemo(() => {
    return filteredEntries.slice(0, 20).map(e => {
      const profile = profiles.find(p => p.id === e.user_id);
      const matter = matters.find(m => m.id === e.matter_id);
      const client = matter ? clients.find(c => c.id === matter.client_id) : null;
      return {
        ...e,
        userName: profile?.name || 'Inconnu',
        clientCode: client?.code || '-',
        matterCode: matter?.code || '-',
        matterLabel: matter?.label || '-',
      };
    });
  }, [filteredEntries, profiles, matters, clients]);

  const handleExport = () => {
    if (filteredEntries.length === 0) {
      toast.error('Aucune entrée à exporter pour cette sélection');
      return;
    }

    const selectedProfile = exportUserId === 'all' 
      ? undefined 
      : profiles.find(p => p.id === exportUserId);
    
    exportDetailedTimesheetCSV(
      filteredEntries,
      profiles,
      matters,
      clients,
      format(exportFrom, 'yyyy-MM-dd'),
      format(exportTo, 'yyyy-MM-dd'),
      selectedProfile?.name
    );
    toast.success('Export timesheet téléchargé');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Export Timesheet détaillé</CardTitle>
            <CardDescription>Exporter les entrées de temps avec codes client et dossier</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 flex-wrap">
          {/* User Select */}
          <div className="grid gap-2 w-full sm:w-auto">
            <Label htmlFor="exportUser" className="text-sm">Collaborateur</Label>
            <Select value={exportUserId} onValueChange={setExportUserId}>
              <SelectTrigger id="exportUser" className="w-full sm:w-[250px]">
                <SelectValue placeholder="Sélectionner un collaborateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les collaborateurs</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name} ({profile.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="grid gap-2 w-full sm:w-auto">
            <Label className="text-sm">Du</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal",
                    !exportFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {exportFrom ? format(exportFrom, "dd MMM yyyy", { locale: fr }) : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={exportFrom}
                  onSelect={(date) => date && setExportFrom(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="grid gap-2 w-full sm:w-auto">
            <Label className="text-sm">Au</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal",
                    !exportTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {exportTo ? format(exportTo, "dd MMM yyyy", { locale: fr }) : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={exportTo}
                  onSelect={(date) => date && setExportTo(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="flex-1 sm:flex-none"
            >
              {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showPreview ? 'Masquer' : 'Prévisualiser'}
            </Button>
            <Button onClick={handleExport} className="flex-1 sm:flex-none">
              <Download className="w-4 h-4 mr-2" />
              Exporter CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="text-sm text-muted-foreground">
          {filteredEntries.length} entrée{filteredEntries.length !== 1 ? 's' : ''} trouvée{filteredEntries.length !== 1 ? 's' : ''}
          {' • '}
          {formatMinutesToHours(filteredEntries.reduce((sum, e) => sum + e.minutes_rounded, 0))} total
        </div>

        {/* Preview Table */}
        {showPreview && (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Dossier</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                  <TableHead>Facturable</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Aucune entrée pour cette sélection
                    </TableCell>
                  </TableRow>
                ) : (
                  previewData.map((row, idx) => (
                    <TableRow key={`${row.user_id}-${row.date}-${idx}`}>
                      <TableCell className="font-mono text-sm">{row.date}</TableCell>
                      <TableCell>{row.userName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.clientCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{row.matterCode}</span>
                        <span className="text-muted-foreground ml-1 text-xs">
                          {row.matterLabel.length > 20 ? row.matterLabel.slice(0, 20) + '...' : row.matterLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMinutesToHours(row.minutes_rounded)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.billable ? "default" : "secondary"}>
                          {row.billable ? 'Oui' : 'Non'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                        {row.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {filteredEntries.length > 20 && (
              <div className="px-4 py-2 bg-muted/50 text-sm text-muted-foreground text-center">
                Affichage des 20 premières entrées sur {filteredEntries.length}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          L'export inclut: date, collaborateur, code client, nom client, code dossier, libellé dossier, minutes, heures, facturable, description
        </p>
      </CardContent>
    </Card>
  );
}
