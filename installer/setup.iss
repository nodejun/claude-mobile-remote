; ══════════════════════════════════════════════════════
; Claude Code Mobile - PC Agent 인스톨러
; Inno Setup 스크립트
;
; 사전 조건: build-installer.js 실행하여 staging/ 폴더 준비
; 컴파일: ISCC.exe setup.iss
; ══════════════════════════════════════════════════════

#define MyAppName "Claude Code Mobile Agent"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Claude Code Mobile"
#define MyAppExeName "start-hidden.vbs"

[Setup]
; 앱 식별자 (GUID - 고유해야 함)
AppId={{B5E8F2A1-3C4D-4E5F-9A6B-7C8D9E0F1A2B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\ClaudeCodeMobileAgent
DefaultGroupName={#MyAppName}
; 인스톨러 출력 설정
OutputDir=output
OutputBaseFilename=ClaudeCodeMobileAgent-Setup-{#MyAppVersion}
; 압축 설정
Compression=lzma2/ultra64
SolidCompression=yes
; UI 설정
WizardStyle=modern
; 권한 (Program Files에 설치하므로 관리자 필요)
PrivilegesRequired=admin
; 아키텍처
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 바로가기 만들기"; GroupDescription: "추가 옵션:"; Flags: unchecked
Name: "startupicon"; Description: "Windows 시작 시 자동 실행"; GroupDescription: "추가 옵션:"; Flags: unchecked

[Files]
; staging 폴더의 모든 파일을 설치 디렉토리에 복사
Source: "staging\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; 시작 메뉴 바로가기 (wscript.exe로 VBScript 실행)
Name: "{group}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\icon.ico"
Name: "{group}\{#MyAppName} 제거"; Filename: "{uninstallexe}"
; 바탕화면 바로가기 (선택)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\icon.ico"; Tasks: desktopicon
; 시작 프로그램 (선택) - Windows 설정에서 "Claude Code Mobile Agent"로 표시
Name: "{userstartup}\Claude Code Mobile Agent"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; WorkingDir: "{app}"; Tasks: startupicon

[Run]
; 설치 완료 후 실행 옵션 (백그라운드로 시작)
Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; WorkingDir: "{app}"; Description: "설치 후 바로 실행"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; 언인스톨 시 추가 정리 (런타임 생성 파일)
Type: filesandordirs; Name: "{app}\*.log"
Type: filesandordirs; Name: "{app}\.claude-changes.json"
