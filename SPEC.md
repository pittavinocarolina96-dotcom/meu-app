# Montador de Looks — Especificação (V1)

App para subir fotos de roupas que quero comprar (Shein e outras lojas), montar looks
com elas e decidir o que vale a pena comprar.

## Plataforma
- Web app para celular, instalável na tela inicial (PWA).
- Uso individual, sem login. Dados salvos no próprio aparelho.
- Lista típica: 30 a 100 peças, então precisa de busca e filtros.

## Entrada de peças
- **Principal:** print/foto da galeria.
- **Extra:** colar o link do produto (guardado para ir direto à compra; puxar dados do link é tentativa, sem garantia).
- Campos da peça: foto, categoria, cor(es), estilo, ocasião, estação, preço, link, loja, status.
- Categorias: parte de cima, parte de baixo, terceira peça (casaco/blazer/cardigã), sapatos, acessórios.
- Status: **quero** / **comprei** / **descartei**. "Comprei" continua nos looks; "descartei" sai.

## IA (opcional)
- Sem chave: preenchimento manual e combinação por regras (categoria + harmonia de cores + ocasião/estação).
- Com chave da Anthropic (colada nas configurações, salva só no aparelho): a IA lê o print
  (tipo, cor, estilo, preço) e sugere looks com uma explicação curta.
- Custo estimado: ~R$ 0,01–0,06 por foto analisada.

## Looks
- Gerados automaticamente (regras ou IA) **e** montados ou ajustados à mão.
- Look = cima + baixo (+ terceira peça opcional) + sapato (+ acessórios opcionais).
- Filtros: ocasião (trabalho, casual, festa, academia, viagem…), clima/estação, meu estilo/paleta.
- Perfil: cores que me favorecem e estilo preferido; pesam na sugestão.

## Visualização (prioridade da V1)
- **Galeria de looks bonita**, em estilo colagem/Pinterest, com o fundo das fotos removido.
- Salvar/favoritar looks.
- **Fase 2:** botão "ver no manequim" usando um gerador de imagens (precisa de outra chave, ex. OpenAI/Google).

## Otimização de compra
- **Ranking de peças:** quantos looks cada peça forma; destacar as que não combinam com nada.
- **Orçamento:** dado um valor máximo, sugerir o conjunto de peças que gera **mais looks por real**.

## Fora da V1
- Guarda-roupa existente (só peças a comprar).
- Contas, login e compartilhamento.
- Manequim/avatar (fase 2).
