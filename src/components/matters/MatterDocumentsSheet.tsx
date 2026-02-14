import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload, Download, Trash2, Search, FileText, FileSpreadsheet,
  FileImage, File, History, Loader2, Eye,
} from 'lucide-react';
import {
  useMatterDocuments, useUploadMatterDocument, useDeleteMatterDocument,
  useDownloadMatterDocument, useNewVersion, useMatterDocumentVersions,
  usePreviewMatterDocument,
  MATTER_DOC_CATEGORIES, type MatterDocumentCategory, type MatterDocument,
} from '@/hooks/useMatterDocuments';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matterId: string;
  matterCode: string;
  matterLabel: string;
}

function getFileIcon(mime: string) {
  if (mime.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv'))
    return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  if (mime.startsWith('image/')) return <FileImage className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function canPreview(mime: string) {
  return mime === 'application/pdf' || mime.startsWith('image/');
}

export default function MatterDocumentsSheet({ open, onOpenChange, matterId, matterCode, matterLabel }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadCategory, setUploadCategory] = useState<MatterDocumentCategory>('divers');
  const [uploadTags, setUploadTags] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<MatterDocument | null>(null);
  const [versionsDoc, setVersionsDoc] = useState<MatterDocument | null>(null);
  const [newVersionDoc, setNewVersionDoc] = useState<MatterDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionFileRef = useRef<HTMLInputElement>(null);

  const filterCat = categoryFilter === 'all' ? undefined : categoryFilter as MatterDocumentCategory;
  const { data: documents = [], isLoading } = useMatterDocuments(matterId, filterCat);
  const { data: versions = [], isLoading: versionsLoading } = useMatterDocumentVersions(
    versionsDoc ? (versionsDoc.parent_id || versionsDoc.id) : null
  );
  const uploadMutation = useUploadMatterDocument();
  const deleteMutation = useDeleteMatterDocument();
  const downloadMutation = useDownloadMatterDocument();
  const newVersionMutation = useNewVersion();
  const { previewUrl, previewDoc, loading: previewLoading, openPreview, closePreview } = usePreviewMatterDocument();

  const filtered = documents.filter(d =>
    d.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const tags = uploadTags.split(',').map(t => t.trim()).filter(Boolean);
    await uploadMutation.mutateAsync({
      file, matterId, category: uploadCategory, tags, uploadedBy: user.id,
    });
    setShowUpload(false);
    setUploadTags('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNewVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !newVersionDoc) return;
    await newVersionMutation.mutateAsync({ file, existingDoc: newVersionDoc, uploadedBy: user.id });
    setNewVersionDoc(null);
    if (versionFileRef.current) versionFileRef.current.value = '';
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Badge variant="outline">{matterCode}</Badge>
              <span className="truncate">{t('matterDocuments.title')}</span>
            </SheetTitle>
            <SheetDescription className="truncate">{matterLabel}</SheetDescription>
          </SheetHeader>

          <div className="px-6 py-3 space-y-3 border-b">
            {/* Filters */}
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('matterDocuments.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('matterDocuments.allCategories')}</SelectItem>
                  {MATTER_DOC_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {t(`matterDocuments.cat_${cat}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('common.search')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Upload section */}
            {!showUpload ? (
              <Button size="sm" onClick={() => setShowUpload(true)} className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                {t('matterDocuments.upload')}
              </Button>
            ) : (
              <div className="space-y-2 p-3 rounded-md border bg-muted/30">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">{t('matterDocuments.category')}</Label>
                    <Select value={uploadCategory} onValueChange={v => setUploadCategory(v as MatterDocumentCategory)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATTER_DOC_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {t(`matterDocuments.cat_${cat}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">{t('matterDocuments.tags')}</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="tag1, tag2..."
                      value={uploadTags}
                      onChange={e => setUploadTags(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.csv"
                  />
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                    className="flex-1"
                  >
                    {uploadMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {t('matterDocuments.selectFile')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowUpload(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Documents list */}
          <ScrollArea className="flex-1 px-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                {t('matterDocuments.noDocuments')}
              </p>
            ) : (
              <div className="space-y-2 py-3">
                {filtered.map(doc => (
                  <div key={doc.id} className="flex flex-col gap-2 p-3 rounded-md border hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getFileIcon(doc.mime_type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.file_name}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t(`matterDocuments.cat_${doc.category}`)}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            v{doc.version_number}
                          </Badge>
                          {doc.tags?.map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatFileSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 justify-end border-t pt-2">
                      {canPreview(doc.mime_type) && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openPreview(doc)} title={t('matterDocuments.preview')}>
                          <Eye className="w-3.5 h-3.5" />
                          {t('matterDocuments.preview')}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => downloadMutation.mutate(doc)} title={t('matterDocuments.download')}>
                        <Download className="w-3.5 h-3.5" />
                        {t('matterDocuments.download')}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        setNewVersionDoc(doc);
                        setTimeout(() => versionFileRef.current?.click(), 100);
                      }}>
                        <History className="w-3.5 h-3.5" />
                      </Button>
                      {(doc.parent_id || doc.version_number > 1) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVersionsDoc(doc)}>
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteDoc(doc)}>
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('matterDocuments.delete')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Hidden input for new version */}
          <input
            ref={versionFileRef}
            type="file"
            className="hidden"
            onChange={handleNewVersion}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.csv"
          />
        </SheetContent>
      </Sheet>

      {/* Preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={open => !open && closePreview()}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-sm">
              {previewDoc && getFileIcon(previewDoc.mime_type)}
              <span className="truncate">{previewDoc?.file_name}</span>
              {previewDoc && (
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => previewDoc && downloadMutation.mutate(previewDoc)}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  {t('matterDocuments.download')}
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-4">
            {previewLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl && previewDoc ? (
              previewDoc.mime_type === 'application/pdf' ? (
                <iframe src={previewUrl} className="w-full h-full rounded border" title={previewDoc.file_name} />
              ) : previewDoc.mime_type.startsWith('image/') ? (
                <div className="flex justify-center items-center h-full">
                  <img src={previewUrl} alt={previewDoc.file_name} className="max-w-full max-h-full object-contain rounded" />
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">{t('matterDocuments.previewNotAvailable')}</p>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={open => !open && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('matterDocuments.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDoc?.file_name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteDoc) deleteMutation.mutate(deleteDoc); setDeleteDoc(null); }}
              className="bg-destructive text-destructive-foreground"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Versions dialog */}
      <AlertDialog open={!!versionsDoc} onOpenChange={open => !open && setVersionsDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('matterDocuments.versions')}</AlertDialogTitle>
            <AlertDialogDescription>{versionsDoc?.file_name}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {versionsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : versions.map(v => (
              <div key={v.id} className="flex items-center justify-between p-2 rounded border text-sm">
                <div>
                  <span className="font-medium">v{v.version_number}</span>
                  <span className="text-muted-foreground ml-2">
                    {new Date(v.created_at).toLocaleDateString('fr-FR')}
                  </span>
                  {v.is_current && <Badge className="ml-2 text-[10px]">{t('matterDocuments.current')}</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadMutation.mutate(v)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
