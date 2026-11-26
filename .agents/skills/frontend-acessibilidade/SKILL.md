---
name: frontend-acessibilidade
description: "Revisar acessibilidade, teclado, foco dos diálogos, contraste e redução de movimento."
---

# Frontend Acessibilidade

- Use `Accessibility.jsx`, `Modal.jsx` e o link de pular para o conteúdo. Preserve nomes acessíveis, foco visível e semântica HTML.
- Modal mantém foco dentro, torna o fundo inativo, fecha com Escape quando apropriado e devolve foco ao acionador. Não substitua por diálogos sem esses comportamentos.
- Preserve tamanho de fonte em rem, opções de ampliação, redução de movimento e alto contraste. Teste em ambos os temas, sem depender somente de cores para indicar estados.
- Cypress com axe-core verifica regras automatizáveis WCAG; complemente com teclado, zoom e revisão visual. Não afirme conformidade integral apenas com resultado de axe.
