# LookLab

App para subir prints das roupas que você quer comprar (Shein e outras lojas), montar looks com elas e comprar só o que combina.

**Endereço:** https://pittavinocarolina96-dotcom.github.io/meu-app/

## O que faz
- **Adicionar peças:** sobe prints da galeria, recorta a peça, remove o fundo e marca tipo, cor, preço, ocasião e clima.
- **Looks:** sugere combinações automaticamente (com filtro de ocasião e clima), deixa montar à mão e salvar os favoritos em colagem.
- **Comprar:** ranking das peças mais versáteis, as que não combinam com nada e o **carrinho ideal** (mais looks por real dentro de um orçamento).
- **IA opcional:** com uma chave da Anthropic, a IA lê o print sozinha (tipo, cor, preço, recorte) e monta looks com explicação.
- Cada pessoa usa no próprio celular. Os dados ficam só no aparelho, sem login. Dá para instalar na tela inicial ("Adicionar à tela de início").

## Publicação
Cada push na `main` publica no GitHub Pages pelo workflow `.github/workflows/deploy.yml`.
Na primeira vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Desenvolvimento
```bash
npm install
npm run dev     # servidor local
npm test        # testes das regras de combinação e orçamento
npm run build   # gera dist/
```

Veja `SPEC.md` para a especificação.
