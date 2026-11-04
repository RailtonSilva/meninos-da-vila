import { db } from './supabase.js';
import { youtubeId } from './validar.js';

export const BUCKET = 'galeria';

export const TIPOS_ARQUIVO = {
  'image/jpeg': { ext: 'jpg', tipo: 'foto', max: 15 * 1024 * 1024 },
  'image/png': { ext: 'png', tipo: 'foto', max: 15 * 1024 * 1024 },
  'image/webp': { ext: 'webp', tipo: 'foto', max: 15 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', tipo: 'video', max: 50 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', tipo: 'video', max: 50 * 1024 * 1024 },
  'video/webm': { ext: 'webm', tipo: 'video', max: 50 * 1024 * 1024 },
};

export const CAMINHO_VALIDO = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$/;

/** Formato entregue ao navegador (painel e página pública). */
export function midiaParaCliente(m) {
  const base = { id: m.id, tipo: m.tipo, legenda: m.legenda, criado_em: m.criado_em };
  if (m.tipo === 'youtube') {
    const id = youtubeId(m.url);
    return { ...base, youtubeId: id, url: `https://www.youtube.com/watch?v=${id}`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  const url = db().storage.from(BUCKET).getPublicUrl(m.caminho).data.publicUrl;
  return { ...base, url, thumb: m.tipo === 'foto' ? url : null };
}
