# 🧠 Estuda Aí — Gerador de Simulados com IA

Trabalho Prático 1 · Engenharia de Prompt e Contexto na Prática

---

## 1. O que o projeto faz e opção escolhida

**Opção escolhida:** projeto de estudo de outra disciplina do semestre (*Banco de Dados I*).

O **Estuda Aí** é uma ferramenta de estudo web. A pessoa cola o material de uma matéria (resumo, capítulo,
anotações) e o app usa a API do **Gemini** para gerar um **simulado de múltipla escolha** com explicação em
cada questão. A ideia é transformar material passivo de leitura em prática ativa de recuperação
(*active recall*), que é uma das formas de estudo mais eficazes.

O diferencial que pensamos para este trabalho é o **painel de log embutido**: a cada chamada à API, o app
registra os **tokens de entrada e saída** (lidos do `usageMetadata` da resposta) e o **custo estimado**.
Assim a própria ferramenta gera as evidências dos requisitos 4, 5 e 6, e ainda tem um botão dedicado de
**Teste de Curadoria de Contexto** para o requisito 3.

**Como usar:** abrir a URL publicada (seção 8), colar a chave do Gemini no campo de configuração (ela fica
só no navegador, nunca vai para o repositório), carregar o material de exemplo ou colar o seu, e clicar em
*Gerar simulado*.

---

## 2. System prompt usado (completo) — *requisito 1*

Definimos e documentamos o system prompt **antes** de construir o app. Ele está no arquivo
[`app.js`](app.js), na constante `SYSTEM_PROMPT`, e é reproduzido aqui na íntegra:

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

Por que tomamos essas decisões:

- O papel de **"professor especialista"** ancora o tom e o nível das questões.
- Pedir para **testar compreensão, não memorização**, junto com a regra de **distratores plausíveis**, evita
  o erro clássico de a LLM gerar 3 alternativas absurdas + 1 óbvia, que não avaliam nada.
- **"Baseie-se estritamente no material"** reduz alucinação — algo crítico numa ferramenta de estudo, onde
  uma questão com fato inventado ensinaria algo errado.
- O **contrato de saída em JSON** ("responda SOMENTE com o JSON") trabalha junto com o **JSON mode**
  (`responseSchema`, ver seção 4) para eliminar parsing frágil de texto livre.

---

## 3. Técnica de prompt aplicada e justificativa — *requisito 2*

**Técnica escolhida: Few-shot prompting.**

No arquivo [`app.js`](app.js), a constante `FEW_SHOT` injeta **um exemplo completo** (par `user → model`)
antes da tarefa real: um material curto sobre fotossíntese e a questão "ideal" que esperamos, já no formato
JSON, com distratores plausíveis e explicação no nível certo.

Escolhemos few-shot (e não chain-of-thought) por três motivos, pensando neste caso específico:

1. **O gargalo aqui é padrão de qualidade e formato, não raciocínio em várias etapas.** Gerar uma boa
   questão de múltipla escolha é uma tarefa de *imitação de formato*: o modelo precisa ver o que é um bom
   distrator e uma boa explicação. Um exemplo concreto comunica isso muito melhor do que instruções
   abstratas. O chain-of-thought resolveria um problema que não temos (cadeia de dedução), gastaria tokens
   de "pensamento" e deixaria a saída menos previsível.
2. **Calibra os distratores.** Sem exemplo, o modelo tende a criar alternativas erradas óbvias. O exemplo
   mostra distratores que representam **erros conceituais comuns** (ex.: confundir fotossíntese com
   respiração), elevando a dificuldade real das questões.
3. **Reforça o contrato JSON.** O exemplo já vem no formato exato de saída, o que soma com o `responseSchema`
   e reduz respostas fora do formato.

Vale registrar o trade-off: o few-shot **custa tokens de entrada fixos** em toda chamada (o exemplo viaja
junto no prompt). Foi uma escolha consciente — pagamos algumas centenas de tokens a mais por chamada em
troca de questões de qualidade mais alta, e dá para medir esse custo no próprio painel de log.

**Evidência — mesmo material, com e sem o few-shot, lado a lado:**

<!-- Igor: confira se a ordem bateu (esquerda = com few-shot, direita = sem). Se estiver trocado, é só inverter os dois src abaixo. -->
<table>
  <tr>
    <td width="50%" valign="top"><b>Com few-shot (versão usada no app)</b><br><br>
      <img width="100%" alt="Simulado gerado com few-shot" src="https://github.com/user-attachments/assets/8828d859-099b-4fd5-9955-ff64c8eec6db" />
    </td>
    <td width="50%" valign="top"><b>Sem few-shot</b><br><br>
      <img width="100%" alt="Simulado gerado sem few-shot" src="https://github.com/user-attachments/assets/b287d0f9-3e14-4bf5-89b7-e141fee68881" />
    </td>
  </tr>
</table>

Na prática, com o few-shot os distratores ficam mais plausíveis e as explicações mais completas, enquanto
sem o exemplo as alternativas erradas tendem a ficar mais óbvias.

---

## 4. JSON mode (saída estruturada)

Além do few-shot, o app usa o **JSON mode** do Gemini: em `generationConfig` enviamos
`responseMimeType: "application/json"` e um `responseSchema` (constante `RESPONSE_SCHEMA` no `app.js`) que
descreve um array de questões `{ pergunta, alternativas[], indiceCorreto, explicacao }`. Isso garante que a
resposta venha sempre como JSON válido e parseável, sem regex nem "limpeza" de texto — outro tópico do
conteúdo da matéria que aplicamos de propósito.

---

## 5. Teste de Curadoria de Contexto — *requisito 3*

**Metodologia:** fazemos a **mesma pergunta** ("Gere 1 questão sobre a 3ª Forma Normal") de duas formas:

- **Versão A — contexto completo:** enviamos o arquivo [`material-exemplo.md`](material-exemplo.md)
  **inteiro** no prompt (equivalente a um `@file` do Cursor/Claude).
- **Versão B — só o trecho:** enviamos **apenas o parágrafo sobre 3FN** (equivalente a selecionar só o
  `@trecho` relevante).

Depois comparamos o `promptTokenCount` (tokens de entrada) das duas. O botão **"Teste de Curadoria de
Contexto"** do app faz isso automaticamente e mostra a redução percentual. Como não é um projeto legado, o
"arquivo referenciado" é o `material-exemplo.md` que criamos de propósito (o enunciado permite isso).

**Resultado medido:**

| Versão | Contexto enviado | Tokens de entrada | Custo estimado (US$) |
|--------|------------------|-------------------|----------------------|
| A — completo | `material-exemplo.md` inteiro | 1971 | $0.008067 |
| B — só o trecho | parágrafo da 3FN | 584 | $0.003948 |
| **Redução** | | **≈ 70%** | |

Enviar só o trecho relevante cortou **cerca de 70% dos tokens de entrada** (1971 → 584), gerando uma questão
de qualidade equivalente. É o equivalente medido de usar `@trecho` em vez de `@arquivo`: contexto enxuto sai
mais barato e mais rápido, sem perder qualidade.

<p align="center">
  <img width="682" alt="Teste de curadoria de contexto: versão A (completo) vs B (trecho)" src="https://github.com/user-attachments/assets/5c33cfff-8942-44b5-843d-c44801d94928" />
</p>

*Reprodução por CLI:* dá para reproduzir o mesmo teste no terminal com
[`scripts/medir-tokens.mjs`](scripts/medir-tokens.mjs)
(`export GEMINI_API_KEY=... && node scripts/medir-tokens.mjs`) — mesma fonte de dados (`usageMetadata`).

---

## 6. Tabela com todas as chamadas + custo — *requisitos 4 e 5*

**Fórmula de custo (requisito 4):**

```
custo = (tokens_input / 1.000.000) × preço_input + (tokens_output / 1.000.000) × preço_output
```

**Preços oficiais (tabela do Google, paid tier, por 1M de tokens — conferidos em 20/08/2026):**

| Modelo | Preço input (1M) | Preço output (1M) |
|--------|------------------|-------------------|
| `gemini-3.6-flash` | US$ 0,75 | US$ 3,75 |
| `gemini-3.7-flash` | US$ 0,75 | US$ 3,75 |
| `gemini-3.5-flash-lite` | US$ 0,30 | US$ 2,50 |

Fonte: <https://ai.google.dev/gemini-api/docs/pricing> (preço promocional vigente até 31/12/2026; depois
passa a US$ 1,50 in / US$ 7,50 out no `gemini-3.6/3.7-flash`).

> Usamos o `gemini-3.6-flash` porque o `gemini-2.5-flash` foi aposentado para contas novas.

> **Free tier (AI Studio) custa R$ 0 de verdade.** Os valores abaixo são o **custo hipotético**, calculados
> como se fosse tier pago, exatamente como o enunciado pede.

**Sobre a coluna "Thoughts":** os modelos da geração 3.x geram tokens de *thinking* (raciocínio interno),
que **o Google cobra como tokens de saída**. Por isso, na fórmula acima, os tokens de saída de cada chamada
são `(Tokens out + Thoughts)`. É o que explica o custo ser maior do que a coluna "Tokens out" sozinha
sugere.

**Chamadas da sessão** (exportadas do painel de log do app):

| # | Tipo | Modelo | Tokens in | Tokens out | Thoughts | Custo (US$) |
|---|------|--------|-----------|------------|----------|-------------|
| 1 | contexto A (completo) | gemini-3.6-flash | 1971 | 335 | 1422 | 0.008067 |
| 2 | contexto B (trecho) | gemini-3.6-flash | 584 | 287 | 649 | 0.003948 |
| 3 | geração | gemini-3.6-flash | 1738 | 1250 | 2961 | 0.017095 |
| 4 | contexto A (completo) | gemini-3.6-flash | 1971 | 285 | 1024 | 0.006387 |
| **Total da sessão** | | | **6264** | **2157** | **6056** | **0.035497** |

Conferência de uma linha (chamada 1), para mostrar a fórmula em ação:
`(1971/1.000.000 × 0,75) + ((335 + 1422)/1.000.000 × 3,75) = 0,001478 + 0,006589 = US$ 0,008067`.

---

## 7. Log / dashboard da ferramenta — *requisito 6*

A ferramenta de coleta de tokens/custo é o **próprio painel de log do app**, que lê o `usageMetadata`
(`promptTokenCount` / `candidatesTokenCount` / `thoughtsTokenCount`) da resposta da API do Gemini — a mesma
fonte descrita na tabela do enunciado para o Google AI Studio (curl na API).

Print do painel de log do app, com as quatro chamadas e o total da sessão — os mesmos números da tabela da
seção 6:

<p align="center">
  <img width="820" alt="Painel de log de chamadas do app, com tokens de entrada/saída, thoughts e custo por chamada" src="https://github.com/user-attachments/assets/d77a019c-e3a8-4fec-a74e-b59328228b1b" />
</p>

O arquivo exportado (`log-chamadas.csv` / `log-chamadas.json`, pelos botões de download do app) também pode
ser anexado na raiz do repositório como comprovação adicional.

---

## 8. URL publicada — *entrega obrigatória*

**URL:** `https://igorcosta12.github.io/estudaAI/`

O passo a passo de deploy está em [`GUIA-DEPLOY.md`](GUIA-DEPLOY.md).

---

## 9. Integrantes do grupo

| Nome completo | RA | 
|---------------|----|
| Igor Costa | *23215764-2* | 
| *Gabriel Rodrigues Soares* | *23038182-2* | 
| *Hugo Vinícius Fonseca Zuin* | *23000248-2* | 
| *Henrique Pacheco Alves*  | *23293915-2* | 

A nota é individual: cada integrante deve saber explicar a própria parte (o prompt que escreveu, os dados
que coletou). Combinamos antes da apresentação quem defende cada trecho.
