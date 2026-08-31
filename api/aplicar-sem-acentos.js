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
        `);

        let alterados = 0;

        for (const produto of produtos) {

            const antigo = String(produto.descricao);
            const novo = semAcentos(antigo);

            if (antigo === novo) {
                continue;
            }

            await db.query(
                "UPDATE cadproduto SET descricao = ? WHERE id = ?",
                [novo, produto.id]
            );

            alterados++;

            console.log(
                `OK ID ${produto.id}: ${antigo} -> ${novo}`
            );
        }

        console.log("");
        console.log("============================================");
        console.log(" SYS-ON SEM ACENTOS");
        console.log("============================================");
        console.log("");
        console.log("Produtos analisados:", produtos.length);
        console.log("Produtos alterados: ", alterados);
        console.log("");
        console.log("Preço: NÃO ALTERADO");
        console.log("Estoque: NÃO ALTERADO");
        console.log("Imagem: NÃO ALTERADA");
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
