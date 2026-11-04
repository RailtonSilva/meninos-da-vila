// Função ÚNICA da API.
//
// O plano gratuito (Hobby) da Vercel aceita no máximo 12 funções por deploy, e cada
// arquivo em /api conta como uma. Por isso todas as rotas ficam em api/_rotas/ (pastas
// que começam com "_" não viram funções) e este arquivo encaminha cada chamada.
// O vercel.json reescreve /api/qualquer-coisa → /api?__rota=qualquer-coisa.
//
// Para criar uma rota nova: escreva o arquivo em api/_rotas/ e adicione uma linha em ROTAS.

import config from './_rotas/config.js';
import conta from './_rotas/conta.js';
import alunos from './_rotas/alunos/index.js';
import aluno from './_rotas/alunos/[id].js';
import pagamentos from './_rotas/pagamentos.js';
import lembretes from './_rotas/lembretes.js';
import midias from './_rotas/midias/index.js';
import midiasUpload from './_rotas/midias/upload.js';
import midia from './_rotas/midias/[id].js';
import links from './_rotas/links/index.js';
import link from './_rotas/links/[id].js';
import publico from './_rotas/publico/[token].js';
import usuarios from './_rotas/usuarios/index.js';
import usuario from './_rotas/usuarios/[id].js';
import auditoria from './_rotas/auditoria.js';

// [padrão do caminho depois de /api/, handler, nomes dos parâmetros capturados]
// A ordem importa: "midias/upload" vem antes de "midias/:id".
const ROTAS = [
  [/^config$/, config],
  [/^conta$/, conta],
  [/^alunos$/, alunos],
  [/^alunos\/([^/]+)$/, aluno, ['id']],
  [/^pagamentos$/, pagamentos],
  [/^lembretes$/, lembretes],
  [/^midias$/, midias],
  [/^midias\/upload$/, midiasUpload],
  [/^midias\/([^/]+)$/, midia, ['id']],
  [/^links$/, links],
  [/^links\/([^/]+)$/, link, ['id']],
  [/^publico\/([^/]+)$/, publico, ['token']],
  [/^usuarios$/, usuarios],
  [/^usuarios\/([^/]+)$/, usuario, ['id']],
  [/^auditoria$/, auditoria],
];

/** Descobre o caminho pedido (ex.: "alunos/123"), venha ele da URL original ou do rewrite. */
function caminhoDaRota(req) {
  const doUrl = new URL(req.url || '/', 'http://local').pathname.replace(/^\/api\/?/, '');
  const doRewrite = req.query?.__rota;
  const bruto = doUrl && doUrl !== 'index' ? doUrl : Array.isArray(doRewrite) ? doRewrite.join('/') : doRewrite || '';
  return String(bruto).replace(/^\/+|\/+$/g, '');
}

export default async function handler(req, res) {
  req.query = { ...(req.query || {}) };
  const caminho = caminhoDaRota(req);
  delete req.query.__rota;

  for (const [padrao, rota, nomes = []] of ROTAS) {
    const m = caminho.match(padrao);
    if (!m) continue;
    nomes.forEach((nome, i) => {
      try { req.query[nome] = decodeURIComponent(m[i + 1]); } catch { req.query[nome] = m[i + 1]; }
    });
    return rota(req, res);
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(404).json({ erro: 'Rota da API não encontrada.' });
}
