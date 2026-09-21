const path = require("path");
const http = require("http");
const fs = require("fs");
const { execFileSync } = require("child_process");

require("../api/node_modules/dotenv").config({
    path: path.join(__dirname, "..", "api", ".env")
});

const db = require("../api/db");

const PORT = 3100;

const raiz = path.join(__dirname, "..");

const arquivoAjustes = path.join(
    raiz,
    "data",
    "ajustes-produtos.json"
);

const pastaFotos = path.join(
    raiz,
    "img",
    "produtos"
);

fs.mkdirSync(pastaFotos, {
    recursive: true
});

/* =========================================================
   RESPOSTA HTTP
   ========================================================= */

function responder(res, status, dados) {

    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end(
        JSON.stringify(
            dados,
            null,
            2
        )
    );
}

/* =========================================================
   AJUSTES
   ========================================================= */

function lerAjustes() {

    if (!fs.existsSync(arquivoAjustes)) {

        fs.writeFileSync(
            arquivoAjustes,
            "{}",
            "utf8"
        );
    }

    const texto = fs
        .readFileSync(
            arquivoAjustes,
            "utf8"
        )
        .replace(/^\uFEFF/, "");

    return texto.trim()
        ? JSON.parse(texto)
        : {};
}

function salvarAjustes(dados) {

    fs.writeFileSync(
        arquivoAjustes,
        JSON.stringify(
            dados,
            null,
            2
        ),
        "utf8"
    );
}

/* =========================================================
   PRODUTOS ONLINE
   ========================================================= */

function lerProdutosOnline() {

    const arquivo = path.join(
        raiz,
        "data",
        "produtos-online.json"
    );

    if (!fs.existsSync(arquivo)) {

        throw new Error(
            "Arquivo produtos-online.json não encontrado."
        );
    }

    const texto = fs
        .readFileSync(
            arquivo,
            "utf8"
        )
        .replace(/^\uFEFF/, "");

    return {
        arquivo,
        dados: texto.trim()
            ? JSON.parse(texto)
            : []
    };
}

function salvarProdutosOnline(
    arquivo,
    dados
) {

    fs.writeFileSync(
        arquivo,
        JSON.stringify(
            dados,
            null,
            2
        ),
        "utf8"
    );
}

/* =========================================================
   CORPO DA REQUISICAO
   ========================================================= */

function lerCorpo(req) {

    return new Promise(
        (resolve, reject) => {

            let corpo = "";

            req.on(
                "data",
                parte => {

                    corpo += parte;

                    if (
                        corpo.length >
                        15 * 1024 * 1024
                    ) {

                        reject(
                            new Error(
                                "Arquivo muito grande."
                            )
                        );

                        req.destroy();
                    }
                }
            );

            req.on(
                "end",
                () => resolve(corpo)
            );

            req.on(
                "error",
                reject
            );
        }
    );
}

/* =========================================================
   SERVIDOR
   ========================================================= */

const server = http.createServer(
    async (req, res) => {

        /* -------------------------------------------------
           OPTIONS
        ------------------------------------------------- */

        if (req.method === "OPTIONS") {

            res.writeHead(
                204,
                {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods":
                        "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers":
                        "Content-Type"
                }
            );

            return res.end();
        }

        /* -------------------------------------------------
           SAUDE
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            req.url === "/saude"
        ) {

            try {

                await db.query(
                    "SELECT 1"
                );

                return responder(
                    res,
                    200,
                    {
                        ok: true,
                        servico: "Admin D'Limp",
                        banco: "conectado"
                    }
                );

            } catch (erro) {

                console.error(
                    "ERRO BANCO:",
                    erro
                );

                return responder(
                    res,
                    500,
                    {
                        ok: false,
                        servico: "Admin D'Limp",
                        banco: "desconectado",
                        erro: erro.message
                    }
                );
            }
        }

        /* -------------------------------------------------
           GET AJUSTES
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            req.url === "/ajustes"
        ) {

            try {

                return responder(
                    res,
                    200,
                    lerAjustes()
                );

            } catch (erro) {

                return responder(
                    res,
                    500,
                    {
                        ok: false,
                        erro: erro.message
                    }
                );
            }
        }

        /* -------------------------------------------------
           POST AJUSTES

           IMPORTANTE:
           Aqui NAO alteramos o Sys-On.

           Apenas registramos a alteração.

           O sincronizador será responsável
           por aplicar no banco.
        ------------------------------------------------- */

        if (
            req.method === "POST" &&
            req.url === "/ajustes"
        ) {

            try {

                const corpo =
                    await lerCorpo(req);

                const dados =
                    JSON.parse(corpo);

                if (
                    !dados ||
                    typeof dados !== "object" ||
                    Array.isArray(dados)
                ) {

                    throw new Error(
                        "Formato de ajustes inválido."
                    );
                }

                const ajustes =
                    lerAjustes();

                for (
                    const [id, produto]
                    of Object.entries(dados)
                ) {

                    const numeroId =
                        Number(id);

                    if (
                        !Number.isInteger(numeroId) ||
                        numeroId <= 0
                    ) {
                        continue;
                    }

                    if (
                        !produto ||
                        typeof produto !== "object"
                    ) {
                        continue;
                    }

                    if (
                        ajustes[id] &&
                        typeof ajustes[id] === "object"
                    ) {

                        ajustes[id] = {
                            ...ajustes[id],
                            ...produto
                        };

                    } else {

                        ajustes[id] = {
                            ...produto
                        };
                    }
                }

                salvarAjustes(
                    ajustes
                );

                return responder(
                    res,
                    200,
                    {
                        ok: true,
                        mensagem:
                            "Ajustes registrados. O sincronizador aplicará as alterações no Sys-On.",
                        resultados:
                            Object.keys(dados).map(
                                id => ({
                                    id,
                                    registrado: true
                                })
                            )
                    }
                );

            } catch (erro) {

                console.error(
                    "ERRO /ajustes:",
                    erro
                );

                return responder(
                    res,
                    400,
                    {
                        ok: false,
                        erro: erro.message
                    }
                );
            }
        }

        /* -------------------------------------------------
           EXCLUIR DO CATALOGO

           IMPORTANTE:
           Nao exclui do Sys-On.

           A exclusao no Sys-On continua sendo
           feita somente dentro do Sys-On.
        ------------------------------------------------- */

        if (
            req.method === "POST" &&
            req.url === "/excluir"
        ) {

            try {

                const corpo =
                    await lerCorpo(req);

                const dados =
                    JSON.parse(corpo);

                const id =
                    Number(dados.id);

                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {

                    throw new Error(
                        "ID do produto inválido."
                    );
                }

                const {
                    arquivo,
                    dados: catalogo
                } =
                    lerProdutosOnline();

                let produtos;
                let salvar;

                /*
                 * ARRAY ENVELOPE
                 */

                if (
                    Array.isArray(catalogo) &&
                    catalogo.length === 1 &&
                    Array.isArray(
                        catalogo[0]?.value
                    )
                ) {

                    produtos =
                        catalogo[0].value;

                    salvar = () => {

                        catalogo[0].value =
                            produtos;

                        catalogo[0].Count =
                            produtos.length;

                        salvarProdutosOnline(
                            arquivo,
                            catalogo
                        );
                    };

                }

                /*
                 * OBJECT ENVELOPE
                 */

                else if (
                    catalogo &&
                    Array.isArray(
                        catalogo.value
                    )
                ) {

                    produtos =
                        catalogo.value;

                    salvar = () => {

                        catalogo.value =
                            produtos;

                        catalogo.Count =
                            produtos.length;

                        salvarProdutosOnline(
                            arquivo,
                            catalogo
                        );
                    };

                }

                /*
                 * OBJECT PRODUTOS
                 */

                else if (
                    catalogo &&
                    Array.isArray(
                        catalogo.produtos
                    )
                ) {

                    produtos =
                        catalogo.produtos;

                    salvar = () => {

                        catalogo.produtos =
                            produtos;

                        catalogo.Count =
                            produtos.length;

                        salvarProdutosOnline(
                            arquivo,
                            catalogo
                        );
                    };

                }

                /*
                 * ARRAY DIRETO
                 */

                else if (
                    Array.isArray(catalogo)
                ) {

                    produtos =
                        catalogo;

                    salvar = () => {

                        salvarProdutosOnline(
                            arquivo,
                            produtos
                        );
                    };

                }

                else {

                    throw new Error(
                        "Formato do produtos-online.json não reconhecido."
                    );
                }

                const indice =
                    produtos.findIndex(
                        p =>
                            Number(p.id) === id
                    );

                if (indice === -1) {

                    throw new Error(
                        `Produto ID ${id} não encontrado no catálogo.`
                    );
                }

                const produto =
                    produtos[indice];

                produtos.splice(
                    indice,
                    1
                );

                salvar();

                /*
                 * Remove ajustes pendentes.
                 */

                const ajustes =
                    lerAjustes();

                if (
                    Object.prototype.hasOwnProperty.call(
                        ajustes,
                        String(id)
                    )
                ) {

                    delete ajustes[
                        String(id)
                    ];

                    salvarAjustes(
                        ajustes
                    );
                }

                return responder(
                    res,
                    200,
                    {
                        ok: true,
                        id,
                        descricao:
                            produto.descricao ||
                            "",
                        removidoDoCatalogo:
                            true,
                        mensagem:
                            "Produto removido do catálogo. O Sys-On não foi alterado."
                    }
                );

            } catch (erro) {

                console.error(
                    "ERRO /excluir:",
                    erro
                );

                return responder(
                    res,
                    400,
                    {
                        ok: false,
                        erro: erro.message
                    }
                );
            }
        }

        /* -------------------------------------------------
           FOTO

           Salva somente no SITE e registra o ajuste.

           O sincronizador posteriormente enviará
           a foto para o Sys-On.
        ------------------------------------------------- */

        if (
            req.method === "POST" &&
            req.url === "/foto"
        ) {

            try {

                const corpo =
                    await lerCorpo(req);

                const dados =
                    JSON.parse(corpo);

                const id =
                    String(
                        dados.id || ""
                    ).replace(
                        /\D/g,
                        ""
                    );

                const base64 =
                    dados.base64;

                const tipo =
                    String(
                        dados.tipo || ""
                    ).toLowerCase();

                if (
                    !id ||
                    !base64
                ) {

                    throw new Error(
                        "Produto ou imagem inválidos."
                    );
                }

                const extensoes = {
                    "image/jpeg": "jpg",
                    "image/jpg": "jpg",
                    "image/png": "png",
                    "image/webp": "webp"
                };

                const extensao =
                    extensoes[tipo];

                if (!extensao) {

                    throw new Error(
                        "Use JPG, PNG ou WEBP."
                    );
                }

                const nomeArquivo =
                    `${id}.${extensao}`;

                const destino =
                    path.join(
                        pastaFotos,
                        nomeArquivo
                    );

                fs.writeFileSync(
                    destino,
                    Buffer.from(
                        base64,
                        "base64"
                    )
                );

                const ajustes =
                    lerAjustes();

                if (!ajustes[id]) {
                    ajustes[id] = {};
                }

                ajustes[id].imagem =
                    `img/produtos/${nomeArquivo}`;

                salvarAjustes(
                    ajustes
                );

                return responder(
                    res,
                    200,
                    {
                        ok: true,
                        imagem:
                            `img/produtos/${nomeArquivo}`,
                        sincronizacao:
                            "pendente",
                        mensagem:
                            "Foto salva no site. O sincronizador enviará a imagem para o Sys-On."
                    }
                );

            } catch (erro) {

                console.error(
                    "ERRO /foto:",
                    erro
                );

                return responder(
                    res,
                    400,
                    {
                        ok: false,
                        erro: erro.message
                    }
                );
            }
        }

        /* -------------------------------------------------
           PUBLICAR
        ------------------------------------------------- */

        if (
            req.method === "POST" &&
            req.url === "/publicar"
        ) {

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
                        [
                            "diff",
                            "--cached",
                            "--quiet"
                        ],
                        {
                            cwd: raiz
                        }
                    );

                    return responder(
                        res,
                        200,
                        {
                            ok: true,
                            publicou: false,
                            mensagem:
                                "Nenhuma alteração nova para publicar."
                        }
                    );

                } catch {
                    // Existem alterações.
                }

                const data =
                    new Date().toLocaleString(
                        "pt-BR"
                    );

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
                    [
                        "push",
                        "origin",
                        "main"
                    ],
                    {
                        cwd: raiz,
                        encoding: "utf8"
                    }
                );

                return responder(
                    res,
                    200,
                    {
                        ok: true,
                        publicou: true,
                        mensagem:
                            "Alterações publicadas com sucesso."
                    }
                );

            } catch (erro) {

                console.error(
                    "ERRO /publicar:",
                    erro
                );

                return responder(
                    res,
                    500,
                    {
                        ok: false,
                        erro:
                            erro.stderr?.toString() ||
                            erro.message
                    }
                );
            }
        }

        /* -------------------------------------------------
           ROTA INEXISTENTE
        ------------------------------------------------- */

        return responder(
            res,
            404,
            {
                ok: false,
                erro:
                    "Rota não encontrada."
            }
        );
    }
);

/* =========================================================
   INICIALIZACAO
   ========================================================= */

server.listen(
    PORT,
    "127.0.0.1",
    async () => {

        console.log("");
        console.log(
            "====================================="
        );
        console.log(
            " ADMIN API D'Limp"
        );
        console.log(
            "====================================="
        );
        console.log(
            `http://127.0.0.1:${PORT}`
        );

        try {

            await db.query(
                "SELECT 1"
            );

            console.log(
                "Banco Sys-On: conectado"
            );

        } catch (erro) {

            console.log(
                "ERRO BANCO:",
                erro.message
            );
        }

        console.log("");
    }
);