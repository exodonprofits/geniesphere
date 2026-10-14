@echo off
setlocal enabledelayedexpansion

:: Set output file
set OUTPUT=generated_routes.txt

echo Generating Flask routes only for agent folders that have detail.html...
echo. > %OUTPUT%

for /d %%F in (*) do (
    if exist "%%F\detail.html" (
        set "folder=%%F"
        echo @app.route('/!folder!')>> %OUTPUT%
        echo def !folder!():>> %OUTPUT%
        echo     return render_template('!folder!/detail.html')>> %OUTPUT%
        echo.>> %OUTPUT%
    )
)

echo Routes saved to %OUTPUT% successfully.
pause
