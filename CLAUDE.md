# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Maloum Chatter Control System is a Flask-based web application that manages multiple Maloum.com model accounts through browser automation, allowing secure access for multiple chatters without sharing login credentials. The system uses role-based access control with Admin and Chatter roles.

## Key Architecture Components

### Backend Architecture
- **Flask Application**: Main web server (`app.py`) handling routing, authentication, and API endpoints
- **Supabase Database**: Cloud-based PostgreSQL database for all data operations (users, model accounts, activity logs)
- **Browser Automation**: Selenium WebDriver with Chrome for automating Maloum.com interactions
- **Encryption**: Fernet symmetric encryption for storing model account passwords
- **Authentication**: Flask-Login with session management and CSRF protection

### Core Classes
- **ModelAccountManager**: Handles browser session management, maintains persistent Chrome profiles per account
- **User**: Represents admin and chatter users with role-based permissions  
- **ModelAccount**: Stores encrypted credentials and chatter assignments for Maloum.com accounts
- **ActivityLog**: Tracks all user actions for audit purposes

### Browser Automation Strategy
- Each model account gets a dedicated Chrome profile directory (`browser_profiles/account_{id}_{username}`)
- Persistent browser sessions maintain login state and extensions (including Linguana Translator)
- Selenium automation handles login flow with cookie consent and form interactions
- WebDriver sessions can be launched for chatters or testing by admins

## Development Commands

### Setup and Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment template and configure Supabase
cp .env.example .env
# Edit .env with your Supabase credentials
```

### Running the Application
```bash
# Direct Python execution (recommended for development)
python app.py

# Alternative: Use automated Windows batch script
server-for-windows.bat
```

### Database Setup
The application requires Supabase tables. See `SETUP.md` for complete SQL schema:
- `users` table for authentication (id, username, password_hash, is_admin)
- `model_accounts` table for Maloum.com credentials (id, model_username, actual_username, encrypted_password, assigned_chatter_ids[])
- `activity_logs` table for audit trails (id, timestamp, user_id, action, details, ip_address)

### Testing Commands
```bash
# Test Maloum.com login credentials (via web interface)
# Navigate to Setup Model Account -> Test Login button

# Manual testing of browser automation
# Use the Launch Account feature from chatter dashboard
```

## Configuration

### Required Environment Variables
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SECRET_KEY=your-secure-random-key (optional, auto-generated if not set)
```

### Default Admin Account
- Username: `admin`
- Password: `admin123`
- Change immediately after first login

### Port Configuration
- Application auto-selects available port from 5000-5009
- Console output shows selected port for browser access

## Security Architecture

### Credential Protection
- Model account passwords encrypted with Fernet before storage
- Encryption key persisted in `secret.key` file
- Passwords never displayed to chatters in UI
- Browser profiles maintain login sessions without exposing credentials

### Access Control
- Admin users: Full system access including user management and model account setup
- Chatter users: Limited to assigned model accounts only
- Multiple chatters can be assigned to single model accounts
- Session-based authentication with CSRF protection

### Input Validation
- Username: 3-50 chars, alphanumeric/underscore/hyphen only
- Password: 8+ chars with uppercase, lowercase, and digit requirements
- Input sanitization prevents XSS attacks

## Browser Profile Management

### Profile Structure
```
browser_profiles/
├── account_{id}_{username}/
│   ├── Default/
│   │   ├── Extensions/
│   │   ├── Cache/
│   │   └── [Chrome profile data]
```

### Extension Support
- Persistent installation across sessions
- Linguana Translator specifically supported
- Extensions maintain state between launches

## Common Development Tasks

### Adding New Model Account Features
1. Extend `ModelAccount` class in both local SQLite and Supabase schemas
2. Update encryption/decryption logic in `ModelAccountManager` 
3. Modify browser automation selectors as needed for Maloum.com changes
4. Update assignment logic for multiple chatter support

### Modifying Browser Automation
- Selenium selectors located in `ModelAccountManager` class
- Login flow: `start_browser_session()` and `test_login()` methods
- Cookie consent handling included for GDPR compliance
- WebDriverWait used for dynamic content loading

### Adding Security Features
- Authentication logic in Flask-Login user_loader and route decorators
- CSRF protection via FlaskForm and CSRFProtect
- Activity logging via `log_activity()` function with dual storage

### Database Migration
- All data operations use Supabase PostgreSQL
- Schema changes must be applied via Supabase SQL console
- No local database files to manage