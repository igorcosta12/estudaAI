#!/usr/bin/env node
/**
 * medir-tokens.mjs — coleta de tokens/custo por linha de comando (opcional).
 *
 * Serve como fonte alternativa de evidência (requisito 5): roda o Teste de
 * Curadoria de Contexto direto no terminal e imprime tokens in/out + custo,
 * lendo usageMetadata da resposta da API — os mesmos campos que o app usa.
 *
 * Uso:
 *   export GEMINI_API_KEY="sua-chave"
 *   node scripts/medir-tokens.mjs
 *
 * Requer Node 18+ (fetch nativo). Nenhuma dependência externa.
 */

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("Defina GEMINI_API_KEY no ambiente."); process.exit(1); }

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const PRICING = {
  "gemini-3.6-flash":      { in: 0.75, out: 3.75 },
  "gemini-3.7-flash":      { in: 0.75, out: 3.75 },
  "gemini-3.5-flash-lite": { in: 0.30, out: 2.50 }
};

const SYSTEM_PROMPT =
  "Você é um professor especialista em elaborar questões de múltipla escolha para estudo. " +
  "Baseie-se estritamente no material fornecido. Responda apenas com JSON.";

import { readFileSync } from "node:fs";
const material = readFileSync(new URL("../material-exemplo.md", import.meta.url), "utf8");

const TRECHO_3FN =
  "Terceira Forma Normal (3FN): a tabela está na 2FN e nenhum atributo não-primo depende " +
  "de outro atributo não-primo (sem dependência transitiva). Exemplo: Funcionario(cpf, nome, cep, cidade), " +
  "chave cpf, mas cep -> cidade viola a 3FN. Correção: criar Endereco(cep, cidade).";

const QUESTION = "Gere 1 questão de múltipla escolha de dificuldade média sobre a 3ª Forma Normal (3FN).";

async function call(contexto) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: `MATERIAL:\n${contexto}\n\nTAREFA: ${QUESTION}` }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json"
    }
  };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || r.statusText);
  const u = j.usageMetadata || {};
  return { in: u.promptTokenCount || 0, out: u.candidatesTokenCount || 0, total: u.totalTokenCount || 0 };
}

function custo(u) {
  const p = PRICING[MODEL] || PRICING["gemini-2.5-flash"];
  return (u.in / 1e6) * p.in + (u.out / 1e6) * p.out;
}

const A = await call(material);
const B = await call(TRECHO_3FN);
const reducao = Math.round((1 - B.in / A.in) * 100);

console.log(`\nModelo: ${MODEL}\n`);
console.log("Versão A (material inteiro):", A, "| custo US$", custo(A).toFixed(6));
console.log("Versão B (só o trecho)   :", B, "| custo US$", custo(B).toFixed(6));
console.log(`\n>> Redução de tokens de entrada: ${reducao}%  (${A.in} -> ${B.in})\n`);
