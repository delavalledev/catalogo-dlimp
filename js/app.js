const container = document.getElementById("produtos");
const campoBusca = document.getElementById("busca");
const botaoLimparBusca = document.getElementById("limparBusca");
const contadorResultados = document.getElementById("contadorResultados");
const modalCarrinho = document.getElementById("modalCarrinho");
const botaoAbrirCarrinho = document.getElementById("abrirCarrinho");
const botaoFecharCarrinho = document.getElementById("fecharCarrinho");

const CHAVE_FAVORITOS = "dlimp_favoritos";
const API_URL = "http://127.0.0.1:3000/produtos";
const CATALOGO_ONLINE_URL = "data/produtos-online.json";
const AJUSTES_URL = "data/ajustes-produtos.json";
let categoriaAtual = "todos";
let favoritos = carregarFavoritos();

function carregarFavoritos() {
    try {
        const salvo = localStorage.getItem(CHAVE_FAVORITOS);
        const lista = salvo ? JSON.parse(salvo) : [];
        return Array.isArray(lista) ? lista.map(Number).filter(Number.isFinite) : [];
    } catch (erro) {
        console.error("Erro ao carregar favoritos:", erro);
        return [];
    }
}

function salvarFavoritos() {
    try {
        localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(favoritos));
    } catch (erro) {
        console.error("Erro ao salvar favoritos:", erro);
    }
}

function produtoEhFavorito(id) {
    return favoritos.includes(Number(id));
}

function alternarFavorito(id) {
    const produtoId = Number(id);
    if (produtoEhFavorito(produtoId)) {
        favoritos = favoritos.filter(itemId => itemId !== produtoId);
        mostrarToast("Produto removido dos favoritos");
    } else {
        favoritos.push(produtoId);
        mostrarToast("Produto salvo nos favoritos");
    }
    salvarFavoritos();
    aplicarFiltros();
}

function formatarDinheiro(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function escaparHTML(texto) {
    return String(texto ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function montarSelos(produto) {
    const selos = [];
    if (produto.promocao === true) selos.push('<span class="selo selo-promocao">Promoção</span>');
    if (produto.novo === true) selos.push('<span class="selo selo-novo">Novo</span>');
    if (produto.maisVendido === true) selos.push('<span class="selo selo-mais-vendido">Mais vendido</span>');
    return selos.join("");
}

function calcularDesconto(produto) {
    const atual = Number(produto.preco);
    const antigo = Number(produto.precoAntigo);
    if (!Number.isFinite(atual) || !Number.isFinite(antigo) || antigo <= atual) return "";
    const porcentagem = Math.round(((antigo - atual) / antigo) * 100);
    return `<span class="desconto-produto">-${porcentagem}%</span>`;
}

function carregarProdutos(listaProdutos) {
    if (!container) return;
    const quantidade = Array.isArray(listaProdutos) ? listaProdutos.length : 0;

    if (contadorResultados) {
        contadorResultados.textContent = quantidade === 1 ? "1 produto" : `${quantidade} produtos`;
    }

    if (!Array.isArray(listaProdutos) || listaProdutos.length === 0) {
        const favoritosVazios = categoriaAtual === "favoritos";
        container.innerHTML = `
            <div class="mensagem-vazia">
                <span class="mensagem-vazia-icone">${favoritosVazios ? "🤍" : "🔎"}</span>
                <strong>${favoritosVazios ? "Nenhum favorito ainda" : "Nenhum produto encontrado"}</strong>
                <p>${favoritosVazios ? "Toque no coração de um produto para salvá-lo." : "Tente buscar por outro nome ou escolha outra categoria."}</p>
            </div>`;
        return;
    }

    container.innerHTML = listaProdutos.map(produto => {
        const id = Number(produto.id);
        const nome = escaparHTML(produto.nome);
        const imagem = escaparHTML(produto.imagem || "img/default.png");
        const favorito = produtoEhFavorito(id);
        const precoAntigoValido = Number(produto.precoAntigo) > Number(produto.preco);
        const disponivel = produto.disponivel !== false;

        return `
            <article class="produto" data-produto-id="${id}">
                <div class="produto-imagem-area area-imagem-clicavel" role="button" tabindex="0" aria-label="Ver detalhes de ${nome}">
                    <div class="selos-produto">${montarSelos(produto)}</div>
                    ${calcularDesconto(produto)}
                    <button type="button" class="btn-favorito ${favorito ? "ativo" : ""}" data-favorito-id="${id}" aria-label="${favorito ? "Remover" : "Adicionar"} ${nome} dos favoritos" aria-pressed="${favorito}"><svg
                            class="icone-coracao"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path
                                d="M12 21s-7.2-4.35-9.57-8.46C.42 9.05 2.02 4.5 6.2 3.65 8.5 3.18 10.35 4.3 12 6.15c1.65-1.85 3.5-2.97 5.8-2.5 4.18.85 5.78 5.4 3.77 8.89C19.2 16.65 12 21 12 21Z"
                            ></path>
                        </svg></button>
                    <img src="${imagem}" alt="${nome}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='img/default.png';">
                </div>
                <div class="produto-info">
                    <h2 class="nome-produto-clicavel">${nome}</h2>
                    <div class="area-preco">
                        ${precoAntigoValido ? `<span class="preco-antigo">${formatarDinheiro(produto.precoAntigo)}</span>` : ""}
                        <p class="preco">${formatarDinheiro(produto.preco)}</p>
                    </div>
                    <button
    type="button"
    class="btnAdicionar"
    data-adicionar-id="${id}"
    aria-label="${disponivel ? `Adicionar ${nome} ao carrinho` : `${nome} indisponível`}"
    ${disponivel ? "" : "disabled"}
>
    ${disponivel ? "<span>＋</span> Adicionar" : "Indisponível"}
</button>
                </div>
            </article>`;
    }).join("");
}

function filtrarPorCategoria(categoria, botaoClicado = null) {
    categoriaAtual = categoria || "todos";
    document.querySelectorAll(".btn-cat").forEach(botao => {
        botao.classList.remove("ativo");
        botao.setAttribute("aria-pressed", "false");
    });
    if (botaoClicado) {
        botaoClicado.classList.add("ativo");
        botaoClicado.setAttribute("aria-pressed", "true");
        botaoClicado.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
    aplicarFiltros();
}

function aplicarFiltros() {
    if (typeof produtos === "undefined" || !Array.isArray(produtos)) {
        carregarProdutos([]);
        return;
    }

    const termo = campoBusca ? campoBusca.value.trim().toLocaleLowerCase("pt-BR") : "";
    let resultado = [...produtos];

    if (categoriaAtual === "favoritos") {
        resultado = resultado.filter(produto => produtoEhFavorito(produto.id));
    } else if (categoriaAtual === "promocoes") {
        resultado = resultado.filter(produto => produto.promocao === true);
    } else if (categoriaAtual === "novos") {
        resultado = resultado.filter(produto => produto.novo === true);
} else if (categoriaAtual !== "todos") {
    resultado = resultado.filter(produto => {
        const categorias = Array.isArray(produto.categorias)
            ? produto.categorias
            : (produto.categoria ? [produto.categoria] : []);

        return categorias.some(categoria =>
            String(categoria).toLocaleLowerCase("pt-BR") ===
            categoriaAtual.toLocaleLowerCase("pt-BR")
        );
    });
}

    if (termo) {
        resultado = resultado.filter(produto => {
            const nome = String(produto.nome || "").toLocaleLowerCase("pt-BR");
            const categoria = String(produto.categoria || "").toLocaleLowerCase("pt-BR");
            const descricao = String(produto.descricao || "").toLocaleLowerCase("pt-BR");
            return nome.includes(termo) || categoria.includes(termo) || descricao.includes(termo);
        });
    }

    carregarProdutos(resultado);
}

function atualizarBotaoLimparBusca() {
    if (!botaoLimparBusca || !campoBusca) return;
    botaoLimparBusca.hidden = campoBusca.value.trim().length === 0;
}

function debounce(funcao, atraso = 180) {
    let temporizador;
    return (...argumentos) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => funcao(...argumentos), atraso);
    };
}

function abrirModalCarrinho() {
    if (!modalCarrinho) return;
    modalCarrinho.classList.remove("hidden");
    document.body.classList.add("modal-aberto");
    if (typeof voltarParaCarrinho === "function") voltarParaCarrinho();
    const conteudoModal = modalCarrinho.querySelector(".modal-content");
    if (conteudoModal) conteudoModal.scrollTop = 0;
}

function fecharModalCarrinho() {
    if (!modalCarrinho) return;
    modalCarrinho.classList.add("hidden");
    document.body.classList.remove("modal-aberto");
}


function obterCategoriasProduto(produto) {
    if (Array.isArray(produto?.categorias)) return produto.categorias;
    return produto?.categoria ? [produto.categoria] : [];
}

function formatarNomeCategoria(categoria) {
    const nomes = {
        residencial: "🏠 Residencial",
        industrial: "🏭 Industrial",
        automotivo: "🚗 Automotivo",
        utilitarios: "🧹 Utilitários"
    };
    return nomes[String(categoria || "").toLowerCase()] || String(categoria || "");
}

function valorInformacaoProduto(produto, chaves) {
    for (const chave of chaves) {
        if (produto && produto[chave] != null && String(produto[chave]).trim() !== "") {
            return String(produto[chave]);
        }
    }
    return "";
}

function criarModalProduto() {
    let modal = document.getElementById("modalProdutoDetalhes");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "modalProdutoDetalhes";
    modal.className = "modal-produto hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "tituloProdutoDetalhes");
    modal.innerHTML = `
        <div class="modal-produto-conteudo">
            <button type="button" class="modal-produto-fechar" id="fecharModalProduto" aria-label="Fechar detalhes">✕</button>
            <div id="conteudoModalProduto"></div>
        </div>
    `;
    document.body.appendChild(modal);

    const botaoFechar = modal.querySelector("#fecharModalProduto");

    // Fechamento direto: funciona também no toque do celular.
    botaoFechar?.addEventListener("click", evento => {
        evento.preventDefault();
        evento.stopPropagation();
        fecharModalProduto();
    });

    // Clique/toque fora do conteúdo também fecha.
    modal.addEventListener("click", evento => {
        if (evento.target === modal) {
            fecharModalProduto();
        }
    });

    return modal;
}

function abrirModalProduto(produto) {
    if (!produto) return;

    const modal = criarModalProduto();
    const conteudo = modal.querySelector("#conteudoModalProduto");
    if (!conteudo) return;

    const id = Number(produto.id);
    const nome = escaparHTML(produto.nome || produto.descricao || "Produto");
    const imagem = escaparHTML(produto.imagem || "img/default.png");
    const categorias = obterCategoriasProduto(produto);
    let descricao = valorInformacaoProduto(produto, ["descricaoDetalhada", "descricao", "descricaoProduto"]);
    if (descricao.trim().toLocaleLowerCase("pt-BR") === String(produto.nome || produto.descricao || "").trim().toLocaleLowerCase("pt-BR")) {
        descricao = "";
    }
    const paraQueServe = valorInformacaoProduto(produto, ["paraQueServe", "finalidade", "utilidade"]);
    const modoUso = valorInformacaoProduto(produto, ["modoUso", "modoDeUso", "modo_uso"]);
    const advertencias = valorInformacaoProduto(produto, ["advertencias", "advertencia", "atencao"]);
    const ceatox = valorInformacaoProduto(produto, ["ceatox", "ciatox"]);
    const disponivel = produto.disponivel !== false;

    const blocoInformacao = (titulo, texto, classe = "") => {
        if (!texto) return "";
        return `
            <section class="produto-detalhe-bloco ${classe}">
                <h3>${titulo}</h3>
                <p>${escaparHTML(texto).replaceAll("\n", "<br>")}</p>
            </section>
        `;
    };

    conteudo.innerHTML = `
        <div class="produto-detalhe-capa">
            <div class="produto-detalhe-imagem-wrap">
                <img class="produto-detalhe-imagem" src="${imagem}" alt="${nome}" onerror="this.onerror=null; this.src='img/default.png';">
            </div>
            <div class="produto-detalhe-resumo">
                <div class="produto-detalhe-selos">
                    ${montarSelos(produto)}
                    <span class="produto-status ${disponivel ? "disponivel" : "indisponivel"}">${disponivel ? "Disponível" : "Indisponível"}</span>
                </div>
                <h2 id="tituloProdutoDetalhes">${nome}</h2>
                <div class="produto-detalhe-preco">${formatarDinheiro(produto.preco)}</div>
                ${categorias.length ? `<div class="produto-detalhe-categorias">${categorias.map(c => `<span>${escaparHTML(formatarNomeCategoria(c))}</span>`).join("")}</div>` : ""}
                <button type="button" class="produto-detalhe-adicionar" data-detalhe-adicionar-id="${id}" ${disponivel ? "" : "disabled"}>
                    ${disponivel ? "＋ Adicionar ao carrinho" : "Indisponível"}
                </button>
            </div>
        </div>

        <div class="produto-detalhe-informacoes">
            ${blocoInformacao("Descrição", descricao)}
            ${blocoInformacao("Para que serve", paraQueServe)}
            ${blocoInformacao("Modo de uso", modoUso)}
            ${blocoInformacao("⚠️ Atenção", advertencias, "produto-detalhe-alerta")}
            ${ceatox ? `<section class="produto-detalhe-ceatox"><strong>☎️ Em caso de intoxicação</strong><p>${escaparHTML(ceatox)}</p></section>` : ""}
            ${!descricao && !paraQueServe && !modoUso && !advertencias ? `
                <div class="produto-detalhe-sem-info">
                    <strong>Informações do produto</strong>
                    <p>Os detalhes de uso e aplicação ainda não foram cadastrados para este produto.</p>
                </div>
            ` : ""}
        </div>
    `;

    modal.classList.remove("hidden");
    document.body.classList.add("modal-aberto");
    modal.querySelector(".modal-produto-conteudo")?.scrollTo({ top: 0 });
}

function fecharModalProduto() {
    const modal = document.getElementById("modalProdutoDetalhes");
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.classList.remove("modal-aberto");
}

function mostrarToast(mensagem) {
    let toast = document.getElementById("toastDlimp");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toastDlimp";
        toast.className = "toast-dlimp";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
    }
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    clearTimeout(window.timerToastDlimp);
    window.timerToastDlimp = setTimeout(() => toast.classList.remove("visivel"), 1800);
}

document.addEventListener("DOMContentLoaded", async () => {

    // =========================================================
    // CARREGA O CATÁLOGO PUBLICADO
    // O 5500 deve usar o JSON, não o estoque direto do Sys-On.
    // =========================================================

    try {

        const respostaOnline = await fetch(
            CATALOGO_ONLINE_URL + "?v=" + Date.now()
        );

        if (respostaOnline.ok) {

            const dadosOnline = await respostaOnline.json();

            if (Array.isArray(dadosOnline)) {

                produtos.length = 0;

                dadosOnline.forEach(produto => {

                    produtos.push({
                        // Preserva todas as informações cadastradas no catálogo
                        ...produto,
                        id: produto.id,
                        nome: produto.descricao,
                        descricao: produto.descricao,
                        preco: produto.preco,
                        imagem: produto.imagem,
                        categorias: Array.isArray(produto.categorias)
                            ? produto.categorias
                            : [],

                        categoria:
                            Array.isArray(produto.categorias) && produto.categorias.length
                                ? produto.categorias[0]
                                : "",

                        estoque: produto.estoque,

                        // Usa exatamente o valor enviado pelo sincronizador
                        disponivel: produto.disponivel
                    });

                });

            }

        }

    } catch (erroOnline) {

        console.error(
            "Não foi possível carregar o catálogo publicado:",
            erroOnline
        );

    }


    // =========================================================
    // CARREGA OS AJUSTES DO ADMIN
    // =========================================================

    try {

        const respostaAjustes = await fetch(
            AJUSTES_URL + "?v=" + Date.now()
        );

        if (respostaAjustes.ok) {

            const ajustes = await respostaAjustes.json();

            const produtosAjustados = produtos
                .map(produto => {

                    const ajuste = ajustes[String(produto.id)];

                    // Produto sem ajuste
                    if (!ajuste) {

                        return {
                            ...produto,
                            exibirSite: true
                        };

                    }

                    // Produto com ajuste
                    return {

                        ...produto,

                        nome:
                            ajuste.descricao ??
                            produto.nome,

                        descricao:
                            ajuste.descricao ??
                            produto.descricao,

                        preco:
                            ajuste.preco ??
                            produto.preco,

                        disponivel:
                            ajuste.disponivel ??
                            produto.disponivel,

                        imagem:
                            ajuste.imagem ??
                            produto.imagem,

                        categorias:
                            Array.isArray(ajuste.categorias)
                                ? ajuste.categorias
                                : (
                                    produto.categorias ||
                                    (
                                        produto.categoria
                                            ? [produto.categoria]
                                            : []
                                    )
                                ),

                        categoria:
                            ajuste.categoria &&
                            ajuste.categoria !== ""
                                ? ajuste.categoria
                                : produto.categoria,

                        promocao:
                            ajuste.promocao === true,

                        novo:
                            ajuste.novo === true,

                        exibirSite:
                            ajuste.exibirSite !== false
                    };

                })
                .filter(produto => produto.exibirSite !== false);


            produtos.length = 0;

            produtosAjustados.forEach(produto => {
                produtos.push(produto);
            });

        }

    } catch (erroAjustes) {

        console.warn(
            "Não foi possível carregar ajustes do catálogo:",
            erroAjustes
        );

    }


    // =========================================================
    // MOSTRA OS PRODUTOS
    // =========================================================

    if (
        typeof produtos !== "undefined" &&
        Array.isArray(produtos)
    ) {

        carregarProdutos(produtos);

    } else {

        carregarProdutos([]);

    }

    document.getElementById("menuCategorias")?.addEventListener("click", evento => {
        const botao = evento.target.closest(".btn-cat");
        if (botao) filtrarPorCategoria(botao.dataset.filtro, botao);
    });

    container?.addEventListener("click", evento => {
        const adicionarDetalhe = evento.target.closest("[data-detalhe-adicionar-id]");
        if (adicionarDetalhe) {
            const produto = produtos.find(item => Number(item.id) === Number(adicionarDetalhe.dataset.detalheAdicionarId));
            if (produto && typeof adicionarCarrinho === "function") {
                adicionarCarrinho(Number(produto.id));
                fecharModalProduto();
            }
            return;
        }

        const favorito = evento.target.closest("[data-favorito-id]");
        if (favorito) {
            alternarFavorito(favorito.dataset.favoritoId);
            return;
        }
        const adicionar = evento.target.closest("[data-adicionar-id]");
        if (adicionar && typeof adicionarCarrinho === "function") {
            adicionarCarrinho(Number(adicionar.dataset.adicionarId));
            return;
        }

        const areaImagem = evento.target.closest(".area-imagem-clicavel");
        const nomeProduto = evento.target.closest(".nome-produto-clicavel");
        const card = evento.target.closest("[data-produto-id]");
        if ((areaImagem || nomeProduto) && card) {
            const produto = produtos.find(item => Number(item.id) === Number(card.dataset.produtoId));
            if (produto) abrirModalProduto(produto);
        }
    });

    container?.addEventListener("keydown", evento => {
        if (evento.key !== "Enter" && evento.key !== " ") return;
        const areaImagem = evento.target.closest(".area-imagem-clicavel");
        if (!areaImagem) return;
        evento.preventDefault();
        const card = areaImagem.closest("[data-produto-id]");
        const produto = produtos.find(item => Number(item.id) === Number(card?.dataset.produtoId));
        if (produto) abrirModalProduto(produto);
    });

    campoBusca?.addEventListener("input", debounce(() => {
        atualizarBotaoLimparBusca();
        aplicarFiltros();
    }, 180));

    botaoLimparBusca?.addEventListener("click", () => {
        campoBusca.value = "";
        atualizarBotaoLimparBusca();
        aplicarFiltros();
        campoBusca.focus();
    });

    botaoAbrirCarrinho?.addEventListener("click", abrirModalCarrinho);
    botaoFecharCarrinho?.addEventListener("click", fecharModalCarrinho);
    document.querySelectorAll("[data-fechar-modal]").forEach(botao => botao.addEventListener("click", fecharModalCarrinho));
    modalCarrinho?.addEventListener("click", evento => {
        if (evento.target === modalCarrinho) fecharModalCarrinho();
    });
    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            fecharModalProduto();
            fecharModalCarrinho();
        }
    });

    if (typeof atualizarCarrinho === "function") atualizarCarrinho();
});

window.alternarFavorito = alternarFavorito;
window.aplicarFiltros = aplicarFiltros;
window.abrirModalCarrinho = abrirModalCarrinho;
window.fecharModalCarrinho = fecharModalCarrinho;
window.mostrarToast = mostrarToast;

window.abrirModalProduto = abrirModalProduto;
window.fecharModalProduto = fecharModalProduto;
