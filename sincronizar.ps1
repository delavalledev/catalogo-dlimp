$ErrorActionPreference = "Stop"

$repo = "C:\catalogo-dlimp"

$apiUrl = "http://127.0.0.1:3000/produtos"

$arquivoJson = "$repo\data\produtos-online.json"
$arquivoAjustes = "$repo\data\ajustes-produtos.json"

$pastaFotosProjeto = "$repo\img\produtos"
$pastaFotosSysOn = "C:\SysOnPDV-Pro\imgProdutos"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " SINCRONIZADOR D'LIMP" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# --------------------------------------------------
# 1. Confere API do Sys-On
# --------------------------------------------------

try {
    $produtosSysOn = Invoke-RestMethod $apiUrl -TimeoutSec 15
}
catch {
    Write-Host "ERRO: API do Sys-On não está disponível na porta 3000." -ForegroundColor Red
    Write-Host "Abra primeiro: node C:\catalogo-dlimp\api\server.js"
    exit 1
}

Write-Host "Produtos ativos no Sys-On: $($produtosSysOn.Count)"

# --------------------------------------------------
# 2. Carrega ajustes do Admin
# --------------------------------------------------

$ajustes = @{}

if (Test-Path $arquivoAjustes) {

    $objAjustes =
        Get-Content $arquivoAjustes -Raw |
        ConvertFrom-Json

    foreach ($prop in $objAjustes.PSObject.Properties) {
        $ajustes[$prop.Name] = $prop.Value
    }
}

# --------------------------------------------------
# 3. Monta catálogo novo
# --------------------------------------------------

$catalogoNovo = @()

foreach ($produto in $produtosSysOn) {

    $id = [string]$produto.id

    $imagemProjeto = "img/produtos/sem_imagem.png"

    $jpg = Join-Path $pastaFotosProjeto "$id.jpg"
    $png = Join-Path $pastaFotosProjeto "$id.png"
    $webp = Join-Path $pastaFotosProjeto "$id.webp"

    if (Test-Path $jpg) {
        $imagemProjeto = "img/produtos/$id.jpg"
    }
    elseif (Test-Path $png) {
        $imagemProjeto = "img/produtos/$id.png"
    }
    elseif (Test-Path $webp) {
        $imagemProjeto = "img/produtos/$id.webp"
    }

    $item = [ordered]@{
        id          = [int]$produto.id
        descricao   = [string]$produto.descricao
        preco_venda = [double]$produto.preco
        preco       = [double]$produto.preco
        estoque     = [double]$produto.estoque
        disponivel  = [bool]$produto.disponivel
        ForaDeUso   = $produto.ForaDeUso
        imagem      = $imagemProjeto
    }

    # Ajustes do Admin continuam separados e não são apagados.
    $catalogoNovo += [PSCustomObject]$item
}

# --------------------------------------------------
# 4. Backup do JSON atual
# --------------------------------------------------

$backupJson =
    "$repo\data\produtos-online-backup-" +
    (Get-Date -Format "yyyyMMdd-HHmmss") +
    ".json"

Copy-Item $arquivoJson $backupJson -Force

# --------------------------------------------------
# 5. Salva novo produtos-online.json
# --------------------------------------------------

$json = $catalogoNovo | ConvertTo-Json -Depth 10

$utf8SemBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $arquivoJson,
    $json,
    $utf8SemBom
)

Write-Host ""
Write-Host "Catalogo atualizado: $($catalogoNovo.Count) produtos" -ForegroundColor Green

# --------------------------------------------------
# 6. Copia fotos DO projeto PARA o Sys-On
# --------------------------------------------------

New-Item -ItemType Directory -Force -Path $pastaFotosSysOn | Out-Null

$copiadas = 0

Get-ChildItem $pastaFotosProjeto -File |
Where-Object {
    $_.Extension.ToLower() -in ".jpg", ".jpeg", ".png", ".webp" -and
    $_.Name -ne "sem_imagem.png"
} |
ForEach-Object {

    $destino = Join-Path $pastaFotosSysOn $_.Name

    Copy-Item $_.FullName $destino -Force

    $copiadas++
}

Write-Host "Fotos sincronizadas para o Sys-On: $copiadas"

# --------------------------------------------------
# 7. Resumo
# --------------------------------------------------

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " SINCRONIZACAO CONCLUIDA" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan

Write-Host "Sys-On:  $($produtosSysOn.Count)"
Write-Host "Catalogo: $($catalogoNovo.Count)"
Write-Host ""
Write-Host "Backup criado:"
Write-Host $backupJson
Write-Host ""
Write-Host "Nada foi publicado no GitHub."
Write-Host "Confira o site local e depois use o botao 'Publicar no site'."
Write-Host ""