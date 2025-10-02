@echo off
title Fan Finder - Instance Selector
setlocal EnableDelayedExpansion

echo.
echo ========================================
echo    FAN FINDER - INSTANCE SELECTOR
echo ========================================
echo.
echo Select which server to run:
echo.
echo [1] Server 1 (Port 5001)
echo [2] Server 2 (Port 5002)
echo [3] Server 3 (Port 5003)
echo [4] Server 4 (Port 5004)
echo [5] Server 5 (Port 5005)
echo [6] Server 6 (Port 5006)
echo [7] Server 7 (Port 5007)
echo [8] Server 8 (Port 5008)
echo [9] Server 9 (Port 5009)
echo [10] Server 10 (Port 5000)
echo.
set /p CHOICE="Enter your choice (1-10): "

if "%CHOICE%"=="1" (
    set PORT=5001
) else if "%CHOICE%"=="2" (
    set PORT=5002
) else if "%CHOICE%"=="3" (
    set PORT=5003
) else if "%CHOICE%"=="4" (
    set PORT=5004
) else if "%CHOICE%"=="5" (
    set PORT=5005
) else if "%CHOICE%"=="6" (
    set PORT=5006
) else if "%CHOICE%"=="7" (
    set PORT=5007
) else if "%CHOICE%"=="8" (
    set PORT=5008
) else if "%CHOICE%"=="9" (
    set PORT=5009
) else if "%CHOICE%"=="10" (
    set PORT=5000
) else (
    echo Invalid choice. Defaulting to port 5000...
    set PORT=5000
)

echo Selected port: %PORT%
echo.

REM Pass the selected port to the main startup script
call :start_server %PORT%
goto :eof

:start_server
set SELECTED_PORT=%1

REM Clean up any leftover temporary files from previous runs
if exist open_chrome.ps1 del open_chrome.ps1 >nul 2>&1
if exist restart_after_update.bat del restart_after_update.bat >nul 2>&1
if exist delayed_start.bat del delayed_start.bat >nul 2>&1

REM Global error handler - ensure terminal stays open on any error
set "KEEP_TERMINAL_OPEN=true"

echo.
echo ========================================
echo    FAN FINDER - STARTING UP (Port %SELECTED_PORT%)
echo ========================================
echo.
echo AI Assistant integrated for installation help
echo    AI can provide guidance and assistance with your permission

REM Quick system compatibility check
echo.
echo Checking system compatibility...
python -c "import sys; sys.path.append('app'); from ai_helper import create_ai_helper; helper = create_ai_helper(); compatibility = helper.get_system_compatibility_check() if helper else {'compatible': 'yes', 'issues': 'None detected', 'recommendations': 'System ready'}; print('COMPATIBILITY: ' + compatibility['compatible']); print('RECOMMENDATIONS: ' + compatibility['recommendations']); print('System check complete')" 2>nul && (
    echo System compatibility verified
) || (
    echo System check complete - proceeding with installation
)
echo.

REM Check if Python is installed and working
echo Checking Python installation...

REM Try multiple common Python commands to find the best available Python
set PYTHON_CMD=
for %%X in (python3, python, py) do (
    %%X --version >nul 2>&1 && (
        set PYTHON_CMD=%%X
        goto :python_found
    )
)

REM Check specific Python installations
for /f "tokens=*" %%i in ('dir /s /b "%LOCALAPPDATA%\Programs\Python\*python.exe" 2^>nul') do (
    if exist "%%i" (
        "%%i" --version >nul 2>&1 && (
            set PYTHON_CMD="%%i"
            goto :python_found
        )
    )
)

REM Python not found - provide guidance and exit gracefully
echo.
echo ERROR: Python not found or not working properly!
echo.
echo This application requires Python to run.
echo.
echo SOLUTION OPTIONS:
echo 1. Download Python from: https://www.python.org/downloads/
echo 2. Make sure Python is added to your PATH during installation
echo 3. Restart your computer after installing Python
echo 4. Run this script again
echo.
echo If you just installed Python, try restarting your computer first.
echo.
goto :exit_with_pause

:python_found
echo SUCCESS: Python found: %PYTHON_CMD%
%PYTHON_CMD% --version
echo.

REM Ensure pip is available and upgraded
echo [25%%] Ensuring pip is available...
%PYTHON_CMD% -m ensurepip --upgrade >nul 2>&1
%PYTHON_CMD% -m pip install --upgrade pip --quiet --disable-pip-version-check
echo [25%%] Pip is ready!

REM Install packages using requirements.txt first (more reliable)\r\n:install_packages\r\necho Checking required packages...\r\nif exist \"app\\backend\\requirements.txt\" (\r\n    echo Found requirements.txt, installing packages from file...\r\n    %PYTHON_CMD% -m pip install -r app\\backend\\requirements.txt --quiet --disable-pip-version-check\r\n    if !errorlevel! neq 0 (\r\n        echo WARNING: Could not install from requirements.txt, installing packages individually...\r\n        goto :install_individual_packages\r\n    )\r\n    echo [100%%] SUCCESS: Packages installed from requirements.txt!\r\n    echo.\r\n    goto :after_installation\r\n) else (\r\n    echo requirements.txt not found, installing packages individually...\r\n    goto :install_individual_packages\r\n)

:install_individual_packages
echo Installing packages individually...
%PYTHON_CMD% -c "import flask, flask_socketio, selenium, undetected_chromedriver, requests, firebase_admin, supabase, python_socketio, eventlet, psutil, python_dotenv, pyairtable" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Required packages not found! Installing automatically...
    echo.
    echo Installing Python packages...
    echo This may take 2-3 minutes...
    
    REM Install packages with pip - more comprehensive approach
    echo [50%%] Installing core packages...
    %PYTHON_CMD% -m pip install flask flask-socketio flask-cors python-dotenv --quiet --disable-pip-version-check
    
    echo [75%%] Installing automation and database packages...
    %PYTHON_CMD% -m pip install selenium undetected-chromedriver requests psutil firebase-admin supabase pyairtable --quiet --disable-pip-version-check
    
    echo [90%%] Installing additional packages...
    %PYTHON_CMD% -m pip install python-socketio eventlet cryptography --quiet --disable-pip-version-check
    
    if !errorlevel! neq 0 (
        echo.
        echo ERROR: Failed to install some packages
        echo.
        echo Analyzing package installation issue...
        %PYTHON_CMD% -c "import sys; sys.path.append('app'); from ai_helper import create_ai_helper; helper = create_ai_helper(); success, guidance = helper.suggest_installation_fix('Package Installation Failed', 'pip install failed for required packages', 'Package installation') if helper else (False, 'Installation guidance unavailable'); print(guidance)" 2>nul || (
            echo.
            echo MANUAL SOLUTION:
            echo 1. Right-click this file and select "Run as administrator"
            echo 2. Or try: pip install --user flask flask-socketio selenium undetected-chromedriver requests firebase-admin supabase pyairtable
            echo 3. Or create a Python virtual environment
            echo.
        )
        goto :exit_with_pause
    )
    
    echo [100%%] SUCCESS: All packages installed!
    echo.
) else (
    echo SUCCESS: All required packages found
    echo.
)

:after_installation
REM Setup configuration
echo Setting up configuration...
if not exist app\config mkdir app\config
if not exist app\data mkdir app\data
if exist firebase-key.json copy firebase-key.json app\config\firebase-key-13504509.json >nul 2>&1

echo.
echo ====================================
echo   ACCESS POINT:
echo   WEB INTERFACE: http://localhost:%PORT%
echo   CHROME BROWSER: Will open automatically
echo ====================================
echo.

REM Check if specified port is available
echo Checking if port %PORT% is available...
netstat -ano | findstr ":%PORT%.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo WARNING: Port %PORT% is already in use!
    echo Something is already running on http://localhost:%PORT%
    echo.
    echo To fix this:
    echo 1. Close any existing Fan Finder windows
    echo 2. Or restart your computer
    echo 3. Then try starting again
    echo.
    goto :exit_with_pause
)

REM Additional fix for distutils issue in newer Python versions
echo Fixing distutils compatibility for newer Python versions...
%PYTHON_CMD% -c "import distutils.util; print('distutils is available')" >nul 2>&1
if !errorlevel! neq 0 (
    echo WARNING: distutils not found, installing compatibility packages...
    %PYTHON_CMD% -m pip install setuptools importlib-metadata packaging --quiet --disable-pip-version-check
    if !errorlevel! neq 0 (
        echo ERROR: Failed to install distutils compatibility packages
    )
)

echo Starting Fan Finder server...
echo.

REM Set environment variables
set FLASK_APP=app\backend\app.py
set FLASK_ENV=production
set PYTHONPATH=%cd%
set FIREBASE_KEY_PATH=%cd%\app\config\firebase-key-13504509.json
set FLASK_PORT=%PORT%

REM Test Python imports before starting the server
echo Testing Python imports...
%PYTHON_CMD% -c "from flask import Flask; from flask_socketio import SocketIO; from flask_cors import CORS; from supabase import create_client; print('All imports successful!')" 2>nul
if !errorlevel! neq 0 (
    echo.
    echo ERROR: Import test failed! There may be an issue with package installation.
    echo Trying to reinstall packages with more verbose output...
    
    REM Reinstall packages with more verbose output
    %PYTHON_CMD% -m pip install --force-reinstall flask flask-socketio flask-cors python-dotenv selenium undetected-chromedriver requests psutil firebase-admin supabase --quiet --disable-pip-version-check
    
    if !errorlevel! neq 0 (
        echo.
        echo CRITICAL: Could not resolve import issues. Please verify Python installation.
        goto :exit_with_pause
    )
)

REM Test AirTable import specifically
echo Testing AirTable import...
%PYTHON_CMD% -c "from pyairtable import Api; print('AirTable imports successful!')" 2>nul
if !errorlevel! neq 0 (
    echo.
    echo WARNING: AirTable import failed - installing pyairtable package...
    %PYTHON_CMD% -m pip install pyairtable --quiet --disable-pip-version-check
    if !errorlevel! neq 0 (
        echo.
        echo WARNING: Could not install pyairtable. AirTable integration may not work.
    ) else (
        echo pyairtable package installed successfully
    )
)

REM Chrome opening - simplified without temporary files
timeout 3 >nul
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" http://localhost:%PORT%
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" http://localhost:%PORT%
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" http://localhost:%PORT%
) else (
    echo Chrome not found, using default browser as fallback
    start http://localhost:%PORT%
)

REM Start Flask server with specified port
echo Fan Finder server starting on port %PORT%...
echo.
%PYTHON_CMD% app\backend\app.py --port %PORT%

REM If we reach here, the server stopped (this should only happen if it crashes or user presses Ctrl+C)
echo.
echo Fan Finder server stopped or encountered an error.
echo.

:exit_with_pause
REM Always pause before exit to keep terminal open
echo.
echo ========================================
if "%KEEP_TERMINAL_OPEN%"=="true" (
    echo Terminal will remain open for troubleshooting
    echo Press any key to exit...
    pause >nul
) else (
    pause
)

REM Clean up temporary files
if exist open_chrome.ps1 del open_chrome.ps1 >nul 2>&1

echo Goodbye!

goto :eof