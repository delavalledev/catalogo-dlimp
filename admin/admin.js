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

