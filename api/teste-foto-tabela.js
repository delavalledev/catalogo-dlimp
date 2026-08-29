require("dotenv").config();
const db = require("./db");

(async () => {
    const [r] = await db.query(`
        SELECT
            id,
            id_produto,
            nome,
            LEFT(foto, 150) AS inicio_foto,
            LENGTH(foto) AS tamanho_foto
        FROM foto_produtos
        WHERE id_produto = '441'
    `);

    console.table(r);
    await db.end();
})().catch(erro => {
    console.error(erro);
    process.exit(1);
});
