param(
    [ValidateRange(1, 100)]
    [int]$Repeats = 10,
    [string]$GoCommand = 'go',
    [string]$DockerCommand = 'docker'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildRoot = Join-Path $projectRoot '.cache/clipx-benchmark'
New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null

$compilerSettings = @{
    GOCACHE = (Join-Path $buildRoot 'go-build')
    GOTOOLCHAIN = 'local'
    GOOS = 'linux'
    GOARCH = 'amd64'
    CGO_ENABLED = '0'
}
$previousSettings = @{}
foreach ($setting in $compilerSettings.Keys) {
    $previousSettings[$setting] = [Environment]::GetEnvironmentVariable($setting, 'Process')
    [Environment]::SetEnvironmentVariable($setting, $compilerSettings[$setting], 'Process')
}

Push-Location (Join-Path $projectRoot 'server')
try {
    & $GoCommand build -trimpath -buildvcs=false -o (Join-Path $buildRoot 'server') .
    if ($LASTEXITCODE -ne 0) { throw 'Go backend build failed.' }
    $goVersion = & $GoCommand env GOVERSION
} finally {
    Pop-Location
    foreach ($setting in $previousSettings.Keys) {
        [Environment]::SetEnvironmentVariable($setting, $previousSettings[$setting], 'Process')
    }
}

$sourceCommit = git -C $projectRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot read the source commit.' }

& $DockerCommand build --quiet --pull=false -f (Join-Path $PSScriptRoot 'Dockerfile') `
    -t clipx-benchmark:local $PSScriptRoot
if ($LASTEXITCODE -ne 0) { throw 'Benchmark image build failed.' }

& $DockerCommand run --rm --name "clipx-cv-benchmark-$PID" --network none `
    --cpus 4 --memory 2g --tmpfs '/run/clipx-benchmark:rw,size=1073741824' `
    --mount "type=bind,source=$PSScriptRoot,target=/bench" `
    --mount "type=bind,source=$(Join-Path $buildRoot 'server'),target=/opt/clipx/server,readonly" `
    --mount "type=bind,source=$(Join-Path $projectRoot 'server'),target=/source,readonly" `
    --env "CLIPX_SOURCE_COMMIT=$sourceCommit" --env "CLIPX_GO_VERSION=$goVersion" `
    --env "CLIPX_REPEATS=$Repeats" clipx-benchmark:local
if ($LASTEXITCODE -ne 0) { throw 'Benchmark failed; inspect benchmarks/results.json.' }
