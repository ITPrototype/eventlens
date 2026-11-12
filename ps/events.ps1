param(
  [Parameter(Mandatory=$true)][string]$Log,
  [int]$Hours = 24,
  [int]$Max = 2000
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8

$f = @{ LogName = $Log }
if ($Hours -gt 0) { $f.StartTime = (Get-Date).AddHours(-$Hours) }

try {
  $ev = Get-WinEvent -FilterHashtable $f -MaxEvents $Max
} catch {
  if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*' -or $_.Exception.Message -like '*No events were found*') {
    '[]'; exit 0
  }
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 2
}

$rows = foreach ($e in $ev) {
  if (-not $e.TimeCreated) { continue }
  $m = $e.Message
  if (-not $m) {
    try { $m = '(' + (($e.Properties | ForEach-Object { $_.Value }) -join ' | ') + ')' } catch { $m = '' }
  }
  if ($m -and $m.Length -gt 6000) { $m = $m.Substring(0, 6000) + ' …' }
  $uid = $null
  if ($e.UserId) { $uid = $e.UserId.Value }
  [pscustomobject]@{
    t    = ([DateTimeOffset]$e.TimeCreated).ToUnixTimeMilliseconds()
    id   = $e.Id
    lvl  = $e.Level
    log  = $e.LogName
    src  = $e.ProviderName
    host = $e.MachineName
    rec  = $e.RecordId
    task = $e.TaskDisplayName
    kw   = ($e.KeywordsDisplayNames -join ', ')
    pid  = $e.ProcessId
    user = $uid
    msg  = $m
  }
}
if (-not $rows) { '[]'; exit 0 }
ConvertTo-Json -InputObject @($rows) -Compress -Depth 3
