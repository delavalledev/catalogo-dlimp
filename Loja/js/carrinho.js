let carrinho = [];

// Função para adicionar um produto ao carrinho
function adicionarCarrinho(id){
    const produto = produtos.find(p => p.id === id);
    const existente = carrinho.find(p => p.id === id);
    if(existente){ existente.quantidade++; } else {
        carrinho.push({ ...produto, quantidade: 1 });
    }
    atualizarCarrinho();
}

// Função para diminuir a quantidade ou remover do carrinho
function removerCarrinho(id) {
    const existente = carrinho.find(p => p.id === id);
    if (existente) {
        existente.quantidade--;
        if (existente.quantidade <= 0) { carrinho = carrinho.filter(p => p.id !== id); }
    }
    atualizarCarrinho();
}

// Função para limpar completamente o carrinho
function limparTodoOCarrinho() {
    if (confirm("Tem certeza que deseja remover todos os itens do carrinho?")) {
        carrinho = [];
        atualizarCarrinho();
        document.getElementById('modalCarrinho').classList.add('hidden');
    }
}

// --- CONTROLE DE TELAS (Navegação do Modal) ---
function abrirCheckout() {
    let total = parseFloat(document.getElementById("totalCarrinho").innerText.replace("Total: R$ ", "").replace(",", "."));
    
    // Regra do Pedido Mínimo
    if (total < 50.00) {
        alert("⚠️ O pedido mínimo para entrega é R$ 50,00.");
        return;
    }

    document.getElementById('telaCarrinho').style.display = 'none';
    document.getElementById('telaCheckout').style.display = 'block';
}

function voltarParaCarrinho() {
    document.getElementById('telaCarrinho').style.display = 'block';
    document.getElementById('telaCheckout').style.display = 'none';
}

// Função principal que atualiza valores e aplica a REGRA DE R$ 50,00
function atualizarCarrinho(){
    let totalItens = 0;
    let totalValor = 0;

    carrinho.forEach(item => {
        totalItens += item.quantidade;
        totalValor += item.preco * item.quantidade;
    });

    document.getElementById("qtdItens").innerText = `${totalItens} itens`;
    document.getElementById("valorTotal").innerText = `R$ ${totalValor.toFixed(2).replace(".", ",")}`;
    document.getElementById("totalCarrinho").innerText = `Total: R$ ${totalValor.toFixed(2).replace(".", ",")}`;

    // Lógica do aviso de pedido mínimo
    const avisoMinimo = document.getElementById('avisoPedidoMinimo');
    if (totalValor > 0 && totalValor < 50.00) {
        avisoMinimo.style.display = 'block';
    } else {
        avisoMinimo.style.display = 'none';
    }

    renderizarCarrinho();
}

function renderizarCarrinho(){
    const lista = document.getElementById("itensCarrinho");
    lista.innerHTML = "";
    carrinho.forEach(item => {
        const subtotal = item.preco * item.quantidade;
        lista.innerHTML += `
        <div class="item-carrinho-linha" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f1f1;">
            <div style="flex: 1;"><strong style="font-size: 0.95rem;">${item.nome}</strong><br><span style="font-size: 0.85rem; color: #666;">${item.quantidade}x R$ ${item.preco.toFixed(2).replace(".", ",")}</span></div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: bold;">R$ ${subtotal.toFixed(2).replace(".", ",")}</span>
                <button onclick="removerCarrinho(${item.id})" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px;">➖</button>
                <button onclick="adicionarCarrinho(${item.id})" style="background:#28a745; color:white; border:none; padding:5px 10px; border-radius:4px;">➕</button>
            </div>
        </div>`;
    });
}

// --- FUNÇÃO FINAL DE ENVIO ---
function finalizarPedido() {
    let nome = document.getElementById('entregaNome').value.trim();
    let rua = document.getElementById('entregaRua').value.trim();
    let cidade = document.getElementById('entregaCidade').value.trim();
    let pagamento = document.getElementById('entregaPagamento').value;
    
    if (!nome || !rua || !cidade) {
        alert("📌 Por favor, preencha seu Nome, Rua e Cidade!");
        return;
    }

    let msg = "🛒 *NOVO PEDIDO D'LIMP*\n\n";
    carrinho.forEach(item => {
        msg += `${item.nome} x${item.quantidade} - R$ ${(item.preco * item.quantidade).toFixed(2).replace('.',',')}\n`;
    });
    
    msg += `\n📍 *DADOS DE ENTREGA:*`;
    msg += `\n👤 Nome: ${nome}`;
    msg += `\n🏠 Endereço: ${rua}`;
    msg += `\n🏙️ Cidade/Bairro: ${cidade}`;
    msg += `\n💳 Pagamento: ${pagamento}`;
    msg += `\n\n💰 *TOTAL:* ${document.getElementById("valorTotal").innerText}`;

    let numeroLoja = "5511920795544"; 
    let url = `https://api.whatsapp.com/send?phone=${numeroLoja}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// Vincula as funções
window.adicionarCarrinho = adicionarCarrinho;
window.removerCarrinho = removerCarrinho;
window.limparTodoOCarrinho = limparTodoOCarrinho;
window.abrirCheckout = abrirCheckout;
window.voltarParaCarrinho = voltarParaCarrinho;
window.finalizarPedido = finalizarPedido;