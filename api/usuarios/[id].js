import { route, readBody, check, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';
import { registrar } from '../_lib/auditoria.js';
import { validarId } from '../_lib/validar.js';
import { enviarEmail, moldura, esc, urlSite } from '../_lib/email.js';

const PAPEIS = ['admin', 'treinador'];
const STATUS = ['ativo', 'bloqueado'];
const NOME_PAPEL = { admin: 'administrador', treinador: 'treinador' };

async function buscar(id) {
  const p = await db().from('perfis').select('*').eq('id', id).maybeSingle().then(check);
  if (!p) throw new HttpError(404, 'Usuário não encontrado.');
  return p;
}

/** Impede que a escolinha fique sem nenhum administrador ativo. */
async function garantirOutroAdmin(id) {
  const admins = await db().from('perfis').select('id').eq('papel', 'admin').eq('status', 'ativo').neq('id', id).then(check);
  if (!admins.length) throw new HttpError(400, 'É preciso ter pelo menos um outro administrador ativo antes disso.');
}

export default route(
  {
    // PUT /api/usuarios/:id { papel?, status? } → aprova, bloqueia, reativa ou muda o papel
    async PUT(req, res, ctx) {
      const id = validarId(req.query.id);
      if (id === ctx.perfil.id) throw new HttpError(400, 'Você não pode alterar o seu próprio acesso.');
      const b = readBody(req);
      const alvo = { ...(await buscar(id)) }; // cópia do estado anterior
      const dados = {};

      if ('papel' in b) {
        if (!PAPEIS.includes(b.papel)) throw new HttpError(400, 'Papel inválido.');
        dados.papel = b.papel;
      }
      if ('status' in b) {
        if (!STATUS.includes(b.status)) throw new HttpError(400, 'Situação inválida.');
        dados.status = b.status;
      }
      if (!Object.keys(dados).length) throw new HttpError(400, 'Nada para atualizar.');

      const deixaDeSerAdminAtivo =
        alvo.papel === 'admin' && alvo.status === 'ativo' && ((dados.papel && dados.papel !== 'admin') || dados.status === 'bloqueado');
      if (deixaDeSerAdminAtivo) await garantirOutroAdmin(id);

      const aprovando = alvo.status === 'pendente' && dados.status === 'ativo';
      if (aprovando) {
        dados.aprovado_por = ctx.perfil.id;
        dados.aprovado_em = new Date().toISOString();
      }

      const perfil = await db().from('perfis').update(dados).eq('id', id).select().single().then(check);
      const quem = perfil.nome || perfil.email;

      if (aprovando) {
        await registrar(ctx, 'usuario.aprovar', `Aprovou o cadastro de ${quem} como ${NOME_PAPEL[perfil.papel]}`, { entidadeId: id });
        await enviarEmail({
          to: perfil.email,
          subject: 'Seu acesso ao painel Meninos da Vila foi aprovado',
          html: moldura(`
            <p style="margin:0 0 12px">Olá${perfil.nome ? `, ${esc(perfil.nome)}` : ''}!</p>
            <p style="margin:0 0 20px">Seu cadastro foi aprovado. Você já pode entrar no painel como <strong>${NOME_PAPEL[perfil.papel]}</strong>.</p>
            <a href="${esc(urlSite(req))}/" style="display:inline-block;background:#1a1fd0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Entrar no painel</a>`),
        });
      } else {
        if (dados.status && dados.status !== alvo.status) {
          await registrar(ctx, dados.status === 'bloqueado' ? 'usuario.bloquear' : 'usuario.reativar', `${dados.status === 'bloqueado' ? 'Bloqueou' : 'Reativou'} o acesso de ${quem}`, { entidadeId: id });
        }
        if (dados.papel && dados.papel !== alvo.papel) {
          await registrar(ctx, 'usuario.papel', `Alterou ${quem} de ${NOME_PAPEL[alvo.papel]} para ${NOME_PAPEL[dados.papel]}`, { entidadeId: id });
        }
      }

      res.status(200).json(perfil);
    },

    // DELETE /api/usuarios/:id → recusa um cadastro / remove a conta (apaga o login também)
    async DELETE(req, res, ctx) {
      const id = validarId(req.query.id);
      if (id === ctx.perfil.id) throw new HttpError(400, 'Você não pode remover a sua própria conta.');
      const alvo = await buscar(id);
      if (alvo.papel === 'admin' && alvo.status === 'ativo') await garantirOutroAdmin(id);

      const { error } = await db().auth.admin.deleteUser(id);
      if (error) throw new Error(`Auth: ${error.message}`);

      const quem = alvo.nome || alvo.email;
      await registrar(ctx, 'usuario.remover', alvo.status === 'pendente' ? `Recusou o cadastro de ${quem}` : `Removeu a conta de ${quem}`, {
        entidadeId: id,
        dados: { email: alvo.email },
      });
      res.status(204).end();
    },
  },
  { admin: true }
);
