param(
    [string]$BaseUrl = "http://localhost:8000",
    [string]$LogPath = (Join-Path -Path (Get-Location) -ChildPath "All_Seed_Data.log"),
    [int]$HoursAhead = 168,
    [int]$MaxSports = 1000,
    [int]$MaxEventsPerSport = 500,
    [string]$Regions = "us,us2,us_dfs,us_ex",
    [string[]]$Bookmakers = @(
        'betonlineag','betmgm','betrivers','betus','bovada','williamhill_us','draftkings','fanatics','fanduel','lowvig','mybookieag',
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

    $trimmedBase = $BaseUrl.TrimEnd('/')
    $queryPairs = @()

    foreach ($entry in $Query.GetEnumerator()) {
        $queryValue = ConvertTo-QueryValue -Value $entry.Value

        if ($null -ne $queryValue -and $queryValue -ne '') {
            $queryPairs += "$($entry.Key)=$([Uri]::EscapeDataString($queryValue))"
        }
    }

    $uri = "$trimmedBase$Path"

    if ($queryPairs.Count -gt 0) {
        $uri = "$uri?${($queryPairs -join '&')}"
    }

    Add-Content -Path $LogPath -Value ""
    Add-Content -Path $LogPath -Value "===== $Name ====="
    Add-Content -Path $LogPath -Value "GET $uri"

    try {
        $response = Invoke-RestMethod -Method Get -Uri $uri -ErrorAction Stop
        $responseJson = $response | ConvertTo-Json -Depth 12
        Add-Content -Path $LogPath -Value $responseJson
    } catch {
        Add-Content -Path $LogPath -Value "ERROR: $($_.Exception.Message)"

        if ($_.ErrorDetails) {
            Add-Content -Path $LogPath -Value "DETAILS: $($_.ErrorDetails.Message)"
        }
    }
}

Set-Content -Path $LogPath -Value "All seed data snapshot run started at $(Get-Date -Format o)"
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

Invoke-Snapshot -Name "Sport names snapshot" -Path "/api/sport-names-snapshot" -Query @{
    hoursAhead = $HoursAhead
    maxSports = $MaxSports
    maxEventsPerSport = $MaxEventsPerSport
    regions = $Regions
    bookmakers = $Bookmakers
    useCache = 'false'
}

Invoke-Snapshot -Name "Team names snapshot" -Path "/api/team-names-snapshot" -Query @{
    hoursAhead = $HoursAhead
    maxSports = $MaxSports
    maxEventsPerSport = $MaxEventsPerSport
    regions = $Regions
    bookmakers = $Bookmakers
    useCache = 'false'
}

Invoke-Snapshot -Name "Player names snapshot" -Path "/api/player-names-snapshot" -Query @{
    hoursAhead = $HoursAhead
    maxSports = $MaxSports
    maxEventsPerSport = $MaxEventsPerSport
    regions = $Regions
    bookmakers = $Bookmakers
    useCache = 'false'
}

Invoke-Snapshot -Name "Markets discovery (dangerous crawl)" -Path "/api/markets-discovery" -Query @{
    dangerous = 'true'
    sports = 'all'
    maxSports = $MaxSports
    maxEventsPerSport = $MaxEventsPerSport
    bookmakers = $Bookmakers
    regions = $Regions
}

Add-Content -Path $LogPath -Value ""
Add-Content -Path $LogPath -Value "All seed data snapshot run finished at $(Get-Date -Format o)"
