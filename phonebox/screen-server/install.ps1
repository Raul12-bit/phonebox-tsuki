# Builds ScreenServer.cs with the C# compiler that ships with Windows (.NET Framework 4.x), installs it to
# %LOCALAPPDATA%\PhoneRemote, starts it with Windows and starts it now.
# Autostart is doubled up on purpose:
#   * Startup folder shortcut (as before);
#   * scheduled task "PhoneRemote Keepalive": at sign-in and every 5 minutes. The server is single-instance, so a
#     start while it runs is a no-op, and a crashed server is back within 5 minutes. The server itself restarts the
#     PhoneBox agent when that one is not running.
# Run from a normal (not administrator) PowerShell, NOT from the Claude app's terminal (its AppData is virtualized):
#   powershell -ExecutionPolicy Bypass -File install.ps1
param([string]$Log = "$env:USERPROFILE\phoneremote-install.txt")
$ErrorActionPreference = 'Stop'
Start-Transcript -Path $Log -Force | Out-Null
try {
    $src = Join-Path $PSScriptRoot 'ScreenServer.cs'
    $dest = Join-Path $env:LOCALAPPDATA 'PhoneRemote'
    $exe = Join-Path $dest 'ScreenServer.exe'
    $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    if (-not (Test-Path $csc)) { throw "C# compiler not found at $csc" }
    New-Item -ItemType Directory -Force $dest | Out-Null

    Get-Process ScreenServer -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Milliseconds 500
    & $csc /nologo /optimize+ /target:winexe /platform:anycpu /r:System.Drawing.dll "/out:$exe" $src
    if ($LASTEXITCODE -ne 0) { throw "compile failed ($LASTEXITCODE)" }

    $startup = [Environment]::GetFolderPath('Startup')
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut((Join-Path $startup 'PhoneRemote Screen.lnk'))
    $link.TargetPath = $exe
    $link.WorkingDirectory = $dest
    $link.Description = 'PhoneRemote screen server (phone screen view)'
    $link.Save()

    try {
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
        $trigger.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)).Repetition
        $action = New-ScheduledTaskAction -Execute $exe -WorkingDirectory $dest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
            -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1)
        $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
        Register-ScheduledTask -TaskName 'PhoneRemote Keepalive' -Action $action -Trigger $trigger -Settings $settings `
            -Principal $principal -Description 'Keeps the PhoneRemote screen server (and through it the PhoneBox agent) running' -Force | Out-Null
        Write-Host 'scheduled task: PhoneRemote Keepalive (sign-in + every 5 min)'
    } catch { Write-Host "scheduled task not created: $($_.Exception.Message)" }

    Start-Process -FilePath $exe -WorkingDirectory $dest -WindowStyle Hidden
    Write-Host "installed: $exe (starts with Windows)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
} finally { Stop-Transcript | Out-Null }
