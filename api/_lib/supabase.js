import { createClient } from '@supabase/supabase-js';
import { HttpError } from './errors.js';

let client;

/**
 * Endereço base do projeto Supabase. Aceita o valor com sobras comuns de copiar e colar
 * ("/rest/v1/", barra no final, espaços) e devolve só https://xxxx.supabase.co
 */
export function urlSupabase() {
  const bruto = String(process.env.SUPABASE_URL || '').trim();
  if (!bruto) return '';
  try { return new URL(bruto).origin; } catch { return bruto.replace(/\/(rest|auth)\/v1.*$/, '').replace(/\/+$/, ''); }
}

/** Cliente com service_role: só roda no servidor e ignora o RLS. Nunca exponha essa chave no front. */
export function db() {
  if (!client) {
    const url = urlSupabase();
    const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas.');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/** Confere o token de login enviado pelo front (Authorization: Bearer <access_token>). */
export async function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Faça login para continuar.', 'SEM_LOGIN');
  const { data, error } = await db().auth.getUser(token);
  // Chave do servidor errada (de outro projeto, anon no lugar da service_role, incompleta...):
  // não é culpa do usuário, então não o desloga; mostra o problema de configuração.
  if (error && /api ?key|apikey|invalid path|no api key/i.test(error.message)) {
    throw new HttpError(500, 'Configuração do servidor: a SUPABASE_SERVICE_ROLE_KEY na Vercel está errada ou é de outro projeto.', 'CONFIG');
  }
  if (error || !data?.user) throw new HttpError(401, 'Sessão expirada. Entre novamente.', 'SEM_LOGIN');
  return data.user;
}

/** Perfil do usuário (papel e status). Cria um perfil pendente se, por algum motivo, não existir. */
export async function carregarPerfil(user) {
  const { data, error } = await db().from('perfis').select('*').eq('id', user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  const novo = {
    id: user.id,
    email: user.email,
    nome: user.user_metadata?.nome || String(user.email).split('@')[0],
    papel: 'treinador',
    status: 'pendente',
  };
  const ins = await db().from('perfis').upsert(novo, { onConflict: 'id' }).select().single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

/**
 * Login + perfil ATIVO (+ admin, se pedido). É a porta de entrada de toda rota protegida.
 * @returns {{ user, perfil }}
 */
export async function exigirAcesso(req, { admin = false } = {}) {
  const user = await requireUser(req);
  const perfil = await carregarPerfil(user);
  if (perfil.status === 'pendente') throw new HttpError(403, 'Seu cadastro está aguardando aprovação de um administrador.', 'PENDENTE');
  if (perfil.status !== 'ativo') throw new HttpError(403, 'Seu acesso está bloqueado. Fale com o administrador da escolinha.', 'BLOQUEADO');
  if (admin && perfil.papel !== 'admin') throw new HttpError(403, 'Apenas administradores podem fazer isso.', 'SEM_PERMISSAO');

  // "Último acesso" atualizado no máximo a cada 10 minutos
  if (!perfil.ultimo_acesso || Date.now() - new Date(perfil.ultimo_acesso).getTime() > 10 * 60 * 1000) {
    await db().from('perfis').update({ ultimo_acesso: new Date().toISOString() }).eq('id', user.id).then(() => {}, () => {});
  }
  return { user, perfil };
}
