import * as api from './api.js';
import { $, esc, toast, confirmar, copiar, dataLonga } from './ui.js';

let links = [];
let ligado = false;

export async function iniciarLinks() {
  if (!ligado) ligar();
  ligado = true;
  links = await api.listarLinks();
  render();
}

function situacao(l) {
  if (!l.ativo) return ['off', 'Desativado'];
  if (l.expira_em && new Date(l.expira_em) < new Date()) return ['pend', 'Expirado'];
  return ['ok', 'Ativo'];
}

function mensagemWhatsApp(url) {
  return `Olá, família Meninos da Vila! ⚽\nPor este link vocês acompanham as mensalidades da escolinha e veem as fotos e vídeos dos treinos e jogos:\n${url}`;
}

function render() {
  $('#linksVazio').hidden = links.length > 0;
  $('#listaLinks').innerHTML = links
    .map((l) => {
      const url = api.urlPublica(l.token);
      const [cls, rotulo] = situacao(l);
      const valido = cls === 'ok';
      const detalhes = [
        `Criado em ${dataLonga(l.criado_em)}`,
        `${l.acessos || 0} acesso${l.acessos === 1 ? '' : 's'}`,
        l.expira_em ? `${new Date(l.expira_em) < new Date() ? 'Expirou' : 'Expira'} em ${dataLonga(l.expira_em)}` : 'Sem validade',
      ].join(' · ');
      return `
      <article class="link-card ${valido ? '' : 'inativo'}" data-id="${esc(l.id)}">
        <div class="link-top">
          <div style="min-width:0">
            <h3>${esc(l.titulo || 'Link dos responsáveis')}</h3>
            <span class="link-meta">${detalhes}</span>
          </div>
          <span class="pill ${cls}">${rotulo}</span>
        </div>
        <div class="link-url">
          <input readonly value="${esc(url)}" aria-label="Endereço do link">
          <button class="btn btn-sm btn-primary" data-action="copiar" ${valido ? '' : 'disabled'}>Copiar</button>
        </div>
        <div class="link-actions">
          ${valido ? `<a class="btn btn-sm btn-green" href="https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp(url))}" target="_blank" rel="noopener">Enviar no WhatsApp</a>
          <a class="btn btn-sm btn-outline" href="${esc(url)}" target="_blank" rel="noopener">Abrir página</a>` : ''}
          <label class="switch small"><input type="checkbox" data-action="nome" ${l.nome_completo ? 'checked' : ''}><span></span>Nome completo</label>
          <span class="spacer"></span>
          <button class="btn btn-sm btn-ghost" data-action="ativo">${l.ativo ? 'Desativar' : 'Reativar'}</button>
          <button class="icon-btn danger" data-action="excluir" title="Excluir link" aria-label="Excluir link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div>
      </article>`;
    })
    .join('');
}

function ligar() {
  const dlg = $('#dlgLink');
  const form = $('#formLink');
  dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  $('#btnNovoLink').addEventListener('click', () => {
    form.reset();
    form.titulo.value = 'Meninos da Vila FC · Responsáveis';
    atualizarExemplo();
    dlg.showModal();
  });
  form.nome_completo.addEventListener('change', atualizarExemplo);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const l = await api.criarLink({
        titulo: form.titulo.value.trim(),
        nome_completo: form.nome_completo.checked,
        validade_dias: Number(form.validade.value),
      });
      links.unshift(l);
      render();
      dlg.close();
      const ok = await copiar(api.urlPublica(l.token));
      toast(ok ? 'Link criado e copiado ✓ Cole no grupo dos responsáveis.' : 'Link criado ✓');
    } catch (err) {
      api.reportError(err);
      toast(err.message, 'erro');
    } finally { btn.disabled = false; }
  });

  $('#listaLinks').addEventListener('click', async (e) => {
    const alvo = e.target.closest('[data-action]');
    if (!alvo || alvo.dataset.action === 'nome') return;
    const card = alvo.closest('.link-card');
    const l = links.find((x) => x.id === card.dataset.id);
    const acao = alvo.dataset.action;

    if (acao === 'copiar') {
      const ok = await copiar(api.urlPublica(l.token), card.querySelector('input'));
      return toast(ok ? 'Link copiado ✓' : 'Selecione o endereço e copie manualmente.', ok ? 'ok' : 'erro');
    }
    if (acao === 'ativo') {
      if (l.ativo) {
        const sim = await confirmar('Desativar link?', 'Quem tiver este link não vai mais conseguir abrir a página. Você pode reativar depois.', 'Desativar');
        if (!sim) return;
      }
      return salvar(l, { ativo: !l.ativo }, l.ativo ? 'Link desativado.' : 'Link reativado ✓');
    }
    if (acao === 'excluir') {
      const sim = await confirmar('Excluir link?', 'O link para de funcionar na hora e não pode ser recuperado.', 'Excluir');
      if (!sim) return;
      try {
        await api.excluirLink(l.id);
        links = links.filter((x) => x.id !== l.id);
        render();
        toast('Link excluído.');
      } catch (err) { api.reportError(err); toast(err.message, 'erro'); }
    }
  });

  $('#listaLinks').addEventListener('change', (e) => {
    if (e.target.dataset.action !== 'nome') return;
    const l = links.find((x) => x.id === e.target.closest('.link-card').dataset.id);
    salvar(l, { nome_completo: e.target.checked }, e.target.checked ? 'Agora o link mostra o nome completo.' : 'Agora o link mostra nomes abreviados.');
  });
}

async function salvar(l, dados, msg) {
  try {
    const novo = await api.atualizarLink(l.id, dados);
    Object.assign(l, novo || dados);
    render();
    toast(msg);
  } catch (err) {
    api.reportError(err);
    toast(err.message, 'erro');
    render();
  }
}

function atualizarExemplo() {
  const f = $('#formLink');
  $('#exemploNome').textContent = f.nome_completo.checked ? 'Arthur Gabriel Souza' : 'Arthur S.';
}
