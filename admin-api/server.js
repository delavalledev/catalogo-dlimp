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


        /* =========================================================
           CUSTEAMENTO - INSUMOS
        ========================================================= */

        if (req.method === "GET" && req.url === "/custeamento/insumos") {
            try {
                const [rows] = await db.query(`
                    SELECT
                        id,
                        nome,
                        tipo,
                        unidade,
                        preco_atual,
                        ativo
                    FROM banco.custeamento_insumos
                    ORDER BY nome
                `);

                return responder(res, 200, {
                    ok: true,
                    insumos: rows
                });

            } catch (erro) {
                console.error("ERRO /custeamento/insumos:", erro);

                return responder(res, 500, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        if (req.method === "POST" && req.url === "/custeamento/insumos") {
            try {
                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);

                const nome = String(dados.nome || "").trim();
                const tipo = String(dados.tipo || "MATERIA_PRIMA").trim();
                const unidade = String(dados.unidade || "UN").trim();
                const preco = Number(dados.preco_atual);

                const tiposValidos = [
                    "MATERIA_PRIMA",
                    "EMBALAGEM",
                    "ACESSORIO"
                ];

                if (!nome) {
                    throw new Error("Informe o nome do insumo.");
                }

                if (!tiposValidos.includes(tipo)) {
                    throw new Error("Tipo de insumo invalido.");
                }

                if (!unidade) {
                    throw new Error("Informe a unidade.");
                }

                if (!Number.isFinite(preco) || preco < 0) {
                    throw new Error("Preco invalido.");
                }

                const [resultado] = await db.query(`
                    INSERT INTO banco.custeamento_insumos
                        (nome, tipo, unidade, preco_atual, ativo)
                    VALUES (?, ?, ?, ?, 1)
                `, [
                    nome,
                    tipo,
                    unidade,
                    preco
                ]);

                return responder(res, 201, {
                    ok: true,
                    id: resultado.insertId,
                    mensagem: "Insumo cadastrado com sucesso."
                });

            } catch (erro) {
                console.error("ERRO POST /custeamento/insumos:", erro);

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        if (
            req.method === "POST" &&
            req.url === "/custeamento/insumos/editar"
        ) {
            try {
                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);

                const id = Number(dados.id);
                const nome = String(dados.nome || "").trim();
                const tipo = String(dados.tipo || "").trim();
                const unidade = String(dados.unidade || "").trim();
                const preco = Number(dados.preco_atual);
                const ativo = dados.ativo ? 1 : 0;

                const tiposValidos = [
                    "MATERIA_PRIMA",
                    "EMBALAGEM",
                    "ACESSORIO"
                ];

                if (!Number.isInteger(id) || id <= 0) {
                    throw new Error("ID invalido.");
                }

                if (!nome) {
                    throw new Error("Informe o nome.");
                }

                if (!tiposValidos.includes(tipo)) {
                    throw new Error("Tipo invalido.");
                }

                if (!unidade) {
                    throw new Error("Informe a unidade.");
                }

                if (!Number.isFinite(preco) || preco < 0) {
                    throw new Error("Preco invalido.");
                }

                const [antigo] = await db.query(`
                    SELECT preco_atual
                    FROM banco.custeamento_insumos
                    WHERE id = ?
                `, [id]);

                if (!antigo.length) {
                    throw new Error("Insumo nao encontrado.");
                }

                const precoAnterior = Number(antigo[0].preco_atual);

                await db.query(`
                    UPDATE banco.custeamento_insumos
                    SET
                        nome = ?,
                        tipo = ?,
                        unidade = ?,
                        preco_atual = ?,
                        ativo = ?
                    WHERE id = ?
                `, [
                    nome,
                    tipo,
                    unidade,
                    preco,
                    ativo,
                    id
                ]);

                if (precoAnterior !== preco) {
                    await db.query(`
                        INSERT INTO banco.custeamento_historico_precos
                            (insumo_id, preco_anterior, preco_novo, observacao)
                        VALUES (?, ?, ?, ?)
                    `, [
                        id,
                        precoAnterior,
                        preco,
                        "Alteracao feita pelo Admin"
                    ]);
                }

                return responder(res, 200, {
                    ok: true,
                    mensagem: "Insumo atualizado com sucesso."
                });

            } catch (erro) {
                console.error(
                    "ERRO POST /custeamento/insumos/editar:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


               /* =========================================================
           CUSTEAMENTO - RECEITAS
        ========================================================= */

        // LISTAR RECEITAS
        if (
            req.method === "GET" &&
            req.url === "/custeamento/receitas"
        ) {
            try {
                const [rows] = await db.query(`
                    SELECT
                        id,
                        nome,
                        rendimento,
                        unidade_rendimento,
                        observacao,
                        ativa
                    FROM banco.custeamento_receitas
                    ORDER BY nome
                `);

                return responder(res, 200, {
                    ok: true,
                    receitas: rows
                });

            } catch (erro) {
                console.error(
                    "ERRO GET /custeamento/receitas:",
                    erro
                );

                return responder(res, 500, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        // CRIAR RECEITA
        if (
            req.method === "POST" &&
            req.url === "/custeamento/receitas"
        ) {
            try {
                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);

                const nome = String(
                    dados.nome || ""
                ).trim();

                const rendimento = Number(
                    dados.rendimento
                );

                const unidadeRendimento = String(
                    dados.unidade_rendimento || "L"
                ).trim();

                const observacao = String(
                    dados.observacao || ""
                ).trim();


                if (!nome) {
                    throw new Error(
                        "Informe o nome da receita."
                    );
                }


                if (
                    !Number.isFinite(rendimento) ||
                    rendimento <= 0
                ) {
                    throw new Error(
                        "Rendimento invalido."
                    );
                }


                if (!unidadeRendimento) {
                    throw new Error(
                        "Informe a unidade do rendimento."
                    );
                }


                const [resultado] = await db.query(`
                    INSERT INTO banco.custeamento_receitas
                        (
                            nome,
                            rendimento,
                            unidade_rendimento,
                            observacao,
                            ativa
                        )
                    VALUES (?, ?, ?, ?, 1)
                `, [
                    nome,
                    rendimento,
                    unidadeRendimento,
                    observacao
                ]);


                return responder(res, 201, {
                    ok: true,
                    id: resultado.insertId,
                    mensagem:
                        "Receita cadastrada com sucesso."
                });

            } catch (erro) {
                console.error(
                    "ERRO POST /custeamento/receitas:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        // EDITAR RECEITA
        if (
            req.method === "POST" &&
            req.url === "/custeamento/receitas/editar"
        ) {
            try {
                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);

                const id = Number(dados.id);

                const nome = String(
                    dados.nome || ""
                ).trim();

                const rendimento = Number(
                    dados.rendimento
                );

                const unidadeRendimento = String(
                    dados.unidade_rendimento || "L"
                ).trim();

                const observacao = String(
                    dados.observacao || ""
                ).trim();

                const ativa = dados.ativa ? 1 : 0;


                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {
                    throw new Error(
                        "ID da receita invalido."
                    );
                }


                if (!nome) {
                    throw new Error(
                        "Informe o nome da receita."
                    );
                }


                if (
                    !Number.isFinite(rendimento) ||
                    rendimento <= 0
                ) {
                    throw new Error(
                        "Rendimento invalido."
                    );
                }


                if (!unidadeRendimento) {
                    throw new Error(
                        "Informe a unidade do rendimento."
                    );
                }


                const [receita] = await db.query(`
                    SELECT id
                    FROM banco.custeamento_receitas
                    WHERE id = ?
                `, [id]);


                if (!receita.length) {
                    throw new Error(
                        "Receita nao encontrada."
                    );
                }


                await db.query(`
                    UPDATE banco.custeamento_receitas
                    SET
                        nome = ?,
                        rendimento = ?,
                        unidade_rendimento = ?,
                        observacao = ?,
                        ativa = ?
                    WHERE id = ?
                `, [
                    nome,
                    rendimento,
                    unidadeRendimento,
                    observacao,
                    ativa,
                    id
                ]);


                return responder(res, 200, {
                    ok: true,
                    mensagem:
                        "Receita atualizada com sucesso."
                });

            } catch (erro) {
                console.error(
                    "ERRO POST /custeamento/receitas/editar:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        // EXCLUIR RECEITA
        if (
            req.method === "POST" &&
            req.url === "/custeamento/receitas/excluir"
        ) {
            try {
                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);

                const id = Number(dados.id);


                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {
                    throw new Error(
                        "ID da receita invalido."
                    );
                }


                const [receita] = await db.query(`
                    SELECT id
                    FROM banco.custeamento_receitas
                    WHERE id = ?
                `, [id]);


                if (!receita.length) {
                    throw new Error(
                        "Receita nao encontrada."
                    );
                }


                // Primeiro remove os itens da receita
                await db.query(`
                    DELETE FROM banco.custeamento_receita_itens
                    WHERE receita_id = ?
                `, [id]);


                // Depois remove a receita
                await db.query(`
                    DELETE FROM banco.custeamento_receitas
                    WHERE id = ?
                `, [id]);


                return responder(res, 200, {
                    ok: true,
                    mensagem:
                        "Receita excluida com sucesso."
                });

            } catch (erro) {
                console.error(
                    "ERRO POST /custeamento/receitas/excluir:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        // LISTAR ITENS DE UMA RECEITA
        if (
            req.method === "GET" &&
            req.url.startsWith("/custeamento/receitas/") &&
            req.url.endsWith("/itens")
        ) {
            try {
                const partes = req.url.split("/");
                const receitaId = Number(partes[3]);


                if (
                    !Number.isInteger(receitaId) ||
                    receitaId <= 0
                ) {
                    throw new Error(
                        "ID da receita invalido."
                    );
                }


                const [rows] = await db.query(`
                    SELECT
                        ri.id,
                        ri.receita_id,
                        ri.insumo_id,
                        i.nome AS insumo_nome,
                        i.tipo AS insumo_tipo,
                        i.unidade AS insumo_unidade,
                        i.preco_atual,
                        ri.quantidade,
                        (ri.quantidade * i.preco_atual) AS custo_item
                    FROM banco.custeamento_receita_itens ri
                    INNER JOIN banco.custeamento_insumos i
                        ON i.id = ri.insumo_id
                    WHERE ri.receita_id = ?
                    ORDER BY i.nome
                `, [receitaId]);


                return responder(res, 200, {
                    ok: true,
                    receita_id: receitaId,
                    itens: rows
                });

            } catch (erro) {
                console.error(
                    "ERRO GET /custeamento/receitas/:id/itens:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        // ADICIONAR / ATUALIZAR ITEM DA RECEITA
        if (
            req.method === "POST" &&
            req.url.startsWith("/custeamento/receitas/") &&
            req.url.endsWith("/itens")
        ) {
            try {
                const partes = req.url.split("/");
                const receitaId = Number(partes[3]);


                if (
                    !Number.isInteger(receitaId) ||
                    receitaId <= 0
                ) {
                    throw new Error(
                        "ID da receita invalido."
                    );
                }


                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);

                const insumoId = Number(
                    dados.insumo_id
                );

                const quantidade = Number(
                    dados.quantidade
                );


                if (
                    !Number.isInteger(insumoId) ||
                    insumoId <= 0
                ) {
                    throw new Error(
                        "ID do insumo invalido."
                    );
                }


                if (
                    !Number.isFinite(quantidade) ||
                    quantidade <= 0
                ) {
                    throw new Error(
                        "Quantidade invalida."
                    );
                }


                const [receita] = await db.query(`
                    SELECT id
                    FROM banco.custeamento_receitas
                    WHERE id = ?
                `, [receitaId]);


                if (!receita.length) {
                    throw new Error(
                        "Receita nao encontrada."
                    );
                }


                const [insumo] = await db.query(`
                    SELECT id
                    FROM banco.custeamento_insumos
                    WHERE id = ?
                `, [insumoId]);


                if (!insumo.length) {
                    throw new Error(
                        "Insumo nao encontrado."
                    );
                }


                const [itemExistente] = await db.query(`
                    SELECT id
                    FROM banco.custeamento_receita_itens
                    WHERE receita_id = ?
                      AND insumo_id = ?
                `, [
                    receitaId,
                    insumoId
                ]);


                if (itemExistente.length) {

                    await db.query(`
                        UPDATE banco.custeamento_receita_itens
                        SET quantidade = ?
                        WHERE id = ?
                    `, [
                        quantidade,
                        itemExistente[0].id
                    ]);


                    return responder(res, 200, {
                        ok: true,
                        id: itemExistente[0].id,
                        mensagem:
                            "Quantidade do insumo atualizada com sucesso."
                    });
                }


                const [resultado] = await db.query(`
                    INSERT INTO banco.custeamento_receita_itens
                        (
                            receita_id,
                            insumo_id,
                            quantidade
                        )
                    VALUES (?, ?, ?)
                `, [
                    receitaId,
                    insumoId,
                    quantidade
                ]);


                return responder(res, 201, {
                    ok: true,
                    id: resultado.insertId,
                    mensagem:
                        "Insumo adicionado à receita com sucesso."
                });

            } catch (erro) {
                console.error(
                    "ERRO POST /custeamento/receitas/:id/itens:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        // EDITAR ITEM DA RECEITA
        if (
            req.method === "POST" &&
            req.url === "/custeamento/receitas/item/editar"
        ) {
            try {
                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);

                const itemId = Number(
                    dados.id
                );

                const quantidade = Number(
                    dados.quantidade
                );


                if (
                    !Number.isInteger(itemId) ||
                    itemId <= 0
                ) {
                    throw new Error(
                        "ID do item invalido."
                    );
                }


                if (
                    !Number.isFinite(quantidade) ||
                    quantidade <= 0
                ) {
                    throw new Error(
                        "Quantidade invalida."
                    );
                }


                const [item] = await db.query(`
                    SELECT id
                    FROM banco.custeamento_receita_itens
                    WHERE id = ?
                `, [itemId]);


                if (!item.length) {
                    throw new Error(
                        "Item da receita nao encontrado."
                    );
                }


                await db.query(`
                    UPDATE banco.custeamento_receita_itens
                    SET quantidade = ?
                    WHERE id = ?
                `, [
                    quantidade,
                    itemId
                ]);


                return responder(res, 200, {
                    ok: true,
                    mensagem:
                        "Item da receita atualizado com sucesso."
                });

            } catch (erro) {
                console.error(
                    "ERRO POST /custeamento/receitas/item/editar:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        // EXCLUIR ITEM DA RECEITA
        if (
            req.method === "POST" &&
            req.url === "/custeamento/receitas/item/excluir"
        ) {
            try {
                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);

                const itemId = Number(
                    dados.id
                );


                if (
                    !Number.isInteger(itemId) ||
                    itemId <= 0
                ) {
                    throw new Error(
                        "ID do item invalido."
                    );
                }


                const [item] = await db.query(`
                    SELECT id
                    FROM banco.custeamento_receita_itens
                    WHERE id = ?
                `, [itemId]);


                if (!item.length) {
                    throw new Error(
                        "Item da receita nao encontrado."
                    );
                }


                await db.query(`
                    DELETE FROM banco.custeamento_receita_itens
                    WHERE id = ?
                `, [itemId]);


                return responder(res, 200, {
                    ok: true,
                    mensagem:
                        "Item removido da receita com sucesso."
                });

            } catch (erro) {
                console.error(
                    "ERRO POST /custeamento/receitas/item/excluir:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


        // CALCULAR CUSTO DA RECEITA
        if (
            req.method === "GET" &&
            req.url.startsWith("/custeamento/receitas/") &&
            req.url.endsWith("/calculo")
        ) {
            try {
                const partes = req.url.split("/");
                const receitaId = Number(partes[3]);


                if (
                    !Number.isInteger(receitaId) ||
                    receitaId <= 0
                ) {
                    throw new Error(
                        "ID da receita invalido."
                    );
                }


                const [receitas] = await db.query(`
                    SELECT
                        id,
                        nome,
                        rendimento,
                        unidade_rendimento
                    FROM banco.custeamento_receitas
                    WHERE id = ?
                `, [receitaId]);


                if (!receitas.length) {
                    throw new Error(
                        "Receita nao encontrada."
                    );
                }


                const receita = receitas[0];


                const [itens] = await db.query(`
                    SELECT
                        ri.id,
                        ri.insumo_id,
                        i.nome AS insumo_nome,
                        i.unidade AS insumo_unidade,
                        i.preco_atual,
                        ri.quantidade,
                        (ri.quantidade * i.preco_atual) AS custo_item
                    FROM banco.custeamento_receita_itens ri
                    INNER JOIN banco.custeamento_insumos i
                        ON i.id = ri.insumo_id
                    WHERE ri.receita_id = ?
                    ORDER BY i.nome
                `, [receitaId]);


                let custoTotal = 0;


                for (const item of itens) {
                    custoTotal += Number(
                        item.custo_item
                    );
                }


                const rendimento = Number(
                    receita.rendimento
                );


                const custoPorUnidade =
                    rendimento > 0
                        ? custoTotal / rendimento
                        : 0;


                return responder(res, 200, {
                    ok: true,

                    receita: {
                        id: receita.id,
                        nome: receita.nome,
                        rendimento: rendimento,
                        unidade_rendimento:
                            receita.unidade_rendimento
                    },

                    itens: itens,

                    custo_total: custoTotal,
                    custo_por_unidade:
                        custoPorUnidade
                });

            } catch (erro) {
                console.error(
                    "ERRO GET /custeamento/receitas/:id/calculo:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }


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
