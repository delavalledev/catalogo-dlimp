require("dotenv").config();
const db = require("./db");

(async () => {
    const [r] = await db.query(`
        SELECT
            id,
            descricao,
            nome,
            preco,
            preco_venda,
            atacado,
            preco_atacado,
            estoque,
            ForaDeUso,
            LENGTH(foto) AS tamanho_foto,
            imagem
        FROM cadproduto
        WHERE id = 175
    `);

    console.table(r);
    await db.end();
})().catch(erro => {
    console.error(erro);
    process.exit(1);
});
