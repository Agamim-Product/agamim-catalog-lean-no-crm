<#
.SYNOPSIS
  Publishes a dataset package exported from add-dataset.html into data/consumer/.

.DESCRIPTION
  1. Writes every file in the package verbatim into data/consumer/.
  2. Adds the dataset to data/consumer/repositories.json and layers.json
     (items, total and facet counts).
  Refuses to run if the repository id or layer id is already published.
  Review with "git diff", then commit and push to main (GitHub Pages deploys from main).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\apply-package.ps1 -Package "$HOME\Downloads\dataset-4.package.json"
#>
param(
  [Parameter(Mandatory = $true)][string]$Package,
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$dataDir = Join-Path $Root 'data\consumer'
if (-not (Test-Path $dataDir)) { throw "Not found: $dataDir" }

function Read-Json([string]$Path) { [IO.File]::ReadAllText($Path, $utf8) | ConvertFrom-Json }
function Write-Text([string]$Path, [string]$Text) { [IO.File]::WriteAllText($Path, $Text, $utf8) }

function Bump($Facets, [string]$Facet, $Key) {
  if ($null -eq $Key -or "$Key" -eq '') { return }
  if (-not $Facets.PSObject.Properties[$Facet]) { $Facets | Add-Member -NotePropertyName $Facet -NotePropertyValue ([pscustomobject]@{}) }
  $f = $Facets.$Facet
  $k = "$Key"
  if ($f.PSObject.Properties[$k]) { $f.$k = [int]$f.$k + 1 } else { $f | Add-Member -NotePropertyName $k -NotePropertyValue 1 }
}

# ---- load + validate the package
$pkg = Read-Json $Package
if ($pkg.format -ne 'agamim-dataset-package') { throw "Not an agamim dataset package: $Package" }
$repoId = [int]$pkg.repoId
$layerId = [int]$pkg.layerId
$repoItem = $pkg.list.repo
$layerItem = $pkg.list.layer
Write-Host ("Package: repository {0} / layer {1} - {2}" -f $repoId, $layerId, $repoItem.nameEn)

$reposPath = Join-Path $dataDir 'repositories.json'
$layersPath = Join-Path $dataDir 'layers.json'
$repos = Read-Json $reposPath
$layers = Read-Json $layersPath
if ($repos.items | Where-Object { $_.id -eq $repoId }) { throw "Repository $repoId is already published in repositories.json" }
if ($layers.items | Where-Object { $_.id -eq $layerId }) { throw "Layer $layerId is already published in layers.json" }

# the full repository file carries card.cadence, which feeds the "frequency" facet
$fullName = "repositories__$repoId.json"
if (-not $pkg.files.PSObject.Properties[$fullName]) { throw "Package is missing $fullName" }
$full = $pkg.files.$fullName | ConvertFrom-Json

# ---- 1. write the dataset files verbatim
$written = 0
foreach ($p in $pkg.files.PSObject.Properties) {
  if ($p.Name -notmatch '^[A-Za-z0-9_\-]+\.(json|csv)$') { throw "Unexpected file name in package: $($p.Name)" }
  Write-Text (Join-Path $dataDir $p.Name) ([string]$p.Value)
  $written++
}

# ---- 2. update repositories.json
$items = @($repos.items) + @($repoItem)
$repos.items = $items
$f = $repos.facets
Bump $f 'access' $(if ($repoItem.restricted) { 'locked' } else { 'open' })
Bump $f 'core' $repoItem.core
Bump $f 'value' $repoItem.valueLevel
Bump $f 'phase' $repoItem.phase
Bump $f 'owner' $repoItem.ownerHe
Bump $f 'frequency' $full.card.cadence
if (-not $repoItem.restricted) {
  Bump $f 'slo' $repoItem.sloStatus
  Bump $f 'verdict' $repoItem.quality.verdict
}
$repos.total = $items.Count
Write-Text $reposPath (ConvertTo-Json -InputObject $repos -Depth 30 -Compress)

# ---- 3. update layers.json
$litems = @($layers.items) + @($layerItem)
$layers.items = $litems
$lf = $layers.facets
Bump $lf 'tier' $layerItem.tier
Bump $lf 'kind' $layerItem.kind
Bump $lf 'owner' $layerItem.ownerHe
$layers.total = $litems.Count
Write-Text $layersPath (ConvertTo-Json -InputObject $layers -Depth 30 -Compress)

Write-Host ("Done. Wrote {0} files, repositories.json now has {1} items, layers.json has {2}." -f $written, $items.Count, $litems.Count)
Write-Host "Next: review with 'git diff --stat', then commit and push to main."
