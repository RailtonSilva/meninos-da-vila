import { valorMensalidade } from '../_lib/validar.js';

// Configuração PÚBLICA para o navegador. Nunca coloque segredos aqui
// (a anon key do Supabase é pública por natureza; o RLS protege as tabelas).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    sentryDsn: process.env.SENTRY_DSN_FRONTEND || '',
    ambiente: process.env.VERCEL_ENV || 'development',
    mensalidade: valorMensalidade(),
  });
}
