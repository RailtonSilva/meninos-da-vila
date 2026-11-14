// Comandos customizados da suíte Meninos da Vila FC.
//
// Todos os testes rodam no MODO DEMONSTRAÇÃO: o site é servido sem a pasta /api,
// então ele usa dados fictícios salvos no localStorage do navegador.
// O Cypress limpa o localStorage entre os testes, logo cada teste começa com os mesmos dados.

/**
 * Abre o painel já logado, simulando um perfil.
 * @param {'admin'|'treinador'|'pendente'} perfil
 * @param {string} hash  aba inicial, ex.: '#equipe'
 */
Cypress.Commands.add('abrirPainelComo', (perfil = 'admin', hash = '') => {
  cy.visit(`/app.html${hash}`, {
    onBeforeLoad(win) {
      win.localStorage.setItem('mdv-demo-perfil', perfil);
    },
  });
  // Trava de segurança: só continua se estiver mesmo no modo demonstração,
  // para nunca criar ou alterar dados reais da escolinha.
  cy.get('#demoBanner').should('be.visible');

  if (perfil === 'pendente') {
    cy.get('#telaEspera').should('be.visible');
  } else {
    cy.get('#userPapel').should('have.text', perfil === 'admin' ? 'Administrador' : 'Treinador');
  }
});

/** Espera a lista de alunos terminar de carregar (some o esqueleto de carregamento). */
Cypress.Commands.add('esperarLista', () => {
  cy.get('#lista .skeleton').should('not.exist');
  cy.get('#lista .row').should('have.length.greaterThan', 0);
});

/**
 * Lê os indicadores do topo do painel.
 * Retorna { ativos, emDia, pendentes, arrecadadoCentavos }.
 */
Cypress.Commands.add('lerIndicadores', () => {
  const numero = (sel) => cy.get(sel).invoke('text').then((t) => Number(t.trim()));
  const ind = {};
  return numero('#kAtivos')
    .then((v) => (ind.ativos = v))
    .then(() => numero('#kEmDia'))
    .then((v) => (ind.emDia = v))
    .then(() => numero('#kPend'))
    .then((v) => (ind.pendentes = v))
    // "R$ 320,00" → 32000 centavos (o espaço do formato brasileiro é especial, então pegamos só os dígitos)
    .then(() => cy.get('#kArrecadado').invoke('text'))
    .then((t) => (ind.arrecadadoCentavos = Number(t.replace(/\D/g, ''))))
    .then(() => ind);
});

/** Data de hoje no formato mostrado no painel (dd/mm). */
Cypress.Commands.add('hojeCurto', () =>
  cy.wrap(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))
);
