@echo off
echo Starting Maloum Chatter Control...
echo.
echo Note: Make sure you've run server-for-windows.bat or install.bat first if this is your first time.
echo.
echo The application will automatically find an available port between 5000-5009.
echo.
echo Press Ctrl+C to stop the application.
echo.

REM Check if packages are installed
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo Required packages not found. Please run server-for-windows.bat or install.bat first.
    pause
    exit /b 1
)

python app.py
pause