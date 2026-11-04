import { Resend } from 'resend';
import { route, readBody, check, HttpError } from './_lib/http.js';
import { db, exigirAcesso } from './_lib/supabase.js';
import { registrar } from './_lib/auditoria.js';
import { validarCompetencia, competenciaAtual, valorMensalidade } from './_lib/validar.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Envia e-mail de lembrete para os responsáveis de alunos ATIVOS sem pagamento no mês.
 * - POST (botão do painel): exige login.
 * - GET  (Vercel Cron, todo dia 10): exige Authorization: Bearer CRON_SECRET.
 */
async function enviar(req, res) {
  let competencia;
  let ctx = null; // null = envio automático (cron)
  if (req.method === 'GET') {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) throw new HttpError(401, 'Não autorizado.');
    competencia = competenciaAtual();
  } else {
    ctx = await exigirAcesso(req, { admin: true });
    competencia = validarCompetencia(readBody(req).competencia || competenciaAtual());
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new HttpError(503, 'Configure RESEND_API_KEY e EMAIL_FROM para enviar e-mails.');
  }

  const [alunos, pagos] = await Promise.all([
    db().from('alunos').select('id, nome, responsavel, email').eq('ativo', true).not('email', 'is', null).then(check),
    db().from('pagamentos').select('aluno_id').eq('competencia', competencia).then(check),
  ]);
  const pagosSet = new Set(pagos.map((p) => p.aluno_id));
  const pendentes = alunos.filter((a) => !pagosSet.has(a.id));
  if (pendentes.length === 0) return res.status(200).json({ enviados: 0, competencia });

  const [ano, mes] = competencia.split('-');
  const mesNome = `${MESES[Number(mes) - 1]} de ${ano}`;
  const valor = brl(valorMensalidade());

  const emails = pendentes.map((a) => ({
    from: process.env.EMAIL_FROM,
    to: a.email,
    subject: `Mensalidade de ${mesNome} — ${a.nome}`,
    html: template({ aluno: a.nome, responsavel: a.responsavel, mesNome, valor }),
  }));

  const resend = new Resend(process.env.RESEND_API_KEY);
  let enviados = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const lote = emails.slice(i, i + 100);
    const { error } = await resend.batch.send(lote);
    if (error) throw new Error(`Resend: ${error.message}`);
    enviados += lote.length;
  }
  await registrar(ctx, 'lembretes.enviar', `${ctx ? 'Enviou' : 'Envio automático:'} ${enviados} lembrete${enviados === 1 ? '' : 's'} de mensalidade de ${mesNome}`, {
    dados: { competencia, enviados },
  });
  res.status(200).json({ enviados, competencia });
}

function template({ aluno, responsavel, mesNome, valor }) {
  const pix = process.env.PIX_CHAVE
    ? `<p style="margin:16px 0 0">Chave PIX: <strong>${esc(process.env.PIX_CHAVE)}</strong></p>`
    : '';
  return `
  <div style="background:#f4f6fb;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f1430">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:#1a1fd0;padding:24px 28px;border-bottom:6px solid #3be36a">
        <div style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:.5px">MENINOS DA VILA</div>
        <div style="color:#b9f5c9;font-size:12px;letter-spacing:3px">FUTEBOL CLUBE</div>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 12px">Olá${responsavel ? `, ${esc(responsavel)}` : ''}!</p>
        <p style="margin:0 0 12px">Passando para lembrar que a mensalidade de <strong>${esc(aluno)}</strong>
        referente a <strong>${esc(mesNome)}</strong> ainda está em aberto.</p>
        <p style="margin:20px 0;font-size:28px;font-weight:bold;color:#1a1fd0">${esc(valor)}</p>
        ${pix}
        <p style="margin:20px 0 0;color:#4a5070;font-size:14px">Se você já pagou, por favor desconsidere esta mensagem. Obrigado!</p>
      </div>
    </div>
  </div>`;
}

export default route({ GET: enviar, POST: enviar }, { auth: false });
