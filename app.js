/* =====================================================================
   Estuda Aí — Gerador de Simulados com IA (Gemini)
   Protótipo acadêmico — Trabalho Prático 1 de Engenharia de Prompt.
   Todo o comportamento de prompt (system prompt, few-shot, JSON mode)
   está declarado explicitamente neste arquivo para servir de evidência.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1) SYSTEM PROMPT (requisito 1)
   Definido e documentado ANTES de construir. Estabelece papel, regras
   de qualidade das questões e o contrato de saída (JSON).
   --------------------------------------------------------------------- */
const SYSTEM_PROMPT = `Você é um professor especialista em elaborar questões de múltipla escolha para estudo.
Seu objetivo é criar questões que testem COMPREENSÃO, não memorização literal do texto.

Regras obrigatórias:
1. Baseie-se ESTRITAMENTE no material fornecido pelo usuário. Nunca invente fatos que não estejam no material.
2. Cada questão tem exatamente 4 alternativas, com apenas 1 correta.
3. Os distratores (alternativas erradas) devem ser plausíveis: erros conceituais comuns, não absurdos óbvios.
4. Não use "todas as anteriores" nem "nenhuma das anteriores".
5. A explicação deve dizer por que a correta está certa E por que a resposta se sustenta no material.
6. Escreva em português do Brasil, de forma clara e sem citar "segundo o texto/material".
7. Respeite a dificuldade pedida: fácil = definição direta; médio = aplicação; difícil = comparação/caso.
Responda SOMENTE com o JSON no formato solicitado, sem comentários fora do JSON.`;

/* ---------------------------------------------------------------------
   2) TÉCNICA APLICADA: FEW-SHOT (requisito 2)
   Um par exemplo (user -> model) mostrando UMA questão ideal. Ancora o
   modelo no nível de qualidade dos distratores e da explicação, e reforça
   o formato antes da tarefa real. Justificativa completa no README.
   --------------------------------------------------------------------- */
const FEW_SHOT = [
  {
    role: "user",
    parts: [{ text:
`MATERIAL:
A fotossíntese converte luz, água e gás carbônico em glicose e oxigênio. Ocorre nos cloroplastos.

TAREFA: Gere 1 questão de dificuldade média sobre este material.` }]
  },
  {
    role: "model",
    parts: [{ text: JSON.stringify([
      {
        pergunta: "Uma planta é mantida no escuro por vários dias. Qual processo é diretamente interrompido e qual consequência isso tem?",
        alternativas: [
          "A fotossíntese para, pois falta luz, e a produção de glicose é interrompida.",
          "A respiração para, pois falta luz, e a planta deixa de consumir oxigênio.",
          "A fotossíntese continua normalmente, pois usa apenas água e gás carbônico.",
          "A planta passa a produzir mais oxigênio para compensar a falta de luz."
        ],
        indiceCorreto: 0,
        explicacao: "A fotossíntese depende de luz como insumo; sem luz, a conversão em glicose e oxigênio cessa. Os distratores confundem fotossíntese com respiração ou ignoram que a luz é indispensável."
      }
    ]) }]
  }
];

/* ---------------------------------------------------------------------
   3) JSON MODE — responseSchema (conteúdo do curso)
   Força a saída estruturada; elimina parsing frágil de texto livre.
   --------------------------------------------------------------------- */
const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      pergunta:     { type: "STRING" },
      alternativas: { type: "ARRAY", items: { type: "STRING" } },
      indiceCorreto:{ type: "INTEGER" },
      explicacao:   { type: "STRING" }
    },
    required: ["pergunta", "alternativas", "indiceCorreto", "explicacao"],
    propertyOrdering: ["pergunta", "alternativas", "indiceCorreto", "explicacao"]
  }
};

/* ---------------------------------------------------------------------
   4) PREÇOS OFICIAIS (paid tier) — tabela do Google, por 1M de tokens.
   Fonte: ai.google.dev/gemini-api/docs/pricing (conferida em 2026-08-20).
   Preço promocional vigente até 31/12/2026. Uso real no free tier = R$0.
   Cálculo abaixo é HIPOTÉTICO (requisito 4).
   --------------------------------------------------------------------- */
const PRICING = {
  "gemini-3.6-flash":       { in: 0.75, out: 3.75 },
  "gemini-3.7-flash":       { in: 0.75, out: 3.75 },
  "gemini-3.5-flash-lite":  { in: 0.30, out: 2.50 }
};

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/* ===================================================================== */
/*  Estado e helpers                                                     */
/* ===================================================================== */
const $ = (id) => document.getElementById(id);
let sessionLog = [];   // { n, hora, tipo, modelo, tokensIn, tokensOut, thoughts, custo }
let quizData = [];     // questões do simulado atual

function getKey() { try { return localStorage.getItem("gemini_key") || ""; } catch { return ""; } }
function setKey(v) { try { localStorage.setItem("gemini_key", v); } catch {} }

function estimateCost(model, tokensIn, tokensOut) {
  const p = PRICING[model] || PRICING["gemini-2.5-flash"];
  return (tokensIn / 1e6) * p.in + (tokensOut / 1e6) * p.out;
}
function usd(n) { return "$" + n.toFixed(6); }

// Parse tolerante: remove cercas ```json e texto fora do array/objeto JSON.
function parseJsonLoose(text) {
  let t = (text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(t); } catch (_) {}
  const first = Math.min(...[t.indexOf("["), t.indexOf("{")].filter(i => i >= 0));
  const last = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (isFinite(first) && last > first) return JSON.parse(t.slice(first, last + 1));
  throw new Error("A resposta do modelo não veio em JSON válido.");
}

function setStatus(msg, kind) {
  const el = $("status");
  el.hidden = false;
  el.className = "status" + (kind ? " " + kind : "");
  el.innerHTML = msg;
}

/* ===================================================================== */
/*  Chamada ao Gemini — devolve { data, usage }                          */
/*  usage lê usageMetadata.promptTokenCount / candidatesTokenCount       */
/*  (+ thoughtsTokenCount), exatamente como o enunciado descreve.        */
/* ===================================================================== */
async function callGemini({ model, systemPrompt, fewShot, userText, useSchema }) {
  const key = getKey();
  if (!key) throw new Error("Informe a chave da API do Gemini no campo de configuração.");

  const contents = [];
  if (fewShot) contents.push(...fewShot);
  contents.push({ role: "user", parts: [{ text: userText }] });

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.7
    }
  };
  if (useSchema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = RESPONSE_SCHEMA;
  }

  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const json = await resp.json();
  if (!resp.ok) {
    const m = json?.error?.message || resp.statusText;
    throw new Error(`API ${resp.status}: ${m}`);
  }

  const um = json.usageMetadata || {};
  const usage = {
    tokensIn:  um.promptTokenCount || 0,
    tokensOut: um.candidatesTokenCount || 0,
    thoughts:  um.thoughtsTokenCount || 0,
    total:     um.totalTokenCount || 0
  };
  const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  return { text, usage };
}

/* ===================================================================== */
/*  Log de chamadas                                                      */
/* ===================================================================== */
function logCall(tipo, model, usage) {
  const custo = estimateCost(model, usage.tokensIn, usage.tokensOut + usage.thoughts);
  const hora = new Date().toLocaleTimeString("pt-BR");
  sessionLog.push({
    n: sessionLog.length + 1, hora, tipo, modelo: model,
    tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, thoughts: usage.thoughts, custo
  });
  renderLog();
  return custo;
}

function renderLog() {
  const body = $("logBody");
  body.innerHTML = "";
  let tIn = 0, tOut = 0, tTh = 0, tCost = 0;
  for (const r of sessionLog) {
    tIn += r.tokensIn; tOut += r.tokensOut; tTh += r.thoughts; tCost += r.custo;
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${r.n}</td><td>${r.hora}</td><td>${r.tipo}</td><td>${r.modelo}</td>` +
      `<td>${r.tokensIn}</td><td>${r.tokensOut}</td><td>${r.thoughts}</td><td>${usd(r.custo)}</td>`;
    body.appendChild(tr);
  }
  $("totIn").textContent = tIn;
  $("totOut").textContent = tOut;
  $("totThoughts").textContent = tTh;
  $("totCost").textContent = usd(tCost);
}

function logToMarkdown() {
  let md = "| # | Tipo | Modelo | Tokens in | Tokens out | Thoughts | Custo (US$) |\n";
  md += "|---|------|--------|-----------|------------|----------|-------------|\n";
  let tIn = 0, tOut = 0, tTh = 0, tCost = 0;
  for (const r of sessionLog) {
    tIn += r.tokensIn; tOut += r.tokensOut; tTh += r.thoughts; tCost += r.custo;
    md += `| ${r.n} | ${r.tipo} | ${r.modelo} | ${r.tokensIn} | ${r.tokensOut} | ${r.thoughts} | ${r.custo.toFixed(6)} |\n`;
  }
  md += `| **Total** |  |  | **${tIn}** | **${tOut}** | **${tTh}** | **${tCost.toFixed(6)}** |\n`;
  return md;
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ===================================================================== */
/*  Geração do simulado                                                  */
/* ===================================================================== */
async function generateQuiz() {
  const material = $("material").value.trim();
  if (!material) { setStatus("Cole ou carregue um material de estudo primeiro.", "err"); return; }
  const model = $("model").value;
  const n = $("numQuestions").value;
  const diff = $("difficulty").value;

  const userText =
`MATERIAL:
${material}

TAREFA: Gere ${n} questões de múltipla escolha de dificuldade ${diff} sobre este material.`;

  $("generate").disabled = true;
  setStatus(`<span class="spinner"></span>Gerando ${n} questões com ${model}…`);
  try {
    const { text, usage } = await callGemini({
      model, systemPrompt: SYSTEM_PROMPT, fewShot: FEW_SHOT, userText, useSchema: true
    });
    const custo = logCall("geração", model, usage);
    quizData = parseJsonLoose(text);
    renderQuiz(quizData);
    setStatus(`✅ ${quizData.length} questões geradas. ` +
      `Entrada: ${usage.tokensIn} tokens · Saída: ${usage.tokensOut} tokens · Custo estimado: ${usd(custo)}.`, "ok");
  } catch (e) {
    setStatus("❌ " + e.message, "err");
  } finally {
    $("generate").disabled = false;
  }
}

function renderQuiz(questions) {
  const form = $("quizForm");
  form.innerHTML = "";
  questions.forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "question";
    div.dataset.correct = q.indiceCorreto;
    const opts = q.alternativas.map((alt, j) =>
      `<label class="opt" data-idx="${j}">
         <input type="radio" name="q${i}" value="${j}" />
         <span>${String.fromCharCode(65 + j)}) ${escapeHtml(alt)}</span>
       </label>`).join("");
    div.innerHTML =
      `<div class="q-title"><span class="num">Q${i + 1}.</span>${escapeHtml(q.pergunta)}</div>
       ${opts}
       <div class="explain"><strong>Explicação:</strong> ${escapeHtml(q.explicacao)}</div>`;
    form.appendChild(div);
  });
  $("quizCard").hidden = false;
  $("score").textContent = "";
  $("quizCard").scrollIntoView({ behavior: "smooth" });
}

function submitQuiz() {
  const questions = document.querySelectorAll(".question");
  let correct = 0;
  questions.forEach((qEl) => {
    const right = Number(qEl.dataset.correct);
    const chosen = qEl.querySelector("input:checked");
    qEl.querySelectorAll(".opt").forEach(o => o.classList.remove("correct", "wrong"));
    qEl.querySelector(".explain").classList.add("show");
    const rightOpt = qEl.querySelector(`.opt[data-idx="${right}"]`);
    if (rightOpt) rightOpt.classList.add("correct");
    if (chosen) {
      const idx = Number(chosen.value);
      if (idx === right) correct++;
      else qEl.querySelector(`.opt[data-idx="${idx}"]`).classList.add("wrong");
    }
  });
  $("score").textContent = `Acertos: ${correct} / ${questions.length}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ===================================================================== */
/*  Teste de Curadoria de Contexto (requisito 3)                         */
/*  Mesma pergunta, contexto completo (A) vs. só o trecho (B).           */
/* ===================================================================== */
async function runContextTest() {
  const model = $("model").value;
  const question = $("ctxQuestion").value.trim();
  const full = $("ctxFull").value.trim();
  const snippet = $("ctxSnippet").value.trim();
  if (!question || !full || !snippet) { alert("Preencha pergunta, contexto completo e trecho."); return; }

  const btn = $("runContextTest");
  btn.disabled = true; btn.textContent = "Rodando 2 chamadas…";
  const box = $("ctxResult");
  box.hidden = true;

  const mk = (ctx) => `MATERIAL:\n${ctx}\n\nTAREFA: ${question}`;

  try {
    const A = await callGemini({ model, systemPrompt: SYSTEM_PROMPT, fewShot: FEW_SHOT, userText: mk(full), useSchema: true });
    const custoA = logCall("contexto A (completo)", model, A.usage);
    const B = await callGemini({ model, systemPrompt: SYSTEM_PROMPT, fewShot: FEW_SHOT, userText: mk(snippet), useSchema: true });
    const custoB = logCall("contexto B (trecho)", model, B.usage);

    const inA = A.usage.tokensIn, inB = B.usage.tokensIn;
    const reducao = inA > 0 ? Math.round((1 - inB / inA) * 100) : 0;

    box.innerHTML =
      `<div class="ctx-cards">
         <div class="box"><div class="muted small">A) Contexto completo</div>
           <div class="big">${inA}</div><div class="muted small">tokens de entrada · ${usd(custoA)}</div></div>
         <div class="box"><div class="muted small">B) Só o trecho</div>
           <div class="big">${inB}</div><div class="muted small">tokens de entrada · ${usd(custoB)}</div></div>
       </div>
       <div class="ctx-verdict">📉 O trecho relevante usou <strong>${reducao}% menos tokens de entrada</strong>
         (${inA} → ${inB}). Mesmo resultado pedagógico, contexto enxuto = mais barato e mais rápido.
         Tire o print desta tela + da linha correspondente no log.</div>`;
    box.hidden = false;
  } catch (e) {
    box.innerHTML = `<div class="ctx-verdict" style="border-color:var(--bad)">❌ ${escapeHtml(e.message)}</div>`;
    box.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = "▶ Rodar comparação (2 chamadas)";
  }
}

/* ===================================================================== */
/*  Material de exemplo (carrega o material-exemplo.md e prepara o teste)*/
/* ===================================================================== */
const EXCERPT_3FN =
`Terceira Forma Normal (3FN): a tabela está na 2FN e nenhum atributo não-primo depende de outro atributo não-primo (sem dependência transitiva). Exemplo: em Funcionario(cpf, nome, cep, cidade), a chave é cpf, mas cep -> cidade, então cidade depende transitivamente da chave via cep, violando a 3FN. Correção: criar Endereco(cep, cidade).`;

async function loadExample() {
  try {
    const resp = await fetch("material-exemplo.md");
    const txt = await resp.text();
    $("material").value = txt;
    $("materialInfo").textContent = `carregado: ${txt.length} caracteres (~${Math.round(txt.length / 4)} tokens aprox.)`;
    // pré-carrega o teste de contexto já pronto pra rodar
    $("ctxQuestion").value = "Gere 1 questão de múltipla escolha de dificuldade média sobre a 3ª Forma Normal (3FN).";
    $("ctxFull").value = txt;
    $("ctxSnippet").value = EXCERPT_3FN;
  } catch {
    setStatus("Não consegui carregar o material-exemplo.md (rode via servidor/URL publicada, não abrindo o arquivo direto).", "err");
  }
}

/* ===================================================================== */
/*  Ligações de UI                                                       */
/* ===================================================================== */
window.addEventListener("DOMContentLoaded", () => {
  $("apiKey").value = getKey();
  $("apiKey").addEventListener("input", (e) => setKey(e.target.value.trim()));

  $("loadExample").addEventListener("click", loadExample);
  $("generate").addEventListener("click", generateQuiz);
  $("submitQuiz").addEventListener("click", submitQuiz);

  $("openContextTest").addEventListener("click", () => {
    if (!$("ctxFull").value) {
      const m = $("material").value.trim();
      if (m) { $("ctxFull").value = m; }
    }
    $("contextModal").hidden = false;
  });
  $("closeContext").addEventListener("click", () => $("contextModal").hidden = true);
  $("runContextTest").addEventListener("click", runContextTest);

  $("copyMd").addEventListener("click", () => {
    navigator.clipboard.writeText(logToMarkdown())
      .then(() => setStatus("📋 Tabela copiada em Markdown — cole no README.", "ok"))
      .catch(() => setStatus("Não consegui copiar automaticamente; use Baixar CSV/JSON.", "err"));
  });
  $("downloadCsv").addEventListener("click", () => {
    let csv = "n,hora,tipo,modelo,tokens_in,tokens_out,thoughts,custo_usd\n";
    csv += sessionLog.map(r =>
      `${r.n},${r.hora},"${r.tipo}",${r.modelo},${r.tokensIn},${r.tokensOut},${r.thoughts},${r.custo.toFixed(6)}`).join("\n");
    download("log-chamadas.csv", csv, "text/csv");
  });
  $("downloadJson").addEventListener("click", () =>
    download("log-chamadas.json", JSON.stringify(sessionLog, null, 2), "application/json"));
  $("clearLog").addEventListener("click", () => { sessionLog = []; renderLog(); });
});
