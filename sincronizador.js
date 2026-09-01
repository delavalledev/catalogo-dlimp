const fs = require("fs");
const path = require("path");
const http = require("http");

const PROJETO = __dirname;

const API_URL = "http://127.0.0.1:3000";
const API_PRODUTOS = `${API_URL}/produtos`;
const API_SINCRONIZAR = `${API_URL}/sincronizar`;

const CATALOGO_FILE = path.join(
    PROJETO,
    "data",
    "produtos-online.json"
);

const AJUSTES_FILE = path.join(
    PROJETO,
    "data",
    "ajustes-produtos.json"
);

const BACKUP_DIR = path.join(
    PROJETO,
    "backup-sincronizacao"
);

/* =========================================================
   UTILIDADES
   ========================================================= */

function texto(valor) {
    return String(valor ?? "").trim();
}

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function garantirPasta(pasta) {
    fs.mkdirSync(pasta, {
        recursive: true
    });
}

/* =========================================================
   FOTOS
   ========================================================= */

const PASTA_IMAGENS_CATALOGO =
    path.join(
        PROJETO,
        "img",
        "produtos"
    );

const PASTA_IMAGENS_SYSON =
    "C:/SysOnPDV-Pro/imgProdutos";

function sincronizarFotoParaSysOn(
    id,
    imagem
) {

    const nomeImagem =
        path.basename(
            texto(imagem)
        );

    if (!nomeImagem) {
        return false;
    }

    const origem =
        path.join(
            PASTA_IMAGENS_CATALOGO,
            nomeImagem
        );

    const destino =
        path.join(
            PASTA_IMAGENS_SYSON,
            nomeImagem
        );

    if (!fs.existsSync(origem)) {

        console.log(
            `ID ${id}: foto não encontrada no catálogo.`
        );

        return false;
    }

    garantirPasta(
        PASTA_IMAGENS_SYSON
    );

    /*
     * Se a foto já existe no Sys-On, verifica
     * se ela realmente mudou antes de copiar.
     */
    if (fs.existsSync(destino)) {

        const statOrigem =
            fs.statSync(origem);

        const statDestino =
            fs.statSync(destino);

        const mesmoTamanho =
            statOrigem.size ===
            statDestino.size;

        const mesmaData =
            statOrigem.mtimeMs ===
            statDestino.mtimeMs;

        if (
            mesmoTamanho &&
            mesmaData
        ) {
            return false;
        }
    }

    fs.copyFileSync(
        origem,
        destino
    );

    /*
     * Mantém a mesma data de alteração
     * nos dois arquivos.
     */
    const statOrigemDepois =
        fs.statSync(origem);

    fs.utimesSync(
        destino,
        statOrigemDepois.atime,
        statOrigemDepois.mtime
    );

    console.log(
        `ID ${id}: foto atualizada no Sys-On.`
    );

    return true;
}


function sincronizarFotoParaCatalogo(
    id
) {

    const nomeImagem =
        `${id}.jpg`;

    const origem =
        path.join(
            PASTA_IMAGENS_SYSON,
            nomeImagem
        );

    const destino =
        path.join(
            PASTA_IMAGENS_CATALOGO,
            nomeImagem
        );

    if (!fs.existsSync(origem)) {
        return false;
    }

    garantirPasta(
        PASTA_IMAGENS_CATALOGO
    );

    /*
     * Se a foto já existe no catálogo,
     * verifica se realmente mudou.
     */
    if (fs.existsSync(destino)) {

        const statOrigem =
            fs.statSync(origem);

        const statDestino =
            fs.statSync(destino);

        const mesmoTamanho =
            statOrigem.size ===
            statDestino.size;

        const mesmaData =
            statOrigem.mtimeMs ===
            statDestino.mtimeMs;

        if (
            mesmoTamanho &&
            mesmaData
        ) {
            return false;
        }
    }

    fs.copyFileSync(
        origem,
        destino
    );

    /*
     * Mantém a mesma data de alteração
     * nos dois arquivos.
     */
    const statOrigemDepois =
        fs.statSync(origem);

    fs.utimesSync(
        destino,
        statOrigemDepois.atime,
        statOrigemDepois.mtime
    );

    console.log(
        `ID ${id}: foto atualizada no catálogo.`
    );

    return true;
}

function dataHora() {
    const agora = new Date();

    const pad = n =>
        String(n).padStart(2, "0");

    return (
        `${agora.getFullYear()}-` +
        `${pad(agora.getMonth() + 1)}-` +
        `${pad(agora.getDate())}_` +
        `${pad(agora.getHours())}-` +
        `${pad(agora.getMinutes())}-` +
        `${pad(agora.getSeconds())}`
    );
}

/* =========================================================
   JSON
   ========================================================= */

function lerJson(arquivo, padrao) {

    if (!fs.existsSync(arquivo)) {
        return padrao;
    }

    const conteudo = fs
        .readFileSync(arquivo, "utf8")
        .replace(/^\uFEFF/, "")
        .trim();

    if (!conteudo) {
        return padrao;
    }

    return JSON.parse(conteudo);
}

function salvarJson(arquivo, dados) {

    fs.writeFileSync(
        arquivo,
        JSON.stringify(
            dados,
            null,
            4
        ),
        "utf8"
    );
}

/* =========================================================
   BACKUP
   ========================================================= */

function fazerBackup() {

    garantirPasta(
        BACKUP_DIR
    );

    const pasta =
        path.join(
            BACKUP_DIR,
            dataHora()
        );

    garantirPasta(pasta);

    if (
        fs.existsSync(
            CATALOGO_FILE
        )
    ) {

        fs.copyFileSync(
            CATALOGO_FILE,
            path.join(
                pasta,
                "produtos-online.json"
            )
        );
    }

    if (
        fs.existsSync(
            AJUSTES_FILE
        )
    ) {

        fs.copyFileSync(
            AJUSTES_FILE,
            path.join(
                pasta,
                "ajustes-produtos.json"
            )
        );
    }

    return pasta;
}

/* =========================================================
   HTTP
   ========================================================= */

function requisicaoJson(
    url,
    opcoes = {}
) {

    return new Promise(
        (resolve, reject) => {

            const req =
                http.request(
                    url,
                    {
                        method:
                            opcoes.method ||
                            "GET",

                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    },

                    res => {

                        let corpo = "";

                        res.setEncoding(
                            "utf8"
                        );

                        res.on(
                            "data",
                            parte => {
                                corpo += parte;
                            }
                        );

                        res.on(
                            "end",
                            () => {

                                let dados;

                                try {

                                    dados =
                                        corpo
                                            ? JSON.parse(
                                                corpo
                                            )
                                            : {};

                                } catch {

                                    return reject(
                                        new Error(
                                            `Resposta inválida da API: ${url}`
                                        )
                                    );
                                }

                                if (
                                    res.statusCode <
                                        200 ||
                                    res.statusCode >=
                                        300
                                ) {

                                    return reject(
                                        new Error(
                                            `HTTP ${res.statusCode}: ${
                                                dados.erro ||
                                                dados.mensagem ||
                                                corpo
                                            }`
                                        )
                                    );
                                }

                                resolve(
                                    dados
                                );
                            }
                        );
                    }
                );

            req.on(
                "error",
                reject
            );

            if (
                opcoes.body !== undefined
            ) {

                req.write(
                    JSON.stringify(
                        opcoes.body
                    )
                );
            }

            req.end();
        }
    );
}

/* =========================================================
   NORMALIZACAO
   ========================================================= */

function normalizarForaDeUso(valor) {

    let s = texto(valor).toUpperCase();

    s = s
        .replace(/NÃƒÆ’O/g, "NAO")
        .replace(/NÃƒO/g, "NAO")
        .replace(/NÃO/g, "NAO")
        .replace(/NÃ?O/g, "NAO")
        .replace(/NÃO/g, "NAO")
        .trim();

    return s === "SIM"
        ? "SIM"
        : "NAO";
}

function normalizarProduto(produto) {

    const foraDeUso =
        normalizarForaDeUso(
            produto.ForaDeUso
        );

    const preco =
        numero(
            produto.preco_venda ??
            produto.preco
        );

    return {

        id:
            Number(
                produto.id
            ),

        descricao:
            texto(
                produto.descricao
            ),

        preco_venda:
            preco,

        preco:
            preco,

        estoque:
            numero(
                produto.estoque
            ),

        disponivel:
            foraDeUso !== "SIM",

        ForaDeUso:
            foraDeUso,

        imagem:
            texto(
                produto.imagem
            )
    };
}

/* =========================================================
   MAPA
   ========================================================= */

function criarMapa(produtos) {

    const mapa =
        new Map();

    for (
        const produto
        of produtos
    ) {

        const id =
            Number(
                produto.id
            );

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            continue;
        }

        mapa.set(
            id,
            produto
        );
    }

    return mapa;
}

/* =========================================================
   LER SYS-ON
   ========================================================= */

async function carregarSysOn() {

    console.log("");
    console.log(
        "Lendo produtos do Sys-On..."
    );

    const resposta =
        await requisicaoJson(
            API_PRODUTOS
        );

    if (
        !Array.isArray(
            resposta
        )
    ) {

        throw new Error(
            "A API do Sys-On não retornou uma lista."
        );
    }

    const produtos =
        resposta
            .map(
                normalizarProduto
            )
            .filter(
                produto =>
                    Number.isInteger(
                        produto.id
                    ) &&
                    produto.id > 0
            );

    console.log(
        `Sys-On: ${produtos.length} produtos válidos.`
    );

    /*
     * PROTECAO CONTRA API QUEBRADA
     */

    if (
        produtos.length < 200
    ) {

        throw new Error(
            `SINCRONIZACAO ABORTADA: API retornou somente ${produtos.length} produtos.`
        );
    }

    return produtos;
}

/* =========================================================
   LER CATALOGO
   ========================================================= */

function carregarCatalogo() {

    const dados =
        lerJson(
            CATALOGO_FILE,
            []
        );

    let produtos;

    if (
        Array.isArray(
            dados
        )
    ) {

        /*
         * Formato:
         * [
         *   {
         *      value: [...]
         *   }
         * ]
         */

        if (
            dados.length === 1 &&
            Array.isArray(
                dados[0]?.value
            )
        ) {

            produtos =
                dados[0].value;

        } else {

            /*
             * Array direto
             */

            produtos =
                dados;
        }

    } else if (
        dados &&
        Array.isArray(
            dados.value
        )
    ) {

        produtos =
            dados.value;

    } else if (
        dados &&
        Array.isArray(
            dados.produtos
        )
    ) {

        produtos =
            dados.produtos;

    } else {

        throw new Error(
            "Formato de produtos-online.json não reconhecido."
        );
    }

    return produtos
        .map(
            normalizarProduto
        )
        .filter(
            produto =>
                Number.isInteger(
                    produto.id
                ) &&
                produto.id > 0
        );
}

/* =========================================================
   LER AJUSTES
   ========================================================= */

function carregarAjustes() {

    const ajustes =
        lerJson(
            AJUSTES_FILE,
            {}
        );

    if (
        !ajustes ||
        Array.isArray(ajustes) ||
        typeof ajustes !== "object"
    ) {

        throw new Error(
            "Formato de ajustes-produtos.json inválido."
        );
    }

    return ajustes;
}

/* =========================================================
   APLICAR AJUSTES DO ADMIN
   ========================================================= */

async function aplicarAjustes(
    ajustes,
    mapaSys
) {

    const ids =
        Object.keys(
            ajustes
        );

    if (
        ids.length === 0
    ) {

        console.log(
            "Nenhum ajuste pendente do Admin."
        );

        return {
        sysOn: [],
        catalogo: []
        };
    }

    console.log("");
    console.log(
        `Ajustes encontrados: ${ids.length}`
    );

    	const processadosSysOn = [];
	const processadosCatalogo = [];

    for (
        const idTexto
        of ids
    ) {

        const id =
            Number(
                idTexto
            );

        const ajuste =
            ajustes[idTexto];

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            console.log(
                `ID inválido ignorado: ${idTexto}`
            );

            continue;
        }

        /*
         * O produto foi excluído do Sys-On.
         *
         * NÃO recriar.
         */

        if (
            !mapaSys.has(id)
        ) {

            console.log(
                `ID ${id}: não existe no Sys-On. Ajuste não será aplicado.`
            );

            continue;
        }

        const atual =
            mapaSys.get(id);

        const dados = {
            id
        };

        let alterou = false;

        /*
         * NOME
         */

        if (
            ajuste.descricao !== undefined
        ) {

            const descricao =
                texto(
                    ajuste.descricao
                );

            if (
                descricao &&
                descricao !==
                    atual.descricao
            ) {

                dados.descricao =
                    descricao;

                alterou = true;
            }
        }

        /*
         * PRECO
         */

        if (
            ajuste.preco !== undefined ||
            ajuste.preco_venda !== undefined
        ) {

            const preco =
                numero(
                    ajuste.preco ??
                    ajuste.preco_venda
                );

            if (
                preco !==
                atual.preco_venda
            ) {

                dados.preco_venda =
                    preco;

                alterou = true;
            }
        }

      /*
 * FOTO
 *
 * A foto do Admin já foi salva em:
 *
 * C:\catalogo-dlimp\img\produtos\ID.jpg
 *
 * Aqui apenas marcamos que existe uma
 * alteração de foto para o catálogo.
 *
 * A cópia física para o Sys-On será
 * feita na etapa de sincronização.
 */

const ajusteFoto =
    ajuste.imagem !== undefined;

const ajusteCatalogo =
    ajuste.exibirSite !== undefined ||
    ajusteFoto;

if (ajusteFoto) {

    sincronizarFotoParaSysOn(
        id,
        ajuste.imagem
    );
}
if (
    !alterou &&
    !ajusteCatalogo
) {

    console.log(
        `ID ${id}: nenhum nome/preço ou ajuste de catálogo novo.`
    );

    continue;
}

if (!alterou && ajusteCatalogo) {

    console.log(
        `ID ${id}: ajuste de exibição do site será aplicado no catálogo.`
    );

    processadosCatalogo.push(
        id
    );

    continue;
}

        console.log("");
        console.log(
            `ID ${id}: enviando alteração ao Sys-On...`
        );

        /*
         * AGORA usamos a rota correta.
         *
         * /sincronizar altera o banco.
         */

        const resposta =
            await requisicaoJson(
                API_SINCRONIZAR,
                {
                    method: "POST",
                    body: dados
                }
            );

        if (
            resposta.sucesso !== true
        ) {

            throw new Error(
                `Falha ao atualizar ID ${id}.`
            );
        }

        console.log(
            `ID ${id}: atualizado no Sys-On.`
        );

        processadosSysOn.push(
    id
);
    }

    return {
    sysOn: processadosSysOn,
    catalogo: processadosCatalogo
};
}

/* =========================================================
   CONSTRUIR CATALOGO
   ========================================================= */

function construirCatalogo(
    produtosSysOn,
    catalogoAtual,
    ajustes
) {

    const mapaAtual =
        criarMapa(
            catalogoAtual
        );

    return produtosSysOn.map(
        sys => {

            const antigo =
                mapaAtual.get(
                    sys.id
                );

            sincronizarFotoParaCatalogo(
                sys.id
            );

            const ajuste =
                ajustes[String(sys.id)];

            const disponivel =
                ajuste?.exibirSite !== undefined
                    ? Boolean(ajuste.exibirSite)
                    : sys.disponivel;

            const caminhoFotoSysOn =
                path.join(
                    PASTA_IMAGENS_CATALOGO,
                    `${sys.id}.jpg`
                );

            const temFotoNoCatalogo =
                fs.existsSync(
                    caminhoFotoSysOn
                );

            let imagem;

            if (ajuste?.imagem) {

                imagem =
                    ajuste.imagem;

            } else if (temFotoNoCatalogo) {

                imagem =
                    `img/produtos/${sys.id}.jpg`;

            } else if (
                antigo?.imagem &&
                antigo.imagem !==
                    "img/produtos/sem_imagem.png"
            ) {

                imagem =
                    antigo.imagem;

            } else {

                imagem =
                    sys.imagem ||
                    "img/produtos/sem_imagem.png";
            }

            return {

                id:
                    sys.id,

                descricao:
                    sys.descricao,

                preco_venda:
                    sys.preco_venda,

                preco:
                    sys.preco_venda,

                estoque:
                    sys.estoque,

                disponivel:
                    disponivel,

                ForaDeUso:
                    sys.ForaDeUso,

                imagem:
                    imagem
            };
        }
    );
}

/* =========================================================
   MAIN
   ========================================================= */

async function main() {

    console.log("");
    console.log(
        "================================================"
    );
    console.log(
        " SINCRONIZADOR D'LIMP"
    );
    console.log(
        "================================================"
    );

    /*
     * BACKUP
     */

    const backup =
        fazerBackup();

    console.log("");
    console.log(
        `Backup: ${backup}`
    );

    /*
     * 1. Sys-On
     */

    const produtosSysOn =
        await carregarSysOn();

    let mapaSys =
        criarMapa(
            produtosSysOn
        );

    /*
     * 2. Catálogo atual
     */

    const catalogoAtual =
        carregarCatalogo();

    console.log(
        `Catálogo atual: ${catalogoAtual.length} produtos.`
    );

    /*
     * 3. Ajustes do Admin
     */

    const ajustes =
        carregarAjustes();

    /*
     * 4. Admin → Sys-On
     */

    const resultadoAjustes =
    await aplicarAjustes(
        ajustes,
        mapaSys
    );

const processadosSysOn =
    resultadoAjustes.sysOn;

const processadosCatalogo =
    resultadoAjustes.catalogo;

    /*
     * 5. Se houve alterações,
     *    precisamos consultar o Sys-On
     *    novamente.
     */

    let produtosFinais;

    if (
        processadosSysOn.length > 0
    ) {

        console.log("");
        console.log(
            "Reconsultando Sys-On após as alterações..."
        );

        produtosFinais =
            await carregarSysOn();

        mapaSys =
            criarMapa(
                produtosFinais
            );

    } else {

        produtosFinais =
            produtosSysOn;
    }

    /*
     * 6. Reconstruir catálogo.
     *
     * IMPORTANTE:
     *
     * Se um produto foi apagado no Sys-On,
     * ele NÃO estará em produtosFinais.
     *
     * Portanto ele sai do catálogo.
     *
     * Nenhum DELETE é feito no banco.
     */

    const novoCatalogo =
    construirCatalogo(
        produtosFinais,
        catalogoAtual,
        ajustes
    );

    /*
     * 7. Salvar catálogo
     */

    salvarJson(
        CATALOGO_FILE,
        novoCatalogo
    );

    /*
     * 8. Remover somente os ajustes
     *    que foram efetivamente enviados.
     */

    if (
    processadosSysOn.length > 0 ||
    processadosCatalogo.length > 0
) {

        const ajustesRestantes =
            {
                ...ajustes
            };

        for (
    const id
    of [
        ...processadosSysOn,
        ...processadosCatalogo
    ]
) {

            delete ajustesRestantes[
                String(id)
            ];
        }

        salvarJson(
            AJUSTES_FILE,
            ajustesRestantes
        );
    }

    /*
     * 9. Resultado
     */

    console.log("");
    console.log(
        "================================================"
    );
    console.log(
        " SINCRONIZACAO CONCLUIDA"
    );
    console.log(
        "================================================"
    );

    console.log("");
    console.log(
        `Produtos no Sys-On: ${produtosFinais.length}`
    );

    console.log(
        `Produtos no catálogo: ${novoCatalogo.length}`
    );

    console.log(
        `Ajustes aplicados: ${
    processadosSysOn.length +
    processadosCatalogo.length
}`
    );

    console.log("");
    console.log(
        "Nome: Admin -> Sys-On"
    );

    console.log(
        "Preço: Admin -> Sys-On"
    );

    console.log(
        "Estoque: Sys-On -> catálogo"
    );

    console.log(
        "ForaDeUso: Sys-On -> catálogo"
    );

    console.log(
        "Exclusão: Sys-On -> catálogo"
    );

    console.log(
        "Fotos: sincronização bidirecional ativa"
    );

    console.log("");
}

main().catch(
    erro => {

        console.error("");
        console.error(
            "================================================"
        );
        console.error(
            " SINCRONIZACAO ABORTADA"
        );
        console.error(
            "================================================"
        );

        console.error("");
        console.error(
            erro.message
        );

        console.error("");

        process.exitCode = 1;
    }
);