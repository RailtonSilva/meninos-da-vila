import * as api from './api.js';
import { $, $$, esc, compShift, compLabel, dataCurta, iniciais, avatarBg, abrirLightbox, miniatura } from './ui.js';

const token = new URLSearchParams(location.search).get('t') || '';
const state = { dados: null, competencia: null, filtro: 'todos', busca: '' };

const cfg = await api.init({ publico: true });
$('#demoBanner').hidden = !cfg.demo;

async function carregar(competencia) {
  try {
    if (!token && !cfg.demo) throw new Error('Link incompleto. Abra o link exatamente como o treinador enviou.');
    const d = await api.obterPublico(token, competencia);
    state.dados = d;
    state.competencia = d.competencia;
    $('#carregando').hidden = true;
    $('#pubTabs').hidden = false;
    $('#titulo').textContent = d.titulo;
    document.title = `${d.titulo} · Responsáveis`;
    $('#rodape').textContent = `Página compartilhada pela coordenação da escolinha · Atualizada em ${new Date(d.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    renderResumo();
    renderLista();
    renderGaleria();
    mostrarAba();
  } catch (err) {
    if (err.status !== 404) api.reportError(err);
    $('#carregando').hidden = true;
    $('#pubTabs').hidden = true;
    $$('[data-pub]').forEach((s) => (s.hidden = true));
    $('#erroTexto').textContent = err.message;
    $('#erro').hidden = false;
  }
}

function renderResumo() {
  const d = state.dados;
  const { total, emDia, pendentes } = d.resumo;
  const pct = total ? Math.round((emDia / total) * 100) : 0;
  $('#mesTitulo').textContent = compLabel(d.competencia);
  $('#mesAnterior').disabled = d.competencia <= d.competenciaMinima;
  $('#mesProximo').disabled = d.competencia >= d.competenciaAtual;
  $('#sTotal').textContent = total;
  $('#sOk').textContent = emDia;
  $('#sPend').textContent = pendentes;
  $('#pct').textContent = `${pct}%`;
  const circ = 2 * Math.PI * 52;
  requestAnimationFrame(() => ($('#anel').style.strokeDashoffset = String(circ * (1 - pct / 100))));
}

function renderLista() {
  const q = state.busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = state.dados.alunos.filter((a) => {
    if (state.filtro === 'ok' && !a.pago) return false;
    if (state.filtro === 'pend' && a.pago) return false;
    return !q || a.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q);
  });
  $('#lista').innerHTML = lista
    .map(
      (a) => `
    <li>
      <span class="avatar" style="background:${avatarBg(a.nome)}">${esc(iniciais(a.nome))}</span>
      <div class="who"><strong>${esc(a.nome)}</strong>${a.categoria ? `<span class="badge">${esc(a.categoria)}</span>` : ''}</div>
      ${a.pago ? `<span class="pill ok">Pago em ${dataCurta(a.pago_em)}</span>` : '<span class="pill pend">Pendente</span>'}
    </li>`
    )
    .join('');
  $('#vazio').hidden = lista.length > 0;
}

function renderGaleria() {
  const midias = state.dados.midias;
  $('#nMidias').textContent = midias.length;
  $('#galeriaVazia').hidden = midias.length > 0;
  $('#galeria').innerHTML = midias
    .map(
      (m, i) => `
    <figure class="g-item" data-i="${i}">
      <button class="g-thumb" aria-label="Ver ${esc(m.legenda || 'mídia')}">${miniatura(m)}</button>
      ${m.legenda ? `<figcaption><div><strong>${esc(m.legenda)}</strong><small>${dataCurta(m.criado_em)}</small></div></figcaption>` : ''}
    </figure>`
    )
    .join('');
}

function mostrarAba() {
  const aba = location.hash === '#fotos' ? 'fotos' : 'mensalidades';
  $$('[data-pub]').forEach((s) => (s.hidden = s.dataset.pub !== aba));
  $$('#pubTabs a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${aba}`));
}

window.addEventListener('hashchange', () => state.dados && mostrarAba());
$('#mesAnterior').addEventListener('click', () => carregar(compShift(state.competencia, -1)));
$('#mesProximo').addEventListener('click', () => carregar(compShift(state.competencia, 1)));
$('#busca').addEventListener('input', (e) => { state.busca = e.target.value; renderLista(); });
$('#filtros').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  $$('#filtros button').forEach((x) => x.classList.toggle('on', x === b));
  state.filtro = b.dataset.f;
  renderLista();
});
$('#galeria').addEventListener('click', (e) => {
  const item = e.target.closest('.g-item');
  if (item) abrirLightbox(state.dados.midias, Number(item.dataset.i));
});

carregar();
