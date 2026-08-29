$ErrorActionPreference = "Stop"

$Raiz = "C:\catalogo-dlimp"
$Api = "http://127.0.0.1:3000"
$ArquivoCatalogo = "$Raiz\data\produtos-online.json"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "       SINCRONIZADOR D'LIMP" -ForegroundColor Cyan
Write-Host "       PRIMEIRA EQUALIZACAO" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ==================================================
# API
# ==================================================

Write-Host "Consultando Sys-On..." -ForegroundColor Yellow

try {
    $resposta = Invoke-RestMethod "$Api/produtos?v=$(Get-Date -Format 'HHmmss')"
    $SysOn = @($resposta)
}
catch {
    Write-Host ""
    Write-Host "ERRO AO CONSULTAR API." -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host "OK - $($SysOn.Count) produtos no Sys-On" -ForegroundColor Green

# PROTEÇÃO CRÍTICA
if ($SysOn.Count -lt 200) {
    Write-Host ""
    Write-Host "ERRO DE SEGURANCA: API RETORNOU MENOS DE 200 PRODUTOS." -ForegroundColor Red
    Write-Host "NENHUM DADO SERÁ ALTERADO."
    Write-Host ""
    exit 1
}

# ==================================================
# CATÁLOGO
# ==================================================

if (-not (Test-Path $ArquivoCatalogo)) {
    Write-Host "ERRO: catálogo não encontrado." -ForegroundColor Red
    exit 1
}

try {
    $respostaCatalogo = Get-Content $ArquivoCatalogo -Raw |
        ConvertFrom-Json

    $Catalogo = @($respostaCatalogo)
}
catch {
    Write-Host "ERRO AO LER CATALOGO." -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host "OK - $($Catalogo.Count) produtos no catalogo" -ForegroundColor Green
Write-Host ""

if ($Catalogo.Count -lt 200) {
    Write-Host ""
    Write-Host "ERRO DE SEGURANCA: CATALOGO RETORNOU MENOS DE 200 PRODUTOS." -ForegroundColor Red
    Write-Host "NENHUM DADO SERÁ ALTERADO."
    Write-Host ""
    exit 1
}

# ==================================================
# BACKUP
# ==================================================

$Backup = "$Raiz\data\produtos-online.antes-primeira-sincronizacao-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

Copy-Item $ArquivoCatalogo $Backup -Force

Write-Host "Backup criado:" -ForegroundColor DarkGray
Write-Host $Backup -ForegroundColor DarkGray
Write-Host ""

# ==================================================
# MAPAS
# ==================================================

$MapaSysOn = @{}
$MapaCatalogo = @{}

foreach ($produto in $SysOn) {
    $MapaSysOn[[string]$produto.id] = $produto
}

foreach ($produto in $Catalogo) {
    $MapaCatalogo[[string]$produto.id] = $produto
}

# ==================================================
# COMPARAÇÃO
# ==================================================

$Alteracoes = @()
$SomenteSysOn = @()
$SomenteCatalogo = @()

foreach ($id in $MapaSysOn.Keys) {

    if (-not $MapaCatalogo.ContainsKey($id)) {
        $SomenteSysOn += $MapaSysOn[$id]
        continue
    }

    $sys = $MapaSysOn[$id]
    $cat = $MapaCatalogo[$id]

    $mudancas = @()

    # ----------------------------------------------
    # NOME
    # ----------------------------------------------

    $nomeSys = [string]$sys.descricao
    $nomeCat = [string]$cat.descricao

    if ($nomeSys -ne $nomeCat) {
        $mudancas += "NOME: $nomeCat -> $nomeSys"
    }

    # ----------------------------------------------
    # PREÇO
    # PRIMEIRA SINCRONIZAÇÃO:
    # MAIOR PREÇO É MANTIDO
    # ----------------------------------------------

    $precoSys = 0
    $precoCat = 0

    if ($null -ne $sys.preco_venda) {
        $precoSys = [decimal]$sys.preco_venda
    }
    elseif ($null -ne $sys.preco) {
        $precoSys = [decimal]$sys.preco
    }

    if ($null -ne $cat.preco_venda) {
        $precoCat = [decimal]$cat.preco_venda
    }
    elseif ($null -ne $cat.preco) {
        $precoCat = [decimal]$cat.preco
    }

    $precoFinal = [Math]::Max($precoSys, $precoCat)

    if ($precoSys -ne $precoCat) {
        $mudancas += "PREÇO: R$ $precoCat -> R$ $precoFinal"
    }

    # ----------------------------------------------
    # ESTOQUE
    # ----------------------------------------------

    $estoqueSys = 0
    $estoqueCat = 0

    if ($null -ne $sys.estoque) {
        $estoqueSys = [decimal]$sys.estoque
    }

    if ($null -ne $cat.estoque) {
        $estoqueCat = [decimal]$cat.estoque
    }

    if ($estoqueSys -ne $estoqueCat) {
        $mudancas += "ESTOQUE: $estoqueCat -> $estoqueSys"
    }

    # ----------------------------------------------
    # DISPONIBILIDADE
    #
    # NAO DEPENDE DO ESTOQUE
    # ----------------------------------------------

    $foraDeUso = ([string]$sys.ForaDeUso).Trim().ToUpper()

    if ($foraDeUso -eq "SIM") {
        $disponivelSys = $false
    }
    else {
        $disponivelSys = $true
    }

    $disponivelCat = [bool]$cat.disponivel

    if ($disponivelSys -ne $disponivelCat) {
        $mudancas += "DISPONIBILIDADE: $disponivelCat -> $disponivelSys"
    }

    if ($mudancas.Count -gt 0) {

        $Alteracoes += [PSCustomObject]@{
            id = $id
            descricao = $nomeSys
            mudancas = $mudancas
        }
    }
}

foreach ($id in $MapaCatalogo.Keys) {

    if (-not $MapaSysOn.ContainsKey($id)) {
        $SomenteCatalogo += $MapaCatalogo[$id]
    }
}

# ==================================================
# RESULTADO
# ==================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "              RESULTADO" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Sys-On:              $($SysOn.Count)"
Write-Host "Catalogo:            $($Catalogo.Count)"
Write-Host "Somente no Sys-On:   $($SomenteSysOn.Count)"
Write-Host "Somente no catalogo: $($SomenteCatalogo.Count)"
Write-Host "Com diferencas:      $($Alteracoes.Count)"
Write-Host ""

if ($Alteracoes.Count -gt 0) {

    Write-Host "--------------------------------------------"
    Write-Host "DIFERENCAS ENCONTRADAS"
    Write-Host "--------------------------------------------"
    Write-Host ""

    foreach ($alteracao in $Alteracoes) {

        Write-Host "ID $($alteracao.id) - $($alteracao.descricao)" -ForegroundColor Yellow

        foreach ($mudanca in $alteracao.mudancas) {
            Write-Host "   $mudanca"
        }

        Write-Host ""
    }
}

# ==================================================
# PRODUTOS AUSENTES
# ==================================================

if ($SomenteSysOn.Count -gt 0) {

    Write-Host "--------------------------------------------"
    Write-Host "ATENCAO: PRODUTOS AUSENTES NO CATALOGO"
    Write-Host "--------------------------------------------"
    Write-Host ""

    foreach ($produto in $SomenteSysOn) {
        Write-Host "ID $($produto.id) - $($produto.descricao)"
    }

    Write-Host ""

    Write-Host "NENHUM DADO FOI ALTERADO." -ForegroundColor Red
    Write-Host "Corrija a quantidade de produtos antes de continuar."
    Write-Host ""

    exit 1
}

if ($SomenteCatalogo.Count -gt 0) {

    Write-Host "--------------------------------------------"
    Write-Host "ATENCAO: PRODUTOS AUSENTES NO SYS-ON"
    Write-Host "--------------------------------------------"
    Write-Host ""

    foreach ($produto in $SomenteCatalogo) {
        Write-Host "ID $($produto.id) - $($produto.descricao)"
    }

    Write-Host ""
}

# ==================================================
# APLICA
# ==================================================

if ($Alteracoes.Count -eq 0) {

    Write-Host "Nenhuma diferença encontrada." -ForegroundColor Green
    Write-Host "Nenhum dado foi alterado."
    Write-Host ""
    exit 0
}

Write-Host "Aplicando alterações..." -ForegroundColor Yellow
Write-Host ""

foreach ($alteracao in $Alteracoes) {

    $id = [string]$alteracao.id

    $sys = $MapaSysOn[$id]
    $cat = $MapaCatalogo[$id]

    # NOME
    $cat.descricao = [string]$sys.descricao

    # PREÇO - MAIOR VALOR SOMENTE NESTA PRIMEIRA SINCRONIZAÇÃO
    $precoSys = 0
    $precoCat = 0

    if ($null -ne $sys.preco_venda) {
        $precoSys = [decimal]$sys.preco_venda
    }
    elseif ($null -ne $sys.preco) {
        $precoSys = [decimal]$sys.preco
    }

    if ($null -ne $cat.preco_venda) {
        $precoCat = [decimal]$cat.preco_venda
    }
    elseif ($null -ne $cat.preco) {
        $precoCat = [decimal]$cat.preco
    }

    $precoFinal = [Math]::Max($precoSys, $precoCat)

    $cat.preco_venda = [double]$precoFinal
    $cat.preco = [double]$precoFinal

    # ESTOQUE
    if ($null -ne $sys.estoque) {
        $cat.estoque = [double]([decimal]$sys.estoque)
    }
    else {
        $cat.estoque = 0
    }

    # DISPONIBILIDADE
    $foraDeUso = ([string]$sys.ForaDeUso).Trim().ToUpper()

    if ($foraDeUso -eq "SIM") {
        $cat.disponivel = $false
    }
    else {
        $cat.disponivel = $true
    }

    # FOTO: NAO ALTERA
}

# ==================================================
# SALVA
# ==================================================

$Catalogo |
    ConvertTo-Json -Depth 20 |
    Set-Content -Encoding UTF8 $ArquivoCatalogo

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "     PRIMEIRA SINCRONIZACAO CONCLUIDA" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Produtos atualizados: $($Alteracoes.Count)"
Write-Host ""
Write-Host "REGRAS APLICADAS:"
Write-Host "- Maior preço foi mantido nesta primeira sincronização."
Write-Host "- Estoque veio somente do Sys-On."
Write-Host "- Estoque do Sys-On NÃO foi alterado."
Write-Host "- Estoque zero NÃO torna produto indisponível."
Write-Host "- ForaDeUso controla disponibilidade."
Write-Host "- Fotos NÃO foram alteradas."
Write-Host ""
Write-Host "Backup:"
Write-Host $Backup
Write-Host ""
