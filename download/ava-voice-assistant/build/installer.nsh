; ============================================================
; v0.82 — نصاب سفارشی آوا (برندینگ + رفتار)
; ------------------------------------------------------------
; electron-builder این فایل را include می‌کند (build/installer.nsh).
; صفحهٔ خوش‌آمد/پایان با آرتور سفید-طلایی خود آوا (installerSidebar.bmp)
؛ و هدر نصب با installerHeader.bmp — از پیش‌فرض خاکستری NSIS خبری نیست.
; ============================================================

BrandingText "آوا — دستیار صوتی هوشمند ویندوز  |  ava-voice-assistant"

; --- رفتار نصب ---
!macro customInit
  ; نام داخلی پنجرهٔ نصاب (نه عنوان قابل‌مشاهده)
  DetailPrint "در حال آماده‌سازی نصب آوا…"
!macroend

; --- صفحهٔ پایان: اجرای خودکار آوا بعد از نصب (پیش‌فرض روشن) ---
!macro customInstall
  WriteRegStr HKCU "Software\AVA" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\AVA" "Version" "${VERSION}"
!macroend

; --- پاک‌سازی رجیستری هنگام حذف ---
!macro customUnInstall
  DeleteRegKey HKCU "Software\AVA"
!macroend
