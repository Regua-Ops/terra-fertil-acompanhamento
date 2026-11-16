#!/usr/bin/env node
// Valida o content.json da Status Page. Uso:
//   node scripts/validar-conteudo.mjs [content.json] [--base outro.json] [--politica politica-publica.json]
//                                     [--hoje AAAA-MM-DD] [--resumo arquivo.md]
// Sai com código 1 se houver ERRO (bloqueia). AVISO nunca bloqueia.
// Dentro do GitHub Actions emite anotações (::error / ::warning) apontando a linha do arquivo.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { validar, diferencas, dataBR } from "./lib/conteudo.mjs";

const args = process.argv.slice(2);
const opt = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };
const arquivo = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? "content.json";
const politicaArq = opt("--politica") ?? "politica-publica.json";
const hoje = opt("--hoje") ?? new Date().toISOString().slice(0, 10);

const texto = readFileSync(arquivo, "utf8");
const politica = existsSync(politicaArq) ? JSON.parse(readFileSync(politicaArq, "utf8")) : {};
let base;
const baseArq = opt("--base");
if (baseArq && existsSync(baseArq)) { try { base = JSON.parse(readFileSync(baseArq, "utf8")); } catch { /* base ilegível: sem comparação */ } }

const { erros, avisos, conteudo } = validar(texto, { politica, hoje, base });
const ci = process.env.GITHUB_ACTIONS === "true";
const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const mostrar = (nivel, lista) => {
  for (const x of lista) {
    console.log(`${nivel === "error" ? "ERRO " : "AVISO"}  ${x.campo}  —  ${x.mensagem}`);
    if (ci) console.log(`::${nivel} file=${arquivo},line=${x.linha ?? 1},title=${esc(`${x.campo} (${x.regra})`)}::${esc(x.mensagem)}`);
  }
};
mostrar("error", erros);
mostrar("warning", avisos);
console.log(erros.length ? `\n✗ ${erros.length} erro(s), ${avisos.length} aviso(s). Corrija os erros para publicar.` : `\n✓ ${arquivo} válido (${avisos.length} aviso(s)).`);

const resumo = opt("--resumo") ?? (ci ? process.env.GITHUB_STEP_SUMMARY : undefined);
if (resumo) {
  const L = [`### ${erros.length ? "❌ Conteúdo com erros" : "✅ Conteúdo válido"} — \`${arquivo}\``, ""];
  if (conteudo?.referenceDate) L.push(`Referência da página: **${dataBR(conteudo.referenceDate)}**`, "");
  const tabela = (t, lista) => lista.length && L.push(`**${t}**`, "", "| Campo | O que corrigir |", "|---|---|", ...lista.map((x) => `| \`${x.campo}\` | ${x.mensagem.replace(/\|/g, "\\|")} |`), "");
  tabela("Erros (bloqueiam a publicação)", erros);
  tabela("Avisos (não bloqueiam; confirme que são intencionais)", avisos);
  if (conteudo && base) {
    const d = diferencas(base, conteudo);
    const corta = (v) => (v === undefined ? "_(ausente)_" : String(v).replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 160));
    L.push(`**O que muda em relação à versão de comparação** (${d.length} campo(s))`, "");
    if (d.length) L.push("| Campo | Antes | Depois |", "|---|---|---|", ...d.slice(0, 60).map((x) => `| \`${x.campo}\` | ${corta(x.antes)} | ${corta(x.depois)} |`));
    else L.push("_Nenhuma diferença de conteúdo._");
    if (d.length > 60) L.push("", `_… e mais ${d.length - 60} campo(s)._`);
    L.push("");
  }
  appendFileSync(resumo, L.join("\n") + "\n");
}
process.exit(erros.length ? 1 : 0);
