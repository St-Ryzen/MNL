@echo off
title Model Board - Server Setup
setlocal EnableDelayedExpansion

echo.
echo ========================================
echo        MODEL BOARD - SERVER SETUP
echo ========================================
echo.

REM Clean up any leftover temporary files from previous runs
if exist open_chrome.ps1 del open_chrome.ps1 >nul 2>&1
if exist restart_after_update.bat del restart_after_update.bat >nul 2>&1
if exist delayed_start.bat del delayed_start.bat >nul 2>&1

REM Global error handler - ensure terminal stays open on any error
set "KEEP_TERMINAL_OPEN=true"

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
echo SUCCESS: Python found: !PYTHON_CMD!
!PYTHON_CMD! --version
echo.

REM Ensure pip is available and upgraded
echo [25%%] Ensuring pip is available...
!PYTHON_CMD! -m ensurepip --upgrade >nul 2>&1
!PYTHON_CMD! -m pip install --upgrade pip --quiet --disable-pip-version-check
echo [25%%] Pip is ready!

REM Force use of pre-built binary wheels to avoid compilation errors
echo Configuring pip to use pre-built packages (avoids build errors)...
set PIP_ONLY_BINARY=:all:
set PIP_PREFER_BINARY=1

REM Install packages using requirements.txt first (more reliable)
:install_packages
echo Checking required packages...
if exist "app\requirements.txt" (
    echo Found requirements.txt, installing packages from file...
    !PYTHON_CMD! -m pip install -r app\requirements.txt --prefer-binary --only-binary=greenlet,cryptography --quiet --disable-pip-version-check
    if !errorlevel! neq 0 (
        echo WARNING: Could not install from requirements.txt, trying alternative method...
        echo Installing greenlet separately with pre-built binary...
        !PYTHON_CMD! -m pip install greenlet --only-binary :all: --quiet --disable-pip-version-check
        !PYTHON_CMD! -m pip install -r app\requirements.txt --prefer-binary --quiet --disable-pip-version-check
        if !errorlevel! neq 0 (
            echo WARNING: Still having issues, installing packages individually...
            goto :install_individual_packages
        )
    )
    echo [100%%] SUCCESS: Packages installed from requirements.txt!
    echo.
    goto :after_installation
) else (
    echo requirements.txt not found, installing packages individually...
    goto :install_individual_packages
)

:install_individual_packages
echo Installing packages individually...
!PYTHON_CMD! -c "import flask, flask_login, flask_sqlalchemy, flask_wtf, selenium, webdriver_manager, cryptography" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Required packages not found! Installing automatically...
    echo.
    echo Installing Python packages...
    echo This may take 1-2 minutes...
    
    REM Install packages with pip - more comprehensive approach
    echo [50%%] Installing core packages...
    !PYTHON_CMD! -m pip install flask flask-login flask-sqlalchemy --prefer-binary --quiet --disable-pip-version-check

    echo [75%%] Installing web automation and security packages...
    !PYTHON_CMD! -m pip install selenium webdriver-manager cryptography flask-wtf --prefer-binary --only-binary=greenlet,cryptography --quiet --disable-pip-version-check
    
    if !errorlevel! neq 0 (
        echo.
        echo ERROR: Failed to install some packages
        echo.
        echo TROUBLESHOOTING STEPS:
        echo 1. Make sure you have internet connection
        echo 2. Right-click this file and select "Run as administrator"
        echo 3. If you see "greenlet" errors, you may need Microsoft C++ Build Tools
        echo    Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
        echo 4. Alternative: Try upgrading Python to latest version from python.org
        echo.
        echo MANUAL INSTALL COMMAND:
        echo pip install --user --prefer-binary flask flask-login flask-sqlalchemy flask-wtf selenium webdriver-manager cryptography
        echo.
        goto :exit_with_pause
    )
    
    echo [100%%] SUCCESS: All packages installed!
    echo.
) else (
    echo SUCCESS: All required packages found
    echo.
)

:after_installation
REM Look for available port automatically
echo Finding available port...
set PORT=
for /L %%i in (5000,1,5009) do (
    set "TEST_PORT=%%i"
    call :check_port !TEST_PORT!
    if !PORT_AVAILABLE! equ 1 (
        set PORT=!TEST_PORT!
        goto :port_found
    )
)

REM If no port was found free in the range, default to 5000
if not defined PORT set PORT=5000

:port_found
echo Selected port: !PORT!

REM Check if specified port is available
echo Checking if port !PORT! is available...
netstat -ano | findstr ":%PORT%.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo WARNING: Port !PORT! is already in use!
    echo Something is already running on http://localhost:!PORT!
    echo.
    echo To fix this:
    echo 1. Close any existing Maloum Chatter Control windows
    echo 2. Or restart your computer
    echo 3. Then try starting again
    echo.
    goto :exit_with_pause
)

REM Additional fix for distutils issue in newer Python versions
echo Fixing compatibility for newer Python versions...
!PYTHON_CMD! -c "import distutils.util; print('distutils is available')" >nul 2>&1
if !errorlevel! neq 0 (
    echo WARNING: distutils not found, installing compatibility packages...
    !PYTHON_CMD! -m pip install setuptools importlib-metadata packaging --quiet --disable-pip-version-check
    if !errorlevel! neq 0 (
        echo ERROR: Failed to install distutils compatibility packages
    )
)

echo Starting Maloum Chatter Control server...
echo.

REM Test Python imports before starting the server
echo Testing Python imports...
!PYTHON_CMD! -c "from flask import Flask; from flask_login import LoginManager; from flask_sqlalchemy import SQLAlchemy; from selenium import webdriver; print('All imports successful!')" 2>nul
if !errorlevel! neq 0 (
    echo.
    echo ERROR: Import test failed! There may be an issue with package installation.
    echo Trying to reinstall packages with more verbose output...
    
    REM Reinstall packages with more verbose output
    !PYTHON_CMD! -m pip install --force-reinstall flask flask-login flask-sqlalchemy flask-wtf selenium webdriver-manager cryptography --quiet --disable-pip-version-check
    
    if !errorlevel! neq 0 (
        echo.
        echo CRITICAL: Could not resolve import issues. Please verify Python installation.
        goto :exit_with_pause
    )
)

REM Chrome opening - simplified without temporary files
timeout 3 >nul
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" http://localhost:!PORT!
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" http://localhost:!PORT!
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" http://localhost:!PORT!
) else (
    echo Chrome not found, using default browser as fallback
    start http://localhost:!PORT!
)

REM Start Flask server with selected port
echo Model Board server starting on port !PORT!...
echo.
cd app
!PYTHON_CMD! app.py

REM If we reach here, the server stopped (this should only happen if it crashes or user presses Ctrl+C)
echo.
echo Model Board server stopped or encountered an error.
echo.

goto :exit_with_pause

:check_port
setlocal
set "CHECK_PORT=%1"
netstat -ano | findstr ":%CHECK_PORT% " >nul 2>&1
if !errorlevel! equ 0 (
    endlocal
    set PORT_AVAILABLE=0
) else (
    endlocal
    set PORT_AVAILABLE=1
)
goto :eof

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