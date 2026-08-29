require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const db = require("./db");

const app = express();

const PORT = Number(process.env.PORT || 3000);

const PASTA_IMAGENS = "C:/SysOnPDV-Pro/imgProdutos";
const URL_BASE = `http://127.0.0.1:${PORT}`;

/* =========================================================
   ConfiguraÃ§Ãµes gerais
   ========================================================= */

app.disable("x-powered-by");

app.use(cors());

app.use(express.json({
    limit: "1mb"
}));

/* Disponibiliza as imagens do Sys-On pela API */
app.use(
    "/imagens",
    express.static(PASTA_IMAGENS, {
        fallthrough: true,
        maxAge: "1h"
    })
);

/* =========================================================
   FunÃ§Ãµes auxiliares
   ========================================================= */

function obterImagemProduto(id) {
    const nomeImagem = `${id}.jpg`;
    const caminhoImagem = path.join(PASTA_IMAGENS, nomeImagem);

    if (fs.existsSync(caminhoImagem)) {
        return `${URL_BASE}/imagens/${nomeImagem}`;
    }

    return `${URL_BASE}/imagens/sem_imagem.png`;
}

function converterProduto(produto) {
    const estoque = Number(produto.estoque || 0);
    const preco = Number(produto.preco_venda || 0);

    return {
        id: Number(produto.id),
        descricao: String(produto.descricao || "").trim(),

        preco_venda: preco,
        preco: preco,

        estoque: estoque,
        disponivel: String(produto.ForaDeUso || "").trim().toUpperCase() !== "SIM",

        ForaDeUso: produto.ForaDeUso,

        imagem: obterImagemProduto(produto.id)
    };
}

/* =========================================================
   Rotas
   ========================================================= */

app.get("/", (req, res) => {
    res.json({
        sucesso: true,
        nome: "API D'Limp",
        mensagem: "API funcionando."
    });
});

app.get("/saude", async (req, res) => {
    try {
        await db.query("SELECT 1");

        res.json({
            sucesso: true,
            api: "online",
            banco: "conectado",
            horario: new Date().toISOString()
        });
    } catch (erro) {
        console.error("Erro no teste do banco:", erro);

        res.status(500).json({
            sucesso: false,
            api: "online",
            banco: "desconectado",
            erro: erro.message
        });
    }
});

app.get("/produtos", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                id,
                descricao,
                preco_venda,
                estoque,
                ForaDeUso
            FROM cadproduto
            WHERE
                id <> 0
                AND descricao IS NOT NULL
                AND TRIM(descricao) <> ''
                AND COALESCE(ForaDeUso, 'NÃƒO') <> 'SIM'
            ORDER BY descricao ASC
        `);

        const produtos = rows.map(converterProduto);

        res.json(produtos);
    } catch (erro) {
        console.error("Erro ao consultar produtos:", erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao consultar banco.",
            detalhes: erro.message
        });
    }
});

app.get("/produtos/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isFinite(id)) {
            return res.status(400).json({
                sucesso: false,
                erro: "ID invÃ¡lido."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                id,
                descricao,
                preco_venda,
                estoque,
                ForaDeUso
            FROM cadproduto
            WHERE
                id = ?
                AND COALESCE(ForaDeUso, 'NÃƒO') <> 'SIM'
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                erro: "Produto nÃ£o encontrado."
            });
        }

        res.json(converterProduto(rows[0]));
    } catch (erro) {
        console.error("Erro ao consultar produto:", erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao consultar produto.",
            detalhes: erro.message
        });
    }
});

/* =========================================================
   InicializaÃ§Ã£o
   ========================================================= */

app.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log("======================================");
    console.log(" API D'Limp iniciada com sucesso");
    console.log("======================================");
    console.log(`API:       ${URL_BASE}`);
    console.log(`SaÃºde:     ${URL_BASE}/saude`);
    console.log(`Produtos:  ${URL_BASE}/produtos`);
    console.log(`Imagem:    ${URL_BASE}/imagens/12.jpg`);
    console.log("");
});

