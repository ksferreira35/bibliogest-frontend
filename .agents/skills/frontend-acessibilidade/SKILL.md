---
name: frontend-acessibilidade
description: "Revisar acessibilidade, teclado, foco dos diálogos, contraste e redução de movimento."
---

# Frontend Acessibilidade

- Use `Accessibility.jsx`, `Modal.jsx` e o link de pular para o conteúdo. Preserve nomes acessíveis, foco visível e semântica HTML.
- Modal mantém foco dentro, torna o fundo inativo, fecha com Escape quando apropriado e devolve foco ao acionador. Não substitua por diálogos sem esses comportamentos.
- Preserve tamanho de fonte em rem, opções de ampliação, redução de movimento e alto contraste. Teste em ambos os temas, sem depender somente de cores para indicar estados.
- Cypress com axe-core verifica regras automatizáveis WCAG; complemente com teclado, zoom e revisão visual. Não afirme conformidade integral apenas com resultado de axe.

## Fluxo de trabalho e critérios de entrega

- Confira ordem de foco, nomes de controles, Esc e retorno do foco em diálogos. Preserve redução de movimento e ajuste de texto.
- Teste contraste no claro/escuro/alto contraste; verifique layout sem rolagem horizontal inesperada com zoom e viewport móvel.
- Use axe nas telas e diálogos afetados e faça revisão manual de teclado. Registre resultados sem confundir teste automatizado com certificação.

## Referência do projeto

Consulte [contexto técnico](references/contexto.md) para Acessibilidade, Cypress: fluxos no navegador. Use o [README do repositório](../../../README.md) e o código da branch atual como fontes de verdade.
