$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$l = Get-WinEvent -ListLog * |
  Where-Object { $_.RecordCount -gt 0 } |
  Sort-Object LogName |
  ForEach-Object { [pscustomobject]@{ name = $_.LogName; n = $_.RecordCount } }
if (-not $l) { '[]'; exit 0 }
ConvertTo-Json -InputObject @($l) -Compress
