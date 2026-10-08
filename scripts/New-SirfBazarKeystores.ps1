#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateSet('all', 'customer', 'merchant', 'rider')]
    [string]$App = 'all',
    [string]$OutputDirectory = 'D:\keys\SirfBazar',
    [string]$KeytoolPath = '',
    [switch]$GeneratePasswords
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This script requires Windows for ACLs and DPAPI password protection.' }

if (-not $KeytoolPath) {
    $candidates = @("$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe")
    if ($env:JAVA_HOME) { $candidates = @("$env:JAVA_HOME\bin\keytool.exe") + $candidates }
    $command = Get-Command keytool.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
    $KeytoolPath = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if (-not $KeytoolPath -or -not (Test-Path -LiteralPath $KeytoolPath -PathType Leaf)) {
    throw 'Java keytool not found. Supply -KeytoolPath or install a JDK/Android Studio.'
}
$KeytoolPath = (Resolve-Path -LiteralPath $KeytoolPath).Path
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if ($OutputDirectory.Contains('"')) { throw 'The output path cannot contain double quotes.' }
$apps = @('customer', 'merchant', 'rider')
if ($App -ne 'all') { $apps = @($App) }
$suffixes = @('.jks', '.certificate.pem', '.fingerprints.txt', '.password.clixml')
foreach ($name in $apps) {
    foreach ($suffix in $suffixes) {
        $destination = Join-Path $OutputDirectory "sirfbazar-$name-release$suffix"
        if (Test-Path -LiteralPath $destination) { throw "Refusing to overwrite existing file: $destination" }
    }
}
if (-not $PSCmdlet.ShouldProcess($OutputDirectory, "Create new release signing keys for $($apps -join ', '); do not change EAS or Google")) { return }

function Protect-NewPath([string]$Path, [switch]$Directory) {
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $acl = if ($Directory) { [Security.AccessControl.DirectorySecurity]::new() } else { [Security.AccessControl.FileSecurity]::new() }
    $acl.SetOwner($owner)
    $acl.SetAccessRuleProtection($true, $false)
    $inheritance = if ($Directory) { [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
    foreach ($sid in @($owner, $system)) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', $inheritance, 'None', 'Allow'))
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Invoke-Keytool([string[]]$Arguments, [Security.SecureString]$Password) {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $KeytoolPath
    # Password values are passed only in the child's environment, never command arguments.
    $start.Arguments = (($Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' ')
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $credential = [Management.Automation.PSCredential]::new('keytool', $Password)
    $start.EnvironmentVariables['SIRFBAZAR_KEYTOOL_PASSWORD'] = $credential.GetNetworkCredential().Password
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $output = $stdout.Result + $stderr.Result
        if ($process.ExitCode -ne 0) { throw "keytool failed (exit $($process.ExitCode)): $output" }
        return $output
    } finally {
        $start.EnvironmentVariables.Remove('SIRFBAZAR_KEYTOOL_PASSWORD')
        $process.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    [void][IO.Directory]::CreateDirectory($OutputDirectory)
    Protect-NewPath $OutputDirectory -Directory
}
if (-not (Test-Path -LiteralPath $OutputDirectory -PathType Container)) { throw 'Output path must be a directory.' }
$staging = Join-Path $OutputDirectory ('.sirfbazar-keygen-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($staging)
Protect-NewPath $staging -Directory

try {
    foreach ($name in $apps) {
        $alias = "sirfbazar-$name-release"
        $password = $null
        $confirmation = $null
        try {
            if ($GeneratePasswords) {
                $bytes = New-Object byte[] 32
                $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
                try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
                $password = ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force
                [Array]::Clear($bytes, 0, $bytes.Length)
                [Management.Automation.PSCredential]::new($alias, $password) |
                    Export-Clixml -LiteralPath (Join-Path $staging "$alias.password.clixml")
            } else {
                $password = Read-Host "New password for $alias (at least 12 characters)" -AsSecureString
                $confirmation = Read-Host 'Confirm password' -AsSecureString
                if ($password.Length -lt 12) { throw 'Use a password/passphrase of at least 12 characters.' }
                $first = [Management.Automation.PSCredential]::new('check', $password)
                $second = [Management.Automation.PSCredential]::new('check', $confirmation)
                if (-not [string]::Equals($first.GetNetworkCredential().Password, $second.GetNetworkCredential().Password, [StringComparison]::Ordinal)) {
                    throw 'Passwords do not match. No key for this app was created.'
                }
            }

            $keystore = Join-Path $staging "$alias.jks"
            $common = @('-keystore', $keystore, '-storetype', 'JKS', '-alias', $alias,
                '-storepass:env', 'SIRFBAZAR_KEYTOOL_PASSWORD')
            [void](Invoke-Keytool (@('-genkeypair', '-keyalg', 'RSA', '-keysize', '2048',
                '-sigalg', 'SHA256withRSA', '-validity', '10000', '-dname', "CN=$alias,O=SirfBazar",
                '-keypass:env', 'SIRFBAZAR_KEYTOOL_PASSWORD') + $common) $password)
            $fingerprints = Invoke-Keytool (@('-J-Duser.language=en', '-J-Duser.country=US', '-list', '-v') + $common) $password
            if ($fingerprints -notmatch 'PrivateKeyEntry' -or $fingerprints -notmatch 'SHA1:' -or $fingerprints -notmatch 'SHA256:') {
                throw 'Generated keystore verification failed.'
            }
            $fingerprints | Set-Content -LiteralPath (Join-Path $staging "$alias.fingerprints.txt") -Encoding UTF8
            [void](Invoke-Keytool (@('-exportcert', '-rfc', '-file', (Join-Path $staging "$alias.certificate.pem")) + $common) $password)
            foreach ($file in Get-ChildItem -LiteralPath $staging -File) {
                $target = Join-Path $OutputDirectory $file.Name
                if (Test-Path -LiteralPath $target) { throw "Refusing to overwrite: $target" }
                Protect-NewPath $file.FullName
                Move-Item -LiteralPath $file.FullName -Destination $target -ErrorAction Stop
            }
            Write-Host "Created: $(Join-Path $OutputDirectory "$alias.jks")"
            Write-Host "Alias: $alias; package: pk.sirfbazar.$name"
            Write-Host (($fingerprints -split '\r?\n' | Where-Object { $_ -match '^\s*SHA(1|256):' }) -join [Environment]::NewLine)
        } finally {
            if ($password) { $password.Dispose() }
            if ($confirmation) { $confirmation.Dispose() }
        }
    }
} finally {
    if (@(Get-ChildItem -LiteralPath $staging -Force).Count -eq 0) {
        Remove-Item -LiteralPath $staging
    } else {
        Write-Warning "Partial output retained securely for recovery: $staging. Do not delete it without inspection."
    }
}
if ($GeneratePasswords) {
    Write-Host 'Generated passwords are DPAPI-encrypted in .password.clixml files for this Windows account/computer only.'
    Write-Host 'Back up the keystores and put their passwords in a separate password manager before using them.'
} else {
    Write-Host 'Passwords were not saved. Store them in a password manager and back up the keystores.'
}
Write-Host 'EAS, Google OAuth, existing keystores, and previously built APKs were not changed.'
