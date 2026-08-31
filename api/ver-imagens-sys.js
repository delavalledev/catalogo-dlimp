const db = require("./db");

db.query(`
    SELECT
        id,
        descricao,
        imagem
    FROM cadproduto
    WHERE imagem IS NOT NULL
      AND TRIM(imagem) <> ''
      AND imagem <> 'sem_imagem.png'
    LIMIT 20
`)
.then(([r]) => {
    console.table(r);
    return db.end();
})
.catch(e => {
    console.error("ERRO:", e);
    return db.end();
});
