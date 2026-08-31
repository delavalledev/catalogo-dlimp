const db = require("./db");

function semAcentos(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .normalize("NFC")
        .replace(/\s+/g, " ")
        .trim();
}

(async () => {

    try {

        const [produtos] = await db.query(`
            SELECT id, descricao
            FROM cadproduto
            WHERE id <> 0
              AND descricao IS NOT NULL
              AND TRIM(descricao) <> ''
            ORDER BY id
        `);

        const alteracoes = produtos
            .map(p => ({
                id: p.id,
                antes: p.descricao,
                depois: semAcentos(p.descricao)
            }))
            .filter(p => p.antes !== p.depois);

        console.log("");
        console.log("============================================");
        console.log(" PRÉVIA - SYS-ON SEM ACENTOS");
        console.log("============================================");
        console.log("");
        console.log("Produtos analisados:", produtos.length);
        console.log("Nomes que perderão acentos:", alteracoes.length);
        console.log("");

        for (const a of alteracoes) {
            console.log(`ID ${a.id}`);
            console.log(`ANTES : ${a.antes}`);
            console.log(`DEPOIS: ${a.depois}`);
            console.log("--------------------------------------------");
        }

        console.log("");
        console.log("NENHUM DADO FOI ALTERADO.");
        console.log("");

    } catch (erro) {
        console.error("ERRO:", erro.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }

})();
