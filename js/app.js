const container = document.getElementById("produtos");
let categoriaAtual = "todos"; // Controla qual categoria está sendo vista

function carregarProdutos(listaProdutos) {
    container.innerHTML = "";
    
    if (!listaProdutos || listaProdutos.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px; color: #777;">Nenhum produto encontrado.</p>`;
        return;
    }

    listaProdutos.forEach(produto => {
        container.innerHTML += `
        <div class="produto">
            <img src="${produto.imagem}" alt="${produto.nome}">
            <div class="produto-info">
                <h2>${produto.nome}</h2>
                <p class="preco">R$ ${produto.preco.toFixed(2).replace(".", ",")}</p>
                <button class="btnAdicionar" onclick="adicionarCarrinho(${produto.id})">
                    Adicionar
                </button>
            </div>
        </div>
        `;
    });
}

// NOVA FUNÇÃO: Filtra os itens quando clica no botão do topo
function filtrarPorCategoria(categoria) {
    categoriaAtual = categoria;
    
    // Atualiza o visual dos botões no topo (muda a cor do ativo)
    const botoes = document.querySelectorAll('.btn-cat');
    botoes.forEach(btn => btn.classList.remove('ativo'));
    
    // Procura o botão clicado para colocar a classe ativa
    event.target.classList.add('ativo');

    // Limpa o campo de busca para começar um filtro limpo
    document.getElementById("busca").value = "";

    aplicarFiltros();
}

// Junta a busca por texto com o filtro por categorias
function aplicarFiltros() {
    const termo = document.getElementById("busca").value.toLowerCase();
    
    let resultado = produtos;

    // 1. Filtra por categoria se não for "todos"
    if (categoriaAtual !== "todos") {
        resultado = resultado.filter(p => p.categoria === categoriaAtual);
    }

    // 2. Filtra por texto digitado
    if (termo) {
        resultado = resultado.filter(p => p.nome.toLowerCase().includes(termo));
    }

    carregarProdutos(resultado);
}

// Inicializa o sistema ao carregar a página
window.onload = () => {
    if (typeof produtos !== 'undefined') {
        carregarProdutos(produtos);

        // Ouve a digitação na caixa de busca aplicando as regras combinadas
        document.getElementById("busca").oninput = () => {
            aplicarFiltros();
        };
    } else {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px; color: red;">Erro ao carregar os produtos.</p>`;
    }
};

// Controle do Modal
const modal = document.getElementById("modalCarrinho");
document.getElementById("abrirCarrinho").onclick = () => modal.classList.remove("hidden");
document.getElementById("fecharCarrinho").onclick = () => modal.classList.add("hidden");

// Enviar WhatsApp
document.getElementById("btnWhatsapp").onclick = () => {
    if (!carrinho || carrinho.length === 0) {
        alert("Seu carrinho está vazio!");
        return;
    }

    let texto = "Olá, gostaria de fazer o seguinte pedido:%0A%0A";
    let totalPedido = 0;

    carrinho.forEach(item => {
        const subtotal = item.preco * item.quantidade;
        totalPedido += subtotal;
        texto += `*${item.quantidade}x* ${item.nome} - (R$ ${subtotal.toFixed(2).replace(".", ",")})%0A`;
    });

    texto += `%0A*Total do Pedido:* R$ ${totalPedido.toFixed(2).replace(".", ",")}`;
    window.open(`https://wa.me/5511920795544?text=${texto}`, "_blank");
};

// Exporta a função para o HTML encontrar o clique das categorias
window.filtrarPorCategoria = filtrarPorCategoria;