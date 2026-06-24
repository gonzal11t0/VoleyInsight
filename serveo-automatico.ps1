while ($true) {
    $line = ssh -R 80:localhost:3002 serveo.net 2>&1 | Select-Object -First 1
    if ($line -match 'https://[a-z0-9-]+\.serveousercontent\.com') {
        $url = $matches[0]
        Write-Host ""
        Write-Host "✅ URL DETECTADA:" $url
        Write-Host ""
        $url | Out-File -FilePath data\api_url.txt -Encoding utf8
        Write-Host "✅ URL GUARDADA en data/api_url.txt"
        Write-Host ""
    } else {
        Write-Host "⚠️ No se detectó URL en la primera línea"
    }
    Write-Host "🔄 Esperando 10 segundos antes de reconectar..."
    Start-Sleep -Seconds 10
}