# Changelog

All notable changes to Maloum Chatter Control will be documented in this file.

## [1.0.0] - 2025-10-04

### Added
- ✨ **Supabase-based Session Management**: Complete cloud-based authentication system
  - Session data stored in Supabase (cookies, localStorage, sessionStorage)
  - Cross-computer session persistence
  - Automatic session restoration for chatters
- 🔐 **Secure Authentication**: 
  - Admin can setup accounts without exposing credentials to chatters
  - Encrypted password storage with Fernet encryption
  - Role-based access control (Admin vs Chatter)
- 🌐 **Multi-account Management**:
  - Assign/unassign accounts to multiple chatters
  - Account assignment management interface
  - Browser profile isolation per account
- 🚀 **Automated Browser Management**:
  - Selenium-based Chrome automation
  - Automatic cookie consent handling
  - Profile backup and restoration system
- 📊 **Admin Dashboard**:
  - User management (add/delete users)
  - Account management (create/delete/assign accounts)
  - Activity logging and monitoring
- 🛡️ **Security Features**:
  - CSRF protection
  - Secure session management
  - IP-based activity logging
- 📋 **Version Control**: Version display and tracking system

### Technical Details
- **Framework**: Flask with Flask-Login
- **Database**: Supabase PostgreSQL
- **Browser Automation**: Selenium WebDriver with Chrome
- **Encryption**: Fernet symmetric encryption
- **Frontend**: HTML templates with JavaScript/AJAX

### Database Schema
- Users table with role-based permissions
- Model accounts with encrypted credentials
- Session data storage (auth_tokens, session_cookies, session_storage)
- Activity logging with detailed tracking

### Fixed
- ❌ Removed confusing success popups for chatters
- 🧹 Cleaned up development artifacts and temporary files
- 📁 Proper .gitignore to exclude sensitive browser profiles
- 🔧 Cross-platform compatibility improvements

### Security
- Browser profiles excluded from version control
- Sensitive data properly encrypted and secured
- Environment variables for configuration