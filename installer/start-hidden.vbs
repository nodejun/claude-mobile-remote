' Claude Code Mobile Agent - 백그라운드 실행 스크립트
' 콘솔 창 없이 node.exe를 실행하여 시스템 트레이에서만 동작
'
' WshShell.Run 파라미터:
'   0 = 창 숨김 (SW_HIDE)
'   False = 프로세스 종료를 기다리지 않음
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 현재 스크립트가 있는 폴더 경로
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' node.exe로 서버 실행 (창 숨김, 비동기)
WshShell.CurrentDirectory = scriptDir
WshShell.Run """" & scriptDir & "\node.exe"" dist\main.js", 0, False
