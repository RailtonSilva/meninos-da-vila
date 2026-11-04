import { createClient } from '@supabase/supabase-js';
import { HttpError } from './errors.js';

let client;

/** Cliente com service_role: só roda no servidor e ignora o RLS. Nunca exponha essa chave no front. */
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas.');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/** Confere o token de login enviado pelo front (Authorization: Bearer <access_token>). */
export async function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Faça login para continuar.');
  const { data, error } = await db().auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  return data.user;
}
