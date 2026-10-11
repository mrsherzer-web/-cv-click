; Windows installer for the light PC build (Neutralino): one small game exe, installed per user.
; Build on Linux:  NSISDIR=<nsis dir> <nsis dir>/linux/makensis installer.nsi   (see ../../README.md)
Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!define APP "מבצע ברודנה"
!define APPID "MivtzaBrodna"
!define VERSION "1.0.0"
!define EXE "Mivtza Brodna.exe"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPID}"
; WebView2 Runtime registration (Microsoft's documented detection keys)
!define WV2_KEY "Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
!define WV2_DOWNLOAD "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
!ifndef GAME
  !define GAME "../dist/mivtza-brodna/mivtza-brodna-win_x64.exe"
!endif
!ifndef OUTFILE
  !define OUTFILE "../dist/Mivtza-Brodna-Setup.exe"
!endif

Name "${APP}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\Mivtza Brodna"
BrandingText "${APP} ${VERSION}"
ShowInstDetails nevershow
ShowUninstDetails nevershow

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WinMessages.nsh"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "side.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "side.bmp"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "ברוכים הבאים למבצע ברודנה"
!define MUI_WELCOMEPAGE_TEXT "ההתקנה שמה את המשחק במחשב, עם קיצור דרך בשולחן העבודה ובתפריט התחל. זה לוקח כמה שניות ולא צריך הרשאות מנהל.$\r$\n$\r$\nלוחצים על התקנה, ויונתי יוצא לדרך."
!define MUI_PAGE_CUSTOMFUNCTION_SHOW WelcomeShow
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "המשחק מותקן"
!define MUI_FINISHPAGE_TEXT "הגרפיקה מתחילה ברמת אולטרה. משחקים במקלדת ועכבר, או מחברים שלט של Xbox או PlayStation.$\r$\n$\r$\nF11 עובר למסך מלא."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "להתחיל לשחק עכשיו"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Hebrew"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=${LANG_HEBREW} "ProductName" "${APP}"
VIAddVersionKey /LANG=${LANG_HEBREW} "FileDescription" "התקנה של ${APP}"
VIAddVersionKey /LANG=${LANG_HEBREW} "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_HEBREW} "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_HEBREW} "CompanyName" "Mivtza Brodna"
VIAddVersionKey /LANG=${LANG_HEBREW} "LegalCopyright" "© 2026 Mivtza Brodna"

; there is no folder page, so the welcome page's button installs right away
Function WelcomeShow
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:התקנה"
FunctionEnd

; The game runs in Microsoft's WebView2, which Windows 10 and 11 normally have already.
Function CheckWebView2
  ReadRegStr $0 HKLM "SOFTWARE\${WV2_KEY}" "pv"
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    ReadRegStr $0 HKCU "Software\${WV2_KEY}" "pv"
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    SetRegView 64
    ReadRegStr $0 HKLM "SOFTWARE\${WV2_KEY}" "pv"
    SetRegView 32
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    IfSilent done
    MessageBox MB_YESNO|MB_ICONINFORMATION "כדי שהמשחק ירוץ צריך את רכיב WebView2 של מיקרוסופט. ב־Windows 10 ו־11 הוא בדרך כלל כבר מותקן, אבל במחשב הזה הוא חסר.$\r$\n$\r$\nלפתוח את ההורדה הרשמית של מיקרוסופט? אחרי שמתקינים אותו, המשחק עובד." IDNO done
    ExecShell "open" "${WV2_DOWNLOAD}"
  ${EndIf}
  done:
FunctionEnd

Section "Game"
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "/oname=${EXE}" "${GAME}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\${APP}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateShortcut "$SMPROGRAMS\${APP}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "Mivtza Brodna"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
  Call CheckWebView2
SectionEnd

; Saved progress lives in the player's profile (WebView2 data), so it survives an uninstall and reinstall.
Section "Uninstall"
  Delete "$INSTDIR\${EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$INSTDIR\neutralinojs.log"
  RMDir /r "$INSTDIR\.tmp"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\${APP}.lnk"
  Delete "$SMPROGRAMS\${APP}.lnk"
  DeleteRegKey HKCU "${UNINST_KEY}"
SectionEnd
