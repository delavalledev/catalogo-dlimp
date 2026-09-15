const hostPermitido =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

if (!hostPermitido) {
    window.location.replace("/");
}

/* =========================================================
   UTILITARIO - MOEDA
   ========================================================= */
function formatarMoeda(valor) {
    const numero = Number(valor);
    const seguro = Number.isFinite(numero) ? numero : 0;

    return seguro.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    });
}

// Disponibiliza explicitamente no escopo global.
// Evita problemas caso algum trecho do Admin seja executado em outro escopo.
window.formatarMoeda = formatarMoeda;

let produtos = [];
let filtrados = [];

const lista = document.getElementById("listaProdutos");
const busca = document.getElementById("busca");
const filtroStatus = document.getElementById("filtroStatus");

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

                <h3>${p.descricao || "Produto sem nome"}</h3>

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

async function carregarInsumos() {
    const lista = document.getElementById("listaInsumos");

    if (!lista) return;

    lista.innerHTML = '<div class="linha-insumo carregando">Carregando insumos...</div>';

    try {
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
                maximumFractionDigits: 4
            }
        );

        return `
            <div class="linha-insumo">

                <span class="nome-insumo">
                    ${escaparHtml(insumo.nome)}
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
// =========================================================
// CUSTEAMENTO - RECEITAS
// =========================================================

let receitas = [];
let receitasFiltradas = [];

async function carregarReceitas() {
    const lista = document.getElementById("listaReceitas");

    if (!lista) return;

    lista.innerHTML = `
        <div class="estado-vazio">Carregando receitas...</div>
    `;

    try {
        const resposta = await fetch(
            "http://127.0.0.1:3100/custeamento/receitas"
        );

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(
                dados.erro || "Erro ao carregar receitas."
            );
        }

        receitas = Array.isArray(dados.receitas)
            ? dados.receitas
            : [];

        receitasFiltradas = [...receitas];

        renderizarDashboardCusteamento();
        renderizarReceitas();
        await atualizarCustosListaReceitas();

    } catch (erro) {
        console.error("Erro ao carregar receitas:", erro);

        lista.innerHTML = `
            <div class="estado-vazio erro">
                Não foi possível carregar as receitas.
                <br>
                <small>${escaparHtml(erro.message)}</small>
            </div>
        `;
    }
}

async function obterCalculoReceita(id) {
    try {
        const resposta = await fetch(
            `http://127.0.0.1:3100/custeamento/receitas/${id}/calculo`
        );

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(
                dados.erro || "Erro ao calcular receita."
            );
        }

        return dados;

    } catch (erro) {
        console.error("Erro no cálculo da receita:", id, erro);
        return {
            custo_total: 0,
            custo_por_unidade: 0
        };
    }
}

async function atualizarCustosListaReceitas() {
    const linhas = document.querySelectorAll(".linha-receita");

    for (const linha of linhas) {
        const id = Number(linha.dataset.id);
        if (!id) continue;

        const dados = await obterCalculoReceita(id);

        const custo = linha.querySelector(".custo-receita-lista");
        const custoUnidade = linha.querySelector(".custo-unidade-receita");

        if (custo) {
            custo.textContent = window.formatarMoeda(dados.custo_total);
        }

        if (custoUnidade) {
            custoUnidade.textContent =
                `${window.formatarMoeda(dados.custo_por_unidade)} / ${escaparHtml(
                    receitas.find(r => Number(r.id) === id)?.unidade_rendimento || "un"
                )}`;
        }
    }
}

function renderizarDashboardCusteamento() {
    const dashboard = document.getElementById("dashboardCusteamento");

    if (!dashboard) return;

    dashboard.innerHTML = `
        <div class="card-dashboard">
            <span class="card-dashboard-icone">🧪</span>
            <div>
                <span class="card-dashboard-label">Receitas cadastradas</span>
                <strong>${receitas.length}</strong>
            </div>
        </div>

        <div class="card-dashboard">
            <span class="card-dashboard-icone">📦</span>
            <div>
                <span class="card-dashboard-label">Insumos cadastrados</span>
                <strong>${insumos.length}</strong>
            </div>
        </div>

        <div class="card-dashboard">
            <span class="card-dashboard-icone">💰</span>
            <div>
                <span class="card-dashboard-label">Receitas com rendimento</span>
                <strong>${receitas.filter(r => Number(r.rendimento || 0) > 0).length}</strong>
            </div>
        </div>

        <div class="card-dashboard card-dashboard-futuro">
            <span class="card-dashboard-icone">📈</span>
            <div>
                <span class="card-dashboard-label">Rentabilidade</span>
                <strong>Em breve</strong>
                <small>Produto final + margem</small>
            </div>
        </div>
    `;
}

function renderizarReceitas() {
    const lista = document.getElementById("listaReceitas");

    if (!lista) return;

    if (!receitasFiltradas.length) {
        lista.innerHTML = `
            <div class="estado-vazio">
                Nenhuma receita cadastrada.
            </div>
        `;
        return;
    }

    lista.innerHTML = receitasFiltradas.map(receita => {
        const rendimento = Number(receita.rendimento || 0);
        const unidade = receita.unidade_rendimento || "";

        return `
            <div class="linha-receita" data-id="${receita.id}">
                <div class="receita-identificacao">
                    <strong>${escaparHtml(receita.nome)}</strong>
                    <small>
                        ${receita.observacao
                            ? "Possui modo de preparo"
                            : "Sem modo de preparo cadastrado"}
                    </small>
                </div>

                <div class="receita-rendimento">
                    <strong>
                        ${rendimento.toLocaleString("pt-BR", {
                            maximumFractionDigits: 4
                        })}
                    </strong>
                    <small>${escaparHtml(unidade)}</small>
                </div>

                <div class="receita-custo">
                    <strong class="custo-receita-lista">...</strong>
                    <small class="custo-unidade-receita">Calculando...</small>
                </div>

                <div class="acoes-receita">
                    <button
                        type="button"
                        class="btn-editar-receita"
                        data-id="${receita.id}"
                    >
                        Editar
                    </button>
                </div>
            </div>
        `;
    }).join("");

    adicionarEventosReceitas();
}

function filtrarReceitas() {
    const campo = document.getElementById("buscaReceita");

    const termo = String(
        campo?.value || ""
    ).toLowerCase().trim();

    receitasFiltradas = receitas.filter(receita =>
        String(receita.nome || "")
            .toLowerCase()
            .includes(termo)
    );

    renderizarReceitas();
    atualizarCustosListaReceitas();
}

/* =========================================================
   MODAL DE RECEITA
   ========================================================= */

let receitaAtualId = null;

function abrirModalReceita(id = null) {
    const modal = document.getElementById("modalReceita");

    if (!modal) return;

    const titulo = document.getElementById("tituloModalReceita");
    const campoId = document.getElementById("receitaId");
    const campoNome = document.getElementById("nomeReceita");
    const campoRendimento = document.getElementById("rendimentoReceita");
    const campoUnidade = document.getElementById("unidadeRendimentoReceita");
    const campoObservacao = document.getElementById("observacaoReceita");
    const aviso = document.getElementById("avisoReceita");
    const areaItens = document.getElementById("areaItensReceita");

    receitaAtualId = id ? Number(id) : null;

    aviso.textContent = "";
    aviso.classList.remove("visivel");

    if (id === null) {
        titulo.textContent = "Nova receita";
        campoId.value = "";
        campoNome.value = "";
        campoRendimento.value = "";
        campoUnidade.value = "L";
        campoObservacao.value = "";

        areaItens.classList.add("oculto");

        modal.classList.remove("oculto");

        // A composição usa a mesma fonte de dados da aba Insumos.
        // Carregamos a lista aqui também para a receita não depender
        // de o usuário ter passado primeiro pela aba Insumos.
        carregarInsumosParaReceita();
        return;
    }

    const receita = receitas.find(
        item => Number(item.id) === Number(id)
    );

    if (!receita) {
        alert("Receita não encontrada.");
        return;
    }

    titulo.textContent = "Editar receita";
    campoId.value = receita.id;
    campoNome.value = receita.nome || "";
    campoRendimento.value = receita.rendimento ?? "";
    campoUnidade.value = receita.unidade_rendimento || "L";
    campoObservacao.value = receita.observacao || "";

    areaItens.classList.remove("oculto");

    modal.classList.remove("oculto");

    carregarInsumosParaReceita();
    carregarItensReceita(receita.id);
}

function fecharModalReceita() {
    const modal = document.getElementById("modalReceita");

    if (modal) {
        modal.classList.add("oculto");
    }

    receitaAtualId = null;
}

function mostrarAvisoReceita(texto, erro = false) {
    const aviso = document.getElementById("avisoReceita");

    if (!aviso) return;

    aviso.textContent = texto || "";
    aviso.classList.toggle("visivel", Boolean(texto));
    aviso.classList.toggle("erro", erro);
}

async function salvarReceita() {
    const id = document.getElementById("receitaId").value;
    const nome = document.getElementById("nomeReceita").value.trim();
    const rendimento = document.getElementById("rendimentoReceita").value;
    const unidade = document.getElementById("unidadeRendimentoReceita").value;
    const observacao = document.getElementById("observacaoReceita").value.trim();
    const botao = document.getElementById("salvarReceita");

    if (!nome) {
        mostrarAvisoReceita("Informe o nome da receita.", true);
        return;
    }

    if (rendimento === "" || Number(rendimento) <= 0) {
        mostrarAvisoReceita("Informe um rendimento válido.", true);
        return;
    }

    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
        const url = id
            ? "http://127.0.0.1:3100/custeamento/receitas/editar"
            : "http://127.0.0.1:3100/custeamento/receitas";

        const resposta = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: id ? Number(id) : null,
                nome,
                rendimento: Number(rendimento),
                unidade_rendimento: unidade,
                observacao
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(
                dados.erro || "Não foi possível salvar a receita."
            );
        }

        const novoId = Number(
            dados.id ||
            dados.receita_id ||
            dados.receita?.id ||
            id
        );

        receitaAtualId = novoId || null;

        mostrarAvisoReceita(
            "Receita salva. Agora você pode montar a composição."
        );

        document.getElementById("receitaId").value = novoId || "";

        document.getElementById("tituloModalReceita").textContent =
            "Editar receita";

        document.getElementById("areaItensReceita")
            .classList.remove("oculto");

        await carregarInsumosParaReceita();
        await carregarReceitas();

        if (novoId) {
            await carregarItensReceita(novoId);
        }

    } catch (erro) {
        console.error("Erro ao salvar receita:", erro);
        mostrarAvisoReceita(erro.message, true);

    } finally {
        botao.disabled = false;
        botao.textContent = "Salvar receita";
    }
}

async function carregarInsumosParaReceita() {
    const select = document.getElementById("insumoReceita");

    if (!select) return;

    select.innerHTML = '<option value="">Carregando insumos...</option>';
    select.disabled = true;

    try {
        // Busca diretamente a mesma API usada pela aba Insumos.
        // Assim a receita sempre recebe a lista atual do banco.
        const resposta = await fetch(
            "http://127.0.0.1:3100/custeamento/insumos"
        );

        if (!resposta.ok) {
            throw new Error("Erro HTTP " + resposta.status);
        }

        const dados = await resposta.json();

        if (!dados.ok) {
            throw new Error(
                dados.erro || "Não foi possível carregar os insumos."
            );
        }

        insumos = Array.isArray(dados.insumos)
            ? dados.insumos
            : [];

        const lista = [...insumos].sort((a, b) =>
            String(a.nome || "").localeCompare(
                String(b.nome || ""),
                "pt-BR",
                { sensitivity: "base" }
            )
        );

        select.innerHTML =
            '<option value="">Selecione um insumo...</option>';

        if (!lista.length) {
            select.innerHTML =
                '<option value="">Nenhum insumo cadastrado</option>';
            return;
        }

        lista.forEach(insumo => {
            const option = document.createElement("option");

            option.value = String(insumo.id);

            const nome = String(insumo.nome || "Insumo");
            const unidade = String(insumo.unidade || "");
            const preco = typeof window.formatarMoeda === "function"
                ? window.formatarMoeda(insumo.preco_atual)
                : `R$ ${Number(insumo.preco_atual || 0).toFixed(2).replace(".", ",")}`;
            const situacao =
                Number(insumo.ativo) === 0
                    ? " — INATIVO"
                    : "";

            option.textContent =
                `${nome} — ${unidade} — ${preco}${situacao}`;

            if (Number(insumo.ativo) === 0) {
                option.style.color = "#999";
            }

            select.appendChild(option);
        });

    } catch (erro) {
        console.error(
            "Erro ao carregar insumos para receita:",
            erro
        );

        select.innerHTML =
            '<option value="">Erro ao carregar insumos</option>';

        mostrarAvisoReceita(
            "Não foi possível carregar os insumos: " + erro.message,
            true
        );
    } finally {
        select.disabled = false;
    }
}

async function carregarItensReceita(receitaId) {
    const lista = document.getElementById("listaItensReceita");

    if (!lista) return;

    lista.innerHTML =
        '<div class="estado-vazio">Carregando composição...</div>';

    try {
        const resposta = await fetch(
            `http://127.0.0.1:3100/custeamento/receitas/${receitaId}/itens`
        );

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(
                dados.erro || "Erro ao carregar itens da receita."
            );
        }

        const itens = Array.isArray(dados.itens)
            ? dados.itens
            : [];

        if (!itens.length) {
            lista.innerHTML = `
                <div class="estado-vazio">
                    <strong>Receita sem composição</strong>
                    <br>
                    <small>Adicione os insumos usados para calcular o custo.</small>
                </div>
            `;

            await atualizarCalculoReceita(receitaId);
            return;
        }

        lista.innerHTML = itens.map(item => {
            const quantidade = Number(item.quantidade || 0);
            const preco = Number(item.preco_atual || 0);
            const custo = Number(item.custo_item || 0);

            return `
                <div class="linha-item-receita" data-item-id="${item.id}">
                    <div class="nome-item-receita">
                        <strong>${escaparHtml(item.insumo_nome || "Insumo")}</strong>
                        <small>${escaparHtml(item.insumo_unidade || "")}</small>
                    </div>

                    <div>
                        <input
                            class="quantidade-item-receita"
                            type="number"
                            min="0"
                            step="0.000001"
                            value="${quantidade}"
                            data-id="${item.id}"
                            data-receita="${receitaId}"
                        >
                    </div>

                    <div>
                        <span class="preco-item-receita">
                            ${window.formatarMoeda(preco)}
                        </span>
                    </div>

                    <div>
                        <strong class="custo-item-receita">
                            ${window.formatarMoeda(custo)}
                        </strong>
                    </div>

                    <button
                        type="button"
                        class="btn-excluir-item-receita"
                        data-id="${item.id}"
                        data-receita="${receitaId}"
                        title="Remover insumo"
                    >
                        ×
                    </button>
                </div>
            `;
        }).join("");

        lista.querySelectorAll(".btn-excluir-item-receita")
            .forEach(botao => {
                botao.addEventListener("click", () => {
                    excluirItemReceita(
                        Number(botao.dataset.id),
                        receitaId
                    );
                });
            });

        lista.querySelectorAll(".quantidade-item-receita")
            .forEach(input => {
                input.addEventListener("change", () => {
                    editarQuantidadeItemReceita(
                        Number(input.dataset.id),
                        Number(input.dataset.receita),
                        Number(input.value)
                    );
                });
            });

        await atualizarCalculoReceita(receitaId);

    } catch (erro) {
        console.error("Erro ao carregar itens:", erro);

        lista.innerHTML = `
            <div class="estado-vazio erro">
                Não foi possível carregar os itens.
                <br>
                <small>${escaparHtml(erro.message)}</small>
            </div>
        `;
    }
}

async function adicionarItemReceita() {
    const receitaId = Number(
        document.getElementById("receitaId").value
    );

    const insumoId = Number(
        document.getElementById("insumoReceita").value
    );

    const quantidade = Number(
        document.getElementById("quantidadeInsumoReceita").value
    );

    if (!receitaId) {
        mostrarAvisoReceita(
            "Salve a receita primeiro para começar a composição.",
            true
        );
        return;
    }

    if (!insumoId) {
        mostrarAvisoReceita("Selecione um insumo.", true);
        return;
    }

    if (!quantidade || quantidade <= 0) {
        mostrarAvisoReceita("Informe uma quantidade válida.", true);
        return;
    }

    const botao = document.getElementById("adicionarItemReceita");

    botao.disabled = true;
    botao.textContent = "Adicionando...";

    try {
        const resposta = await fetch(
            `http://127.0.0.1:3100/custeamento/receitas/${receitaId}/itens`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    insumo_id: insumoId,
                    quantidade
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(
                dados.erro || "Não foi possível adicionar o insumo."
            );
        }

        document.getElementById(
            "quantidadeInsumoReceita"
        ).value = "";

        document.getElementById(
            "insumoReceita"
        ).value = "";

        mostrarAvisoReceita("");

        await carregarItensReceita(receitaId);
        await atualizarCustosListaReceitas();

    } catch (erro) {
        console.error("Erro ao adicionar item:", erro);
        mostrarAvisoReceita(erro.message, true);

    } finally {
        botao.disabled = false;
        botao.textContent = "+ Adicionar";
    }
}

async function editarQuantidadeItemReceita(
    itemId,
    receitaId,
    quantidade
) {
    if (!itemId || !receitaId || quantidade <= 0) {
        return;
    }

    try {
        const resposta = await fetch(
            "http://127.0.0.1:3100/custeamento/receitas/item/editar",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: itemId,
                    quantidade
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(
                dados.erro || "Não foi possível atualizar a quantidade."
            );
        }

        await carregarItensReceita(receitaId);
        await atualizarCustosListaReceitas();

    } catch (erro) {
        console.error(
            "Erro ao editar quantidade:",
            erro
        );

        alert(
            "Não foi possível atualizar a quantidade:\n\n" +
            erro.message
        );
    }
}

async function excluirItemReceita(itemId, receitaId) {
    if (!confirm("Remover este insumo da receita?")) {
        return;
    }

    try {
        const resposta = await fetch(
            "http://127.0.0.1:3100/custeamento/receitas/item/excluir",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: itemId
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(
                dados.erro || "Não foi possível excluir o item."
            );
        }

        await carregarItensReceita(receitaId);
        await atualizarCustosListaReceitas();

    } catch (erro) {
        console.error("Erro ao excluir item:", erro);
        alert(erro.message);
    }
}

async function atualizarCalculoReceita(receitaId) {
    try {
        const dados = await obterCalculoReceita(receitaId);

        const total = document.getElementById("custoTotalReceita");
        const unidade = document.getElementById("custoUnidadeReceita");

        if (total) {
            total.textContent =
                window.formatarMoeda(dados.custo_total);
        }

        if (unidade) {
            unidade.textContent =
                window.formatarMoeda(dados.custo_por_unidade);
        }

    } catch (erro) {
        console.error(
            "Erro no cálculo da receita:",
            erro
        );
    }
}

function adicionarEventosReceitas() {
    document.querySelectorAll(".btn-editar-receita")
        .forEach(botao => {
            botao.addEventListener("click", () => {
                abrirModalReceita(
                    Number(botao.dataset.id)
                );
            });
        });
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

    insumosFiltrados = insumos.filter(insumo => {

        const nome = String(insumo.nome || "").toLowerCase();

        const bateBusca =
            !busca ||
            nome.includes(busca);

        const bateTipo =
            tipo === "todos" ||
            insumo.tipo === tipo;

        return bateBusca && bateTipo;
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
    const aviso = document.getElementById("avisoInsumo");

    aviso.textContent = "";

    if (id === null) {

        titulo.textContent = "Novo insumo";

        campoId.value = "";
        campoNome.value = "";
        campoTipo.value = "MATERIA_PRIMA";
        campoUnidade.value = "KG";
        campoPreco.value = "";

    } else {

        const insumo = insumos.find(item => Number(item.id) === id);

        if (!insumo) return;

        titulo.textContent = "Editar insumo";

        campoId.value = insumo.id;
        campoNome.value = insumo.nome || "";
        campoTipo.value = insumo.tipo || "MATERIA_PRIMA";
        campoUnidade.value = insumo.unidade || "UN";
        campoPreco.value = insumo.preco_atual ?? "";
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
                preco_atual: Number(preco)
            })

        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.ok) {
            throw new Error(
                dados.erro || "Não foi possível salvar o insumo."
            );
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

        subMenuInsumos?.classList.add("ativo");
        subMenuReceitas?.classList.remove("ativo");

        carregarInsumos();
    }

    function mostrarPainelReceitas() {

        painelInsumos?.classList.add("oculto");
        painelReceitas?.classList.remove("oculto");

        subMenuInsumos?.classList.remove("ativo");
        subMenuReceitas?.classList.add("ativo");

        // A composição da receita usa exatamente o mesmo cadastro da aba Insumos.
        // Atualiza os insumos ao entrar em Receitas, mesmo que a aba Insumos nunca tenha sido aberta.
        if (!insumos.length) {
            carregarInsumos().catch(erro => {
                console.warn("Não foi possível atualizar os insumos para as receitas:", erro);
            });
        } else {
            // Mantém o contador do dashboard atualizado.
            renderizarDashboardCusteamento();
        }

        renderizarDashboardCusteamento();
        carregarReceitas();
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

    document.getElementById("novaReceita")
        ?.addEventListener(
            "click",
            () => abrirModalReceita()
        );

    document.getElementById("fecharModalReceita")
        ?.addEventListener(
            "click",
            fecharModalReceita
        );

    document.getElementById("cancelarReceita")
        ?.addEventListener(
            "click",
            fecharModalReceita
        );

    document.getElementById("salvarReceita")
        ?.addEventListener(
            "click",
            salvarReceita
        );

    document.getElementById("adicionarItemReceita")
        ?.addEventListener(
            "click",
            adicionarItemReceita
        );

});