import * as api from './api.js';
import { $, $$, esc, toast, confirmar, copiar, iniciais, avatarBg, dataLonga } from './ui.js';

const PAPEL = { admin: 'Administrador', treinador: 'Treinador' };
const ICONE_ACAO = {
  pagamento: '<path d="M2 10h20"/><rect x="2" y="5" width="20" height="14" rx="2"/>',
  aluno: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  midia: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  lembretes: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  usuario: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
};

let usuarios = [];
let ligado = false;
let sub = 'membros';
const hist = { itens: [], proximo: null, usuario: '', grupo: '' };

export async function iniciarEquipe() {
  if (!ligado) ligar();
  ligado = true;
  $('#linkCadastro').value = new URL('index.html#cadastro', location.href).href;
  await carregarMembros();
  if (sub === 'historico') await carregarHistorico(true);
}

/** Número de cadastros pendentes (para o selo na aba). */
export async function contarPendentes() {
  const { pendentes } = await api.listarUsuarios();
  return pendentes;
}

function quando(iso) {
  if (!iso) return 'Nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return 'Agora';
  if (min < 60) return `Há ${min} min`;
  if (min < 24 * 60) return `Há ${Math.round(min / 60)} h`;
  if (min < 7 * 24 * 60) return `Há ${Math.round(min / 1440)} dia${Math.round(min / 1440) > 1 ? 's' : ''}`;
  return dataLonga(iso);
}

/* ---------------- Membros ---------------- */
async function carregarMembros() {
  const r = await api.listarUsuarios();
  usuarios = r.usuarios;
  atualizarSelo(r.pendentes);
  renderMembros();
}

function atualizarSelo(n) {
  const b = $('#badgePendentes');
  b.textContent = n;
  b.hidden = !n;
}

function renderMembros() {
  const eu = api.contaAtual()?.id;
  const pendentes = usuarios.filter((u) => u.status === 'pendente');
  const outros = usuarios.filter((u) => u.status !== 'pendente');

  $('#listaPendentes').innerHTML = pendentes.length
    ? `<div class="card pendentes-card">
        <h3><span class="dot-alerta"></span>${pendentes.length} cadastro${pendentes.length > 1 ? 's' : ''} aguardando aprovação</h3>
        ${pendentes
          .map(
            (u) => `
          <div class="pendente" data-id="${esc(u.id)}">
            <span class="avatar" style="background:${avatarBg(u.nome || u.email)}">${esc(iniciais(u.nome || u.email))}</span>
            <div class="who"><strong>${esc(u.nome || '—')}</strong><small>${esc(u.email)} · cadastrou ${quando(u.criado_em).toLowerCase()}</small></div>
            <div class="pendente-acoes">
              <button class="btn btn-sm btn-ghost" data-acao="recusar">Recusar</button>
              <button class="btn btn-sm btn-green" data-acao="aprovar">Aprovar como treinador</button>
            </div>
          </div>`
          )
          .join('')}
      </div>`
    : '';

  $('#listaMembros').innerHTML = outros
    .map((u) => {
      const souEu = u.id === eu;
      const bloqueado = u.status === 'bloqueado';
      return `
      <li class="row membro ${bloqueado ? 'inativo' : ''}" data-id="${esc(u.id)}">
        <div class="aluno">
          <span class="avatar" style="background:${avatarBg(u.nome || u.email)}">${esc(iniciais(u.nome || u.email))}</span>
          <div style="min-width:0"><strong>${esc(u.nome || '—')}${souEu ? ' <em class="voce">você</em>' : ''}</strong><span class="meta">${esc(u.email)}</span></div>
        </div>
        <div class="cell">
          ${souEu
            ? `<span class="role-badge ${u.papel}">${PAPEL[u.papel]}</span>`
            : `<select class="select-inline sm" data-acao="papel" aria-label="Papel de ${esc(u.nome)}" ${bloqueado ? 'disabled' : ''}>
                <option value="treinador" ${u.papel === 'treinador' ? 'selected' : ''}>Treinador</option>
                <option value="admin" ${u.papel === 'admin' ? 'selected' : ''}>Administrador</option>
              </select>`}
        </div>
        <div class="cell"><span class="meta">${bloqueado ? '<span class="pill off">Bloqueado</span>' : quando(u.ultimo_acesso)}</span></div>
        <div class="actions">
          ${souEu
            ? ''
            : bloqueado
              ? `<button class="btn btn-sm btn-undo" data-acao="reativar">Reativar</button>
                 <button class="icon-btn danger" data-acao="remover" title="Remover conta" aria-label="Remover conta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`
              : `<button class="btn btn-sm btn-ghost" data-acao="bloquear">Bloquear</button>`}
        </div>
      </li>`;
    })
    .join('');
}

async function acaoMembro(id, acao, valor) {
  const u = usuarios.find((x) => x.id === id);
  const nome = u.nome || u.email;
  try {
    if (acao === 'aprovar') {
      await api.atualizarUsuario(id, { status: 'ativo', papel: 'treinador' });
      toast(`${nome} agora tem acesso como treinador ✓`);
    } else if (acao === 'recusar') {
      if (!(await confirmar('Recusar cadastro?', `A conta de ${nome} será apagada. A pessoa pode se cadastrar de novo depois, se precisar.`, 'Recusar'))) return;
      await api.removerUsuario(id);
      toast('Cadastro recusado.');
    } else if (acao === 'bloquear') {
      if (!(await confirmar('Bloquear acesso?', `${nome} não vai mais conseguir entrar no painel. O histórico de ações é mantido e você pode reativar depois.`, 'Bloquear'))) return;
      await api.atualizarUsuario(id, { status: 'bloqueado' });
      toast(`Acesso de ${nome} bloqueado.`);
    } else if (acao === 'reativar') {
      await api.atualizarUsuario(id, { status: 'ativo' });
      toast(`Acesso de ${nome} reativado ✓`);
    } else if (acao === 'remover') {
      if (!(await confirmar('Remover conta?', `O login de ${nome} será apagado definitivamente. As ações dela continuam no histórico.`, 'Remover'))) return;
      await api.removerUsuario(id);
      toast('Conta removida.');
    } else if (acao === 'papel') {
      if (valor === 'admin' && !(await confirmar('Tornar administrador?', `${nome} vai poder excluir alunos, gerenciar a equipe, os links públicos e ver o histórico.`, 'Tornar administrador', false))) {
        return renderMembros();
      }
      await api.atualizarUsuario(id, { papel: valor });
      toast(`${nome} agora é ${PAPEL[valor].toLowerCase()}.`);
    }
  } catch (err) {
    api.reportError(err);
    toast(err.message, 'erro');
  }
  await carregarMembros();
}

/* ---------------- Histórico ---------------- */
async function carregarHistorico(reiniciar) {
  if (reiniciar) {
    hist.itens = [];
    hist.proximo = null;
    preencherFiltroUsuarios();
  }
  const r = await api.listarAuditoria({ usuario: hist.usuario, grupo: hist.grupo, antes: reiniciar ? '' : hist.proximo });
  hist.itens = reiniciar ? r.itens : hist.itens.concat(r.itens);
  hist.proximo = r.proximo;
  renderHistorico();
}

function preencherFiltroUsuarios() {
  const sel = $('#filtroUsuario');
  sel.innerHTML =
    '<option value="">Todas as pessoas</option>' +
    usuarios
      .filter((u) => u.status !== 'pendente')
      .map((u) => `<option value="${esc(u.id)}" ${u.id === hist.usuario ? 'selected' : ''}>${esc(u.nome || u.email)}</option>`)
      .join('');
}

function renderHistorico() {
  let diaAnterior = '';
  $('#listaHistorico').innerHTML = hist.itens
    .map((a) => {
      const d = new Date(a.criado_em);
      const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      const cabecalho = dia !== diaAnterior ? `<li class="tl-dia">${esc(dia)}</li>` : '';
      diaAnterior = dia;
      const grupo = a.acao.split('.')[0];
      const tom = a.acao.endsWith('excluir') || a.acao.endsWith('remover') || a.acao.endsWith('bloquear') || a.acao.endsWith('desfazer') ? 'red' : grupo === 'pagamento' ? 'green' : 'blue';
      return `${cabecalho}
      <li class="tl-item">
        <span class="tl-icon ${tom}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONE_ACAO[grupo] || ICONE_ACAO.usuario}</svg></span>
        <div class="tl-body">
          <p>${esc(a.descricao)}</p>
          <small><strong>${esc(a.usuario_nome || 'Sistema')}</strong> · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
        </div>
      </li>`;
    })
    .join('');
  $('#historicoVazio').hidden = hist.itens.length > 0;
  $('#btnMaisHistorico').hidden = !hist.proximo;
}

/* ---------------- Eventos ---------------- */
function ligar() {
  $('#equipeAbas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sub]');
    if (!b) return;
    sub = b.dataset.sub;
    $$('#equipeAbas button').forEach((x) => x.classList.toggle('on', x === b));
    $$('[data-sub-view]').forEach((v) => (v.hidden = v.dataset.subView !== sub));
    if (sub === 'historico') carregarHistorico(true).catch((err) => toast(err.message, 'erro'));
  });

  $('#listaPendentes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (b) acaoMembro(b.closest('[data-id]').dataset.id, b.dataset.acao);
  });
  $('#listaMembros').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-acao]');
    if (b) acaoMembro(b.closest('[data-id]').dataset.id, b.dataset.acao);
  });
  $('#listaMembros').addEventListener('change', (e) => {
    if (e.target.dataset.acao === 'papel') acaoMembro(e.target.closest('[data-id]').dataset.id, 'papel', e.target.value);
  });

  $('#btnCopiarCadastro').addEventListener('click', async () => {
    const ok = await copiar($('#linkCadastro').value, $('#linkCadastro'));
    toast(ok ? 'Link de cadastro copiado ✓' : 'Selecione o endereço e copie manualmente.', ok ? 'ok' : 'erro');
  });

  $('#filtroUsuario').addEventListener('change', (e) => { hist.usuario = e.target.value; carregarHistorico(true); });
  $('#filtroGrupo').addEventListener('change', (e) => { hist.grupo = e.target.value; carregarHistorico(true); });
  $('#btnMaisHistorico').addEventListener('click', () => carregarHistorico(false));
}
