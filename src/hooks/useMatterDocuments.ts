import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export type MatterDocumentCategory =
  | 'rapport' | 'lettre_mission' | 'contrat' | 'correspondance'
  | 'fiscal' | 'comptable' | 'social' | 'juridique'
  | 'audit' | 'conseil' | 'piece_justificative' | 'presentation'
  | 'formulaire' | 'divers';

export const MATTER_DOC_CATEGORIES: MatterDocumentCategory[] = [
  'rapport', 'lettre_mission', 'contrat', 'correspondance',
  'fiscal', 'comptable', 'social', 'juridique',
  'audit', 'conseil', 'piece_justificative', 'presentation',
  'formulaire', 'divers',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/csv',
];

export interface MatterDocument {
  id: string;
  matter_id: string;
  category: MatterDocumentCategory;
  tags: string[];
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  parent_id: string | null;
  is_current: boolean;
  version_number: number;
  created_at: string;
}

export function useMatterDocuments(matterId: string | null, category?: MatterDocumentCategory) {
  return useQuery({
    queryKey: ['matter-documents', matterId, category],
    queryFn: async () => {
      if (!matterId) return [];
      let query = supabase
        .from('matter_documents' as any)
        .select('*')
        .eq('matter_id', matterId)
        .eq('is_current', true)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as MatterDocument[];
    },
    enabled: !!matterId,
  });
}

export function useMatterDocumentVersions(parentId: string | null) {
  return useQuery({
    queryKey: ['matter-document-versions', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data, error } = await supabase
        .from('matter_documents' as any)
        .select('*')
        .or(`id.eq.${parentId},parent_id.eq.${parentId}`)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MatterDocument[];
    },
    enabled: !!parentId,
  });
}

export function useUploadMatterDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      file,
      matterId,
      category,
      tags,
      uploadedBy,
    }: {
      file: File;
      matterId: string;
      category: MatterDocumentCategory;
      tags?: string[];
      uploadedBy: string;
    }) => {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(t('matterDocuments.fileTooLarge'));
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(t('matterDocuments.invalidFormat'));
      }

      const filePath = `${matterId}/${category}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('matter-documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('matter_documents' as any)
        .insert({
          matter_id: matterId,
          category,
          tags: tags || [],
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: uploadedBy,
        });

      if (insertError) {
        await supabase.storage.from('matter-documents').remove([filePath]);
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-documents'] });
      toast.success(t('matterDocuments.uploadSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useNewVersion() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      file,
      existingDoc,
      uploadedBy,
    }: {
      file: File;
      existingDoc: MatterDocument;
      uploadedBy: string;
    }) => {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(t('matterDocuments.fileTooLarge'));
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(t('matterDocuments.invalidFormat'));
      }

      const rootId = existingDoc.parent_id || existingDoc.id;

      // Mark old as not current
      await supabase
        .from('matter_documents' as any)
        .update({ is_current: false })
        .eq('id', existingDoc.id);

      const filePath = `${existingDoc.matter_id}/${existingDoc.category}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('matter-documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('matter_documents' as any)
        .insert({
          matter_id: existingDoc.matter_id,
          category: existingDoc.category,
          tags: existingDoc.tags,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: uploadedBy,
          parent_id: rootId,
          version_number: existingDoc.version_number + 1,
        });

      if (insertError) {
        await supabase.storage.from('matter-documents').remove([filePath]);
        // Revert old doc
        await supabase
          .from('matter_documents' as any)
          .update({ is_current: true })
          .eq('id', existingDoc.id);
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-documents'] });
      toast.success(t('matterDocuments.versionCreated'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteMatterDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (doc: MatterDocument) => {
      const { error: storageError } = await supabase.storage
        .from('matter-documents')
        .remove([doc.file_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('matter_documents' as any)
        .delete()
        .eq('id', doc.id);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-documents'] });
      toast.success(t('matterDocuments.deleteSuccess'));
    },
    onError: () => {
      toast.error(t('errors.deleteError'));
    },
  });
}

export function useDownloadMatterDocument() {
  return useMutation({
    mutationFn: async (doc: MatterDocument) => {
      const { data, error } = await supabase.storage
        .from('matter-documents')
        .createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    },
    onError: () => {
      toast.error('Erreur lors du téléchargement');
    },
  });
}
