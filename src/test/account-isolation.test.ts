import { expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { createCloudBackend } from '../lib/cloud-backend';

vi.hoisted(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://workspace.example.test');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
});

it('does not send a stale vault request with another account’s credentials', async () => {
  function makeSession(userId: string): Session {
    const claims = btoa(JSON.stringify({ sub: userId, role: 'authenticated', exp: 2147483647 }));
    return { user: { id: userId }, access_token: 'e30.' + claims + '.test' } as Session;
  }

  let active = makeSession('account-a');
  const getSession = vi.spyOn(supabase.auth, 'getSession')
    .mockImplementation(async () => ({ data: { session: active }, error: null }));
  const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);

  try {
    const accountA = createCloudBackend('account-a');
    await expect(accountA.list()).resolves.toEqual({ notes: [], folders: [] });
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization'))
      .toBe('Bearer ' + active.access_token);

    fetch.mockClear();
    active = makeSession('account-b');
    await expect(accountA.list()).rejects.toThrow('A sessão deste espaço foi encerrada.');
    await expect(accountA.addFolder('Uma pasta de A')).resolves.toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();

    const accountB = createCloudBackend('account-b');
    await expect(accountB.list()).resolves.toEqual({ notes: [], folders: [] });
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization'))
      .toBe('Bearer ' + active.access_token);
  } finally {
    getSession.mockRestore();
    vi.stubGlobal('fetch', undefined);
  }
});
