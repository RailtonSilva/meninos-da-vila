import { valorMensalidade } from '../_lib/validar.js';
import { urlSupabase } from '../_lib/supabase.js';

// Configuração PÚBLICA para o navegador. Nunca coloque segredos aqui
// (a anon key do Supabase é pública por natureza; o RLS protege as tabelas).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: urlSupabase(),
    supabaseAnonKey: String(process.env.SUPABASE_ANON_KEY || '').trim(),
    sentryDsn: process.env.SENTRY_DSN_FRONTEND || '',
    ambiente: process.env.VERCEL_ENV || 'development',
    mensalidade: valorMensalidade(),
  });
}
