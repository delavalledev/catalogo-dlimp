require("./db").query(`
    SELECT id, descricao, preco, preco_venda, estoque, imagem
    FROM cadproduto
    WHERE id = 175
`).then(([r]) => {
    console.table(r);
    return require("./db").end();
}).catch(e => {
    console.error(e);
});
