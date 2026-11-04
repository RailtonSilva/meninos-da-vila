// Utilidades de interface compartilhadas entre o painel e a página pública.

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function compAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function compShift(c, n) {
  let [y, m] = c.split('-').map(Number);
  m += n;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
export const compLabel = (c) => `${MESES[Number(c.slice(5)) - 1]} de ${c.slice(0, 4)}`;
export const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
export const dataLonga = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function iniciais(nome) {
  const p = String(nome).replace(/\./g, '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
const AVATARES = [
  'linear-gradient(135deg,#1a1fd0,#4a50ff)',
  'linear-gradient(135deg,#138a3a,#2fd35b)',
  'linear-gradient(135deg,#0c1150,#2a30e6)',
  'linear-gradient(135deg,#1a1fd0,#2fd35b)',
  'linear-gradient(135deg,#0e5f2a,#1aa84a)',
];
export function avatarBg(nome) {
  let h = 0;
  for (const c of String(nome)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATARES[h % AVATARES.length];
}

/* ---------- Toast ---------- */
export function toast(msg, tipo = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = Object.assign(document.createElement('div'), { id: 'toasts', className: 'toasts' });
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${tipo === 'erro' ? 'erro' : ''}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.remove(), 3600);
}

/* ---------- Confirmação (usa #dlgConfirm do painel) ---------- */
export function confirmar(titulo, texto, rotulo = 'Confirmar', perigo = true) {
  const d = $('#dlgConfirm');
  $('#confTitulo').textContent = titulo;
  $('#confTexto').textContent = texto;
  const ok = $('#confOk');
  ok.textContent = rotulo;
  ok.className = `btn ${perigo ? 'btn-danger' : 'btn-primary'}`;
  d.showModal();
  return new Promise((resolve) => {
    const fim = (v) => {
      d.close();
      d.removeEventListener('click', onClick);
      d.removeEventListener('cancel', onCancel);
      resolve(v);
    };
    const onClick = (e) => {
      const r = e.target.closest('[data-resp]');
      if (r) fim(r.dataset.resp === 'sim');
    };
    const onCancel = () => fim(false);
    d.addEventListener('click', onClick);
    d.addEventListener('cancel', onCancel);
  });
}

/* ---------- Copiar texto ---------- */
export async function copiar(texto, input) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    if (input) {
      input.focus();
      input.select();
      try { if (document.execCommand('copy')) return true; } catch {}
    }
    return false;
  }
}

/* ---------- Galeria: miniatura e visualizador ---------- */
export const ICONES = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>',
  yt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15.1V8.9L15.6 12Z"/></svg>',
};

export function miniatura(m) {
  if (m.tipo === 'foto') return `<img src="${esc(m.url)}" alt="${esc(m.legenda || 'Foto da escolinha')}" loading="lazy">`;
  if (m.tipo === 'video')
    return `<video src="${esc(m.url)}#t=0.5" muted playsinline preload="metadata"></video><span class="g-play">${ICONES.play}</span>`;
  return `<img src="${esc(m.thumb)}" alt="${esc(m.legenda || 'Vídeo do YouTube')}" loading="lazy" onerror="this.style.visibility='hidden'"><span class="g-play yt">${ICONES.yt}</span>`;
}

export function abrirLightbox(itens, inicio = 0) {
  let i = inicio;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `
    <button class="lb-close" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <button class="lb-nav lb-prev" aria-label="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
    <div class="lb-stage"></div>
    <button class="lb-nav lb-next" aria-label="Próxima"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
    <p class="lb-caption"></p>`;
  document.body.append(box);
  document.body.style.overflow = 'hidden';
  const stage = box.querySelector('.lb-stage');

  function mostrar() {
    const m = itens[i];
    if (m.tipo === 'foto') stage.innerHTML = `<img src="${esc(m.url)}" alt="${esc(m.legenda || '')}">`;
    else if (m.tipo === 'video') stage.innerHTML = `<video src="${esc(m.url)}" controls autoplay playsinline></video>`;
    else
      stage.innerHTML = `<div class="lb-yt"><iframe src="https://www.youtube-nocookie.com/embed/${esc(m.youtubeId)}?autoplay=1&rel=0" title="${esc(m.legenda || 'Vídeo')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
        <a class="lb-ext" href="${esc(m.url)}" target="_blank" rel="noopener">Abrir no YouTube</a>`;
    const contador = itens.length > 1 ? `${i + 1} / ${itens.length}` : '';
    box.querySelector('.lb-caption').textContent = [m.legenda, contador].filter(Boolean).join('  ·  ');
    box.querySelector('.lb-prev').hidden = box.querySelector('.lb-next').hidden = itens.length < 2;
  }
  const ir = (d) => { i = (i + d + itens.length) % itens.length; mostrar(); };
  const fechar = () => {
    box.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') fechar();
    if (e.key === 'ArrowRight') ir(1);
    if (e.key === 'ArrowLeft') ir(-1);
  };
  box.querySelector('.lb-close').onclick = fechar;
  box.querySelector('.lb-prev').onclick = () => ir(-1);
  box.querySelector('.lb-next').onclick = () => ir(1);
  box.addEventListener('click', (e) => { if (e.target === box || e.target === stage) fechar(); });
  let x0 = null;
  box.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  box.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1);
    x0 = null;
  });
  document.addEventListener('keydown', onKey);
  mostrar();
}
