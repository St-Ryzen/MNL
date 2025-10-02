# Maloum Chatter Control System

## Overview
The Maloum Chatter Control System allows administrators to manage multiple Maloum.com model accounts and provide secure access to chatters without sharing login credentials. The system uses browser automation to control multiple account sessions simultaneously.

## Features
- Secure credential storage with encryption
- Role-based access control (Admins and Chatters)
- Simultaneous management of multiple model accounts
- Activity logging and monitoring
- CSRF protection
- Input validation and sanitization
- Session management

## Prerequisites
- Python 3.7+
- Google Chrome browser
- Windows, macOS, or Linux operating system

## Installation

### 1. Clone or create the project directory
```bash
mkdir maloum-chatter-control
cd maloum-chatter-control
```

### 2. Install Python dependencies
```bash
pip install -r requirements.txt
```

If you don't have the requirements.txt file, install these packages:
```bash
pip install flask flask-login flask-sqlalchemy flask-wtf selenium webdriver-manager cryptography
```

### 3. Run the application
Option 1: Direct Python execution (the application will automatically select an available port from 5000-5009 and open your browser):
```bash
python app.py
```

Option 2: Use the automated server script (recommended - automatically installs dependencies if needed and opens browser):
- On Windows: Double-click `server-for-windows.bat`

## Configuration

### Environment Variables (Optional)
Set the SECRET_KEY environment variable for production:
```bash
export SECRET_KEY="your-very-secure-random-key-here"
```

If not set, the application will generate a random key at startup.

## Usage

### Initial Setup
1. On first run, the system creates a default admin account:
   - Username: `admin`
   - Password: `admin123`
   
2. **Important**: Change the default password immediately after first login.

### Port Selection
- The application automatically finds an available port in the range 5000-5009
- The selected port will be displayed in the console when the application starts
- Make note of the port number to access the web interface

### Admin Functions

#### 1. Login as Admin
- Open your browser and navigate to the URL shown in the console after starting the application
- Use the default admin credentials or your custom admin account

#### 2. Add Chatter Accounts
- Click "Add User" from the admin dashboard
- Enter a username and strong password
- Uncheck "Admin" to create a chatter account
- Click "Add User"

#### 3. Setup Model Accounts
- Click "Setup Model Account" from the admin dashboard
- Enter the model's Maloum.com username and password
- Select a chatter to assign the account to (optional)
- Click "Add Account"

### Chatter Functions

#### 1. Login as Chatter
- Navigate to the URL shown in the console after starting the application
- Use the credentials provided by the admin

#### 2. Managing Assigned Accounts
- You'll see only the model accounts assigned to you
- Type messages in the text field and click "Send" or press Enter
- Messages are sent from the assigned model account

## Security Features

### Authentication
- Secure password hashing using Werkzeug security utilities
- Session-based authentication with Flask-Login
- CSRF protection for all forms

### Input Validation
- Username format validation (3-50 characters, alphanumeric/underscore/hyphen only)
- Password strength validation (8+ characters with uppercase, lowercase, and digit)
- Input sanitization to prevent XSS

### Authorization
- Role-based access control
- Users can only access assigned model accounts
- All actions are logged

### Credential Protection
- Model account passwords are encrypted using Fernet (symmetric encryption)
- Passwords are never displayed to chatters
- Browser sessions maintain login state securely

## Logging
- All user activities are logged to `logs/maloum_chatter.log`
- Log rotation is enabled (max 10MB per file, up to 10 files)
- Logs include timestamps, user actions, and IP addresses

## Troubleshooting

### Common Issues

#### ChromeDriver Issues
- If you get ChromeDriver errors, ensure Google Chrome is installed
- The system will automatically download the compatible ChromeDriver

##### Permission Errors
- Ensure your user has write access to the application directory (for the database file)
- If running on Linux/macOS, you may need to adjust permissions

### Performance Considerations
- Each model account requires a separate Chrome browser instance
- Memory usage increases with each active model account
- Recommended to run on a machine with sufficient RAM for all accounts

## Maintenance

### Database Backup
The application uses SQLite for simplicity. To backup:
```bash
cp maloum_chatter.db maloum_chatter_backup.db
```

### Log Rotation
The application automatically rotates logs when they reach 10MB
Old logs are archived (up to 10 files)

## Stopping the Application
To stop the application, use Ctrl+C in the terminal where it's running.
The application will properly close all browser sessions before shutting down.

## Customization

### UI Customization
- HTML templates are located in the `templates/` directory
- CSS styles can be modified in the dashboard.html file

### Maloum.com Integration
- Selector paths for login and messaging may need to be updated
- Located in the `app.py` file in the `ModelAccountManager` class
- Look for comments indicating "Adjust selector as needed"

### Security Enhancements for Production
- Use a production WSGI server (Gunicorn, uWSGI) instead of Flask's development server
- Use a production database (PostgreSQL, MySQL) instead of SQLite
- Implement HTTPS with SSL certificate
- Set a secure SECRET_KEY environment variable
- Run the application as a non-admin user
- Implement rate limiting for login attempts