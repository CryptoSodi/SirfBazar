#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Directory,
    [string]$KeyDirectory = 'D:\keys\SirfBazar',
    [string]$BuildTools = "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.1.0"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$java = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr\bin\java.exe'
$keytool = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr\bin\keytool.exe'
$signer = Join-Path $BuildTools 'lib\apksigner.jar'
$aapt = Join-Path $BuildTools 'aapt.exe'
$results = @()
foreach ($name in @('customer', 'merchant', 'rider')) {
    $file = (Resolve-Path -LiteralPath (Join-Path $Directory "sirfbazar-$name-local-release.apk")).Path
    $certificatePath = Join-Path $KeyDirectory "sirfbazar-$name-release.certificate.pem"
    $certificate = (& $keytool '-J-Duser.language=en' '-J-Duser.country=US' -printcert -file $certificatePath 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "Public certificate inspection failed: $name" }
    $thumbprint = [regex]::Match($certificate, 'SHA1: ([A-Fa-f0-9:]+)')
    if (-not $thumbprint.Success) { throw "Missing certificate fingerprint: $name" }
    $expected = $thumbprint.Groups[1].Value.Replace(':', '').ToLowerInvariant()
    $signature = (& $java -jar $signer verify --verbose --print-certs $file 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed: $name" }
    $match = [regex]::Match($signature, 'Signer #1 certificate SHA-1 digest: ([a-fA-F0-9]+)')
    if (-not $match.Success -or $match.Groups[1].Value.ToLowerInvariant() -ne $expected) { throw "Wrong signing certificate: $name" }
    if ($signature -notmatch 'Number of signers: 1\b' -or $signature -notmatch 'Verified using v2 scheme .*: true') { throw "Expected one signer and APK v2 signature: $name" }
    $badging = (& $aapt dump badging $file 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "APK manifest inspection failed: $name" }
    $package = [regex]::Match($badging, "package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'")
    if (-not $package.Success -or $package.Groups[1].Value -ne "pk.sirfbazar.$name") { throw "Unexpected package: $name" }
    if ($badging -match '(?m)^application-debuggable') { throw "Refusing debuggable APK: $name" }
    $results += [ordered]@{
        app = $name; file = $file; bytes = (Get-Item -LiteralPath $file).Length
        package = $package.Groups[1].Value; versionCode = $package.Groups[2].Value; versionName = $package.Groups[3].Value
        debuggable = $false; signatureVerified = $true; certificateSha1 = $expected
        fileSha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    Write-Host "PASS: $name signature, local certificate match, package, non-debuggable release APK"
}
$record = [ordered]@{ verifiedAt = [DateTime]::UtcNow.ToString('o'); apks = $results }
$record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Directory 'verification.json') -Encoding utf8
Write-Host 'This verifies artifacts, not Google login on a device.'
