require("dotenv").config();
const db = require("./db");

(async () => {
    const [colunas] = await db.query("DESCRIBE cadproduto");
    console.table(colunas);
    await db.end();
})().catch(erro => {
    console.error(erro);
    process.exit(1);
});
