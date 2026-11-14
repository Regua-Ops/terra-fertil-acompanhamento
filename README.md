# Status Page — Terra Fértil

Página pública de acompanhamento: <https://tf-statuspage.reguaops.lat>. **Todo o texto vem de `content.json`.**
`index.html` é só apresentação: não edite texto nele.

## Como atualizar (pelo navegador)

1. Abra [`content.json`](content.json) e clique no lápis (**Edit this file**). Altere só o que está entre aspas e
   atualize `referenceDate` (formato `AAAA-MM-DD`).
2. **Commit changes…** → marque **Create a new branch … and start a pull request** → **Propose changes** → **Create pull request**.
3. Espere o check **Validar conteúdo e gerar prévia** (cerca de 1 minuto) e abra **Details › Summary**:
   - ❌ **erro**: o resumo e as anotações em *Files changed* dizem o campo e o que corrigir. Edite o arquivo na mesma branch.
   - ⚠️ **aviso**: não bloqueia; confirme que é intencional (ex.: citar a V4 pelo nome).
   - ✅ **válido**: veja a tabela *O que muda* e baixe o artefato **previa-pagina**; abra `previa.html` com duplo clique.
     É a página de verdade com o novo texto, marcada como PRÉVIA.
4. **Merge pull request**. Isto ainda **não** publica.
5. Aba **Actions › Publicar Status Page › Run workflow** (Branch: `main`). O workflow valida de novo e publica só
   `index.html`, `content.json` e `CNAME`. O site muda em cerca de 1 minuto; o navegador pode levar até 10 minutos (cache do GitHub Pages).

Se publicou algo errado: **Revert** do pull request e repita os passos 4–5.
Se o `content.json` no ar estiver inválido, a página mostra um aviso claro de erro e **nenhum texto antigo** — nunca uma cópia velha.

## O que cada campo controla

| Campo | Onde aparece |
|---|---|
| `referenceDate` | "Referência: dd/mm/aaaa" no topo |
| `summary` | resumo no topo |
| `achievements` (`intro`, `items[]`, `note`) | "O que já foi realizado" |
| `phases[]` (uma com `"current": true`), `closes` | "Onde estamos" |
| `week.done / blocked / next` | "Esta semana" (Fechou / Travou / Próximo) |
| `campaigns` | "Planejamento de novas campanhas" |
| `dependencies[]` (status: Pendente · Em andamento · Recebido) | "O que depende de vocês" |
| `deliveries[]` (status: Planejada · Em preparação · Entregue; `link` vazio ou https permitido) | "Próxima entrega" |
| `contact` | rodapé |

`tone` (selos coloridos) aceita `concluido`, `andamento` ou `pendente`.

## O que pode ser público

As regras ficam em [`politica-publica.json`](politica-publica.json), por campo. Resumo:

- **Bloqueia (erro):** telefone, e-mail ou URL fora da lista (contato público só em `contact` e só os listados na política);
  CPF; token/senha/chave; nomes de variáveis internas do portal; HTML; link que não seja https ou não esteja em `linksPermitidos`
  (documentos do portal exigem login: use `…/entrada`); data futura ou anterior à versão no ar.
- **Avisa:** V4 citada pelo nome, ferramentas de IA, IDs do Linear (`TER-…`), valores em reais, referência de commit,
  referência com mais de 8 dias, data citada em `achievements.intro` diferente de `referenceDate`.
- **Não bloqueia por regra genérica** nomes, números, datas, versões ou porcentagens: informação institucional legítima passa.
- O owner decide o que entra nas listas e pode acrescentar `bloqueios` e `avisos` próprios no mesmo arquivo.
  O repositório é público: nunca coloque dados pessoais nele, nem na política.

## Verificar localmente (opcional)

```
node --test "tests/*.test.mjs"
node scripts/validar-conteudo.mjs content.json
node scripts/gerar-previa.mjs content.json _previa    # abre _previa/previa.html
```
