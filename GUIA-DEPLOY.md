# 🚀 Guia de Deploy — Estuda Aí

Este projeto é **HTML/CSS/JS puro, sem framework e sem build**. Isso é de propósito: publica em qualquer
lugar sem configuração de Vite/Actions e sem cair na armadilha do `base` que o enunciado avisa. Escolha
**um** dos caminhos abaixo.

> **Antes de tudo — chave da API:** pegue sua chave grátis em
> <https://aistudio.google.com/app/apikey>. Ela **não** vai para o repositório: é digitada no app em runtime
> e fica só no navegador. Confira que o `.gitignore` já ignora `.env`/`*.key` antes do primeiro commit.

---

## Passo 0 — subir o código pro GitHub

```bash
cd estuda-ai
git init
git add .
git commit -m "Estuda Aí — gerador de simulados com IA"
git branch -M main
# crie um repositório vazio no github.com (ex.: estuda-ai) e troque a URL abaixo:
git remote add origin https://github.com/SEU-USUARIO/estuda-ai.git
git push -u origin main
```

## Passo obrigatório — adicionar o colaborador

No repositório: **Settings → Collaborators → Add people → `pedrosatin`**.
Obrigatório mesmo se o repo for público. **Sem isso o trabalho não conta como entregue.**

---

## Caminho A — GitHub Pages (recomendado para este projeto)

Como é site estático puro, o Pages publica direto, sem Actions.

1. No repositório: **Settings → Pages**.
2. Em **Source**, escolha **"Deploy from a branch"**.
3. Selecione a branch **`main`** e a pasta **`/ (root)`**. Salve.
4. Aguarde ~1 min. A URL sai como `https://SEU-USUARIO.github.io/estuda-ai/`.
5. Abra a URL, cole sua chave e teste **Carregar material de exemplo → Gerar simulado**.

> ⚠️ O `material-exemplo.md` é carregado via `fetch`. Isso funciona na URL publicada (servida por HTTP).
> Se você abrir o `index.html` com duplo-clique no `file://`, o fetch é bloqueado — sempre teste pela URL
> (ou rode um servidor local: `python3 -m http.server` e acesse `http://localhost:8000`).

---

## Caminho B — Vercel ou Cloudflare Pages

Alternativa que também gera URL automática. Igualmente simples por ser estático.

**Vercel:** <https://vercel.com/new> → *Import* do repositório do GitHub → Framework Preset: **Other**
(ou *Static*) → Deploy. A URL sai como `estuda-ai.vercel.app`.

**Cloudflare Pages:** <https://dash.cloudflare.com> → *Workers & Pages* → *Create* → *Pages* → conectar ao
GitHub → build command **vazio**, output directory **`/`** → Deploy.

---

## Depois de publicar

1. Copie a **URL** para o `README.md`, seção 8.
2. Rode o app e colete as evidências (roteiro no fim do `README.md`).
3. Confirme que `@pedrosatin` está como colaborador.

## Segurança da chave (boa prática, opcional)

Como cada pessoa usa a **própria** chave digitada no app, o repositório fica livre de segredos. Ainda assim,
no Google AI Studio / Google Cloud Console você pode **restringir a chave** (por API e por referenciador
HTTP) para reduzir risco de uso indevido caso ela vaze. Para um protótipo acadêmico no free tier, apenas
não commitá-la já resolve o essencial.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|--------|----------------|---------|
| Página em branco na URL | arquivos na pasta errada | confirme que `index.html` está na raiz e o Source do Pages é `/ (root)` |
| "Não consegui carregar o material-exemplo.md" | aberto via `file://` | acesse pela URL publicada ou por `localhost` |
| `API 400: API key not valid` | chave errada/incompleta | recopie a chave do AI Studio |
| `API 429` | limite do free tier | espere um pouco e tente de novo |
| Deploy do Pages não atualiza | cache | force refresh (Ctrl+Shift+R) e aguarde ~1 min |
