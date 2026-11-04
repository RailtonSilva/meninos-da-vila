import * as api from './api.js';
import { $, esc, toast, confirmar, abrirLightbox, miniatura, dataLonga } from './ui.js';

const ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
const MAX_VIDEO = 50 * 1024 * 1024;
const MAX_FOTO = 15 * 1024 * 1024;

let midias = [];
let ligado = false;
let editando = null;

/** Admin altera tudo; treinador só o que ele mesmo enviou (a API confere de novo). */
const podeAlterar = (m) => api.ehAdmin() || (m.enviado_por && m.enviado_por === api.contaAtual()?.id);

export async function iniciarGaleria() {
  if (!ligado) ligar();
  ligado = true;
  midias = await api.listarMidias();
  render();
}

function render() {
  const grid = $('#galeria');
  $('#galeriaVazia').hidden = midias.length > 0;
  $('#galeriaTotal').textContent = midias.length ? `${midias.length} ${midias.length === 1 ? 'item' : 'itens'}` : '';
  grid.innerHTML = midias
    .map(
      (m, i) => `
    <figure class="g-item" data-i="${i}">
      <button class="g-thumb" data-action="ver" aria-label="Ver ${esc(m.legenda || 'mídia')}">${miniatura(m)}</button>
      ${m.tipo !== 'foto' ? `<span class="g-tag">${m.tipo === 'youtube' ? 'YouTube' : 'Vídeo'}</span>` : ''}
      <figcaption>
        <div><strong>${esc(m.legenda || 'Sem legenda')}</strong><small>${dataLonga(m.criado_em)}</small></div>
        ${podeAlterar(m) ? `<span class="g-actions">
          <button class="icon-btn" data-action="legenda" title="Editar legenda" aria-label="Editar legenda"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="icon-btn danger" data-action="excluir" title="Excluir" aria-label="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </span>` : ''}
      </figcaption>
    </figure>`
    )
    .join('');
}

/** Reduz fotos grandes para no máximo 1920px (envio mais rápido e menos espaço no Storage). */
async function comprimir(arquivo) {
  if (!arquivo.type.startsWith('image/')) return arquivo;
  let bmp;
  try { bmp = await createImageBitmap(arquivo); } catch { return arquivo; }
  const k = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  if (k === 1 && arquivo.size < 1.5 * 1024 * 1024) return arquivo;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) return arquivo;
  return new File([blob], arquivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

async function enviar(arquivos) {
  const legenda = $('#legendaEnvio').value.trim();
  const fila = $('#uploads');
  let ok = 0;
  for (const original of arquivos) {
    const item = document.createElement('div');
    item.className = 'up-item';
    item.innerHTML = `<span class="up-name">${esc(original.name)}</span><span class="up-bar"><i></i></span><span class="up-status">Enviando…</span>`;
    fila.prepend(item);
    const recusar = (msg) => { throw Object.assign(new Error(msg), { esperado: true }); };
    try {
      if (!ACEITOS.includes(original.type)) recusar('Formato não suportado');
      const video = original.type.startsWith('video/');
      if (video && original.size > MAX_VIDEO) recusar('Vídeo acima de 50 MB. Use um link do YouTube.');
      if (!video && original.size > MAX_FOTO) recusar('Foto acima de 15 MB');
      const arquivo = await comprimir(original);
      const m = await api.enviarMidia(arquivo, legenda || null);
      midias.unshift(m);
      ok++;
      item.classList.add('done');
      item.querySelector('.up-status').textContent = 'Enviado ✓';
      setTimeout(() => item.remove(), 2500);
    } catch (err) {
      if (!err.esperado) api.reportError(err);
      item.classList.add('fail');
      item.querySelector('.up-status').textContent = err.message;
      setTimeout(() => item.remove(), 7000);
    }
    render();
  }
  if (ok) toast(`${ok} ${ok === 1 ? 'arquivo enviado' : 'arquivos enviados'} para a galeria ✓`);
}

function ligar() {
  const input = $('#inputMidia');
  input.addEventListener('change', () => {
    if (input.files.length) enviar([...input.files]);
    input.value = '';
  });

  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) enviar([...e.dataTransfer.files]); });
  dz.addEventListener('click', (e) => { if (!e.target.closest('label')) input.click(); });

  $('#galeria').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const i = Number(btn.closest('.g-item').dataset.i);
    const m = midias[i];
    if (btn.dataset.action === 'ver') return abrirLightbox(midias, i);
    if (btn.dataset.action === 'legenda') return abrirLegenda(m);
    if (btn.dataset.action === 'excluir') {
      const sim = await confirmar('Excluir da galeria?', 'O arquivo some do painel e da página dos responsáveis.', 'Excluir');
      if (!sim) return;
      try {
        await api.excluirMidia(m.id);
        midias = midias.filter((x) => x.id !== m.id);
        render();
        toast('Removido da galeria.');
      } catch (err) { api.reportError(err); toast(err.message, 'erro'); }
    }
  });

  // YouTube
  const dlgYt = $('#dlgYoutube');
  $('#btnYoutube').addEventListener('click', () => {
    $('#formYoutube').reset();
    $('#ytErro').hidden = true;
    dlgYt.showModal();
  });
  dlgYt.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlgYt.close()));
  $('#formYoutube').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const m = await api.adicionarYoutube(f.url.value.trim(), f.legenda.value.trim() || null);
      midias.unshift(m);
      render();
      dlgYt.close();
      toast('Vídeo adicionado à galeria ✓');
    } catch (err) {
      $('#ytErro').textContent = err.message;
      $('#ytErro').hidden = false;
    } finally { btn.disabled = false; }
  });

  // Legenda
  const dlgLeg = $('#dlgLegenda');
  dlgLeg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlgLeg.close()));
  $('#formLegenda').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const nova = e.target.legenda.value.trim();
      await api.atualizarMidia(editando.id, nova);
      editando.legenda = nova || null;
      render();
      dlgLeg.close();
      toast('Legenda atualizada.');
    } catch (err) { api.reportError(err); toast(err.message, 'erro'); }
  });
}

function abrirLegenda(m) {
  editando = m;
  $('#formLegenda').legenda.value = m.legenda || '';
  $('#dlgLegenda').showModal();
}
