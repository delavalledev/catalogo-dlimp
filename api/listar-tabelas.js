require("dotenv").config();
const db = require("./db");

(async () => {
    const [tabelas] = await db.query("SHOW TABLES");

    console.log("=== TABELAS DO BANCO ===");
    console.table(tabelas);

    await db.end();
})().catch(erro => {
    console.error(erro);
    process.exit(1);
});
