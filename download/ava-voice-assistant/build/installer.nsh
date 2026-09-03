; ============================================================
; v0.82 - AVA custom installer (branding + behavior)
; electron-builder includes this file (build/installer.nsh).
; Welcome/finish pages use AVA's own gold sidebar art
; (installerSidebar.bmp) and the install header uses
; installerHeader.bmp - no default gray NSIS look.
; ============================================================

BrandingText "AVA - ava-voice-assistant"

; --- install behavior ---
!macro customInit
  DetailPrint "AVA setup: preparing installation..."
!macroend

; --- finish page: run AVA after install (default on) ---
!macro customInstall
  WriteRegStr HKCU "Software\AVA" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\AVA" "Version" "${VERSION}"
!macroend

; --- registry cleanup on uninstall ---
!macro customUnInstall
  DeleteRegKey HKCU "Software\AVA"
!macroend
