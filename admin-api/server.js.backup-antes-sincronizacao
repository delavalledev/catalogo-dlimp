const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process"); 

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
        return responder(res, 200, {
            ok: true,
            servico: "Admin D'Limp"
        });
    }

    if (req.method === "GET" && req.url === "/ajustes") {
        try {
            return responder(res, 200, lerAjustes());
        } catch (erro) {
            return responder(res, 500, { erro: erro.message });
        }
    }

    if (req.method === "POST" && req.url === "/ajustes") {
        try {
            const corpo = await lerCorpo(req);
            const dados = JSON.parse(corpo);

            salvarAjustes(dados);

            return responder(res, 200, {
                ok: true,
                mensagem: "Ajustes salvos."
            });

        } catch (erro) {
            return responder(res, 400, { erro: erro.message });
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

            const buffer = Buffer.from(base64, "base64");
            fs.writeFileSync(destino, buffer);

            const ajustes = lerAjustes();

            if (!ajustes[id]) {
                ajustes[id] = {};
            }

            ajustes[id].imagem = `img/produtos/${nomeArquivo}`;

            salvarAjustes(ajustes);

            return responder(res, 200, {
                ok: true,
                imagem: `img/produtos/${nomeArquivo}`
            });

        } catch (erro) {
            return responder(res, 400, {
                erro: erro.message
            });
        }
    }
    if (req.method === "POST" && req.url === "/publicar") {
    try {
        execFileSync("git", ["add", "-A"], {
            cwd: raiz,
            encoding: "utf8"
        });

        try {
            execFileSync("git", ["diff", "--cached", "--quiet"], {
                cwd: raiz
            });

            return responder(res, 200, {
                ok: true,
                publicou: false,
                mensagem: "Nenhuma alteração nova para publicar."
            });

        } catch {
            // Se o git diff retornar diferente de zero,
            // existem alterações e podemos continuar.
        }

        const data = new Date().toLocaleString("pt-BR");

        execFileSync(
            "git",
            ["commit", "-m", `Atualizacao pelo Admin - ${data}`],
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
        console.error("Erro ao publicar:", erro);

        return responder(res, 500, {
            ok: false,
            erro: erro.stderr?.toString() || erro.message
        });
    }
}
    responder(res, 404, {
        erro: "Rota não encontrada."
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log("=====================================");
    console.log(" ADMIN API D'Limp");
    console.log("=====================================");
    console.log(`http://127.0.0.1:${PORT}`);
    console.log("");
});
