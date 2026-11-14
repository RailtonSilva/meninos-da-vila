# Testes E2E (Cypress) — Meninos da Vila FC

Suíte de testes de ponta a ponta dos fluxos principais do painel.

## Estratégia

- **Ambiente:** o site roda em **modo demonstração** (`npm run demo`). Sem a pasta `/api`, o front usa dados fictícios no `localStorage`, então os testes são **repetíveis, não precisam de senha e nunca tocam os dados reais da escolinha**.
- **Isolamento:** o Cypress limpa o `localStorage` entre os testes, então cada caso começa com a mesma massa de dados (14 alunos, 1 inativo, parte com a mensalidade paga).
- **Trava de segurança:** o comando `cy.abrirPainelComo()` confere se a faixa de "Modo demonstração" está visível antes de continuar. Se alguém apontar a suíte para o site em produção, os testes param em vez de criar dados reais.
- **Perfis:** o modo demonstração permite simular **Administrador**, **Treinador** e **Cadastro pendente**, o que viabiliza os testes de permissão.
- **Asserções de negócio:** além da interface, os testes conferem os **indicadores** (alunos ativos, em dia, pendentes e valor arrecadado), por exemplo `+R$ 40,00` ao marcar um pagamento.

## Como rodar

```bash
# 1. Instale o Cypress (uma vez)
npm install --save-dev cypress

# 2. Terminal 1: suba o site em modo demonstração
npm run demo            # http://localhost:5500

# 3. Terminal 2: rode os testes
npx cypress open        # modo visual (escolha E2E → Chrome)
npx cypress run         # modo terminal (CI)
```

Para apontar para outro endereço local, defina `CYPRESS_BASE_URL`, por exemplo `CYPRESS_BASE_URL=http://localhost:3000 npx cypress run`.

> **Na Vercel:** como o Cypress vira dependência de desenvolvimento, crie a variável de ambiente `CYPRESS_INSTALL_BINARY=0` no projeto. Assim o deploy não baixa o executável do Cypress, que é pesado e não é usado lá.

## Casos de teste

| ID | Arquivo | Cenário | Resultado esperado |
|---|---|---|---|
| CT-LOGIN-01 | `01-login.cy.js` | Abrir a página inicial | Formulário de login visível, senha mascarada, aviso de modo demonstração |
| CT-LOGIN-02 | `01-login.cy.js` | Entrar com e-mail e senha vazios | Mensagem "Preencha e-mail e senha." e permanece no login |
| CT-LOGIN-03 | `01-login.cy.js` | Entrar com credenciais | Abre o painel, perfil "Administrador", mês e lista carregados |
| CT-LOGIN-04 | `01-login.cy.js` | Clicar em "Sair" | Volta para a tela de login |
| CT-LOGIN-05 | `01-login.cy.js` | Criar conta com senha de 3 caracteres | "A senha precisa ter pelo menos 8 caracteres." |
| CT-LOGIN-06 | `01-login.cy.js` | Criar conta com senhas diferentes | "As senhas não conferem." |
| CT-LOGIN-07 | `01-login.cy.js` | Criar conta com dados válidos | Tela "Cadastro enviado!" |
| CT-ALUNO-01 | `02-cadastro-aluno.cy.js` | Cadastrar aluno completo | Categoria Sub-11 calculada, máscara do WhatsApp, aluno na lista como "Pendente", indicadores +1 ativo e +1 pendente |
| CT-ALUNO-02 | `02-cadastro-aluno.cy.js` | Salvar sem nome | "Informe o nome do aluno." e o formulário continua aberto |
| CT-ALUNO-03 | `02-cadastro-aluno.cy.js` | Salvar com e-mail inválido | "E-mail do responsável inválido." |
| CT-ALUNO-04 | `02-cadastro-aluno.cy.js` | Preencher e cancelar | Nenhum aluno criado |
| CT-ALUNO-05 | `02-cadastro-aluno.cy.js` | Editar o responsável | "Dados atualizados." e a lista mostra o novo responsável |
| CT-PAG-01 | `03-pagamento.cy.js` | Marcar pendente como pago | Sai de "Pendentes", aparece "Pago · dd/mm" com a data de hoje, em dia +1, pendentes −1, arrecadado +R$ 40,00 |
| CT-PAG-02 | `03-pagamento.cy.js` | Desfazer um pagamento | Volta para "Pendente", em dia −1, arrecadado −R$ 40,00 |
| CT-PAG-03 | `03-pagamento.cy.js` | Pagar e trocar de mês | No mês seguinte continua pendente; ao voltar, continua pago |
| CT-PAG-04 | `03-pagamento.cy.js` | Filtrar inativos | Selo "Inativo" e nenhum botão de pagamento |
| CT-PAG-05 | `03-pagamento.cy.js` | Pagar e abrir o histórico | Primeira linha: "Marcou como paga a mensalidade" com o nome do aluno e o autor |
| CT-PERM-01 | `04-permissoes.cy.js` | Treinador abre o painel | Abas Equipe e Link público ocultas; Mensalidades e Galeria visíveis |
| CT-PERM-02 | `04-permissoes.cy.js` | Treinador acessa `#equipe` pela URL | Redirecionado para Mensalidades; dados da equipe não são carregados |
| CT-PERM-03 | `04-permissoes.cy.js` | Ações do treinador na lista | Sem "Excluir" e sem "Enviar lembretes"; pode cadastrar e marcar pagamento |
| CT-PERM-04 | `04-permissoes.cy.js` | Administrador abre Equipe | Vê cadastros pendentes e membros |
| CT-PERM-05 | `04-permissoes.cy.js` | Cadastro pendente abre o painel | Tela "Aguardando aprovação", nenhum dado da escolinha visível |

> As regras de permissão também são garantidas **no servidor**, independentemente da interface. Esses testes cobrem a camada visual. Para cobrir a API, a próxima etapa é uma coleção do Postman com as mesmas regras (ex.: treinador → `DELETE /api/alunos/:id` → **403**).

## Bugs encontrados pela suíte

| ID | Descrição | Severidade | Status |
|---|---|---|---|
| BUG-01 | **Máscara do WhatsApp embaralhava os dígitos ao digitar.** Passos: Novo aluno → digitar `81999990000` no WhatsApp. Esperado: `(81) 99999-0000`. Obtido: `(81) 9999-90`. Causa: ao reformatar o campo, o cursor saía da posição e o próximo dígito era inserido no meio. | Média: o número salvo ficava errado e a cobrança pelo WhatsApp ia para o contato errado | ✅ Corrigido em `public/js/app.js` (o cursor é reposicionado depois do mesmo dígito) |
| BUG-02 | **Clique em "Criar conta" se perdia logo após abrir a página.** Passos: abrir o login e clicar em "Criar conta" antes de a configuração (`/api/config`) terminar de carregar (internet lenta). Esperado: abrir o formulário de cadastro. Obtido: nada acontecia, e era preciso clicar de novo. Causa: os botões só eram ligados depois que a configuração carregava. Encontrado pelo CT-LOGIN-05, que falhou com `expected <form#formCadastro> to be visible`. | Baixa: incômodo, mas sem perda de dados | ✅ Corrigido em `public/js/login.js` (os botões são ligados antes de carregar a configuração) |

