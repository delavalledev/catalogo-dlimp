const fs = require("fs");

const arquivo = "./data/produtos-online.json";

const dados = JSON.parse(fs.readFileSync(arquivo, "utf8"));

console.log("");
console.log("================================");
console.log(" TESTE DO CATALOGO");
console.log("================================");
console.log("");
console.log("Tipo:", Array.isArray(dados) ? "ARRAY" : typeof dados);
console.log("Quantidade:", Array.isArray(dados) ? dados.length : "NAO E ARRAY");
console.log("");

if (Array.isArray(dados)) {
    console.log("Primeiro produto:");
    console.log(dados[0]);

    console.log("");
    console.log("Produto ID 175:");
    console.log(dados.find(p => Number(p.id) === 175));
}
