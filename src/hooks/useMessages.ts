import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  content: string;
  read: boolean;
  created_at: string;
  reply_to: string | null;
  sender_name?: string;
  replies?: Message[];
}

export function useMessages(userId: string | undefined) {
  return useQuery({
    queryKey: ['messages', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

      const allMessages: Message[] = (data || []).map(m => ({
        ...m,
        reply_to: (m as any).reply_to || null,
        sender_name: profileMap.get(m.sender_id) || 'Inconnu',
      }));

      // Group into threads: top-level messages with replies
      const topLevel: Message[] = [];
      const replyMap = new Map<string, Message[]>();

      for (const msg of allMessages) {
        if (msg.reply_to) {
          const existing = replyMap.get(msg.reply_to) || [];
          existing.push(msg);
          replyMap.set(msg.reply_to, existing);
        } else {
          topLevel.push(msg);
        }
      }

      // Attach replies sorted chronologically (ascending)
      for (const msg of topLevel) {
        const replies = replyMap.get(msg.id) || [];
        msg.replies = replies.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }

      return topLevel;
    },
    enabled: !!userId,
  });
}

export function useUnreadMessagesCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['unread-messages-count', userId],
    queryFn: async () => {
      if (!userId) return 0;

      // Count unread direct messages (exclude replies)
      const { count: directCount, error: directError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('read', false)
        .neq('sender_id', userId);

      if (directError) throw directError;

      // Count unread broadcasts (no entry in message_reads)
      const { data: broadcasts, error: broadcastError } = await supabase
        .from('messages')
        .select('id')
        .is('recipient_id', null)
        .neq('sender_id', userId);

      if (broadcastError) throw broadcastError;

      if (!broadcasts || broadcasts.length === 0) return directCount || 0;

      const { data: reads, error: readsError } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', userId);

      if (readsError) throw readsError;

      const readSet = new Set(reads?.map(r => r.message_id) || []);
      const unreadBroadcasts = broadcasts.filter(b => !readSet.has(b.id)).length;

      return (directCount || 0) + unreadBroadcasts;
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      senderId,
      recipientId,
      content,
      replyTo,
    }: {
      senderId: string;
      recipientId: string | null;
      content: string;
      replyTo?: string | null;
    }) => {
      if (content.length > 256 || content.trim().length === 0) {
        throw new Error('Invalid content');
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: senderId,
          recipient_id: recipientId,
          content: content.trim(),
          ...(replyTo ? { reply_to: replyTo } : {}),
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      userId,
      isBroadcast,
    }: {
      messageId: string;
      userId: string;
      isBroadcast: boolean;
    }) => {
      if (isBroadcast) {
        const { error } = await supabase
          .from('message_reads')
          .upsert(
            { message_id: messageId, user_id: userId },
            { onConflict: 'message_id,user_id' }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('messages')
          .update({ read: true })
          .eq('id', messageId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    },
  });
}
