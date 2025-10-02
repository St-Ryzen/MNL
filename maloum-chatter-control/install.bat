@echo off
echo Installing Maloum Chatter Control dependencies...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.7+ and add it to your PATH.
    pause
    exit /b 1
)

REM Check if pip is available
pip --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Pip is not available.
    echo Please ensure Python was installed with pip.
    pause
    exit /b 1
)

echo Upgrading pip...
pip install --upgrade pip

echo.
echo Installing required packages...
if exist requirements.txt (
    pip install -r requirements.txt
) else (
    echo requirements.txt not found, installing packages individually...
    pip install flask flask-login flask-sqlalchemy flask-wtf selenium webdriver-manager cryptography
)

if %ERRORLEVEL% == 0 (
    echo.
    echo Installation completed successfully!
    echo.
    echo To start the application:
    echo    Option 1: python app.py
    echo    Option 2: Double-click server-for-windows.bat (recommended)
    echo.
    echo The application will automatically find an available port (5000-5009)
    echo and open your browser automatically.
    echo.
    echo Default admin credentials:
    echo    Username: admin
    echo    Password: admin123
    echo.
    echo IMPORTANT: Change the default password after first login!
    echo.
) else (
    echo.
    echo Installation failed. Please make sure Python and pip are installed correctly.
    echo If you're having issues, try running this script as administrator.
)

pause