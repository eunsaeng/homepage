$ErrorActionPreference = "Stop"

$candidates = @()
if ($env:JAVA_HOME) {
    $candidates += $env:JAVA_HOME
}

$temurinRoot = Join-Path $env:LOCALAPPDATA "Programs\Temurin"
if (Test-Path $temurinRoot) {
    $candidates += Get-ChildItem $temurinRoot -Directory -Filter "jdk-25*" |
        Sort-Object Name -Descending |
        Select-Object -ExpandProperty FullName
}

$javaHome = $candidates |
    Select-Object -Unique |
    Where-Object {
        (Test-Path (Join-Path $_ "bin\java.exe")) -and
        (Select-String -Path (Join-Path $_ "release") -Pattern '^JAVA_VERSION="25' -Quiet)
    } |
    Select-Object -First 1

if (-not $javaHome) {
    throw "JDK 25 is required. Set JAVA_HOME to a JDK 25 installation or install Temurin 25 under LOCALAPPDATA\Programs\Temurin."
}

$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"
$gradleWrapper = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\apps\api\gradlew.bat"))
$projectDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\apps\api"))

& $gradleWrapper -p $projectDir @args
exit $LASTEXITCODE