const db = require("./db");

db.query(`
    SELECT
        id,
        descricao,
        LENGTH(foto) AS tamanho_foto,
        imagem
    FROM cadproduto
    WHERE foto IS NOT NULL
      AND LENGTH(foto) > 0
    LIMIT 10
`)
.then(([r]) => {
    console.table(r);
    return db.end();
})
.catch(e => {
    console.error("ERRO:", e);
    return db.end();
});
