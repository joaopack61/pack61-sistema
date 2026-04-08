Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PACK61 - Iniciando Sistema" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = $PSScriptRoot

# Iniciar backend
Write-Host "[Backend] Iniciando na porta 3001..." -ForegroundColor Yellow
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\backend'; Write-Host 'Backend PACK61' -ForegroundColor Cyan; node server.js" -PassThru

Start-Sleep -Seconds 2

# Iniciar frontend
Write-Host "[Frontend] Iniciando na porta 5173..." -ForegroundColor Yellow
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\frontend'; Write-Host 'Frontend PACK61' -ForegroundColor Cyan; npm run dev" -PassThru

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Sistema PACK61 iniciado!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Acesse no navegador:" -ForegroundColor White
Write-Host "  http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Logins para teste:" -ForegroundColor White
Write-Host "  Admin:     admin@pack61.com.br    / admin123" -ForegroundColor White
Write-Host "  Vendedor:  carlos@pack61.com.br   / 123456" -ForegroundColor White
Write-Host "  Motorista: joao@pack61.com.br     / 123456" -ForegroundColor White
Write-Host "  Producao:  producao@pack61.com.br / 123456" -ForegroundColor White
Write-Host ""
Write-Host "Para parar: feche as janelas do terminal." -ForegroundColor Gray
Write-Host ""

# Abrir navegador automaticamente
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
