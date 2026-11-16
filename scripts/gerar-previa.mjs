#!/usr/bin/env node
// Gera a prévia fiel: o MESMO index.html, com o conteúdo embutido, num arquivo único que abre com duplo clique.
// Uso: node scripts/gerar-previa.mjs [content.json] [pasta-de-saída]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [arquivo = "content.json", saida = "_previa"] = process.argv.slice(2);
const html = readFileSync("index.html", "utf8");
const conteudo = JSON.parse(readFileSync(arquivo, "utf8"));
const marca = "<!-- CONTEUDO-PREVIA -->";
if (!html.includes(marca)) { console.error(`index.html não tem a marca ${marca}`); process.exit(1); }
// "<" escapado: o JSON não consegue fechar o <script> nem abrir comentário HTML.
const json = JSON.stringify(conteudo)
  .replace(/</g, "\\u003c")
  .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
  .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
mkdirSync(saida, { recursive: true });
writeFileSync(join(saida, "previa.html"), html.replace(marca, () => `<script>window.__CONTEUDO_PREVIA__ = ${json};</script>`));
console.log(`prévia gravada em ${join(saida, "previa.html")} (${(json.length / 1024).toFixed(1)} KB de conteúdo)`);
