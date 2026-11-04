// Camada de dados do front.
// - Com /api/config respondendo (Vercel / `vercel dev`): usa Supabase Auth + API Node.
// - Sem backend (Live Server, arquivo aberto direto): MODO DEMONSTRAÇÃO com dados fictícios no navegador.

let cfg = null;
let supabase = null;

export async function init({ publico = false } = {}) {
  if (cfg) return cfg;
  try {
    const r = await fetch('/api/config', { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('sem api');
    const c = await r.json();
    if (!c.supabaseUrl || !c.supabaseAnonKey) throw new Error('sem supabase');
    cfg = { ...c, demo: false };
  } catch {
    cfg = { demo: true, mensalidade: 40 };
  }

  if (!cfg.demo && publico) {
    if (cfg.sentryDsn) initSentry(cfg);
  } else if (!cfg.demo) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    if (cfg.sentryDsn) initSentry(cfg);
  }
  return cfg;
}

async function initSentry(c) {
  try {
    const Sentry = await import('https://cdn.jsdelivr.net/npm/@sentry/browser@8/+esm');
    Sentry.init({ dsn: c.sentryDsn, environment: c.ambiente, tracesSampleRate: 0 });
    window.__sentry = Sentry;
  } catch (e) {
    console.warn('Sentry não carregou', e);
  }
}

export function reportError(err) {
  console.error(err);
  window.__sentry?.captureException(err);
}

/* ---------------- Autenticação ---------------- */

export async function getSession() {
  if (cfg.demo) return { user: { email: 'demo@meninosdavila.com' } };
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  if (cfg.demo) return;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
}

/** Cadastro livre: a conta nasce PENDENTE e só funciona depois da aprovação de um administrador. */
export async function signUp(nome, email, password) {
  if (cfg.demo) return { precisaConfirmar: false };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome }, emailRedirectTo: `${location.origin}/` },
  });
  if (error) {
    if (/registered|already/i.test(error.message)) throw new Error('Este e-mail já tem cadastro. Use "Entrar".');
    if (/password/i.test(error.message)) throw new Error('Senha fraca: use pelo menos 8 caracteres.');
    throw new Error(error.message);
  }
  // Com confirmação de e-mail ligada no Supabase, não há sessão até a pessoa clicar no link
  return { precisaConfirmar: !data.session };
}

export async function signOut() {
  contaCache = null;
  if (!cfg.demo) await supabase.auth.signOut();
}

/* ---------------- Requisições à API ---------------- */

async function request(path, { method = 'GET', body } = {}) {
  const session = await getSession();
  if (!session) {
    location.replace('index.html');
    throw new Error('Sessão expirada');
  }
  const r = await fetch(path, {
    method,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    await signOut();
    location.replace('index.html');
    throw new Error('Sessão expirada');
  }
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Acesso suspenso no meio do uso: volta para o painel, que mostra a tela de espera/bloqueio
    if (data.codigo === 'PENDENTE' || data.codigo === 'BLOQUEADO') location.replace('app.html');
    throw Object.assign(new Error(data.erro || `Erro ${r.status}`), { codigo: data.codigo, status: r.status });
  }
  return data;
}

export async function listarAlunos(competencia) {
  if (cfg.demo) return demo.listar(competencia);
  const { alunos } = await request(`/api/alunos?competencia=${competencia}`);
  return alunos;
}

export const criarAluno = (dados) => (cfg.demo ? demo.criar(dados) : request('/api/alunos', { method: 'POST', body: dados }));
export const atualizarAluno = (id, dados) =>
  cfg.demo ? demo.atualizar(id, dados) : request(`/api/alunos/${id}`, { method: 'PUT', body: dados });
export const excluirAluno = (id) => (cfg.demo ? demo.excluir(id) : request(`/api/alunos/${id}`, { method: 'DELETE' }));

export const marcarPago = (aluno_id, competencia) =>
  cfg.demo ? demo.pagar(aluno_id, competencia) : request('/api/pagamentos', { method: 'POST', body: { aluno_id, competencia } });
export const desfazerPagamento = (aluno_id, competencia) =>
  cfg.demo
    ? demo.desfazer(aluno_id, competencia)
    : request(`/api/pagamentos?aluno_id=${aluno_id}&competencia=${competencia}`, { method: 'DELETE' });

export const enviarLembretes = (competencia) =>
  cfg.demo ? demo.lembretes(competencia) : request('/api/lembretes', { method: 'POST', body: { competencia } });

/* ---------------- Conta, equipe e histórico ---------------- */

let contaCache = null;

/** Quem está logado: { id, nome, email, papel: 'admin'|'treinador', status: 'ativo'|'pendente'|'bloqueado' } */
export async function minhaConta() {
  contaCache = cfg.demo ? demo.conta() : await request('/api/conta');
  return contaCache;
}
export const contaAtual = () => contaCache;
export const ehAdmin = () => contaCache?.papel === 'admin';

export async function listarUsuarios() {
  return cfg.demo ? demo.listarUsuarios() : request('/api/usuarios');
}
export const atualizarUsuario = (id, dados) =>
  cfg.demo ? demo.atualizarUsuario(id, dados) : request(`/api/usuarios/${id}`, { method: 'PUT', body: dados });
export const removerUsuario = (id) => (cfg.demo ? demo.removerUsuario(id) : request(`/api/usuarios/${id}`, { method: 'DELETE' }));

/** Histórico paginado: { itens, proximo } — passe `antes: proximo` para a página seguinte. */
export async function listarAuditoria({ usuario = '', grupo = '', antes = '' } = {}) {
  if (cfg.demo) return demo.listarAuditoria({ usuario, grupo, antes });
  const q = new URLSearchParams();
  if (usuario) q.set('usuario', usuario);
  if (grupo) q.set('grupo', grupo);
  if (antes) q.set('antes', antes);
  return request(`/api/auditoria?${q}`);
}

/** Só no modo demonstração: simula outro perfil para testar as permissões. */
export function demoTrocarPerfil(valor) {
  demo.trocarPerfil(valor);
}

/* ---------------- Galeria ---------------- */

export async function listarMidias() {
  if (cfg.demo) return demo.listarMidias();
  const { midias } = await request('/api/midias');
  return midias;
}

/** Envia um arquivo direto ao Supabase Storage (URL assinada) e registra na galeria. */
export async function enviarMidia(arquivo, legenda) {
  if (cfg.demo) return demo.enviarMidia(arquivo, legenda);
  const up = await request('/api/midias/upload', { method: 'POST', body: { mime: arquivo.type, tamanho: arquivo.size } });
  const { error } = await supabase.storage.from(up.bucket).uploadToSignedUrl(up.caminho, up.token, arquivo, { contentType: arquivo.type });
  if (error) throw new Error(`Falha no envio: ${error.message}`);
  return request('/api/midias', { method: 'POST', body: { tipo: up.tipo, caminho: up.caminho, legenda } });
}

export const adicionarYoutube = (url, legenda) =>
  cfg.demo ? demo.adicionarYoutube(url, legenda) : request('/api/midias', { method: 'POST', body: { tipo: 'youtube', url, legenda } });
export const atualizarMidia = (id, legenda) =>
  cfg.demo ? demo.atualizarMidia(id, legenda) : request(`/api/midias/${id}`, { method: 'PUT', body: { legenda } });
export const excluirMidia = (id) => (cfg.demo ? demo.excluirMidia(id) : request(`/api/midias/${id}`, { method: 'DELETE' }));

/* ---------------- Links públicos ---------------- */

export async function listarLinks() {
  if (cfg.demo) return demo.listarLinks();
  const { links } = await request('/api/links');
  return links;
}
export const criarLink = (dados) => (cfg.demo ? demo.criarLink(dados) : request('/api/links', { method: 'POST', body: dados }));
export const atualizarLink = (id, dados) =>
  cfg.demo ? demo.atualizarLink(id, dados) : request(`/api/links/${id}`, { method: 'PUT', body: dados });
export const excluirLink = (id) => (cfg.demo ? demo.excluirLink(id) : request(`/api/links/${id}`, { method: 'DELETE' }));

/** Endereço que o treinador compartilha com os responsáveis. */
export function urlPublica(token) {
  if (cfg.demo) return new URL(`publico.html?t=${encodeURIComponent(token)}`, location.href).href;
  return `${location.origin}/publico?t=${encodeURIComponent(token)}`;
}

/** Dados da página pública (sem login). */
export async function obterPublico(token, competencia) {
  if (cfg.demo) return demo.publico(token, competencia);
  const q = competencia ? `?competencia=${competencia}` : '';
  const r = await fetch(`/api/publico/${encodeURIComponent(token)}${q}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.erro || 'Não foi possível abrir a página.'), { status: r.status });
  return data;
}

/* ---------------- Modo demonstração ---------------- */

const demo = (() => {
  const KEY = 'mdv-demo-v1';
  const wait = (ms = 180) => new Promise((r) => setTimeout(r, ms));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  let db;

  function comp(offset = 0) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function seed() {
    const y = new Date().getFullYear();
    const base = [
      ['Arthur Gabriel Souza', y - 8, 'Patrícia Souza'],
      ['Bernardo Lima', y - 10, 'Ricardo Lima'],
      ['Caio Henrique Alves', y - 12, 'Juliana Alves'],
      ['Davi Lucas Ferreira', y - 7, 'Marcos Ferreira'],
      ['Enzo Miguel Rocha', y - 9, 'Carla Rocha'],
      ['Gabriel Santos', y - 14, 'Fernanda Santos'],
      ['Heitor Barbosa', y - 11, 'Paulo Barbosa'],
      ['João Pedro Cavalcanti', y - 13, 'Luciana Cavalcanti'],
      ['Kauã Oliveira', y - 16, 'Sandra Oliveira'],
      ['Lucas Matheus Silva', y - 10, 'Adriana Silva'],
      ['Miguel Araújo', y - 6, 'Renata Araújo'],
      ['Nícolas Pereira', y - 15, 'José Pereira'],
      ['Pedro Henrique Costa', y - 12, 'Aline Costa'],
      ['Rafael Nascimento', y - 9, 'Cláudio Nascimento'],
    ];
    const alunos = base.map(([nome, ano, resp], i) => ({
      id: uid(),
      nome,
      data_nascimento: `${ano}-${String((i % 12) + 1).padStart(2, '0')}-${String((i * 3) % 27 + 1).padStart(2, '0')}`,
      responsavel: resp,
      telefone: `(81) 9${String(8100 + i * 37).padStart(4, '0')}-${String(1200 + i * 211).slice(0, 4)}`,
      email: `${resp.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}@email.com`,
      observacoes: i === 2 ? 'Goleiro. Treina terças e quintas.' : null,
      ativo: i !== 8,
      criado_em: new Date().toISOString(),
    }));
    const pagamentos = [];
    const atual = comp(0);
    const anterior = comp(-1);
    alunos.forEach((a, i) => {
      if (!a.ativo) return;
      if (i % 5 !== 3) pagamentos.push({ aluno_id: a.id, competencia: anterior, valor: 40, pago_em: new Date(Date.now() - 30 * 864e5).toISOString() });
      if ([0, 1, 4, 5, 7, 9, 10, 12].includes(i))
        pagamentos.push({ aluno_id: a.id, competencia: atual, valor: 40, pago_em: new Date(Date.now() - i * 864e5 * 0.4).toISOString() });
    });
    return { alunos, pagamentos };
  }

  // Imagens de exemplo geradas em SVG (a demo não depende de arquivos externos)
  function arte(titulo, a, b, cx, cy) {
    const listras = Array.from({ length: 9 }, (_, k) => `<rect x='${k * 96}' y='0' width='40' height='600' />`).join('');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs>
      <rect width='800' height='600' fill='url(#g)'/>
      <g fill='#3be36a' opacity='.16' transform='rotate(-12 400 300)'>${listras}</g>
      <rect x='0' y='470' width='800' height='130' fill='#0b5a26' opacity='.55'/>
      <g transform='translate(${cx} ${cy})'><circle r='92' fill='#fff'/><path d='M0-34 32-10 20 28h-40L-32-10Z' fill='#0e1233'/>
      <path d='M0-34V-92M32-10 88-28M20 28 54 74M-20 28-54 74M-32-10-88-28' stroke='#0e1233' stroke-width='6'/></g>
      <text x='44' y='548' font-family='Arial,Helvetica,sans-serif' font-size='40' font-weight='700' fill='#fff'>${titulo}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function seedExtras(s) {
    if (!s.midias) {
      const dias = (n) => new Date(Date.now() - n * 864e5).toISOString();
      s.midias = [
        ['Treino de finalização · Sub-11', '#1a1fd0', '#0c1150', 600, 250, 'Treino de finalização da turma Sub-11', 1],
        ['Campeões do torneio da Vila!', '#138a3a', '#0c1150', 200, 230, 'Campeões do torneio de bairro', 4],
        ['Aquecimento · Sub-9', '#2a30e6', '#138a3a', 560, 300, 'Aquecimento antes do jogo', 6],
        ['Foto oficial 2026', '#0c1150', '#1a1fd0', 400, 220, 'Foto oficial da temporada 2026', 12],
        ['Amistoso de sábado', '#1aa84a', '#1a1fd0', 620, 220, 'Amistoso contra a escolinha vizinha', 15],
        ['Goleiros em ação', '#1a1fd0', '#138a3a', 230, 260, 'Treino de goleiros', 20],
      ].map(([t, a, b, cx, cy, legenda, d]) => ({ id: uid(), tipo: 'foto', url: arte(t, a, b, cx, cy), thumb: null, legenda, criado_em: dias(d) }));
      s.midias.forEach((m) => (m.thumb = m.url));
    }
    if (!s.usuarios) {
      const d = (n) => new Date(Date.now() - n * 864e5).toISOString();
      s.usuarios = [
        { id: 'u-admin', nome: 'Railton', email: 'railton@meninosdavila.com', papel: 'admin', status: 'ativo', criado_em: d(60), ultimo_acesso: d(0) },
        { id: 'u-carlos', nome: 'Carlos Mendes', email: 'carlos@email.com', papel: 'treinador', status: 'ativo', criado_em: d(30), ultimo_acesso: d(1) },
        { id: 'u-joana', nome: 'Joana Ribeiro', email: 'joana@email.com', papel: 'treinador', status: 'ativo', criado_em: d(20), ultimo_acesso: d(3) },
        { id: 'u-novo', nome: 'Felipe Rocha', email: 'felipe@email.com', papel: 'treinador', status: 'pendente', criado_em: d(0.2), ultimo_acesso: null },
      ];
    }
    if (!s.auditoria) {
      const h = (n) => new Date(Date.now() - n * 36e5).toISOString();
      let id = 0;
      s.auditoria = [
        ['u-admin', 'Railton', 'usuario.aprovar', 'Aprovou o cadastro de Joana Ribeiro como treinador', 480],
        ['u-carlos', 'Carlos Mendes', 'aluno.criar', 'Cadastrou o aluno Rafael Nascimento', 200],
        ['u-joana', 'Joana Ribeiro', 'midia.enviar', 'Adicionou uma foto à galeria — "Treino de goleiros"', 90],
        ['u-carlos', 'Carlos Mendes', 'pagamento.marcar', 'Marcou como paga a mensalidade de outubro/2026 — Bernardo Lima', 50],
        ['u-admin', 'Railton', 'link.criar', 'Gerou o link público "Meninos da Vila FC · Responsáveis"', 30],
        ['u-joana', 'Joana Ribeiro', 'pagamento.marcar', 'Marcou como paga a mensalidade de novembro/2026 — Arthur Gabriel Souza', 6],
      ].map(([usuario_id, usuario_nome, acao, descricao, horas]) => ({ id: ++id, usuario_id, usuario_nome, acao, descricao, criado_em: h(horas) }));
    }
    if (!s.links) {
      s.links = [{ id: uid(), token: 'demo-responsaveis-2026', titulo: 'Meninos da Vila FC · Responsáveis', ativo: true, nome_completo: false, expira_em: null, acessos: 37, criado_em: new Date(Date.now() - 9 * 864e5).toISOString() }];
    }
    return s;
  }

  const PERFIL_KEY = 'mdv-demo-perfil';
  let perfilDemo = 'admin';
  try { perfilDemo = localStorage.getItem(PERFIL_KEY) || 'admin'; } catch {}

  function usuarioDemo() {
    const s = load();
    if (perfilDemo === 'treinador') return s.usuarios.find((u) => u.id === 'u-carlos');
    if (perfilDemo === 'pendente') return { id: 'u-visitante', nome: 'Visitante', email: 'visitante@email.com', papel: 'treinador', status: 'pendente' };
    return s.usuarios.find((u) => u.id === 'u-admin');
  }
  function exigirAdmin() {
    if (perfilDemo !== 'admin') throw Object.assign(new Error('Apenas administradores podem fazer isso.'), { codigo: 'SEM_PERMISSAO' });
  }
  function log(acao, descricao) {
    const s = load();
    const u = usuarioDemo();
    const id = (s.auditoria.reduce((m, a) => Math.max(m, a.id), 0) || 0) + 1;
    s.auditoria.push({ id, usuario_id: u.id, usuario_nome: u.nome, acao, descricao, criado_em: new Date().toISOString() });
  }
  const MESES_DEMO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const mesExt = (c) => `${MESES_DEMO[Number(c.slice(5)) - 1]}/${c.slice(0, 4)}`;
  const nomeAluno = (id) => load().alunos.find((a) => a.id === id)?.nome || 'aluno';

  function load() {
    if (db) return db;
    try {
      const s = localStorage.getItem(KEY);
      if (s) db = JSON.parse(s);
    } catch {}
    if (!db) db = seed();
    seedExtras(db);
    save();
    return db;
  }
  function save() {
    // vídeos da demo usam URL temporária do navegador: não dá para salvar
    try { localStorage.setItem(KEY, JSON.stringify({ ...db, midias: db.midias.filter((m) => !m.temporario) })); } catch {}
  }

  const lerComoDataUrl = (arquivo) =>
    new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => falha(new Error('Não foi possível ler o arquivo.'));
      r.readAsDataURL(arquivo);
    });

  function categoria(dn) {
    if (!dn) return null;
    const anos = new Date().getFullYear() - Number(dn.slice(0, 4));
    for (const x of [7, 9, 11, 13, 15, 17, 20]) if (anos < x) return `Sub-${x}`;
    return 'Adulto';
  }
  function nomePublico(nome, completo) {
    if (completo) return nome;
    const p = nome.trim().split(/\s+/);
    return p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}.` : p[0];
  }

  return {
    async listar(c) {
      await wait();
      const { alunos, pagamentos } = load();
      return alunos
        .map((a) => ({ ...a, pagamento: pagamentos.find((p) => p.aluno_id === a.id && p.competencia === c) || null }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
    async criar(d) {
      await wait();
      const a = { id: uid(), ativo: true, criado_em: new Date().toISOString(), ...d };
      load().alunos.push(a);
      log('aluno.criar', `Cadastrou o aluno ${a.nome}`);
      save();
      return a;
    },
    async atualizar(id, d) {
      await wait();
      const a = load().alunos.find((x) => x.id === id);
      const mudouStatus = 'ativo' in d && d.ativo !== a.ativo;
      Object.assign(a, d);
      log(mudouStatus ? 'aluno.status' : 'aluno.editar', mudouStatus ? `${a.ativo ? 'Reativou' : 'Inativou'} o aluno ${a.nome}` : `Editou os dados de ${a.nome}`);
      save();
      return a;
    },
    async excluir(id) {
      await wait();
      exigirAdmin();
      log('aluno.excluir', `Excluiu o aluno ${nomeAluno(id)} e seu histórico de pagamentos`);
      const s = load();
      s.alunos = s.alunos.filter((a) => a.id !== id);
      s.pagamentos = s.pagamentos.filter((p) => p.aluno_id !== id);
      save();
    },
    async pagar(aluno_id, competencia) {
      await wait(120);
      const s = load();
      s.pagamentos = s.pagamentos.filter((p) => !(p.aluno_id === aluno_id && p.competencia === competencia));
      s.pagamentos.push({ aluno_id, competencia, valor: cfg.mensalidade, pago_em: new Date().toISOString() });
      log('pagamento.marcar', `Marcou como paga a mensalidade de ${mesExt(competencia)} — ${nomeAluno(aluno_id)}`);
      save();
    },
    async desfazer(aluno_id, competencia) {
      await wait(120);
      const s = load();
      s.pagamentos = s.pagamentos.filter((p) => !(p.aluno_id === aluno_id && p.competencia === competencia));
      log('pagamento.desfazer', `Desfez o pagamento de ${mesExt(competencia)} — ${nomeAluno(aluno_id)}`);
      save();
    },
    async lembretes(c) {
      await wait(600);
      exigirAdmin();
      const lista = await this.listar(c);
      const n = lista.filter((a) => a.ativo && !a.pagamento && a.email).length;
      log('lembretes.enviar', `Enviou ${n} lembretes de mensalidade de ${mesExt(c)} (demonstração)`);
      save();
      return { enviados: lista.filter((a) => a.ativo && !a.pagamento && a.email).length, competencia: c, demo: true };
    },

    /* galeria */
    async listarMidias() {
      await wait();
      return [...load().midias].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    },
    async enviarMidia(arquivo, legenda) {
      await wait(500);
      const video = arquivo.type.startsWith('video/');
      const url = video ? URL.createObjectURL(arquivo) : await lerComoDataUrl(arquivo);
      const m = { id: uid(), tipo: video ? 'video' : 'foto', url, thumb: video ? null : url, legenda: legenda || null, criado_em: new Date().toISOString(), temporario: video, enviado_por: usuarioDemo().id };
      load().midias.push(m);
      log('midia.enviar', `Adicionou ${video ? 'um vídeo' : 'uma foto'} à galeria${legenda ? ` — "${legenda}"` : ''}`);
      save();
      return m;
    },
    async adicionarYoutube(url, legenda) {
      await wait();
      const id = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1];
      if (!id) throw new Error('Link do YouTube inválido.');
      const m = { id: uid(), tipo: 'youtube', youtubeId: id, url: `https://www.youtube.com/watch?v=${id}`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, legenda: legenda || null, criado_em: new Date().toISOString(), enviado_por: usuarioDemo().id };
      load().midias.push(m);
      log('midia.enviar', `Adicionou um vídeo do YouTube à galeria${legenda ? ` — "${legenda}"` : ''}`);
      save();
      return m;
    },
    async atualizarMidia(id, legenda) {
      await wait();
      const m = load().midias.find((x) => x.id === id);
      if (perfilDemo !== 'admin' && m.enviado_por !== usuarioDemo().id) throw new Error('Você só pode alterar fotos e vídeos que você mesmo enviou.');
      m.legenda = legenda || null;
      log('midia.editar', `Alterou a legenda de uma mídia para "${legenda || 'sem legenda'}"`);
      save();
      return m;
    },
    async excluirMidia(id) {
      await wait();
      const s = load();
      const m = s.midias.find((x) => x.id === id);
      if (m && perfilDemo !== 'admin' && m.enviado_por !== usuarioDemo().id) throw new Error('Você só pode alterar fotos e vídeos que você mesmo enviou.');
      if (m) log('midia.excluir', `Excluiu ${m.tipo === 'foto' ? 'uma foto' : 'um vídeo'} da galeria${m.legenda ? ` — "${m.legenda}"` : ''}`);
      s.midias = s.midias.filter((m) => m.id !== id);
      save();
    },

    /* links */
    async listarLinks() {
      await wait();
      exigirAdmin();
      return [...load().links].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    },
    async criarLink(d) {
      await wait();
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const dias = Number(d.validade_dias) || 0;
      const l = { id: uid(), token, titulo: d.titulo || null, ativo: true, nome_completo: !!d.nome_completo, expira_em: dias ? new Date(Date.now() + dias * 864e5).toISOString() : null, acessos: 0, criado_em: new Date().toISOString() };
      load().links.push(l);
      log('link.criar', `Gerou o link público "${l.titulo || 'sem título'}"`);
      save();
      return l;
    },
    async atualizarLink(id, d) {
      await wait(120);
      const l = load().links.find((x) => x.id === id);
      Object.assign(l, d);
      log('link.editar', `${'ativo' in d ? (d.ativo ? 'Reativou' : 'Desativou') : 'Alterou'} o link "${l.titulo || 'sem título'}"`);
      save();
      return l;
    },
    async excluirLink(id) {
      await wait();
      const s = load();
      const l = s.links.find((x) => x.id === id);
      if (l) log('link.excluir', `Excluiu o link público "${l.titulo || 'sem título'}"`);
      s.links = s.links.filter((l) => l.id !== id);
      save();
    },

    /* conta, equipe e histórico */
    conta() {
      const u = usuarioDemo();
      return { id: u.id, nome: u.nome, email: u.email, papel: u.papel, status: u.status };
    },
    trocarPerfil(v) {
      perfilDemo = ['admin', 'treinador', 'pendente'].includes(v) ? v : 'admin';
      try { localStorage.setItem(PERFIL_KEY, perfilDemo); } catch {}
    },
    async listarUsuarios() {
      await wait();
      exigirAdmin();
      const ordem = { pendente: 0, ativo: 1, bloqueado: 2 };
      const usuarios = [...load().usuarios].sort((a, b) => ordem[a.status] - ordem[b.status] || a.nome.localeCompare(b.nome, 'pt-BR'));
      return { usuarios, pendentes: usuarios.filter((u) => u.status === 'pendente').length };
    },
    async atualizarUsuario(id, d) {
      await wait();
      exigirAdmin();
      const s = load();
      if (id === usuarioDemo().id) throw new Error('Você não pode alterar o seu próprio acesso.');
      const u = s.usuarios.find((x) => x.id === id);
      const outrosAdmins = s.usuarios.filter((x) => x.id !== id && x.papel === 'admin' && x.status === 'ativo').length;
      if (u.papel === 'admin' && u.status === 'ativo' && ((d.papel && d.papel !== 'admin') || d.status === 'bloqueado') && !outrosAdmins)
        throw new Error('É preciso ter pelo menos um outro administrador ativo antes disso.');
      const antes = { ...u };
      Object.assign(u, d);
      const nomes = { admin: 'administrador', treinador: 'treinador' };
      if (antes.status === 'pendente' && u.status === 'ativo') log('usuario.aprovar', `Aprovou o cadastro de ${u.nome} como ${nomes[u.papel]}`);
      else {
        if (d.status && d.status !== antes.status) log(d.status === 'bloqueado' ? 'usuario.bloquear' : 'usuario.reativar', `${d.status === 'bloqueado' ? 'Bloqueou' : 'Reativou'} o acesso de ${u.nome}`);
        if (d.papel && d.papel !== antes.papel) log('usuario.papel', `Alterou ${u.nome} de ${nomes[antes.papel]} para ${nomes[d.papel]}`);
      }
      save();
      return u;
    },
    async removerUsuario(id) {
      await wait();
      exigirAdmin();
      const s = load();
      if (id === usuarioDemo().id) throw new Error('Você não pode remover a sua própria conta.');
      const u = s.usuarios.find((x) => x.id === id);
      log('usuario.remover', u.status === 'pendente' ? `Recusou o cadastro de ${u.nome}` : `Removeu a conta de ${u.nome}`);
      s.usuarios = s.usuarios.filter((x) => x.id !== id);
      save();
    },
    async listarAuditoria({ usuario, grupo, antes }) {
      await wait();
      exigirAdmin();
      let itens = [...load().auditoria].sort((a, b) => b.id - a.id);
      if (usuario) itens = itens.filter((a) => a.usuario_id === usuario);
      if (grupo) itens = itens.filter((a) => a.acao.startsWith(grupo + '.'));
      if (antes) itens = itens.filter((a) => a.id < Number(antes));
      const pagina = itens.slice(0, 30);
      return { itens: pagina, proximo: itens.length > 30 ? pagina[pagina.length - 1].id : null };
    },

    /* página pública */
    async publico(token, competencia) {
      await wait(350);
      const s = load();
      // Na demo, um link desconhecido abre com as regras padrão; um link desativado/expirado não abre.
      const link = s.links.find((l) => l.token === token) || { titulo: 'Meninos da Vila FC', ativo: true, nome_completo: false };
      if (!link.ativo || (link.expira_em && new Date(link.expira_em) < new Date()))
        throw Object.assign(new Error('Este link não está disponível. Peça um novo link ao treinador.'), { status: 404 });
      if (link.id) { link.acessos = (link.acessos || 0) + 1; save(); }
      const atual = comp(0);
      const minimo = comp(-11);
      let c = competencia || atual;
      if (c > atual || c < minimo) c = atual;
      const lista = s.alunos
        .filter((a) => a.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((a) => {
          const p = s.pagamentos.find((x) => x.aluno_id === a.id && x.competencia === c);
          return { nome: nomePublico(a.nome, link.nome_completo), categoria: categoria(a.data_nascimento), pago: !!p, pago_em: p?.pago_em || null };
        });
      const emDia = lista.filter((a) => a.pago).length;
      return {
        titulo: link.titulo || 'Meninos da Vila FC',
        competencia: c,
        competenciaAtual: atual,
        competenciaMinima: minimo,
        atualizadoEm: new Date().toISOString(),
        resumo: { total: lista.length, emDia, pendentes: lista.length - emDia },
        alunos: lista,
        midias: [...s.midias].sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
      };
    },
  };
})();
