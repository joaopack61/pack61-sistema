Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PACK61 - Instalacao do Sistema" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Node.js
try {
    $nodeVersion = node --version 2>$null
    Write-Host "[OK] Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] Node.js nao encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale o Node.js em: https://nodejs.org (versao 18 ou superior)" -ForegroundColor Yellow
    Write-Host "Apos instalar, feche e abra novamente este terminal e execute install.ps1 novamente."
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Instalar dependencias do backend
Write-Host ""
Write-Host "[1/2] Instalando dependencias do backend..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "[ERRO] Falha ao instalar backend" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Backend instalado" -ForegroundColor Green

# Instalar dependencias do frontend
Write-Host ""
Write-Host "[2/2] Instalando dependencias do frontend..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "[ERRO] Falha ao instalar frontend" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Frontend instalado" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Instalacao concluida com sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar o sistema, execute:" -ForegroundColor Cyan
Write-Host "  .\start.ps1" -ForegroundColor White
Write-Host ""
Set-Location $PSScriptRoot
Read-Host "Pressione Enter para continuar"
