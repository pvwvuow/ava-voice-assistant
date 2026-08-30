
param(
  [string]$Action = 'focus',
  [string]$Mode = 'fg',
  [string]$Name = '',
  [int]$Dx = 46,
  [int]$Dy = 52,
  [int]$WaitMs = 6000,
  [int]$Retries = 1
)
$ErrorActionPreference = 'Stop'
try {
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace AvaDc2 {
  public struct RECT { public int Left, Top, Right, Bottom; }
  public struct POINT { public int X, Y; }
  public class W {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, UIntPtr dwExtraInfo);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cls, string win);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wp, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
  }
}
'@
$proc = Get-Process -Name Discord,DiscordCanary,DiscordPTB -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $proc) {
  # اگر دیسکورد با دیپ‌لینک در حال بالا آمدن است، تا $WaitMs میلی‌ثانیه صبر کن
  $waited = 0
  while ($waited -lt $WaitMs) {
    Start-Sleep -Milliseconds 600
    $waited += 600
    $proc = Get-Process -Name Discord,DiscordCanary,DiscordPTB -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($proc) { break }
  }
}
if (-not $proc) { Write-Output 'ERR:NO_DISCORD'; exit }
$hwnd = $proc.MainWindowHandle
$child = [AvaDc2.W]::FindWindowEx($hwnd, [IntPtr]::Zero, 'Chrome_RenderWidgetHostHWND', [IntPtr]::Zero)
if ($child -eq [IntPtr]::Zero) { $child = $hwnd }
Write-Output "DBG:PROC=$($proc.ProcessName) CHILD=$(if ($child -ne [IntPtr]::Zero) { 1 } else { 0 }) MODE=$Mode ACT=$Action"
$bg = ($Mode -eq 'bg')
$prevFg = [AvaDc2.W]::GetForegroundWindow()
$sc = @{ 0x11 = 0x1D; 0x10 = 0x2A; 0x4D = 0x32; 0x44 = 0x20; 0x48 = 0x23; 0x41 = 0x1E; 0x45 = 0x12; 0x4B = 0x25; 0x56 = 0x2F; 0x0D = 0x1C }
function Send-BgCombo([int[]]$vks) {
  foreach ($v in $vks) {
    $s = $sc[$v]; if (-not $s) { $s = 0 }
    $lp = [long]1 -bor ([long]$s -shl 16)
    [AvaDc2.W]::PostMessage($child, 0x100, [IntPtr]$v, [IntPtr]$lp) | Out-Null
  }
  Start-Sleep -Milliseconds 60
  for ($i = $vks.Length - 1; $i -ge 0; $i--) {
    $s = $sc[$vks[$i]]; if (-not $s) { $s = 0 }
    $lp = [long]0xC0000001 -bor ([long]$s -shl 16)
    [AvaDc2.W]::PostMessage($child, 0x101, [IntPtr]$vks[$i], [IntPtr]$lp) | Out-Null
  }
}
function Send-BgClick([int]$sx, [int]$sy) {
  $o = New-Object AvaDc2.POINT; $o.X = 0; $o.Y = 0
  [AvaDc2.W]::ClientToScreen($child, [ref]$o) | Out-Null
  $lp = [long](($sy - $o.Y) -shl 16) -bor [long](($sx - $o.X) -band 0xFFFF)
  [AvaDc2.W]::PostMessage($child, 0x201, [IntPtr]1, [IntPtr]$lp) | Out-Null
  Start-Sleep -Milliseconds 90
  [AvaDc2.W]::PostMessage($child, 0x202, [IntPtr]0, [IntPtr]$lp) | Out-Null
}
function Send-FgClick([int]$sx, [int]$sy) {
  [AvaDc2.W]::SetCursorPos($sx, $sy) | Out-Null
  Start-Sleep -Milliseconds 70
  [AvaDc2.W]::mouse_event(0x02, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [AvaDc2.W]::mouse_event(0x04, 0, 0, 0, [UIntPtr]::Zero)
}
function Click-At([int]$sx, [int]$sy) { if ($bg) { Send-BgClick $sx $sy } else { Send-FgClick $sx $sy } }
function Focus-Discord {
  [AvaDc2.W]::ShowWindow($hwnd, 9) | Out-Null
  [AvaDc2.W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [AvaDc2.W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 120
  [AvaDc2.W]::SetForegroundWindow($hwnd) | Out-Null
  Start-Sleep -Milliseconds 450
}
function Restore-Focus {
  if ($bg) { return }
  if ($prevFg -ne [IntPtr]::Zero -and $prevFg -ne $hwnd) {
    [AvaDc2.W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [AvaDc2.W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100
    [AvaDc2.W]::SetForegroundWindow($prevFg) | Out-Null
  }
}
function Try-CallClick {
  # دکمهٔ تماس: اول UIA (بدون فوکوس هم کار می‌کند)، بعد مختصات دستی
  # چند بار تلاش می‌شود (بارگذاری DM ممکن است چند ثانیه طول بکشد)
  for ($tryN = 1; $tryN -le $Retries; $tryN++) {
    try {
      Add-Type -AssemblyName UIAutomationClient | Out-Null
      Add-Type -AssemblyName UIAutomationTypes | Out-Null
      $root = [System.Windows.Automation.AutomationElement]::RootElement
      $hwndCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NativeWindowHandleProperty, $hwnd)
      $win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $hwndCond)
      if ($win) {
        $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
        $btns = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
        Write-Output "DBG:TRY=$tryN BTNS=$($btns.Count)"
        foreach ($pass in 1, 2) {
          foreach ($b in $btns) {
            $bn = ''
            try { $bn = $b.Current.Name } catch {}
            if (-not $bn) { continue }
            if ($bn -match 'Video|ویدیو|دوربین|End|قطع|Screen|اشتراک') { continue }
            $ok = $false
            if ($pass -eq 1) { $ok = ($bn -match 'Start Voice Call|Voice Call|Voice|تماس صوتی|شروع تماس|صوتی') }
            else { $ok = ($bn -match 'Call|تماس') }
            if (-not $ok) { continue }
            Write-Output "DBG:HIT=$bn PASS=$pass"
            try { ($b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke(); Restore-Focus; return 'OK:CALLING' } catch {}
            try {
              $r = $b.Current.BoundingRectangle
              $cx = [int]($r.X + $r.Width / 2); $cy = [int]($r.Y + $r.Height / 2)
              Click-At $cx $cy
              Restore-Focus
              return 'OK:CALLING'
            } catch {}
          }
        }
      }
    } catch {}
    Start-Sleep -Milliseconds 1100
  }
  # فالبک مختصات دستی: گوشهٔ بالا-راست پنجره (سرستون DM)
  Write-Output 'DBG:UIA_MISS'
  $r2 = New-Object AvaDc2.RECT
  [AvaDc2.W]::GetWindowRect($hwnd, [ref]$r2) | Out-Null
  $tx = $r2.Right - $Dx
  $ty = $r2.Top + $Dy
  if ($tx -gt $r2.Left -and $ty -gt $r2.Top) {
    Click-At $tx $ty
    Restore-Focus
    return 'OK:CALL_CLICKED'
  }
  Restore-Focus
  return 'ERR:NOBTN'
}
switch ($Action) {
  'focus'    { if (-not $bg) { Focus-Discord }; Write-Output 'OK' }
  'mute'     { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x4D) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+m'); Start-Sleep -Milliseconds 250 }; Write-Output 'OK:MUTE' }
  'deafen'   { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x44) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+d'); Start-Sleep -Milliseconds 250 }; Write-Output 'OK:DEAFEN' }
  'hangup'   { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x48) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+h'); Start-Sleep -Milliseconds 250 }; Restore-Focus; Write-Output 'OK:HANGUP' }
  'answer'   { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x41) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+a'); Start-Sleep -Milliseconds 250 }; Restore-Focus; Write-Output 'OK:ANSWER' }
  'decline'  { if ($bg) { Send-BgCombo @(0x11, 0x10, 0x45) } else { Focus-Discord; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^+e'); Start-Sleep -Milliseconds 250 }; Restore-Focus; Write-Output 'OK:DECLINE' }
  'probe' {
    # آزمایش مکان‌یابی دکمهٔ تماس — فقط نشانگر موس حرکت می‌کند، کلیکی در کار نیست
    try {
      Add-Type -AssemblyName UIAutomationClient | Out-Null
      Add-Type -AssemblyName UIAutomationTypes | Out-Null
      $root = [System.Windows.Automation.AutomationElement]::RootElement
      $hwndCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NativeWindowHandleProperty, $hwnd)
      $win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $hwndCond)
      if ($win) {
        $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
        $btns = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
        foreach ($b in $btns) {
          $bn = ''
          try { $bn = $b.Current.Name } catch {}
          if ($bn -match 'Video|ویدیو|End|قطع') { continue }
          if ($bn -match 'Start Voice Call|Voice Call|تماس صوتی|شروع تماس|Call|تماس') {
            $r = $b.Current.BoundingRectangle
            $cx = [int]($r.X + $r.Width / 2); $cy = [int]($r.Y + $r.Height / 2)
            [AvaDc2.W]::SetCursorPos($cx, $cy) | Out-Null
            Write-Output "OK:PROBE:$cx,$cy"
            exit
          }
        }
      }
    } catch {}
    $r2 = New-Object AvaDc2.RECT
    [AvaDc2.W]::GetWindowRect($hwnd, [ref]$r2) | Out-Null
    $tx = $r2.Right - $Dx; $ty = $r2.Top + $Dy
    [AvaDc2.W]::SetCursorPos($tx, $ty) | Out-Null
    Write-Output "OK:PROBE-FB:$tx,$ty"
  }
  'clickcall' {
    # DM از قبل با دیپ‌لینک باز شده — فقط دکمهٔ تماس را بزن
    Start-Sleep -Milliseconds 900
    Write-Output (Try-CallClick)
  }
  'callswitch' {
    $name = ($Name -replace '[''’"]', '')
    if (-not $name) { Write-Output 'ERR:NONAME'; exit }
    try { Set-Clipboard -Value $name -ErrorAction Stop | Out-Null } catch { Write-Output 'DBG:CLIP_FAIL' }
    if ($bg) {
      Send-BgCombo @(0x11, 0x4B)
      Start-Sleep -Milliseconds 1100
      Send-BgCombo @(0x11, 0x56)
      Start-Sleep -Milliseconds 900
      Send-BgCombo @(0x0D)
      Start-Sleep -Milliseconds 1700
    } else {
      Focus-Discord
      $ws = New-Object -ComObject WScript.Shell
      $ws.SendKeys('^k'); Start-Sleep -Milliseconds 1000
      $ws.SendKeys('^v'); Start-Sleep -Milliseconds 900
      $ws.SendKeys('{ENTER}'); Start-Sleep -Milliseconds 1700
    }
    Write-Output (Try-CallClick)
  }
  default { Write-Output 'ERR:UNKNOWN' }
}
} catch {
  # v0.21 — هر خطای پاورشل (حتی Add-Type/UIA) به‌عنوان نتیجهٔ قابل‌فهم برمی‌گردد
  # و در لاگ عملکرد ثبت می‌شود — دیگر «ارور پاورشل» گم نمی‌شود
  Write-Output ('ERR:PS:' + ($_.Exception.Message -replace '\s+', ' '))
}
