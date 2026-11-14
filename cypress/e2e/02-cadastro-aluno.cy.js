// CT-ALUNO — Cadastro e edição de alunos

describe('Cadastro de aluno', () => {
  // Nascido em 1º de janeiro de 10 anos atrás → 10 anos completos → categoria Sub-11
  const anoNascimento = new Date().getFullYear() - 10;

  beforeEach(() => {
    cy.abrirPainelComo('admin');
    cy.esperarLista();
  });

  it('CT-ALUNO-01 · cadastra um aluno com todos os dados', () => {
    cy.fixture('aluno').then((aluno) => {
      cy.lerIndicadores().then((antes) => {
        cy.get('#btnNovo').click();
        cy.get('#dlgAluno').should('be.visible');
        cy.get('#dlgTitulo').should('have.text', 'Novo aluno');

        cy.get('#formAluno [name=nome]').type(aluno.nome);
        cy.get('#formAluno [name=data_nascimento]').type(`${anoNascimento}-01-01`);
        cy.get('#catPreview').should('have.value', 'Sub-11 · 10 anos');
        cy.get('#formAluno [name=responsavel]').type(aluno.responsavel);
        cy.get('#formAluno [name=telefone]').type(aluno.telefone).should('have.value', aluno.telefoneFormatado);
        cy.get('#formAluno [name=email]').type(aluno.email);
        cy.get('#formAluno [name=observacoes]').type(aluno.observacoes);
        cy.get('#formAluno [name=ativo]').should('be.checked');
        cy.get('#btnSalvar').click();

        cy.get('#dlgAluno').should('not.be.visible');
        cy.contains('.toast', 'João entrou para o time!').should('be.visible');

        // Aparece na lista, com categoria e mensalidade pendente
        cy.get('#busca').type('Cypress');
        cy.get('#lista .row')
          .should('have.length', 1)
          .first()
          .should('contain', aluno.nome)
          .and('contain', 'Sub-11')
          .and('contain', aluno.responsavel)
          .and('contain', aluno.telefoneFormatado)
          .find('.pill.pend')
          .should('have.text', 'Pendente');

        // Os indicadores contam o novo aluno como ativo e pendente
        cy.lerIndicadores().then((depois) => {
          expect(depois.ativos, 'alunos ativos').to.eq(antes.ativos + 1);
          expect(depois.pendentes, 'pendentes').to.eq(antes.pendentes + 1);
        });
      });
    });
  });

  it('CT-ALUNO-02 · não salva sem o nome do aluno', () => {
    cy.get('#btnNovo').click();
    cy.get('#formAluno [name=responsavel]').type('Responsável sem aluno');
    cy.get('#btnSalvar').click();

    cy.get('#formErro').should('be.visible').and('have.text', 'Informe o nome do aluno.');
    cy.get('#dlgAluno').should('be.visible');
  });

  it('CT-ALUNO-03 · não salva com e-mail do responsável inválido', () => {
    cy.get('#btnNovo').click();
    cy.get('#formAluno [name=nome]').type('Aluno E-mail Inválido');
    cy.get('#formAluno [name=email]').type('email-sem-arroba');
    cy.get('#btnSalvar').click();

    cy.get('#formErro').should('be.visible').and('have.text', 'E-mail do responsável inválido.');
    cy.get('#dlgAluno').should('be.visible');
  });

  it('CT-ALUNO-04 · cancelar o cadastro não cria aluno', () => {
    cy.get('#lista .row').its('length').then((totalAntes) => {
      cy.get('#btnNovo').click();
      cy.get('#formAluno [name=nome]').type('Aluno Cancelado');
      cy.get('#formAluno [data-close]').contains('Cancelar').click();

      cy.get('#dlgAluno').should('not.be.visible');
      cy.get('#lista .row').should('have.length', totalAntes);
      cy.contains('#lista .row', 'Aluno Cancelado').should('not.exist');
    });
  });

  it('CT-ALUNO-05 · edita o responsável de um aluno existente', () => {
    cy.contains('#lista .row', 'Arthur Gabriel Souza').find('[data-action=editar]').click();

    cy.get('#dlgTitulo').should('have.text', 'Editar aluno');
    cy.get('#formAluno [name=nome]').should('have.value', 'Arthur Gabriel Souza');
    cy.get('#formAluno [name=responsavel]').clear().type('Responsável Atualizado');
    cy.get('#btnSalvar').click();

    cy.contains('.toast', 'Dados atualizados.').should('be.visible');
    cy.contains('#lista .row', 'Arthur Gabriel Souza').should('contain', 'Responsável Atualizado');
  });
});
