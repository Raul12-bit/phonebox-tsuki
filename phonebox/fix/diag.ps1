# Lists what really is in the AppData folders (run outside the Claude app's MSIX container, e.g. via WMI).
param([string]$Out = "$env:USERPROFILE\phoneremote-diag.txt")
$r = @()
foreach ($p in @("$env:APPDATA\PhoneBox", "$env:LOCALAPPDATA\PhoneBox", "$env:LOCALAPPDATA\PhoneBox\app\PhoneBoxAgent.exe",
                 "$env:LOCALAPPDATA\PhoneRemote", "$env:LOCALAPPDATA\PhoneRemote\key.txt",
                 "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PhoneBox.lnk",
                 "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PhoneRemote Screen.lnk")) {
    $r += "{0} => {1}" -f $p, (Test-Path $p)
}
$r += "--- real Roaming\PhoneBox:"
$r += Get-ChildItem "$env:APPDATA\PhoneBox" -ErrorAction SilentlyContinue | ForEach-Object { "  {0} {1} {2}" -f $_.Name, $_.Length, $_.LastWriteTime }
$r += "--- real Local\PhoneRemote:"
$r += Get-ChildItem "$env:LOCALAPPDATA\PhoneRemote" -ErrorAction SilentlyContinue | ForEach-Object { "  {0} {1} {2}" -f $_.Name, $_.Length, $_.LastWriteTime }
$sh = New-Object -ComObject WScript.Shell
foreach ($l in Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\*.lnk" -ErrorAction SilentlyContinue) {
    $r += "startup: {0} -> {1}" -f $l.Name, $sh.CreateShortcut($l.FullName).TargetPath
}
$r += "wallpaper: " + (Get-ItemProperty 'HKCU:\Control Panel\Desktop').WallPaper
$r | Set-Content -Encoding utf8 $Out
