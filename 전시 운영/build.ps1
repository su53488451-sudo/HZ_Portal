$ErrorActionPreference = 'Stop'
$operations = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$workspace = [IO.Path]::GetFullPath((Split-Path -Parent $operations)).TrimEnd('\')
$source = Join-Path $workspace 'Project\web'
$snapshot = Join-Path $operations 'web'
$archive = Join-Path $workspace '전시 운영.zip'

if (-not (Test-Path -LiteralPath (Join-Path $source 'index.html'))) {
  throw "Source web files are missing: $source"
}
if (-not $snapshot.StartsWith($operations + '\', [StringComparison]::OrdinalIgnoreCase) -or
    $archive -ne (Join-Path $workspace '전시 운영.zip')) {
  throw 'Unsafe package path.'
}

$compiler = @(
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) { throw 'The .NET Framework C# compiler is required to build the EXE files.' }

if (Test-Path -LiteralPath $snapshot) { Remove-Item -LiteralPath $snapshot -Recurse -Force }
Copy-Item -LiteralPath $source -Destination $snapshot -Recurse -Force

$code = Join-Path $operations 'Launcher.cs'
$start = Join-Path $operations '전시 시작.exe'
$stop = Join-Path $operations '전시 종료.exe'
& $compiler /nologo /target:winexe /platform:anycpu /reference:System.Windows.Forms.dll "/out:$start" $code
if ($LASTEXITCODE -ne 0) { throw 'Could not build the Start EXE.' }
& $compiler /nologo /target:winexe /platform:anycpu /define:STOP /reference:System.Windows.Forms.dll "/out:$stop" $code
if ($LASTEXITCODE -ne 0) { throw 'Could not build the Stop EXE.' }

$packed = $false
for ($attempt = 0; $attempt -lt 5; $attempt++) {
  try {
    Compress-Archive -LiteralPath $operations -DestinationPath $archive -CompressionLevel Optimal -Force -ErrorAction Stop
    $packed = $true
    break
  } catch {
    if ($attempt -eq 4) { throw }
    Start-Sleep -Seconds 1
  }
}
Write-Host "Package ready: $archive"
