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
   CUSTEAMENTO - PERSISTENCIA DOS PRODUTOS DAS BASES
========================================================= */
const arquivoVinculosBases = path.join(__dirname, "..", "data", "custeamento-vinculos.json");
const arquivoFornecedores = path.join(__dirname, "..", "data", "custeamento-fornecedores.json");

const fornecedoresIniciais = [
    { id: 1, nome: "Alex", telefone: "", observacao: "", ativo: true },
    { id: 2, nome: "Londri Química", telefone: "", observacao: "", ativo: true },
    { id: 3, nome: "AM Embalagens", telefone: "", observacao: "", ativo: true },
    { id: 4, nome: "Claudinei Vassouras", telefone: "", observacao: "", ativo: true },
    { id: 5, nome: "Multi Essências", telefone: "", observacao: "", ativo: true }
];

function garantirArquivoFornecedores() {
    const pasta = path.dirname(arquivoFornecedores);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    if (!fs.existsSync(arquivoFornecedores)) {
        fs.writeFileSync(arquivoFornecedores, JSON.stringify({ proximo_id: 6, fornecedores: fornecedoresIniciais, insumos: {} }, null, 2), "utf8");
    }
}

function lerFornecedoresArquivo() {
    garantirArquivoFornecedores();
    try {
        const texto = fs.readFileSync(arquivoFornecedores, "utf8").replace(/^\uFEFF/, "").trim();
        const dados = texto ? JSON.parse(texto) : {};
        if (!dados || typeof dados !== "object") throw new Error("Formato inválido.");
        return {
            proximo_id: Number(dados.proximo_id) || 1,
            fornecedores: Array.isArray(dados.fornecedores) ? dados.fornecedores : [],
            insumos: dados.insumos && typeof dados.insumos === "object" ? dados.insumos : {}
        };
    } catch (erro) {
        console.error("ERRO ao ler fornecedores:", erro);
        return { proximo_id: 6, fornecedores: [...fornecedoresIniciais], insumos: {} };
    }
}

function salvarFornecedoresArquivo(dados) {
    garantirArquivoFornecedores();
    const temporario = arquivoFornecedores + ".tmp";
    fs.writeFileSync(temporario, JSON.stringify(dados, null, 2), "utf8");
    fs.renameSync(temporario, arquivoFornecedores);
}

function lerVinculosBasesArquivo() {
    try {
        if (!fs.existsSync(arquivoVinculosBases)) return {};
        const texto = fs.readFileSync(arquivoVinculosBases, "utf8");
        const dados = JSON.parse(texto);
        return dados && typeof dados === "object" ? dados : {};
    } catch (erro) {
        console.error("ERRO ao ler vínculos das bases:", erro);
        return {};
    }
}

function salvarVinculosBasesArquivo(dados) {
    const pasta = path.dirname(arquivoVinculosBases);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    const temporario = arquivoVinculosBases + ".tmp";
    fs.writeFileSync(temporario, JSON.stringify(dados, null, 2), "utf8");
    fs.renameSync(temporario, arquivoVinculosBases);
}

function normalizarVinculosProdutos(lista) {
    const vistos = new Set();
    return (Array.isArray(lista) ? lista : []).map(item => ({
        produto_id: Number(item.produto_id),
        volume: Number(item.volume || 0),
        embalagem_id: item.embalagem_id ? Number(item.embalagem_id) : null,
        acessorio_id: item.acessorio_id ? Number(item.acessorio_id) : null
    })).filter(item => {
        if (!Number.isInteger(item.produto_id) || item.produto_id <= 0) return false;
        if (vistos.has(item.produto_id)) return false;
        vistos.add(item.produto_id);
        return true;
    });
}

/* =========================================================
   CUSTEAMENTO - VINCULOS RECEITA -> PRODUTOS
========================================================= */
async function colunasCusteamentoProdutos() {
    const [rows] = await db.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'banco'
          AND TABLE_NAME = 'custeamento_produtos'
        ORDER BY ORDINAL_POSITION
    `);
    return rows.map(row => row.COLUMN_NAME);
}
function colunaEntre(colunas, candidatos) {
    return candidatos.find(nome => colunas.includes(nome)) || null;
}
async function mapaCusteamentoProdutos() {
    const colunas = await colunasCusteamentoProdutos();
    const mapa = {
        receita: colunaEntre(colunas, ['receita_id','id_receita','receitaId']),
        produto: colunaEntre(colunas, ['produto_id','id_produto','produtoId']),
        volume: colunaEntre(colunas, ['volume','volume_litros','volume_l']),
        embalagem: colunaEntre(colunas, ['embalagem_id','id_embalagem','embalagemId']),
        acessorio: colunaEntre(colunas, ['acessorio_id','acessório_id','id_acessorio','id_acessório','acessorioId']),
        id: colunaEntre(colunas, ['id'])
    };
    if (!mapa.receita || !mapa.produto) {
        throw new Error('A tabela banco.custeamento_produtos precisa ter as colunas de receita e produto para salvar os Produtos da base.');
    }
    return mapa;
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

                const fornecedores = lerFornecedoresArquivo();
                const mapaFornecedores = new Map(
                    fornecedores.fornecedores.map(f => [Number(f.id), f])
                );

                const insumosComFornecedor = rows.map(insumo => {
                    const fornecedorId = fornecedores.insumos[String(insumo.id)] ? Number(fornecedores.insumos[String(insumo.id)]) : null;
                    const fornecedor = fornecedorId ? mapaFornecedores.get(fornecedorId) : null;
                    return {
                        ...insumo,
                        fornecedor_id: fornecedorId,
                        fornecedor_nome: fornecedor?.nome || null
                    };
                });

                return responder(res, 200, {
                    ok: true,
                    insumos: insumosComFornecedor
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
           CUSTEAMENTO - EXCLUIR INSUMO
        ========================================================= */

        if (
            req.method === "POST" &&
            req.url === "/custeamento/insumos/excluir"
        ) {
            try {
                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);
                const id = Number(dados.id);

                if (!Number.isInteger(id) || id <= 0) {
                    throw new Error("ID do insumo invalido.");
                }

                const [insumo] = await db.query(`
                    SELECT id, nome
                    FROM banco.custeamento_insumos
                    WHERE id = ?
                `, [id]);

                if (!insumo.length) {
                    throw new Error("Insumo nao encontrado.");
                }

                const [uso] = await db.query(`
                    SELECT COUNT(*) AS total
                    FROM banco.custeamento_receita_itens
                    WHERE insumo_id = ?
                `, [id]);

                if (Number(uso[0].total) > 0) {
                    throw new Error(
                        "Este insumo ja esta sendo usado em uma receita. Para preservar o historico e os calculos, deixe-o como Inativo em vez de excluir."
                    );
                }

                await db.query(`
                    DELETE FROM banco.custeamento_insumos
                    WHERE id = ?
                `, [id]);

                return responder(res, 200, {
                    ok: true,
                    id,
                    mensagem: "Insumo excluido com sucesso."
                });

            } catch (erro) {
                console.error(
                    "ERRO POST /custeamento/insumos/excluir:",
                    erro
                );

                return responder(res, 400, {
                    ok: false,
                    erro: erro.message
                });
            }
        }




        /* =========================================================
           CUSTEAMENTO - PRODUTOS DA BASE
        ========================================================= */

        if (
            req.method === "GET" &&
            req.url.startsWith("/custeamento/receitas/") &&
            req.url.endsWith("/produtos")
        ) {
            try {
                const partes = req.url.split("/");
                const receitaId = Number(partes[3]);
                if (!Number.isInteger(receitaId) || receitaId <= 0) throw new Error("ID da receita inválido.");

                const arquivo = lerVinculosBasesArquivo();
                const salvosEmArquivo = Array.isArray(arquivo[String(receitaId)]) ? arquivo[String(receitaId)] : [];

                // Primeiro tenta o banco. Se não houver vínculos ali, recupera
                // a cópia persistida pelo módulo.
                try {
                    const mapa = await mapaCusteamentoProdutos();
                    const colProduto = `\`${mapa.produto}\``;
                    const colReceita = `\`${mapa.receita}\``;
                    const colVolume = mapa.volume ? `, \`${mapa.volume}\` AS volume` : `, NULL AS volume`;
                    const colEmbalagem = mapa.embalagem ? `, \`${mapa.embalagem}\` AS embalagem_id` : `, NULL AS embalagem_id`;
                    const colAcessorio = mapa.acessorio ? `, \`${mapa.acessorio}\` AS acessorio_id` : `, NULL AS acessorio_id`;

                    const [rows] = await db.query(`
                        SELECT
                            ${mapa.id ? `\`${mapa.id}\`` : colProduto} AS id,
                            ${colProduto} AS produto_id
                            ${colVolume}
                            ${colEmbalagem}
                            ${colAcessorio}
                        FROM banco.custeamento_produtos
                        WHERE ${colReceita} = ?
                        ORDER BY id
                    `, [receitaId]);

                    if (rows.length) return responder(res, 200, { ok: true, produtos: rows });
                } catch (erroBanco) {
                    console.warn("Não foi possível ler vínculos do banco:", erroBanco.message);
                }

                return responder(res, 200, {
                    ok: true,
                    produtos: salvosEmArquivo.map((item, index) => ({
                        id: index + 1,
                        produto_id: item.produto_id,
                        volume: item.volume,
                        embalagem_id: item.embalagem_id,
                        acessorio_id: item.acessorio_id
                    }))
                });
            } catch (erro) {
                console.error("ERRO GET produtos da base:", erro);
                return responder(res, 400, { ok: false, erro: erro.message });
            }
        }

        if (
            req.method === "POST" &&
            req.url.startsWith("/custeamento/receitas/") &&
            req.url.endsWith("/produtos")
        ) {
            let conexao;
            try {
                const partes = req.url.split("/");
                const receitaId = Number(partes[3]);
                if (!Number.isInteger(receitaId) || receitaId <= 0) {
                    throw new Error("ID da receita inválido.");
                }

                const corpo = await lerCorpo(req);
                const dados = JSON.parse(corpo);
                const lista = normalizarVinculosProdutos(dados.produtos);

                const [receita] = await db.query(
                    `SELECT id FROM banco.custeamento_receitas WHERE id = ? LIMIT 1`,
                    [receitaId]
                );
                if (!receita.length) throw new Error("Receita não encontrada.");

                // O arquivo mantém uma cópia confiável do vínculo. Isso também
                // permite que o módulo continue funcionando se a tabela legada
                // de vínculos tiver alguma coluna/constraint diferente.
                const vinculos = lerVinculosBasesArquivo();
                vinculos[String(receitaId)] = lista;
                salvarVinculosBasesArquivo(vinculos);

                // Tenta manter também o vínculo no banco, quando a estrutura
                // existente permitir. O arquivo continua sendo a fonte de
                // recuperação caso essa tabela antiga rejeite a gravação.
                let bancoSalvo = false;
                let avisoBanco = null;
                try {
                    const mapa = await mapaCusteamentoProdutos();
                    conexao = await db.getConnection();
                    await conexao.beginTransaction();

                    await conexao.query(
                        `DELETE FROM banco.custeamento_produtos WHERE \`${mapa.receita}\` = ?`,
                        [receitaId]
                    );

                    for (const item of lista) {
                        const colunas = [mapa.receita, mapa.produto];
                        const valores = [receitaId, item.produto_id];

                        if (mapa.volume) {
                            colunas.push(mapa.volume);
                            valores.push(item.volume);
                        }
                        if (mapa.embalagem) {
                            colunas.push(mapa.embalagem);
                            valores.push(item.embalagem_id);
                        }
                        if (mapa.acessorio) {
                            colunas.push(mapa.acessorio);
                            valores.push(item.acessorio_id);
                        }

                        const placeholders = colunas.map(() => "?").join(", ");
                        const nomes = colunas.map(c => `\`${c}\``).join(", ");
                        await conexao.query(
                            `INSERT INTO banco.custeamento_produtos (${nomes}) VALUES (${placeholders})`,
                            valores
                        );
                    }

                    await conexao.commit();
                    bancoSalvo = true;
                } catch (erroBanco) {
                    if (conexao) {
                        try { await conexao.rollback(); } catch (_) {}
                    }
                    avisoBanco = erroBanco.message;
                    console.warn("Vínculo salvo no arquivo; banco recusou a gravação:", erroBanco.message);
                } finally {
                    if (conexao) { conexao.release(); conexao = null; }
                }

                return responder(res, 200, {
                    ok: true,
                    receita_id: receitaId,
                    quantidade: lista.length,
                    banco_salvo: bancoSalvo,
                    armazenamento: bancoSalvo ? "banco" : "arquivo",
                    aviso_banco: avisoBanco
                });
            } catch (erro) {
                if (conexao) {
                    try { await conexao.rollback(); } catch (_) {}
                    try { conexao.release(); } catch (_) {}
                }
                console.error("ERRO POST produtos da base:", erro);
                return responder(res, 400, {
                    ok: false,
                    erro: `Não foi possível salvar os produtos da base: ${erro.message}`
                });
            }
        }

        /* =========================================================
           CUSTEAMENTO - PRODUTOS FINAIS
        ========================================================= */
        if (req.method === "GET" && req.url === "/custeamento/produtos-finais") {
            try {
                const arquivo = lerVinculosBasesArquivo();
                const resultado = [];
                const chaves = new Set();

                // Fonte principal: vínculos persistidos no banco.
                try {
                    const mapa = await mapaCusteamentoProdutos();
                    const receitaCol = `\`${mapa.receita}\``;
                    const produtoCol = `\`${mapa.produto}\``;
                    const idCol = mapa.id ? `\`${mapa.id}\`` : produtoCol;
                    const volumeCol = mapa.volume ? `\`${mapa.volume}\`` : "NULL";
                    const embalagemCol = mapa.embalagem ? `\`${mapa.embalagem}\`` : "NULL";
                    const acessorioCol = mapa.acessorio ? `\`${mapa.acessorio}\`` : "NULL";

                    const [rows] = await db.query(`
                        SELECT
                            ${idCol} AS vinculo_id,
                            ${produtoCol} AS produto_id,
                            ${receitaCol} AS receita_id,
                            ${volumeCol} AS volume,
                            ${embalagemCol} AS embalagem_id,
                            ${acessorioCol} AS acessorio_id,
                            cr.nome AS base_nome,
                            cr.ativa AS base_ativa,
                            cr.rendimento,
                            cr.unidade_rendimento,
                            ROUND(
                                COALESCE(SUM(ri.quantidade * ci.preco_atual), 0) /
                                NULLIF(cr.rendimento, 0),
                                6
                            ) AS custo_por_unidade
                        FROM banco.custeamento_produtos cp
                        INNER JOIN banco.custeamento_receitas cr ON cr.id = ${receitaCol}
                        LEFT JOIN banco.custeamento_receita_itens ri ON ri.receita_id = cr.id
                        LEFT JOIN banco.custeamento_insumos ci ON ci.id = ri.insumo_id
                        GROUP BY
                            ${idCol}, ${produtoCol}, ${receitaCol}, ${volumeCol},
                            ${embalagemCol}, ${acessorioCol}, cr.id, cr.nome,
                            cr.ativa, cr.rendimento, cr.unidade_rendimento
                    `);

                    for (const row of rows) {
                        resultado.push(row);
                        chaves.add(`${row.receita_id}:${row.produto_id}`);
                    }
                } catch (erroBanco) {
                    console.warn("Não foi possível ler os produtos finais do banco:", erroBanco.message);
                }

                // Recupera os vínculos persistidos pelo módulo quando a tabela
                // legada não aceitou a gravação ou ainda está vazia.
                const receitaIds = Object.keys(arquivo).map(Number).filter(Number.isInteger);
                if (receitaIds.length) {
                    const placeholders = receitaIds.map(() => "?").join(",");
                    const [receitas] = await db.query(`
                        SELECT
                            cr.id, cr.nome, cr.ativa, cr.rendimento, cr.unidade_rendimento,
                            ROUND(
                                COALESCE(SUM(ri.quantidade * ci.preco_atual), 0) /
                                NULLIF(cr.rendimento, 0),
                                6
                            ) AS custo_por_unidade
                        FROM banco.custeamento_receitas cr
                        LEFT JOIN banco.custeamento_receita_itens ri ON ri.receita_id = cr.id
                        LEFT JOIN banco.custeamento_insumos ci ON ci.id = ri.insumo_id
                        WHERE cr.id IN (${placeholders})
                        GROUP BY cr.id, cr.nome, cr.ativa, cr.rendimento, cr.unidade_rendimento
                    `, receitaIds);

                    const mapaReceitas = new Map(receitas.map(r => [Number(r.id), r]));
                    let fallbackId = -1;
                    for (const receitaId of receitaIds) {
                        const receita = mapaReceitas.get(receitaId);
                        if (!receita) continue;
                        const lista = normalizarVinculosProdutos(arquivo[String(receitaId)]);
                        for (const item of lista) {
                            const chave = `${receitaId}:${item.produto_id}`;
                            if (chaves.has(chave)) continue;
                            resultado.push({
                                vinculo_id: fallbackId--,
                                produto_id: item.produto_id,
                                receita_id: receitaId,
                                volume: item.volume,
                                embalagem_id: item.embalagem_id,
                                acessorio_id: item.acessorio_id,
                                base_nome: receita.nome,
                                base_ativa: receita.ativa,
                                rendimento: receita.rendimento,
                                unidade_rendimento: receita.unidade_rendimento,
                                custo_por_unidade: receita.custo_por_unidade
                            });
                            chaves.add(chave);
                        }
                    }
                }

                return responder(res, 200, { ok: true, produtos: resultado });
            } catch (erro) {
                console.error("ERRO GET /custeamento/produtos-finais:", erro);
                return responder(res, 400, { ok: false, erro: erro.message });
            }
        }

        /* =========================================================
           CUSTEAMENTO - FORNECEDORES
        ========================================================= */

        if (req.method === "GET" && req.url === "/custeamento/fornecedores") {
            try {
                const dados = lerFornecedoresArquivo();
                return responder(res, 200, {
                    ok: true,
                    fornecedores: dados.fornecedores,
                    insumos: dados.insumos
                });
            } catch (erro) {
                console.error("ERRO GET /custeamento/fornecedores:", erro);
                return responder(res, 500, { ok: false, erro: erro.message });
            }
        }

        if (req.method === "POST" && req.url === "/custeamento/fornecedores") {
            try {
                const dadosRecebidos = JSON.parse(await lerCorpo(req));
                const dados = lerFornecedoresArquivo();
                const nome = String(dadosRecebidos.nome || "").trim();
                const telefone = String(dadosRecebidos.telefone || "").trim();
                const observacao = String(dadosRecebidos.observacao || "").trim();
                const ativo = dadosRecebidos.ativo !== false;
                if (!nome) throw new Error("Informe o nome do fornecedor.");

                let id = Number(dadosRecebidos.id);
                if (Number.isInteger(id) && id > 0) {
                    const fornecedor = dados.fornecedores.find(f => Number(f.id) === id);
                    if (!fornecedor) throw new Error("Fornecedor não encontrado.");
                    fornecedor.nome = nome;
                    fornecedor.telefone = telefone;
                    fornecedor.observacao = observacao;
                    fornecedor.ativo = ativo;
                } else {
                    id = Number(dados.proximo_id) || 1;
                    while (dados.fornecedores.some(f => Number(f.id) === id)) id++;
                    dados.proximo_id = id + 1;
                    dados.fornecedores.push({ id, nome, telefone, observacao, ativo });
                }

                salvarFornecedoresArquivo(dados);
                return responder(res, 200, { ok: true, id, mensagem: "Fornecedor salvo com sucesso." });
            } catch (erro) {
                console.error("ERRO POST /custeamento/fornecedores:", erro);
                return responder(res, 400, { ok: false, erro: erro.message });
            }
        }

        if (req.method === "POST" && req.url === "/custeamento/fornecedores/excluir") {
            try {
                const dadosRecebidos = JSON.parse(await lerCorpo(req));
                const id = Number(dadosRecebidos.id);
                if (!Number.isInteger(id) || id <= 0) throw new Error("ID do fornecedor inválido.");
                const dados = lerFornecedoresArquivo();
                if (!dados.fornecedores.some(f => Number(f.id) === id)) throw new Error("Fornecedor não encontrado.");
                const emUso = Object.values(dados.insumos).some(v => Number(v) === id);
                if (emUso) throw new Error("Este fornecedor está vinculado a um ou mais insumos. Remova os vínculos antes de excluir.");
                dados.fornecedores = dados.fornecedores.filter(f => Number(f.id) !== id);
                salvarFornecedoresArquivo(dados);
                return responder(res, 200, { ok: true, mensagem: "Fornecedor excluído com sucesso." });
            } catch (erro) {
                console.error("ERRO POST /custeamento/fornecedores/excluir:", erro);
                return responder(res, 400, { ok: false, erro: erro.message });
            }
        }

        if (req.method === "POST" && req.url === "/custeamento/insumos/fornecedor") {
            try {
                const dadosRecebidos = JSON.parse(await lerCorpo(req));
                const insumoId = Number(dadosRecebidos.insumo_id);
                const fornecedorId = dadosRecebidos.fornecedor_id === null || dadosRecebidos.fornecedor_id === "" || dadosRecebidos.fornecedor_id === undefined
                    ? null
                    : Number(dadosRecebidos.fornecedor_id);
                if (!Number.isInteger(insumoId) || insumoId <= 0) throw new Error("ID do insumo inválido.");
                if (fornecedorId !== null && (!Number.isInteger(fornecedorId) || fornecedorId <= 0)) throw new Error("Fornecedor inválido.");

                const dados = lerFornecedoresArquivo();
                if (fornecedorId !== null && !dados.fornecedores.some(f => Number(f.id) === fornecedorId)) throw new Error("Fornecedor não encontrado.");
                if (fornecedorId === null) delete dados.insumos[String(insumoId)];
                else dados.insumos[String(insumoId)] = fornecedorId;
                salvarFornecedoresArquivo(dados);
                return responder(res, 200, { ok: true, insumo_id: insumoId, fornecedor_id: fornecedorId });
            } catch (erro) {
                console.error("ERRO POST /custeamento/insumos/fornecedor:", erro);
                return responder(res, 400, { ok: false, erro: erro.message });
            }
        }

        /* =========================================================
           CUSTEAMENTO - SINCRONIZAR CUSTOS PARA SYS-ON

           O campo cadproduto.preco é o custo de compra.
           preco_venda permanece intacto. Lucro é recalculado.
        ========================================================= */
        if (req.method === "POST" && req.url === "/custeamento/sincronizar-custos") {
            try {
                const arquivoVinculos = lerVinculosBasesArquivo();
                const [rowsInsumos] = await db.query(`
                    SELECT id, preco_atual
                    FROM banco.custeamento_insumos
                `);
                const mapaInsumos = new Map(rowsInsumos.map(r => [Number(r.id), Number(r.preco_atual || 0)]));

                const custos = new Map();
                let linksBanco = [];
                try {
                    const mapa = await mapaCusteamentoProdutos();
                    const receitaCol = `\`${mapa.receita}\``;
                    const produtoCol = `\`${mapa.produto}\``;
                    const volumeCol = mapa.volume ? `\`${mapa.volume}\`` : "NULL";
                    const embalagemCol = mapa.embalagem ? `\`${mapa.embalagem}\`` : "NULL";
                    const acessorioCol = mapa.acessorio ? `\`${mapa.acessorio}\`` : "NULL";
                    const [rows] = await db.query(`
                        SELECT
                            ${produtoCol} AS produto_id,
                            ${volumeCol} AS volume,
                            ${embalagemCol} AS embalagem_id,
                            ${acessorioCol} AS acessorio_id,
                            ROUND(COALESCE(SUM(ri.quantidade * ci.preco_atual), 0) / NULLIF(cr.rendimento, 0), 6) AS custo_por_unidade
                        FROM banco.custeamento_produtos cp
                        INNER JOIN banco.custeamento_receitas cr ON cr.id = ${receitaCol}
                        LEFT JOIN banco.custeamento_receita_itens ri ON ri.receita_id = cr.id
                        LEFT JOIN banco.custeamento_insumos ci ON ci.id = ri.insumo_id
                        GROUP BY ${produtoCol}, ${volumeCol}, ${embalagemCol}, ${acessorioCol}, cr.id, cr.rendimento
                    `);
                    linksBanco = rows;
                } catch (erroBanco) {
                    console.warn("Não foi possível ler os vínculos de bases no banco; usando arquivo quando disponível:", erroBanco.message);
                }

                for (const row of linksBanco) {
                    const produtoId = Number(row.produto_id);
                    const volume = Number(row.volume || 0);
                    const basePorUnidade = Number(row.custo_por_unidade || 0);
                    const embalagem = row.embalagem_id ? Number(mapaInsumos.get(Number(row.embalagem_id)) || 0) : 0;
                    const acessorio = row.acessorio_id ? Number(mapaInsumos.get(Number(row.acessorio_id)) || 0) : 0;
                    const custo = basePorUnidade * volume + embalagem + acessorio;
                    if (Number.isInteger(produtoId) && produtoId > 0 && Number.isFinite(custo) && custo >= 0) custos.set(produtoId, Number(custo.toFixed(2)));
                }

                for (const [receitaIdTexto, lista] of Object.entries(arquivoVinculos)) {
                    for (const item of normalizarVinculosProdutos(lista)) {
                        const produtoId = Number(item.produto_id);
                        if (custos.has(produtoId)) continue;
                        const [receitaRows] = await db.query(`
                            SELECT ROUND(COALESCE(SUM(ri.quantidade * ci.preco_atual), 0) / NULLIF(cr.rendimento, 0), 6) AS custo_por_unidade
                            FROM banco.custeamento_receitas cr
                            LEFT JOIN banco.custeamento_receita_itens ri ON ri.receita_id = cr.id
                            LEFT JOIN banco.custeamento_insumos ci ON ci.id = ri.insumo_id
                            WHERE cr.id = ?
                            GROUP BY cr.id, cr.rendimento
                        `, [Number(receitaIdTexto)]);
                        if (!receitaRows.length) continue;
                        const custoBase = Number(receitaRows[0].custo_por_unidade || 0) * Number(item.volume || 0);
                        const embalagem = item.embalagem_id ? Number(mapaInsumos.get(Number(item.embalagem_id)) || 0) : 0;
                        const acessorio = item.acessorio_id ? Number(mapaInsumos.get(Number(item.acessorio_id)) || 0) : 0;
                        const custo = custoBase + embalagem + acessorio;
                        if (Number.isFinite(custo) && custo >= 0) custos.set(produtoId, Number(custo.toFixed(2)));
                    }
                }

                const ajustes = lerAjustes();
                for (const [idTexto, ajuste] of Object.entries(ajustes)) {
                    if (custos.has(Number(idTexto))) continue;
                    const custo = Number(ajuste?.custo_custeamento);
                    if (Number.isInteger(Number(idTexto)) && Number(idTexto) > 0 && Number.isFinite(custo) && custo >= 0) {
                        custos.set(Number(idTexto), Number(custo.toFixed(2)));
                    }
                }

                const resultados = [];
                for (const [produtoId, custo] of custos.entries()) {
                    const [antes] = await db.query(`SELECT preco, preco_venda FROM banco.cadproduto WHERE id = ? LIMIT 1`, [produtoId]);
                    if (!antes.length) {
                        resultados.push({ id: produtoId, custo, status: "produto_nao_encontrado" });
                        continue;
                    }
                    const custoAnterior = Number(antes[0].preco);
                    const venda = Number(antes[0].preco_venda || 0);
                    if (Number.isFinite(custoAnterior) && Math.abs(custoAnterior - custo) < 0.005) {
                        resultados.push({ id: produtoId, custo, anterior: custoAnterior, status: "sem_alteracao" });
                        continue;
                    }
                    await db.query(`
                        UPDATE banco.cadproduto
                        SET preco = ?, Lucro = ROUND(preco_venda - ?, 2)
                        WHERE id = ?
                        LIMIT 1
                    `, [custo, custo, produtoId]);
                    resultados.push({ id: produtoId, custo, anterior: custoAnterior, venda, status: "atualizado" });
                }

                return responder(res, 200, {
                    ok: true,
                    quantidade: resultados.length,
                    atualizados: resultados.filter(r => r.status === "atualizado").length,
                    sem_alteracao: resultados.filter(r => r.status === "sem_alteracao").length,
                    nao_encontrados: resultados.filter(r => r.status === "produto_nao_encontrado").length,
                    resultados
                });
            } catch (erro) {
                console.error("ERRO POST /custeamento/sincronizar-custos:", erro);
                return responder(res, 500, { ok: false, erro: erro.message });
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
