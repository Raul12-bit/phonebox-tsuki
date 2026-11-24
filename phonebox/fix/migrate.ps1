# Moves PhoneBox, the screen server and the wallpaper out of the Claude app's MSIX "virtual AppData"
# (%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache) into the real AppData folders, so they work the same
# after a reboot. Must run OUTSIDE the Claude app (a normal PowerShell window, or started via WMI).
# Keeps the old PhoneBox config, its Wi-Fi key and TLS certificate: the phone is paired with exactly those.
param([string]$Log = "$env:USERPROFILE\phoneremote-fix.txt")
$ErrorActionPreference = 'Continue'
$out = New-Object System.Collections.Generic.List[string]
function Note([string]$s) { $out.Add((Get-Date -Format 'HH:mm:ss ') + $s) }
$V = Join-Path $env:LOCALAPPDATA 'Packages\Claude_pzs8sxrjxfjjc\LocalCache'
$vRoam = Join-Path $V 'Roaming'; $vLocal = Join-Path $V 'Local'
try {
    if (-not (Test-Path "$vRoam\PhoneBox\config.json")) { throw "virtual PhoneBox config not found under $vRoam" }

    # 1. stop the agent and the screen server (whatever copy is running)
    Get-Process PhoneBoxAgent, ScreenServer -ErrorAction SilentlyContinue | ForEach-Object { Note "stop $($_.Name) $($_.Id) $($_.Path)"; $_.Kill(); $_.WaitForExit(10000) | Out-Null }
    Start-Sleep -Milliseconds 800

    # 2. keep the fresh default config the agent made this morning, just in case
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    if (Test-Path "$env:APPDATA\PhoneBox") { Copy-Item "$env:APPDATA\PhoneBox" "$env:APPDATA\PhoneBox.fresh-$stamp" -Recurse -Force; Note "backup -> PhoneBox.fresh-$stamp" }

    # 3. real copies of: PhoneBox settings (config, key, certificate, icons), PhoneBox app, screen server + key + wallpapers
    $pairs = @(
        @("$vRoam\PhoneBox", "$env:APPDATA\PhoneBox"),
        @("$vLocal\PhoneBox", "$env:LOCALAPPDATA\PhoneBox"),
        @("$vLocal\PhoneRemote", "$env:LOCALAPPDATA\PhoneRemote")
    )
    foreach ($p in $pairs) {
        New-Item -ItemType Directory -Force $p[1] | Out-Null
        Copy-Item (Join-Path $p[0] '*') $p[1] -Recurse -Force
        Note ("copied {0} -> {1} ({2} files)" -f $p[0], $p[1], (Get-ChildItem $p[1] -Recurse -File | Measure-Object).Count)
    }
    # adb from winget, if it only exists in the virtual folder
    $adbRel = 'Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe'
    if ((Test-Path "$vLocal\$adbRel") -and -not (Test-Path "$env:LOCALAPPDATA\$adbRel\platform-tools\adb.exe")) {
        New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\$adbRel" | Out-Null
        Copy-Item "$vLocal\$adbRel\*" "$env:LOCALAPPDATA\$adbRel" -Recurse -Force; Note 'copied adb (platform-tools)'
    }

    # 4. startup shortcuts pointing at the real files
    $startup = [Environment]::GetFolderPath('Startup'); $sh = New-Object -ComObject WScript.Shell
    foreach ($s in @(@('PhoneBox.lnk', "$env:LOCALAPPDATA\PhoneBox\app\PhoneBoxAgent.exe", 'PhoneBox agent'),
                     @('PhoneRemote Screen.lnk', "$env:LOCALAPPDATA\PhoneRemote\ScreenServer.exe", 'PhoneRemote screen server'))) {
        $l = $sh.CreateShortcut((Join-Path $startup $s[0])); $l.TargetPath = $s[1]; $l.WorkingDirectory = (Split-Path $s[1]); $l.Description = $s[2]; $l.Save()
        Note "startup $($s[0]) -> $($s[1]) exists=$(Test-Path $s[1])"
    }
    $menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'PhoneBox.lnk'
    if (Test-Path $menu) { $l = $sh.CreateShortcut($menu); $l.TargetPath = "$env:LOCALAPPDATA\PhoneBox\app\PhoneBoxAgent.exe"; $l.WorkingDirectory = "$env:LOCALAPPDATA\PhoneBox\app"; $l.Save(); Note 'start menu shortcut fixed' }

    # 5. start both again, from the real folders
    Start-Process "$env:LOCALAPPDATA\PhoneRemote\ScreenServer.exe" -WorkingDirectory "$env:LOCALAPPDATA\PhoneRemote"
    Start-Process "$env:LOCALAPPDATA\PhoneBox\app\PhoneBoxAgent.exe" -WorkingDirectory "$env:LOCALAPPDATA\PhoneBox\app"
    Note 'started agent and screen server'

    # 6. the Tsuki wallpaper, for real this time (remember the current one first)
    $k = 'HKCU:\Control Panel\Desktop'; $old = Get-ItemProperty $k
    [pscustomobject]@{ Wallpaper = $old.WallPaper; WallpaperStyle = $old.WallpaperStyle; TileWallpaper = $old.TileWallpaper } | ConvertTo-Json |
        Set-Content -Encoding utf8 "$env:LOCALAPPDATA\PhoneRemote\previous-wallpaper.json"
    $img = "$env:LOCALAPPDATA\PhoneRemote\tsuki-desktop-hd.png"
    if (Test-Path $img) {
        Set-ItemProperty $k -Name WallpaperStyle -Value '10'; Set-ItemProperty $k -Name TileWallpaper -Value '0'
        Add-Type -Namespace PR -Name W -MemberDefinition '[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool SystemParametersInfo(int a, int b, string c, int d);'
        Note ("wallpaper set: {0} (was {1})" -f [PR.W]::SystemParametersInfo(0x14, 0, $img, 3), $old.WallPaper)
    } else { Note "wallpaper image missing: $img" }
    Note 'done'
} catch { Note ("ERROR: " + $_.Exception.Message) }
$out | Set-Content -Encoding utf8 $Log
