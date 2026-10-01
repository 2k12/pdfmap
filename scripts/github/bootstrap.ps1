<#
.SYNOPSIS
  Inicializa un repositorio de GitHub EXISTENTE con etiquetas, hitos e issues por requisito (RF/RNF).
.DESCRIPTION
  Idempotente: actualiza etiquetas existentes (--force) y no duplica hitos ni issues.
  Requiere la CLI gh autenticada (gh auth status).
.EXAMPLE
  .\scripts\github\bootstrap.ps1                       # repo del directorio actual
  .\scripts\github\bootstrap.ps1 -Repo 2k12/pdfmap -DryRun
#>
param(
  [string]$Repo = "",
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$LabelsFile = Join-Path $Root ".github\labels.yml"
$ReqsFile = Join-Path $Root "scripts\github\requirements.tsv"

if (-not $Repo) { $Repo = gh repo view --json nameWithOwner -q .nameWithOwner }
Write-Host "Repositorio: $Repo"

function Invoke-Gh {
  param([string[]]$GhArgs)
  if ($DryRun) { Write-Host "[dry-run] gh $($GhArgs -join ' ')" }
  else { gh @GhArgs | Out-Null; if ($LASTEXITCODE -ne 0) { throw "gh falló: $($GhArgs -join ' ')" } }
}

# 1. Etiquetas ---------------------------------------------------------------------------
Write-Host "== Etiquetas =="
$labels = @()
$current = $null
foreach ($line in Get-Content $LabelsFile -Encoding UTF8) {
  if ($line -match '^- name: (.+)$') {
    if ($current) { $labels += $current }
    $current = @{ name = $Matches[1].Trim(); color = ""; description = "" }
  } elseif ($line -match '^\s+color: "?([0-9a-fA-F]{6})"?') {
    $current.color = $Matches[1]
  } elseif ($line -match '^\s+description: (.+)$') {
    $current.description = $Matches[1].Trim()
  }
}
if ($current) { $labels += $current }
foreach ($l in $labels) {
  Invoke-Gh @("label", "create", $l.name, "--repo", $Repo, "--color", $l.color, "--description", $l.description, "--force")
  Write-Host "  ✓ $($l.name)"
}

# 2. Hitos -------------------------------------------------------------------------------
Write-Host "== Hitos =="
$existingMs = @(gh api "repos/$Repo/milestones?state=all&per_page=100" --jq '.[].title')
$milestones = [ordered]@{
  "v0.1 MVP extracción" = "Carga pesada, extracción y procesamiento en segundo plano (RF-01..05, RF-14)"
  "v0.2 Mapeo visual"   = "Reglas, campos, tipos y acciones (RF-06..10)"
  "v0.3 Diseño Excel"   = "Columnas, vista previa, plantillas, exportación y cuadre (RF-11..13, RF-15, RF-16)"
  "v1.0 Release"        = "Resultados paginados, borrado y RNF-01..09"
}
foreach ($title in $milestones.Keys) {
  if ($existingMs -contains $title) { Write-Host "  = $title (ya existe)"; continue }
  Invoke-Gh @("api", "repos/$Repo/milestones", "-f", "title=$title", "-f", "description=$($milestones[$title])")
  Write-Host "  ✓ $title"
}

# 3. Issues por requisito ------------------------------------------------------------------
Write-Host "== Issues de requisitos =="
$existingIssues = @(gh issue list --repo $Repo --state all --limit 1000 --json title --jq '.[].title')
$reqs = Import-Csv -Path $ReqsFile -Delimiter "`t" -Encoding UTF8
foreach ($r in $reqs) {
  $issueTitle = "[$($r.id)] $($r.title)"
  if ($existingIssues | Where-Object { $_ -like "*[[]$($r.id)[]]*" }) {
    Write-Host "  = $issueTitle (ya existe)"; continue
  }
  $body = @"
## Requisito $($r.id)

$($r.title)

- Especificación: [SRS §3](../blob/main/docs/01-requisitos/SRS-IEEE-830.md#$($r.srs_anchor))
- Casos de prueba y trazabilidad: [RTM](../blob/main/docs/04-testing/matriz-trazabilidad-RTM.md)

### Definition of Done
- [ ] Criterios de aceptación del SRS implementados
- [ ] Tests marcados con ``@pytest.mark.req("$($r.id)")`` / ``[$($r.id)]``
- [ ] RTM y documentación actualizadas
- [ ] CI verde y PR aprobado
"@
  Invoke-Gh @("issue", "create", "--repo", $Repo, "--title", $issueTitle, "--body", $body,
    "--label", "type/requirement,priority/$($r.priority),$($r.area)", "--milestone", $r.milestone)
  Write-Host "  ✓ $issueTitle"
}
Write-Host "Listo."
