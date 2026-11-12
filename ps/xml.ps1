param(
  [Parameter(Mandatory=$true)][string]$Log,
  [Parameter(Mandatory=$true)][long]$Rec
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try {
  $e = Get-WinEvent -LogName $Log -FilterXPath "*[System[EventRecordID=$Rec]]" -MaxEvents 1
  $e.ToXml()
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 2
}
