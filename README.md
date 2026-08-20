# 🧠 Estuda Aí — Gerador de Simulados com IA

Trabalho Prático 1 · Engenharia de Prompt e Contexto na Prática

> **Como preencher este README:** tudo que já dá pra escrever de antemão (system prompt, técnica,
> metodologia, fórmulas) está pronto. Os pontos marcados com **`⬜ EVIDÊNCIA:`** e **`⬜ PREENCHER:`**
> são as partes que **você** completa depois de rodar o app com a sua chave — são as chamadas reais,
> os números de token e os prints de tela. Sem esses prints, o item não pontua (ver seção 9 da rubrica).

---

## 1. O que o projeto faz e opção escolhida

**Opção escolhida:** projeto de estudo de outra disciplina do semestre (*Banco de Dados I*).

O **Estuda Aí** é uma ferramenta de estudo web. Você cola o material de uma matéria (resumo, capítulo,
anotações) e o app usa a API do **Gemini** para gerar um **simulado de múltipla escolha** com explicação
em cada questão. O objetivo é transformar material passivo de leitura em prática ativa de recuperação
(*active recall*), que é uma das formas de estudo mais eficazes.

Diferencial pensado para o trabalho: o app tem um **painel de log embutido** que registra, a cada chamada
à API, os **tokens de entrada e saída** (lidos do `usageMetadata` da resposta) e o **custo estimado**. Ou
seja, a própria ferramenta produz as evidências dos requisitos 4, 5 e 6, e tem um botão dedicado de
**Teste de Curadoria de Contexto** que atende o requisito 3.

**Como rodar/usar:** abra a URL publicada (seção 7), cole sua chave do Gemini no campo de configuração
(ela fica só no navegador, nunca vai pro repositório), carregue o material de exemplo ou cole o seu, e
clique em *Gerar simulado*.

---

## 2. System prompt usado (completo) — *requisito 1*

Definido e documentado **antes** de construir o app. Fica no arquivo [`app.js`](app.js) na constante
`SYSTEM_PROMPT`. Reproduzido na íntegra:

```
Você é um professor especialista em elaborar questões de múltipla escolha para estudo.
Seu objetivo é criar questões que testem COMPREENSÃO, não memorização literal do texto.

Regras obrigatórias:
1. Baseie-se ESTRITAMENTE no material fornecido pelo usuário. Nunca invente fatos que não estejam no material.
2. Cada questão tem exatamente 4 alternativas, com apenas 1 correta.
3. Os distratores (alternativas erradas) devem ser plausíveis: erros conceituais comuns, não absurdos óbvios.
4. Não use "todas as anteriores" nem "nenhuma das anteriores".
5. A explicação deve dizer por que a correta está certa E por que a resposta se sustenta no material.
6. Escreva em português do Brasil, de forma clara e sem citar "segundo o texto/material".
7. Respeite a dificuldade pedida: fácil = definição direta; médio = aplicação; difícil = comparação/caso.
Responda SOMENTE com o JSON no formato solicitado, sem comentários fora do JSON.
```

**Por que essas decisões:**

- **Papel de "professor especialista"** ancora o tom e o nível das questões.
- **"Testar compreensão, não memorização"** e a regra de **distratores plausíveis** evitam o erro clássico
  de LLM gerar 3 alternativas absurdas + 1 óbvia, que não avaliam nada.
- **"Baseie-se estritamente no material"** reduz alucinação — crítico numa ferramenta de estudo, onde uma
  questão com fato inventado ensina algo errado.
- **Contrato de saída em JSON** ("responda SOMENTE com o JSON") funciona em conjunto com o **JSON mode**
  (`responseSchema`, ver seção 4) para eliminar parsing frágil de texto livre.

---

## 3. Técnica de prompt aplicada e justificativa — *requisito 2*

**Técnica escolhida: Few-shot prompting.**

No arquivo [`app.js`](app.js), a constante `FEW_SHOT` injeta **um exemplo completo** (par `user → model`)
antes da tarefa real: um material curto sobre fotossíntese e a questão "ideal" que esperamos dele, já no
formato JSON, com distratores plausíveis e explicação no nível certo.

**Por que few-shot ajuda *neste caso específico* (e não CoT):**

1. **O gargalo aqui é padrão de qualidade e formato, não raciocínio em várias etapas.** Gerar uma boa
   questão de múltipla escolha é uma tarefa de *imitação de formato*: o modelo precisa ver o que é um bom
   distrator e uma boa explicação. Um exemplo concreto comunica isso muito melhor do que instruções
   abstratas. Chain-of-thought resolveria um problema que não temos (cadeia de dedução), gastaria tokens
   de "pensamento" e ainda deixaria a saída menos previsível.
2. **Calibra os distratores.** Sem exemplo, o modelo tende a criar alternativas erradas óbvias. O exemplo
   mostra distratores que representam **erros conceituais comuns** (ex.: confundir fotossíntese com
   respiração), elevando a dificuldade real das questões.
3. **Reforça o contrato JSON.** O exemplo já vem no formato exato de saída, o que soma com o `responseSchema`
   e reduz respostas fora do formato.

> **Observação honesta para a apresentação:** o few-shot **custa tokens de entrada fixos** em toda chamada
> (o exemplo viaja junto). É um trade-off consciente — pagamos ~algumas centenas de tokens a mais por
> chamada em troca de questões melhores. Dá pra medir isso no próprio log.

**⬜ EVIDÊNCIA (print):** gere um simulado **com** o few-shot ligado e cole aqui o print das questões
resultantes (mostrando distratores plausíveis + explicações). Opcional e forte: comente temporariamente a
linha `if (fewShot) contents.push(...fewShot);` no `app.js`, gere de novo e compare — o print do "antes e
depois" deixa a justificativa irrefutável.

`[COLE O PRINT AQUI]`

---

## 4. JSON mode (saída estruturada)

Além do few-shot, o app usa **JSON mode** do Gemini: em `generationConfig` mandamos
`responseMimeType: "application/json"` e um `responseSchema` (constante `RESPONSE_SCHEMA` no `app.js`) que
descreve um array de questões `{ pergunta, alternativas[], indiceCorreto, explicacao }`. Isso garante que
a resposta seja sempre JSON válido e parseável, sem regex nem "limpeza" de texto. Faz parte do conteúdo da
matéria (JSON mode) e sustenta a confiabilidade do app.

---

## 5. Teste de Curadoria de Contexto — *requisito 3*

**Metodologia:** faço a **mesma pergunta** ("Gere 1 questão sobre a 3ª Forma Normal") de duas formas:

- **Versão A — contexto completo:** mando o arquivo [`material-exemplo.md`](material-exemplo.md) **inteiro**
  no prompt (equivalente a um `@file` do Cursor/Claude).
- **Versão B — só o trecho:** mando **apenas o parágrafo sobre 3FN** (equivalente a selecionar só o
  `@trecho` relevante).

Depois comparo o `promptTokenCount` (tokens de entrada) das duas. O botão **"Teste de Curadoria de
Contexto"** no app faz isso automaticamente e mostra a redução percentual. Como não é um projeto legado,
o "arquivo referenciado" é o `material-exemplo.md` que criamos de propósito (o enunciado permite isso).

**Comparação de tokens:**

| Versão | Contexto enviado | Tokens de entrada | Custo estimado (US$) |
|--------|------------------|-------------------|----------------------|
| A — completo | `material-exemplo.md` inteiro | ⬜ PREENCHER | ⬜ PREENCHER |
| B — só o trecho | parágrafo da 3FN | ⬜ PREENCHER | ⬜ PREENCHER |
| **Redução** | | ⬜ **PREENCHER %** | |

> Exemplo ilustrativo do formato esperado (**troque pelos seus números reais do print**):
> A = 1502 tokens in · B = 236 tokens in → **redução de ~84%** nos tokens de entrada, com a mesma
> qualidade de questão gerada. Contexto enxuto = mais barato e mais rápido.

**⬜ EVIDÊNCIA (print):** rode o teste no app e cole o print da tela de resultado (os dois cartões A/B com a
redução %) **e** o print das linhas correspondentes no log.

`[COLE O PRINT AQUI]`

*Alternativa por CLI:* dá pra reproduzir o mesmo teste no terminal com
[`scripts/medir-tokens.mjs`](scripts/medir-tokens.mjs) (`export GEMINI_API_KEY=... && node scripts/medir-tokens.mjs`)
e printar a saída — mesma fonte de dados (`usageMetadata`).

---

## 6. Tabela com todas as chamadas + custo — *requisitos 4 e 5*

**Fórmula de custo (requisito 4):**

```
custo = (tokens_input / 1.000.000) × preço_input + (tokens_output / 1.000.000) × preço_output
```

**Preços oficiais (tabela do Google, paid tier, por 1M de tokens — conferida em 20/08/2026):**

| Modelo | Preço input (1M) | Preço output (1M) |
|--------|------------------|-------------------|
| `gemini-3.6-flash` | US$ 0,75 | US$ 3,75 |
| `gemini-3.7-flash` | US$ 0,75 | US$ 3,75 |
| `gemini-3.5-flash-lite` | US$ 0,30 | US$ 2,50 |

Fonte: <https://ai.google.dev/gemini-api/docs/pricing> (preço promocional vigente até 31/12/2026;
depois passa a US$ 1,50 in / US$ 7,50 out no `gemini-3.6/3.7-flash`).

> **Nota:** o modelo `gemini-2.5-flash` foi aposentado para contas novas; por isso o app usa a
> geração 3.x (`gemini-3.6-flash` como padrão). Use na tabela abaixo o modelo que você realmente rodou.

> **Free tier (AI Studio) custa R$ 0 de verdade.** Os valores abaixo são o **custo hipotético**, calculados
> como se fosse tier pago, exatamente como o enunciado pede.

**Tabela de chamadas da sessão** (exporte do painel de log com *Copiar tabela (Markdown)* e cole aqui):

| # | Tipo | Modelo | Tokens in | Tokens out | Custo (US$) |
|---|------|--------|-----------|------------|-------------|
| 1 | geração | gemini-3.6-flash | ⬜ | ⬜ | ⬜ |
| 2 | contexto A (completo) | gemini-3.6-flash | ⬜ | ⬜ | ⬜ |
| 3 | contexto B (trecho) | gemini-3.6-flash | ⬜ | ⬜ | ⬜ |
| … | … | … | … | … | … |
| **Total da sessão** | | | ⬜ | ⬜ | ⬜ |

**⬜ EVIDÊNCIA (print):** cole o print do **painel de log** do app com as linhas preenchidas e a linha de
total.

`[COLE O PRINT AQUI]`

---

## 7. Log / dashboard da ferramenta — *requisito 6*

A ferramenta de coleta de tokens/custo é o **próprio painel de log do app**, que lê `usageMetadata`
(`promptTokenCount` / `candidatesTokenCount`) da resposta da API do Gemini — a mesma fonte descrita na
tabela do enunciado para o Google AI Studio (curl na API).

**⬜ EVIDÊNCIA (print/export):** cole aqui o print do painel de log **e/ou** anexe o arquivo exportado
(`log-chamadas.csv` ou `log-chamadas.json`, botões de download no app) comprovando os números da tabela da
seção 6.

`[COLE O PRINT / ANEXE O EXPORT AQUI]`

---

## 8. URL publicada — *entrega obrigatória*

**⬜ PREENCHER:** `https://SEU-USUARIO.github.io/estuda-ai/` (ou a URL da Vercel/Cloudflare)

> Sem URL publicada funcionando, o trabalho **não é considerado entregue** (rubrica). Passo a passo de
> deploy em [`GUIA-DEPLOY.md`](GUIA-DEPLOY.md). **Não esqueça de adicionar `@pedrosatin` como colaborador
> do repositório** — também obrigatório.

---

## 9. Integrantes do grupo

**⬜ PREENCHER:**

| Nome completo | RA | Parte que construiu (para a defesa individual) |
|---------------|----|-----|
| Igor Costa | ⬜ RA | ⬜ ex.: system prompt e few-shot |
| ⬜ Nome | ⬜ RA | ⬜ |
| ⬜ Nome | ⬜ RA | ⬜ |

> Lembrete da rubrica: **a nota é individual**. Cada integrante deve saber explicar a própria parte (o
> prompt que escreveu, os dados que coletou). Combinem quem defende o quê antes da apresentação.

---

## Como coletar as evidências (roteiro rápido)

1. Publique o app (GUIA-DEPLOY.md) e abra a URL.
2. Cole sua chave do Gemini no campo de configuração.
3. Clique em **Carregar material de exemplo**.
4. **Gerar simulado** → tira print das questões (seção 3) e da 1ª linha do log.
5. **Teste de Curadoria de Contexto** → *Rodar comparação* → print da tela A/B + do log (seção 5).
6. Gere mais 1–2 simulados se quiser encher a tabela.
7. **Copiar tabela (Markdown)** → cola na seção 6. **Baixar CSV/JSON** → anexa (seção 7).
8. Print do painel de log completo (seção 6/7).
9. Preencha URL (seção 8), nomes e RAs (seção 9).

## Checklist de entrega

- [ ] System prompt documentado (seção 2) ✅ pronto
- [ ] Técnica de prompt aplicada + justificada (seção 3) ✅ pronto · ⬜ print
- [ ] Teste de curadoria de contexto (seção 5) ✅ metodologia pronta · ⬜ números + print reais
- [ ] Tabela de chamadas com custo (seção 6) ⬜ números + print reais
- [ ] Log/dashboard (seção 7) ⬜ print/export
- [ ] URL publicada funcionando (seção 8) ⬜
- [ ] `@pedrosatin` adicionado como colaborador ⬜
- [ ] Nomes e RAs (seção 9) ⬜

---

*Protótipo acadêmico. A chave de API nunca é versionada (ver `.gitignore`); é digitada em runtime e fica
apenas no navegador do usuário.*
