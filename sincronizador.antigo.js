const fs = require("fs");
const path = require("path");
const http = require("http");

const PROJETO = "C:/catalogo-dlimp";

const API_URL = "http://127.0.0.1:3000/produtos";
const CATALOGO_FILE = path.join(PROJETO, "data", "produtos-online.json");
const AJUSTES_FILE = path.join(PROJETO, "data", "ajustes-produtos.json");

const BACKUP_DIR = path.join(PROJETO, "backup-sincronizacao");
const ESTADO_FILE = path.join(PROJETO, "data", "estado-sincronizacao.json");

function lerJson(arquivo, padrao) {
    if (!fs.existsSync(arquivo)) {
        return padrao;
    }

    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
}

function salvarJson(arquivo, dados) {
    fs.writeFileSync(
        arquivo,
        JSON.stringify(dados, null, 4),
        "utf8"
    );
}

function obterSysOn() {
    return new Promise((resolve, reject) => {

        http.get(API_URL, res => {

            let corpo = "";

            res.on("data", parte => {
                corpo += parte;
            });

            res.on("end", () => {

                if (res.statusCode !== 200) {
                    reject(
                        new Error(`API respondeu HTTP ${res.statusCode}`)
                    );
                    return;
                }

                try {
                    const dados = JSON.parse(corpo);

                    if (!Array.isArray(dados)) {
                        reject(
                            new Error("API não retornou uma lista de produtos.")
                        );
                        return;
                    }

                    resolve(dados);

                } catch {
                    reject(
                        new Error("Resposta da API não é JSON válido.")
                    );
                }
            });

        }).on("error", reject);
    });
}

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function texto(valor) {
    return String(valor ?? "").trim();
}

function disponibilidade(produto) {
    return texto(produto.ForaDeUso).toUpperCase() !== "SIM";
}

function normalizarProdutoSys(produto) {

    return {
        id: Number(produto.id),
        descricao: texto(produto.descricao),
        preco: numero(produto.preco_venda),
        estoque: numero(produto.estoque),
        disponivel: disponibilidade(produto),
        ForaDeUso: texto(produto.ForaDeUso),
        imagem: texto(produto.imagem)
    };
}

function normalizarProdutoSite(produto) {

    return {
        id: Number(produto.id),
        descricao: texto(produto.descricao),
        preco: numero(produto.preco),
        estoque: numero(produto.estoque),
        disponivel: Boolean(produto.disponivel),
        imagem: texto(produto.imagem)
    };
}

function criarBackup() {

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, {
            recursive: true
        });
    }

    const agora = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    const pasta = path.join(
        BACKUP_DIR,
        agora
    );

    fs.mkdirSync(pasta);

    if (fs.existsSync(CATALOGO_FILE)) {
        fs.copyFileSync(
            CATALOGO_FILE,
            path.join(pasta, "produtos-online.json")
        );
    }

    if (fs.existsSync(AJUSTES_FILE)) {
        fs.copyFileSync(
            AJUSTES_FILE,
            path.join(pasta, "ajustes-produtos.json")
        );
    }

    if (fs.existsSync(ESTADO_FILE)) {
        fs.copyFileSync(
            ESTADO_FILE,
            path.join(pasta, "estado-sincronizacao.json")
        );
    }

    return pasta;
}

async function main() {

    console.log("");
    console.log("============================================");
    console.log("          SINCRONIZADOR D'LIMP");
    console.log("============================================");
    console.log("");

    console.log("Consultando Sys-On...");

    const dadosSys = await obterSysOn();

    console.log(
        `OK - ${dadosSys.length} produtos recebidos`
    );

    const dadosSite = lerJson(
        CATALOGO_FILE,
        []
    );

    if (!Array.isArray(dadosSite)) {
        throw new Error(
            "produtos-online.json não contém uma lista."
        );
    }

    console.log(
        `OK - ${dadosSite.length} produtos no site`
    );

    const ajustes = lerJson(
        AJUSTES_FILE,
        {}
    );

    const estadoAnterior = lerJson(
        ESTADO_FILE,
        {}
    );

    const mapaSys = new Map(
        dadosSys.map(p => [
            String(p.id),
            normalizarProdutoSys(p)
        ])
    );

    const mapaSite = new Map(
        dadosSite.map(p => [
            String(p.id),
            normalizarProdutoSite(p)
        ])
    );

    const alteracoes = [];

    for (const [id, sys] of mapaSys) {

        const site = mapaSite.get(id);

        if (!site) {
            alteracoes.push({
                id,
                tipo: "NOVO_NO_SYS_ON",
                descricao: sys.descricao
            });

            continue;
        }

        const ajuste = ajustes[id] || null;
        const anterior = estadoAnterior[id] || null;

        /*
         * ESTOQUE:
         * sempre vem do Sys-On.
         */

        if (sys.estoque !== site.estoque) {

            alteracoes.push({
                id,
                tipo: "ESTOQUE_SYS_ON_SITE",
                descricao: sys.descricao,
                antes: site.estoque,
                depois: sys.estoque
            });
        }

        /*
         * DISPONIBILIDADE:
         * calculada exclusivamente pelo ForaDeUso.
         */

        const disponibilidadeSys = disponibilidade(sys);

        if (site.disponivel !== disponibilidadeSys) {

            alteracoes.push({
                id,
                tipo: "DISPONIBILIDADE",
                descricao: sys.descricao,
                antes: site.disponivel,
                depois: disponibilidadeSys
            });
        }

        /*
         * SITE / ADMIN:
         * se existir ajuste explícito de nome ou preço,
         * consideramos que a alteração veio do Admin.
         */

        const nomeSite = ajuste && ajuste.descricao !== undefined
            ? texto(ajuste.descricao)
            : site.descricao;

        const precoSite = ajuste && ajuste.preco !== undefined
            ? numero(ajuste.preco)
            : site.preco;

        if (nomeSite !== sys.descricao) {

            alteracoes.push({
                id,
                tipo: "NOME",
                descricao: sys.descricao,
                site: nomeSite,
                sysOn: sys.descricao
            });
        }

        if (precoSite !== sys.preco) {

            alteracoes.push({
                id,
                tipo: "PRECO",
                descricao: sys.descricao,
                site: precoSite,
                sysOn: sys.preco
            });
        }

        /*
         * FOTO:
         * apenas sinalizamos neste momento.
         * A gravação no Sys-On será feita pela API
         * depois que adicionarmos a rota segura de escrita.
         */

        if (ajuste && ajuste.imagem !== undefined) {

            const imagemSite = texto(ajuste.imagem);

            if (
                imagemSite &&
                imagemSite !== texto(sys.imagem)
            ) {

                alteracoes.push({
                    id,
                    tipo: "FOTO",
                    descricao: sys.descricao,
                    site: imagemSite,
                    sysOn: sys.imagem
                });
            }
        }

        /*
         * Estado usado futuramente para descobrir
         * qual lado foi alterado desde a última sincronização.
         */

        estadoAnterior[id] = {
            descricao: sys.descricao,
            preco: sys.preco,
            estoque: sys.estoque,
            disponivel: disponibilidadeSys,
            imagem: sys.imagem
        };
    }

    /*
     * PRODUTOS EXISTENTES SOMENTE NO SITE
     */

    for (const [id, site] of mapaSite) {

        if (!mapaSys.has(id)) {

            alteracoes.push({
                id,
                tipo: "NOVO_NO_SITE",
                descricao: site.descricao
            });
        }
    }

    console.log("");
    console.log("============================================");
    console.log("              RESUMO");
    console.log("============================================");
    console.log("");

    console.log(`Sys-On:      ${mapaSys.size}`);
    console.log(`Site:        ${mapaSite.size}`);
    console.log(`Diferenças:  ${alteracoes.length}`);

    console.log("");

    if (alteracoes.length === 0) {

        console.log(
            "Nenhuma diferença encontrada."
        );

    } else {

        for (const item of alteracoes) {

            console.log(
                `[${item.tipo}] ID ${item.id} - ${item.descricao}`
            );

            if (item.antes !== undefined) {
                console.log(
                    `   Antes: ${item.antes}`
                );
            }

            if (item.depois !== undefined) {
                console.log(
                    `   Depois: ${item.depois}`
                );
            }

            if (item.site !== undefined) {
                console.log(
                    `   Site: ${item.site}`
                );
            }

            if (item.sysOn !== undefined) {
                console.log(
                    `   Sys-On: ${item.sysOn}`
                );
            }

            console.log("");
        }
    }

    /*
     * BACKUP
     */

    const backup = criarBackup();

    console.log(
        `Backup criado em: ${backup}`
    );

    /*
     * Neste primeiro estágio não escrevemos
     * nada no banco do Sys-On.
     *
     * Salvamos somente o estado conhecido.
     */

    salvarJson(
        ESTADO_FILE,
        estadoAnterior
    );

    console.log("");
    console.log("============================================");
    console.log("       DIAGNÓSTICO CONCLUÍDO");
    console.log("============================================");
    console.log("");
    console.log("NENHUM DADO DO SYS-ON FOI ALTERADO.");
    console.log("NENHUMA FOTO FOI ALTERADA.");
    console.log("NENHUM PREÇO FOI ALTERADO.");
    console.log("");
}

main().catch(erro => {

    console.log("");
    console.log("============================================");
    console.log("              ERRO");
    console.log("============================================");
    console.log("");

    console.error(erro.message);

    console.log("");
    process.exit(1);
});
