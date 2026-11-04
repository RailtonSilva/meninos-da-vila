import { randomUUID } from 'node:crypto';
import { route, readBody, HttpError } from '../../_lib/http.js';
import { db } from '../../_lib/supabase.js';
import { BUCKET, TIPOS_ARQUIVO } from '../../_lib/midias.js';

// POST /api/midias/upload { mime, tamanho } → URL assinada para o navegador enviar o arquivo
// direto ao Supabase Storage (sem passar pelo limite de 4,5 MB das funções da Vercel).
export default route({
  async POST(req, res) {
    const { mime, tamanho } = readBody(req);
    const info = TIPOS_ARQUIVO[mime];
    if (!info) throw new HttpError(400, 'Formato não suportado. Use JPG, PNG, WEBP, MP4, MOV ou WEBM.');
    if (!Number.isFinite(tamanho) || tamanho <= 0) throw new HttpError(400, 'Arquivo vazio.');
    if (tamanho > info.max) throw new HttpError(400, `Arquivo grande demais (máx. ${info.max / 1024 / 1024} MB).`);

    const agora = new Date();
    const caminho = `${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${info.ext}`;
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(caminho);
    if (error) throw new Error(`Storage: ${error.message}`);
    res.status(200).json({ caminho: data.path, token: data.token, tipo: info.tipo, bucket: BUCKET });
  },
});
