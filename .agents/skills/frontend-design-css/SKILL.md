---
name: frontend-design-css
description: "Modificar identidade CEUB, layouts responsivos, temas claro/escuro e componentes visuais com Tailwind e Materialize."
---

# Frontend Design Css

- Leia `src/frameworks.css`, `src/index.css` e `src/App.css`. Tailwind 4 fornece utilitários de layout pelo plugin do Vite, sem Preflight. Materialize 2 fornece botões preenchidos/contornados, cartões e tokens; React controla comportamento dos formulários e diálogos.
- Use variáveis CSS para superfícies, texto, bordas e destaques. Mantenha roxo/magenta e logotipo CEUB fornecido pelo projeto; o modo claro é o padrão, independente da preferência de cor do sistema.
- Preserve a preferência de tema em `bibliogest-theme`, o alto contraste separado e a legibilidade de estados de erro, botões inativos, banners e modal nos dois temas. Não introduza Bootstrap.
- Valide grade de catálogo, cabeçalho, formulários e paginação no desktop e em largura móvel. Preserve a versão de portfólio em sua branch; mudanças acadêmicas não exigem redesenhar o Keycloak.

## Fluxo de trabalho e critérios de entrega

- Trate CSS do tema acadêmico separadamente do tema de portfólio; use componentes e utilitários já disponíveis.
- Verifique superfícies, texto, foco, botões desabilitados e contraste nos modos claro, escuro e alto contraste; teste com preferência de sistema escura também.
- Revise desktop e celular, especialmente cabeçalho, grade de obras, diálogos e botões.

## Referência do projeto

Consulte [contexto técnico](references/contexto.md) para Edição acadêmica CEUB, Organização do frontend. Use o [README do repositório](../../../README.md) e o código da branch atual como fontes de verdade.
