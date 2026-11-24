// PhoneRemote screen server v2: JPEG snapshots of the laptop screen plus mouse / keyboard / text input from the phone.
//
// * Listens on 127.0.0.1:8790 only. The phone reaches it through `tailscale serve` (HTTPS, tailnet devices only),
//   so it works from any network the phone is on, as long as Tailscale is up on both ends.
// * Every request needs the secret key from %LOCALAPPDATA%\PhoneRemote\key.txt (?k=...).
// * Captures only when a frame is requested: no work at all while nobody looks at the screen page.
// * Windowless (compiled as /target:winexe); single instance; C# 5 so the csc.exe built into Windows can compile it.
// * Keepalive: restarts the PhoneBox agent if it is not running (checked every 20 s).
//
// Endpoints (all GET, all need k=KEY):
//   /ping                      204, for latency measurement
//   /info                      {"w":..,"h":..,"v":2} screen size in pixels
//   /frame.jpg?w=1280&q=62     current screen with the cursor drawn in, at most w px wide, JPEG quality q (25..90)
//   /click?x=0.5&y=0.5&b=left|right|middle|double   moves to that fraction of the screen and clicks;
//                              without x/y it clicks where the cursor already is
//   /move?x=..&y=..            moves the cursor only
//   /moverel?dx=..&dy=..       moves the cursor by that many screen pixels (touchpad mode)
//   /down?x&y&b=left|right  /up?x&y&b=..   press / release (drag); x/y optional
//   /scroll?d=-3  /hscroll?d=2 wheel notches (negative = down / left), fractional values allowed
//   /key?c=ctrl+shift+t        a key combination (modifiers: ctrl alt shift win)
//   /type?s=text               types text as Unicode keystrokes (max 2000 chars); "\n" presses Enter
//   /mem                       Tsuki's memory (affection, stats, focus timer) as JSON, "{}" when there is none yet
//   /mem?set={...}             replaces it (one JSON object, at most 4096 chars). PhoneBox tiles run in sandboxed
//                              iframes without localStorage, so this small file is the only memory that survives
//                              a panel reload or a phone reboot; it is shared by the Главная tile and the idle screen.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

static class ScreenServer
{
    const int Port = 8790;
    const int MaxWidth = 1920;
    static string key;
    static string dir;
    static readonly object captureGate = new object();
    static readonly object inputGate = new object();
    static byte[] lastFrame;
    static int lastWidth, lastQuality;
    static DateTime lastAt = DateTime.MinValue;
    static ImageCodecInfo jpegCodec;

    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] static extern void mouse_event(int flags, int dx, int dy, int data, IntPtr extra);
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [DllImport("user32.dll")] static extern bool GetCursorInfo(ref CURSORINFO info);
    [DllImport("user32.dll")] static extern bool GetIconInfo(IntPtr icon, out ICONINFO info);
    [DllImport("user32.dll")] static extern bool DrawIconEx(IntPtr hdc, int x, int y, IntPtr icon, int w, int h, int step, IntPtr brush, int flags);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);

    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] struct CURSORINFO { public int cbSize; public int flags; public IntPtr hCursor; public POINT pt; }
    [StructLayout(LayoutKind.Sequential)] struct ICONINFO { public bool fIcon; public int xHotspot; public int yHotspot; public IntPtr hbmMask; public IntPtr hbmColor; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)] struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public INPUTUNION u; }

    const int LEFTDOWN = 0x02, LEFTUP = 0x04, RIGHTDOWN = 0x08, RIGHTUP = 0x10, MIDDLEDOWN = 0x20, MIDDLEUP = 0x40, WHEEL = 0x800, HWHEEL = 0x1000;
    const uint KEYUP = 0x0002, UNICODE = 0x0004, EXTENDED = 0x0001;

    static int Main()
    {
        bool created;
        using (var single = new Mutex(true, "PhoneRemoteScreenServer", out created))
        {
            if (!created) return 0; // already running (the keepalive task starts us every few minutes; that is a no-op)
            SetProcessDPIAware(); // capture real pixels, not the scaled desktop
            dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PhoneRemote");
            Directory.CreateDirectory(dir);
            key = LoadOrCreateKey(Path.Combine(dir, "key.txt"));
            foreach (var c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") jpegCodec = c;

            var keepalive = new Thread(KeepAgentAlive) { IsBackground = true, Name = "keepalive" };
            keepalive.Start();

            var listener = new TcpListener(IPAddress.Loopback, Port);
            try { listener.Start(); }
            catch (SocketException e) { Log("cannot listen on " + Port + ": " + e.Message); return 1; }
            Log("v2 listening on 127.0.0.1:" + Port);
            while (true)
            {
                TcpClient client;
                try { client = listener.AcceptTcpClient(); }
                catch (Exception e) { Log("accept: " + e.Message); Thread.Sleep(500); continue; }
                client.NoDelay = true;
                ThreadPool.QueueUserWorkItem(Handle, client);
            }
        }
    }

    // The PhoneBox agent is the phone's main channel. If it crashed or was never started, start it again.
    static void KeepAgentAlive()
    {
        var exe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"PhoneBox\app\PhoneBoxAgent.exe");
        Thread.Sleep(45000); // let the Startup folder start it first after sign-in
        while (true)
        {
            try
            {
                if (File.Exists(exe) && Process.GetProcessesByName("PhoneBoxAgent").Length == 0)
                {
                    Log("PhoneBox agent not running, starting it");
                    var psi = new ProcessStartInfo(exe) { WorkingDirectory = Path.GetDirectoryName(exe), UseShellExecute = true };
                    Process.Start(psi);
                    Thread.Sleep(60000);
                }
            }
            catch (Exception e) { Log("keepalive: " + e.Message); }
            Thread.Sleep(20000);
        }
    }

    static string LoadOrCreateKey(string path)
    {
        if (File.Exists(path))
        {
            var existing = File.ReadAllText(path).Trim();
            if (existing.Length >= 32) return existing;
        }
        var bytes = new byte[24];
        using (var rng = new RNGCryptoServiceProvider()) rng.GetBytes(bytes);
        var sb = new StringBuilder();
        foreach (var b in bytes) sb.Append(b.ToString("x2"));
        File.WriteAllText(path, sb.ToString());
        return sb.ToString();
    }

    static readonly byte[] Bad = Encoding.ASCII.GetBytes("bad request");

    static void Handle(object state)
    {
        var client = (TcpClient)state;
        try
        {
            client.ReceiveTimeout = 5000;
            client.SendTimeout = 10000;
            var stream = client.GetStream();
            var head = ReadHead(stream);
            if (head == null) return;
            var firstLine = head.Split(new[] { "\r\n" }, StringSplitOptions.None)[0].Split(' ');
            if (firstLine.Length < 2) { Send(stream, 400, "text/plain", Bad); return; }
            if (firstLine[0] == "OPTIONS") { Send(stream, 204, null, null); return; }
            if (firstLine[0] != "GET") { Send(stream, 405, "text/plain", Encoding.ASCII.GetBytes("GET only")); return; }
            var target = firstLine[1];
            var q = target.IndexOf('?');
            var path = q < 0 ? target : target.Substring(0, q);
            var query = q < 0 ? "" : target.Substring(q + 1);
            if (!SameKey(Param(query, "k"))) { Send(stream, 403, "text/plain", Encoding.ASCII.GetBytes("forbidden")); return; }

            int sw = GetSystemMetrics(0), sh = GetSystemMetrics(1);
            double x, y;
            bool hasXY = Num(query, "x", out x) & Num(query, "y", out y);
            switch (path)
            {
                case "/ping": Send(stream, 204, null, null); return;
                case "/info":
                    Send(stream, 200, "application/json", Encoding.ASCII.GetBytes("{\"w\":" + sw + ",\"h\":" + sh + ",\"v\":2}"));
                    return;
                case "/frame.jpg":
                {
                    int w, quality;
                    if (!int.TryParse(Param(query, "w"), out w)) w = 1280;
                    if (!int.TryParse(Param(query, "q"), out quality)) quality = 62;
                    w = Math.Max(320, Math.Min(MaxWidth, w));
                    quality = Math.Max(25, Math.Min(90, quality));
                    var jpeg = Frame(w, quality);
                    if (jpeg == null) Send(stream, 503, "text/plain", Encoding.ASCII.GetBytes("screen unavailable (locked?)"));
                    else Send(stream, 200, "image/jpeg", jpeg);
                    return;
                }
                case "/click":
                case "/move":
                case "/down":
                case "/up":
                {
                    if (path == "/move" && !hasXY) { Send(stream, 400, "text/plain", Bad); return; }
                    lock (inputGate)
                    {
                        if (hasXY) SetCursorPos((int)Math.Round(Clamp01(x) * (sw - 1)), (int)Math.Round(Clamp01(y) * (sh - 1)));
                        var b = Param(query, "b") ?? "left";
                        int downFlag = b == "right" ? RIGHTDOWN : b == "middle" ? MIDDLEDOWN : LEFTDOWN;
                        int upFlag = b == "right" ? RIGHTUP : b == "middle" ? MIDDLEUP : LEFTUP;
                        if (path == "/click")
                        {
                            int times = b == "double" ? 2 : 1;
                            for (int i = 0; i < times; i++) { mouse_event(downFlag, 0, 0, 0, IntPtr.Zero); mouse_event(upFlag, 0, 0, 0, IntPtr.Zero); }
                        }
                        else if (path == "/down") mouse_event(downFlag, 0, 0, 0, IntPtr.Zero);
                        else if (path == "/up") mouse_event(upFlag, 0, 0, 0, IntPtr.Zero);
                    }
                    Send(stream, 204, null, null);
                    return;
                }
                case "/moverel":
                {
                    double dx, dy;
                    if (!Num(query, "dx", out dx) || !Num(query, "dy", out dy)) { Send(stream, 400, "text/plain", Bad); return; }
                    lock (inputGate)
                    {
                        POINT p;
                        GetCursorPos(out p);
                        int nx = Math.Max(0, Math.Min(sw - 1, p.X + (int)Math.Round(Math.Max(-4000, Math.Min(4000, dx)))));
                        int ny = Math.Max(0, Math.Min(sh - 1, p.Y + (int)Math.Round(Math.Max(-4000, Math.Min(4000, dy)))));
                        SetCursorPos(nx, ny);
                    }
                    Send(stream, 204, null, null);
                    return;
                }
                case "/scroll":
                case "/hscroll":
                {
                    double d;
                    if (!Num(query, "d", out d)) d = 0;
                    d = Math.Max(-20, Math.Min(20, d));
                    int amount = (int)Math.Round(d * 120);
                    if (amount != 0) lock (inputGate) mouse_event(path == "/scroll" ? WHEEL : HWHEEL, 0, 0, amount, IntPtr.Zero);
                    Send(stream, 204, null, null);
                    return;
                }
                case "/key":
                {
                    var combo = Param(query, "c");
                    if (string.IsNullOrEmpty(combo) || !PressCombo(combo)) { Send(stream, 400, "text/plain", Encoding.ASCII.GetBytes("unknown key")); return; }
                    Send(stream, 204, null, null);
                    return;
                }
                case "/type":
                {
                    var text = Param(query, "s");
                    if (string.IsNullOrEmpty(text) || text.Length > 2000) { Send(stream, 400, "text/plain", Bad); return; }
                    TypeText(text);
                    Send(stream, 204, null, null);
                    return;
                }
                case "/mem":
                {
                    var set = Param(query, "set");
                    if (set == null) { Send(stream, 200, "application/json; charset=utf-8", Encoding.UTF8.GetBytes(ReadMemory())); return; }
                    if (!WriteMemory(set)) { Send(stream, 400, "text/plain", Encoding.ASCII.GetBytes("expected one JSON object, max 4096 chars")); return; }
                    Send(stream, 204, null, null);
                    return;
                }
                default:
                    Send(stream, 404, "text/plain", Encoding.ASCII.GetBytes("not found"));
                    return;
            }
        }
        catch (Exception e) { Log("request: " + e.GetType().Name + ": " + e.Message); }
        finally { try { client.Close(); } catch { } }
    }

    // ---- Tsuki's memory ---------------------------------------------------------------------------------------------

    const int MaxMemory = 4096;
    static readonly object memoryGate = new object();
    static string MemoryPath { get { return Path.Combine(dir, "tsuki-memory.json"); } }

    static string ReadMemory()
    {
        lock (memoryGate)
        {
            try { if (File.Exists(MemoryPath)) { var s = File.ReadAllText(MemoryPath, Encoding.UTF8).Trim(); if (LooksLikeObject(s)) return s; } }
            catch (Exception e) { Log("mem read: " + e.Message); }
            return "{}";
        }
    }

    // The tile owns the schema; the server only refuses what is obviously not one small JSON object, and writes through
    // a temp file so a crash mid-write never leaves half a file behind.
    static bool WriteMemory(string json)
    {
        json = json.Trim();
        if (json.Length > MaxMemory || !LooksLikeObject(json)) return false;
        lock (memoryGate)
        {
            try
            {
                var tmp = MemoryPath + ".tmp";
                File.WriteAllText(tmp, json, new UTF8Encoding(false));
                if (File.Exists(MemoryPath)) File.Replace(tmp, MemoryPath, null); else File.Move(tmp, MemoryPath);
                return true;
            }
            catch (Exception e) { Log("mem write: " + e.Message); return false; }
        }
    }

    // Balanced braces outside strings, starting with '{' and ending at the matching '}'. Not a full JSON parser (C# 5 on
    // .NET Framework has none built in without extra references), but enough to keep junk out of the file.
    static bool LooksLikeObject(string s)
    {
        if (s.Length < 2 || s[0] != '{' || s[s.Length - 1] != '}') return false;
        int depth = 0; bool inStr = false, esc = false;
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (inStr) { if (esc) esc = false; else if (c == '\\') esc = true; else if (c == '"') inStr = false; continue; }
            if (c == '"') inStr = true;
            else if (c == '{' || c == '[') depth++;
            else if (c == '}' || c == ']') { depth--; if (depth < 0 || (depth == 0 && i != s.Length - 1)) return false; }
            else if (c < ' ' && c != '\t' && c != '\r' && c != '\n') return false;
        }
        return depth == 0 && !inStr;
    }

    // ---- keyboard ---------------------------------------------------------------------------------------------------

    static readonly Dictionary<string, ushort> Vk = BuildKeys();
    static readonly HashSet<ushort> Extended = new HashSet<ushort> { 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0x5B, 0x5C, 0xA3, 0xA5 };

    static Dictionary<string, ushort> BuildKeys()
    {
        var d = new Dictionary<string, ushort>(StringComparer.OrdinalIgnoreCase);
        d["ctrl"] = 0xA2; d["control"] = 0xA2; d["alt"] = 0xA4; d["shift"] = 0xA0; d["win"] = 0x5B;
        d["enter"] = 0x0D; d["return"] = 0x0D; d["esc"] = 0x1B; d["escape"] = 0x1B; d["tab"] = 0x09; d["space"] = 0x20;
        d["backspace"] = 0x08; d["bksp"] = 0x08; d["delete"] = 0x2E; d["del"] = 0x2E; d["insert"] = 0x2D; d["ins"] = 0x2D;
        d["home"] = 0x24; d["end"] = 0x23; d["pgup"] = 0x21; d["pageup"] = 0x21; d["pgdn"] = 0x22; d["pagedown"] = 0x22;
        d["left"] = 0x25; d["up"] = 0x26; d["right"] = 0x27; d["down"] = 0x28;
        d["capslock"] = 0x14; d["printscreen"] = 0x2C; d["prtsc"] = 0x2C; d["apps"] = 0x5D; d["menu"] = 0x5D;
        d["volup"] = 0xAF; d["voldown"] = 0xAE; d["mute"] = 0xAD; d["playpause"] = 0xB3; d["next"] = 0xB0; d["prev"] = 0xB1; d["stop"] = 0xB2;
        d["."] = 0xBE; d[","] = 0xBC; d["-"] = 0xBD; d["="] = 0xBB; d["/"] = 0xBF; d[";"] = 0xBA; d["`"] = 0xC0;
        d["["] = 0xDB; d["]"] = 0xDD; d["\\"] = 0xDC; d["'"] = 0xDE;
        for (int i = 1; i <= 12; i++) d["f" + i] = (ushort)(0x70 + i - 1);
        for (char c = 'a'; c <= 'z'; c++) d[c.ToString()] = (ushort)char.ToUpperInvariant(c);
        for (char c = '0'; c <= '9'; c++) d[c.ToString()] = (ushort)c;
        return d;
    }

    static INPUT KeyInput(ushort vk, ushort scan, uint flags)
    {
        var i = new INPUT { type = 1 };
        i.u.ki = new KEYBDINPUT { wVk = vk, wScan = scan, dwFlags = flags };
        return i;
    }

    static bool PressCombo(string combo)
    {
        var parts = combo.ToLowerInvariant().Replace(" ", "").Split(new[] { '+' }, StringSplitOptions.RemoveEmptyEntries);
        if (combo.EndsWith("++")) { Array.Resize(ref parts, parts.Length + 1); parts[parts.Length - 1] = "="; } // "ctrl++" = zoom in
        var codes = new List<ushort>();
        foreach (var p in parts)
        {
            ushort vk;
            if (!Vk.TryGetValue(p, out vk)) return false;
            codes.Add(vk);
        }
        if (codes.Count == 0 || codes.Count > 5) return false;
        var inputs = new List<INPUT>();
        foreach (var c in codes) inputs.Add(KeyInput(c, 0, Extended.Contains(c) ? EXTENDED : 0));
        for (int i = codes.Count - 1; i >= 0; i--) inputs.Add(KeyInput(codes[i], 0, KEYUP | (Extended.Contains(codes[i]) ? EXTENDED : 0)));
        lock (inputGate) SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf(typeof(INPUT)));
        return true;
    }

    static void TypeText(string text)
    {
        var inputs = new List<INPUT>();
        foreach (var ch in text.Replace("\r\n", "\n"))
        {
            if (ch == '\n') { inputs.Add(KeyInput(0x0D, 0, 0)); inputs.Add(KeyInput(0x0D, 0, KEYUP)); continue; }
            if (ch == '\t') { inputs.Add(KeyInput(0x09, 0, 0)); inputs.Add(KeyInput(0x09, 0, KEYUP)); continue; }
            inputs.Add(KeyInput(0, ch, UNICODE));
            inputs.Add(KeyInput(0, ch, UNICODE | KEYUP));
        }
        lock (inputGate)
        {
            // in chunks: some apps drop keystrokes when one SendInput call carries thousands of them
            for (int i = 0; i < inputs.Count; i += 64)
            {
                var chunk = inputs.GetRange(i, Math.Min(64, inputs.Count - i)).ToArray();
                SendInput((uint)chunk.Length, chunk, Marshal.SizeOf(typeof(INPUT)));
                if (i + 64 < inputs.Count) Thread.Sleep(4);
            }
        }
    }

    // ---- http helpers -----------------------------------------------------------------------------------------------

    static double Clamp01(double v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    static bool Num(string query, string name, out double value)
    {
        value = 0;
        var s = Param(query, name);
        return s != null && double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out value) && !double.IsNaN(value) && !double.IsInfinity(value);
    }

    static bool SameKey(string given)
    {
        if (given == null || given.Length != key.Length) return false;
        int diff = 0;
        for (int i = 0; i < key.Length; i++) diff |= given[i] ^ key[i];
        return diff == 0;
    }

    static string Param(string query, string name)
    {
        foreach (var part in query.Split('&'))
        {
            var eq = part.IndexOf('=');
            if (eq > 0 && part.Substring(0, eq) == name)
            {
                try { return Uri.UnescapeDataString(part.Substring(eq + 1)); }
                catch (UriFormatException) { return null; }
            }
        }
        return null;
    }

    static string ReadHead(NetworkStream stream)
    {
        var buf = new byte[16384];
        int total = 0;
        while (total < buf.Length)
        {
            int n = stream.Read(buf, total, buf.Length - total);
            if (n <= 0) return null;
            total += n;
            var text = Encoding.ASCII.GetString(buf, 0, total);
            if (text.Contains("\r\n\r\n")) return text;
        }
        return null;
    }

    static void Send(NetworkStream stream, int status, string type, byte[] body)
    {
        var reason = status == 200 ? "OK" : status == 204 ? "No Content" : status == 403 ? "Forbidden" : status == 404 ? "Not Found" : "Error";
        var sb = new StringBuilder();
        sb.Append("HTTP/1.1 ").Append(status).Append(' ').Append(reason).Append("\r\n");
        sb.Append("Cache-Control: no-store\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n");
        sb.Append("Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET\r\n");
        if (type != null) sb.Append("Content-Type: ").Append(type).Append("\r\n");
        sb.Append("Content-Length: ").Append(body == null ? 0 : body.Length).Append("\r\n\r\n");
        var headBytes = Encoding.ASCII.GetBytes(sb.ToString());
        stream.Write(headBytes, 0, headBytes.Length);
        if (body != null && body.Length > 0) stream.Write(body, 0, body.Length);
    }

    // ---- capture ----------------------------------------------------------------------------------------------------

    // One capture serves every request that arrives within 70 ms, so two viewers never double the work.
    static byte[] Frame(int width, int quality)
    {
        lock (captureGate)
        {
            if (lastFrame != null && lastWidth == width && lastQuality == quality && (DateTime.UtcNow - lastAt).TotalMilliseconds < 70) return lastFrame;
            try
            {
                lastFrame = Capture(width, quality);
                lastWidth = width;
                lastQuality = quality;
                lastAt = DateTime.UtcNow;
                return lastFrame;
            }
            catch (Exception e) { Log("capture: " + e.Message); return null; }
        }
    }

    static byte[] Capture(int maxWidth, int quality)
    {
        int sw = GetSystemMetrics(0), sh = GetSystemMetrics(1);
        using (var full = new Bitmap(sw, sh, PixelFormat.Format24bppRgb))
        {
            int cx = -1, cy = -1;
            using (var g = Graphics.FromImage(full))
            {
                g.CopyFromScreen(0, 0, 0, 0, new Size(sw, sh), CopyPixelOperation.SourceCopy);
                var ci = new CURSORINFO();
                ci.cbSize = Marshal.SizeOf(typeof(CURSORINFO));
                if (GetCursorInfo(ref ci) && (ci.flags & 1) != 0)
                {
                    cx = ci.pt.X; cy = ci.pt.Y;
                    ICONINFO ii;
                    int hx = 0, hy = 0;
                    if (GetIconInfo(ci.hCursor, out ii))
                    {
                        hx = ii.xHotspot; hy = ii.yHotspot;
                        if (ii.hbmMask != IntPtr.Zero) DeleteObject(ii.hbmMask);
                        if (ii.hbmColor != IntPtr.Zero) DeleteObject(ii.hbmColor);
                    }
                    var hdc = g.GetHdc();
                    try { DrawIconEx(hdc, cx - hx, cy - hy, ci.hCursor, 0, 0, 0, IntPtr.Zero, 3); }
                    finally { g.ReleaseHdc(hdc); }
                }
            }
            int w = Math.Min(maxWidth, sw);
            int h = (int)Math.Round((double)sh * w / sw);
            using (var small = new Bitmap(w, h, PixelFormat.Format24bppRgb))
            {
                using (var g2 = Graphics.FromImage(small))
                {
                    g2.InterpolationMode = w < sw * 0.75 ? InterpolationMode.HighQualityBilinear : InterpolationMode.Bilinear;
                    g2.PixelOffsetMode = PixelOffsetMode.Half;
                    g2.DrawImage(full, 0, 0, w, h);
                    if (cx >= 0)
                    {
                        // a ring around the pointer: the real cursor is tiny on a phone screen
                        float x = cx * (float)w / sw, y = cy * (float)h / sh, r = Math.Max(10f, w / 90f);
                        g2.SmoothingMode = SmoothingMode.AntiAlias;
                        using (var dark = new Pen(Color.FromArgb(150, 0, 0, 0), 4f)) g2.DrawEllipse(dark, x - r, y - r, 2 * r, 2 * r);
                        using (var light = new Pen(Color.FromArgb(235, 255, 255, 255), 2f)) g2.DrawEllipse(light, x - r, y - r, 2 * r, 2 * r);
                    }
                }
                using (var ms = new MemoryStream())
                using (var ps = new EncoderParameters(1))
                {
                    ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)quality);
                    small.Save(ms, jpegCodec, ps);
                    return ms.ToArray();
                }
            }
        }
    }

    static void Log(string line)
    {
        try
        {
            var path = Path.Combine(dir ?? Path.GetTempPath(), "screen-server.log");
            if (File.Exists(path) && new FileInfo(path).Length > 256 * 1024) File.Delete(path);
            File.AppendAllText(path, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss ") + line + Environment.NewLine);
        }
        catch { }
    }
}
