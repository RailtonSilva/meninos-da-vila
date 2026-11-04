import { HttpError } from './errors.js';

const CAMPOS = ['nome', 'data_nascimento', 'responsavel', 'telefone', 'email', 'observacoes', 'ativo'];
const TEXTO = ['nome', 'responsavel', 'telefone', 'email', 'observacoes'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarAluno(body, { parcial = false } = {}) {
  const out = {};
  for (const k of CAMPOS) if (k in body) out[k] = body[k];

  for (const k of TEXTO) {
    if (k in out) out[k] = out[k] == null ? null : String(out[k]).trim().slice(0, k === 'observacoes' ? 1000 : 160) || null;
  }
  if (!parcial || 'nome' in out) {
    if (!out.nome || out.nome.length < 2) throw new HttpError(400, 'Informe o nome do aluno.');
  }
  if (out.email) {
    out.email = out.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new HttpError(400, 'E-mail do responsável inválido.');
  }
  if ('data_nascimento' in out) {
    if (!out.data_nascimento) out.data_nascimento = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(out.data_nascimento)) throw new HttpError(400, 'Data de nascimento inválida.');
  }
  if ('ativo' in out) out.ativo = Boolean(out.ativo);
  if (parcial && Object.keys(out).length === 0) throw new HttpError(400, 'Nada para atualizar.');
  return out;
}

export function validarId(id) {
  if (!UUID.test(String(id || ''))) throw new HttpError(400, 'Identificador inválido.');
  return id;
}

export function validarCompetencia(c) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(c || ''))) throw new HttpError(400, 'Competência inválida (use AAAA-MM).');
  return c;
}

/** Mês atual no fuso de Brasília, no formato AAAA-MM. */
export function competenciaAtual() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .slice(0, 7);
}

export function valorMensalidade() {
  const v = Number(process.env.MENSALIDADE_VALOR || 40);
  return Number.isFinite(v) && v >= 0 ? v : 40;
}

/** Soma n meses a uma competência AAAA-MM. */
export function compShift(c, n) {
  let [y, m] = c.split('-').map(Number);
  m += n;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Categoria pelo ano de nascimento (idade que o aluno completa no ano). */
export function categoria(dataNascimento) {
  if (!dataNascimento) return null;
  const anos = new Date().getFullYear() - Number(String(dataNascimento).slice(0, 4));
  for (const s of [7, 9, 11, 13, 15, 17, 20]) if (anos < s) return `Sub-${s}`;
  return 'Adulto';
}

/** Na página pública, por padrão só primeiro nome + inicial do último ("Arthur S."). */
export function nomePublico(nome, completo = false) {
  if (completo) return nome;
  const p = String(nome).trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}.` : p[0];
}

/** Extrai o ID de um link do YouTube (watch, youtu.be, shorts, embed). */
export function youtubeId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
