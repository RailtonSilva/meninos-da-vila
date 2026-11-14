// CT-PERM — Treinador sem acesso à aba Equipe (e às demais áreas de administrador)

describe('Permissões por perfil', () => {
  context('Treinador', () => {
    it('CT-PERM-01 · não vê as abas Equipe e Link público', () => {
      cy.abrirPainelComo('treinador');

      cy.get('.tabs a[href="#equipe"]').should('not.be.visible');
      cy.get('.tabs a[href="#links"]').should('not.be.visible');
      cy.get('.tabs a[href="#mensalidades"]').should('be.visible');
      cy.get('.tabs a[href="#galeria"]').should('be.visible');
    });

    it('CT-PERM-02 · ao abrir #equipe pela URL, volta para Mensalidades', () => {
      cy.abrirPainelComo('treinador', '#equipe');

      cy.get('[data-view=equipe]').should('not.be.visible');
      cy.get('[data-view=mensalidades]').should('be.visible');
      cy.get('.tabs a[href="#mensalidades"]').should('have.class', 'on');
      cy.get('#listaMembros').should('be.empty');
    });

    it('CT-PERM-03 · não exclui alunos nem envia lembretes, mas marca pagamentos', () => {
      cy.abrirPainelComo('treinador');
      cy.esperarLista();

      cy.get('#lista [data-action=excluir]').should('not.exist');
      cy.get('#btnLembretes').should('not.be.visible');
      cy.get('#lista [data-action=pagar]').should('have.length.greaterThan', 0);
      cy.get('#btnNovo').should('be.visible');
    });
  });

  context('Administrador', () => {
    it('CT-PERM-04 · vê a aba Equipe e os cadastros aguardando aprovação', () => {
      cy.abrirPainelComo('admin');

      cy.get('.tabs a[href="#equipe"]').should('be.visible').click();
      cy.get('[data-view=equipe]').should('be.visible');
      cy.get('#listaPendentes .pendente').should('have.length.greaterThan', 0);
      cy.get('#listaMembros .row').should('have.length.greaterThan', 0);
    });
  });

  context('Cadastro pendente', () => {
    it('CT-PERM-05 · vê a tela de espera e nenhum dado da escolinha', () => {
      cy.abrirPainelComo('pendente');

      cy.get('#telaEspera').should('be.visible').and('contain', 'Aguardando aprovação');
      cy.get('main.container').should('not.be.visible');
      cy.get('.tabs').should('not.be.visible');
    });
  });
});
