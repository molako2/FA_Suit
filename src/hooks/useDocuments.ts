import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export type DocumentCategory = 'factures' | 'comptable' | 'fiscal' | 'juridique' | 'social' | 'divers';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CLIENT_QUOTA = 100 * 1024 * 1024; // 100MB

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

export interface ClientDocument {
  id: string;
  client_id: string;
  matter_id: string | null;
  category: DocumentCategory;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
}

export function useDocuments(clientId: string | null, category?: DocumentCategory, matterId?: string) {
  return useQuery({
    queryKey: ['client-documents', clientId, category, matterId],
    queryFn: async () => {
      if (!clientId) return [];
      let query = supabase
        .from('client_documents')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      if (matterId) {
        query = query.eq('matter_id', matterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ClientDocument[];
    },
    enabled: !!clientId,
  });
}

export function useClientQuota(clientId: string | null) {
  return useQuery({
    queryKey: ['client-quota', clientId],
    queryFn: async () => {
      if (!clientId) return 0;
      const { data, error } = await supabase
        .from('client_documents')
        .select('file_size')
        .eq('client_id', clientId);
      if (error) throw error;
      return (data || []).reduce((sum, d) => sum + d.file_size, 0);
    },
    enabled: !!clientId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      file,
      clientId,
      category,
      matterId,
      uploadedBy,
      currentQuota,
      clientEmail,
    }: {
      file: File;
      clientId: string;
      category: DocumentCategory;
      matterId?: string;
      uploadedBy: string;
      currentQuota: number;
      clientEmail?: string | null;
    }) => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(t('documents.fileTooLarge'));
      }

      // Validate mime type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(t('documents.invalidFormat'));
      }

      // Validate quota
      if (currentQuota + file.size > MAX_CLIENT_QUOTA) {
        throw new Error(t('documents.quotaExceeded'));
      }

      // Upload to storage
      const filePath = `${clientId}/${category}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert metadata
      const { error: insertError } = await supabase
        .from('client_documents')
        .insert({
          client_id: clientId,
          matter_id: matterId || null,
          category,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: uploadedBy,
        } as any);

      if (insertError) {
        // Cleanup uploaded file
        await supabase.storage.from('client-documents').remove([filePath]);
        throw insertError;
      }

      // Send email notification to client (silent - don't block upload)
      if (clientEmail) {
        try {
          const categoryLabels: Record<DocumentCategory, string> = {
            factures: 'Factures',
            comptable: 'Comptable',
            fiscal: 'Fiscal',
            juridique: 'Juridique',
            social: 'Social',
            divers: 'Divers',
          };
          const dateStr = new Date().toLocaleDateString('fr-FR');
          await supabase.functions.invoke('send-email', {
            body: {
              to: clientEmail,
              subject: `FlowAssist Suite - Nouveau document disponible - ${categoryLabels[category]}`,
              html: `<h2>Nouveau document disponible</h2><p>Un nouveau document a été mis à disposition dans votre espace :</p><ul><li><strong>Fichier :</strong> ${file.name}</li><li><strong>Rubrique :</strong> ${categoryLabels[category]}</li><li><strong>Date :</strong> ${dateStr}</li></ul><p>Connectez-vous à votre espace FlowAssist pour le consulter : <a href="https://www.flowassist.cloud">www.flowassist.cloud</a></p><p>Cordialement,<br/>L'équipe FlowAssist</p>`,
            },
          });
        } catch (emailError) {
          console.warn('Email notification failed (non-blocking):', emailError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
      queryClient.invalidateQueries({ queryKey: ['client-quota'] });
      toast.success(t('documents.uploadSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (doc: ClientDocument) => {
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.file_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('client_documents')
        .delete()
        .eq('id', doc.id);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
      queryClient.invalidateQueries({ queryKey: ['client-quota'] });
      toast.success(t('documents.deleteSuccess'));
    },
    onError: () => {
      toast.error(t('errors.deleteError'));
    },
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (doc: ClientDocument) => {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      
      // Open in new tab
      window.open(data.signedUrl, '_blank');
    },
    onError: () => {
      toast.error('Erreur lors du téléchargement');
    },
  });
}
