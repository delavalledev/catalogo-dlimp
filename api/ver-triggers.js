require("dotenv").config();
const db = require("./db");

(async () => {
    const [triggers] = await db.query("SHOW TRIGGERS");
    console.table(triggers);
    await db.end();
})().catch(erro => {
    console.error(erro);
    process.exit(1);
});
