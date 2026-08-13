$ErrorActionPreference = "Stop"
$path = Join-Path (Get-Location) "server\db.ts"
if (-not (Test-Path $path)) { throw "server\db.ts was not found. Run this from the Study-OS project root." }
$content = Get-Content $path -Raw
if ($content -match 'pinned\?:\s*boolean') { Write-Host "db.ts already has pinned. Nothing to change."; exit 0 }
$needle = '    documentId?: number;'
if (-not $content.Contains($needle)) { throw "Could not find the lesson data type in server/db.ts. No changes made." }
Copy-Item $path "$path.bak" -Force
$content = $content.Replace($needle, $needle + "`r`n    pinned?: boolean;")
Set-Content $path $content -NoNewline
Write-Host "Fixed server/db.ts. Backup created at server\db.ts.bak"
