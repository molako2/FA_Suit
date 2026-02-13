import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useClientUsers } from '@/hooks/useClientUsers';
import { useMatters } from '@/hooks/useMatters';
import { useClientUserMatters } from '@/hooks/useClientUserMatters';
import {
  useDocuments,
  useClientQuota,
  useUploadDocument,
  useDeleteDocument,
  useDownloadDocument,
  type DocumentCategory,
  type ClientDocument,
} from '@/hooks/useDocuments';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const CATEGORIES: DocumentCategory[] = ['factures', 'comptable', 'fiscal', 'juridique', 'social', 'divers'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function Documents() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const isClient = role === 'client';
  const isInternal = role === 'sysadmin' || role === 'owner' || role === 'assistant';

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedMatterId, setSelectedMatterId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<DocumentCategory>('factures');
  const [deleteTarget, setDeleteTarget] = useState<ClientDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data
  const { data: allClients = [] } = useClients();
  const { data: clientUserLinks = [] } = useClientUsers(isClient ? user?.id : undefined);
  const { data: allMatters = [] } = useMatters();
  const { data: clientUserMatters = [] } = useClientUserMatters(isClient ? user?.id : undefined);

  // For clients: only show their linked clients
  const availableClients = isClient
    ? allClients.filter(c => clientUserLinks.some(cu => cu.client_id === c.id))
    : allClients;

  // Auto-select first client
  const effectiveClientId = selectedClientId || (availableClients.length > 0 ? availableClients[0].id : '');

  // Reset matter selection when client changes
  useEffect(() => {
    setSelectedMatterId('');
  }, [effectiveClientId]);

  // Filter matters by selected client, and for clients only show assigned matters
  const clientMatters = isClient
    ? allMatters.filter(m => m.client_id === effectiveClientId && clientUserMatters.some(cum => cum.matter_id === m.id))
    : allMatters.filter(m => m.client_id === effectiveClientId);

  // For client role: use selected matter filter (like internal users)
  const effectiveMatterId = selectedMatterId || undefined;

  const { data: documents = [], isLoading: docsLoading } = useDocuments(effectiveClientId, activeCategory, effectiveMatterId);
  const { data: currentQuota = 0 } = useClientQuota(effectiveClientId);
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();
  const downloadDoc = useDownloadDocument();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !effectiveClientId) return;

    uploadDoc.mutate({
      file,
      clientId: effectiveClientId,
      category: activeCategory,
      matterId: selectedMatterId || undefined,
      uploadedBy: user.id,
      currentQuota,
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const categoryLabels: Record<DocumentCategory, string> = {
    factures: t('documents.catFactures'),
    comptable: t('documents.catComptable'),
    fiscal: t('documents.catFiscal'),
    juridique: t('documents.catJuridique'),
    social: t('documents.catSocial'),
    divers: t('documents.catDivers'),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">{t('documents.title')}</h1>
        <p className="text-muted-foreground">{t('documents.subtitle')}</p>
      </div>

      {/* Client selector - always show when there are clients */}
      {availableClients.length > 0 && (
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <Select value={effectiveClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder={t('documents.selectClient')} />
              </SelectTrigger>
              <SelectContent>
                {availableClients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Matter selector - only for internal users */}
          {effectiveClientId && clientMatters.length > 0 && (
            <div className="min-w-[200px]">
              <Select value={selectedMatterId || 'all'} onValueChange={(v) => setSelectedMatterId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('documents.allMatters')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('documents.allMatters')}</SelectItem>
                  {clientMatters.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.code} - {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {availableClients.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {isClient ? t('documents.noClientLinked') : t('documents.noClients')}
          </CardContent>
        </Card>
      )}

      {effectiveClientId && (
        <>
          {/* Quota indicator for internal users */}
          {isInternal && (
            <div className="text-sm text-muted-foreground">
              {t('documents.quota')}: {formatFileSize(currentQuota)} / 100 Mo
            </div>
          )}

          {/* Category tabs */}
          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as DocumentCategory)}>
            <TabsList className="flex-wrap h-auto">
              {CATEGORIES.map(cat => (
                <TabsTrigger key={cat} value={cat}>
                  {categoryLabels[cat]}
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORIES.map(cat => (
              <TabsContent key={cat} value={cat}>
                {/* Upload button for internal users */}
                {isInternal && (
                  <div className="mb-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv"
                      onChange={handleFileUpload}
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadDoc.isPending}
                    >
                      {uploadDoc.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {t('documents.upload')}
                    </Button>
                  </div>
                )}

                {/* Documents list */}
                {docsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : documents.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>{t('documents.noDocuments')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <Card key={doc.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(doc.file_size)} · {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: fr })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => downloadDoc.mutate(doc)}
                              disabled={downloadDoc.isPending}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {isInternal && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(doc)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documents.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.file_name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteDoc.mutate(deleteTarget);
                  setDeleteTarget(null);
                }
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
