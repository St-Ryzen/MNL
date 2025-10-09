# Qwen Code Context - Maloum Chatter Control & Model Board Project

## Project Overview

The `mnl` directory contains two related Python Flask applications:

1. **maloum-chatter-control** - A comprehensive system for managing multiple Maloum.com model accounts through browser automation, allowing secure access for multiple chatters without sharing login credentials.

2. **model-board** - Another instance of similar functionality, both using the same underlying architecture and codebase.

The applications use role-based access control with Admin and Chatter roles, with a focus on security and account management.

## Architecture & Technology Stack

### Backend
- **Framework**: Flask with Flask-Login for authentication
- **Database**: Supabase PostgreSQL for cloud-based data storage
- **Browser Automation**: Selenium WebDriver with Chrome for Maloum.com interactions
- **Encryption**: Fernet symmetric encryption for storing model account passwords
- **Security**: CSRF protection, input validation, session management

### Key Components
- **ModelAccountManager**: Handles browser session management with persistent Chrome profiles per account
- **User**: Represents admin and chatter users with role-based permissions
- **ModelAccount**: Stores encrypted credentials and chatter assignments
- **ActivityLog**: Tracks all user actions for audit purposes

### Browser Profile Management
- Each model account gets a dedicated Chrome profile directory (`browser_profiles/account_{id}_{username}`)
- Persistent browser sessions maintain login state and extensions (including Linguana Translator)
- Extensions maintain state between launches

## Project Structure

```
mnl/
├── .claude/
├── maloum-chatter-control/
│   ├── README.txt          # Quick start instructions
│   ├── server-for-windows.bat  # Windows startup script
│   └── app/
│       ├── __pycache__/
│       ├── browser_profiles/   # Persistent Chrome profiles
│       ├── instance/          # Runtime data
│       ├── logs/              # Application logs
│       ├── templates/         # HTML templates
│       ├── .env.example       # Environment variables template
│       ├── app.py             # Main Flask application
│       ├── check_storage.py   # Storage checking utilities
│       ├── cleanup_backups.py # Backup cleanup utilities
│       ├── install.bat        # Installation batch script
│       ├── README.md          # Detailed documentation
│       ├── requirements.txt   # Python dependencies
│       ├── secret.key         # Encryption key
│       ├── SETUP.md           # Setup instructions
│       ├── start.bat          # Alternative startup script
│       ├── updater.py         # Auto-updater functionality
│       ├── VERSION            # Version number
│       └── supabase_schema_auth_update.sql # Database schema
├── model-board/
│   ├── README.txt
│   ├── server-for-windows.bat
│   └── app/                  # Same structure as maloum-chatter-control
├── CHANGELOG.md             # Version history and changes
├── CLAUDE.md                # Claude-specific development guidance
├── create_release.md        # Release creation instructions
└── .gitignore               # Git ignore patterns
```

## Core Features

### Authentication & Security
- Role-based access control (Admin vs Chatter)
- Secure password hashing with Werkzeug
- Session-based authentication with Flask-Login
- CSRF protection for all forms
- Username validation (3-50 chars, alphanumeric/underscore/hyphen)
- Password strength validation (8+ chars with uppercase/lowercase/digit)
- Fernet encryption for model account passwords
- IP-based activity logging

### Account Management
- Assign/unassign accounts to multiple chatters
- Account assignment management interface
- Browser profile isolation per account
- Automated browser management with Selenium
- Automatic cookie consent handling
- Profile backup and restoration system

### Session Management
- Supabase-based session management with cross-computer persistence
- Session data stored in Supabase (cookies, localStorage, sessionStorage)
- Automatic session restoration for chatters

## Running the Applications

### Prerequisites
- Python 3.7+
- Google Chrome browser
- Supabase account and project (see SETUP.md)

### Setup Process
1. Configure Supabase database with required tables (users, model_accounts, activity_logs)
2. Copy `.env.example` to `.env` and add your Supabase credentials
3. Install dependencies: `pip install -r requirements.txt`

### Starting the Application
**Option 1**: Direct Python execution (recommended for development):
```bash
cd maloum-chatter-control/app
python app.py
```

**Option 2**: Use automated Windows batch script (recommended for end users):
- Double-click `server-for-windows.bat` in the root directory
- This script automatically installs dependencies if needed and opens browser

### Default Credentials
- Username: `admin`
- Password: `admin123`
- **Important**: Change default password immediately after first login

### Port Selection
- The application automatically finds an available port in the range 5000-5009
- The selected port will be displayed in the console when the application starts

## Configuration Files

### Environment Variables
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SECRET_KEY=your-secure-random-key (optional, auto-generated if not set)
```

### Dependencies (requirements.txt)
- flask==2.3.3
- selenium==4.15.0
- webdriver-manager==4.0.1
- flask-login==0.6.3
- flask-wtf==1.2.1
- cryptography==41.0.4
- python-dotenv==1.0.0
- supabase==2.4.1

## Development Guidelines

### Security Best Practices
- Never commit sensitive data (database files, encryption keys, environment files)
- Use proper input validation and sanitization
- Encrypt sensitive credentials in storage
- Implement proper session management
- Use CSRF protection on all forms

### Common Development Tasks
1. **Adding New Model Account Features**:
   - Extend `ModelAccount` class in Supabase schemas
   - Update encryption/decryption logic in `ModelAccountManager`
   - Modify browser automation selectors as needed
   - Update assignment logic for multiple chatter support

2. **Modifying Browser Automation**:
   - Selenium selectors located in `ModelAccountManager` class
   - Login flow: `start_browser_session()` and `test_login()` methods
   - Cookie consent handling included for GDPR compliance

3. **Database Operations**:
   - All data operations use Supabase PostgreSQL
   - Schema changes must be applied via Supabase SQL console
   - No local database files to manage

### Version Management
- Version is stored in the `VERSION` file
- Changelog tracked in `CHANGELOG.md`
- Follow semantic versioning (major.minor.patch)
- Release instructions in `create_release.md`

## Troubleshooting

### Common Issues
- **ChromeDriver Issues**: Ensure Google Chrome is installed; system automatically downloads compatible ChromeDriver
- **Permission Errors**: Ensure write access to application directory
- **Encryption Key Issues**: Delete `maloum_chatter.db` and `secret.key` files to start fresh
- **Port Conflicts**: Application will suggest alternative ports automatically

### Performance Considerations
- Each model account requires a separate Chrome browser instance
- Memory usage increases with each active model account
- Recommended to run on a machine with sufficient RAM for all accounts

## File Locations & Purpose

- **Log Files**: `logs/maloum_chatter.log` with rotation (max 10MB per file, up to 10 files)
- **Browser Profiles**: `browser_profiles/` directory with persistent Chrome profiles
- **Templates**: `templates/` directory for HTML templates
- **Runtime Data**: `instance/` directory for runtime data