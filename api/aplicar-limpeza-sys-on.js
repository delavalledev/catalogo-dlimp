const db = require("./db");

function corrigirNome(nome) {

    let n = String(nome ?? "")
        .normalize("NFC")
        .replace(/\s+/g, " ")
        .trim();

    const mapa = {
        "Ã": "Á",
        "Ã‰": "É",
        "ÃŠ": "Ê",
        "Ã": "Í",
        "Ã“": "Ó",
        "Ã”": "Ô",
        "Ãš": "Ú",
        "Ãƒ": "Ã",
        "Ã‡": "Ç",
        "Ã£": "ã",
        "Ãµ": "õ",
        "Ã¡": "á",
        "Ã©": "é",
        "Ãª": "ê",
        "Ã­": "í",
        "Ã³": "ó",
        "Ã´": "ô",
        "Ãº": "ú",
        "Ã§": "ç",
        "Ã±": "ñ"
    };

    for (const [a, b] of Object.entries(mapa)) {
        n = n.split(a).join(b);
    }

    n = n.replace(/\b1\s*(?:L|LT|LTS)\b/gi, "1 LITRO");
    n = n.replace(/\b2\s*(?:L|LT|LTS)\b/gi, "2 LITROS");
    n = n.replace(/\b5\s*(?:L|LT|LTS)\b/gi, "5 LITROS");
    n = n.replace(/\b(\d+)\s*LTS\b/gi, "$1 LITROS");

    n = n.replace(/\b500\s*ML\b/gi, "500 ML");
    n = n.replace(/\b(\d+)\s*ML\b/gi, "$1 ML");

    n = n.replace(/\b500\s*GR\b/gi, "500 G");
    n = n.replace(/\b(\d+)\s*GR\b/gi, "$1 G");

    n = n.replace(/\b1\s*KILO\b/gi, "1 KG");
    n = n.replace(/\b(\d+)\s*KILOS?\b/gi, "$1 KG");
    n = n.replace(/\b(\d+)\s*KG\b/gi, "$1 KG");

    n = n.replace(/\b(\d+)\s*CM\b/gi, "$1 CM");

    n = n.replace(/\b(\d+)\s*UNI\b/gi, "$1 UNIDADES");
    n = n.replace(/\bUN\b/gi, "UNIDADES");

    const erros = [
        [/\bALCOOL\b/gi, "ÁLCOOL"],
        [/\bSABAO\b/gi, "SABÃO"],
        [/\bLIQUIDO\b/gi, "LÍQUIDO"],
        [/\bMAMAE\b/gi, "MAMÃE"],
        [/\bBEBE\b/gi, "BEBÊ"],
        [/\bAVELA\b/gi, "AVELÃ"],
        [/\bMOVEIS\b/gi, "MÓVEIS"],
        [/\bSANITARIA\b/gi, "SANITÁRIA"],
        [/\bANATOMICA\b/gi, "ANATÔMICA"],
        [/\bPLASTICO\b/gi, "PLÁSTICO"],
        [/\bPLASTICA\b/gi, "PLÁSTICA"],
        [/\bALUMINIO\b/gi, "ALUMÍNIO"],
        [/\bDESINGRAXANTE\b/gi, "DESENGRAXANTE"],
        [/\bPERCABONATO\b/gi, "PERCARBONATO"],
        [/\bLIIXO\b/gi, "LIXO"],
        [/\bPA DE LIXO\b/gi, "PÁ DE LIXO"]
    ];

    for (const [regex, substituicao] of erros) {
        n = n.replace(regex, substituicao);
    }

    n = n.replace(/\bC\s+GATILHO\b/gi, "COM GATILHO");

    return n.replace(/\s+/g, " ").trim().normalize("NFC");
}

(async () => {

    try {

        const [produtos] = await db.query(`
            SELECT id, descricao
            FROM cadproduto
            WHERE id <> 0
              AND descricao IS NOT NULL
              AND TRIM(descricao) <> ''
        `);

        const alteracoes = [];

        for (const produto of produtos) {

            const antigo = String(produto.descricao)
                .normalize("NFC")
                .trim();

            const novo = corrigirNome(antigo);

            if (antigo !== novo) {
                alteracoes.push({
                    id: produto.id,
                    antes: antigo,
                    depois: novo
                });
            }
        }

        console.log("");
        console.log("============================================");
        console.log(" APLICANDO LIMPEZA DO SYS-ON");
        console.log("============================================");
        console.log("");
        console.log("Alterações:", alteracoes.length);
        console.log("");

        for (const a of alteracoes) {

            await db.query(
                "UPDATE cadproduto SET descricao = ? WHERE id = ?",
                [a.depois, a.id]
            );

            console.log(`OK ID ${a.id}: ${a.antes} -> ${a.depois}`);
        }

        console.log("");
        console.log("============================================");
        console.log(" LIMPEZA CONCLUIDA");
        console.log("============================================");
        console.log("");
        console.log("Produtos alterados:", alteracoes.length);
        console.log("");

    } catch (erro) {

        console.error("");
        console.error("ERRO:", erro.message);
        console.error("");
        process.exitCode = 1;

    } finally {

        await db.end();

    }

})();
