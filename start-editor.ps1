$ErrorActionPreference = 'Stop'
$editorRoot = $PSScriptRoot
$editorUrl = 'http://127.0.0.1:4310/'
function Test-Editor {
    try { return (Invoke-WebRequest -Uri $editorUrl -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { return $false }
}
if (-not (Test-Editor)) {
    $editorNodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $editorNode = if ($editorNodeCommand) { $editorNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
    if (-not (Test-Path -LiteralPath $editorNode)) { throw 'Node.js is required. Install Node.js 22.12 or later.' }
    if (-not (Test-Path -LiteralPath (Join-Path $editorRoot 'node_modules\tsx'))) { throw 'Dependencies are missing. Run pnpm install in this folder first.' }
    if (-not (Test-Path -LiteralPath (Join-Path $editorRoot 'dist\index.html'))) { throw 'Build is missing. Run pnpm build in this folder first.' }
    $env:PORT = '4310'
    $env:HOST = '127.0.0.1'
    $editorProcess = Start-Process -FilePath $editorNode -ArgumentList @('--import', 'tsx', 'server/index.ts') -WorkingDirectory $editorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $editorRoot 'server.local.log') -RedirectStandardError (Join-Path $editorRoot 'server.local.err.log') -PassThru
    $editorReady = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (Test-Editor) { $editorReady = $true; break }
        $editorProcess.Refresh()
        if ($editorProcess.HasExited) { throw 'Editor failed to start. See server.local.err.log.' }
        Start-Sleep -Milliseconds 500
    }
    if (-not $editorReady) { throw 'Editor startup timed out. See server.local.err.log.' }
}
Start-Process $editorUrl
Write-Host "Editor ready: $editorUrl"
