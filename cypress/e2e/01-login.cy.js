// CT-LOGIN — Login, saída e criação de conta

describe('Login', () => {
  beforeEach(() => {
    cy.visit('/');
    // Garante o modo demonstração (trava de segurança) e que a página terminou de carregar
    cy.get('#demoNote').should('be.visible');
  });

  it('CT-LOGIN-01 · exibe a tela de login no modo demonstração', () => {
    cy.title().should('contain', 'Entrar');
    cy.get('#formLogin').should('be.visible');
    cy.get('#formLogin [name=email]').should('be.visible');
    cy.get('#formLogin [name=senha]').should('have.attr', 'type', 'password');
    cy.get('#demoNote').should('be.visible').and('contain', 'Modo demonstração');
  });

  it('CT-LOGIN-02 · não entra com e-mail e senha vazios', () => {
    cy.get('#formLogin [name=email]').clear();
    cy.get('#formLogin [name=senha]').clear();
    cy.get('#btnEntrar').click();

    cy.get('#erro').should('be.visible').and('have.text', 'Preencha e-mail e senha.');
    cy.location('pathname').should('not.include', 'app');
  });

  it('CT-LOGIN-03 · entra e abre o painel de mensalidades', () => {
    cy.get('#formLogin [name=email]').clear().type('treinador@meninosdavila.com');
    cy.get('#formLogin [name=senha]').clear().type('demo1234', { log: false });
    cy.get('#btnEntrar').click();

    cy.location('pathname').should('include', 'app');
    cy.get('#userPapel').should('have.text', 'Administrador');
    cy.get('#mesTitulo').should('be.visible').and('not.have.text', '—');
    cy.get('#lista .row').should('have.length.greaterThan', 0);
  });

  it('CT-LOGIN-04 · sai da conta e volta para a tela de login', () => {
    cy.get('#btnEntrar').click();
    cy.location('pathname').should('include', 'app');

    cy.get('#btnSair').click();

    cy.location('pathname').should('not.include', 'app');
    cy.get('#formLogin').should('be.visible');
  });

  context('Criar conta', () => {
    beforeEach(() => {
      cy.contains('.auth-tabs button', 'Criar conta').click();
      cy.get('#formCadastro').should('be.visible');
      cy.get('#formLogin').should('not.be.visible');
    });

    it('CT-LOGIN-05 · recusa senha com menos de 8 caracteres', () => {
      cy.get('#formCadastro [name=nome]').type('Treinador Teste');
      cy.get('#formCadastro [name=email]').type('treinador.teste@email.com');
      cy.get('#formCadastro [name=senha]').type('123', { log: false });
      cy.get('#formCadastro [name=senha2]').type('123', { log: false });
      cy.get('#btnCadastrar').click();

      cy.get('#erroCadastro').should('be.visible').and('have.text', 'A senha precisa ter pelo menos 8 caracteres.');
      cy.get('#cadastroOk').should('not.be.visible');
    });

    it('CT-LOGIN-06 · recusa senhas diferentes', () => {
      cy.get('#formCadastro [name=nome]').type('Treinador Teste');
      cy.get('#formCadastro [name=email]').type('treinador.teste@email.com');
      cy.get('#formCadastro [name=senha]').type('12345678', { log: false });
      cy.get('#formCadastro [name=senha2]').type('87654321', { log: false });
      cy.get('#btnCadastrar').click();

      cy.get('#erroCadastro').should('be.visible').and('have.text', 'As senhas não conferem.');
    });

    it('CT-LOGIN-07 · cadastro válido mostra a confirmação de envio', () => {
      cy.get('#formCadastro [name=nome]').type('Treinador Teste');
      cy.get('#formCadastro [name=email]').type('treinador.teste@email.com');
      cy.get('#formCadastro [name=senha]').type('12345678', { log: false });
      cy.get('#formCadastro [name=senha2]').type('12345678', { log: false });
      cy.get('#btnCadastrar').click();

      cy.get('#cadastroOk').should('be.visible').and('contain', 'Cadastro enviado!');
      cy.get('#formCadastro').should('not.be.visible');
    });
  });
});
