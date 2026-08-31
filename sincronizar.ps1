$ErrorActionPreference = "Stop"

$Raiz = "C:\catalogo-dlimp"
$Api = "http://127.0.0.1:3000"
$AdminApi = "http://127.0.0.1:3100"

$ArquivoCatalogo = "$Raiz\data\produtos-online.json"
$ArquivoEstado = "$Raiz\data\estado-sincronizacao.json"

$PastaSiteFotos = "$Raiz\img\produtos"
$PastaSysFotos = "C:\SysOnPDV-Pro\imgProdutos"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "        SINCRONIZADOR D'LIMP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# FUNÇÕES
# ============================================================

function RemoverAcentos($texto) {

    if ($null -eq $texto) {
        return ""
    }

    $normalizado = $texto.Normalize(
        [System.Text.NormalizationForm]::FormD
    )

    $resultado = New-Object System.Text.StringBuilder

    foreach ($c in $normalizado.ToCharArray()) {

        if (
            [Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne
            [Globalization.UnicodeCategory]::NonSpacingMark
        ) {
            [void]$resultado.Append($c)
        }
    }

    return $resultado.ToString().Normalize(
        [System.Text.NormalizationForm]::FormC
    )
}

function ValorPreco($produto) {

    if ($null -ne $produto.preco_venda) {
        return [decimal]$produto.preco_venda
    }

    if ($null -ne $produto.preco) {
        return [decimal]$produto.preco
    }

    return 0
}

function HashArquivo($arquivo) {

    if (-not (Test-Path $arquivo)) {
        return ""
    }

    return (Get-FileHash $arquivo -Algorithm SHA256).Hash
}

function CopiarFoto($origem, $destino) {

    if (-not (Test-Path $origem)) {
        return $false
    }

    $pastaDestino = Split-Path $destino -Parent

    if (-not (Test-Path $pastaDestino)) {
        New-Item -ItemType Directory -Path $pastaDestino -Force | Out-Null
    }

    Copy-Item $origem $destino -Force

    return $true
}

# ============================================================
# GARANTE PASTAS
# ============================================================

New-Item -ItemType Directory -Path $PastaSiteFotos -Force | Out-Null
New-Item -ItemType Directory -Path $PastaSysFotos -Force | Out-Null

# ============================================================
# CONSULTA SYS-ON
# ============================================================

Write-Host "Consultando Sys-On..." -ForegroundColor Yellow

try {

    $resposta = Invoke-RestMethod "$Api/produtos?v=$(Get-Date -Format 'HHmmss')"
    $SysOn = @($resposta)

}
catch {

    Write-Host ""
    Write-Host "ERRO AO CONSULTAR API 3000." -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host "OK - $($SysOn.Count) produtos no Sys-On" -ForegroundColor Green

if ($SysOn.Count -lt 200) {

    Write-Host ""
    Write-Host "ERRO DE SEGURANCA: MENOS DE 200 PRODUTOS." -ForegroundColor Red
    Write-Host "NENHUM DADO ALTERADO."
    exit 1
}

# ============================================================
# LÊ CATÁLOGO
# ============================================================

if (-not (Test-Path $ArquivoCatalogo)) {

    Write-Host "ERRO: catálogo não encontrado." -ForegroundColor Red
    exit 1
}

try {

    # O produtos-online.json desta instalação pode estar em mais de um
    # formato. O formato atual é um array contendo um objeto com:
    #   value = [ produtos... ]
    #   Count = quantidade
    #
    # Também aceitamos:
    #   { "value": [ ... ], "Count": 261 }
    # ou diretamente:
    #   [ { produto }, { produto }, ... ]
    #
    # IMPORTANTE: mantemos o envelope original ao salvar para não quebrar
    # o formato que o site já utiliza.

    $JsonRaw = Get-Content $ArquivoCatalogo -Raw
    $JsonParsed = $JsonRaw | ConvertFrom-Json

    $Catalogo = @()
    $FormatoCatalogo = "direto"
    $EnvelopeCatalogo = $null

    # Formato atual: [ { value: [produtos], Count: 261 } ]
    if ($JsonParsed -is [System.Array] -and $JsonParsed.Count -eq 1 -and
        $null -ne $JsonParsed[0].PSObject.Properties["value"] -and
        $JsonParsed[0].value -is [System.Array]) {

        $FormatoCatalogo = "array-envelope"
        $EnvelopeCatalogo = $JsonParsed[0]
        $Catalogo = @($EnvelopeCatalogo.value)
    }
    # Formato: { value: [produtos], Count: 261 }
    elseif ($null -ne $JsonParsed.PSObject.Properties["value"] -and
            $JsonParsed.value -is [System.Array]) {

        $FormatoCatalogo = "object-envelope"
        $EnvelopeCatalogo = $JsonParsed
        $Catalogo = @($EnvelopeCatalogo.value)
    }
    # Formato: { produtos: [produtos], Count: 261 }
    elseif ($null -ne $JsonParsed.PSObject.Properties["produtos"] -and
            $JsonParsed.produtos -is [System.Array]) {

        $FormatoCatalogo = "object-produtos"
        $EnvelopeCatalogo = $JsonParsed
        $Catalogo = @($EnvelopeCatalogo.produtos)
    }
    # Formato direto: [ { produto }, { produto }, ... ]
    elseif ($JsonParsed -is [System.Array]) {

        $FormatoCatalogo = "direto"
        $Catalogo = @($JsonParsed)
    }
    else {

        throw "Estrutura do produtos-online.json não reconhecida."
    }

}
catch {

    Write-Host "ERRO AO LER CATALOGO." -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host "OK - $($Catalogo.Count) produtos no catálogo" -ForegroundColor Green
Write-Host "Formato do catálogo detectado: $FormatoCatalogo" -ForegroundColor DarkGray

if ($Catalogo.Count -lt 200) {

    Write-Host ""
    Write-Host "ERRO DE SEGURANCA: MENOS DE 200 PRODUTOS." -ForegroundColor Red
    Write-Host "NENHUM DADO ALTERADO."
    exit 1
}

# ============================================================
# BACKUP
# ============================================================

$Backup = "$Raiz\data\produtos-online.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

Copy-Item $ArquivoCatalogo $Backup -Force

Write-Host ""
Write-Host "Backup criado:"
Write-Host $Backup -ForegroundColor DarkGray
Write-Host ""

# ============================================================
# ESTADO DA ÚLTIMA SINCRONIZAÇÃO
# ============================================================

$Estado = @{}

if (Test-Path $ArquivoEstado) {

    try {

        $EstadoJson = Get-Content $ArquivoEstado -Raw |
            ConvertFrom-Json

        foreach ($p in @($EstadoJson.produtos)) {
            $Estado[[string]$p.id] = $p
        }

    }
    catch {

        Write-Host "AVISO: estado anterior inválido. Será recriado." -ForegroundColor Yellow
        $Estado = @{}
    }
}

# ============================================================
# MAPAS
# ============================================================

$MapaSys = @{}
$MapaSite = @{}

foreach ($p in $SysOn) {
    $MapaSys[[string]$p.id] = $p
}

foreach ($p in $Catalogo) {
    $MapaSite[[string]$p.id] = $p
}

# ============================================================
# PRODUTOS
# ============================================================

$Alterados = 0
$FotosEnviadas = 0
$FotosRecebidas = 0
$Conflitos = 0

foreach ($id in $MapaSys.Keys) {

    if (-not $MapaSite.ContainsKey($id)) {
        continue
    }

    $sys = $MapaSys[$id]
    $site = $MapaSite[$id]

    # --------------------------------------------------------
    # NOME
    # --------------------------------------------------------

    $nomeSys = ([string]$sys.descricao).Trim()
    $nomeSite = ([string]$site.descricao).Trim()

    $nomeSysNormalizado = (RemoverAcentos $nomeSys).ToUpper()
    $nomeSiteNormalizado = (RemoverAcentos $nomeSite).ToUpper()

    $nomeEstadoSys = ""
    $nomeEstadoSite = ""

    if ($Estado.ContainsKey($id)) {
        $nomeEstadoSys = [string]$Estado[$id].nomeSys
        $nomeEstadoSite = [string]$Estado[$id].nomeSite
    }

    $siteMudou = (
        $nomeEstadoSite -ne "" -and
        $nomeSite -ne $nomeEstadoSite
    )

    $sysMudou = (
        $nomeEstadoSys -ne "" -and
        $nomeSys -ne $nomeEstadoSys
    )

    if ($nomeEstadoSys -eq "") {

        # PRIMEIRA SINCRONIZAÇÃO:
        # preserva o nome bonito do site e manda versão sem acento ao Sys-On.

        if ($nomeSite -ne "") {
            $nomeParaSys = RemoverAcentos $nomeSite
        }
        else {
            $nomeParaSys = RemoverAcentos $nomeSys
            $site.descricao = $nomeSys
        }

        if ($nomeSys -ne $nomeParaSys) {

            $corpo = @{
                $id = @{
                    descricao = $nomeParaSys
                }
            } | ConvertTo-Json -Depth 5

            try {

                Invoke-RestMethod `
                    -Uri "$AdminApi/ajustes" `
                    -Method POST `
                    -ContentType "application/json; charset=utf-8" `
                    -Body ([Text.Encoding]::UTF8.GetBytes($corpo)) |
                    Out-Null

                $Alterados++

            }
            catch {

                Write-Host "ERRO NOME ID $id : $($_.Exception.Message)" -ForegroundColor Red
            }
        }

    }
    elseif ($siteMudou -and -not $sysMudou) {

        # SITE MUDOU → SYS-ON

        $nomeParaSys = RemoverAcentos $nomeSite

        $corpo = @{
            $id = @{
                descricao = $nomeParaSys
            }
        } | ConvertTo-Json -Depth 5

        try {

            Invoke-RestMethod `
                -Uri "$AdminApi/ajustes" `
                -Method POST `
                -ContentType "application/json; charset=utf-8" `
                -Body ([Text.Encoding]::UTF8.GetBytes($corpo)) |
                Out-Null

            $Alterados++

        }
        catch {

            Write-Host "ERRO NOME ID $id : $($_.Exception.Message)" -ForegroundColor Red
        }

    }
    elseif ($sysMudou -and -not $siteMudou) {

        # SYS-ON MUDOU → SITE
        # Mantém acentos existentes quando possível.
        # Se não houver versão bonita, usa o nome do Sys-On.

        if ($nomeSite -eq "") {
            $site.descricao = $nomeSys
            $Alterados++
        }

    }
    elseif ($sysMudou -and $siteMudou) {

        # CONFLITO:
        # SITE/ADMIN VENCE.

        $nomeParaSys = RemoverAcentos $nomeSite

        $corpo = @{
            $id = @{
                descricao = $nomeParaSys
            }
        } | ConvertTo-Json -Depth 5

        try {

            Invoke-RestMethod `
                -Uri "$AdminApi/ajustes" `
                -Method POST `
                -ContentType "application/json; charset=utf-8" `
                -Body ([Text.Encoding]::UTF8.GetBytes($corpo)) |
                Out-Null

            $Conflitos++

        }
        catch {

            Write-Host "ERRO CONFLITO NOME ID $id" -ForegroundColor Red
        }
    }

    # --------------------------------------------------------
    # PREÇO
    # --------------------------------------------------------

    $precoSys = ValorPreco $sys
    $precoSite = ValorPreco $site

    $precoEstadoSys = $null
    $precoEstadoSite = $null

    if ($Estado.ContainsKey($id)) {
        $precoEstadoSys = [decimal]$Estado[$id].precoSys
        $precoEstadoSite = [decimal]$Estado[$id].precoSite
    }

    if ($null -eq $precoEstadoSys) {

        # PRIMEIRA SINCRONIZAÇÃO:
        # Site/Admin é a referência caso já exista valor.
        # Depois ambos ficam iguais.

        $precoFinal = $precoSite

        if ($precoFinal -eq 0 -and $precoSys -ne 0) {
            $precoFinal = $precoSys
        }

        if ($precoSys -ne $precoFinal) {

            $corpo = @{
                $id = @{
                    preco = $precoFinal
                }
            } | ConvertTo-Json -Depth 5

            try {

                Invoke-RestMethod `
                    -Uri "$AdminApi/ajustes" `
                    -Method POST `
                    -ContentType "application/json; charset=utf-8" `
                    -Body ([Text.Encoding]::UTF8.GetBytes($corpo)) |
                    Out-Null

            }
            catch {

                Write-Host "ERRO PREÇO ID $id" -ForegroundColor Red
            }
        }

        $site.preco_venda = [double]$precoFinal
        $site.preco = [double]$precoFinal

    }
    else {

        $mudouSys = ($precoSys -ne $precoEstadoSys)
        $mudouSite = ($precoSite -ne $precoEstadoSite)

        if ($mudouSite -and -not $mudouSys) {

            $precoFinal = $precoSite

            $corpo = @{
                $id = @{
                    preco = $precoFinal
                }
            } | ConvertTo-Json -Depth 5

            Invoke-RestMethod `
                -Uri "$AdminApi/ajustes" `
                -Method POST `
                -ContentType "application/json; charset=utf-8" `
                -Body ([Text.Encoding]::UTF8.GetBytes($corpo)) |
                Out-Null

            $site.preco_venda = [double]$precoFinal
            $site.preco = [double]$precoFinal
        }
        elseif ($mudouSys -and -not $mudouSite) {

            $site.preco_venda = [double]$precoSys
            $site.preco = [double]$precoSys
        }
        elseif ($mudouSys -and $mudouSite) {

            # SITE VENCE EM CONFLITO

            $corpo = @{
                $id = @{
                    preco = $precoSite
                }
            } | ConvertTo-Json -Depth 5

            Invoke-RestMethod `
                -Uri "$AdminApi/ajustes" `
                -Method POST `
                -ContentType "application/json; charset=utf-8" `
                -Body ([Text.Encoding]::UTF8.GetBytes($corpo)) |
                Out-Null

            $Conflitos++

        }
        else {

            $site.preco_venda = [double]$precoSys
            $site.preco = [double]$precoSys
        }
    }

    # --------------------------------------------------------
    # ESTOQUE
    # --------------------------------------------------------

    $estoque = 0

    if ($null -ne $sys.estoque) {
        $estoque = [decimal]$sys.estoque
    }

    $site.estoque = [double]$estoque

    # --------------------------------------------------------
    # DISPONIBILIDADE
    # --------------------------------------------------------

    $fora = ([string]$sys.ForaDeUso).Trim().ToUpper()

    if ($fora -eq "SIM") {
        $site.disponivel = $false
    }
    else {
        $site.disponivel = $true
    }

    # --------------------------------------------------------
    # FOTO
    # --------------------------------------------------------

    $fotoSiteJpg = "$PastaSiteFotos\$id.jpg"
    $fotoSysJpg = "$PastaSysFotos\$id.jpg"

    $hashSite = HashArquivo $fotoSiteJpg
    $hashSys = HashArquivo $fotoSysJpg

    $hashEstadoSite = ""
    $hashEstadoSys = ""

    if ($Estado.ContainsKey($id)) {
        $hashEstadoSite = [string]$Estado[$id].hashFotoSite
        $hashEstadoSys = [string]$Estado[$id].hashFotoSys
    }

    if ($hashSite -and $hashSys) {

        if ($hashSite -ne $hashSys) {

            $siteMudou = (
                $hashEstadoSite -and
                $hashSite -ne $hashEstadoSite
            )

            $sysMudou = (
                $hashEstadoSys -and
                $hashSys -ne $hashEstadoSys
            )

            if ($siteMudou -and -not $sysMudou) {

                Copy-Item $fotoSiteJpg $fotoSysJpg -Force
                $FotosEnviadas++

            }
            elseif ($sysMudou -and -not $siteMudou) {

                Copy-Item $fotoSysJpg $fotoSiteJpg -Force
                $FotosRecebidas++

            }
            else {

                # CONFLITO OU PRIMEIRA SINCRONIZAÇÃO
                # SITE/ADMIN VENCE

                Copy-Item $fotoSiteJpg $fotoSysJpg -Force
                $FotosEnviadas++

                if ($sysMudou) {
                    $Conflitos++
                }
            }
        }

    }
    elseif ($hashSite -and -not $hashSys) {

        Copy-Item $fotoSiteJpg $fotoSysJpg -Force
        $FotosEnviadas++

    }
    elseif ($hashSys -and -not $hashSite) {

        Copy-Item $fotoSysJpg $fotoSiteJpg -Force
        $FotosRecebidas++

    }
}

# ============================================================
# SALVA CATÁLOGO
# ============================================================

# Mantém o formato original do JSON.
$JsonParaSalvar = $null

switch ($FormatoCatalogo) {

    "array-envelope" {
        $EnvelopeCatalogo.value = @($Catalogo)
        $EnvelopeCatalogo.Count = $Catalogo.Count
        $JsonParaSalvar = @($EnvelopeCatalogo)
    }

    "object-envelope" {
        $EnvelopeCatalogo.value = @($Catalogo)
        $EnvelopeCatalogo.Count = $Catalogo.Count
        $JsonParaSalvar = $EnvelopeCatalogo
    }

    "object-produtos" {
        $EnvelopeCatalogo.produtos = @($Catalogo)
        $EnvelopeCatalogo.Count = $Catalogo.Count
        $JsonParaSalvar = $EnvelopeCatalogo
    }

    default {
        $JsonParaSalvar = @($Catalogo)
    }
}

$JsonParaSalvar |
    ConvertTo-Json -Depth 30 |
    Set-Content -Encoding UTF8 $ArquivoCatalogo

# ============================================================
# RECONSULTA SYS-ON PARA GRAVAR ESTADO REAL
# ============================================================

try {

    $SysFinal = @(
        Invoke-RestMethod "$Api/produtos?v=$(Get-Date -Format 'HHmmss')"
    )

}
catch {

    $SysFinal = $SysOn
}

$MapaSysFinal = @{}

foreach ($p in $SysFinal) {
    $MapaSysFinal[[string]$p.id] = $p
}

$EstadoProdutos = @()

foreach ($id in $MapaSite.Keys) {

    $site = $MapaSite[$id]

    $sysFinal = $null

    if ($MapaSysFinal.ContainsKey($id)) {
        $sysFinal = $MapaSysFinal[$id]
    }

    $nomeSysFinal = ""

    if ($null -ne $sysFinal) {
        $nomeSysFinal = [string]$sysFinal.descricao
    }

    $precoSysFinal = 0

    if ($null -ne $sysFinal) {
        $precoSysFinal = ValorPreco $sysFinal
    }

    $precoSiteFinal = ValorPreco $site

    $fotoSite = "$PastaSiteFotos\$id.jpg"
    $fotoSys = "$PastaSysFotos\$id.jpg"

    $EstadoProdutos += [PSCustomObject]@{
        id = $id
        nomeSys = $nomeSysFinal
        nomeSite = [string]$site.descricao
        precoSys = $precoSysFinal
        precoSite = $precoSiteFinal
        hashFotoSite = HashArquivo $fotoSite
        hashFotoSys = HashArquivo $fotoSys
    }
}

[PSCustomObject]@{
    data = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    produtos = $EstadoProdutos
} |
ConvertTo-Json -Depth 20 |
Set-Content -Encoding UTF8 $ArquivoEstado

# ============================================================
# FINAL
# ============================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "       SINCRONIZACAO CONCLUIDA" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Produtos:              $($SysFinal.Count)"
Write-Host "Alteracoes:            $Alterados"
Write-Host "Fotos Site -> Sys-On:  $FotosEnviadas"
Write-Host "Fotos Sys-On -> Site:  $FotosRecebidas"
Write-Host "Conflitos resolvidos:  $Conflitos"
Write-Host ""

Write-Host "REGRAS:" -ForegroundColor Cyan
Write-Host "- Nome: Sys-On sem acentos / Site com acentos."
Write-Host "- Preço: sincronizado nos dois sentidos."
Write-Host "- Foto: sincronizada nos dois sentidos."
Write-Host "- Estoque: Sys-On -> Site."
Write-Host "- ForaDeUso: Sys-On -> Site."
Write-Host "- Em conflito de nome/preço/foto, Site/Admin vence."
Write-Host "- PUBLICACAO AUTOMATICA: DESATIVADA."
Write-Host ""
Write-Host "O sincronizador NAO executa Git, Netlify, deploy, push ou commit." -ForegroundColor Yellow
Write-Host "Depois de conferir o resultado, a publicacao continua MANUAL." -ForegroundColor Yellow
Write-Host ""
Write-Host "Backup:"
Write-Host $Backup
Write-Host ""