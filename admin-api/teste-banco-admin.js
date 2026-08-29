const path = require("path");

// Usa o dotenv que já existe na API
require("../api/node_modules/dotenv").config({
    path: path.join(__dirname, "..", "api", ".env")
});

const db = require("../api/db");

(async () => {

    console.log("");
    console.log("======================================");
    console.log(" TESTE DE CONEXAO ADMIN -> SYS-ON");
    console.log("======================================");
    console.log("");

    console.log("DB_HOST:", process.env.DB_HOST);
    console.log("DB_PORT:", process.env.DB_PORT);
    console.log("DB_NAME:", process.env.DB_NAME);
    console.log("");

    try {

        const [resultado] = await db.query("SELECT 1 AS conectado");

        console.log("BANCO SYS-ON: CONECTADO");
        console.table(resultado);

    } catch (erro) {

        console.log("");
        console.log("ERRO AO CONECTAR AO SYS-ON:");
        console.log(erro.message);

        if (erro.code) {
            console.log("CODIGO:", erro.code);
        }

        process.exitCode = 1;

    } finally {

        await db.end();

    }

})();
