const path = require("path");
const http = require("http");
const fs = require("fs");
const { execFileSync } = require("child_process");

// Carrega EXPLICITAMENTE o .env usado pelo Sys-On
require("dotenv").config({
    path: path.join(__dirname, "..", "api", ".env")
});

const db = require("../api/db");

const PORT = 3100;

const raiz = path.join(__dirname, "..");
const arquivoAjustes = path.join(raiz, "data", "ajustes-produtos.json");
const pastaFotos = path.join(raiz, "img", "produtos");

fs.mkdirSync(pastaFotos, { recursive: true });

function responder(res, status, dados) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end(JSON.stringify(dados, null, 2));
}

async function testarBanco() {
    await db.query("SELECT 1");
    return true;
}

const server = http.createServer(async (req, res) => {

    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });
        return res.end();
    }

    if (req.method === "GET" && req.url === "/saude") {
        try {
            await testarBanco();

            return responder(res, 200, {
                ok: true,
                servico: "Admin D'Limp",
                banco: "conectado"
            });

        } catch (erro) {
            console.error("ERRO BANCO:", erro);

            return responder(res, 500, {
                ok: false,
                servico: "Admin D'Limp",
                banco: "desconectado",
                erro: erro.message
            });
        }
    }

    if (req.method === "GET" && req.url === "/ajustes") {
        try {
            if (!fs.existsSync(arquivoAjustes)) {
                fs.writeFileSync(arquivoAjustes, "{}", "utf8");
            }

            const texto = fs.readFileSync(arquivoAjustes, "utf8");

            return responder(
                res,
                200,
                texto.trim() ? JSON.parse(texto) : {}
            );

        } catch (erro) {
            return responder(res, 500, {
                ok: false,
                erro: erro.message
            });
        }
    }

    return responder(res, 404, {
        ok: false,
        erro: "Rota não encontrada."
    });
});

server.listen(PORT, "127.0.0.1", async () => {

    console.log("");
    console.log("=====================================");
    console.log(" ADMIN API D'Limp");
    console.log("=====================================");
    console.log(`http://127.0.0.1:${PORT}`);

    try {
        await testarBanco();
        console.log("Banco Sys-On: conectado pela API");
    } catch (erro) {
        console.log("ERRO AO CONECTAR AO BANCO:");
        console.log(erro.message);
    }

    console.log("");
});
