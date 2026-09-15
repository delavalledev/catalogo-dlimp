const hostPermitido =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

if (!hostPermitido) {
    window.location.replace("/");
}
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
// CUSTEAMENTO - RECEITAS
// =========================================================

let receitas = [];
let receitasFiltradas = [];
let receitaEmEdicao = null;
let composicaoReceita = [];
let itensOriginaisReceita = [];
let insumoSelecionado = null;

function formatarMoedaReceita(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    });
}

function obterInsumoPorId(id) {
    return insumos.find(i => Number(i.id) === Number(id));
}

function normalizarItemReceita(item) {
    const insumo = obterInsumoPorId(item.insumo_id);
    return {
        id: item.id ? Number(item.id) : null,
        insumo_id: Number(item.insumo_id),
        nome: item.insumo_nome || item.nome || insumo?.nome || "Insumo",
        unidade: item.insumo_unidade || item.unidade || insumo?.unidade || "",
        preco_atual: Number(item.preco_atual ?? item.preco ?? insumo?.preco_atual ?? 0),
        quantidade: Number(item.quantidade || 0)
    };
}

async function carregarReceitas() {
    try {
        const resposta = await fetch("http://127.0.0.1:3100/custeamento/receitas");
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) {
            throw new Error(dados.erro || "Erro ao carregar receitas.");
        }
        receitas = Array.isArray(dados.receitas) ? dados.receitas : [];
        receitasFiltradas = [...receitas];
        renderizarReceitas();
        atualizarCustosListaReceitas();
    } catch (erro) {
        console.error("Erro ao carregar receitas:", erro);
        const lista = document.getElementById("listaReceitas");
        if (lista) lista.innerHTML = `<div class="estado-vazio">Erro ao carregar receitas.</div>`;
    }
}

async function atualizarCustosListaReceitas() {
    const botoes = document.querySelectorAll(".btn-editar-receita");
    for (const botao of botoes) {
        const id = Number(botao.dataset.id);
        try {
            const resposta = await fetch(`http://127.0.0.1:3100/custeamento/receitas/${id}/calculo`);
            const dados = await resposta.json();
            if (!resposta.ok || !dados.ok) continue;
            const linha = botao.closest(".linha-receita");
            const custo = linha?.querySelector(".custo-receita-lista");
            if (custo) custo.textContent = formatarMoedaReceita(dados.custo_total);
        } catch (erro) {
            console.error("Erro ao calcular receita da lista:", id, erro);
        }
    }
}

function renderizarReceitas() {
    const lista = document.getElementById("listaReceitas");
    if (!lista) return;

    if (!receitasFiltradas.length) {
        lista.innerHTML = `<div class="estado-vazio">Nenhuma receita cadastrada.</div>`;
        return;
    }

    lista.innerHTML = receitasFiltradas.map(receita => `
        <div class="linha-insumo linha-receita">
            <span class="nome-insumo">${escaparHtml(receita.nome)}</span>
            <span>${Number(receita.rendimento || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ${escaparHtml(receita.unidade_rendimento || "")}</span>
            <span><strong class="custo-receita-lista">Calculando...</strong></span>
            <span class="acoes-insumo">
                <button type="button" class="btn-editar-receita" data-id="${receita.id}">Editar</button>
                <button type="button" class="btn-ver-receita" data-id="${receita.id}">Ver receita</button>
            </span>
        </div>
    `).join("");

    document.querySelectorAll(".btn-editar-receita").forEach(btn => {
        btn.addEventListener("click", () => abrirModalReceita(Number(btn.dataset.id), false));
    });
    document.querySelectorAll(".btn-ver-receita").forEach(btn => {
        btn.addEventListener("click", () => abrirModalReceita(Number(btn.dataset.id), true));
    });
}

function filtrarReceitas() {
    const termo = String(document.getElementById("buscaReceita")?.value || "").toLowerCase().trim();
    receitasFiltradas = receitas.filter(r => String(r.nome || "").toLowerCase().includes(termo));
    renderizarReceitas();
    atualizarCustosListaReceitas();
}

function criarModalReceita() {
    if (document.getElementById("modalReceita")) return;

    const modal = document.createElement("div");
    modal.id = "modalReceita";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.58);display:none;align-items:center;justify-content:center;z-index:9999;padding:20px;";
    modal.innerHTML = `
        <div id="caixaModalReceita" style="width:min(1000px,96vw);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.28);padding:28px;position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                <div><div style="font-size:13px;color:#64748b;">CUSTEAMENTO</div><h2 id="tituloModalReceita" style="margin:4px 0 0;color:#172554;font-size:25px;">Nova receita</h2></div>
                <button id="fecharModalReceita" type="button" style="width:38px;height:38px;border:0;border-radius:50%;background:#f1f5f9;font-size:22px;cursor:pointer;">×</button>
            </div>

            <div style="display:grid;grid-template-columns:1fr 180px 120px;gap:15px;margin-bottom:25px;">
                <label style="font-weight:600;">Nome da receita<input id="receitaNome" type="text" placeholder="Ex.: Cloro Gel" style="display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:12px;border:1px solid #cbd5e1;border-radius:9px;font-size:15px;"></label>
                <label style="font-weight:600;">Rendimento<input id="receitaRendimento" type="number" min="0" step="0.0001" placeholder="25" style="display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:12px;border:1px solid #cbd5e1;border-radius:9px;font-size:15px;"></label>
                <label style="font-weight:600;">Unidade<select id="receitaUnidade" style="display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:12px;border:1px solid #cbd5e1;border-radius:9px;font-size:15px;background:#fff;"><option value="L">L</option><option value="KG">KG</option><option value="UN">UN</option></select></label>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div><h3 style="margin:0;color:#172554;">Composição</h3><div style="font-size:13px;color:#64748b;margin-top:3px;">Matérias-primas utilizadas nesta receita</div></div>
                <button id="adicionarInsumoReceita" type="button" style="border:0;background:#3949d8;color:#fff;padding:11px 16px;border-radius:9px;cursor:pointer;font-weight:600;">+ Adicionar insumo</button>
            </div>

            <div id="composicaoReceita" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;"></div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:25px;">
                <div style="background:#f8fafc;border-radius:12px;padding:18px;"><div style="font-size:13px;color:#64748b;">Custo total</div><strong id="custoTotalReceita" style="display:block;font-size:24px;color:#172554;margin-top:5px;">R$ 0,00</strong></div>
                <div style="background:#f8fafc;border-radius:12px;padding:18px;"><div style="font-size:13px;color:#64748b;">Custo por unidade</div><strong id="custoUnidadeReceita" style="display:block;font-size:24px;color:#172554;margin-top:5px;">R$ 0,00</strong></div>
            </div>

            <label style="display:block;font-weight:600;margin-bottom:7px;">Modo de preparo<textarea id="receitaObservacao" rows="6" placeholder="Descreva aqui o modo de preparo..." style="width:100%;box-sizing:border-box;padding:13px;border:1px solid #cbd5e1;border-radius:10px;resize:vertical;font-family:inherit;font-size:14px;"></textarea></label>
            <div id="avisoModalReceita" style="min-height:22px;margin:12px 0;color:#dc2626;font-size:14px;"></div>

            <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #e2e8f0;padding-top:20px;">
                <button id="cancelarModalReceita" type="button" style="padding:11px 20px;border:1px solid #cbd5e1;background:#fff;border-radius:9px;cursor:pointer;">Cancelar</button>
                <button id="salvarModalReceita" type="button" style="padding:11px 22px;border:0;background:#3949d8;color:#fff;border-radius:9px;cursor:pointer;font-weight:600;">Salvar receita</button>
            </div>

            <div id="seletorInsumosReceita" style="display:none;position:absolute;inset:0;background:#fff;border-radius:18px;padding:28px;z-index:5;box-sizing:border-box;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;"><div><h2 style="margin:0;color:#172554;">Adicionar insumo</h2><div style="font-size:13px;color:#64748b;margin-top:4px;">Clique no insumo que deseja utilizar</div></div><button id="fecharSeletorInsumos" type="button" style="width:38px;height:38px;border:0;border-radius:50%;background:#f1f5f9;font-size:22px;cursor:pointer;">×</button></div>
                <input id="buscaInsumoReceita" type="search" placeholder="🔎 Pesquisar insumo..." style="width:100%;box-sizing:border-box;padding:14px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;margin-bottom:15px;">
                <div id="listaSelecaoInsumos" style="max-height:68vh;overflow-y:auto;display:flex;flex-direction:column;gap:7px;"></div>
            </div>

            <div id="quantidadeInsumoReceita" style="display:none;position:absolute;inset:0;background:#fff;border-radius:18px;padding:28px;z-index:6;box-sizing:border-box;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:25px;"><div><div style="font-size:13px;color:#64748b;">INSUMO SELECIONADO</div><h2 id="nomeInsumoSelecionado" style="margin:4px 0 0;color:#172554;">-</h2></div><button id="voltarListaInsumos" type="button" style="border:0;background:#f1f5f9;padding:10px 14px;border-radius:9px;cursor:pointer;">← Voltar</button></div>
                <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:20px;"><div style="color:#64748b;font-size:13px;">Preço atual</div><strong id="precoInsumoSelecionado" style="font-size:22px;color:#172554;">R$ 0,00</strong><span id="unidadeInsumoSelecionado" style="color:#64748b;margin-left:5px;"></span></div>
                <label style="display:block;font-weight:600;margin-bottom:7px;">Quantidade utilizada<input id="quantidadeSelecionada" type="number" min="0" step="0.000001" placeholder="Ex.: 5" style="width:100%;box-sizing:border-box;padding:14px;border:1px solid #cbd5e1;border-radius:10px;font-size:18px;margin-bottom:15px;"></label>
                <div style="background:#eef2ff;border-radius:12px;padding:18px;margin-bottom:25px;"><div style="font-size:13px;color:#64748b;">Custo deste item</div><strong id="custoItemSelecionado" style="display:block;font-size:26px;color:#172554;margin-top:4px;">R$ 0,00</strong></div>
                <div style="display:flex;justify-content:flex-end;gap:10px;"><button id="cancelarQuantidadeInsumo" type="button" style="padding:11px 20px;border:1px solid #cbd5e1;background:#fff;border-radius:9px;cursor:pointer;">Cancelar</button><button id="confirmarQuantidadeInsumo" type="button" style="padding:11px 22px;border:0;background:#3949d8;color:#fff;border-radius:9px;cursor:pointer;font-weight:600;">Adicionar à receita</button></div>
            </div>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById("fecharModalReceita").onclick = fecharModalReceita;
    document.getElementById("cancelarModalReceita").onclick = fecharModalReceita;
    document.getElementById("adicionarInsumoReceita").onclick = abrirSeletorInsumos;
    document.getElementById("fecharSeletorInsumos").onclick = fecharSeletorInsumos;
    document.getElementById("buscaInsumoReceita").oninput = renderizarSelecaoInsumos;
    document.getElementById("voltarListaInsumos").onclick = voltarParaListaInsumos;
    document.getElementById("cancelarQuantidadeInsumo").onclick = voltarParaListaInsumos;
    document.getElementById("quantidadeSelecionada").oninput = atualizarCustoItemSelecionado;
    document.getElementById("confirmarQuantidadeInsumo").onclick = confirmarAdicaoInsumo;
    document.getElementById("salvarModalReceita").onclick = salvarReceitaModal;
    document.getElementById("receitaRendimento").oninput = atualizarResumoReceitaModal;
}

async function abrirModalReceita(id = null, somenteVisualizacao = false) {
    criarModalReceita();
    const modal = document.getElementById("modalReceita");
    if (!modal) return;

    if (!insumos.length) await carregarInsumos();

    receitaEmEdicao = id ? Number(id) : null;
    composicaoReceita = [];
    itensOriginaisReceita = [];
    insumoSelecionado = null;

    const nome = document.getElementById("receitaNome");
    const rendimento = document.getElementById("receitaRendimento");
    const unidade = document.getElementById("receitaUnidade");
    const observacao = document.getElementById("receitaObservacao");
    const titulo = document.getElementById("tituloModalReceita");
    const aviso = document.getElementById("avisoModalReceita");

    aviso.textContent = "";

    if (!id) {
        titulo.textContent = "Nova receita";
        nome.value = "";
        rendimento.value = "";
        unidade.value = "L";
        observacao.value = "";
    } else {
        const receita = receitas.find(r => Number(r.id) === Number(id));
        if (!receita) {
            alert("Receita não encontrada.");
            return;
        }
        titulo.textContent = somenteVisualizacao ? "Visualizar receita" : "Editar receita";
        nome.value = receita.nome || "";
        rendimento.value = receita.rendimento ?? "";
        unidade.value = receita.unidade_rendimento || "L";
        observacao.value = receita.observacao || "";

        try {
            const resposta = await fetch(`http://127.0.0.1:3100/custeamento/receitas/${id}/itens`);
            const dados = await resposta.json();
            if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Erro ao carregar composição.");
            composicaoReceita = (dados.itens || []).map(normalizarItemReceita);
            itensOriginaisReceita = JSON.parse(JSON.stringify(composicaoReceita));
        } catch (erro) {
            console.error(erro);
            aviso.textContent = erro.message;
        }
    }

    nome.disabled = somenteVisualizacao;
    rendimento.disabled = somenteVisualizacao;
    unidade.disabled = somenteVisualizacao;
    observacao.disabled = somenteVisualizacao;
    document.getElementById("adicionarInsumoReceita").style.display = somenteVisualizacao ? "none" : "block";
    document.getElementById("salvarModalReceita").style.display = somenteVisualizacao ? "none" : "block";

    renderizarComposicaoReceita(somenteVisualizacao);
    atualizarResumoReceitaModal();
    fecharSeletorInsumos();
    document.getElementById("quantidadeInsumoReceita").style.display = "none";
    modal.style.display = "flex";
}

function fecharModalReceita() {
    const modal = document.getElementById("modalReceita");
    if (modal) modal.style.display = "none";
}

async function abrirSeletorInsumos() {
    if (!insumos.length) await carregarInsumos();
    document.getElementById("seletorInsumosReceita").style.display = "block";
    document.getElementById("quantidadeInsumoReceita").style.display = "none";
    document.getElementById("buscaInsumoReceita").value = "";
    renderizarSelecaoInsumos();
    setTimeout(() => document.getElementById("buscaInsumoReceita")?.focus(), 50);
}

function fecharSeletorInsumos() {
    const el = document.getElementById("seletorInsumosReceita");
    if (el) el.style.display = "none";
}

function voltarParaListaInsumos() {
    document.getElementById("quantidadeInsumoReceita").style.display = "none";
    document.getElementById("seletorInsumosReceita").style.display = "block";
    renderizarSelecaoInsumos();
}

function renderizarSelecaoInsumos() {
    const lista = document.getElementById("listaSelecaoInsumos");
    if (!lista) return;
    const termo = String(document.getElementById("buscaInsumoReceita")?.value || "").toLowerCase().trim();
    const resultados = insumos.filter(i => Number(i.ativo) !== 0 && (!termo || String(i.nome || "").toLowerCase().includes(termo)));

    if (!resultados.length) {
        lista.innerHTML = `<div style="padding:35px;text-align:center;color:#64748b;">Nenhum insumo encontrado.</div>`;
        return;
    }

    lista.innerHTML = resultados.sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR", {sensitivity:"base"})).map(insumo => `
        <button type="button" class="item-selecao-insumo" data-id="${insumo.id}" style="width:100%;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:13px 15px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;text-align:left;">
            <span><strong style="display:block;color:#172554;font-size:15px;">${escaparHtml(insumo.nome)}</strong><small style="color:#64748b;">${escaparHtml(formatarTipoInsumo(insumo.tipo))} · ${escaparHtml(insumo.unidade || "")}</small></span>
            <strong style="color:#172554;">${formatarMoedaReceita(insumo.preco_atual)}<small style="color:#64748b;font-weight:400;"> / ${escaparHtml(insumo.unidade || "")}</small></strong>
        </button>`).join("");

    lista.querySelectorAll(".item-selecao-insumo").forEach(btn => {
        btn.onclick = () => selecionarInsumoReceita(Number(btn.dataset.id));
    });
}

function selecionarInsumoReceita(id) {
    const insumo = obterInsumoPorId(id);
    if (!insumo) return;
    insumoSelecionado = insumo;
    document.getElementById("nomeInsumoSelecionado").textContent = insumo.nome;
    document.getElementById("precoInsumoSelecionado").textContent = formatarMoedaReceita(insumo.preco_atual);
    document.getElementById("unidadeInsumoSelecionado").textContent = `/ ${insumo.unidade || ""}`;
    document.getElementById("quantidadeSelecionada").value = "";
    document.getElementById("custoItemSelecionado").textContent = "R$ 0,00";
    document.getElementById("seletorInsumosReceita").style.display = "none";
    document.getElementById("quantidadeInsumoReceita").style.display = "block";
    setTimeout(() => document.getElementById("quantidadeSelecionada")?.focus(), 50);
}

function atualizarCustoItemSelecionado() {
    const quantidade = Number(document.getElementById("quantidadeSelecionada")?.value || 0);
    const preco = Number(insumoSelecionado?.preco_atual || 0);
    document.getElementById("custoItemSelecionado").textContent = formatarMoedaReceita(quantidade * preco);
}

function confirmarAdicaoInsumo() {
    if (!insumoSelecionado) return;
    const quantidade = Number(document.getElementById("quantidadeSelecionada").value);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
        alert("Informe uma quantidade válida.");
        return;
    }

    const existente = composicaoReceita.find(i => Number(i.insumo_id) === Number(insumoSelecionado.id));
    if (existente) {
        existente.quantidade = Number(existente.quantidade || 0) + quantidade;
    } else {
        composicaoReceita.push({
            id: null,
            insumo_id: Number(insumoSelecionado.id),
            nome: insumoSelecionado.nome,
            unidade: insumoSelecionado.unidade,
            preco_atual: Number(insumoSelecionado.preco_atual || 0),
            quantidade
        });
    }
    insumoSelecionado = null;
    document.getElementById("quantidadeInsumoReceita").style.display = "none";
    renderizarComposicaoReceita();
    atualizarResumoReceitaModal();
}

function renderizarComposicaoReceita(somenteVisualizacao = false) {
    const area = document.getElementById("composicaoReceita");
    if (!area) return;

    if (!composicaoReceita.length) {
        area.innerHTML = `<div style="padding:35px;text-align:center;color:#64748b;background:#f8fafc;"><div style="font-size:28px;margin-bottom:8px;">🧪</div>Nenhum insumo adicionado ainda.<div style="font-size:12px;margin-top:5px;">Você pode salvar a receita e adicionar a composição depois.</div></div>`;
        return;
    }

    area.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 150px 140px 45px;gap:10px;padding:10px 14px;background:#f8fafc;color:#64748b;font-size:12px;font-weight:600;"><span>INSUMO</span><span>QUANTIDADE</span><span>CUSTO</span><span></span></div>
        ${composicaoReceita.map((item,index) => {
            const quantidade = Number(item.quantidade || 0);
            const custo = quantidade * Number(item.preco_atual || 0);
            return `<div style="display:grid;grid-template-columns:1fr 150px 140px 45px;gap:10px;align-items:center;padding:11px 14px;border-top:1px solid #e2e8f0;">
                <strong style="color:#172554;">${escaparHtml(item.nome)}</strong>
                <div style="display:flex;align-items:center;gap:6px;"><input class="quantidade-item-receita" data-index="${index}" type="number" min="0" step="0.000001" value="${quantidade}" ${somenteVisualizacao ? "disabled" : ""} style="width:105px;box-sizing:border-box;padding:8px;border:1px solid #cbd5e1;border-radius:7px;"><span style="font-size:13px;color:#64748b;">${escaparHtml(item.unidade)}</span></div>
                <strong>${formatarMoedaReceita(custo)}</strong>
                ${somenteVisualizacao ? "" : `<button type="button" class="remover-item-receita" data-index="${index}" style="width:34px;height:34px;border:0;border-radius:8px;background:#fee2e2;color:#b91c1c;cursor:pointer;">🗑</button>`}
            </div>`;
        }).join("")}`;

    area.querySelectorAll(".quantidade-item-receita").forEach(input => {
        input.addEventListener("input", () => {
            const index = Number(input.dataset.index);
            composicaoReceita[index].quantidade = Number(input.value || 0);
            const linha = input.closest("div[style*='grid-template-columns']");
            const custo = Number(composicaoReceita[index].quantidade || 0) * Number(composicaoReceita[index].preco_atual || 0);
            const strongs = linha?.querySelectorAll("strong");
            if (strongs?.length > 1) strongs[1].textContent = formatarMoedaReceita(custo);
            atualizarResumoReceitaModal();
        });
    });

    area.querySelectorAll(".remover-item-receita").forEach(btn => {
        btn.onclick = () => {
            composicaoReceita.splice(Number(btn.dataset.index), 1);
            renderizarComposicaoReceita();
            atualizarResumoReceitaModal();
        };
    });
}

function atualizarResumoReceitaModal() {
    let total = 0;
    composicaoReceita.forEach(item => total += Number(item.quantidade || 0) * Number(item.preco_atual || 0));
    const rendimento = Number(document.getElementById("receitaRendimento")?.value || 0);
    document.getElementById("custoTotalReceita").textContent = formatarMoedaReceita(total);
    document.getElementById("custoUnidadeReceita").textContent = formatarMoedaReceita(rendimento > 0 ? total / rendimento : 0);
}

async function salvarReceitaModal() {
    const nome = document.getElementById("receitaNome").value.trim();
    const rendimento = Number(document.getElementById("receitaRendimento").value);
    const unidade = document.getElementById("receitaUnidade").value;
    const observacao = document.getElementById("receitaObservacao").value.trim();
    const aviso = document.getElementById("avisoModalReceita");
    const botao = document.getElementById("salvarModalReceita");

    if (!nome) { aviso.textContent = "Informe o nome da receita."; return; }
    if (!Number.isFinite(rendimento) || rendimento <= 0) { aviso.textContent = "Informe um rendimento válido."; return; }

    botao.disabled = true;
    aviso.textContent = "Salvando receita...";

    try {
        let receitaId = receitaEmEdicao;
        const url = receitaId ? "http://127.0.0.1:3100/custeamento/receitas/editar" : "http://127.0.0.1:3100/custeamento/receitas";
        const resposta = await fetch(url, {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ id: receitaId ? Number(receitaId) : null, nome, rendimento, unidade_rendimento: unidade, observacao })
        });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Não foi possível salvar a receita.");

        if (!receitaId) {
            receitaId = Number(dados.id || dados.receita_id || dados.insertId || dados.receita?.id || 0);
            if (!receitaId) {
                await carregarReceitas();
                const encontrada = receitas.find(r => String(r.nome).trim().toLowerCase() === nome.toLowerCase());
                receitaId = encontrada ? Number(encontrada.id) : 0;
            }
            if (!receitaId) throw new Error("A receita foi salva, mas não consegui identificar o ID criado.");
            receitaEmEdicao = receitaId;
        }

        // Exclui do banco os itens que foram removidos da composição.
        for (const antigo of itensOriginaisReceita) {
            const aindaExiste = composicaoReceita.some(atual => Number(atual.id) === Number(antigo.id));
            if (antigo.id && !aindaExiste) {
                const r = await fetch("http://127.0.0.1:3100/custeamento/receitas/item/excluir", {
                    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:Number(antigo.id)})
                });
                const d = await r.json();
                if (!r.ok || !d.ok) throw new Error(d.erro || "Não foi possível remover um item da receita.");
            }
        }

        // Salva quantidades existentes e adiciona itens novos.
        for (const item of composicaoReceita) {
            const quantidade = Number(item.quantidade || 0);
            if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error(`Quantidade inválida para ${item.nome}.`);

            const r = item.id
                ? await fetch("http://127.0.0.1:3100/custeamento/receitas/item/editar", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(item.id),quantidade})})
                : await fetch(`http://127.0.0.1:3100/custeamento/receitas/${receitaId}/itens`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({insumo_id:Number(item.insumo_id),quantidade})});
            const d = await r.json();
            if (!r.ok || !d.ok) throw new Error(d.erro || `Não foi possível salvar ${item.nome}.`);
        }

        aviso.style.color = "#15803d";
        aviso.textContent = "Receita salva com sucesso.";
        await carregarReceitas();

        // Mantém a janela aberta: agora você pode continuar montando a receita.
        await abrirModalReceita(receitaId, false);
        document.getElementById("avisoModalReceita").style.color = "#15803d";
        document.getElementById("avisoModalReceita").textContent = "Receita salva com sucesso.";

    } catch (erro) {
        console.error("Erro ao salvar receita:", erro);
        aviso.style.color = "#dc2626";
        aviso.textContent = erro.message || "Erro ao salvar receita.";
    } finally {
        botao.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", function () {

    // =========================================================
// NAVEGAÇÃO DO CUSTEAMENTO
// =========================================================

const menuProdutos = document.getElementById("menuProdutos");
const menuCusteamento = document.getElementById("menuCusteamento");

const secaoProdutos = document.querySelector("main > .resumo");
const filtrosProdutos = document.querySelector("main > .filtros");
const listaProdutos = document.getElementById("listaProdutos");

const secaoCusteamento =
    document.getElementById("secaoCusteamento");

const painelInsumos =
    document.getElementById("painelInsumos");

const painelReceitas =
    document.getElementById("painelReceitas");


// =========================================================
// MOSTRAR PRODUTOS
// =========================================================

function mostrarProdutos() {

    if (secaoProdutos)
        secaoProdutos.classList.remove("oculto");

    if (filtrosProdutos)
        filtrosProdutos.classList.remove("oculto");

    if (listaProdutos)
        listaProdutos.classList.remove("oculto");

    if (secaoCusteamento)
        secaoCusteamento.classList.add("oculto");

}


// =========================================================
// MOSTRAR CUSTEAMENTO
// =========================================================

function mostrarCusteamento() {

    if (secaoProdutos)
        secaoProdutos.classList.add("oculto");

    if (filtrosProdutos)
        filtrosProdutos.classList.add("oculto");

    if (listaProdutos)
        listaProdutos.classList.add("oculto");

    if (secaoCusteamento)
        secaoCusteamento.classList.remove("oculto");

    mostrarPainelInsumos();

}


// =========================================================
// PAINEL DE INSUMOS
// =========================================================

function mostrarPainelInsumos() {

    if (painelInsumos)
        painelInsumos.classList.remove("oculto");

    if (painelReceitas)
        painelReceitas.classList.add("oculto");

    document
        .getElementById("subMenuInsumos")
        ?.classList.add("ativo");

    document
        .getElementById("subMenuReceitas")
        ?.classList.remove("ativo");

    carregarInsumos();
}


// =========================================================
// PAINEL DE RECEITAS
// =========================================================

function mostrarPainelReceitas() {

    if (painelInsumos)
        painelInsumos.classList.add("oculto");

    if (painelReceitas)
        painelReceitas.classList.remove("oculto");

    document
        .getElementById("subMenuInsumos")
        ?.classList.remove("ativo");

    document
        .getElementById("subMenuReceitas")
        ?.classList.add("ativo");

    carregarReceitas();

}


// =========================================================
// EVENTOS DO MENU
// =========================================================

menuProdutos?.addEventListener(
    "click",
    mostrarProdutos
);

menuCusteamento?.addEventListener(
    "click",
    mostrarCusteamento
);

document
    .getElementById("subMenuInsumos")
    ?.addEventListener(
        "click",
        mostrarPainelInsumos
    );

document
    .getElementById("subMenuReceitas")
    ?.addEventListener(
        "click",
        mostrarPainelReceitas
    );
    // Carrega os insumos uma vez ao iniciar o módulo.
    // Isso alimenta também o seletor da composição das receitas.
    carregarInsumos();

    /* =====================================================
       FILTROS DE INSUMOS
    ===================================================== */

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


    /* =====================================================
       FILTRO DE RECEITAS
    ===================================================== */

    document.getElementById("buscaReceita")
        ?.addEventListener(
            "input",
            filtrarReceitas
        );

    const botaoNovaReceita =
        document.getElementById("novaReceita");

    if (botaoNovaReceita) {
        botaoNovaReceita.type = "button";
        botaoNovaReceita.onclick = () => {
            abrirModalReceita();
        };
    }


    /* =====================================================
       MODAL DE INSUMO
    ===================================================== */

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

});