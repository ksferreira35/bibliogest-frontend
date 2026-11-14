import './App.css'

function App({ auth }) {
  const account = auth.keycloak
  const signedIn = account?.authenticated
  const redirectUri = `${window.location.origin}/`

  return (
    <main className="welcome">
      <h1>BiblioGest</h1>
      <p>Seu acervo e suas reservas em um só lugar.</p>
      {signedIn ? (
        <section aria-label="Sua conta">
          <h2>Olá, {account.tokenParsed?.name || account.tokenParsed?.preferred_username}</h2>
          <p>{account.hasRealmRole('BIBLIOTECARIO') ? 'Bibliotecário' : 'Leitor'}</p>
          <button type="button" onClick={() => account.logout({ redirectUri })}>Sair</button>
        </section>
      ) : auth.available ? (
        <nav aria-label="Acesso à conta">
          <button type="button" onClick={() => account.login({ redirectUri })}>Entrar</button>
          <button type="button" onClick={() => account.register({ redirectUri })}>Criar conta</button>
        </nav>
      ) : (
        <p role="status">O acesso à conta estará disponível em breve.</p>
      )}
    </main>
  )
}

export default App
