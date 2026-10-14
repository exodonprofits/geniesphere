@echo off
setlocal enabledelayedexpansion

echo Creating missing detail.html files if not exist...
echo.

for /d %%F in (*) do (
    if not exist "%%F\detail.html" (
        echo Creating detail.html inside %%F
        (
        echo ^<!DOCTYPE html^>
        echo ^<html lang="en"^>
        echo ^<head^>
        echo     ^<meta charset="UTF-8"^>
        echo     ^<title^>%%F Agent Detail^</title^>
        echo ^</head^>
        echo ^<body^>
        echo     ^<h1^>Welcome to %%F AI Agent!^</h1^>
        echo     ^<p^>This is the detail page for %%F agent.^</p^>
        echo ^</body^>
        echo ^</html^>
        ) > "%%F\detail.html"
    ) else (
        echo detail.html already exists in %%F, skipping...
    )
)

echo.
echo All done creating missing detail.html files!
pause
