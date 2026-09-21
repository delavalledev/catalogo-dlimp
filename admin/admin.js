const hostPermitido =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

if (!hostPermitido) {
    window.location.replace("/");
}
let produtos = [];
let filtrados = [];
let produtosDaBase = [];
let vinculosProdutosFinais = [];
let produtosFinaisFiltrados = [];
let custosPendentesProdutosFinais = new Map();

const lista = document.getElementById("listaProdutos");
const busca = document.getElementById("busca");
const filtroStatus = document.getElementById("filtroStatus");


function produtoIdNormalizado(produto) {
    return String(produto?.id ?? produto?.codigo ?? "").trim();
}

async function carregarProdutosFinais() {
    const lista = document.getElementById("listaProdutosFinais");
    if (!lista) return;
    lista.innerHTML = `<div class="estado-produtos-finais"><strong>Carregando produtos...</strong><span>Calculando os vínculos e custos das bases.</span></div>`;

    try {
        if (!produtos.length) await carregarProdutos();
        if (!insumos.length) await carregarInsumos();

        const resposta = await fetch("http://127.0.0.1:3100/custeamento/produtos-finais");
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Não foi possível carregar os produtos finais.");

        vinculosProdutosFinais = Array.isArray(dados.produtos) ? dados.produtos : [];
        preencherFiltroCategoriasProdutosFinais();
        filtrarProdutosFinais();
    } catch (erro) {
        console.error("Erro ao carregar produtos finais:", erro);
        lista.innerHTML = `<div class="estado-produtos-finais"><strong>Não foi possível carregar os produtos finais.</strong><span>${escaparHtml(erro.message)}</span></div>`;
    }
}

function preencherFiltroCategoriasProdutosFinais() {
    const select = document.getElementById("filtroCategoriaProdutoFinal");
    if (!select) return;
    const atual = select.value;
    const categorias = [
        ["residencial", "Residencial"],
        ["industrial", "Industrial"],
        ["automotivo", "Automotivo"],
        ["utilitarios", "Utilitários"]
    ];
    select.innerHTML = `<option value="">Todas as categorias</option>` + categorias.map(([id,nome]) =>
        `<option value="${id}">${nome}</option>`
    ).join("");
    select.value = atual;
}

function produtoCategoriasForm(produto) {
    if (Array.isArray(produto?.categorias)) return produto.categorias.map(String);
    return produto?.categoria ? [String(produto.categoria)] : [];
}

function produtoTemCustoFinal(item) {
    if (item.vinculos.length) return true;
    const id = produtoIdNormalizado(item.produto);
    if (custosPendentesProdutosFinais.has(id)) {
        const v = custosPendentesProdutosFinais.get(id);
        return v !== null && Number.isFinite(v) && v >= 0;
    }
    return produtoCustoManual(item.produto) !== null;
}

function montarDadosProdutosFinais() {
    const porProduto = new Map();
    for (const produto of produtos) {
        const id = produtoIdNormalizado(produto);
        if (!id || String(produto.ForaDeUso || "").toUpperCase() === "SIM") continue;
        porProduto.set(id, { produto, vinculos: [] });
    }
    for (const vinculo of vinculosProdutosFinais) {
        const id = String(vinculo.produto_id ?? "");
        if (!porProduto.has(id)) continue;
        porProduto.get(id).vinculos.push(vinculo);
    }
    return [...porProduto.values()];
}

function filtrarProdutosFinais() {
    const termo = String(document.getElementById("buscaProdutoFinal")?.value || "").toLowerCase().trim();
    const categoria = String(document.getElementById("filtroCategoriaProdutoFinal")?.value || "");
    const status = document.getElementById("filtroStatusProdutoFinal")?.value || "todos";

    produtosFinaisFiltrados = montarDadosProdutosFinais().filter(item => {
        const nome = produtoNomeForm(item.produto).toLowerCase();
        const id = produtoIdNormalizado(item.produto).toLowerCase();
        const temBase = item.vinculos.length > 0;
        const temCusto = produtoTemCustoFinal(item);
        if (termo && !nome.includes(termo) && !id.includes(termo)) return false;
        if (categoria && !produtoCategoriasForm(item.produto).includes(categoria)) return false;
        if (status === "fabricados" && !temBase) return false;
        if (status === "revenda" && temBase) return false;
        if (status === "sem-custo" && temCusto) return false;
        return true;
    }).sort((a,b) => produtoNomeForm(a.produto).localeCompare(produtoNomeForm(b.produto), "pt-BR", {sensitivity:"base"}));

    renderizarProdutosFinais();
}

function renderizarProdutosFinais() {
    const lista = document.getElementById("listaProdutosFinais");
    const resumo = document.getElementById("resumoProdutosFinais");
    if (!lista) return;

    const todos = montarDadosProdutosFinais();
    const comBase = todos.filter(x => x.vinculos.length).length;
    const semBase = todos.length - comBase;
    const custoMedio = todos.filter(x => x.vinculos.length).reduce((soma, item) => {
        const v = item.vinculos[0];
        const vol = Number(v.volume || produtoVolumeForm(item.produto) || 0);
        const emb = v.embalagem_id ? insumos.find(i => String(i.id) === String(v.embalagem_id)) : null;
        const acc = v.acessorio_id ? insumos.find(i => String(i.id) === String(v.acessorio_id)) : null;
        return soma + Number(v.custo_por_unidade || 0) * vol + Number(emb?.preco_atual || 0) + Number(acc?.preco_atual || 0);
    }, 0);
    const media = comBase ? custoMedio / comBase : 0;

    if (resumo) {
        resumo.innerHTML = `
            <div class="resumo-chip"><span>PRODUTOS</span><strong>${todos.length}</strong></div>
            <div class="resumo-chip"><span>COM BASE</span><strong>${comBase}</strong></div>
            <div class="resumo-chip"><span>SEM BASE</span><strong>${semBase}</strong></div>
            <div class="resumo-chip destaque"><span>CUSTO MÉDIO</span><strong>${formatarMoeda(media)}</strong></div>`;
    }

    if (!produtosFinaisFiltrados.length) {
        lista.innerHTML = `<div class="estado-produtos-finais"><strong>Nenhum produto encontrado.</strong><span>Ajuste a busca ou os filtros.</span></div>`;
        return;
    }

    lista.innerHTML = produtosFinaisFiltrados.map(item => {
        const produto = item.produto;
        const venda = produtoVendaForm(produto);
        const vinculo = item.vinculos[0];
        if (!vinculo) {
            const idProdutoFinal = produtoIdNormalizado(produto);
            const custoManual = custosPendentesProdutosFinais.has(idProdutoFinal) ? custosPendentesProdutosFinais.get(idProdutoFinal) : produtoCustoManual(produto);
            const lucroManual = custoManual === null ? null : venda - custoManual;
            const margemManual = custoManual === null || venda <= 0 ? null : (lucroManual / venda) * 100;
            return `<div class="produto-final-linha produto-final-revenda" data-produto-final-id="${escaparHtml(produtoIdNormalizado(produto))}">
                <div class="produto-final-identidade"><div class="produto-final-icone produto-final-icone-revenda">$</div><div><strong>${escaparHtml(produtoNomeForm(produto))}</strong><small>Código ${escaparHtml(produtoIdNormalizado(produto))}</small></div></div>
                <div class="produto-final-base produto-final-sem-base"><strong>Produto de revenda</strong><small>Sem base de produção</small></div>
                <div class="produto-final-volume">${produtoVolumeForm(produto) > 0 ? volumeLabelCalc(produtoVolumeForm(produto)) : "-"}</div>
                <div class="produto-final-num produto-final-custo-manual">
                    <label class="campo-custo-manual" title="Custo de compra do produto">
                        <span>R$</span>
                        <input type="text" inputmode="decimal" value="${custoManual === null ? "" : custoManual.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2})}" placeholder="0,00" data-custo-produto="${escaparHtml(produtoIdNormalizado(produto))}">
                    </label>
                </div>
                <div class="produto-final-venda">${formatarMoeda(venda)}</div>
                <div class="produto-final-lucro">${lucroManual === null ? '<strong>-</strong>' : `<strong>${formatarMoeda(lucroManual)}</strong><small>${margemManual.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})}%</small>`}</div>
                <div class="produto-final-margem">${margemManual === null ? '-' : `${margemManual.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})}%`}</div>
            </div>`;
        }

        const volume = Number(vinculo.volume || produtoVolumeForm(produto) || 0);
        const embalagem = vinculo.embalagem_id ? insumos.find(i => String(i.id) === String(vinculo.embalagem_id)) : null;
        const acessorio = vinculo.acessorio_id ? insumos.find(i => String(i.id) === String(vinculo.acessorio_id)) : null;
        const custo = Number(vinculo.custo_por_unidade || 0) * volume + Number(embalagem?.preco_atual || 0) + Number(acessorio?.preco_atual || 0);
        const lucro = venda - custo;
        const margem = venda > 0 ? lucro / venda * 100 : 0;
        const detalhe = [embalagem?.nome, acessorio?.nome].filter(Boolean).join(" • ");
        return `<div class="produto-final-linha">
            <div class="produto-final-identidade"><div class="produto-final-icone">✓</div><div><strong>${escaparHtml(produtoNomeForm(produto))}</strong><small>Código ${escaparHtml(produtoIdNormalizado(produto))}</small></div></div>
            <div class="produto-final-base"><strong>${escaparHtml(vinculo.base_nome || "Base sem nome")}</strong><small>${escaparHtml(detalhe || "Sem acessório adicional")}</small></div>
            <div class="produto-final-volume">${volumeLabelCalc(volume)}</div>
            <div class="produto-final-num">${formatarMoeda(custo)}</div>
            <div class="produto-final-venda">${formatarMoeda(venda)}</div>
            <div class="produto-final-lucro"><strong>${formatarMoeda(lucro)}</strong><small>${margem.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})}%</small></div>
            <div class="produto-final-margem">${margem.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})}%</div>
        </div>`;
    }).join("");

    lista.querySelectorAll("[data-custo-produto]").forEach(input => {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                input.blur();
            }
        });
        input.addEventListener("input", () => atualizarCustoPendenteProdutoFinal(input));
    });
    atualizarIndicadorCustosPendentes();
}

function numeroDigitadoBR(valor) {
    const texto = String(valor || "").trim().replace(/\s/g, "");
    if (!texto) return null;
    const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
    const numero = Number(normalizado);
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function atualizarIndicadorCustosPendentes() {
    const indicador = document.getElementById("indicadorCustosPendentes");
    const botao = document.getElementById("salvarCustosProdutosFinais");
    const total = custosPendentesProdutosFinais.size;
    if (indicador) indicador.textContent = total ? `${total} alteração${total === 1 ? "" : "ões"} pendente${total === 1 ? "" : "s"}` : "Nenhuma alteração pendente";
    if (botao) botao.disabled = total === 0;
}

function atualizarCustoPendenteProdutoFinal(input) {
    const id = String(input.dataset.custoProduto || "");
    const custo = numeroDigitadoBR(input.value);
    if (!id) return;
    custosPendentesProdutosFinais.set(id, custo);

    const linha = input.closest(".produto-final-linha");
    const produto = produtos.find(p => String(produtoIdNormalizado(p)) === id);
    if (linha && produto && custo !== null) {
        const venda = produtoVendaForm(produto);
        const lucro = venda - custo;
        const margem = venda > 0 ? (lucro / venda) * 100 : 0;
        const lucroEl = linha.querySelector(".produto-final-lucro");
        const margemEl = linha.querySelector(".produto-final-margem");
        if (lucroEl) lucroEl.innerHTML = `<strong>${formatarMoeda(lucro)}</strong><small>${margem.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})}%</small>`;
        if (margemEl) margemEl.textContent = `${margem.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})}%`;
    } else if (linha) {
        const lucroEl = linha.querySelector(".produto-final-lucro");
        const margemEl = linha.querySelector(".produto-final-margem");
        if (lucroEl) lucroEl.innerHTML = "<strong>-</strong>";
        if (margemEl) margemEl.textContent = "-";
    }
    atualizarIndicadorCustosPendentes();
}

async function salvarCustosPendentesProdutosFinais() {
    if (!custosPendentesProdutosFinais.size) return;
    const botao = document.getElementById("salvarCustosProdutosFinais");
    if (botao) botao.disabled = true;
    try {
        const ajustes = {};
        for (const [id, custo] of custosPendentesProdutosFinais.entries()) {
            if (custo !== null) ajustes[id] = { custo_custeamento: Number(custo.toFixed(3)) };
        }
        if (!Object.keys(ajustes).length) throw new Error("Informe pelo menos um custo válido.");
        const resposta = await fetch("http://127.0.0.1:3100/ajustes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ajustes)
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro || "Não foi possível salvar os custos.");
        custosPendentesProdutosFinais.clear();
        await carregarProdutos();
        await carregarProdutosFinais();
    } catch (erro) {
        console.error(erro);
        alert(erro.message);
        atualizarIndicadorCustosPendentes();
    }
}

async function carregarProdutos() {
    const resposta = await fetch("../data/produtos-online.json?v=" + Date.now());
    produtos = await resposta.json();

    try {
        const respostaAjustes = await fetch("http://127.0.0.1:3100/ajustes");
        const ajustes = await respostaAjustes.json();

        produtos = produtos.map(produto => {
            const ajuste = ajustes[String(produto.id)];

            if (!ajuste) {
                return produto;
            }

            return {
                ...produto,
                ...ajuste
            };
        });

    } catch (erro) {
        console.warn("Não foi possível carregar os ajustes:", erro);
    }

    atualizarResumo();
    filtrar();
}

function atualizarResumo() {
    document.getElementById("totalProdutos").textContent = produtos.length;

    document.getElementById("totalDisponiveis").textContent =
        produtos.filter(p => p.disponivel === true).length;

    document.getElementById("totalIndisponiveis").textContent =
        produtos.filter(p => p.disponivel === false).length;

    document.getElementById("totalSemFoto").textContent =
        produtos.filter(p =>
            !p.imagem ||
            p.imagem.includes("sem_imagem")
        ).length;
}

function filtrar() {
    const termo = busca.value.toLowerCase().trim();
    const status = filtroStatus.value;

    filtrados = produtos.filter(p => {
        const nome = (p.descricao || "").toLowerCase();
        const codigo = String(p.id || "");

        if (
            termo &&
            !nome.includes(termo) &&
            !codigo.includes(termo)
        ) {
            return false;
        }

        if (status === "disponiveis" && p.disponivel !== true)
            return false;

        if (status === "indisponiveis" && p.disponivel !== false)
            return false;

        if (
            status === "semfoto" &&
            p.imagem &&
            !p.imagem.includes("sem_imagem")
        ) {
            return false;
        }

        if (
            status === "foradeuso" &&
            p.ForaDeUso !== "SIM"
        ) {
            return false;
        }

                return true;
    });

    filtrados.sort((a, b) => {
        const nomeA = String(a.descricao || "");
        const nomeB = String(b.descricao || "");

        return nomeA.localeCompare(nomeB, "pt-BR", {
            sensitivity: "base"
        });
    });

    renderizar();
}

function renderizar() {
    lista.innerHTML = "";

    filtrados.forEach(p => {
        const card = document.createElement("div");
        card.className = "produto";

        const imagem =
            p.imagem && !p.imagem.includes("sem_imagem")
                ? "../" + p.imagem
                : "../img/produtos/sem_imagem.png";

        card.innerHTML = `
            <img src="${imagem}"
                 onerror="this.src='../img/produtos/sem_imagem.png'">

            <div class="produto-info">
                <div class="codigo">Código ${p.id}</div>

                <h3>${String(p.descricao || "Produto sem nome").replace(/—/g, "-")}</h3>

                <div class="preco">
                    R$ ${Number(p.preco || 0).toFixed(2).replace(".", ",")}
                </div>

                <span class="status ${
                    p.disponivel ? "disponivel" : "indisponivel"
                }">
                    ${p.disponivel ? "Disponível" : "Indisponível"}
                </span>
            </div>
        `;

        card.addEventListener("click", () => abrirProduto(p));

        lista.appendChild(card);
    });
}

function abrirProduto(p) {
    document.getElementById("produtoId").value = p.id;
    document.getElementById("codigoProduto").value = p.id;
    document.getElementById("nomeProduto").value = p.descricao || "";
    document.getElementById("precoProduto").value = p.preco || 0;
    document.getElementById("estoqueProduto").value = p.estoque ?? 0;

    document.getElementById("disponivelProduto").value =
        String(p.disponivel === true);

    document.getElementById("foraDeUsoProduto").value =
        p.ForaDeUso || "NÃO";

    const categoriasProduto = Array.isArray(p.categorias)
    ? p.categorias
    : (p.categoria ? [p.categoria] : []);

    document.querySelectorAll(".categoria-check").forEach(check => {
    check.checked = categoriasProduto.includes(check.value);
    });

    document.getElementById("exibirSiteProduto").value =
        String(p.exibirSite !== false);

    document.getElementById("promocaoProduto").checked =
        p.promocao === true;

    document.getElementById("novoProduto").checked =
        p.novo === true;

    document.getElementById("fotoProduto").src =
        p.imagem && !p.imagem.includes("sem_imagem")
            ? "../" + p.imagem
            : "../img/produtos/sem_imagem.png";

    document.getElementById("modal").classList.remove("oculto");
}

document.getElementById("fecharModal").onclick = () => {
    document.getElementById("modal").classList.add("oculto");
};

document.getElementById("novaFoto").addEventListener("change", async e => {
    const arquivo = e.target.files[0];

    if (!arquivo) return;

    const id = document.getElementById("produtoId").value;
    const foto = document.getElementById("fotoProduto");

    // Mostra a nova foto imediatamente
    foto.src = URL.createObjectURL(arquivo);

    try {
        const base64 = await new Promise((resolve, reject) => {
            const leitor = new FileReader();

            leitor.onload = () => {
                const resultado = String(leitor.result);
                resolve(resultado.split(",")[1]);
            };

            leitor.onerror = reject;
            leitor.readAsDataURL(arquivo);
        });

        const resposta = await fetch("http://127.0.0.1:3100/foto", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: id,
                tipo: arquivo.type,
                base64: base64
            })
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(resultado.erro || "Erro ao enviar foto.");
        }

        const produto = produtos.find(
            p => String(p.id) === String(id)
        );

        if (produto) {
            produto.imagem = resultado.imagem;
        }

        alert("Foto salva com sucesso!");

    } catch (erro) {
        console.error(erro);
        alert("Erro ao salvar foto: " + erro.message);
    }
});

document.getElementById("salvarProduto").onclick = async () => {
    const botao = document.getElementById("salvarProduto");
    const id = document.getElementById("produtoId").value;

    try {
        botao.disabled = true;
        botao.textContent = "Salvando...";

        const respostaAtual = await fetch("http://127.0.0.1:3100/ajustes");
        const ajustes = await respostaAtual.json();

        ajustes[id] = {
            descricao: document.getElementById("nomeProduto").value.trim(),
            preco: Number(document.getElementById("precoProduto").value),
            disponivel: document.getElementById("disponivelProduto").value === "true",
            categorias: Array.from(
            document.querySelectorAll(".categoria-check:checked")
            ).map(check => check.value),
            exibirSite: document.getElementById("exibirSiteProduto").value === "true",
            promocao: document.getElementById("promocaoProduto").checked,
            novo: document.getElementById("novoProduto").checked
        };

        const respostaSalvar = await fetch(
            "http://127.0.0.1:3100/ajustes",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(ajustes)
            }
        );

        if (!respostaSalvar.ok) {
            throw new Error("Não foi possível salvar.");
        }

        const produto = produtos.find(
            p => String(p.id) === String(id)
        );

        if (produto) {
            Object.assign(produto, ajustes[id]);
        }

        atualizarResumo();
        filtrar();

        document.getElementById("avisoApi").textContent =
            "Alterações salvas neste computador. Ainda não publicadas no site.";

        alert("Produto salvo com sucesso!");

    } catch (erro) {
        console.error(erro);
        alert("Erro ao salvar o produto: " + erro.message);

    } finally {
        botao.disabled = false;
        botao.textContent = "Salvar alterações";
    }
};

document.getElementById("excluirProduto").onclick = async () => {

    const botao = document.getElementById("excluirProduto");
    const id = document.getElementById("produtoId").value;

    const produto = produtos.find(
        p => String(p.id) === String(id)
    );

    if (!id || !produto) {
        alert("Produto inválido.");
        return;
    }

    const confirmar = confirm(
        `Excluir o produto "${produto.descricao}" do catálogo?\n\n` +
        "O produto será removido do catálogo e a exclusão será sincronizada com o Sys-On."
    );

    if (!confirmar) {
        return;
    }

    try {

        botao.disabled = true;
        botao.textContent = "Excluindo...";

        const resposta = await fetch(
            "http://127.0.0.1:3100/excluir",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: id
                })
            }
        );

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                resultado.erro || "Não foi possível excluir o produto."
            );
        }

        produtos = produtos.filter(
            p => String(p.id) !== String(id)
        );

        atualizarResumo();
        filtrar();

        document.getElementById("modal").classList.add("oculto");

        document.getElementById("avisoApi").textContent =
            "Produto excluído do catálogo. Execute o sincronizador para concluir a exclusão no Sys-On.";

        alert(
            "Produto excluído do catálogo!\n\n" +
            "Agora execute o sincronizador para concluir a exclusão no Sys-On."
        );

    } catch (erro) {

        console.error(erro);

        alert(
            "Erro ao excluir o produto:\n\n" +
            erro.message
        );

    } finally {

        botao.disabled = false;
        botao.textContent = "Excluir produto";

    }
};


busca.addEventListener("input", filtrar);
filtroStatus.addEventListener("change", filtrar);

carregarProdutos().catch(erro => {
    console.error(erro);

    lista.innerHTML =
        "<p>Não foi possível carregar os produtos.</p>";
});

document.getElementById("publicarSite").addEventListener("click", async () => {
    const botao = document.getElementById("publicarSite");

    try {
        botao.disabled = true;
        botao.textContent = "☁ Publicando...";

        const resposta = await fetch(
            "http://127.0.0.1:3100/publicar",
            {
                method: "POST"
            }
        );

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(resultado.erro || "Erro ao publicar.");
        }

        if (resultado.publicou === false) {
            alert("Não existem alterações novas para publicar.");
        } else {
            alert(
                "Publicado com sucesso!\n\n" +
                "O site pode levar alguns segundos ou minutos para atualizar."
            );
        }

    } catch (erro) {
        console.error(erro);

        alert(
            "Erro ao publicar:\n\n" +
            erro.message
        );

    } finally {
        botao.disabled = false;
        botao.textContent = "☁ Publicar no site";
    }
});


/* =========================================================
   CUSTEAMENTO - INSUMOS
   ========================================================= */

let insumos = [];
let insumosFiltrados = [];
let fornecedores = [];
let fornecedoresFiltrados = [];
let fornecedorSelecionadoId = null;

async function carregarFornecedores() {
    const lista = document.getElementById("listaFornecedores");
    try {
        const resposta = await fetch("http://127.0.0.1:3100/custeamento/fornecedores");
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Erro ao carregar fornecedores.");
        fornecedores = Array.isArray(dados.fornecedores) ? dados.fornecedores : [];
        fornecedoresFiltrados = [...fornecedores];
        preencherFornecedoresInsumo();
        renderizarFornecedores();
        if (lista) lista.dataset.carregado = "1";
    } catch (erro) {
        console.error("Erro ao carregar fornecedores:", erro);
        if (lista) lista.innerHTML = `<div class="estado-fornecedores erro">Não foi possível carregar os fornecedores.<small>${escaparHtml(erro.message)}</small></div>`;
    }
}

function preencherFornecedoresInsumo() {
    const select = document.getElementById("fornecedorInsumo");
    if (!select) return;
    const atual = select.value;
    select.innerHTML = `<option value="">Sem fornecedor definido</option>` +
        fornecedores.sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))
            .map(f => `<option value="${f.id}">${escaparHtml(f.nome)}${f.ativo === false ? " (Inativo)" : ""}</option>`).join("");
    if (atual) select.value = atual;
}

function renderizarFornecedores() {
    const lista = document.getElementById("listaFornecedores");
    if (!lista) return;
    const termo = String(document.getElementById("buscaFornecedor")?.value || "").toLowerCase().trim();
    fornecedoresFiltrados = fornecedores.filter(f => {
        if (!termo) return true;
        return String(f.nome || "").toLowerCase().includes(termo) || String(f.telefone || "").toLowerCase().includes(termo);
    }).sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

    if (!fornecedoresFiltrados.length) {
        lista.innerHTML = `<div class="estado-fornecedores"><strong>Nenhum fornecedor encontrado.</strong><span>Cadastre um novo fornecedor ou ajuste a busca.</span></div>`;
        return;
    }

    lista.innerHTML = fornecedoresFiltrados.map(f => {
        const itens = insumos.filter(i => Number(i.fornecedor_id) === Number(f.id));
        const selecionado = Number(f.id) === Number(fornecedorSelecionadoId);
        return `<article class="card-fornecedor ${selecionado ? "selecionado" : ""}" data-fornecedor-id="${f.id}">
            <div class="card-fornecedor-topo">
                <div class="fornecedor-avatar">${escaparHtml(String(f.nome || "?").charAt(0).toUpperCase())}</div>
                <div class="fornecedor-identidade"><strong>${escaparHtml(f.nome)}</strong><small>${f.ativo === false ? "Inativo" : "Fornecedor ativo"}</small></div>
                <button type="button" class="btn-editar-fornecedor" data-editar-fornecedor="${f.id}">Editar</button>
            </div>
            <div class="card-fornecedor-info">
                <span>${f.telefone ? "☎ " + escaparHtml(f.telefone) : "Sem telefone cadastrado"}</span>
                <strong>${itens.length} ${itens.length === 1 ? "insumo" : "insumos"}</strong>
            </div>
            ${f.observacao ? `<p>${escaparHtml(f.observacao)}</p>` : ""}
            <button type="button" class="btn-ver-insumos-fornecedor" data-ver-fornecedor="${f.id}">${selecionado ? "Ocultar insumos" : "Ver insumos"}</button>
            ${selecionado ? `<div class="fornecedor-insumos-lista">${itens.length ? itens.map(i => `<div><span>${escaparHtml(i.nome)}</span><strong>${formatarMoeda(i.preco_atual)}</strong></div>`).join("") : `<small>Nenhum insumo vinculado ainda.</small>`}</div>` : ""}
        </article>`;
    }).join("");

    lista.querySelectorAll("[data-editar-fornecedor]").forEach(btn => btn.addEventListener("click", () => abrirModalFornecedor(Number(btn.dataset.editarFornecedor))));
    lista.querySelectorAll("[data-ver-fornecedor]").forEach(btn => btn.addEventListener("click", () => {
        const id = Number(btn.dataset.verFornecedor);
        fornecedorSelecionadoId = fornecedorSelecionadoId === id ? null : id;
        renderizarFornecedores();
    }));
}

function abrirModalFornecedor(id = null) {
    const modal = document.getElementById("modalFornecedor");
    if (!modal) return;
    document.getElementById("fornecedorId").value = id || "";
    document.getElementById("nomeFornecedor").value = "";
    document.getElementById("telefoneFornecedor").value = "";
    document.getElementById("observacaoFornecedor").value = "";
    document.getElementById("ativoFornecedor").value = "1";
    document.getElementById("avisoFornecedor").textContent = "";
    document.getElementById("excluirFornecedor").style.display = id ? "inline-flex" : "none";
    document.getElementById("tituloModalFornecedor").textContent = id ? "Editar fornecedor" : "Novo fornecedor";
    if (id) {
        const f = fornecedores.find(item => Number(item.id) === Number(id));
        if (!f) return;
        document.getElementById("nomeFornecedor").value = f.nome || "";
        document.getElementById("telefoneFornecedor").value = f.telefone || "";
        document.getElementById("observacaoFornecedor").value = f.observacao || "";
        document.getElementById("ativoFornecedor").value = f.ativo === false ? "0" : "1";
    }
    modal.classList.remove("oculto");
}

function fecharModalFornecedor() {
    document.getElementById("modalFornecedor")?.classList.add("oculto");
}

async function salvarFornecedor() {
    const id = document.getElementById("fornecedorId").value;
    const nome = document.getElementById("nomeFornecedor").value.trim();
    const telefone = document.getElementById("telefoneFornecedor").value.trim();
    const observacao = document.getElementById("observacaoFornecedor").value.trim();
    const ativo = document.getElementById("ativoFornecedor").value === "1";
    const aviso = document.getElementById("avisoFornecedor");
    const botao = document.getElementById("salvarFornecedor");
    if (!nome) { aviso.textContent = "Informe o nome do fornecedor."; return; }
    botao.disabled = true; aviso.textContent = "Salvando...";
    try {
        const resposta = await fetch("http://127.0.0.1:3100/custeamento/fornecedores", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id ? Number(id) : null, nome, telefone, observacao, ativo })
        });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Não foi possível salvar o fornecedor.");
        fecharModalFornecedor();
        await carregarFornecedores();
        await carregarInsumos();
    } catch (erro) {
        console.error(erro); aviso.textContent = erro.message;
    } finally { botao.disabled = false; }
}

async function excluirFornecedor() {
    const id = Number(document.getElementById("fornecedorId").value);
    if (!id) return;
    if (!confirm("Excluir este fornecedor?")) return;
    const aviso = document.getElementById("avisoFornecedor");
    try {
        const resposta = await fetch("http://127.0.0.1:3100/custeamento/fornecedores/excluir", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Não foi possível excluir o fornecedor.");
        fecharModalFornecedor();
        await carregarFornecedores();
        await carregarInsumos();
    } catch (erro) { aviso.textContent = erro.message; }
}

async function carregarInsumos() {
    const lista = document.getElementById("listaInsumos");

    if (!lista) return;

    lista.innerHTML = '<div class="linha-insumo carregando">Carregando insumos...</div>';

    try {
        if (!fornecedores.length) await carregarFornecedores();
        const resposta = await fetch(
           "http://127.0.0.1:3100/custeamento/insumos"
        );

        if (!resposta.ok) {
            throw new Error("Erro HTTP " + resposta.status);
        }

        const dados = await resposta.json();

        if (!dados.ok) {
            throw new Error(dados.erro || "Erro ao carregar insumos.");
        }

        // Embalagens permanecem no cadastro de Insumos para reajuste centralizado.
        // O fracionamento usa esse mesmo cadastro automaticamente.
        insumos = Array.isArray(dados.insumos) ? dados.insumos : [];
        insumosFiltrados = [...insumos];

        renderizarInsumos();

    } catch (erro) {

        console.error("Erro ao carregar insumos:", erro);

        lista.innerHTML = `
            <div class="linha-insumo erro">
                Não foi possível carregar os insumos.
                <br>
                <small>${erro.message}</small>
            </div>
        `;
    }
}

function renderizarInsumos() {

    const lista = document.getElementById("listaInsumos");

    if (!lista) return;

    if (insumosFiltrados.length === 0) {

        lista.innerHTML = `
            <div class="linha-insumo vazio">
                Nenhum insumo encontrado.
            </div>
        `;

        return;
    }

    lista.innerHTML = insumosFiltrados.map(insumo => {

        const tipo = formatarTipoInsumo(insumo.tipo);

        const preco = Number(insumo.preco_atual || 0).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

        return `
            <div class="linha-insumo ${Number(insumo.ativo) === 0 ? "inativo" : ""}">

                <span class="nome-insumo">
                    ${escaparHtml(insumo.nome)}
                    <span class="badge-status-insumo ${Number(insumo.ativo) !== 0 ? "ativo" : "inativo"}">
                        ${Number(insumo.ativo) !== 0 ? "Ativo" : "Inativo"}
                    </span>
                </span>

                <span>
                    <span class="badge-tipo ${String(insumo.tipo).toLowerCase()}">
                        ${tipo}
                    </span>
                </span>

                <span>
                    ${escaparHtml(insumo.unidade || "-")}
                </span>

                <strong>
                    ${preco}
                </strong>

                <button type="button" class="btn-fornecedor-insumo" data-fornecedor-insumo="${insumo.fornecedor_id || ""}">
                    ${escaparHtml(insumo.fornecedor_nome || "Definir fornecedor")}
                </button>

                <button
                    class="btn-editar-insumo"
                    data-id="${insumo.id}"
                >
                    Editar
                </button>

            </div>
        `;

    }).join("");

    document.querySelectorAll(".btn-editar-insumo").forEach(botao => {

        botao.addEventListener("click", function () {

            const id = Number(this.dataset.id);

            abrirModalInsumo(id);

        });

    });

    document.querySelectorAll(".btn-fornecedor-insumo").forEach(botao => {
        botao.addEventListener("click", async function () {
            const id = Number(this.dataset.fornecedorInsumo);
            if (!id) {
                abrirModalInsumo(Number(this.closest(".linha-insumo")?.querySelector(".btn-editar-insumo")?.dataset.id));
                return;
            }
            fornecedorSelecionadoId = id;
            document.getElementById("subMenuFornecedores")?.click();
        });
    });
}

function formatarTipoInsumo(tipo) {

    switch (tipo) {

        case "MATERIA_PRIMA":
            return "Matéria-prima";

        case "EMBALAGEM":
            return "Embalagem";

        case "ACESSORIO":
            return "Acessório";

        default:
            return tipo || "-";
    }
}

function escaparHtml(valor) {

    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =========================================================
// CUSTEAMENTO - RECEITAS Calc
// =========================================================

let receitas = [];
let receitasFiltradas = [];
let receitaEmEdicao = null;
let composicaoReceita = [];
let itensOriginaisReceita = [];
let produtoFinalSelecionado = null;

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

window.formatarMoeda = formatarMoeda;

function numeroBR(valor, casas = 3) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: casas
    });
}

async function carregarReceitas() {
    const lista = document.getElementById("listaReceitas");
    if (!lista) return;

    lista.innerHTML = '<div class="estado-vazio">Carregando receitas...</div>';

    try {
        const resposta = await fetch("http://127.0.0.1:3100/custeamento/receitas");
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) {
            throw new Error(dados.erro || "Erro ao carregar receitas.");
        }

        receitas = Array.isArray(dados.receitas) ? dados.receitas : [];
        receitasFiltradas = [...receitas];
        renderizarReceitas();
        atualizarDashboardReceitas();
    } catch (erro) {
        console.error("Erro ao carregar receitas:", erro);
        lista.innerHTML = `<div class="estado-vazio erro">Não foi possível carregar as receitas.<small>${escaparHtml(erro.message)}</small></div>`;
    }
}

async function obterCalculoReceita(id) {
    try {
        const resposta = await fetch(`http://127.0.0.1:3100/custeamento/receitas/${id}/calculo`);
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) return null;
        return dados;
    } catch (erro) {
        console.error("Erro no cálculo da receita:", id, erro);
        return null;
    }
}

async function atualizarDashboardReceitas() {
    const el = document.getElementById("dashboardCusteamento");
    if (!el) return;

    const total = receitas.length;
    let comCusto = 0;
    let custoMedio = 0;

    for (const receita of receitas) {
        const calculo = await obterCalculoReceita(receita.id);
        if (calculo) {
            const custo = Number(calculo.custo_total || 0);
            if (custo > 0) {
                comCusto++;
                custoMedio += custo;
            }
        }
    }

    const media = comCusto ? custoMedio / comCusto : 0;

    el.innerHTML = `
        <div class="dash-card dash-primary">
            <div class="dash-icon">✦</div>
            <div><span>RECEITAS CADASTRADAS</span><strong>${total}</strong><small>Fórmulas de produção</small></div>
        </div>
        <div class="dash-card">
            <div class="dash-icon">◇</div>
            <div><span>INSUMOS DISPONÍVEIS</span><strong>${insumos.filter(i => Number(i.ativo) !== 0).length}</strong><small>Matérias-primas e acessórios</small></div>
        </div>
        <div class="dash-card">
            <div class="dash-icon">◈</div>
            <div><span>RECEITAS COM CUSTO</span><strong>${comCusto}</strong><small>Composição calculada</small></div>
        </div>
        <div class="dash-card dash-future">
            <div class="dash-icon">↗</div>
            <div><span>RENTABILIDADE</span><strong>Produto final</strong><small>Venda • custo • margem</small></div>
        </div>
    `;
}

async function renderizarReceitas() {
    const lista = document.getElementById("listaReceitas");
    if (!lista) return;

    if (!receitasFiltradas.length) {
        lista.innerHTML = `
            <div class="estado-vazio">
                <div class="estado-icone">✦</div>
                <strong>Nenhuma receita encontrada</strong>
                <span>Cadastre sua primeira fórmula de produção.</span>
            </div>`;
        return;
    }

    lista.innerHTML = receitasFiltradas.map(receita => `
        <div class="linha-receita form">
            <div class="receita-identidade">
                <div class="receita-avatar">⚗</div>
                <div>
                    <strong>${escaparHtml(receita.nome || "Sem nome")}</strong>
                    <small>${receita.observacao ? "Modo de preparo cadastrado" : "Modo de preparo pendente"}</small>
                </div>
            </div>
            <div class="receita-rendimento">
                <strong>${numeroBR(receita.rendimento)}</strong>
                <span>${escaparHtml(receita.unidade_rendimento || "L")}</span>
            </div>
            <div class="receita-custo" data-custo-id="${receita.id}">
                <strong>...</strong>
                <small>calculando</small>
            </div>
            <div class="receita-acoes calc">
                <button type="button" class="btn-editar-receita form" data-id="${receita.id}">Editar</button>
                <button type="button" class="btn-excluir-receita-calc" data-id="${receita.id}" title="Excluir receita">Excluir</button>
            </div>
        </div>
    `).join("");

    lista.querySelectorAll(".btn-editar-receita").forEach(botao => {
        botao.addEventListener("click", () => abrirModalReceita(Number(botao.dataset.id)));
    });

    lista.querySelectorAll(".btn-excluir-receita-calc").forEach(botao => {
        botao.addEventListener("click", async () => {
            const receita = receitas.find(r => Number(r.id) === Number(botao.dataset.id));
            if (!receita) return;
            if (!confirm(`Excluir a receita "${receita.nome}"?\n\nA receita e sua composição serão removidas.`)) return;
            botao.disabled = true;
            try {
                const resposta = await fetch("http://127.0.0.1:3100/custeamento/receitas/excluir", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: Number(receita.id) })
                });
                const dados = await resposta.json();
                if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Não foi possível excluir a receita.");
                await carregarReceitas();
            } catch (erro) {
                alert("Erro ao excluir receita: " + erro.message);
                botao.disabled = false;
            }
        });
    });

    for (const receita of receitasFiltradas) {
        const calculo = await obterCalculoReceita(receita.id);
        const campo = lista.querySelector(`[data-custo-id="${receita.id}"]`);
        if (!campo) continue;
        if (!calculo) {
            campo.innerHTML = `<strong>R$ 0,00</strong><small>sem composição</small>`;
            continue;
        }
        campo.innerHTML = `
            <strong>${formatarMoeda(calculo.custo_total)}</strong>
            <small>${formatarMoeda(calculo.custo_por_unidade)} / ${escaparHtml(receita.unidade_rendimento || "L")}</small>
        `;
    }
}

function filtrarReceitas() {
    const termo = String(document.getElementById("buscaReceita")?.value || "").toLowerCase().trim();
    receitasFiltradas = receitas.filter(receita => String(receita.nome || "").toLowerCase().includes(termo));
    renderizarReceitas();
}

function criarModalReceitaForm() {
    let modal = document.getElementById("modalReceitaForm");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "modalReceitaForm";
    modal.className = "modal-receita-form-overlay";
    modal.innerHTML = `
        <div class="modal-receita-form">
            <button type="button" class="modal-form-fechar" id="fecharModalReceitaForm">×</button>

            <header class="modal-form-header">
                <div>
                    <span class="modal-form-kicker">CUSTEAMENTO / RECEITA</span>
                    <h2 id="tituloModalReceitaForm">Nova receita</h2>
                    <p>Monte a fórmula, documente o processo e acompanhe o custo de produção.</p>
                </div>
                <div class="modal-form-status" id="statusReceitaForm"><i></i> Rascunho</div>
            </header>

            <input type="hidden" id="receitaIdForm">

            <section class="form-form-grid">
                <label class="form-field form-field-wide">
                    <span>Nome da receita</span>
                    <input id="nomeReceitaForm" type="text" placeholder="Ex.: Cloro Gel">
                </label>
                <label class="form-field">
                    <span>Rendimento</span>
                    <div class="form-input-unit"><input id="rendimentoReceitaForm" type="number" min="0" step="0.001" placeholder="25"><b id="unidadeLabelForm">L</b></div>
                </label>
                <label class="form-field">
                    <span>Unidade</span>
                    <select id="unidadeRendimentoReceitaForm">
                        <option value="L">Litros (L)</option>
                        <option value="KG">Quilos (KG)</option>
                        <option value="UN">Unidades (UN)</option>
                    </select>
                </label>
                <label class="form-field form-field-full">
                    <span>Modo de preparo</span>
                    <textarea id="modoPreparoReceitaForm" rows="5" placeholder="Descreva o passo a passo de fabricação, ordem de adição, diluição, tempo de mistura e observações importantes..."></textarea>
                </label>
            </section>

            <div id="avisoReceitaForm" class="form-alert"></div>

            <section class="form-section">
                <div class="form-section-head">
                    <div>
                        <span class="modal-form-kicker">COMPOSIÇÃO</span>
                        <h3>Matérias-primas</h3>
                        <p>Embalagens ficam fora da receita base e serão calculadas no fracionamento.</p>
                    </div>
                    <div class="form-pill" id="contadorItensForm">0 itens</div>
                </div>

                <div class="form-add-row">
                    <select id="insumoReceitaForm"><option value="">Selecione uma matéria-prima...</option></select>
                    <input id="quantidadeInsumoReceitaForm" type="number" min="0" step="0.001" placeholder="Quantidade">
                    <button type="button" id="adicionarItemReceitaForm" class="form-btn-primary">+ Adicionar</button>
                </div>

                <div class="form-table">
                    <div class="form-table-head"><span>INSUMO</span><span>QUANTIDADE</span><span>PREÇO BASE</span><span>CUSTO DE COMPRA</span><span></span></div>
                    <div id="listaItensReceitaForm"></div>
                </div>

                <div class="form-totais">
                    <div><span>CUSTO TOTAL DO LOTE</span><strong id="custoTotalReceitaForm">R$ 0,00</strong></div>
                    <div class="form-total-destaque"><span>CUSTO POR ${"L"}</span><strong id="custoUnidadeReceitaForm">R$ 0,00</strong></div>
                </div>
            </section>

            <section class="form-section form-produto-final calc-produto-final">
                <div class="form-section-head">
                    <div>
                        <span class="modal-form-kicker">PRODUTO FINAL</span>
                        <h3>Produtos da base</h3>
                        <p>Escolha os produtos do catálogo que usam esta mesma base. O vínculo fica salvo na receita.</p>
                    </div>
                    <div class="form-coming">BASE • Base</div>
                </div>

                <div class="base-grupo-add atual-grupo-add">
                    <div>
                        <span>ADICIONAR POR GRUPO</span>
                        <input id="grupoProdutoBase" type="text" placeholder="Ex.: Limpa Pedra">
                    </div>
                    <button type="button" id="adicionarGrupoBase" class="form-btn-primary">Adicionar todos</button>
                </div>

                <div id="listaProdutosBase" class="base-produtos-base-list"></div>

                <div id="painelRentabilidadeForm" class="form-rentabilidade oculto"></div>
            </section>

            <footer class="modal-form-footer">
                <button type="button" id="excluirReceitaForm" class="form-btn-danger oculto">Excluir receita</button>
                <div class="form-footer-right">
                    <button type="button" id="cancelarReceitaForm" class="form-btn-secondary">Cancelar</button>
                    <button type="button" id="salvarReceitaForm" class="form-btn-primary">Salvar receita</button>
                </div>
            </footer>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector("#fecharModalReceitaForm").addEventListener("click", fecharModalReceita);
    modal.querySelector("#cancelarReceitaForm").addEventListener("click", fecharModalReceita);
    modal.querySelector("#salvarReceitaForm").addEventListener("click", salvarReceitaForm);
    modal.querySelector("#adicionarItemReceitaForm").addEventListener("click", adicionarItemReceitaForm);
    modal.querySelector("#excluirReceitaForm").addEventListener("click", excluirReceitaForm);
    modal.querySelector("#unidadeRendimentoReceitaForm").addEventListener("change", atualizarRotuloUnidadeForm);
    modal.querySelector("#rendimentoReceitaForm").addEventListener("input", atualizarCalculoVisualForm);
    modal.querySelector("#adicionarGrupoBase").addEventListener("click", adicionarGrupoDaBase);
    modal.querySelector("#grupoProdutoBase").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            adicionarGrupoDaBase();
        }
    });

    // ESC fecha o modal de receita rapidamente.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("aberto")) {
            fecharModalReceita();
        }
    });

    return modal;
}

async function abrirModalReceita(id = null) {
    const modal = criarModalReceitaForm();
    receitaEmEdicao = id ? Number(id) : null;
    produtoFinalSelecionado = null;
    composicaoReceita = [];
    itensOriginaisReceita = [];
    fracionamentosCalc = [];
    produtosDaBase = [];

    const titulo = modal.querySelector("#tituloModalReceitaForm");
    const idCampo = modal.querySelector("#receitaIdForm");
    const nome = modal.querySelector("#nomeReceitaForm");
    const rendimento = modal.querySelector("#rendimentoReceitaForm");
    const unidade = modal.querySelector("#unidadeRendimentoReceitaForm");
    const modo = modal.querySelector("#modoPreparoReceitaForm");
    const aviso = modal.querySelector("#avisoReceitaForm");
    const excluir = modal.querySelector("#excluirReceitaForm");

    aviso.textContent = "";
    aviso.className = "form-alert";
    modal.querySelector("#statusReceitaForm").innerHTML = '<i></i> Rascunho';

    if (id === null) {
        titulo.textContent = "Nova receita";
        idCampo.value = "";
        nome.value = "";
        rendimento.value = "";
        unidade.value = "L";
        modo.value = "";
        excluir.classList.add("oculto");
        modal.querySelector("#salvarReceitaForm").textContent = "Salvar receita";
    } else {
        const receita = receitas.find(item => Number(item.id) === Number(id));
        if (!receita) return alert("Receita não encontrada.");

        titulo.textContent = "Editar receita";
        idCampo.value = receita.id;
        nome.value = receita.nome || "";
        rendimento.value = receita.rendimento ?? "";
        unidade.value = receita.unidade_rendimento || "L";
        modo.value = receita.observacao || "";
        excluir.classList.remove("oculto");
        modal.querySelector("#salvarReceitaForm").textContent = "Salvar alterações";

        try {
            const resposta = await fetch(`http://127.0.0.1:3100/custeamento/receitas/${id}/itens`);
            const dados = await resposta.json();
            if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Erro ao carregar composição.");
            itensOriginaisReceita = Array.isArray(dados.itens) ? dados.itens : [];
            composicaoReceita = itensOriginaisReceita.map(item => ({
                id: item.id,
                insumo_id: item.insumo_id ?? item.id_insumo,
                nome: item.insumo_nome || item.nome || "Insumo",
                unidade: item.insumo_unidade || item.unidade || "",
                preco_atual: Number(item.preco_atual || item.preco || 0),
                quantidade: Number(item.quantidade || 0),
                custo_item: Number(item.custo_item || 0)
            }));
        } catch (erro) {
            aviso.className = "form-alert erro";
            aviso.textContent = "Não foi possível carregar a composição: " + erro.message;
        }
    }

    await carregarProdutosParaBase();
    if (id !== null) {
        await carregarProdutosDaBase(id);
    }
    atualizarRotuloUnidadeForm();
    await carregarInsumosParaReceitaForm();
    renderizarItensReceitaForm();
    renderizarProdutosDaBase();
    atualizarCalculoVisualForm();
    modal.classList.add("aberto");
    document.body.classList.add("modal-aberto-form");
}

function fecharModalReceita() {
    const modal = document.getElementById("modalReceitaForm");
    if (!modal) return;
    modal.classList.remove("aberto");
    document.body.classList.remove("modal-aberto-form");
}

async function carregarInsumosParaReceitaForm() {
    if (!insumos.length) await carregarInsumos();
    const select = document.getElementById("insumoReceitaForm");
    if (!select) return;

    const ativos = insumos
        .filter(i => Number(i.ativo) !== 0 && i.tipo !== "EMBALAGEM")
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }));

    select.innerHTML = '<option value="">Selecione uma matéria-prima...</option>';
    ativos.forEach(insumo => {
        const option = document.createElement("option");
        option.value = insumo.id;
        option.textContent = `${insumo.nome}  •  ${insumo.unidade}  •  ${formatarMoeda(insumo.preco_atual)}`;
        select.appendChild(option);
    });
}

function adicionarItemReceitaForm() {
    const select = document.getElementById("insumoReceitaForm");
    const quantidadeCampo = document.getElementById("quantidadeInsumoReceitaForm");
    const insumoId = Number(select.value);
    const quantidade = Number(quantidadeCampo.value);

    if (!insumoId) return mostrarAvisoReceitaForm("Selecione uma matéria-prima.", true);
    if (!quantidade || quantidade <= 0) return mostrarAvisoReceitaForm("Informe uma quantidade válida.", true);

    const insumo = insumos.find(i => Number(i.id) === insumoId);
    if (!insumo) return mostrarAvisoReceitaForm("Insumo não encontrado.", true);

    const existente = composicaoReceita.find(i => Number(i.insumo_id) === insumoId);
    if (existente) {
        existente.quantidade = Number(existente.quantidade) + quantidade;
    } else {
        composicaoReceita.push({
            id: null,
            insumo_id: insumo.id,
            nome: insumo.nome,
            unidade: insumo.unidade,
            preco_atual: Number(insumo.preco_atual || 0),
            quantidade
        });
    }

    select.value = "";
    quantidadeCampo.value = "";
    mostrarAvisoReceitaForm("Matéria-prima adicionada à composição.", false);
    renderizarItensReceitaForm();
    atualizarCalculoVisualForm();
}

function renderizarItensReceitaForm() {
    const lista = document.getElementById("listaItensReceitaForm");
    const contador = document.getElementById("contadorItensForm");
    if (!lista) return;

    contador.textContent = `${composicaoReceita.length} ${composicaoReceita.length === 1 ? "item" : "itens"}`;

    if (!composicaoReceita.length) {
        lista.innerHTML = `
            <div class="form-empty-composition">
                <div>⚗</div>
                <strong>Receita sem composição</strong>
                <span>Adicione as matérias-primas usadas na fabricação.</span>
            </div>`;
        return;
    }

    lista.innerHTML = composicaoReceita.map((item, index) => {
        const custo = Number(item.quantidade || 0) * Number(item.preco_atual || 0);
        return `
            <div class="form-table-row" data-index="${index}">
                <div class="form-insumo-name"><span class="form-mini-icon">•</span><div><strong>${escaparHtml(item.nome)}</strong><small>${escaparHtml(item.unidade || "")}</small></div></div>
                <div><input class="form-qtd" data-index="${index}" type="number" min="0" step="0.001" value="${Number(item.quantidade || 0).toFixed(3)}"></div>
                <div class="form-price">${formatarMoeda(item.preco_atual)}</div>
                <div class="form-cost">${formatarMoeda(custo)}</div>
                <div><button type="button" class="form-remove" data-index="${index}" title="Remover">×</button></div>
            </div>`;
    }).join("");

    lista.querySelectorAll(".form-qtd").forEach(input => {
        input.addEventListener("input", () => {
            const item = composicaoReceita[Number(input.dataset.index)];
            item.quantidade = Number(input.value || 0);
            atualizarCalculoVisualForm();
            const custo = Number(item.quantidade || 0) * Number(item.preco_atual || 0);
            input.closest(".form-table-row")?.querySelector(".form-cost")?.replaceChildren(document.createTextNode(formatarMoeda(custo)));
        });
    });

    lista.querySelectorAll(".form-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            composicaoReceita.splice(Number(btn.dataset.index), 1);
            renderizarItensReceitaForm();
            atualizarCalculoVisualForm();
        });
    });
}

function atualizarCalculoVisualForm() {
    const total = composicaoReceita.reduce((soma, item) => soma + Number(item.quantidade || 0) * Number(item.preco_atual || 0), 0);
    const rendimento = Number(document.getElementById("rendimentoReceitaForm")?.value || 0);
    const porUnidade = rendimento > 0 ? total / rendimento : 0;
    const unidade = document.getElementById("unidadeRendimentoReceitaForm")?.value || "L";

    const totalEl = document.getElementById("custoTotalReceitaForm");
    const unitEl = document.getElementById("custoUnidadeReceitaForm");
    if (totalEl) totalEl.textContent = formatarMoeda(total);
    if (unitEl) unitEl.textContent = formatarMoeda(porUnidade);

    const label = document.querySelector(".form-total-destaque span");
    if (label) label.textContent = `CUSTO POR ${unidade}`;
    atualizarRentabilidadeForm();
}

function atualizarRotuloUnidadeForm() {
    const unidade = document.getElementById("unidadeRendimentoReceitaForm")?.value || "L";
    const label = document.getElementById("unidadeLabelForm");
    if (label) label.textContent = unidade;
    atualizarCalculoVisualForm();
}

function mostrarAvisoReceitaForm(texto, erro = false) {
    const aviso = document.getElementById("avisoReceitaForm");
    if (!aviso) return;
    aviso.className = "form-alert" + (erro ? " erro" : " sucesso");
    aviso.textContent = texto;
    setTimeout(() => {
        if (aviso.textContent === texto) aviso.textContent = "";
        aviso.className = "form-alert";
    }, 2600);
}

async function salvarReceitaForm() {
    const id = Number(document.getElementById("receitaIdForm")?.value || 0);
    const nome = document.getElementById("nomeReceitaForm")?.value.trim();
    const rendimento = Number(document.getElementById("rendimentoReceitaForm")?.value || 0);
    const unidade = document.getElementById("unidadeRendimentoReceitaForm")?.value || "L";
    const modoPreparo = document.getElementById("modoPreparoReceitaForm")?.value.trim() || "";
    const botao = document.getElementById("salvarReceitaForm");

    if (!nome) return mostrarAvisoReceitaForm("Informe o nome da receita.", true);
    if (!rendimento || rendimento <= 0) return mostrarAvisoReceitaForm("Informe um rendimento válido.", true);

    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
        const url = id ? "http://127.0.0.1:3100/custeamento/receitas/editar" : "http://127.0.0.1:3100/custeamento/receitas";
        const corpo = { nome, rendimento, unidade_rendimento: unidade, observacao: modoPreparo };
        if (id) corpo.id = id;

        const resposta = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Não foi possível salvar a receita.");

        const receitaId = Number(dados.id || dados.receita_id || dados.receita?.id || id);
        if (!receitaId) throw new Error("A API não retornou o ID da receita.");

        // Itens removidos
        for (const antigo of itensOriginaisReceita) {
            const aindaExiste = composicaoReceita.some(item => Number(item.insumo_id) === Number(antigo.insumo_id));
            if (!aindaExiste && antigo.id) {
                await fetch("http://127.0.0.1:3100/custeamento/receitas/item/excluir", {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: Number(antigo.id) })
                });
            }
        }

        // Itens novos e alterações de quantidade
        for (const item of composicaoReceita) {
            const quantidade = Number(item.quantidade || 0);
            if (quantidade <= 0) continue;

            if (item.id) {
                const r = await fetch("http://127.0.0.1:3100/custeamento/receitas/item/editar", {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: Number(item.id), quantidade })
                });
                const d = await r.json();
                if (!r.ok || !d.ok) throw new Error(d.erro || "Erro ao atualizar item.");
            } else {
                const r = await fetch(`http://127.0.0.1:3100/custeamento/receitas/${receitaId}/itens`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ insumo_id: Number(item.insumo_id), quantidade })
                });
                const d = await r.json();
                if (!r.ok || !d.ok) throw new Error(d.erro || "Erro ao adicionar item.");
            }
        }

        // Persiste os produtos finais vinculados à base.
        const respostaProdutos = await fetch(`http://127.0.0.1:3100/custeamento/receitas/${receitaId}/produtos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                produtos: produtosDaBase.map(item => ({
                    produto_id: Number(item.produto_id),
                    volume: Number(item.volume || produtoVolumeForm(item.produto) || 0),
                    embalagem_id: item.embalagem ? Number(item.embalagem.id) : null,
                    acessorio_id: item.acessorio ? Number(item.acessorio.id) : null
                }))
            })
        });
        const dadosProdutos = await respostaProdutos.json();
        if (!respostaProdutos.ok || !dadosProdutos.ok) {
            throw new Error(dadosProdutos.erro || "Não foi possível salvar os produtos da base.");
        }

        // Salva e fecha imediatamente. A lista é atualizada em segundo plano.
        fecharModalReceita();
        carregarReceitas().catch(erro => console.error("Erro ao atualizar lista de receitas:", erro));
    } catch (erro) {
        console.error("Erro ao salvar receita:", erro);
        mostrarAvisoReceitaForm(erro.message, true);
    } finally {
        botao.disabled = false;
        botao.textContent = id ? "Salvar alterações" : "Salvar receita";
    }
}

async function excluirReceitaForm() {
    const id = Number(document.getElementById("receitaIdForm")?.value || 0);
    const nome = document.getElementById("nomeReceitaForm")?.value || "esta receita";
    if (!id) return;
    if (!confirm(`Excluir a receita "${nome}"?\n\nA receita e sua composição serão removidas.`)) return;

    const botao = document.getElementById("excluirReceitaForm");
    botao.disabled = true;
    try {
        const resposta = await fetch("http://127.0.0.1:3100/custeamento/receitas/excluir", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id })
        });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Não foi possível excluir a receita.");
        fecharModalReceita();
        await carregarReceitas();
        alert("Receita excluída com sucesso.");
    } catch (erro) {
        console.error(erro);
        alert("Erro ao excluir receita: " + erro.message);
    } finally {
        botao.disabled = false;
    }
}

function normalizarTextoCalc(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/°/g, "")
        .replace(/\b(ml|litro|litros|l|kg|quilo|quilos|un|unidade|unidades)\b/g, " ")
        .replace(/\d+(?:[.,]\d+)?\s*(?:ml|l|litro|litros)\b/gi, " ")
        .replace(/\b(fracionado|frasco|refil|galao|gal)\b/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function nomeBaseReceitaCalc() {
    return normalizarTextoCalc(document.getElementById("nomeReceitaForm")?.value || "");
}

function produtoNomeForm(produto) {
    return String(produto?.descricao ?? produto?.nome ?? produto?.produto ?? "").trim();
}

function produtoVendaForm(produto) {
    return Number(produto?.preco_venda ?? produto?.precoVenda ?? produto?.precoVendaSite ?? produto?.preco ?? 0);
}

function produtoCustoManual(produto) {
    const valor = produto?.custo_custeamento ?? produto?.custoCompra ?? produto?.custo_compra;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

async function salvarCustoManualProduto(produtoId, valor) {
    const id = String(produtoId);
    const custo = Number(valor);
    if (!Number.isFinite(custo) || custo < 0) {
        throw new Error("Informe um custo válido.");
    }

    const resposta = await fetch("http://127.0.0.1:3100/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            [id]: { custo_custeamento: Number(custo.toFixed(3)) }
        })
    });
    const dados = await resposta.json();
    if (!resposta.ok || dados.ok === false) {
        throw new Error(dados.erro || "Não foi possível salvar o custo.");
    }

    const produto = produtos.find(p => String(produtoIdNormalizado(p)) === id);
    if (produto) produto.custo_custeamento = custo;
    return custo;
}

async function alterarCustoProdutoFinal(produtoId, input) {
    const valorAnterior = produtoCustoManual(produtos.find(p => String(produtoIdNormalizado(p)) === String(produtoId)));
    try {
        input.disabled = true;
        const custo = await salvarCustoManualProduto(produtoId, input.value.replace(',', '.'));
        input.value = custo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        input.classList.remove("erro");
        input.classList.add("salvo");
        setTimeout(() => input.classList.remove("salvo"), 900);
        renderizarProdutosFinais();
    } catch (erro) {
        console.error(erro);
        input.classList.add("erro");
        if (valorAnterior !== null) input.value = valorAnterior.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        alert("Não foi possível salvar o custo: " + erro.message);
    } finally {
        input.disabled = false;
    }
}

function produtoVolumeForm(produto) {
    const nome = produtoNomeForm(produto).toLowerCase().replace(',', '.');
    const match = nome.match(/(\d+(?:\.\d+)?)\s*(ml|l|litro|litros)\b/);
    if (!match) return Number(produto?.volume || 0);
    const valor = Number(match[1]);
    return /ml/.test(match[2]) ? valor / 1000 : valor;
}

function volumeLabelCalc(volume) {
    return volume < 1 ? `${Math.round(volume * 1000)} ml` : `${numeroBR(volume, 2)} L`;
}

function volumeMatchInsumoCalc(insumo, volume) {
    const nome = String(insumo?.nome || "").toLowerCase().replace(',', '.');
    const match = nome.match(/(\d+(?:\.\d+)?)\s*(ml|l|litro|litros)\b/);
    if (!match) return false;
    const valor = Number(match[1]);
    const vol = /ml/.test(match[2]) ? valor / 1000 : valor;
    return Math.abs(vol - volume) < 0.001;
}

function custoBaseReceitaCalc() {
    const rendimento = Number(document.getElementById("rendimentoReceitaForm")?.value || 0);
    if (!rendimento) return 0;
    return composicaoReceita.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.preco_atual || 0), 0) / rendimento;
}

function candidatosEmbalagensCalc(volume) {
    return insumos
        .filter(i => i.tipo === "EMBALAGEM" && Number(i.ativo) !== 0 && volumeMatchInsumoCalc(i, volume))
        .sort((a, b) => Number(a.preco_atual || 0) - Number(b.preco_atual || 0));
}

function candidatosAcessoriosCalc() {
    return insumos
        .filter(i => i.tipo === "ACESSORIO" && Number(i.ativo) !== 0)
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
}

async function carregarProdutosParaBase() {
    const select = document.getElementById("produtoBase");
    if (!select) return;
    if (!produtos.length) await carregarProdutos();
    const lista = produtos
        .filter(p => String(p.ForaDeUso || "").toUpperCase() !== "SIM")
        .slice()
        .sort((a, b) => produtoNomeForm(a).localeCompare(produtoNomeForm(b), "pt-BR"));

    select.innerHTML = `<option value="">Selecione um produto do catálogo...</option>` +
        lista.map(p => `<option value="${escaparHtml(p.id)}">${escaparHtml(produtoNomeForm(p))}</option>`).join("");
}

async function carregarProdutosDaBase(receitaId) {
    try {
        const resposta = await fetch(`http://127.0.0.1:3100/custeamento/receitas/${receitaId}/produtos`);
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Erro ao carregar produtos da base.");

        produtosDaBase = (Array.isArray(dados.produtos) ? dados.produtos : [])
            .map(link => {
                const produto = produtos.find(p => String(p.id) === String(link.produto_id));
                if (!produto) return null;
                const volume = Number(link.volume || produtoVolumeForm(produto) || 0);
                const embalagens = candidatosEmbalagensCalc(volume);
                const acessorios = candidatosAcessoriosCalc();
                return {
                    produto_id: Number(link.produto_id),
                    produto,
                    volume,
                    embalagem: embalagens.find(e => String(e.id) === String(link.embalagem_id)) || embalagens[0] || null,
                    acessorio: acessorios.find(e => String(e.id) === String(link.acessorio_id)) || null
                };
            })
            .filter(Boolean);
    } catch (erro) {
        console.error("Erro ao carregar produtos da base:", erro);
        mostrarAvisoReceitaForm("Não foi possível carregar os produtos vinculados: " + erro.message, true);
    }
}

function adicionarProdutoDaBase() {
    const select = document.getElementById("produtoBase");
    if (!select?.value) return;
    const produto = produtos.find(p => String(p.id) === String(select.value));
    if (!produto) return;
    if (produtosDaBase.some(item => String(item.produto_id) === String(produto.id))) {
        select.value = "";
        return mostrarAvisoReceitaForm("Esse produto já está vinculado à base.", true);
    }

    const volume = produtoVolumeForm(produto);
    const embalagens = candidatosEmbalagensCalc(volume);
    produtosDaBase.push({
        produto_id: Number(produto.id),
        produto,
        volume,
        embalagem: embalagens[0] || null,
        acessorio: null
    });
    select.value = "";
    renderizarProdutosDaBase();
}

function normalizarGrupoProdutoBase(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function adicionarGrupoDaBase() {
    const campo = document.getElementById("grupoProdutoBase");
    const termo = normalizarGrupoProdutoBase(campo?.value);
    if (!termo) return mostrarAvisoReceitaForm("Digite o nome do grupo. Ex.: Limpa Pedra", true);

    const encontrados = produtos
        .filter(p => String(p.ForaDeUso || "").toUpperCase() !== "SIM")
        .filter(p => normalizarGrupoProdutoBase(produtoNomeForm(p)).startsWith(termo));

    if (!encontrados.length) {
        return mostrarAvisoReceitaForm(`Nenhum produto encontrado para "${campo.value.trim()}".`, true);
    }

    let adicionados = 0;
    encontrados.forEach(produto => {
        if (produtosDaBase.some(item => String(item.produto_id) === String(produto.id))) return;
        const volume = produtoVolumeForm(produto);
        const embalagens = candidatosEmbalagensCalc(volume);
        produtosDaBase.push({
            produto_id: Number(produto.id),
            produto,
            volume,
            embalagem: embalagens[0] || null,
            acessorio: null
        });
        adicionados++;
    });

    campo.value = "";
    renderizarProdutosDaBase();
    mostrarAvisoReceitaForm(
        adicionados === encontrados.length
            ? `${adicionados} produto(s) adicionado(s) à base.`
            : `${adicionados} produto(s) novo(s) adicionado(s).`,
        false
    );
}

function renderizarProdutosDaBase() {
    const container = document.getElementById("listaProdutosBase");
    if (!container) return;
    const custoL = custoBaseReceitaCalc();
    const acessorios = candidatosAcessoriosCalc();

    if (!produtosDaBase.length) {
        container.innerHTML = `<div class="base-empty">Nenhum produto vinculado ainda. Selecione acima os produtos que usam esta base.</div>`;
        return;
    }

    container.innerHTML = produtosDaBase.map((item, index) => {
        const produto = item.produto;
        const volume = Number(item.volume || produtoVolumeForm(produto) || 0);
        const embalagens = candidatosEmbalagensCalc(volume);
        const embalagem = item.embalagem && embalagens.some(e => String(e.id) === String(item.embalagem.id)) ? item.embalagem : (embalagens[0] || null);
        item.embalagem = embalagem;
        const acessorio = item.acessorio;
        const custoLiquido = custoL * volume;
        const custoEmbalagem = Number(embalagem?.preco_atual || 0);
        const custoAcessorio = Number(acessorio?.preco_atual || 0);
        const custoTotal = custoLiquido + custoEmbalagem + custoAcessorio;
        const venda = produtoVendaForm(produto);
        const lucro = venda - custoTotal;
        const margem = venda > 0 ? (lucro / venda) * 100 : 0;
        const embalagemOptions = embalagens.length
            ? embalagens.map(e => `<option value="${escaparHtml(e.id)}" ${embalagem && String(embalagem.id) === String(e.id) ? "selected" : ""}>${escaparHtml(e.nome)} • ${formatarMoeda(e.preco_atual)}</option>`).join("")
            : `<option value="">Nenhuma embalagem ${volumeLabelCalc(volume)} cadastrada</option>`;
        const acessorioOptions = `<option value="" ${!acessorio ? "selected" : ""}>Sem acessório</option>` +
            acessorios.map(e => `<option value="${escaparHtml(e.id)}" ${acessorio && String(acessorio.id) === String(e.id) ? "selected" : ""}>${escaparHtml(e.nome)} • ${formatarMoeda(e.preco_atual)}</option>`).join("");

        return `<article class="base-produto-card" data-index="${index}">
            <div class="base-produto-head">
                <div class="base-produto-title">
                    <span class="base-volume">${volumeLabelCalc(volume)}</span>
                    <div><strong>${escaparHtml(produtoNomeForm(produto))}</strong><small>Produto do catálogo</small></div>
                </div>
                <button type="button" class="base-remover" data-index="${index}" title="Remover produto">×</button>
            </div>
            <div class="base-produto-controls">
                <label><span>EMBALAGEM</span><select class="base-embalagem" data-index="${index}">${embalagemOptions}</select></label>
                <label><span>ACESSÓRIO</span><select class="base-acessorio" data-index="${index}">${acessorioOptions}</select></label>
            </div>
            <div class="base-produto-metrics">
                <div><span>LÍQUIDO</span><strong>${formatarMoeda(custoLiquido)}</strong></div>
                <div><span>EMBALAGEM</span><strong>${formatarMoeda(custoEmbalagem)}</strong></div>
                <div><span>CUSTO FINAL</span><strong>${formatarMoeda(custoTotal)}</strong></div>
                <div><span>VENDA</span><strong>${formatarMoeda(venda)}</strong></div>
                <div class="lucro"><span>LUCRO BRUTO</span><strong>${formatarMoeda(lucro)}</strong><small>${margem.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})}% margem</small></div>
            </div>
        </article>`;
    }).join("");

    container.querySelectorAll(".base-remover").forEach(btn => btn.addEventListener("click", () => {
        produtosDaBase.splice(Number(btn.dataset.index), 1);
        renderizarProdutosDaBase();
    }));
    container.querySelectorAll(".base-embalagem").forEach(select => select.addEventListener("change", () => {
        const item = produtosDaBase[Number(select.dataset.index)];
        item.embalagem = insumos.find(i => String(i.id) === String(select.value)) || null;
        renderizarProdutosDaBase();
    }));
    container.querySelectorAll(".base-acessorio").forEach(select => select.addEventListener("change", () => {
        const item = produtosDaBase[Number(select.dataset.index)];
        item.acessorio = select.value ? (insumos.find(i => String(i.id) === String(select.value)) || null) : null;
        renderizarProdutosDaBase();
    }));
}

function prepararFracionamentoCalc() {
    // Base: o vínculo real é Produtos da base. Mantemos a função para compatibilidade.
    renderizarProdutosDaBase();
}

let fracionamentosCalc = [];

function atualizarRentabilidadeForm() {
    const painel = document.getElementById("painelRentabilidadeForm");
    if (!painel || !fracionamentosCalc.length) return;

    const itens = fracionamentosCalc.filter(item => item.produto);
    if (!itens.length) {
        painel.classList.add("oculto");
        painel.innerHTML = "";
        return;
    }

    painel.innerHTML = `
        <div class="form-rentabilidade-head">
            <div>
                <span>RENTABILIDADE</span>
                <strong>Lucro por tamanho</strong>
            </div>
            <small>Já considera líquido + embalagem + acessório</small>
        </div>
        <div class="form-rentabilidade-grid">
            ${itens.map(item => {
                const custo = custoBaseReceitaCalc() * item.volume
                    + Number(item.embalagem?.preco_atual || 0)
                    + Number(item.acessorio?.preco_atual || 0);
                const venda = produtoVendaForm(item.produto);
                const lucro = venda - custo;
                const margem = venda > 0 ? (lucro / venda) * 100 : 0;
                const margemClass = margem >= 50 ? "boa" : margem >= 30 ? "atencao" : "baixa";
                return `
                    <div class="form-rent-card">
                        <div class="form-rent-card-top">
                            <b>${volumeLabelCalc(item.volume)}</b>
                            <span>${escaparHtml(produtoNomeForm(item.produto))}</span>
                        </div>
                        <div class="form-rent-card-row"><span>Venda</span><strong>${formatarMoeda(venda)}</strong></div>
                        <div class="form-rent-card-row"><span>Custo</span><strong>${formatarMoeda(custo)}</strong></div>
                        <div class="form-rent-card-profit"><span>LUCRO BRUTO</span><strong>${formatarMoeda(lucro)}</strong><b class="${margemClass}">${margem.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</b></div>
                    </div>`;
            }).join("")}
        </div>`;
    painel.classList.remove("oculto");
}

/* =========================================================
   FILTROS
   ========================================================= */

function filtrarInsumos() {

    const busca = (
        document.getElementById("buscaInsumo")?.value || ""
    ).toLowerCase().trim();

    const tipo = (
        document.getElementById("filtroTipoInsumo")?.value || "todos"
    );

    const status = (
        document.getElementById("filtroStatusInsumo")?.value || "todos"
    );

    insumosFiltrados = insumos.filter(insumo => {

        const nome = String(insumo.nome || "").toLowerCase();

        const bateBusca =
            !busca ||
            nome.includes(busca);

        const bateTipo =
            tipo === "todos" ||
            insumo.tipo === tipo;

        const ativo = Number(insumo.ativo) !== 0;

        const bateStatus =
            status === "todos" ||
            (status === "ativos" && ativo) ||
            (status === "inativos" && !ativo);

        return bateBusca && bateTipo && bateStatus;
    });

    renderizarInsumos();
}


/* =========================================================
   MODAL
   ========================================================= */

function abrirModalInsumo(id = null) {

    const modal = document.getElementById("modalInsumo");

    if (!modal) return;

    const titulo = document.getElementById("tituloModalInsumo");

    const campoId = document.getElementById("insumoId");
    const campoNome = document.getElementById("nomeInsumo");
    const campoTipo = document.getElementById("tipoInsumo");
    const campoUnidade = document.getElementById("unidadeInsumo");
    const campoPreco = document.getElementById("precoInsumo");
    const campoAtivo = document.getElementById("ativoInsumo");
    const campoFornecedor = document.getElementById("fornecedorInsumo");
    const botaoExcluir = document.getElementById("excluirInsumo");
    const aviso = document.getElementById("avisoInsumo");

    aviso.textContent = "";

    if (id === null) {

        titulo.textContent = "Novo insumo";

        campoId.value = "";
        campoNome.value = "";
        campoTipo.value = "MATERIA_PRIMA";
        campoUnidade.value = "KG";
        campoPreco.value = "";
        if (campoAtivo) campoAtivo.value = "1";
        if (campoFornecedor) campoFornecedor.value = "";
        if (botaoExcluir) botaoExcluir.style.display = "none";

    } else {

        const insumo = insumos.find(item => Number(item.id) === id);

        if (!insumo) return;

        titulo.textContent = "Editar insumo";

        campoId.value = insumo.id;
        campoNome.value = insumo.nome || "";
        campoTipo.value = insumo.tipo || "MATERIA_PRIMA";
        campoUnidade.value = insumo.unidade || "UN";
        campoPreco.value = insumo.preco_atual ?? "";
        if (campoAtivo) campoAtivo.value = Number(insumo.ativo) !== 0 ? "1" : "0";
        if (campoFornecedor) campoFornecedor.value = insumo.fornecedor_id ? String(insumo.fornecedor_id) : "";
        if (botaoExcluir) botaoExcluir.style.display = "inline-flex";
    }

    modal.classList.remove("oculto");
}

function fecharModalInsumo() {

    const modal = document.getElementById("modalInsumo");

    if (modal) {
        modal.classList.add("oculto");
    }
}


/* =========================================================
   SALVAR INSUMO
   ========================================================= */

async function salvarInsumo() {

    const id = document.getElementById("insumoId").value;
    const nome = document.getElementById("nomeInsumo").value.trim();
    const tipo = document.getElementById("tipoInsumo").value;
    const unidade = document.getElementById("unidadeInsumo").value;
    const preco = document.getElementById("precoInsumo").value;
    const ativo = document.getElementById("ativoInsumo")?.value === "1";
    const fornecedorId = document.getElementById("fornecedorInsumo")?.value || null;

    const aviso = document.getElementById("avisoInsumo");
    const botao = document.getElementById("salvarInsumo");

    if (!nome) {

        aviso.textContent = "Informe o nome do insumo.";
        return;
    }

    if (preco === "" || Number(preco) < 0) {

        aviso.textContent = "Informe um preço válido.";
        return;
    }

    botao.disabled = true;
    aviso.textContent = "Salvando...";

    try {

        const url = id
            ? "http://127.0.0.1:3100/custeamento/insumos/editar"
            : "http://127.0.0.1:3100/custeamento/insumos";

        const resposta = await fetch(url, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                id: id ? Number(id) : null,
                nome,
                tipo,
                unidade,
                preco_atual: Number(preco),
                ativo
            })

        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(
                dados.erro || "Não foi possível salvar o insumo."
            );
        }

        const insumoSalvoId = id ? Number(id) : Number(dados.id);
        if (insumoSalvoId) {
            const respostaFornecedor = await fetch("http://127.0.0.1:3100/custeamento/insumos/fornecedor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ insumo_id: insumoSalvoId, fornecedor_id: fornecedorId })
            });
            const dadosFornecedor = await respostaFornecedor.json();
            if (!respostaFornecedor.ok || !dadosFornecedor.ok) {
                throw new Error(dadosFornecedor.erro || "Não foi possível salvar o fornecedor do insumo.");
            }
        }

        aviso.textContent = "Salvo com sucesso.";

        await carregarInsumos();

        setTimeout(() => {
            fecharModalInsumo();
        }, 400);

    } catch (erro) {

        console.error(erro);

        aviso.textContent = erro.message;

    } finally {

        botao.disabled = false;
    }
}


/* =========================================================
   EXCLUIR INSUMO
   ========================================================= */

async function excluirInsumo() {

    const id = Number(document.getElementById("insumoId")?.value || 0);
    const insumo = insumos.find(item => Number(item.id) === id);

    if (!id || !insumo) {
        alert("Insumo inválido.");
        return;
    }

    const confirmar = confirm(
        `Excluir o insumo "${insumo.nome}"?\\n\\n` +
        "Se ele já estiver sendo usado em uma receita, a exclusão será bloqueada e você poderá deixá-lo Inativo."
    );

    if (!confirmar) return;

    const botao = document.getElementById("excluirInsumo");
    const aviso = document.getElementById("avisoInsumo");

    botao.disabled = true;
    aviso.textContent = "Excluindo...";

    try {
        const resposta = await fetch(
            "http://127.0.0.1:3100/custeamento/insumos/excluir",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ id })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(dados.erro || "Não foi possível excluir o insumo.");
        }

        fecharModalInsumo();
        await carregarInsumos();

    } catch (erro) {
        console.error(erro);
        aviso.textContent = erro.message;
        alert(erro.message);
    } finally {
        botao.disabled = false;
    }
}


/* =========================================================
   EVENTOS
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const menuProdutos = document.getElementById("menuProdutos");
    const menuCusteamento = document.getElementById("menuCusteamento");

    const secaoProdutos = document.querySelector(
        "main > .resumo"
    );

    const filtrosProdutos = document.querySelector(
        "main > .filtros"
    );

    const listaProdutos = document.getElementById(
        "listaProdutos"
    );

    const secaoCusteamento = document.getElementById(
        "secaoCusteamento"
    );

    const painelInsumos = document.getElementById(
        "painelInsumos"
    );

    const painelReceitas = document.getElementById(
        "painelReceitas"
    );

    const subMenuInsumos = document.getElementById(
        "subMenuInsumos"
    );

    const subMenuReceitas = document.getElementById(
        "subMenuReceitas"
    );

    const subMenuFornecedores = document.getElementById("subMenuFornecedores");
    const painelFornecedores = document.getElementById("painelFornecedores");

    const painelProdutosFinais = document.getElementById("painelProdutosFinais");
    const subMenuProdutosFinais = document.getElementById("subMenuProdutosFinais");

    function mostrarProdutos() {

        menuProdutos?.classList.add("ativo");
        menuCusteamento?.classList.remove("ativo");

        secaoProdutos?.classList.remove("oculto");
        filtrosProdutos?.classList.remove("oculto");
        listaProdutos?.classList.remove("oculto");

        secaoCusteamento?.classList.add("oculto");
    }

    function mostrarPainelInsumos() {

        painelInsumos?.classList.remove("oculto");
        painelReceitas?.classList.add("oculto");
        painelFornecedores?.classList.add("oculto");
        painelProdutosFinais?.classList.add("oculto");

        subMenuInsumos?.classList.add("ativo");
        subMenuReceitas?.classList.remove("ativo");
        subMenuFornecedores?.classList.remove("ativo");
        subMenuProdutosFinais?.classList.remove("ativo");

        carregarInsumos();
    }

    async function mostrarPainelReceitas() {

        painelInsumos?.classList.add("oculto");
        painelReceitas?.classList.remove("oculto");
        painelFornecedores?.classList.add("oculto");
        painelProdutosFinais?.classList.add("oculto");

        subMenuInsumos?.classList.remove("ativo");
        subMenuReceitas?.classList.add("ativo");
        subMenuFornecedores?.classList.remove("ativo");
        subMenuProdutosFinais?.classList.remove("ativo");

        if (!insumos.length) await carregarInsumos();
        await carregarReceitas();
    }

    async function mostrarPainelFornecedores() {
        painelInsumos?.classList.add("oculto");
        painelReceitas?.classList.add("oculto");
        painelFornecedores?.classList.remove("oculto");
        painelProdutosFinais?.classList.add("oculto");

        subMenuInsumos?.classList.remove("ativo");
        subMenuReceitas?.classList.remove("ativo");
        subMenuFornecedores?.classList.add("ativo");
        subMenuProdutosFinais?.classList.remove("ativo");

        if (!insumos.length) await carregarInsumos();
        await carregarFornecedores();
    }

    async function mostrarPainelProdutosFinais() {
        painelInsumos?.classList.add("oculto");
        painelReceitas?.classList.add("oculto");
        painelFornecedores?.classList.add("oculto");
        painelProdutosFinais?.classList.remove("oculto");

        subMenuInsumos?.classList.remove("ativo");
        subMenuReceitas?.classList.remove("ativo");
        subMenuFornecedores?.classList.remove("ativo");
        subMenuProdutosFinais?.classList.add("ativo");

        await carregarProdutosFinais();
    }

    function mostrarCusteamento() {

        menuCusteamento?.classList.add("ativo");
        menuProdutos?.classList.remove("ativo");

        secaoProdutos?.classList.add("oculto");
        filtrosProdutos?.classList.add("oculto");
        listaProdutos?.classList.add("oculto");

        secaoCusteamento?.classList.remove("oculto");

        // Sempre entra no Custeamento começando por Insumos.
        mostrarPainelInsumos();
    }

    menuProdutos?.addEventListener(
        "click",
        mostrarProdutos
    );

    menuCusteamento?.addEventListener(
        "click",
        mostrarCusteamento
    );

    subMenuInsumos?.addEventListener(
        "click",
        mostrarPainelInsumos
    );

    subMenuReceitas?.addEventListener(
        "click",
        mostrarPainelReceitas
    );

    subMenuFornecedores?.addEventListener("click", mostrarPainelFornecedores);

    subMenuProdutosFinais?.addEventListener(
        "click",
        mostrarPainelProdutosFinais
    );

    document.getElementById("buscaProdutoFinal")?.addEventListener("input", filtrarProdutosFinais);
    document.getElementById("filtroCategoriaProdutoFinal")?.addEventListener("change", filtrarProdutosFinais);
    document.getElementById("filtroStatusProdutoFinal")?.addEventListener("change", filtrarProdutosFinais);
    document.getElementById("salvarCustosProdutosFinais")?.addEventListener("click", salvarCustosPendentesProdutosFinais);

    document.getElementById("buscaFornecedor")?.addEventListener("input", renderizarFornecedores);
    document.getElementById("novoFornecedor")?.addEventListener("click", () => abrirModalFornecedor());
    document.getElementById("fecharModalFornecedor")?.addEventListener("click", fecharModalFornecedor);
    document.getElementById("cancelarFornecedor")?.addEventListener("click", fecharModalFornecedor);
    document.getElementById("salvarFornecedor")?.addEventListener("click", salvarFornecedor);
    document.getElementById("excluirFornecedor")?.addEventListener("click", excluirFornecedor);

    document.getElementById("buscaInsumo")
        ?.addEventListener(
            "input",
            filtrarInsumos
        );

    document.getElementById("filtroTipoInsumo")
        ?.addEventListener(
            "change",
            filtrarInsumos
        );

    document.getElementById("filtroStatusInsumo")
        ?.addEventListener(
            "change",
            filtrarInsumos
        );

    document.getElementById("buscaReceita")
        ?.addEventListener(
            "input",
            filtrarReceitas
        );

    document.getElementById("novoInsumo")
        ?.addEventListener(
            "click",
            () => abrirModalInsumo()
        );

    document.getElementById("fecharModalInsumo")
        ?.addEventListener(
            "click",
            fecharModalInsumo
        );

    document.getElementById("cancelarInsumo")
        ?.addEventListener(
            "click",
            fecharModalInsumo
        );

    document.getElementById("salvarInsumo")
        ?.addEventListener(
            "click",
            salvarInsumo
        );

    document.getElementById("excluirInsumo")
        ?.addEventListener(
            "click",
            excluirInsumo
        );

    document.getElementById("novaReceita")
        ?.addEventListener("click", () => abrirModalReceita());

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        document.getElementById("modalFornecedor")?.classList.add("oculto");
    });

});