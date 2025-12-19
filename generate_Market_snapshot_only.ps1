param(
    [string]$BaseUrl = "http://localhost:8000",
    [string]$LogPath = (Join-Path -Path (Get-Location) -ChildPath "LatestSnapshotMarket.log"),
    [int]$HoursAhead = 168,
    [int]$MaxSports = 1000,
    [int]$MaxEventsPerSport = 500,
    [string]$Regions = "us,us2,us_dfs,us_ex",
    [string[]]$Bookmakers = @(
        'betonlineag','betmgm','betrivers','betus','bovada','williamhill_us','draftkings','fanatics','fanduel','lowvigeag',
        'ballybet','betanysports','betparx','espnbet','fliff','hardrockbet','rebet',
        'betr_us_dfs','pick6','prizepicks','underdog',
        'betopenly','kalshi','novig','prophetx'
    )
)

$ErrorActionPreference = 'Stop'

$BaseUrl = $BaseUrl.Trim()
$parsedBaseUrl = $null
if (-not [Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref]$parsedBaseUrl) -or $parsedBaseUrl.Scheme -notin @('http', 'https')) {
    throw "BaseUrl must include http:// or https:// and a hostname (e.g., http://localhost:8000)"
}

function ConvertTo-QueryValue {
    param([object]$Value)

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        return ($Value | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ -ne '' }) -join ','
    }

    return [string]$Value
}

function Invoke-Snapshot {
    param(
        [string]$Name,
        [string]$Path,
        [hashtable]$Query
    )

    $queryPairs = @()

    foreach ($entry in $Query.GetEnumerator()) {
        $queryValue = ConvertTo-QueryValue -Value $entry.Value

        if ($null -ne $queryValue -and $queryValue -ne '') {
            $queryPairs += "$($entry.Key)=$([Uri]::EscapeDataString($queryValue))"
        }
    }

    $normalizedPath = if ([string]::IsNullOrWhiteSpace($Path)) { '/' } else { $Path.Trim() }
    $relativePath = $normalizedPath.TrimStart('/')
    $resolvedUri = [Uri]::new($parsedBaseUrl, $relativePath)

    if ($queryPairs.Count -gt 0) {
        $uriBuilder = [UriBuilder]::new($resolvedUri)
        $uriBuilder.Query = ($queryPairs -join '&')
        $resolvedUri = $uriBuilder.Uri
    }

    Add-Content -Path $LogPath -Value "===== $Name ====="
    Add-Content -Path $LogPath -Value "GET $($resolvedUri.AbsoluteUri)"

    try {
        $response = Invoke-RestMethod -Method Get -Uri $resolvedUri -ErrorAction Stop
        $responseJson = $response | ConvertTo-Json -Depth 12
        Add-Content -Path $LogPath -Value $responseJson
    } catch {
        Add-Content -Path $LogPath -Value "ERROR: $($_.Exception.Message)"

        if ($_.ErrorDetails) {
            Add-Content -Path $LogPath -Value "DETAILS: $($_.ErrorDetails.Message)"
        }
    }
}

Set-Content -Path $LogPath -Value "Market snapshot run started at $(Get-Date -Format o)"
Add-Content -Path $LogPath -Value "Base URL: $BaseUrl"
Add-Content -Path $LogPath -Value "Hours ahead: $HoursAhead | Max sports: $MaxSports | Max events per sport: $MaxEventsPerSport"
Add-Content -Path $LogPath -Value "Regions: $Regions"
Add-Content -Path $LogPath -Value "Bookmakers: $(ConvertTo-QueryValue -Value $Bookmakers)"

Invoke-Snapshot -Name "Market snapshot (events, markets, odds)" -Path "/api/market-snapshot" -Query @{
    hoursAhead = $HoursAhead
    maxSports = $MaxSports
    maxEventsPerSport = $MaxEventsPerSport
    regions = $Regions
    bookmakers = $Bookmakers
}

Add-Content -Path $LogPath -Value ""
Add-Content -Path $LogPath -Value "Market snapshot run finished at $(Get-Date -Format o)"
