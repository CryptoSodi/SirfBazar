#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('all', 'customer', 'merchant', 'rider')]
    [string]$App = 'all',
    [string]$KeyDirectory = 'D:\keys\SirfBazar',
    [string]$PasswordFile = '',
    [switch]$Submit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Windows is required for private file ACLs.' }
$root = Split-Path $PSScriptRoot -Parent
$keytool = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr\bin\keytool.exe'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$eas = Join-Path $env:APPDATA 'npm\node_modules\eas-cli\bin\run'
$expected = @{
    customer = '9F:67:B7:7D:B1:8A:32:31:E2:33:78:A8:56:1F:48:94:93:92:A3:A0'
    merchant = 'FF:7A:DA:CB:08:BB:CD:CB:C8:7E:6A:9B:36:94:30:A2:42:4B:EE:58'
    rider = 'A1:42:B2:57:E3:C4:97:5F:21:FF:DF:24:93:6B:7A:13:E1:D8:5B:33'
}
$apps = if ($App -eq 'all') { @('customer', 'merchant', 'rider') } else { @($App) }
$sharedPassword = $null
$secrets = @{}

function Invoke-Captured([string]$File, [string[]]$Arguments, [string]$Directory, [string]$Password = '') {
    $start = [Diagnostics.ProcessStartInfo]::new($File)
    $start.WorkingDirectory = $Directory
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    if ($Password) { $start.Environment['SIRFBAZAR_SIGNING_PASSWORD'] = $Password }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $out = $stdout.Result
        $err = $stderr.Result
        # Do not leak a supplied secret even if a child process includes it in an error.
        foreach ($secret in $secrets.Values) {
            $out = $out.Replace($secret, '[REDACTED]')
            $err = $err.Replace($secret, '[REDACTED]')
        }
        if ($process.ExitCode -ne 0) { throw "Command failed ($($process.ExitCode)): $err $out" }
        return @{ Out = $out; Err = $err }
    } finally {
        [void]$start.Environment.Remove('SIRFBAZAR_SIGNING_PASSWORD')
        $process.Dispose()
    }
}

try {
    if ($PasswordFile) {
        # Read only the user-selected file; never print it or copy it into the repository.
        $sharedPassword = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $PasswordFile).Path).TrimEnd("`r", "`n")
        if (-not $sharedPassword) { throw 'The selected password file is empty.' }
    }
    foreach ($name in $apps) {
        $directory = Join-Path $root "apps\$name-app"
        $credentialsPath = Join-Path $directory 'credentials.json'
        if (Test-Path -LiteralPath $credentialsPath) { throw "Refusing to overwrite $credentialsPath" }
        $profile = Get-Content -LiteralPath (Join-Path $directory 'eas.json') -Raw | ConvertFrom-Json
        if ($profile.build.'release-keystore'.android.credentialsSource -ne 'local' -or $profile.build.'release-keystore'.extends -ne 'preview') {
            throw "Unexpected signing profile for $name"
        }
        $alias = "sirfbazar-$name-release"
        $keystore = (Resolve-Path -LiteralPath (Join-Path $KeyDirectory "$alias.jks")).Path
        if ($sharedPassword) { $secrets[$name] = $sharedPassword } else {
            $secure = Read-Host "Existing password for $alias" -AsSecureString
            try { $secrets[$name] = [Management.Automation.PSCredential]::new($alias, $secure).GetNetworkCredential().Password }
            finally { $secure.Dispose() }
        }
        $common = @('-J-Duser.language=en', '-J-Duser.country=US', '-keystore', $keystore,
            '-storetype', 'JKS', '-alias', $alias, '-storepass:env', 'SIRFBAZAR_SIGNING_PASSWORD')
        $listing = Invoke-Captured $keytool (@('-list', '-v') + $common) $root $secrets[$name]
        if ($listing.Out -notmatch 'PrivateKeyEntry' -or -not $listing.Out.Contains($expected[$name])) { throw "Unexpected signing certificate for $name" }
        # A CSR requires the private key, so it also checks the key password without modifying the keystore.
        [void](Invoke-Captured $keytool (@('-certreq', '-keypass:env', 'SIRFBAZAR_SIGNING_PASSWORD') + $common) $root $secrets[$name])
        Write-Host "Validated $name key, alias, password and SHA-1: $($expected[$name])"
    }
    if (-not $Submit) { Write-Host 'Validation only; nothing uploaded or built. Add -Submit to queue EAS builds.'; return }
    if (-not (Test-Path -LiteralPath $eas)) { throw 'Existing EAS CLI installation not found.' }
    $identity = Invoke-Captured $node @($eas, 'whoami') $root
    if ($identity.Out -notmatch '(?m)^tassaduq\r?$') { throw 'EAS account is not the approved tassaduq account.' }
    $output = Join-Path $root ('output\apk-local-release-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    [void][IO.Directory]::CreateDirectory($output)
    foreach ($name in $apps) {
        $directory = Join-Path $root "apps\$name-app"
        $credentialsPath = Join-Path $directory 'credentials.json'
        $alias = "sirfbazar-$name-release"
        $created = $false
        try {
            # Create an empty file exclusively, protect it, then populate the EAS-required plaintext JSON.
            $stream = [IO.File]::Open($credentialsPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
            $stream.Dispose()
            $created = $true
            $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
            $acl = [Security.AccessControl.FileSecurity]::new()
            $acl.SetOwner($owner)
            $acl.SetAccessRuleProtection($true, $false)
            foreach ($sid in @($owner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
                $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow'))
            }
            Set-Acl -LiteralPath $credentialsPath -AclObject $acl
            $credentials = @{ android = @{ keystore = @{
                keystorePath = (Resolve-Path -LiteralPath (Join-Path $KeyDirectory "$alias.jks")).Path
                keystorePassword = $secrets[$name]; keyAlias = $alias; keyPassword = $secrets[$name]
            } } }
            [IO.File]::WriteAllText($credentialsPath, ($credentials | ConvertTo-Json -Depth 5))
            Write-Host "Submitting $name to EAS using release-keystore (private testing APK, no store submission)..."
            $result = Invoke-Captured $node @($eas, 'build', '--platform', 'android', '--profile', 'release-keystore',
                '--non-interactive', '--freeze-credentials', '--no-wait', '--json', '--message',
                'Local SirfBazar release key; private testing only; Google device verification pending') $directory
            Write-Host $result.Err
            $builds = @($result.Out | ConvertFrom-Json)
            foreach ($build in $builds) {
                $record = [ordered]@{ app = $name; id = $build.id; status = $build.status; profile = 'release-keystore'; expectedSha1 = $expected[$name] }
                $record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output "$name-build.json") -Encoding utf8
                Write-Host "$name build queued: $($build.id) [$($build.status)]"
            }
        } finally {
            if ($created) { Remove-Item -LiteralPath $credentialsPath -ErrorAction Stop }
        }
    }
    Write-Host "Non-secret build records: $output"
    Write-Host 'Existing remote EAS credentials and preview/production profiles remain unchanged.'
} finally {
    $secrets.Clear()
    $sharedPassword = $null
}
