import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = createClient(url, publishableKey);

export function createAccountClient(userId: string) {
  return createClient(url, publishableKey, {
    async accessToken() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || session?.user.id !== userId || !session.access_token) {
        throw new Error('A sessão deste espaço foi encerrada.');
      }
      return session.access_token;
    },
  });
}
