#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$creator = Join-Path $PSScriptRoot 'New-SirfBazarKeystores.ps1'
$reader = Join-Path $PSScriptRoot 'Show-SirfBazarKeystorePassword.ps1'
foreach ($script in @($creator, $reader)) {
    $tokens = $null
    $parseErrors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($script, [ref]$tokens, [ref]$parseErrors)
    if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
}
$directory = Join-Path $root ('output\keystore-script-tests\' + [Guid]::NewGuid().ToString('N'))
& $creator -OutputDirectory $directory -WhatIf
if (Test-Path -LiteralPath $directory) { throw 'WhatIf must not create files/directories.' }
& $creator -OutputDirectory $directory -GeneratePasswords
$fingerprints = @()
$hashes = @{}
foreach ($app in @('customer', 'merchant', 'rider')) {
    $alias = "sirfbazar-$app-release"
    foreach ($suffix in @('.jks', '.certificate.pem', '.fingerprints.txt', '.password.clixml')) {
        $file = Join-Path $directory "$alias$suffix"
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing $file" }
        $acl = Get-Acl -LiteralPath $file
        if (-not $acl.AreAccessRulesProtected) { throw "ACL inheritance still enabled: $file" }
        $permitted = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18')
        foreach ($rule in $acl.Access) {
            $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
            if ($sid -notin $permitted) { throw "Unexpected ACL principal: $sid" }
        }
        $hashes[$file] = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
    }
    $credentialFile = Join-Path $directory "$alias.password.clixml"
    $credential = Import-Clixml -LiteralPath $credentialFile
    try {
        if ($credential.UserName -ne $alias -or $credential.Password.Length -lt 40) { throw 'Invalid generated credential.' }
        if ((Get-Content -LiteralPath $credentialFile -Raw).Contains($credential.GetNetworkCredential().Password)) {
            throw 'Password backup is not encrypted.'
        }
    } finally { $credential.Password.Dispose() }
    $details = Get-Content -LiteralPath (Join-Path $directory "$alias.fingerprints.txt") -Raw
    if ($details -notmatch 'SHA1:\s*([0-9A-F:]+)') { throw 'Missing public fingerprint.' }
    $fingerprints += $Matches[1]
    if ($details -notmatch 'SHA256withRSA' -or $details -notmatch '2048-bit RSA' -or $details -notmatch 'PrivateKeyEntry') {
        throw 'Unexpected signing algorithm/key entry.'
    }
}
if (@($fingerprints | Select-Object -Unique).Count -ne 3) { throw 'Apps must have distinct signing keys.' }
$refused = $false
try { & $creator -OutputDirectory $directory -GeneratePasswords } catch {
    if ($_.Exception.Message -notlike 'Refusing to overwrite existing file:*') { throw }
    $refused = $true
}
if (-not $refused) { throw 'Existing keystores must not be overwritten.' }
foreach ($file in $hashes.Keys) {
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $hashes[$file]) { throw "Existing file changed: $file" }
}
if (Test-Path Env:SIRFBAZAR_KEYTOOL_PASSWORD) { throw 'Password environment leaked to parent process.' }
Write-Host 'PASS: parsing, WhatIf, three distinct RSA keys, verified entries, encrypted password recovery, private ACLs, no overwrite, no parent password environment.'
Write-Host "Disposable test keys only (never register or distribute): $directory"
