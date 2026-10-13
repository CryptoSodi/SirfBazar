#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('all', 'customer', 'merchant', 'rider')][string]$App = 'all',
    [ValidateRange(1, 2100000000)][int]$VersionCode = 6,
    [string]$SourceCommit = 'HEAD',
    [string]$PasswordFile,
    [string]$KeyDirectory = 'D:\keys\SirfBazar',
    [switch]$Resume,
    [switch]$RefreshConfig
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$java = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
$output = Join-Path $root "output\aab$VersionCode"
$roles = if ($App -eq 'all') { @('customer', 'merchant', 'rider') } else { @($App) }
$node = (Get-Command node.exe).Source
$secret = $null
$expectedSha1 = @{
    customer = '9F:67:B7:7D:B1:8A:32:31:E2:33:78:A8:56:1F:48:94:93:92:A3:A0'
    merchant = 'FF:7A:DA:CB:08:BB:CD:CB:C8:7E:6A:9B:36:94:30:A2:42:4B:EE:58'
    rider = 'A1:42:B2:57:E3:C4:97:5F:21:FF:DF:24:93:6B:7A:13:E1:D8:5B:33'
}

function Run([string]$File, [string[]]$Arguments, [string]$Directory, [hashtable]$Environment = @{}, [string]$LogPath = '') {
    $start = [Diagnostics.ProcessStartInfo]::new($File)
    $start.WorkingDirectory = $Directory
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    foreach ($entry in $Environment.GetEnumerator()) { $start.Environment[$entry.Key] = $entry.Value }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $message = $stdout.Result + $stderr.Result
        if ($secret) { $message = $message.Replace($secret, '[REDACTED]') }
        if ($LogPath) { [IO.File]::WriteAllText($LogPath, $message) }
        Write-Host $message
        if ($process.ExitCode -ne 0) { throw "Command failed ($($process.ExitCode)): $File" }
        return $message
    } finally { $process.Dispose() }
}

if (-not (Test-Path "$java\bin\java.exe") -or -not (Test-Path $sdk)) { throw 'Android Studio JDK and Android SDK are required.' }
$source = (& git -C $root rev-parse --verify "$SourceCommit^{commit}").Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve source commit.' }
[void][IO.Directory]::CreateDirectory($output)
try {
    if ($PasswordFile) {
        $secret = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $PasswordFile).Path).TrimEnd("`r", "`n")
        if (-not $secret) { throw 'Password file is empty.' }
    } else {
        $secure = Read-Host 'Existing release-key password' -AsSecureString
        try { $secret = [Management.Automation.PSCredential]::new('release', $secure).GetNetworkCredential().Password }
        finally { $secure.Dispose() }
    }
    foreach ($role in $roles) {
        if ((Get-PSDrive C).Free -lt 8GB) { throw 'Less than 8 GB free; refusing to start another native build.' }
        $original = Join-Path $root "apps\$role-app"
        $stage = Join-Path $output $role
        $marker = Join-Path $stage 'local-build-source.json'
        $refresh = $false
        if (Test-Path $stage) {
            if (-not $Resume -or -not (Test-Path $marker)) { throw "Refusing to reuse $stage without -Resume and a source marker." }
            $prior = Get-Content $marker -Raw | ConvertFrom-Json
            if ($prior.versionCode -ne $VersionCode) { throw 'Resume version differs.' }
            if ($prior.commit -ne $source) {
                if (-not $RefreshConfig) { throw 'Resume source differs; a reviewed app.json-only refresh needs -RefreshConfig.' }
                $changed = @(& git -C $root diff --name-only $prior.commit $source -- "apps/$role-app")
                if ($LASTEXITCODE -ne 0 -or @($changed | Where-Object { $_ -ne "apps/$role-app/app.json" }).Count) {
                    throw 'Only app.json changes may reuse a native snapshot; use a new version directory for other changes.'
                }
                $raw = & git -C $root show "${source}:apps/$role-app/app.json" | Out-String
                if ($LASTEXITCODE -ne 0) { throw 'Cannot read reviewed app configuration.' }
                $config = $raw | ConvertFrom-Json -AsHashtable
                $config.expo.android.versionCode = $VersionCode
                [IO.File]::WriteAllText((Join-Path $stage 'app.json'), ($config | ConvertTo-Json -Depth 30))
                $refresh = $true
            }
        } else {
            [void][IO.Directory]::CreateDirectory($stage)
            $archive = Join-Path $output "$role-source.tar"
            [void](Run 'git.exe' @('-C', $root, '-c', 'core.autocrlf=false', 'archive', '--format=tar', "--output=$archive", $source, "apps/$role-app") $root)
            [void](Run 'tar.exe' @('-xf', $archive, '-C', $stage, '--strip-components=2') $root)
            if ((Get-FileHash "$original\package-lock.json").Hash -ne (Get-FileHash "$stage\package-lock.json").Hash) {
                throw 'Snapshot dependency lock differs from the installed-app source; install matching dependencies before building.'
            }
            $configPath = Join-Path $stage 'app.json'
            $config = Get-Content $configPath -Raw | ConvertFrom-Json -AsHashtable
            $config.expo.android.versionCode = $VersionCode
            [IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 30))
            # Native generation writes only into this isolated snapshot, never the app source.
            & robocopy.exe (Join-Path $original 'node_modules') (Join-Path $stage 'node_modules') /E /NFL /NDL /NJH /NJS /NP
            if ($LASTEXITCODE -ge 8) { throw "Dependency copy failed for $role" }
            [IO.File]::WriteAllText($marker, (@{ commit = $source; versionCode = $VersionCode } | ConvertTo-Json))
        }
        $profile = Get-Content (Join-Path $stage 'eas.json') -Raw | ConvertFrom-Json -AsHashtable
        $environment = @{
            JAVA_HOME = $java; ANDROID_HOME = $sdk; ANDROID_SDK_ROOT = $sdk
            PATH = "$java\bin;$env:PATH"; CI = '1'; NODE_ENV = 'production'; EXPO_NO_DOTENV = '1'
            REMEDIATION_TEST_BUILD = '0'; EAS_BUILD_PLATFORM = 'android'
            CMAKE_BUILD_PARALLEL_LEVEL = '2'
        }
        foreach ($entry in $profile.build.preview.env.GetEnumerator()) { $environment[$entry.Key] = $entry.Value }
        if ($environment.EXPO_PUBLIC_API_URL -ne 'https://api.sirfbazar.com/api') { throw 'Unexpected release API.' }
        $native = Join-Path $stage 'android'
        if ($refresh -or -not (Test-Path "$native\gradlew.bat")) {
            Write-Host "Generating $role Android project from $source..."
            [void](Run $node @("$stage\node_modules\expo\bin\cli", 'prebuild', '--platform', 'android', '--no-install') $stage $environment)
            [IO.File]::WriteAllText($marker, (@{ commit = $source; versionCode = $VersionCode } | ConvertTo-Json))
        }
        $gradle = Join-Path $native 'app\build.gradle'
        $signing = Join-Path $native 'app\local-release-signing.gradle'
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'android-release-signing.gradle') -Destination $signing
        $buildText = [IO.File]::ReadAllText($gradle)
        if (-not $buildText.Contains("apply from: 'local-release-signing.gradle'")) {
            [IO.File]::AppendAllText($gradle, "`napply from: 'local-release-signing.gradle'`n")
        }
        $environment.SIRFBAZAR_KEYSTORE = (Resolve-Path -LiteralPath (Join-Path $KeyDirectory "sirfbazar-$role-release.jks")).Path
        $environment.SIRFBAZAR_KEY_ALIAS = "sirfbazar-$role-release"
        $environment.SIRFBAZAR_SIGNING_PASSWORD = $secret
        Write-Host "Building $role release bundle (password is not written to disk)..."
        try {
            [void](Run 'cmd.exe' @('/d', '/c', 'gradlew.bat', ':app:bundleRelease', '--no-daemon', '--console=plain', '--max-workers=2', '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m') $native $environment (Join-Path $output "$role-build.log"))
        } finally { $environment.Remove('SIRFBAZAR_SIGNING_PASSWORD') }
        $bundle = Join-Path $native 'app\build\outputs\bundle\release\app-release.aab'
        if (-not (Test-Path $bundle)) { throw "Missing bundle for $role" }
        $artifact = Join-Path $output "sirfbazar-$role-v1.0.0-build$VersionCode.aab"
        Copy-Item -LiteralPath $bundle -Destination $artifact
        $verification = Run "$java\bin\jarsigner.exe" @('-verify', $artifact) $root
        if ($verification -notmatch 'jar verified') { throw 'Bundle signature verification failed.' }
        $certificate = Run "$java\bin\keytool.exe" @('-J-Duser.language=en', '-printcert', '-jarfile', $artifact) $root
        if (-not $certificate.Contains($expectedSha1[$role])) { throw 'Bundle is not signed with the expected release certificate.' }
        $record = @{ app = $role; package = "pk.sirfbazar.$role"; commit = $source; versionCode = $VersionCode; sha256 = (Get-FileHash $artifact -Algorithm SHA256).Hash; signerSha1 = $expectedSha1[$role]; artifact = $artifact; status = 'BUILT_NOT_PLAY_VERIFIED' }
        [IO.File]::WriteAllText((Join-Path $output "$role-artifact.json"), ($record | ConvertTo-Json))
        Write-Host "Built: $artifact"
    }
} finally { $secret = $null }
