# Starts the SirfBazar dev stack in separate terminal windows.
# Usage: powershell -File scripts/dev.ps1
$root = Split-Path $PSScriptRoot -Parent

Start-Process pwsh -ArgumentList '-NoExit', '-Command', "cd '$root\apps\api'; npm run dev"
Start-Process pwsh -ArgumentList '-NoExit', '-Command', "cd '$root\apps\web'; npm run dev"
Start-Process pwsh -ArgumentList '-NoExit', '-Command', "cd '$root\apps\admin'; npm run dev"

Write-Host 'API     -> http://localhost:3001 (Swagger /docs)'
Write-Host 'Website -> http://localhost:3000'
Write-Host 'Admin   -> http://localhost:5173'
