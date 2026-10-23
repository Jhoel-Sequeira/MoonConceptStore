$ErrorActionPreference = 'Stop'

$BackendDir = $PSScriptRoot
$VenvPython = Join-Path $BackendDir 'venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $VenvPython)) {
    $PythonLauncher = Get-Command py -ErrorAction SilentlyContinue
    if (-not $PythonLauncher) {
        throw 'No se encontró el lanzador py de Python. Instala Python 3 y vuelve a intentarlo.'
    }

    & $PythonLauncher.Source -3 -m venv (Join-Path $BackendDir 'venv')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno virtual.' }
    & $VenvPython -m pip install -r (Join-Path $BackendDir 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias del backend.' }
}

$null = & $VenvPython -c 'import uvicorn' 2>$null
if ($LASTEXITCODE -ne 0) {
    & $VenvPython -m pip install -r (Join-Path $BackendDir 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias del backend.' }
}

Push-Location $BackendDir
try {
    & $VenvPython -m uvicorn main:app --reload
    if ($LASTEXITCODE -ne 0) { throw 'Uvicorn terminó con un error.' }
}
finally {
    Pop-Location
}
