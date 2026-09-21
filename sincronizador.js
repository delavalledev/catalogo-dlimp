const fs = require("fs");
const path = require("path");
const http = require("http");

const PROJETO = __dirname;
const API_PRODUTOS = "http://127.0.0.1:3000/produtos";
const API_SINCRONIZAR = "http://127.0.0.1:3000/sincronizar";
const API_ADMIN_CUSTOS = "http://127.0.0.1:3100/custeamento/sincronizar-custos";

const CATALOGO_FILE = path.join(PROJETO, "data", "produtos-online.json");
const AJUSTES_FILE = path.join(PROJETO, "data", "ajustes-produtos.json");
const BACKUP_DIR = path.join(PROJETO, "backup-sincronizacao");
const PASTA_IMAGENS_CATALOGO = path.join(PROJETO, "img", "produtos");
const PASTA_IMAGENS_SYSON = "C:/SysOnPDV-Pro/imgProdutos";

function texto(valor) {
    return String(valor ?? "").trim();
}

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function lerJson(arquivo, padrao) {
    if (!fs.existsSync(arquivo)) return padrao;
    const textoArquivo = fs.readFileSync(arquivo, "utf8").replace(/^\uFEFF/, "").trim();
    return textoArquivo ? JSON.parse(textoArquivo) : padrao;
}

function salvarJson(arquivo, dados) {
    const temporario = arquivo + ".tmp";
    fs.writeFileSync(temporario, JSON.stringify(dados, null, 4), "utf8");
    fs.renameSync(temporario, arquivo);
}

function garantirPasta(pasta) {
    fs.mkdirSync(pasta, { recursive: true });
}

function dataHora() {
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function fazerBackup() {
    garantirPasta(BACKUP_DIR);
    const pasta = path.join(BACKUP_DIR, dataHora());
    garantirPasta(pasta);
    if (fs.existsSync(CATALOGO_FILE)) fs.copyFileSync(CATALOGO_FILE, path.join(pasta, "produtos-online.json"));
    if (fs.existsSync(AJUSTES_FILE)) fs.copyFileSync(AJUSTES_FILE, path.join(pasta, "ajustes-produtos.json"));
    return pasta;
}

function requisicaoJson(url, opcoes = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, {
            method: opcoes.method || "GET",
            headers: { "Content-Type": "application/json" }
        }, res => {
            let corpo = "";
            res.setEncoding("utf8");
            res.on("data", parte => corpo += parte);
            res.on("end", () => {
                let dados = {};
                try { dados = corpo ? JSON.parse(corpo) : {}; }
                catch { return reject(new Error(`Resposta inválida da API: ${url}`)); }
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`HTTP ${res.statusCode}: ${dados.erro || dados.mensagem || corpo}`));
                }
                resolve(dados);
            });
        });
        req.on("error", reject);
        if (opcoes.body !== undefined) req.write(JSON.stringify(opcoes.body));
        req.end();
    });
}

function normalizarForaDeUso(valor) {
    let s = texto(valor).toUpperCase();
    s = s.replace(/NÃƒÆ’O/g, "NAO").replace(/NÃƒO/g, "NAO").replace(/NÃO/g, "NAO").replace(/NÃ?O/g, "NAO").replace(/NÃO/g, "NAO").trim();
    return s === "SIM" ? "SIM" : "NAO";
}

function normalizarProdutoSys(produto) {
    return {
        id: Number(produto.id),
        descricao: texto(produto.descricao),
        preco_venda: numero(produto.preco_venda ?? produto.preco),
        estoque: numero(produto.estoque),
        disponivel: normalizarForaDeUso(produto.ForaDeUso) !== "SIM",
        ForaDeUso: normalizarForaDeUso(produto.ForaDeUso),
        imagem: texto(produto.imagem)
    };
}

function mapaPorId(lista) {
    return new Map(lista.map(p => [Number(p.id), p]).filter(([id]) => Number.isInteger(id) && id > 0));
}

async function carregarSysOn() {
    const resposta = await requisicaoJson(API_PRODUTOS);
    if (!Array.isArray(resposta)) throw new Error("A API do Sys-On não retornou uma lista.");
    const produtos = resposta.map(normalizarProdutoSys).filter(p => Number.isInteger(p.id) && p.id > 0);
    if (produtos.length < 200) throw new Error(`SINCRONIZAÇÃO ABORTADA: API retornou somente ${produtos.length} produtos.`);
    console.log(`Sys-On: ${produtos.length} produtos válidos.`);
    return produtos;
}

function carregarCatalogo() {
    const dados = lerJson(CATALOGO_FILE, []);
    if (Array.isArray(dados)) {
        if (dados.length === 1 && Array.isArray(dados[0]?.value)) return dados[0].value;
        return dados;
    }
    if (dados && Array.isArray(dados.value)) return dados.value;
    if (dados && Array.isArray(dados.produtos)) return dados.produtos;
    throw new Error("Formato de produtos-online.json não reconhecido.");
}

async function aplicarAjustesVenda(ajustes, mapaSys) {
    const processados = [];
    for (const [idTexto, ajuste] of Object.entries(ajustes)) {
        const id = Number(idTexto);
        if (!Number.isInteger(id) || id <= 0 || !mapaSys.has(id) || !ajuste || typeof ajuste !== "object") continue;

        const dados = { id };
        let alterouSysOn = false;

        if (ajuste.descricao !== undefined) {
            const descricao = texto(ajuste.descricao);
            if (descricao && descricao !== mapaSys.get(id).descricao) {
                dados.descricao = descricao;
                alterouSysOn = true;
            }
        }

        if (ajuste.preco !== undefined || ajuste.preco_venda !== undefined) {
            const precoVenda = numero(ajuste.preco ?? ajuste.preco_venda);
            if (precoVenda !== mapaSys.get(id).preco_venda) {
                dados.preco_venda = precoVenda;
                alterouSysOn = true;
            }
        }

        if (!alterouSysOn) continue;

        console.log(`ID ${id}: enviando nome/preço de venda ao Sys-On...`);
        const resposta = await requisicaoJson(API_SINCRONIZAR, { method: "POST", body: dados });
        if (resposta.sucesso !== true) throw new Error(`Falha ao atualizar ID ${id} no Sys-On.`);
        console.log(`ID ${id}: atualizado no Sys-On.`);
        processados.push(id);
    }
    return processados;
}

async function sincronizarCustos() {
    console.log("");
    console.log("Sincronizando custos de custeamento para o Sys-On...");
    const resposta = await requisicaoJson(API_ADMIN_CUSTOS, { method: "POST", body: {} });
    if (!resposta.ok) throw new Error(resposta.erro || "Não foi possível sincronizar os custos.");
    console.log(`Custos avaliados: ${resposta.quantidade || 0}`);
    console.log(`Custos atualizados: ${resposta.atualizados || 0}`);
    console.log(`Sem alteração: ${resposta.sem_alteracao || 0}`);
    if (resposta.nao_encontrados) console.log(`Produtos não encontrados: ${resposta.nao_encontrados}`);
    return resposta;
}

function sincronizarFotos(mapaSys, catalogoAtual) {
    garantirPasta(PASTA_IMAGENS_CATALOGO);
    garantirPasta(PASTA_IMAGENS_SYSON);
    let copiasParaCatalogo = 0;
    let copiasParaSysOn = 0;

    for (const [id, sys] of mapaSys) {
        const nome = `${id}.jpg`;
        const catalogoFoto = path.join(PASTA_IMAGENS_CATALOGO, nome);
        const sysFoto = path.join(PASTA_IMAGENS_SYSON, nome);
        const existeCatalogo = fs.existsSync(catalogoFoto);
        const existeSys = fs.existsSync(sysFoto);

        try {
            if (existeCatalogo && !existeSys) {
                fs.copyFileSync(catalogoFoto, sysFoto);
                copiasParaSysOn++;
            } else if (!existeCatalogo && existeSys) {
                fs.copyFileSync(sysFoto, catalogoFoto);
                copiasParaCatalogo++;
            } else if (existeCatalogo && existeSys) {
                const a = fs.statSync(catalogoFoto);
                const b = fs.statSync(sysFoto);
                if (a.size === b.size && Math.abs(a.mtimeMs - b.mtimeMs) < 1000) continue;
                if (a.mtimeMs > b.mtimeMs) {
                    fs.copyFileSync(catalogoFoto, sysFoto);
                    copiasParaSysOn++;
                } else if (b.mtimeMs > a.mtimeMs) {
                    fs.copyFileSync(sysFoto, catalogoFoto);
                    copiasParaCatalogo++;
                }
            }
        } catch (erro) {
            console.warn(`ID ${id}: erro ao sincronizar foto: ${erro.message}`);
        }
    }

    if (copiasParaCatalogo || copiasParaSysOn) {
        console.log(`Fotos: ${copiasParaCatalogo} Sys-On -> catálogo; ${copiasParaSysOn} catálogo -> Sys-On.`);
    }
}

function construirCatalogo(produtosSysOn, catalogoAtual, ajustes) {
    const antigos = mapaPorId(catalogoAtual);
    return produtosSysOn.map(sys => {
        const antigo = antigos.get(sys.id) || {};
        const ajuste = ajustes[String(sys.id)] || {};
        const categorias = Array.isArray(ajuste.categorias)
            ? ajuste.categorias
            : Array.isArray(antigo.categorias) ? antigo.categorias : [];

        const disponivel = ajuste.exibirSite !== undefined
            ? Boolean(ajuste.exibirSite)
            : antigo.disponivel !== undefined ? Boolean(antigo.disponivel) : sys.disponivel;

        return {
            ...antigo,
            id: sys.id,
            descricao: sys.descricao,
            preco_venda: sys.preco_venda,
            preco: sys.preco_venda,
            estoque: sys.estoque,
            disponivel,
            ForaDeUso: sys.ForaDeUso,
            imagem: antigo.imagem || sys.imagem || `img/produtos/${sys.id}.jpg`,
            categorias,
            promocao: ajuste.promocao !== undefined ? Boolean(ajuste.promocao) : Boolean(antigo.promocao),
            novo: ajuste.novo !== undefined ? Boolean(ajuste.novo) : Boolean(antigo.novo)
        };
    });
}

async function main() {
    console.log("");
    console.log("================================================");
    console.log(" SINCRONIZADOR D'LIMP");
    console.log("================================================");

    const backup = fazerBackup();
    console.log(`Backup: ${backup}`);

    const produtosSysOn = await carregarSysOn();
    let mapaSys = mapaPorId(produtosSysOn);
    const catalogoAtual = carregarCatalogo();
    console.log(`Catálogo atual: ${catalogoAtual.length} produtos.`);
    const ajustes = lerJson(AJUSTES_FILE, {});

    const ajustesVenda = await aplicarAjustesVenda(ajustes, mapaSys);
    if (ajustesVenda.length) {
        const atualizados = await carregarSysOn();
        mapaSys = mapaPorId(atualizados);
    }

    const resultadoCustos = await sincronizarCustos();

    if (ajustesVenda.length || Number(resultadoCustos.atualizados || 0) > 0) {
        const atualizados = await carregarSysOn();
        mapaSys = mapaPorId(atualizados);
    }

    sincronizarFotos(mapaSys, catalogoAtual);

    const novoCatalogo = construirCatalogo([...mapaSys.values()], catalogoAtual, ajustes);
    salvarJson(CATALOGO_FILE, novoCatalogo);

    const ajustesRestantes = { ...ajustes };
    for (const id of ajustesVenda) delete ajustesRestantes[String(id)];

    // O custo só é removido dos ajustes quando a chamada de sincronização terminou sem erro.
    // Mantemos outros campos do mesmo produto, caso existam.
    const custosSincronizados = new Set(
        (resultadoCustos.resultados || [])
            .filter(item => ["atualizado", "sem_alteracao"].includes(item.status))
            .map(item => String(item.id))
    );
    for (const id of custosSincronizados) {
        if (ajustesRestantes[id] && ajustesRestantes[id].custo_custeamento !== undefined) {
            const restante = { ...ajustesRestantes[id] };
            delete restante.custo_custeamento;
            if (Object.keys(restante).length) ajustesRestantes[id] = restante;
            else delete ajustesRestantes[id];
        }
    }
    salvarJson(AJUSTES_FILE, ajustesRestantes);

    console.log("");
    console.log("================================================");
    console.log(" SINCRONIZAÇÃO CONCLUÍDA");
    console.log("================================================");
    console.log(`Produtos no Sys-On: ${mapaSys.size}`);
    console.log(`Produtos no catálogo: ${novoCatalogo.length}`);
    console.log(`Custos atualizados: ${resultadoCustos.atualizados || 0}`);
    console.log("Nome e preço de venda: Admin -> Sys-On");
    console.log("Custo de compra: Custeamento -> Sys-On");
    console.log("Estoque: Sys-On -> catálogo");
    console.log("ForaDeUso: Sys-On -> catálogo");
    console.log("Categorias, promoções e novidades: preservadas no catálogo");
    console.log("Fotos: sincronização bidirecional");
    console.log("");
}

main().catch(erro => {
    console.error("");
    console.error("================================================");
    console.error(" SINCRONIZAÇÃO ABORTADA");
    console.error("================================================");
    console.error(erro.message);
    console.error("");
    process.exitCode = 1;
});
