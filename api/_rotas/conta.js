import { route, check } from '../_lib/http.js';
import { db, carregarPerfil } from '../_lib/supabase.js';
import { enviarEmail, moldura, esc, urlSite } from '../_lib/email.js';

// GET /api/conta → quem sou eu (nome, papel, status). Funciona mesmo para cadastro pendente,
// para o front mostrar a tela "aguardando aprovação".
export default route(
  {
    async GET(req, res, { user }) {
      const perfil = await carregarPerfil(user);

      // Primeiro acesso de um cadastro pendente: avisa os administradores por e-mail (uma vez só)
      if (perfil.status === 'pendente' && !perfil.notificado_em) {
        const admins = await db().from('perfis').select('email').eq('papel', 'admin').eq('status', 'ativo').then(check);
        const enviado = await enviarEmail({
          to: admins.map((a) => a.email),
          subject: `Novo cadastro aguardando aprovação — ${perfil.nome || perfil.email}`,
          html: moldura(`
            <p style="margin:0 0 12px"><strong>${esc(perfil.nome || 'Uma pessoa')}</strong> (${esc(perfil.email)}) criou uma conta no painel da escolinha.</p>
            <p style="margin:0 0 20px">Ela só terá acesso depois que um administrador aprovar.</p>
            <a href="${esc(urlSite(req))}/app#equipe" style="display:inline-block;background:#1a1fd0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Revisar cadastro</a>`),
        });
        if (enviado) await db().from('perfis').update({ notificado_em: new Date().toISOString() }).eq('id', perfil.id).then(check);
      }

      res.status(200).json({
        id: perfil.id,
        email: perfil.email,
        nome: perfil.nome,
        papel: perfil.papel,
        status: perfil.status,
      });
    },
  },
  { auth: 'login' }
);
