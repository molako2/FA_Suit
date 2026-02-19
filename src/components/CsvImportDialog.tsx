import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  expectedColumns: string[];
  onImport: (rows: Record<string, string>[]) => Promise<{ success: number; errors: string[] }>;
  templateFileName?: string;
}

function parseCsvLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === separator) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function detectSeparator(headerLine: string): string {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return semicolonCount >= commaCount ? ';' : ',';
}

export default function CsvImportDialog({
  open,
  onOpenChange,
  title,
  description,
  expectedColumns,
  onImport,
  templateFileName,
}: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    const text = await f.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      toast.error('Le fichier CSV doit contenir au moins un en-tête et une ligne de données');
      return;
    }

    const separator = detectSeparator(lines[0]);
    const headers = parseCsvLine(lines[0], separator);

    // Validate columns
    const missing = expectedColumns.filter(
      col => !headers.some(h => h.toLowerCase() === col.toLowerCase())
    );
    if (missing.length > 0) {
      toast.error(`Colonnes manquantes : ${missing.join(', ')}`);
      return;
    }

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i], separator);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h.trim()] = values[idx] || '';
      });
      rows.push(row);
    }

    setFile(f);
    setPreview(rows);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await onImport(preview);
      setResult(res);
      if (res.success > 0) {
        toast.success(`${res.success} enregistrement(s) importé(s) avec succès`);
      }
      if (res.errors.length > 0) {
        toast.error(`${res.errors.length} erreur(s) lors de l'import`);
      }
    } catch (err) {
      toast.error("Erreur lors de l'import");
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const content = expectedColumns.join(';') + '\n';
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateFileName || 'template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              Télécharger le modèle CSV
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Colonnes attendues :</p>
            <p className="font-mono bg-muted p-2 rounded text-xs break-all">
              {expectedColumns.join(' ; ')}
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-primary file:text-primary-foreground
              hover:file:opacity-90 cursor-pointer"
          />

          {preview && !result && (
            <div className="rounded-md border p-3 bg-muted/50">
              <p className="text-sm font-medium mb-1">
                {preview.length} ligne(s) détectée(s)
              </p>
              <p className="text-xs text-muted-foreground">
                Aperçu : {preview.slice(0, 3).map((r, i) => (
                  <span key={i} className="block truncate">
                    {Object.values(r).slice(0, 4).join(' | ')}{Object.values(r).length > 4 ? ' ...' : ''}
                  </span>
                ))}
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              {result.success > 0 && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  {result.success} enregistrement(s) importé(s)
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {result.errors.length} erreur(s)
                  </div>
                  <div className="max-h-32 overflow-y-auto text-xs text-destructive bg-destructive/10 p-2 rounded">
                    {result.errors.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Fermer
          </Button>
          {preview && !result && (
            <Button onClick={handleImport} disabled={importing}>
              {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Importer {preview.length} ligne(s)
            </Button>
          )}
          {result && (
            <Button onClick={reset}>
              Nouvel import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
