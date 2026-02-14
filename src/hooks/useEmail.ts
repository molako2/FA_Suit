import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export function useEmail() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendEmail = async ({ to, subject, html, from }: SendEmailOptions): Promise<SendEmailResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-email', {
        body: { to, subject, html, from },
      });

      if (invokeError) {
        const msg = invokeError.message || 'Failed to send email';
        setError(msg);
        return { success: false, error: msg };
      }

      if (data?.error) {
        setError(data.error);
        return { success: false, error: data.error };
      }

      return { success: true, id: data?.id };
    } catch (err: any) {
      const msg = err.message || 'Unexpected error';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  return { sendEmail, isLoading, error };
}
