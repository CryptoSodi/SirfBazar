#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('customer', 'merchant', 'rider')][string]$App,
    [Parameter(Mandatory)][string]$Bundle,
    [Parameter(Mandatory)][int]$VersionCode,
    [string]$Bundletool = "$PSScriptRoot\..\output\bundletool-all-1.18.3.jar",
    [string]$ApkPasswordFile,
    [string]$KeyDirectory = 'D:\keys\SirfBazar'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$java = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr\bin'
$Bundle = (Resolve-Path -LiteralPath $Bundle).Path
$Bundletool = (Resolve-Path -LiteralPath $Bundletool).Path
if ((Get-FileHash $Bundletool -Algorithm SHA256).Hash -ne 'A099CFA1543F55593BC2ED16A70A7C67FE54B1747BB7301F37FDFD6D91028E29') { throw 'Unexpected bundletool checksum.' }
$expectedSha1 = @{
    customer = '9F:67:B7:7D:B1:8A:32:31:E2:33:78:A8:56:1F:48:94:93:92:A3:A0'
    merchant = 'FF:7A:DA:CB:08:BB:CD:CB:C8:7E:6A:9B:36:94:30:A2:42:4B:EE:58'
    rider = 'A1:42:B2:57:E3:C4:97:5F:21:FF:DF:24:93:6B:7A:13:E1:D8:5B:33'
}
$signature = & "$java\jarsigner.exe" '-J-Duser.language=en' '-J-Duser.country=US' -verify $Bundle 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $signature -notmatch 'jar verified') { throw 'JAR signature verification failed.' }
$certificate = & "$java\keytool.exe" '-J-Duser.language=en' -printcert -jarfile $Bundle 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or -not $certificate.Contains($expectedSha1[$App])) { throw 'Unexpected signing certificate.' }
$validation = & "$java\java.exe" -jar $Bundletool validate "--bundle=$Bundle" 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw "bundletool validation failed: $validation" }
$raw = & "$java\java.exe" -jar $Bundletool dump manifest "--bundle=$Bundle" --module=base | Out-String
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect bundle manifest.' }
[xml]$manifest = $raw
$ns = 'http://schemas.android.com/apk/res/android'
$package = $manifest.DocumentElement.GetAttribute('package')
$version = $manifest.DocumentElement.GetAttribute('versionCode', $ns)
$sdk = $manifest.SelectSingleNode('/manifest/uses-sdk').GetAttribute('targetSdkVersion', $ns)
if ($package -ne "pk.sirfbazar.$App" -or [int]$version -ne $VersionCode) { throw 'Unexpected bundle package/version.' }
if ([int]$sdk -lt 35) { throw 'Unexpected target SDK below 35.' }
if ($manifest.SelectSingleNode('/manifest/application').GetAttribute('debuggable', $ns) -eq 'true') { throw 'Release bundle is debuggable.' }
$permissions = @($manifest.SelectNodes('/manifest/uses-permission') | ForEach-Object { $_.GetAttribute('name', $ns) })
foreach ($blocked in @('SYSTEM_ALERT_WINDOW', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE')) {
    if ("android.permission.$blocked" -in $permissions) { throw "Unneeded permission remains: $blocked" }
}
if ($App -eq 'merchant' -and 'android.permission.RECORD_AUDIO' -in $permissions) { throw 'Unneeded merchant microphone permission remains.' }

# Check actual ELF LOAD segment alignment, not just ZIP alignment or SDK version.
$zip = [IO.Compression.ZipFile]::OpenRead($Bundle)
$libraries = @()
try {
    $javascript = $zip.GetEntry('base/assets/index.android.bundle')
    if (-not $javascript) { throw 'Missing production JavaScript bundle.' }
    $reader = [IO.StreamReader]::new($javascript.Open())
    try { $code = $reader.ReadToEnd() } finally { $reader.Dispose() }
    $embedded = @{
        productionApi = $code.Contains('https://api.sirfbazar.com/api')
        googleClient = $code.Contains('453311658725-s55gcpidi4h6kf38hgqhmrku11ha02ts.apps.googleusercontent.com')
        support = $code.Contains('support@sirfbazar.com')
        deletion = $code.Contains('account-deletion')
    }
    if ($embedded.Values -contains $false) { throw 'Missing expected release configuration/policy strings in JavaScript bundle.' }
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -notmatch '^base/lib/(arm64-v8a|x86_64)/.+\.so$') { continue }
        $stream = $entry.Open()
        $memory = [IO.MemoryStream]::new()
        try { $stream.CopyTo($memory); $bytes = $memory.ToArray() }
        finally { $stream.Dispose(); $memory.Dispose() }
        if ($bytes.Length -lt 64 -or $bytes[0] -ne 127 -or [Text.Encoding]::ASCII.GetString($bytes, 1, 3) -ne 'ELF' -or $bytes[4] -ne 2 -or $bytes[5] -ne 1) { throw "Invalid 64-bit little-endian ELF: $($entry.FullName)" }
        $offset = [BitConverter]::ToUInt64($bytes, 32)
        $size = [BitConverter]::ToUInt16($bytes, 54)
        $count = [BitConverter]::ToUInt16($bytes, 56)
        if ($size -lt 56 -or $offset + [uint64]$size * $count -gt $bytes.Length) { throw 'Invalid ELF program header table.' }
        $alignments = @()
        for ($i = 0; $i -lt $count; $i++) {
            $header = [int]($offset + $i * $size)
            if ([BitConverter]::ToUInt32($bytes, $header) -ne 1) { continue }
            $alignment = [BitConverter]::ToUInt64($bytes, $header + 48)
            $fileOffset = [BitConverter]::ToUInt64($bytes, $header + 8)
            $address = [BitConverter]::ToUInt64($bytes, $header + 16)
            if ($alignment -lt 16384 -or ($fileOffset % 16384) -ne ($address % 16384)) { throw "16 KB ELF alignment failed: $($entry.FullName)" }
            $alignments += $alignment
        }
        if (-not $alignments.Count) { throw 'ELF has no load segments.' }
        $libraries += @{ path = $entry.FullName; minimumAlignment = ($alignments | Measure-Object -Minimum).Minimum }
    }
} finally { $zip.Dispose() }
if (-not $libraries.Count) { throw 'No 64-bit native libraries were inspected.' }
$report = @{
    package = $package; versionCode = [int]$version; targetSdk = [int]$sdk
    sha256 = (Get-FileHash $Bundle -Algorithm SHA256).Hash
    signerSha1 = $expectedSha1[$App]; permissions = $permissions; libraries = $libraries
    embeddedConfigurationStrings = $embedded
    bundleValidation = 'passed'; elf16KB = 'passed'
    deviceJourneys = 'not verified'; playDeliveredSigning = 'not verified'
}
if ($ApkPasswordFile) {
    $passwordPath = (Resolve-Path -LiteralPath $ApkPasswordFile).Path
    $keystore = (Resolve-Path -LiteralPath (Join-Path $KeyDirectory "sirfbazar-$App-release.jks")).Path
    $set = [IO.Path]::ChangeExtension($Bundle, '.apks')
    $apk = [IO.Path]::ChangeExtension($Bundle, '.apk')
    if ((Test-Path $set) -or (Test-Path $apk)) { throw 'Refusing to overwrite an existing test APK or APK set.' }
    # Bundletool reads the existing private file directly; no password value is a CLI argument.
    & "$java\java.exe" -Xmx1024m -jar $Bundletool build-apks "--bundle=$Bundle" "--output=$set" --mode=universal `
        "--ks=$keystore" "--ks-key-alias=sirfbazar-$App-release" "--ks-pass=file:$passwordPath" "--key-pass=file:$passwordPath"
    if ($LASTEXITCODE -ne 0) { throw 'Universal APK generation failed.' }
    $apkSet = [IO.Compression.ZipFile]::OpenRead($set)
    try {
        $entry = $apkSet.GetEntry('universal.apk')
        if (-not $entry) { throw 'No universal APK in the generated set.' }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $apk, $false)
    } finally { $apkSet.Dispose() }
    $buildTools = Join-Path $env:LOCALAPPDATA 'Android\Sdk\build-tools\36.0.0'
    & "$buildTools\zipalign.exe" -c -P 16 4 $apk
    if ($LASTEXITCODE -ne 0) { throw 'Generated APK ZIP alignment failed.' }
    $apkSignature = & "$java\java.exe" -jar "$buildTools\lib\apksigner.jar" verify --verbose --print-certs $apk | Out-String
    if ($LASTEXITCODE -ne 0 -or -not $apkSignature.ToLowerInvariant().Contains($expectedSha1[$App].Replace(':', '').ToLowerInvariant())) {
        throw 'APK signature or expected certificate verification failed.'
    }
    $report.apk = @{ path = $apk; sha256 = (Get-FileHash $apk -Algorithm SHA256).Hash; zip16KB = 'passed'; signature = 'passed' }
    [IO.File]::WriteAllText("$apk.verification.json", (@{ bundleSha256 = $report.sha256; package = $package; versionCode = [int]$version; signerSha1 = $expectedSha1[$App]; apk = $report.apk } | ConvertTo-Json -Depth 5))
}
[IO.File]::WriteAllText("$Bundle.manifest.xml", $raw)
[IO.File]::WriteAllText("$Bundle.verification.json", ($report | ConvertTo-Json -Depth 6))
Write-Host "$App bundle verified: package=$package version=$version targetSDK=$sdk nativeLibraries=$($libraries.Count)"
Write-Host 'This does not verify device journeys, Play-delivered signing or Google Play approval. APK ZIP checks run only with -ApkPasswordFile.'
