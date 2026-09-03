// ============================================================
// ava-typehook.cs — دیمون هوک گلوبال کیبورد/موس برای «حباب تایپ صوتی»
// (v0.82 — خواستهٔ کاربر: «هر جا کاربر در حال تایپ بود یک چیز کوچولو
//  بالای همون صفحه تایپش پاپ بشه»)
// ------------------------------------------------------------
// ورودی:  argv[1] = PID پروسهٔ آوا (رویدادهای خودِ آوا = self، موقعیت
//                  حباب را جابه‌جا نمی‌کنند و ضبط را قطع نمی‌کنند)
// خروجی:  هر خط = یک JSON روی stdout (بلافاصله Flush):
//   EVT {"t":"key","fg":123,"pid":456,"self":false}          — یک کلید واقعی در پنجرهٔ دیگر
//   EVT {"t":"click","x":..,"y":..,"fg":..,"pid":..,"self":..} — کلیک چپ
//   STA {"fg":..,"pid":..,"self":..,"cx":..,"cy":..,"cok":true/false,
//        "mx":..,"my":..,"rx":..,"ry":..,"rw":..,"rh":..,"title":"…"} — هر ۴۰۰ms
// پایان:  بستن stdin از سمت والد → خروج تمیز.
// کامپایل: csc.exe .NET Framework (روی هر ویندوز ۱۰/۱۱ هست) — در main.js
// ============================================================
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

static class AvaHook
{
    // ---------- Win32 ----------
    delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)] static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string lpModuleName);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct GUITHREADINFO
    {
        public int cbSize; public uint flags; public IntPtr hwndActive; public IntPtr hwndFocus;
        public IntPtr hwndCapture; public IntPtr hwndMenuOwner; public IntPtr hwndMoveSize; public IntPtr hwndCaret;
        public RECT rcCaret;
    }
    [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint idThread, ref GUITHREADINFO gui);

    const int WH_KEYBOARD_LL = 13, WH_MOUSE_LL = 14;
    const int WM_KEYDOWN = 0x0100, WM_SYSKEYDOWN = 0x0104;
    const int WM_LBUTTONDOWN = 0x0201;
    const int LLKHF_INJECTED = 0x10;

    static HookProc kbProc, msProc; // جلوگیری از GC
    static IntPtr kbHook = IntPtr.Zero, msHook = IntPtr.Zero;
    static uint parentPid = 0;
    static long lastStatusAt = 0;
    static StreamWriter OUT;

    [StructLayout(LayoutKind.Sequential)] struct KBDLLHOOKSTRUCT { public uint vkCode; public uint scanCode; public uint flags; public uint time; public UIntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)] struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData; public uint flags; public uint time; public UIntPtr dwExtraInfo; }

    static IntPtr KbCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && (wParam.ToInt32() == WM_KEYDOWN || wParam.ToInt32() == WM_SYSKEYDOWN))
        {
            var k = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
            if ((k.flags & LLKHF_INJECTED) == 0) // تایپِ خودِ آوا (SendInput) دوباره‌تریگر نمی‌شود
            {
                EmitKey();
            }
        }
        return CallNextHookEx(kbHook, nCode, wParam, lParam);
    }

    static IntPtr MsCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && wParam.ToInt32() == WM_LBUTTONDOWN)
        {
            var m = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
            EmitClick(m.pt.X, m.pt.Y);
        }
        return CallNextHookEx(msHook, nCode, wParam, lParam);
    }

    static void EmitRaw(string json)
    {
        try { OUT.WriteLine(json); OUT.Flush(); } catch (_) { Environment.Exit(0); }
    }
    static void EmitKey()
    {
        var fg = GetForegroundWindow(); uint pid = 0; GetWindowThreadProcessId(fg, out pid);
        EmitRaw("EVT {\"t\":\"key\",\"fg\":" + fg + ",\"pid\":" + pid + ",\"self\":" + (pid == parentPid ? "true" : "false") + "}");
        lastStatusAt = 0; // وضعیت بلافاصله تازه شود
    }
    static void EmitClick(int x, int y)
    {
        var fg = GetForegroundWindow(); uint pid = 0; GetWindowThreadProcessId(fg, out pid);
        EmitRaw("EVT {\"t\":\"click\",\"x\":" + x + ",\"y\":" + y + ",\"fg\":" + fg + ",\"pid\":" + pid + ",\"self\":" + (pid == parentPid ? "true" : "false") + "}");
    }

    static void EmitStatus()
    {
        var fg = GetForegroundWindow(); uint pid = 0; uint tid = GetWindowThreadProcessId(fg, out pid);
        bool cok = false; int cx = 0, cy = 0;
        if (tid != 0)
        {
            var gui = new GUITHREADINFO(); gui.cbSize = Marshal.SizeOf(typeof(GUITHREADINFO));
            if (GetGUIThreadInfo(tid, ref gui) && gui.hwndCaret != IntPtr.Zero)
            {
                var p = new POINT(); p.X = gui.rcCaret.Left; p.Y = gui.rcCaret.Top;
                if (ClientToScreen(gui.hwndCaret, ref p)) { cx = p.X; cy = p.Y; cok = true; }
            }
        }
        var mp = new POINT(); GetCursorPos(out mp);
        RECT r; GetWindowRect(fg, out r);
        var sb = new StringBuilder(160); GetWindowText(fg, sb, 160);
        string title = (sb.ToString() ?? "").Replace("\\", "\\\\").Replace("\"", "'").Replace("\n", " ").Replace("\r", " ");
        if (title.Length > 80) title = title.Substring(0, 80);
        EmitRaw("STA {\"fg\":" + fg + ",\"pid\":" + pid + ",\"self\":" + (pid == parentPid ? "true" : "false")
            + ",\"cx\":" + cx + ",\"cy\":" + cy + ",\"cok\":" + (cok ? "true" : "false")
            + ",\"mx\":" + mp.X + ",\"my\":" + mp.Y
            + ",\"rx\":" + r.Left + ",\"ry\":" + r.Top + ",\"rw\":" + (r.Right - r.Left) + ",\"rh\":" + (r.Bottom - r.Top)
            + ",\"title\":\"" + title + "\"}");
    }

    static int Main(string[] args)
    {
        try { parentPid = (args.Length > 0) ? uint.Parse(args[0]) : 0; } catch (_) { parentPid = 0; }
        Console.OutputEncoding = Encoding.UTF8;
        OUT = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };
        // والد مُرد → stdin بسته می‌شود → خروج تمیز (هیچ پروسهٔ یتیمی نمی‌ماند)
        new Thread(() => { try { Console.In.ReadLine(); } catch (_) { } Environment.Exit(0); }) { IsBackground = true }.Start();

        var hMod = GetModuleHandle(null);
        kbProc = KbCallback; msProc = MsCallback;
        kbHook = SetWindowsHookEx(WH_KEYBOARD_LL, kbProc, hMod, 0);
        msHook = SetWindowsHookEx(WH_MOUSE_LL, msProc, hMod, 0);
        if (kbHook == IntPtr.Zero || msHook == IntPtr.Zero) { EmitRaw("ERR {\"e\":\"hook-failed\"}"); return 2; }

        // وضعیت (کرسر/پنجرهٔ فعال) هر ۴۰۰ms روی تایمر — مستقل از پمپ پیام
        using (var tmr = new System.Threading.Timer((_) => { try { EmitStatus(); } catch (_) { } }, null, 400, 400))
        {
            var msg = new NativeMessage();
            int r;
            while ((r = GetMessage(out msg, IntPtr.Zero, 0, 0)) > 0) { /* پمپ پیام هوک */ }
        }
        UnhookWindowsHookEx(kbHook); UnhookWindowsHookEx(msHook);
        return 0;
    }

    [StructLayout(LayoutKind.Sequential)] struct NativeMessage { public IntPtr handle; public uint msg; public IntPtr wParam; public IntPtr lParam; public uint time; public POINT p; }
    [DllImport("user32.dll")] static extern int GetMessage(out NativeMessage lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);
}
