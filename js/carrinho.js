const CHAVE_CARRINHO = "dlimp_carrinho";
const PEDIDO_MINIMO = 50;
const NUMERO_WHATSAPP = "5511920795544";

let carrinho = carregarCarrinhoSalvo();

function carregarCarrinhoSalvo() {
    try {
        const salvo = localStorage.getItem(CHAVE_CARRINHO);
        const lista = salvo ? JSON.parse(salvo) : [];
        return Array.isArray(lista)
            ? lista.filter(item => item && Number.isFinite(Number(item.id)) && Number.isFinite(Number(item.preco)) && Number.isFinite(Number(item.quantidade)))
            : [];
    } catch (erro) {
        console.error("Erro ao carregar carrinho:", erro);
        return [];
    }
}

function salvarCarrinho() {
    try {
        localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
    } catch (erro) {
        console.error("Erro ao salvar carrinho:", erro);
    }
}

function formatarValor(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcularTotalCarrinho() {
    return carrinho.reduce((total, item) => total + Number(item.preco) * Number(item.quantidade), 0);
}

function calcularQuantidadeCarrinho() {
    return carrinho.reduce((total, item) => total + Number(item.quantidade), 0);
}

function encontrarProduto(id) {
    if (typeof produtos === "undefined" || !Array.isArray(produtos)) return null;
    return produtos.find(produto => Number(produto.id) === Number(id)) || null;
}

function adicionarCarrinho(id) {
    const produto = encontrarProduto(id);
    if (!produto) {
        alert("Produto não encontrado.");
        return;
    }

    const existente = carrinho.find(item => Number(item.id) === Number(id));
    if (existente) existente.quantidade += 1;
    else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: Number(produto.preco),
            imagem: produto.imagem,
            quantidade: 1
        });
    }

    salvarCarrinho();
    atualizarCarrinho();
    if (typeof mostrarToast === "function") mostrarToast(`${produto.nome} adicionado ao carrinho`);
}

function removerCarrinho(id) {
    const existente = carrinho.find(item => Number(item.id) === Number(id));
    if (!existente) return;

    existente.quantidade -= 1;
    if (existente.quantidade <= 0) carrinho = carrinho.filter(item => Number(item.id) !== Number(id));

    salvarCarrinho();
    atualizarCarrinho();
}

function excluirItemCarrinho(id) {
    carrinho = carrinho.filter(item => Number(item.id) !== Number(id));
    salvarCarrinho();
    atualizarCarrinho();
    if (typeof mostrarToast === "function") mostrarToast("Produto removido do carrinho");
}

function limparTodoOCarrinho() {
    if (carrinho.length === 0) return;
    if (!confirm("Tem certeza que deseja remover todos os itens do carrinho?")) return;

    carrinho = [];
    salvarCarrinho();
    atualizarCarrinho();
    voltarParaCarrinho();
    if (typeof fecharModalCarrinho === "function") fecharModalCarrinho();
}

function abrirCheckout() {
    const total = calcularTotalCarrinho();

    if (carrinho.length === 0) {
        alert("Seu carrinho está vazio.");
        return;
    }

    if (total < PEDIDO_MINIMO) {
        alert(`⚠️ O pedido mínimo para entrega é ${formatarValor(PEDIDO_MINIMO)}.\n\nAdicione mais ${formatarValor(PEDIDO_MINIMO - total)} em produtos.`);
        return;
    }

    document.getElementById("telaCarrinho").style.display = "none";
    document.getElementById("telaCheckout").style.display = "block";
    document.querySelector(".modal-content")?.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => document.getElementById("entregaNome")?.focus(), 250);
}

function voltarParaCarrinho() {
    const telaCarrinho = document.getElementById("telaCarrinho");
    const telaCheckout = document.getElementById("telaCheckout");
    if (telaCarrinho) telaCarrinho.style.display = "block";
    if (telaCheckout) telaCheckout.style.display = "none";
}

function atualizarCarrinho() {
    const totalItens = calcularQuantidadeCarrinho();
    const totalValor = calcularTotalCarrinho();
    const qtdItens = document.getElementById("qtdItens");
    const valorTotal = document.getElementById("valorTotal");
    const totalCarrinho = document.getElementById("totalCarrinho");
    const avisoMinimo = document.getElementById("avisoPedidoMinimo");
    const botaoCheckout = document.getElementById("btnCheckout");
    const botaoLimpar = document.getElementById("btnLimparCarrinho");

    if (qtdItens) qtdItens.textContent = totalItens === 1 ? "1 item" : `${totalItens} itens`;
    if (valorTotal) valorTotal.textContent = formatarValor(totalValor);
    if (totalCarrinho) totalCarrinho.textContent = `Total: ${formatarValor(totalValor)}`;

    if (avisoMinimo) {
        if (totalValor > 0 && totalValor < PEDIDO_MINIMO) {
            avisoMinimo.style.display = "block";
            avisoMinimo.innerHTML = `Faltam <strong>${formatarValor(PEDIDO_MINIMO - totalValor)}</strong> para o pedido mínimo de entrega.`;
        } else avisoMinimo.style.display = "none";
    }

    if (botaoCheckout) {
        botaoCheckout.disabled = carrinho.length === 0;
        if (carrinho.length === 0) botaoCheckout.textContent = "Adicione produtos";
        else if (totalValor < PEDIDO_MINIMO) botaoCheckout.textContent = `Faltam ${formatarValor(PEDIDO_MINIMO - totalValor)}`;
        else botaoCheckout.textContent = "Confirmar e informar endereço";
    }

    if (botaoLimpar) botaoLimpar.style.display = carrinho.length ? "block" : "none";

    atualizarContadorCarrinho(totalItens);
    renderizarCarrinho();
}

function atualizarContadorCarrinho(totalItens) {
    const botao = document.getElementById("abrirCarrinho");
    if (!botao) return;

    let contador = botao.querySelector(".contador-carrinho");
    if (!contador) {
        contador = document.createElement("span");
        contador.className = "contador-carrinho";
        botao.appendChild(contador);
    }

    contador.textContent = totalItens > 99 ? "99+" : totalItens;
    contador.style.display = totalItens > 0 ? "flex" : "none";
}

function renderizarCarrinho() {
    const lista = document.getElementById("itensCarrinho");
    if (!lista) return;

    if (carrinho.length === 0) {
        lista.innerHTML = `<div class="carrinho-vazio"><span class="carrinho-vazio-icone">🛒</span><strong>Seu carrinho está vazio</strong><p>Adicione os produtos que deseja pedir.</p></div>`;
        return;
    }

    lista.innerHTML = carrinho.map(item => {
        const subtotal = Number(item.preco) * Number(item.quantidade);
        return `
            <div class="item-carrinho-linha">
                <div class="item-carrinho-dados">
                    <strong>${item.nome}</strong>
                    <span>${formatarValor(item.preco)} cada</span>
                    <button type="button" class="btn-excluir-item" data-excluir-id="${item.id}">Remover</button>
                </div>
                <div class="item-carrinho-acoes">
                    <strong class="item-subtotal">${formatarValor(subtotal)}</strong>
                    <div class="controle-quantidade">
                        <button type="button" data-remover-id="${item.id}" aria-label="Diminuir quantidade">−</button>
                        <span>${item.quantidade}</span>
                        <button type="button" data-adicionar-carrinho-id="${item.id}" aria-label="Aumentar quantidade">+</button>
                    </div>
                </div>
            </div>`;
    }).join("");
}

function finalizarPedido() {
    const nome = document.getElementById("entregaNome")?.value.trim();
    const rua = document.getElementById("entregaRua")?.value.trim();
    const cidade = document.getElementById("entregaCidade")?.value.trim();
    const pagamento = document.getElementById("entregaPagamento")?.value.trim();
    const total = calcularTotalCarrinho();

    if (carrinho.length === 0) {
        alert("Seu carrinho está vazio.");
        voltarParaCarrinho();
        return;
    }

    if (total < PEDIDO_MINIMO) {
        alert(`O pedido mínimo para entrega é ${formatarValor(PEDIDO_MINIMO)}.`);
        voltarParaCarrinho();
        return;
    }

    if (!nome || !rua || !cidade || !pagamento) {
        alert("📌 Preencha nome, endereço, cidade/bairro e pagamento.");
        return;
    }

    let mensagem = "🛒 *NOVO PEDIDO D'LIMP*\n\n";
    carrinho.forEach(item => {
        const subtotal = Number(item.preco) * Number(item.quantidade);
        mensagem += `• ${item.quantidade}x ${item.nome}\n  ${formatarValor(subtotal)}\n`;
    });

    mensagem += "\n━━━━━━━━━━━━━━━━━━";
    mensagem += `\n💰 *TOTAL: ${formatarValor(total)}*`;
    mensagem += "\n━━━━━━━━━━━━━━━━━━";
    mensagem += "\n\n📍 *DADOS PARA ENTREGA*";
    mensagem += `\n👤 Nome: ${nome}`;
    mensagem += `\n🏠 Endereço: ${rua}`;
    mensagem += `\n🏙️ Cidade/Bairro: ${cidade}`;
    mensagem += `\n💳 Pagamento: ${pagamento}`;
    mensagem += "\n\nAguardo a confirmação do pedido e do valor da entrega.";

    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
    const novaJanela = window.open(url, "_blank");
    if (!novaJanela) window.location.href = url;
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnCheckout")?.addEventListener("click", abrirCheckout);
    document.getElementById("btnLimparCarrinho")?.addEventListener("click", limparTodoOCarrinho);
    document.getElementById("btnEnviarPedido")?.addEventListener("click", finalizarPedido);
    document.getElementById("btnVoltarCarrinho")?.addEventListener("click", voltarParaCarrinho);

    document.getElementById("itensCarrinho")?.addEventListener("click", evento => {
        const excluir = evento.target.closest("[data-excluir-id]");
        if (excluir) return excluirItemCarrinho(excluir.dataset.excluirId);
        const remover = evento.target.closest("[data-remover-id]");
        if (remover) return removerCarrinho(remover.dataset.removerId);
        const adicionar = evento.target.closest("[data-adicionar-carrinho-id]");
        if (adicionar) adicionarCarrinho(adicionar.dataset.adicionarCarrinhoId);
    });

    atualizarCarrinho();
});

window.adicionarCarrinho = adicionarCarrinho;
window.removerCarrinho = removerCarrinho;
window.excluirItemCarrinho = excluirItemCarrinho;
window.limparTodoOCarrinho = limparTodoOCarrinho;
window.abrirCheckout = abrirCheckout;
window.voltarParaCarrinho = voltarParaCarrinho;
window.finalizarPedido = finalizarPedido;
window.atualizarCarrinho = atualizarCarrinho;
