const user = {
  id: '00000000-0000-4000-8000-000000000002',
  nome: 'Pessoa',
  sobrenome: 'Teste',
  email: 'reader@example.test',
  ativo: true,
  bibliotecario: false,
  protegido: false,
}
function open(roles = ['ADMINISTRADOR']) {
  let profile = { ...user }
  cy.intercept('GET', '/config.dev.json', {
    keycloakUrl: 'https://login.example.test',
    realm: 'test',
    clientId: 'test',
    acervoUrl: '/acervo/api',
    reservasUrl: '/reservas/api',
    usuariosUrl: '/usuarios/api',
  })
  cy.intercept({ pathname: '/usuarios/api/**' }, (req) => {
    expect(req.headers.authorization).to.eq('Bearer fixture-token')
    const path = new URL(req.url).pathname
    if (path.endsWith('/auditoria'))
      return req.reply([
        {
          id: 'audit',
          ator: 'operador',
          alvo: user.id,
          acao: 'BIBLIOTECARIO',
          estado: 'SUCESSO',
          criada_em: '2026-11-25T10:00:00Z',
        },
      ])
    if (req.method === 'PUT') {
      if (path.endsWith('/bibliotecario'))
        profile.bibliotecario = req.body.valor
      if (path.endsWith('/ativo')) profile.ativo = req.body.valor
      return req.reply(204)
    }
    if (req.method === 'POST')
      return path.endsWith('/encerrar-sessoes')
        ? req.reply(204)
        : req.reply({
            statusCode: 201,
            body: { ...user, ...req.body, senhaTemporaria: undefined },
          })
    return req.reply(path.endsWith(user.id) ? profile : [profile])
  }).as('users')
  cy.visit('/', {
    onBeforeLoad(win) {
      win.__testRoles = roles
    },
  })
}
function audit() {
  cy.injectAxe()
  cy.checkA11y(null, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  })
}
describe('Administração de contas', () => {
  it('administra contas com confirmação, sem conceder administração do acervo', () => {
    open()
    cy.contains('h1', 'Usuários da biblioteca').should('be.visible')
    cy.contains('button', 'Gestão do acervo').should('not.exist')
    cy.contains('button', 'Balcão').should('not.exist')
    cy.contains('reader@example.test').should('be.visible')
    audit()
    cy.contains('button', 'Gerenciar conta').click()
    cy.contains('button', 'Promover a bibliotecário').click()
    cy.contains('button', 'Confirmar alteração').click()
    cy.get('[role="status"]').should('contain.text', 'concluído')
    cy.contains('button', 'Gerenciar conta').should('not.be.disabled').click()
    cy.contains('button', 'Remover função de bibliotecário').should(
      'be.visible',
    )
    audit()
    cy.get('button[aria-label="Fechar conta"]').click()
    cy.contains('button', 'Histórico de ações').click()
    cy.contains('BIBLIOTECARIO · SUCESSO').should('be.visible')
    audit()
  })
  it('cria leitor e não persiste a senha no navegador', () => {
    open()
    cy.contains('button', 'Criar conta').should('not.be.disabled').click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('label', /^Nome$/)
        .find('input')
        .type('Nova')
      cy.contains('label', 'Sobrenome').find('input').type('Pessoa')
      cy.contains('label', 'E-mail').find('input').type('new@example.test')
      cy.contains('label', 'Senha temporária')
        .find('input')
        .type('temporary-test-only', { log: false })
    })
    audit()
    cy.contains('button', 'Criar usuário').click()
    cy.get('[role="status"]').should('contain.text', 'Conta criada')
    cy.window().then((win) =>
      expect(JSON.stringify(win.localStorage)).not.to.contain(
        'temporary-test-only',
      ),
    )
  })
  it('mantém o painel utilizável em tela pequena', () => {
    cy.viewport(390, 844)
    open()
    cy.contains('reader@example.test').should('be.visible')
    cy.document().then((doc) =>
      expect(doc.documentElement.scrollWidth).to.be.at.most(390),
    )
    audit()
  })
})
