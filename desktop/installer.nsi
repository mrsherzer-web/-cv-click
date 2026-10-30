; Windows installer for "אל תעירו את נועם" (Hebrew UI, per-user install, no admin needed).
; Built from dist\win-unpacked (produced by electron-builder) with makensis — see scripts/build-installer.mjs.

Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
RequestExecutionLevel user

!define APPNAME "אל תעירו את נועם"
!define APPID "il.dimona.commune.dontwakenoam"
!define EXE "DontWakeNoam.exe"
!define PUBLISHER "קומונת דימונה"
!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!define REGKEY "Software\DontWakeNoam"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPID}"

!ifdef RESOURCES_PLUGINS
  !addplugindir /x86-unicode "${RESOURCES_PLUGINS}"
!endif

!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "${APPNAME}"
Caption "התקנת ${APPNAME}"
OutFile "dist\DontWakeNoam-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\DontWakeNoam"
InstallDirRegKey HKCU "${REGKEY}" "InstallDir"
BrandingText "${APPNAME} ${VERSION} · ${PUBLISHER}"
ShowInstDetails nevershow
ShowUninstDetails nevershow

; ---------- look ----------
!define MUI_ICON "resources\icon.ico"
!define MUI_UNICON "resources\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "resources\installerSidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "resources\uninstallerSidebar.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "resources\installerHeader.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "resources\installerHeader.bmp"
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "לבטל את ההתקנה? נועם עדיין ישן... בינתיים."
!define MUI_UNABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "ברוכים הבאים לקומונת דימונה"
!define MUI_WELCOMEPAGE_TEXT "האשף יתקין את ${APPNAME} במחשב שלך.$\r$\n$\r$\n4 לילות. דירה אחת. חצי מהקומונה נעלמה — ואסור להעיר את נועם.$\r$\n$\r$\nמומלץ לשחק עם אוזניות ובחושך.$\r$\n$\r$\nלחץ על 'הבא' כדי להמשיך."
!define MUI_FINISHPAGE_TITLE "ההתקנה הסתיימה"
!define MUI_FINISHPAGE_TEXT "${APPNAME} הותקן בהצלחה.$\r$\n$\r$\nיש קיצור דרך בשולחן העבודה ובתפריט התחל.$\r$\nF11 מחליף בין מסך מלא לחלון.$\r$\n$\r$\nלילה טוב. ותתכופף ליד החדר שלו."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "להפעיל את המשחק עכשיו"
!define MUI_UNCONFIRMPAGE_TEXT_TOP "${APPNAME} יוסר מהמחשב. ההתקדמות וההגדרות שלך יישמרו למקרה שתחזור."

; ---------- pages ----------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Hebrew"

; ---------- file properties of the installer itself ----------
VIProductVersion "${VERSION}.0"
VIFileVersion "${VERSION}.0"
VIAddVersionKey /LANG=${LANG_HEBREW} "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=${LANG_HEBREW} "FileDescription" "התקנת ${APPNAME}"
VIAddVersionKey /LANG=${LANG_HEBREW} "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=${LANG_HEBREW} "LegalCopyright" "© 2026 ${PUBLISHER}"
VIAddVersionKey /LANG=${LANG_HEBREW} "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_HEBREW} "ProductVersion" "${VERSION}"

!macro CloseGame
  nsProcess::_FindProcess "${EXE}"
  Pop $R0
  ${If} $R0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "המשחק פתוח כרגע. לחץ 'אישור' כדי לסגור אותו ולהמשיך." IDOK +2
    Abort
    nsProcess::_KillProcess "${EXE}"
    Pop $R0
    Sleep 800
  ${EndIf}
  nsProcess::_Unload
!macroend

Function .onInit
  !insertmacro CloseGame
FunctionEnd

Function un.onInit
  !insertmacro CloseGame
FunctionEnd

Section "Install"
  SetOutPath "$INSTDIR"
  ; remove files from an older version first (keeps saves: those live in %APPDATA%)
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  File /r "dist\win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortCut "$SMPROGRAMS\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  WinShell::SetLnkAUMI "$SMPROGRAMS\${APPNAME}.lnk" "${APPID}"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  WinShell::SetLnkAUMI "$DESKTOP\${APPNAME}.lnk" "${APPID}"

  WriteRegStr HKCU "${REGKEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINSTKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  WinShell::UninstAppUserModelId "${APPID}"
  WinShell::UninstShortcut "$SMPROGRAMS\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  WinShell::UninstShortcut "$DESKTOP\${APPNAME}.lnk"
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "${REGKEY}"
SectionEnd
