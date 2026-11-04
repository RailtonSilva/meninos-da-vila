# Meninos da Vila FC — Gestão de alunos e mensalidades

Sistema da escolinha para cadastrar alunos e controlar quem está em dia com a mensalidade de **R$ 40,00**.

| Serviço | Papel |
|---|---|
| **GitHub** | Versionamento |
| **Vercel** | Hospedagem do front + API Node.js (`/api`) + cron mensal |
| **Cloudflare** | Domínio, DNS e proteção |
| **Supabase** | Banco de dados (PostgreSQL) e login |
| **Resend** | E-mails de lembrete de mensalidade |
| **Sentry** | Monitoramento de erros (front e API) |

## O que o sistema faz

- Login com dois perfis, **Administrador** e **Treinador**, e **cadastro livre com aprovação**: quem cria conta fica bloqueado até um administrador aprovar.
- **Equipe:** aprovar ou recusar cadastros, trocar o papel, bloquear, reativar e remover contas.
- **Histórico:** registro de quem fez o quê e quando (pagamentos, alunos, galeria, links, equipe), com filtros por pessoa e por tipo de ação.
- Cadastro, edição, inativação e exclusão de alunos, com responsável, WhatsApp, e-mail e observações.
- Categoria calculada pela data de nascimento (Sub-7, Sub-9, … Sub-17).
- Painel por mês: ativos, em dia, pendentes, valor arrecadado e previsto.
- Marcar ou desfazer o pagamento do mês com um clique.
- Botão de cobrança no WhatsApp, com mensagem pronta, para quem está pendente.
- Lembrete por e-mail para os pendentes: pelo botão do painel e automático todo dia 10 (Vercel Cron).
- Busca, filtros (todos, em dia, pendentes, inativos) e filtro por categoria.
- **Galeria:** envio de fotos e vídeos (arrastar e soltar ou escolher no celular), vídeos do YouTube, legendas e visualizador em tela cheia. Fotos grandes são reduzidas automaticamente antes do envio.
- **Link público para os responsáveis:** o treinador gera um link de acesso livre (sem login) com a lista de alunos ativos, quem está em dia com a data do pagamento, quem está pendente e a galeria. É possível copiar, enviar pelo WhatsApp, definir validade, desativar e excluir.
### Quem pode fazer o quê

| Ação | Treinador | Administrador |
|---|:---:|:---:|
| Ver alunos e mensalidades | ✅ | ✅ |
| Cadastrar e editar alunos | ✅ | ✅ |
| Marcar e desfazer pagamentos | ✅ | ✅ |
| Enviar fotos e vídeos | ✅ | ✅ |
| Editar ou excluir mídia | só as suas | todas |
| Excluir alunos | — | ✅ |
| Enviar lembretes por e-mail | — | ✅ |
| Links públicos | — | ✅ |
| Equipe (aprovar, bloquear, papéis) | — | ✅ |
| Histórico | — | ✅ |

As permissões são conferidas **na API** (`api/_lib/supabase.js → exigirAcesso`), não só escondidas na tela. Regras de segurança:
- **Você não altera o próprio acesso:** ninguém consegue mudar o próprio papel ou se bloquear.
- **Sempre há um administrador:** a escolinha nunca fica sem pelo menos um administrador ativo.
- **Conta pendente ou bloqueada:** recebe `403` em todas as rotas e vê uma tela de espera.
- **Avisos por e-mail:** os administradores recebem um aviso de cada novo cadastro, e a pessoa recebe outro quando é aprovada (via Resend, se configurado).

### Privacidade do link público
A página expõe dados de crianças a quem tiver o link, então ela vem protegida por padrão:
- **Nomes:** abreviados ("Arthur S."); o nome completo é opcional, link a link.
- **Dados que nunca aparecem:** telefone, e-mail, data de nascimento e observações.
- **Token do link:** 24 caracteres aleatórios. O link pode ser desativado ou excluído na hora e pode ter validade.
- **Buscadores:** a página não é indexada (`noindex`).

Recomendado: avise os responsáveis e peça o consentimento deles (LGPD) antes de compartilhar fotos e nomes.

- **Modo demonstração:** sem backend configurado (abrindo com o Live Server, por exemplo), o sistema roda com dados fictícios para você ver o visual.

## Estrutura

```
public/               → front-end estático (servido pela Vercel)
  index.html          → login e criação de conta
  app.html            → painel (abas Mensalidades, Galeria, Link público e Equipe)
  publico.html        → página dos responsáveis (abre com ?t=TOKEN)
  css/style.css
  js/api.js           → camada de dados (API real ou modo demonstração)
  js/ui.js            → avisos, confirmação, visualizador de fotos e vídeos
  js/login.js, js/app.js, js/galeria.js, js/links.js, js/equipe.js, js/publico.js
  img/escudo.jpg
api/                  → funções serverless Node.js (Vercel)
  config.js           → configuração pública para o navegador
  conta.js            → quem está logado (papel e situação)
  usuarios/           → equipe: listar, aprovar, bloquear, mudar papel, remover
  auditoria.js        → histórico de ações (paginado, com filtros)
  alunos/index.js     → GET lista do mês · POST cadastra
  alunos/[id].js      → PUT edita · DELETE exclui
  pagamentos.js       → POST marca pago · DELETE desfaz
  lembretes.js        → envia e-mails (botão ou cron)
  midias/             → galeria (URL de envio assinada, cadastro, legenda, exclusão)
  links/              → links públicos (gerar, ativar/desativar, excluir)
  publico/[token].js  → dados da página dos responsáveis (sem login)
  _lib/               → Supabase + controle de acesso, histórico, e-mail, Sentry, validação
supabase/schema.sql   → tabelas, segurança e bucket da galeria (instalação nova)
supabase/002_compartilhamento.sql → link público e galeria (para quem já rodou o schema antes)
supabase/003_acesso.sql → perfis, aprovação e histórico (para quem já rodou o schema antes)
vercel.json           → pasta pública, cron, cabeçalhos de segurança
```

**Segurança:** o navegador nunca acessa as tabelas direto. As tabelas têm RLS ligado e nenhuma política pública. Toda operação passa pela API, que confere o token de login e só então usa a `service_role` (que fica apenas na Vercel).

---

## Passo a passo

### 1. Ver o visual agora (sem configurar nada)
Abra a pasta no VS Code e rode o Live Server na pasta `public`, ou execute `npm run demo`. Qualquer e-mail e senha entram no modo demonstração. Na faixa verde do topo, **"Ver como"** troca entre Administrador, Treinador e Cadastro pendente, para testar as permissões.

### 2. Supabase
1. Crie um projeto em supabase.com.
2. Em **SQL Editor**, rode o arquivo `supabase/schema.sql`. Ele já cria o bucket `galeria` no Storage.
   *Já tinha rodado uma versão anterior?* Rode só os arquivos novos, em ordem: `002_compartilhamento.sql` (se ainda não rodou) e depois `003_acesso.sql`. Quem já tinha login vira **administrador** automaticamente.
   ⚠️ Rode sempre pelo **SQL Editor do painel do Supabase**. Algumas extensões e ferramentas não entendem `create function` e dão erro de "sql parser".
3. Em **Authentication → Users → Add user**, crie o seu usuário (e-mail e senha) e marque *Auto Confirm User*. Numa instalação nova, **o primeiro usuário vira administrador automaticamente**.
4. Em **Authentication → Sign In / Providers**, deixe **Allow new users to sign up** LIGADO e **Confirm email** ligado. Ninguém acessa nada sem a sua aprovação, porque as contas novas nascem como pendentes.
5. Em **Authentication → URL Configuration**, coloque o endereço do site em **Site URL** (ex.: `https://meninosdavila.com.br`) e adicione o mesmo endereço em **Redirect URLs**. É para onde o link de confirmação de e-mail leva.
6. *(Recomendado)* Em **Authentication → Emails → SMTP Settings**, use o Resend como SMTP (host `smtp.resend.com`, porta `465`, usuário `resend`, senha = sua API key do Resend). O e-mail padrão do Supabase tem limite de poucos envios por hora.
7. Em **Project Settings → API**, copie a `URL`, a chave `anon` e a `service_role`.

### 3. GitHub
```bash
git init -b main
git add .
git commit -m "Sistema Meninos da Vila"
git remote add origin https://github.com/SEU_USUARIO/meninos-da-vila.git
git push -u origin main
```
Confira que o `.env` **não** subiu: ele está no `.gitignore`.

### 4. Vercel
1. Clique em **Add New → Project** e importe o repositório. Framework Preset: **Other**.
2. Em **Environment Variables**, cadastre todas as variáveis do `.env.example`.
3. Faça o deploy. O `vercel.json` já aponta a pasta `public` e cria o cron do dia 10.

Para rodar localmente com a API: `npm i -g vercel`, depois `npm install`, depois `vercel dev`. Use um arquivo `.env` com as variáveis.

### 5. Resend
1. Em resend.com, vá em **Domains → Add Domain** e adicione o seu domínio (ex.: `meninosdavila.com.br`).
2. Copie os registros DNS (SPF, DKIM) para o Cloudflare, como **DNS only**, e aguarde a verificação.
3. Crie uma API key e configure `RESEND_API_KEY` e `EMAIL_FROM` na Vercel. A `PIX_CHAVE` é opcional e aparece no e-mail.

### 6. Cloudflare (domínio e DNS)
1. Na Vercel, vá em **Settings → Domains** e adicione o seu domínio e o `www`.
2. No Cloudflare, em **DNS**, crie o que a Vercel pedir. Normalmente:
   - `A` · `@` → `76.76.21.21`
   - `CNAME` · `www` → `cname.vercel-dns.com`
3. Deixe esses registros como **DNS only (nuvem cinza)**, como a Vercel recomenda. Ela emite o SSL e já tem proteção própria. Se preferir o proxy laranja do Cloudflare, use **SSL/TLS → Full (strict)**.

### 7. Sentry
1. Crie um projeto **Node.js** e um projeto **Browser JavaScript**, ou use só um.
2. Configure `SENTRY_DSN` (API) e `SENTRY_DSN_FRONTEND` (navegador) na Vercel.

### 8. Cron de lembretes
Gere um segredo com `openssl rand -hex 32` e configure em `CRON_SECRET`. A Vercel chama `/api/lembretes` todo dia 10, às 9h de Brasília, enviando esse segredo.

---

## API

Todas as rotas exigem `Authorization: Bearer <token do Supabase>` e uma conta **ativa**, exceto `/api/config`, `/api/publico` e `/api/conta`. *(admin)* = só administrador.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/config` | Configuração pública |
| GET | `/api/alunos?competencia=AAAA-MM` | Alunos + situação no mês |
| POST | `/api/alunos` | Cadastra aluno |
| PUT | `/api/alunos/:id` | Atualiza aluno |
| DELETE | `/api/alunos/:id` | Exclui aluno e histórico |
| POST | `/api/pagamentos` | `{ aluno_id, competencia }` marca pago |
| DELETE | `/api/pagamentos?aluno_id=&competencia=` | Desfaz pagamento |
| POST | `/api/lembretes` | `{ competencia }` envia e-mails aos pendentes |
| GET | `/api/midias` | Galeria |
| POST | `/api/midias/upload` | `{ mime, tamanho }` gera URL assinada de envio |
| POST | `/api/midias` | Registra foto/vídeo enviado ou `{ tipo: 'youtube', url }` |
| PUT / DELETE | `/api/midias/:id` | Edita legenda / exclui (apaga também o arquivo) |
| GET / POST | `/api/links` | Lista / gera link público `{ titulo, nome_completo, validade_dias }` |
| PUT / DELETE | `/api/links/:id` | Ativa, desativa, troca nome completo / exclui |
| GET | `/api/publico/:token?competencia=` | **Sem login.** Dados da página dos responsáveis |
| GET | `/api/conta` | Quem está logado (funciona mesmo com cadastro pendente) |
| GET | `/api/usuarios` | Equipe *(admin)* |
| PUT | `/api/usuarios/:id` | `{ papel?, status? }` aprova, bloqueia, reativa, muda papel *(admin)* |
| DELETE | `/api/usuarios/:id` | Recusa cadastro ou remove conta *(admin)* |
| GET | `/api/auditoria?usuario=&grupo=&antes=` | Histórico paginado *(admin)* |

Respostas de acesso negado trazem um `codigo`: `SEM_LOGIN` (401), `PENDENTE`, `BLOQUEADO` ou `SEM_PERMISSAO` (403).

**Limites da galeria:** fotos até 15 MB e vídeos até 50 MB (limite por arquivo do plano gratuito do Supabase). Para vídeos maiores, use um link do YouTube; pode ser "não listado".
