---
name: frontend-react
description: "Implementar telas, componentes e estado do frontend React do BiblioGest."
---

# Frontend React

- Consulte `src/App.jsx`, `src/components/`, `src/domain/` e `src/hooks/useSession.js` antes de criar abstrações. O frontend usa React 19, JavaScript com JSX e Vite; não tem backend próprio.
- Workspace mantém catálogo, reservas, gestão, balcão e usuários. Preserve a troca de área conforme a sessão e descarte estado administrativo quando a identidade ou as roles mudarem.
- Componentes de formulário recebem DTOs e callbacks; regras de apresentação de catálogo e circulação ficam nos módulos de domínio. Use texto renderizado pelo React, estados de carregamento, erro e vazio.
- Use Node.js 24 e `npm ci`; não altere contratos de APIs para acomodar uma tela sem coordenar os serviços.
