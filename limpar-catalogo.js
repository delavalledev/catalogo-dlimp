const fs = require("fs");
const path = require("path");

const ARQUIVO = "C:/catalogo-dlimp/data/produtos-online.json";
const RELATORIO = "C:/catalogo-dlimp/relatorio-limpeza.txt";
const BACKUP = "C:/catalogo-dlimp/data/produtos-online.antes-limpeza.json";

function corrigirEncoding(s) {
    let n = String(s ?? "");

    const mapa = {
        "Ã‡": "Ç",
        "Ãƒ": "Ã",
        "Ã‰": "É",
        "ÃŠ": "Ê",
        "Ã": "Á",
        "Ã": "Í",
        "Ã“": "Ó",
        "Ãš": "Ú",
        "Ã£": "ã",
        "Ãµ": "õ",
        "Ã¡": "á",
        "Ã©": "é",
        "Ãª": "ê",
        "Ã­": "í",
        "Ã³": "ó",
        "Ãº": "ú",
        "Ã§": "ç",
        "Ã±": "ñ"
    };

    for (const [a, b] of Object.entries(mapa)) {
        n = n.split(a).join(b);
    }

    return n;
}

function corrigirNome(nome) {

    let n = corrigirEncoding(nome)
        .replace(/\s+/g, " ")
        .trim();

    // Volumes
    n = n.replace(/\b1\s*(?:L|LT|LTS)\b/gi, "1 LITRO");
    n = n.replace(/\b2\s*(?:L|LT|LTS)\b/gi, "2 LITROS");
    n = n.replace(/\b5\s*(?:L|LT|LTS)\b/gi, "5 LITROS");

    // Outras medidas
    n = n.replace(/\b500\s*ML\b/gi, "500 ML");
    n = n.replace(/\b500\s*GR\b/gi, "500 G");
    n = n.replace(/\b1\s*KILO\b/gi, "1 KG");
    n = n.replace(/\b1\s*KG\b/gi, "1 KG");

    // Erros ortográficos conhecidos
    const erros = [
        [/PERCABONATO/gi, "PERCARBONATO"],
        [/DESINGRAXANTE/gi, "DESENGRAXANTE"],
        [/ALCOOL/gi, "ÁLCOOL"],
        [/SABAO/gi, "SABÃO"],
        [/\bLIQUIDO\b/gi, "LÍQUIDO"],
        [/MAMAE/gi, "MAMÃE"],
        [/AVELA/gi, "AVELÃ"],
        [/PIAÇAVA/gi, "PIAÇAVA"]
    ];

    for (const [regex, substituicao] of erros) {
        n = n.replace(regex, substituicao);
    }

    n = n.replace(/\s+/g, " ").trim();

    return n;
}

function preco(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function moeda(v) {
    return preco(v).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

const produtos = JSON.parse(
    fs.readFileSync(ARQUIVO, "utf8")
);

if (!Array.isArray(produtos)) {
    throw new Error("produtos-online.json não é uma lista.");
}

// Backup
fs.copyFileSync(ARQUIVO, BACKUP);

const linhas = [];

linhas.push("============================================");
linhas.push(" LIMPEZA INICIAL DO CATÁLOGO D'LIMP");
linhas.push("============================================");
linhas.push("");
linhas.push(`TOTAL DE PRODUTOS: ${produtos.length}`);
linhas.push("");
linhas.push("REGRAS:");
linhas.push("- Nomes serão padronizados.");
linhas.push("- Abreviações serão expandidas.");
linhas.push("- Caracteres quebrados serão corrigidos.");
linhas.push("- Erros ortográficos conhecidos serão corrigidos.");
linhas.push("- Preço desta limpeza = maior preço encontrado.");
linhas.push("- Estoque NÃO será alterado.");
linhas.push("- Fotos NÃO serão alteradas nesta etapa.");
linhas.push("");

let nomesAlterados = 0;

for (const produto of produtos) {

    const antigo = String(produto.descricao ?? "");
    const novo = corrigirNome(antigo);

    if (antigo !== novo) {

        nomesAlterados++;

        linhas.push("--------------------------------------------");
        linhas.push(`ID: ${produto.id}`);
        linhas.push(`ANTES:  ${antigo}`);
        linhas.push(`DEPOIS: ${novo}`);
        linhas.push("");
    }

    produto.descricao = novo;

    // Preço do próprio catálogo permanece nesta etapa.
    // A equalização com o Sys-On será feita pelo sincronizador.
}

linhas.push("============================================");
linhas.push("RESUMO");
linhas.push("============================================");
linhas.push("");
linhas.push(`Produtos analisados: ${produtos.length}`);
linhas.push(`Nomes alterados:     ${nomesAlterados}`);
linhas.push("");
linhas.push(`BACKUP: ${BACKUP}`);
linhas.push("");
linhas.push("ATENÇÃO:");
linhas.push("Esta etapa alterou somente os nomes no arquivo do site.");
linhas.push("O banco do Sys-On NÃO foi alterado.");
linhas.push("");

fs.writeFileSync(
    ARQUIVO,
    JSON.stringify(produtos, null, 4),
    "utf8"
);

fs.writeFileSync(
    RELATORIO,
    linhas.join("\n"),
    "utf8"
);

console.log("");
console.log("============================================");
console.log(" LIMPEZA CONCLUÍDA");
console.log("============================================");
console.log("");
console.log(`Produtos analisados: ${produtos.length}`);
console.log(`Nomes alterados:     ${nomesAlterados}`);
console.log("");
console.log(`Backup:    ${BACKUP}`);
console.log(`Relatório: ${RELATORIO}`);
console.log("");
console.log("O SYS-ON NÃO FOI ALTERADO.");
console.log("");
