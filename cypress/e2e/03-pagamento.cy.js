// CT-PAG — Marcar e desfazer pagamento de mensalidade (R$ 40,00)

describe('Pagamento de mensalidade', () => {
  const VALOR_CENTAVOS = 4000; // R$ 40,00

  beforeEach(() => {
    cy.abrirPainelComo('admin');
    cy.esperarLista();
  });

  /** Nome do primeiro aluno da lista atual. */
  const primeiroNome = () => cy.get('#lista .row').first().find('.aluno strong').invoke('text');

  it('CT-PAG-01 · marca como pago um aluno pendente e atualiza os indicadores', () => {
    cy.lerIndicadores().then((antes) => {
      cy.get('#filtros [data-f=pendentes]').click();
      primeiroNome().then((nome) => {
        cy.contains('#lista .row', nome).find('[data-action=pagar]').click();

        cy.contains('.toast', `Mensalidade de ${nome.split(' ')[0]} registrada`).should('be.visible');
        // Sai da lista de pendentes...
        cy.contains('#lista .row', nome).should('not.exist');

        // ...e aparece em "Em dia" com a data de hoje
        cy.get('#filtros [data-f=emdia]').click();
        cy.hojeCurto().then((hoje) => {
          cy.contains('#lista .row', nome).find('.pill.ok').should('have.text', `Pago · ${hoje}`);
        });

        cy.lerIndicadores().then((depois) => {
          expect(depois.emDia, 'em dia').to.eq(antes.emDia + 1);
          expect(depois.pendentes, 'pendentes').to.eq(antes.pendentes - 1);
          expect(depois.arrecadadoCentavos, 'arrecadado').to.eq(antes.arrecadadoCentavos + VALOR_CENTAVOS);
        });
      });
    });
  });

  it('CT-PAG-02 · desfaz um pagamento e o aluno volta a ficar pendente', () => {
    cy.get('#filtros [data-f=emdia]').click();
    primeiroNome().then((nome) => {
      cy.lerIndicadores().then((antes) => {
        cy.contains('#lista .row', nome).find('[data-action=desfazer]').click();

        cy.contains('.toast', 'Pagamento desfeito.').should('be.visible');
        cy.contains('#lista .row', nome).should('not.exist');
        cy.get('#filtros [data-f=pendentes]').click();
        cy.contains('#lista .row', nome).find('.pill.pend').should('have.text', 'Pendente');

        cy.lerIndicadores().then((depois) => {
          expect(depois.emDia).to.eq(antes.emDia - 1);
          expect(depois.pendentes).to.eq(antes.pendentes + 1);
          expect(depois.arrecadadoCentavos).to.eq(antes.arrecadadoCentavos - VALOR_CENTAVOS);
        });
      });
    });
  });

  it('CT-PAG-03 · o pagamento vale só para o mês marcado', () => {
    cy.get('#mesTitulo').invoke('text').then((mesAtual) => {
      cy.get('#filtros [data-f=pendentes]').click();
      primeiroNome().then((nome) => {
        cy.contains('#lista .row', nome).find('[data-action=pagar]').click();
        cy.contains('.toast', 'registrada').should('be.visible');

        // No mês seguinte, o mesmo aluno continua pendente
        cy.get('#mesProximo').click();
        cy.get('#mesTitulo').should('not.have.text', mesAtual);
        cy.get('#filtros [data-f=todos]').click();
        cy.contains('#lista .row', nome).find('.pill.pend').should('have.text', 'Pendente');

        // Voltando, continua pago
        cy.get('#mesAnterior').click();
        cy.get('#mesTitulo').should('have.text', mesAtual);
        cy.contains('#lista .row', nome).find('.pill.ok').should('exist');
      });
    });
  });

  it('CT-PAG-04 · aluno inativo não tem botão de pagamento', () => {
    cy.get('#filtros [data-f=inativos]').click();
    cy.get('#lista .row').should('have.length.greaterThan', 0).each(($row) => {
      cy.wrap($row).find('.pill.off').should('have.text', 'Inativo');
      cy.wrap($row).find('[data-action=pagar]').should('not.exist');
    });
  });

  it('CT-PAG-05 · o pagamento fica registrado no histórico', () => {
    cy.get('#filtros [data-f=pendentes]').click();
    primeiroNome().then((nome) => {
      cy.contains('#lista .row', nome).find('[data-action=pagar]').click();
      cy.contains('.toast', 'registrada').should('be.visible');

      cy.get('.tabs a[href="#equipe"]').click();
      cy.get('#equipeAbas [data-sub=historico]').click();
      cy.get('#listaHistorico .tl-item')
        .first()
        .should('contain', 'Marcou como paga a mensalidade')
        .and('contain', nome)
        .and('contain', 'Railton');
    });
  });
});
