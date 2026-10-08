#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('customer', 'merchant', 'rider')]
    [string]$App,
    [string]$Directory = 'D:\keys\SirfBazar'
)

$ErrorActionPreference = 'Stop'
$file = Join-Path $Directory "sirfbazar-$App-release.password.clixml"
if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw 'No generated-password backup found. Manually chosen passwords are not saved by the creation script.'
}
$credential = Import-Clixml -LiteralPath $file
if ($credential -isnot [Management.Automation.PSCredential]) { throw 'Unexpected password backup format.' }
Write-Warning 'The next line is a private password. Do not share your screen, record this console, or paste it into chat.'
if ((Read-Host 'Type SHOW to reveal this password locally') -cne 'SHOW') { return }
try { Write-Host $credential.GetNetworkCredential().Password } finally { $credential.Password.Dispose() }
