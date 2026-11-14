// Validação, política de exposição pública e comparação do content.json.
// Sem dependências: roda com o Node que já vem no GitHub Actions e localmente.

export const TONS = ["concluido", "andamento", "pendente"];
export const STATUS_DEPENDENCIA = ["Pendente", "Em andamento", "Recebido"];
export const STATUS_ENTREGA = ["Planejada", "Em preparação", "Entregue"];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Estrutura esperada. Chave desconhecida é erro (pega erro de digitação ao editar no navegador). */
const ESQUEMA = {
  schemaVersion: { tipo: "const", valor: 2 },
  referenceDate: { tipo: "data" },
  summary: { tipo: "texto", max: 400 },
  achievements: {
    tipo: "objeto",
    campos: {
      intro: { tipo: "texto", max: 300 },
      items: {
        tipo: "lista", min: 1, max: 8,
        item: {
          tipo: "objeto",
          campos: {
            status: { tipo: "texto", max: 40 },
            tone: { tipo: "enum", valores: TONS },
            title: { tipo: "texto", max: 100 },
            detail: { tipo: "texto", max: 400 },
          },
        },
      },
      note: {
        tipo: "objeto",
        campos: { lead: { tipo: "texto", max: 80 }, text: { tipo: "texto", max: 500 } },
      },
    },
  },
  phases: {
    tipo: "lista", min: 1, max: 8,
    item: {
      tipo: "objeto",
      campos: {
        title: { tipo: "texto", max: 60 },
        detail: { tipo: "texto", max: 200 },
        current: { tipo: "booleano", opcional: true },
      },
    },
  },
  closes: { tipo: "texto", max: 300 },
  week: {
    tipo: "objeto",
    campos: {
      done: { tipo: "texto", max: 900 },
      blocked: { tipo: "texto", max: 900 },
      next: { tipo: "texto", max: 900 },
    },
  },
  campaigns: {
    tipo: "objeto",
    campos: {
      status: { tipo: "texto", max: 40 },
      tone: { tipo: "enum", valores: TONS },
      intro: { tipo: "texto", max: 300 },
      steps: {
        tipo: "lista", min: 1, max: 6,
        item: {
          tipo: "objeto",
          campos: { title: { tipo: "texto", max: 100 }, detail: { tipo: "texto", max: 400 } },
        },
      },
      condition: { tipo: "texto", max: 300 },
    },
  },
  dependencies: {
    tipo: "lista", min: 0, max: 12,
    item: {
      tipo: "objeto",
      campos: {
        title: { tipo: "texto", max: 140 },
        owner: { tipo: "texto", max: 60 },
        asked: { tipo: "texto", max: 80 },
        purpose: { tipo: "texto", max: 300 },
        status: { tipo: "enum", valores: STATUS_DEPENDENCIA },
      },
    },
  },
  deliveries: {
    tipo: "lista", min: 0, max: 8,
    item: {
      tipo: "objeto",
      campos: {
        title: { tipo: "texto", max: 140 },
        date: { tipo: "texto", max: 80 },
        status: { tipo: "enum", valores: STATUS_ENTREGA },
        link: { tipo: "link" },
      },
    },
  },
  contact: { tipo: "texto", max: 160 },
};

// Campos que não são texto livre: não passam pela varredura de conteúdo.
const SEM_VARREDURA = new Set(["schemaVersion", "referenceDate"]);
const ENUMS = new Set(["tone"]);

export function validarDataIso(s) {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export const dataBR = (iso) => iso.split("-").reverse().join("/");
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Estrutura, tamanhos, enumerações, data. Retorna lista de { campo, regra, mensagem }. */
function validarEstrutura(valor, esq, caminho, erros) {
  const e = (regra, mensagem) => erros.push({ campo: caminho, regra, mensagem });
  switch (esq.tipo) {
    case "const":
      if (valor !== esq.valor) e("estrutura", `deve ser ${JSON.stringify(esq.valor)}.`);
      return;
    case "data":
      if (!validarDataIso(valor)) e("data", "use uma data real no formato AAAA-MM-DD (ex.: 2026-11-14).");
      return;
    case "texto":
      if (typeof valor !== "string") return e("estrutura", "deve ser um texto entre aspas.");
      if (valor.trim() === "") return e("vazio", "não pode ficar vazio.");
      if (valor !== valor.trim()) e("espaco", "tem espaço sobrando no começo ou no fim.");
      if (valor.length > esq.max) e("tamanho", `tem ${valor.length} caracteres; o máximo é ${esq.max}.`);
      return;
    case "booleano":
      if (typeof valor !== "boolean") e("estrutura", "deve ser true ou false (sem aspas).");
      return;
    case "enum":
      if (!esq.valores.includes(valor)) e("enum", `valor inválido ${JSON.stringify(valor)}; use um de: ${esq.valores.join(", ")}.`);
      return;
    case "link":
      if (typeof valor !== "string") return e("estrutura", 'deve ser um texto; use "" quando não houver link.');
      return;
    case "lista":
      if (!Array.isArray(valor)) return e("estrutura", "deve ser uma lista [ ... ].");
      if (valor.length < esq.min || valor.length > esq.max)
        e("tamanho", `tem ${valor.length} item(ns); precisa ter entre ${esq.min} e ${esq.max}.`);
      valor.forEach((v, i) => validarEstrutura(v, esq.item, `${caminho}[${i}]`, erros));
      return;
    case "objeto": {
      if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return e("estrutura", "deve ser um bloco { ... }.");
      for (const k of Object.keys(valor))
        if (!(k in esq.campos)) erros.push({ campo: `${caminho}.${k}`, regra: "chave-desconhecida", mensagem: "campo que a página não usa (erro de digitação?)." });
      for (const [k, sub] of Object.entries(esq.campos)) {
        if (!(k in valor)) {
          if (!sub.opcional) erros.push({ campo: `${caminho}.${k}`, regra: "ausente", mensagem: "campo obrigatório ausente." });
          continue;
        }
        validarEstrutura(valor[k], sub, `${caminho}.${k}`, erros);
      }
    }
  }
}

/** Percorre as folhas de texto livre: [{ campo, folha, valor }]. */
function folhasDeTexto(valor, caminho = "", folha = "", saida = []) {
  if (typeof valor === "string") {
    if (!SEM_VARREDURA.has(caminho) && !ENUMS.has(folha)) saida.push({ campo: caminho, folha, valor });
  } else if (Array.isArray(valor)) valor.forEach((v, i) => folhasDeTexto(v, `${caminho}[${i}]`, folha, saida));
  else if (valor && typeof valor === "object")
    for (const [k, v] of Object.entries(valor)) folhasDeTexto(v, caminho ? `${caminho}.${k}` : k, k, saida);
  return saida;
}

// --- Regras de exposição, por campo e por conteúdo concreto -------------------------------------
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const RE_TELEFONE = /(?<![\w])(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}(?![\w])/g;
const RE_CPF = /(?<![\w])\d{3}\.\d{3}\.\d{3}-\d{2}(?![\w])/g;
const RE_URL = /https?:\/\/[^\s)"'<>]+/g;
const RE_TAG = /<\/?[A-Za-z][^>]*>|&[a-z]+;|&#\d+;/;
const RE_SEGREDO = [
  [/gh[pousr]_[A-Za-z0-9]{20,}/, "token do GitHub"],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, "token JWT"],
  [/-----BEGIN [A-Z ]*KEY-----/, "chave privada"],
  [/AKIA[0-9A-Z]{16}/, "chave de acesso AWS"],
  [/\$2[aby]\$\d{2}\$[A-Za-z0-9./]{20,}/, "hash de senha"],
  [/\b(?:senha|password|token|secret|segredo)\s*[:=]\s*\S{4,}/i, "senha ou token escrito no texto"],
];
const RE_INFRA = /\b(?:TEAM_PASSWORD_HASH|SESSION_SECRET|DATABASE_URL|SEED_[A-Z_]+|team_only|portal\.env)\b/;

const soDigitos = (s) => s.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
const reDe = (padrao) => new RegExp(padrao, "iu");

function achados(regex, texto) {
  return [...texto.matchAll(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`))].map((m) => m[0]);
}

function linkPermitido(url, politica) {
  const u = /^https?:\/\/[^/?#]+$/.test(url) ? `${url}/` : url; // domínio sem caminho = raiz
  return (politica.linksPermitidos ?? []).some((p) => {
    if (p.endsWith("/")) return u.startsWith(p);
    return u === p || (u.startsWith(p) && /^[/?#]/.test(u.slice(p.length)));
  });
}

/** Varredura de conteúdo. `erro` bloqueia; `aviso` só alerta. */
function varrerConteudo(conteudo, politica, erros, avisos) {
  const contatos = politica.contatosPermitidos ?? {};
  const emailsOk = new Set((contatos.emails ?? []).map((x) => x.toLowerCase()));
  const fonesOk = new Set((contatos.telefones ?? []).map(soDigitos));
  const urlsOk = (contatos.urls ?? []).map((u) => u.replace(/\/$/, ""));
  const E = (campo, regra, mensagem) => erros.push({ campo, regra, mensagem });
  const A = (campo, regra, mensagem) => avisos.push({ campo, regra, mensagem });

  for (const { campo, folha, valor } of folhasDeTexto(conteudo)) {
    const ehContato = campo === "contact";
    const ehLink = folha === "link";

    if (ehLink) {
      if (valor !== "" && !/^https:\/\//.test(valor)) E(campo, "link-https", 'link precisa começar com https:// (ou ficar "").');
      else if (valor !== "" && !linkPermitido(valor, politica))
        E(campo, "link-nao-permitido", `link fora da lista de links públicos (politica-publica.json › linksPermitidos). Links para documentos do portal exigem login.`);
      continue;
    }
    if (RE_TAG.test(valor)) E(campo, "html", "o texto não aceita HTML nem entidades (&...;): apareceria literalmente na página.");
    for (const [re, rotulo] of RE_SEGREDO) if (re.test(valor)) E(campo, "segredo", `parece conter ${rotulo}. Nunca publique credenciais.`);
    if (RE_INFRA.test(valor)) E(campo, "infra-interna", "cita nome de variável ou campo interno do portal (não é conteúdo para o público).");
    for (const x of achados(RE_CPF, valor)) E(campo, "cpf", `CPF ${x.slice(0, 3)}.***.***-**: dado pessoal não entra na página pública.`);

    for (const x of achados(RE_EMAIL, valor)) {
      if (ehContato && emailsOk.has(x.toLowerCase())) continue;
      E(campo, "email", `e-mail ${x.replace(/^[^@]{1,2}[^@]*/, (m) => m[0] + "***")} fora da lista: contato público só no campo "contact" e só os listados em politica-publica.json › contatosPermitidos.`);
    }
    for (const x of achados(RE_TELEFONE, valor)) {
      if (ehContato && fonesOk.has(soDigitos(x))) continue;
      E(campo, "telefone", `telefone terminado em ${soDigitos(x).slice(-2)} fora da lista: contato público só no campo "contact" e só os listados em politica-publica.json › contatosPermitidos.`);
    }
    for (const x of achados(RE_URL, valor)) {
      const url = x.replace(/[.,;:]+$/, "");
      if (ehContato && urlsOk.includes(url.replace(/\/$/, ""))) continue;
      if (!linkPermitido(url, politica)) E(campo, "url-no-texto", `URL ${url} fora da lista de links públicos (politica-publica.json › linksPermitidos).`);
    }

    for (const r of politica.bloqueios ?? [])
      if (reDe(r.padrao).test(valor)) E(campo, r.id, r.mensagem);
    for (const r of politica.avisos ?? [])
      if (reDe(r.padrao).test(valor)) A(campo, r.id, r.mensagem);
  }
}

/** Consistência entre campos: o que costuma ficar velho quando só um deles é editado. */
function verificarConsistencia(c, { hoje, base }, erros, avisos) {
  if (!validarDataIso(c.referenceDate)) return;
  if (hoje && validarDataIso(hoje)) {
    const atraso = diasEntre(c.referenceDate, hoje);
    if (atraso < -1) erros.push({ campo: "referenceDate", regra: "data-futura", mensagem: `${dataBR(c.referenceDate)} está no futuro (hoje é ${dataBR(hoje)}).` });
    else if (atraso > 8) avisos.push({ campo: "referenceDate", regra: "data-antiga", mensagem: `a referência tem ${atraso} dias (${dataBR(c.referenceDate)}); a cadência prometida é semanal.` });
  }
  if (base && validarDataIso(base.referenceDate) && c.referenceDate < base.referenceDate)
    erros.push({ campo: "referenceDate", regra: "data-regrediu", mensagem: `${dataBR(c.referenceDate)} é anterior à da versão de comparação (${dataBR(base.referenceDate)}): isto reverteria a página para uma posição mais antiga.` });
  const intro = c.achievements?.intro;
  if (typeof intro === "string")
    for (const d of intro.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) ?? [])
      if (d !== dataBR(c.referenceDate))
        avisos.push({ campo: "achievements.intro", regra: "data-divergente", mensagem: `cita ${d}, mas a referência da página é ${dataBR(c.referenceDate)}.` });
  const atuais = (c.phases ?? []).filter((p) => p && p.current === true).length;
  if (atuais > 1) erros.push({ campo: "phases", regra: "fase-atual", mensagem: `${atuais} fases marcadas como atuais; marque no máximo uma.` });
  if (atuais === 0 && Array.isArray(c.phases) && c.phases.length) avisos.push({ campo: "phases", regra: "fase-atual", mensagem: "nenhuma fase marcada como atual." });
}

/**
 * @param {string} texto  conteúdo bruto do content.json
 * @returns {{erros: object[], avisos: object[], conteudo?: object}}
 */
export function validar(texto, { politica = {}, hoje, base } = {}) {
  const erros = [], avisos = [];
  let conteudo;
  try {
    conteudo = JSON.parse(texto);
  } catch (err) {
    const m = /position (\d+)/.exec(err.message);
    const linha = m ? texto.slice(0, Number(m[1])).split("\n").length : undefined;
    erros.push({ campo: "(arquivo)", regra: "json", linha, mensagem: `JSON inválido: ${err.message}. Em geral é vírgula sobrando ou faltando, ou aspas não fechadas.` });
    return { erros, avisos };
  }
  validarEstrutura(conteudo, { tipo: "objeto", campos: ESQUEMA }, "", erros);
  erros.forEach((x) => { x.campo = x.campo.replace(/^\./, "") || "(raiz)"; });
  if (erros.length === 0) {
    varrerConteudo(conteudo, politica, erros, avisos);
    verificarConsistencia(conteudo, { hoje, base }, erros, avisos);
  }
  // linha aproximada de cada achado, para a anotação apontar o lugar no arquivo
  const linhas = texto.split("\n");
  for (const x of [...erros, ...avisos]) x.linha ??= localizar(linhas, conteudo, x.campo);
  return { erros, avisos, conteudo };
}

function localizar(linhas, conteudo, campo) {
  if (!conteudo || campo.startsWith("(")) return 1;
  let v = conteudo;
  for (const p of campo.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean)) v = v?.[p];
  const chave = campo.split(".").pop().replace(/\[\d+\]$/, "");
  if (typeof v === "string") {
    const trecho = JSON.stringify(v).slice(0, 40);
    const i = linhas.findIndex((l) => l.includes(trecho.slice(0, -1)));
    if (i >= 0) return i + 1;
  }
  const j = linhas.findIndex((l) => l.includes(`"${chave}"`));
  return j >= 0 ? j + 1 : 1;
}

/** Diferenças por campo entre duas versões (para o resumo da prévia). */
export function diferencas(antes, depois) {
  const achatar = (v, c = "", s = {}) => {
    if (Array.isArray(v)) v.forEach((x, i) => achatar(x, `${c}[${i}]`, s));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) achatar(x, c ? `${c}.${k}` : k, s);
    else s[c] = v;
    return s;
  };
  const a = achatar(antes ?? {}), d = achatar(depois ?? {});
  return [...new Set([...Object.keys(a), ...Object.keys(d)])]
    .filter((k) => a[k] !== d[k])
    .map((campo) => ({ campo, antes: a[campo], depois: d[campo] }));
}
