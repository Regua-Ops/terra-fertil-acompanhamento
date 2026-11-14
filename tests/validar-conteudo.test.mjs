// node --test "tests/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validar } from "../scripts/lib/conteudo.mjs";

// Fixtures próprias: editar o content.json ou a política de verdade não pode quebrar estes testes.
const lerJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const politica = lerJson("./fixtures/politica-teste.json");
const original = lerJson("./fixtures/content-valido.json");
const HOJE = "2026-11-14";
const clone = () => structuredClone(original);
const rodar = (c, extra = {}, pol = politica) =>
  validar(typeof c === "string" ? c : JSON.stringify(c, null, 2), { politica: pol, hoje: HOJE, ...extra });
const regras = (r, nivel = "erros") => r[nivel].map((x) => `${x.campo}:${x.regra}`);

test("a fixture válida é válida (e a política de verdade compila: regex e formato)", () => {
  assert.deepEqual(rodar(original).erros, []);
  const real = lerJson("../politica-publica.json");
  for (const r of [...(real.bloqueios ?? []), ...(real.avisos ?? [])]) {
    assert.ok(r.id && r.padrao && r.mensagem, `regra incompleta: ${JSON.stringify(r)}`);
    assert.doesNotThrow(() => new RegExp(r.padrao, "iu"), `regex inválida em ${r.id}`);
  }
  assert.ok(Array.isArray(real.linksPermitidos) && real.linksPermitidos.every((l) => l.startsWith("https://")));
});

test("JSON quebrado: erro com linha", () => {
  const r = rodar('{\n  "schemaVersion": 2,\n  "referenceDate": "2026-11-14",\n}');
  assert.equal(r.erros[0].regra, "json");
  assert.ok(r.erros[0].linha >= 1);
});

test("estrutura: chave desconhecida, campo ausente, tipo errado e enumeração", () => {
  const c = clone();
  c.weeks = {}; delete c.closes; c.week.done = 5; c.dependencies[0].status = "Feito";
  const r = regras(rodar(c));
  assert.ok(r.includes("weeks:chave-desconhecida"));
  assert.ok(r.includes("closes:ausente"));
  assert.ok(r.includes("week.done:estrutura"));
  assert.ok(r.includes("dependencies[0].status:enum"));
});

test("limites: texto vazio, espaço sobrando e tamanho", () => {
  const c = clone();
  c.summary = " "; c.closes = " x"; c.week.next = "a".repeat(901);
  const r = regras(rodar(c));
  assert.ok(r.includes("summary:vazio") && r.includes("closes:espaco") && r.includes("week.next:tamanho"));
});

test("datas: inexistente, futura, mais antiga que a versão de comparação, antiga demais", () => {
  const c = clone();
  c.referenceDate = "2026-02-30";
  assert.ok(regras(rodar(c)).includes("referenceDate:data"));
  c.referenceDate = "2026-11-20";
  assert.ok(regras(rodar(c)).includes("referenceDate:data-futura"));
  c.referenceDate = "2026-11-07";
  assert.ok(!regras(rodar(c)).includes("referenceDate:data-regrediu"));
  assert.ok(regras(rodar(c, { base: { referenceDate: "2026-11-13" } })).includes("referenceDate:data-regrediu"));
  assert.ok(regras(rodar(original), "avisos").includes("referenceDate:data-antiga")); // 31/10 visto em 14/11
});

test("consistência: intro cita data diferente da referência; duas fases atuais", () => {
  const c = clone();
  c.referenceDate = "2026-11-14";
  assert.ok(regras(rodar(c), "avisos").includes("achievements.intro:data-divergente"));
  c.phases[1].current = true;
  assert.ok(regras(rodar(c)).includes("phases:fase-atual"));
});

test("contato: só no campo contact e só os listados na política", () => {
  const pol = structuredClone(politica);
  pol.contatosPermitidos.emails = ["contato@exemplo.com.br"];
  pol.contatosPermitidos.telefones = ["(11) 90000-0001"];
  const c = clone();
  c.contact = "Contato institucional: contato@exemplo.com.br · (11) 90000-0001";
  assert.deepEqual(rodar(c, {}, pol).erros, []);
  c.contact = "Contato: outra.pessoa@exemplo.com.br · (11) 90000-0002";
  const r = regras(rodar(c, {}, pol));
  assert.ok(r.includes("contact:email") && r.includes("contact:telefone"));
  const d = clone();
  d.week.blocked = "Falar com contato@exemplo.com.br ou (11) 90000-0001.";
  const r2 = regras(rodar(d, {}, pol));
  assert.ok(r2.includes("week.blocked:email") && r2.includes("week.blocked:telefone"), "contato listado também é erro fora de contact");
});

test("números legítimos passam: datas, versões, porcentagens, anos, CNPJ institucional, horários", () => {
  const c = clone();
  c.week.done = "Entregue em 12/11/2026 a versão 1.4.2, com 87% dos itens revisados em 2026. CNPJ da Régua: 12.345.678/0001-90. Reunião das 14h às 15h30.";
  assert.deepEqual(rodar(c).erros, []);
});

test("conteúdo concreto: telefone no texto, CPF, token, variável interna, HTML", () => {
  const c = clone();
  c.week.done = "Ligue para (11) 90000-0003 ou 11900000004.";
  c.week.blocked = "CPF 123.456.789-09 do responsável.";
  c.week.next = "Use gho_abcdefghijklmnopqrstuvwxyz0123 e SESSION_SECRET para entrar.";
  c.summary = "Veja <b>isto</b> &amp; aquilo";
  const r = regras(rodar(c));
  for (const esperado of ["week.done:telefone", "week.blocked:cpf", "week.next:segredo", "week.next:infra-interna", "summary:html"])
    assert.ok(r.includes(esperado), `faltou ${esperado}; veio ${r.join(", ")}`);
});

test("a mensagem de erro não repete o dado sensível inteiro", () => {
  const c = clone();
  c.week.done = "Ligue para (11) 90000-0003.";
  c.week.blocked = "CPF 123.456.789-09.";
  const msgs = rodar(c).erros.map((x) => x.mensagem).join(" | ");
  assert.ok(!msgs.includes("90000") && !msgs.includes("456.789"), msgs);
});

test("links: só https e só os permitidos; portal profundo exige login e é bloqueado", () => {
  const c = clone();
  c.deliveries[0].link = "https://portal-terrafertil.reguaops.lat/entrada";
  assert.deepEqual(rodar(c).erros, []);
  c.deliveries[0].link = "https://portal-terrafertil.reguaops.lat/projetos/terra-fertil/documentos/perfil-comercial";
  assert.ok(regras(rodar(c)).includes("deliveries[0].link:link-nao-permitido"));
  c.deliveries[0].link = "http://tf-statuspage.reguaops.lat/";
  assert.ok(regras(rodar(c)).includes("deliveries[0].link:link-https"));
  const d = clone();
  d.week.next = "Detalhes em https://docs.reguaops.lat/terra-fertil.";
  assert.ok(regras(rodar(d)).includes("week.next:url-no-texto"));
});

test("avisos: terceiro nomeado, ferramenta de IA, id interno, valor em reais, commit — nenhum bloqueia", () => {
  const c = clone();
  c.week.done = "Análise da V4 revisada com Claude (TER-9), investimento de R$ 1.200 e commit 0123456789abcdef0123456789abcdef01234567.";
  const r = rodar(c);
  assert.deepEqual(r.erros, []);
  for (const id of ["terceiro-nomeado", "ferramenta-ia", "id-interno", "valor-monetario", "hash-de-commit"])
    assert.ok(regras(r, "avisos").includes(`week.done:${id}`), `faltou aviso ${id}`);
});

test("bloqueios definidos pelo owner na política viram erro", () => {
  const pol = structuredClone(politica);
  pol.bloqueios = [{ id: "nome-cliente-final", padrao: "\\bDona Maria\\b", mensagem: "nome de cliente final." }];
  const c = clone();
  c.week.done = "Atendemos a Dona Maria em outubro.";
  assert.ok(regras(rodar(c, {}, pol)).includes("week.done:nome-cliente-final"));
});
