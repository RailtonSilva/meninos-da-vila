import * as api from './api.js';
import { $, $$, brl, esc, compAtual, compShift, compLabel, iniciais, avatarBg, toast, confirmar } from './ui.js';
import { iniciarGaleria } from './galeria.js';
import { iniciarLinks } from './links.js';
import { iniciarEquipe, contarPendentes } from './equipe.js';

const ICON = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3ZM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

const state = {
  cfg: null,
  competencia: compAtual(),
  alunos: [],
  filtro: 'todos',
  busca: '',
  categoria: '',
  editando: null,
};

/* ---------- Utilidades ---------- */

function idade(dn) {
  if (!dn) return null;
  const [y, m, d] = dn.split('-').map(Number);
  const hoje = new Date();
  let i = hoje.getFullYear() - y;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) i--;
  return i;
}
// Categoria pelo ano de nascimento (padrão das escolinhas: idade que completa no ano)
function categoria(dn) {
  if (!dn) return null;
  const anos = new Date().getFullYear() - Number(dn.slice(0, 4));
  for (const s of [7, 9, 11, 13, 15, 17, 20]) if (anos < s) return `Sub-${s}`;
  return 'Adulto';
}
function mascaraTelefone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function linkWhatsApp(a) {
  let d = (a.telefone || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  if (!d.startsWith('55') || d.length <= 11) d = '55' + d;
  const nome = a.responsavel ? a.responsavel.split(' ')[0] : '';
  const msg = `Olá${nome ? ', ' + nome : ''}! Tudo bem? Aqui é da escolinha Meninos da Vila. Passando para lembrar da mensalidade de ${a.nome.split(' ')[0]} referente a ${compLabel(state.competencia).toLowerCase()}, no valor de ${brl(state.cfg.mensalidade)}. Obrigado! ⚽`;
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
}

function falha(err) {
  api.reportError(err);
  toast(err.message || 'Algo deu errado.', 'erro');
}

/* ---------- Carregamento ---------- */
async function carregar() {
  $('#mesTitulo').textContent = compLabel(state.competencia);
  try {
    state.alunos = await api.listarAlunos(state.competencia);
    preencherCategorias();
    render();
  } catch (err) {
    falha(err);
    $('#lista').innerHTML = '';
  }
}

function preencherCategorias() {
  const sel = $('#filtroCategoria');
  const ordem = (c) => (c === 'Adulto' ? 99 : Number(c.slice(4)));
  const cats = [...new Set(state.alunos.map((a) => categoria(a.data_nascimento)).filter(Boolean))].sort((a, b) => ordem(a) - ordem(b));
  sel.innerHTML = '<option value="">Todas as categorias</option>' + cats.map((c) => `<option ${c === state.categoria ? 'selected' : ''}>${c}</option>`).join('');
  if (!cats.includes(state.categoria)) state.categoria = '';
}

/* ---------- Renderização ---------- */
function render() {
  const ativos = state.alunos.filter((a) => a.ativo);
  const emDia = ativos.filter((a) => a.pagamento);
  const pend = ativos.filter((a) => !a.pagamento);
  const inativos = state.alunos.length - ativos.length;
  const valor = state.cfg.mensalidade;
  const arrecadado = emDia.reduce((s, a) => s + Number(a.pagamento.valor ?? valor), 0);
  const previsto = ativos.length * valor;
  const pct = ativos.length ? Math.round((emDia.length / ativos.length) * 100) : 0;

  $('#kAtivos').textContent = ativos.length;
  $('#kAtivosSub').textContent = inativos ? `${inativos} inativo${inativos > 1 ? 's' : ''}` : 'todos ativos';
  $('#kEmDia').textContent = emDia.length;
  $('#kEmDiaSub').textContent = `${pct}% dos ativos`;
  $('#kPend').textContent = pend.length;
  $('#kPendSub').textContent = `${brl(pend.length * valor)} a receber`;
  $('#kArrecadado').textContent = brl(arrecadado);
  $('#kPrevisto').textContent = `de ${brl(previsto)} previstos · ${pct}%`;
  requestAnimationFrame(() => ($('#kBarra').style.width = `${previsto ? Math.min(100, (arrecadado / previsto) * 100) : 0}%`));

  const cont = { todos: state.alunos.length, emdia: emDia.length, pendentes: pend.length, inativos };
  document.querySelectorAll('[data-c]').forEach((el) => (el.textContent = cont[el.dataset.c]));

  const q = state.busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = state.alunos.filter((a) => {
    if (state.filtro === 'emdia' && !(a.ativo && a.pagamento)) return false;
    if (state.filtro === 'pendentes' && !(a.ativo && !a.pagamento)) return false;
    if (state.filtro === 'inativos' && a.ativo) return false;
    if (state.categoria && categoria(a.data_nascimento) !== state.categoria) return false;
    if (q) {
      const alvo = `${a.nome} ${a.responsavel || ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    return true;
  });

  $('#lista').innerHTML = lista.map(linha).join('');
  const vazio = lista.length === 0;
  $('#vazio').hidden = !vazio;
  $('.list-head').hidden = vazio;
  if (vazio) {
    const semNada = state.alunos.length === 0;
    $('#vazioTitulo').textContent = semNada ? 'Nenhum aluno cadastrado' : 'Nada encontrado';
    $('#vazioTexto').textContent = semNada ? 'Clique em "Novo aluno" para cadastrar o primeiro craque.' : 'Ajuste a busca ou os filtros.';
  }
}

function linha(a) {
  const cat = categoria(a.data_nascimento);
  const id = idade(a.data_nascimento);
  let status, acao;
  if (!a.ativo) {
    status = '<span class="pill off">Inativo</span>';
    acao = '';
  } else if (a.pagamento) {
    const dia = new Date(a.pagamento.pago_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    status = `<span class="pill ok">Pago · ${dia}</span>`;
    acao = `<button class="btn btn-sm btn-undo" data-action="desfazer">Desfazer</button>`;
  } else {
    status = '<span class="pill pend">Pendente</span>';
    acao = `<button class="btn btn-sm btn-pay" data-action="pagar">${ICON.check} Marcar pago</button>`;
  }
  const wa = a.ativo && !a.pagamento ? linkWhatsApp(a) : null;

  return `
  <li class="row ${a.ativo ? '' : 'inativo'}" data-id="${esc(a.id)}">
    <div class="aluno">
      <span class="avatar" style="background:${avatarBg(a.nome)}">${esc(iniciais(a.nome))}</span>
      <div style="min-width:0">
        <strong title="${esc(a.nome)}">${esc(a.nome)}</strong>
        <span class="meta">${cat ? `<span class="badge">${cat}</span>` : ''}${id != null ? `${id} anos` : ''}</span>
      </div>
    </div>
    <div class="resp">
      <span>${esc(a.responsavel || '—')}</span>
      <small>${esc(a.telefone || a.email || '')}</small>
    </div>
    <div class="status">${status}</div>
    <div class="actions">
      ${acao}
      ${wa ? `<a class="icon-btn wa" href="${wa}" target="_blank" rel="noopener" title="Cobrar no WhatsApp" aria-label="Cobrar no WhatsApp">${ICON.wa}</a>` : ''}
      <button class="icon-btn" data-action="editar" title="Editar" aria-label="Editar">${ICON.edit}</button>
      ${api.ehAdmin() ? `<button class="icon-btn danger" data-action="excluir" title="Excluir" aria-label="Excluir">${ICON.trash}</button>` : ''}
    </div>
  </li>`;
}

/* ---------- Ações da lista ---------- */
$('#lista').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.closest('.row').dataset.id;
  const aluno = state.alunos.find((a) => a.id === id);
  const acao = btn.dataset.action;

  if (acao === 'editar') return abrirForm(aluno);
  if (acao === 'excluir') {
    const ok = await confirmar('Excluir aluno?', `${aluno.nome} e todo o histórico de pagamentos serão apagados. Se ele só parou de treinar, prefira marcar como inativo.`, 'Excluir');
    if (!ok) return;
    try {
      await api.excluirAluno(id);
      toast(`${aluno.nome} foi excluído.`);
      carregar();
    } catch (err) { falha(err); }
    return;
  }

  btn.disabled = true;
  try {
    if (acao === 'pagar') {
      await api.marcarPago(id, state.competencia);
      aluno.pagamento = { valor: state.cfg.mensalidade, pago_em: new Date().toISOString() };
      toast(`Mensalidade de ${aluno.nome.split(' ')[0]} registrada ✓`);
    } else if (acao === 'desfazer') {
      await api.desfazerPagamento(id, state.competencia);
      aluno.pagamento = null;
      toast('Pagamento desfeito.');
    }
    render();
  } catch (err) {
    btn.disabled = false;
    falha(err);
  }
});

/* ---------- Formulário ---------- */
const dlg = $('#dlgAluno');
const form = $('#formAluno');

function abrirForm(aluno = null) {
  state.editando = aluno;
  form.reset();
  $('#formErro').hidden = true;
  $('#dlgTitulo').textContent = aluno ? 'Editar aluno' : 'Novo aluno';
  $('#btnSalvar').textContent = aluno ? 'Salvar alterações' : 'Cadastrar aluno';
  for (const k of ['nome', 'data_nascimento', 'responsavel', 'telefone', 'email', 'observacoes']) form[k].value = aluno?.[k] || '';
  form.ativo.checked = aluno ? aluno.ativo : true;
  atualizarCategoria();
  dlg.showModal();
  setTimeout(() => form.nome.focus(), 50);
}
function atualizarCategoria() {
  const dn = form.data_nascimento.value;
  const c = categoria(dn);
  $('#catPreview').value = c ? `${c} · ${idade(dn)} anos` : '';
}
form.data_nascimento.addEventListener('input', atualizarCategoria);
form.telefone.addEventListener('input', (e) => (e.target.value = mascaraTelefone(e.target.value)));
dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = $('#formErro');
  erro.hidden = true;
  const dados = {
    nome: form.nome.value.trim(),
    data_nascimento: form.data_nascimento.value || null,
    responsavel: form.responsavel.value.trim() || null,
    telefone: form.telefone.value.trim() || null,
    email: form.email.value.trim() || null,
    observacoes: form.observacoes.value.trim() || null,
    ativo: form.ativo.checked,
  };
  if (dados.nome.length < 2) return mostrar('Informe o nome do aluno.');
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return mostrar('E-mail do responsável inválido.');

  const btn = $('#btnSalvar');
  const txt = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvando…';
  try {
    if (state.editando) await api.atualizarAluno(state.editando.id, dados);
    else await api.criarAluno(dados);
    dlg.close();
    toast(state.editando ? 'Dados atualizados.' : `${dados.nome.split(' ')[0]} entrou para o time!`);
    carregar();
  } catch (err) {
    api.reportError(err);
    mostrar(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = txt;
  }

  function mostrar(msg) {
    erro.textContent = msg;
    erro.hidden = false;
  }
});

/* ---------- Topo e filtros ---------- */
$('#mesAnterior').addEventListener('click', () => { state.competencia = compShift(state.competencia, -1); carregar(); });
$('#mesProximo').addEventListener('click', () => { state.competencia = compShift(state.competencia, 1); carregar(); });
$('#btnNovo').addEventListener('click', () => abrirForm());
$('#busca').addEventListener('input', (e) => { state.busca = e.target.value; render(); });
$('#filtroCategoria').addEventListener('change', (e) => { state.categoria = e.target.value; render(); });
$('#filtros').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  document.querySelectorAll('#filtros button').forEach((x) => x.classList.toggle('on', x === b));
  state.filtro = b.dataset.f;
  render();
});

$('#btnLembretes').addEventListener('click', async () => {
  const pend = state.alunos.filter((a) => a.ativo && !a.pagamento);
  const comEmail = pend.filter((a) => a.email).length;
  if (comEmail === 0) return toast('Nenhum pendente com e-mail cadastrado neste mês.', 'erro');
  const ok = await confirmar(
    'Enviar lembretes?',
    `Vamos enviar um e-mail de cobrança para ${comEmail} responsáve${comEmail > 1 ? 'is' : 'l'} com mensalidade pendente em ${compLabel(state.competencia).toLowerCase()}.`,
    'Enviar e-mails',
    false
  );
  if (!ok) return;
  const btn = $('#btnLembretes');
  btn.disabled = true;
  try {
    const r = await api.enviarLembretes(state.competencia);
    toast(r.demo ? `Demonstração: ${r.enviados} e-mails seriam enviados.` : `${r.enviados} lembrete${r.enviados !== 1 ? 's' : ''} enviado${r.enviados !== 1 ? 's' : ''} ✓`);
  } catch (err) { falha(err); }
  finally { btn.disabled = false; }
});

$('#btnSair').addEventListener('click', async () => {
  await api.signOut();
  location.replace('index.html');
});

/* ---------- Navegação entre abas ---------- */
const VIEWS = ['mensalidades', 'galeria', 'links', 'equipe'];
const SO_ADMIN = ['links', 'equipe'];
function mostrarView() {
  let v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'mensalidades';
  if (SO_ADMIN.includes(v) && !api.ehAdmin()) v = 'mensalidades';
  $$('[data-view]').forEach((el) => (el.hidden = el.dataset.view !== v));
  $$('.tabs a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${v}`));
  window.scrollTo({ top: 0 });
  if (v === 'galeria') iniciarGaleria().catch(falha);
  if (v === 'links') iniciarLinks().catch(falha);
  if (v === 'equipe') iniciarEquipe().catch(falha);
  if (v === 'mensalidades') carregar();
}
window.addEventListener('hashchange', mostrarView);

/* ---------- Acesso ainda não liberado (pendente / bloqueado) ---------- */
function mostrarEspera(conta) {
  document.body.classList.add('modo-espera');
  $('#telaEspera').hidden = false;
  if (conta.status === 'bloqueado') {
    $('#esperaPill').className = 'pill off';
    $('#esperaPill').textContent = 'Acesso bloqueado';
    $('#esperaTitulo').textContent = 'Seu acesso está bloqueado';
    $('#esperaTexto').textContent = 'Fale com o administrador da escolinha para liberar sua conta novamente.';
    $('#btnVerificar').hidden = true;
  } else {
    $('#esperaTitulo').textContent = `Olá${conta.nome ? ', ' + conta.nome.split(' ')[0] : ''}! Seu cadastro foi recebido`;
  }
}
$('#btnVerificar').addEventListener('click', async () => {
  const c = await api.minhaConta().catch(() => null);
  if (c?.status === 'ativo') location.reload();
  else toast('Ainda aguardando a aprovação de um administrador.');
});
$('#btnSairEspera').addEventListener('click', async () => {
  await api.signOut();
  location.replace('index.html');
});

/* ---------- Início ---------- */
state.cfg = await api.init();
const session = await api.getSession();
if (!session) {
  location.replace('index.html');
} else {
  if (state.cfg.demo) {
    $('#demoBanner').hidden = false;
    let perfil = 'admin';
    try { perfil = localStorage.getItem('mdv-demo-perfil') || 'admin'; } catch {}
    $('#demoPerfil').value = perfil;
    $('#demoPerfil').addEventListener('change', (e) => { api.demoTrocarPerfil(e.target.value); location.reload(); });
  }
  let conta;
  try {
    conta = await api.minhaConta();
  } catch (err) {
    falha(err);
  }
  if (conta && conta.status !== 'ativo') {
    mostrarEspera(conta);
  } else if (conta) {
    document.body.dataset.papel = conta.papel;
    $('#userEmail').textContent = conta.nome || conta.email;
    $('#userPapel').textContent = conta.papel === 'admin' ? 'Administrador' : 'Treinador';
    $('#valorMens').textContent = brl(state.cfg.mensalidade);
    mostrarView();
    if (conta.papel === 'admin') {
      contarPendentes()
        .then((n) => { $('#badgePendentes').textContent = n; $('#badgePendentes').hidden = !n; })
        .catch(() => {});
    }
  }
}
