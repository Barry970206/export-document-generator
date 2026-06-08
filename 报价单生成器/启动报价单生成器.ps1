$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexPath = Join-Path $appRoot "index.html"
$appUrl = (New-Object System.Uri($indexPath)).AbsoluteUri

$browserCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$browser = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $browser) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("Chrome or Edge was not found. Please install one of them first.", "Quotation Generator")
  exit 1
}

Start-Process -FilePath $browser -ArgumentList @(
  "--app=$appUrl",
  "--window-size=1280,900"
)
