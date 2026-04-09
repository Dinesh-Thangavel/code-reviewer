# Fix .env file - remove duplicate AI_PROVIDER entries
$envFile = ".env"
$content = Get-Content $envFile -Raw

# Remove duplicate AI_PROVIDER entries, keep only the last one (claude)
$lines = Get-Content $envFile
$fixedLines = @()
$aiProviderFound = $false

foreach ($line in $lines) {
    if ($line -match "^AI_PROVIDER=") {
        if (-not $aiProviderFound) {
            # Skip first occurrence
            $aiProviderFound = $true
            continue
        } else {
            # Keep the last one (should be claude)
            $fixedLines += $line
        }
    } else {
        $fixedLines += $line
    }
}

# Write fixed content
$fixedLines | Set-Content $envFile -NoNewline

Write-Host "Fixed .env file - removed duplicate AI_PROVIDER entries"
Write-Host "Current AI_PROVIDER setting:"
Get-Content $envFile | Select-String "AI_PROVIDER"
