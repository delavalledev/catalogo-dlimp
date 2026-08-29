const path = require("path");
const http = require("http");
const fs = require("fs");
const { execFileSync } = require("child_process");

require("../api/node_modules/dotenv").config({
    path: path.join(__dirname, "api", ".env")
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

function lerAjustes() {
    if (!fs.existsSync(arquivoAjustes)) {
        fs.writeFileSync(arquivoAjustes, "{}", "utf8");
    }

    const texto = fs.readFileSync(arquivoAjustes, "utf8")
        .replace(/^\uFEFF/, "");

    return texto.trim() ? JSON.parse(texto) : {};
}

function salvarAjustes(dados) {
    fs.writeFileSync(
        arquivoAjustes,
        JSON.stringify(dados, null, 2),
        "utf8"
    );
}

function lerCorpo(req) {
    return new Promise((resolve, reject) => {
        let corpo = "";

        req.on("data", parte => {
            corpo += parte;

            if (corpo.length > 15 * 1024 * 1024) {
                reject(new Error("Arquivo muito grande."));
                req.destroy();
            }
        });

        req.on("end", () => resolve(corpo));
        req.on("error", reject);
    });
}

async function atualizarSysOn(id, dados) {

    const campos = [];
    const valores = [];

    if (dados.descricao !== undefined) {
        campos.push("descricao = ?");
        valores.push(String(dados.descricao).trim());
    }

    if (dados.preco !== undefined) {
        const preco = Number(dados.preco);

        if (!Number.isFinite(preco) || preco < 0) {
            throw new Error("Preço inválido.");
        }

        campos.push("preco_venda = ?");
        valores.push(preco);
    }

    if (campos.length === 0) {
        return {
            alterado: false,
            mensagem: "Nenhum campo para alterar."
        };
    }

    valores.push(Number(id));

    const [resultado] = await db.query(
        `
        UPDATE cadproduto
        SET ${campos.join(", ")}
        WHERE id = ?
        LIMIT 1
        `,
        valores
    );

    return {
        alterado: resultado.affectedRows > 0,
        affectedRows: resultado.affectedRows
    };
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

            await db.query("SELECT 1");

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
            return responder(res, 200, lerAjustes());

        } catch (erro) {

            return responder(res, 500, {
                ok: false,
                erro: erro.message
            });
        }
    }

    if (req.method === "POST" && req.url === "/ajustes") {

        try {

            const corpo = await lerCorpo(req);
            const dados = JSON.parse(corpo);

            salvarAjustes(dados);

            const resultados = [];

            for (const [id, produto] of Object.entries(dados)) {

                if (!produto || typeof produto !== "object") {
                    continue;
                }

                if (
                    produto.descricao === undefined &&
                    produto.preco === undefined
                ) {
                    continue;
                }

                try {

                    const resultado = await atualizarSysOn(
                        id,
                        produto
                    );

                    resultados.push({
                        id,
                        ...resultado
                    });

                } catch (erro) {

                    resultados.push({
                        id,
                        alterado: false,
                        erro: erro.message
                    });
                }
            }

            return responder(res, 200, {
                ok: true,
                mensagem: "Ajustes salvos e enviados ao Sys-On.",
                resultados
            });

        } catch (erro) {

            console.error("ERRO /ajustes:", erro);

            return responder(res, 400, {
                ok: false,
                erro: erro.message
            });
        }
    }

    if (req.method === "POST" && req.url === "/foto") {

        try {

            const corpo = await lerCorpo(req);
            const dados = JSON.parse(corpo);

            const id = String(dados.id || "").replace(/\D/g, "");
            const base64 = dados.base64;
            const tipo = String(dados.tipo || "").toLowerCase();

            if (!id || !base64) {
                throw new Error("Produto ou imagem inválidos.");
            }

            const extensoes = {
                "image/jpeg": "jpg",
                "image/jpg": "jpg",
                "image/png": "png",
                "image/webp": "webp"
            };

            const extensao = extensoes[tipo];

            if (!extensao) {
                throw new Error("Use JPG, PNG ou WEBP.");
            }

            const nomeArquivo = `${id}.${extensao}`;
            const destino = path.join(pastaFotos, nomeArquivo);

            fs.writeFileSync(
                destino,
                Buffer.from(base64, "base64")
            );

            const ajustes = lerAjustes();

            if (!ajustes[id]) {
                ajustes[id] = {};
            }

            ajustes[id].imagem =
                `img/produtos/${nomeArquivo}`;

            salvarAjustes(ajustes);

            /*
             * Guarda também o nome da imagem no cadastro do Sys-On.
             */
            await db.query(
                `
                UPDATE cadproduto
                SET imagem = ?
                WHERE id = ?
                LIMIT 1
                `,
                [nomeArquivo, Number(id)]
            );

            return responder(res, 200, {
                ok: true,
                imagem: `img/produtos/${nomeArquivo}`,
                sysOn: true
            });

        } catch (erro) {

            console.error("ERRO /foto:", erro);

            return responder(res, 400, {
                ok: false,
                erro: erro.message
            });
        }
    }

    if (req.method === "POST" && req.url === "/publicar") {

        try {

            execFileSync(
                "git",
                ["add", "-A"],
                {
                    cwd: raiz,
                    encoding: "utf8"
                }
            );

            try {

                execFileSync(
                    "git",
                    ["diff", "--cached", "--quiet"],
                    {
                        cwd: raiz
                    }
                );

                return responder(res, 200, {
                    ok: true,
                    publicou: false,
                    mensagem: "Nenhuma alteração nova para publicar."
                });

            } catch {
                // Existem alterações.
            }

            const data =
                new Date().toLocaleString("pt-BR");

            execFileSync(
                "git",
                [
                    "commit",
                    "-m",
                    `Atualizacao pelo Admin - ${data}`
                ],
                {
                    cwd: raiz,
                    encoding: "utf8"
                }
            );

            execFileSync(
                "git",
                ["push", "origin", "main"],
                {
                    cwd: raiz,
                    encoding: "utf8"
                }
            );

            return responder(res, 200, {
                ok: true,
                publicou: true,
                mensagem: "Alterações publicadas com sucesso."
            });

        } catch (erro) {

            console.error("ERRO /publicar:", erro);

            return responder(res, 500, {
                ok: false,
                erro: erro.stderr?.toString() || erro.message
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
        await db.query("SELECT 1");
        console.log("Banco Sys-On: conectado");
    } catch (erro) {
        console.log("ERRO BANCO:", erro.message);
    }

    console.log("");
});


