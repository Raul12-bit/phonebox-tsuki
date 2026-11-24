# Turns the entertainment apps on the Redmi off (or back on). Nothing is uninstalled and no data is lost:
# `pm disable-user` only hides the app until it is enabled again.
# Banking, 2FA (Authy, 2FA, Steam Guard), messengers, Tailscale, RustDesk and PhoneBox are never touched.
#   powershell -ExecutionPolicy Bypass -File apps.ps1 -Off     # hide them
#   powershell -ExecutionPolicy Bypass -File apps.ps1 -On      # bring them back
param([switch]$Off, [switch]$On)
$adb = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { $adb = 'adb' }
$apps = [ordered]@{
    'com.zhiliaoapp.musically'       = 'TikTok'
    'com.instagram.android'          = 'Instagram'
    'com.instagram.barcelona'        = 'Threads'
    'com.facebook.katana'            = 'Facebook'
    'tv.twitch.android.app'          = 'Twitch'
    'com.innersloth.spacemafia'      = 'Among Us'
    'com.robtopx.geometryjump'       = 'Geometry Dash'
    'com.chess'                      = 'Chess.com'
    'com.jeffprod.cubesolver'        = 'Cube Solver'
    'com.spbtv.beekztv'              = 'Beeline TV'
    'com.spotify.music'              = 'Spotify'
    'kz.beeline.music'               = 'Beeline Music'
    'com.valvesoftware.steamlink'    = 'Steam Link'
}
if ($Off -eq $On) { Write-Host 'Pass -Off or -On'; exit 1 }
foreach ($pkg in $apps.Keys) {
    $cmd = if ($Off) { 'disable-user' } else { 'enable' }
    $args = if ($Off) { @('shell', 'pm', $cmd, '--user', '0', $pkg) } else { @('shell', 'pm', $cmd, $pkg) }
    $out = (& $adb @args 2>&1 | Out-String).Trim()
    '{0,-14} {1}' -f $apps[$pkg], $out
}
