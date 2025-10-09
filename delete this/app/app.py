from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_wtf import FlaskForm
from flask_wtf.csrf import CSRFProtect
from wtforms import StringField, PasswordField, BooleanField, SelectField, SubmitField
from wtforms.validators import DataRequired, Length
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.core.os_manager import ChromeType
import platform
import threading
import time

# Version management
def get_app_version():
    """Read version from VERSION file"""
    try:
        with open('VERSION', 'r') as f:
            return f.read().strip()
    except:
        return "Unknown"

APP_VERSION = get_app_version()
import os
import secrets
from cryptography.fernet import Fernet
import json
import logging
from updater import AutoUpdater
from logging.handlers import RotatingFileHandler
import datetime
import re
import webbrowser
import zipfile
import shutil
import base64
from supabase import create_client, Client
from dotenv import load_dotenv

# Linguana Extension Configuration
LINGUANA_API_KEY = "tgp_v1_mqUckP_h-Kjdzl3_0PA0ypvRyT1-qEergHhtbnIadGo"
LINGUANA_EXTENSION_ID = "iaoabhmkdfkogollphpimkkgdjpkpghj"
LINGUANA_VERSION = "2.3.0"

# Load environment variables
load_dotenv()

# Form classes for WTForms
class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=3, max=50)])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

class AddUserForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=3, max=50)])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=8)])
    is_admin = BooleanField('Admin')
    submit = SubmitField('Add User')

class SetupAccountForm(FlaskForm):
    model_username = StringField('Model Display Name', validators=[DataRequired(), Length(min=3, max=50)])
    model_password = PasswordField('Model Password', validators=[DataRequired()])
    chatter_id = SelectField('Assign to Chatter', coerce=int, choices=[])
    submit = SubmitField('Add Account')

app = Flask(__name__)
# Generate a secure random secret key
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or secrets.token_hex(16)

# Configure Supabase for data operations
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase URL and Key must be set in environment variables")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize auto-updater
app_updater = AutoUpdater(APP_VERSION)

# Initialize extensions
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Initialize CSRF protection but apply it selectively
csrf = CSRFProtect(app)

# Initialize encryption for storing credentials
# Generate a key for encryption - in production, you should store this securely
key_file = 'secret.key'
if os.path.exists(key_file):
    with open(key_file, 'rb') as f:
        key = f.read()
else:
    key = Fernet.generate_key()
    with open(key_file, 'wb') as f:
        f.write(key)

cipher_suite = Fernet(key)

# Additional security functions
def validate_username(username):
    """Validate username format"""
    if len(username) < 3 or len(username) > 50:
        return False
    # Only allow alphanumeric characters, underscores, and hyphens
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False
    return True

def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False
    # Check if password contains at least one uppercase, lowercase, and digit
    if not re.search(r'[A-Z]', password) or not re.search(r'[a-z]', password) or not re.search(r'\d', password):
        return False
    return True

def sanitize_input(input_string):
    """Basic input sanitization"""
    # Remove potentially dangerous characters
    return input_string.replace('<', '&lt;').replace('>', '&gt;').strip()

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, id, username, password_hash, is_admin):
        self.id = id
        self.username = username
        self.password_hash = password_hash
        self.is_admin = is_admin

    @staticmethod
    def get(user_id):
        """Get user by ID from Supabase"""
        try:
            response = supabase.table('users').select('*').eq('id', user_id).execute()
            if response.data:
                user_data = response.data[0]
                # Ensure password_hash is not None or empty
                password_hash = user_data.get('password_hash', '')
                if not password_hash:
                    app.logger.warning(f'User {user_data["id"]} has invalid password hash')
                    return None
                return User(
                    id=user_data['id'],
                    username=user_data['username'],
                    password_hash=password_hash,
                    is_admin=user_data['is_admin']
                )
        except Exception as e:
            app.logger.error(f'Error getting user {user_id}: {str(e)}')
        return None

    @staticmethod
    def get_by_username(username):
        """Get user by username from Supabase"""
        try:
            response = supabase.table('users').select('*').eq('username', username).execute()
            if response.data:
                user_data = response.data[0]
                # Ensure password_hash is not None or empty
                password_hash = user_data.get('password_hash', '')
                if not password_hash:
                    app.logger.warning(f'User {user_data["username"]} has invalid password hash')
                    return None
                return User(
                    id=user_data['id'],
                    username=user_data['username'],
                    password_hash=password_hash,
                    is_admin=user_data['is_admin']
                )
        except Exception as e:
            app.logger.error(f'Error getting user by username {username}: {str(e)}')
        return None

    @staticmethod
    def create(username, password_hash, is_admin=False):
        """Create new user in Supabase"""
        try:
            # Validate password_hash is not empty
            if not password_hash:
                app.logger.error(f'Attempted to create user {username} with empty password hash')
                return None
                
            response = supabase.table('users').insert({
                'username': username,
                'password_hash': password_hash,
                'is_admin': is_admin
            }).execute()
            if response.data:
                user_data = response.data[0]
                return User(
                    id=user_data['id'],
                    username=user_data['username'],
                    password_hash=user_data['password_hash'],
                    is_admin=user_data['is_admin']
                )
        except Exception as e:
            app.logger.error(f'Error creating user {username}: {str(e)}')
        return None

    @staticmethod
    def get_all_chatters():
        """Get all non-admin users from Supabase"""
        try:
            response = supabase.table('users').select('*').eq('is_admin', False).execute()
            users = []
            for user_data in response.data:
                password_hash = user_data.get('password_hash', '')
                if password_hash:  # Only include users with valid password hashes
                    users.append(User(
                        id=user_data['id'],
                        username=user_data['username'],
                        password_hash=password_hash,
                        is_admin=user_data['is_admin']
                    ))
            return users
        except Exception as e:
            app.logger.error(f'Error getting chatters: {str(e)}')
        return []

    @staticmethod
    def get_all():
        """Get all users from Supabase"""
        try:
            response = supabase.table('users').select('*').execute()
            users = []
            for user_data in response.data:
                password_hash = user_data.get('password_hash', '')
                if password_hash:  # Only include users with valid password hashes
                    users.append(User(
                        id=user_data['id'],
                        username=user_data['username'],
                        password_hash=password_hash,
                        is_admin=user_data['is_admin']
                    ))
            return users
        except Exception as e:
            app.logger.error(f'Error getting all users: {str(e)}')
        return []

    @staticmethod
    def delete(user_id):
        """Delete user from Supabase"""
        try:
            supabase.table('users').delete().eq('id', user_id).execute()
            return True
        except Exception as e:
            app.logger.error(f'Error deleting user {user_id}: {str(e)}')
        return False

    @staticmethod
    def admin_exists():
        """Check if any admin user exists"""
        try:
            response = supabase.table('users').select('id').eq('is_admin', True).limit(1).execute()
            return len(response.data) > 0
        except Exception as e:
            app.logger.error(f'Error checking admin existence: {str(e)}')
        return False

# ModelAccount helper functions
class ModelAccount:
    @staticmethod
    def get_all():
        """Get all model accounts from Supabase"""
        try:
            response = supabase.table('model_accounts').select('*').execute()
            return response.data
        except Exception as e:
            app.logger.error(f'Error getting model accounts: {str(e)}')
        return []

    @staticmethod
    def get_for_chatter(chatter_id):
        """Get model accounts assigned to a specific chatter"""
        try:
            # Convert chatter_id to int for BIGINT comparison
            chatter_int = int(chatter_id)
            app.logger.info(f'Getting accounts for chatter ID: {chatter_int}')
            
            # Get all accounts and filter in Python since PostgreSQL array contains can be tricky
            response = supabase.table('model_accounts').select('*').execute()
            accounts = response.data
            
            filtered_accounts = []
            for account in accounts:
                assigned_ids = account.get('assigned_chatter_ids', [])
                if assigned_ids:
                    # Convert all IDs to integers for comparison
                    try:
                        assigned_ids = [int(x) for x in assigned_ids if x is not None]
                        if chatter_int in assigned_ids:
                            filtered_accounts.append(account)
                            app.logger.info(f'Account {account["id"]} ({account["model_username"]}) is assigned to chatter {chatter_int}')
                    except (ValueError, TypeError) as e:
                        app.logger.warning(f'Error processing assigned_chatter_ids for account {account["id"]}: {str(e)}')
                        continue
            
            app.logger.info(f'Found {len(filtered_accounts)} accounts for chatter {chatter_int}')
            return filtered_accounts
        except Exception as e:
            app.logger.error(f'Error getting accounts for chatter {chatter_id}: {str(e)}')
        return []

    @staticmethod
    def create(model_username, actual_username, encrypted_password, assigned_chatter_ids=None):
        """Create new model account in Supabase"""
        try:
            if assigned_chatter_ids is None:
                assigned_chatter_ids = []
            
            # Convert encrypted password bytes to base64 string for storage
            if isinstance(encrypted_password, bytes):
                encrypted_password_b64 = base64.b64encode(encrypted_password).decode('utf-8')
            else:
                encrypted_password_b64 = encrypted_password
            
            response = supabase.table('model_accounts').insert({
                'model_username': model_username,
                'actual_username': actual_username,
                'encrypted_password': encrypted_password_b64,
                'assigned_chatter_ids': assigned_chatter_ids
            }).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            error_msg = str(e)
            if 'duplicate key' in error_msg and 'model_username' in error_msg:
                app.logger.error(f'Duplicate model username attempted: {model_username}')
            else:
                app.logger.error(f'Error creating model account: {error_msg}')
        return None

    @staticmethod
    def update_assignments(account_id, assigned_chatter_ids):
        """Update chatter assignments for a model account"""
        try:
            response = supabase.table('model_accounts').update({
                'assigned_chatter_ids': assigned_chatter_ids
            }).eq('id', account_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            app.logger.error(f'Error updating account assignments: {str(e)}')
        return None

    @staticmethod
    def delete(account_id):
        """Delete model account from Supabase"""
        try:
            supabase.table('model_accounts').delete().eq('id', account_id).execute()
            return True
        except Exception as e:
            app.logger.error(f'Error deleting model account {account_id}: {str(e)}')
        return False

def log_activity(user_id, action, details=None, ip_address=None):
    """Log user activity to Supabase"""
    try:
        log_entry = {
            'user_id': user_id,
            'action': action,
            'details': json.dumps(details) if details else None,
            'ip_address': ip_address
        }
        supabase.table('activity_logs').insert(log_entry).execute()
        app.logger.info(f'Activity logged: User {user_id}, Action: {action}')
    except Exception as e:
        app.logger.error(f'Error logging activity: {str(e)}')

def ensure_linguana_installed(profile_dir):
    """Auto-install Linguana extension to browser profile"""
    try:
        extensions_dir = os.path.join(profile_dir, 'Default', 'Extensions')
        extension_path = os.path.join(extensions_dir, LINGUANA_EXTENSION_ID, f'{LINGUANA_VERSION}_0')

        if not os.path.exists(extension_path):
            os.makedirs(extensions_dir, exist_ok=True)
            source = os.path.join(os.path.dirname(__file__), 'extensions', 'linguana')

            if not os.path.exists(source):
                app.logger.error(f'Linguana source not found at {source}')
                return False

            shutil.copytree(source, extension_path)
            app.logger.info(f'Linguana extension auto-installed at {extension_path}')
            return True
        else:
            app.logger.info(f'Linguana already installed at {extension_path}')
            return True

    except Exception as e:
        app.logger.error(f'Failed to install Linguana extension: {str(e)}')
        return False

def copy_linguana_to_profile(profile_dir):
    """Copy Linguana extension files to the profile's Extensions folder"""
    try:
        # Source: app/extensions/linguana
        source_path = os.path.join(os.path.dirname(__file__), 'extensions', 'linguana')

        if not os.path.exists(source_path):
            app.logger.error(f'Linguana source not found at: {source_path}')
            return False

        # Destination: profile/Default/Extensions/[extension-id]/[version]_0
        extensions_dir = os.path.join(profile_dir, 'Default', 'Extensions')
        extension_dest = os.path.join(extensions_dir, LINGUANA_EXTENSION_ID, f'{LINGUANA_VERSION}_0')

        # Create Extensions directory if it doesn't exist
        os.makedirs(extensions_dir, exist_ok=True)

        # If extension already exists in profile, remove it first
        if os.path.exists(extension_dest):
            app.logger.info(f'Removing existing Linguana from profile: {extension_dest}')
            shutil.rmtree(extension_dest)

        # Copy extension files to profile
        app.logger.info(f'Copying Linguana extension to profile: {extension_dest}')
        shutil.copytree(source_path, extension_dest)
        app.logger.info(f'Linguana extension copied successfully ({os.path.getsize(source_path)} bytes)')

        return True

    except Exception as e:
        app.logger.error(f'Failed to copy Linguana to profile: {str(e)}')
        return False

def auto_login_linguana(driver, model_username):
    """Auto-login to Linguana with model username and API key"""
    try:
        app.logger.info(f'Attempting to auto-login Linguana for {model_username}')

        # Wait longer for extension to be fully registered by Chrome
        app.logger.info('Waiting for Chrome to register extension...')
        time.sleep(5)

        # Open Linguana popup directly
        app.logger.info(f'Opening Linguana popup at chrome-extension://{LINGUANA_EXTENSION_ID}/popup.html')
        driver.get(f'chrome-extension://{LINGUANA_EXTENSION_ID}/popup.html')

        # Wait for page to fully load
        time.sleep(3)

        # Wait for username field to be present
        try:
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC

            app.logger.info('Waiting for username field to appear...')

            # Debug: Get page source to see what's actually loaded
            try:
                page_source = driver.page_source[:500]  # First 500 chars
                app.logger.info(f'Page source preview: {page_source}')
            except Exception as debug_e:
                app.logger.warning(f'Could not get page source: {debug_e}')

            username_field = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, 'username'))
            )
            username_field.clear()
            username_field.send_keys(model_username)
            app.logger.info(f'Username field filled with: {model_username}')
        except Exception as e:
            app.logger.error(f'Could not find username field: {str(e)}')
            app.logger.error(f'Current URL: {driver.current_url}')
            app.logger.error(f'Page title: {driver.title}')

            # Try to get all available extensions
            try:
                driver.get('chrome://extensions/')
                time.sleep(2)
                extensions_page = driver.page_source
                app.logger.info(f'Extensions page loaded, checking for Linguana...')
                if 'Linguana' in extensions_page or LINGUANA_EXTENSION_ID in extensions_page:
                    app.logger.info('Linguana extension found in chrome://extensions/')
                else:
                    app.logger.error('Linguana extension NOT found in chrome://extensions/')
            except Exception as ext_check_e:
                app.logger.warning(f'Could not check chrome://extensions/: {ext_check_e}')

            return False

        # Fill API key field
        try:
            api_key_field = driver.find_element(By.ID, 'apiKey')
            api_key_field.clear()
            api_key_field.send_keys(LINGUANA_API_KEY)
            app.logger.info('API key field filled')
        except Exception as e:
            app.logger.error(f'Could not find API key field: {str(e)}')
            return False

        # Click the login button specifically by ID
        try:
            login_btn = driver.find_element(By.ID, 'loginBtn')
            login_btn.click()
            app.logger.info('Clicked login button')
            time.sleep(2)
        except Exception as e:
            app.logger.warning(f'Could not find login button: {str(e)}')

        app.logger.info(f'Linguana auto-login completed for {model_username}')

        # Don't navigate back to Maloum here - let the calling function handle navigation
        # This is because we may be in different states (setup vs chatter launch)
        return True

    except Exception as e:
        app.logger.error(f'Failed to auto-login Linguana: {str(e)}')
        return False

class ModelAccountManager:
    def __init__(self):
        self.browsers = {}
        self.account_credentials = {}  # Store credentials temporarily for reconnection
        self.user_data_dirs = {}  # Store user data directory paths for each account
        
    def list_profile_structure(self, account_id, model_username):
        """List the directory structure of a browser profile for debugging"""
        try:
            profile_dir = self.get_user_data_dir(account_id, model_username)
            if not os.path.exists(profile_dir):
                app.logger.warning(f'Profile directory does not exist: {profile_dir}')
                return
            
            app.logger.info(f'Profile directory structure for account {account_id}:')
            for root, dirs, files in os.walk(profile_dir):
                rel_path = os.path.relpath(root, profile_dir)
                level = rel_path.count(os.sep)
                indent = "  " * level
                app.logger.info(f'{indent}{os.path.basename(root)}/ ({len(files)} files)')
                # Only show first level subdirectories to avoid spam
                if level < 2:
                    for d in dirs[:10]:  # Show max 10 directories per level
                        app.logger.info(f'{indent}  {d}/')
                    if len(dirs) > 10:
                        app.logger.info(f'{indent}  ... and {len(dirs) - 10} more directories')
        except Exception as e:
            app.logger.error(f'Error listing profile structure: {str(e)}')

    def check_for_extensions(self, account_id, model_username):
        """Specifically check for extension installations"""
        try:
            profile_dir = self.get_user_data_dir(account_id, model_username)
            if not os.path.exists(profile_dir):
                return
            
            app.logger.info(f'=== EXTENSION SEARCH for account {account_id} ===')
            
            # Look for any directories or files containing "extension"
            extension_locations = []
            for root, dirs, files in os.walk(profile_dir):
                rel_path = os.path.relpath(root, profile_dir)
                
                # Check for extension-related directories
                if 'extension' in rel_path.lower():
                    extension_locations.append(f'DIR: {rel_path} ({len(files)} files)')
                
                # Check for extension-related files
                for file in files:
                    if 'extension' in file.lower():
                        file_path = os.path.join(rel_path, file)
                        extension_locations.append(f'FILE: {file_path}')
            
            if extension_locations:
                app.logger.info(f'Extension-related locations found:')
                for loc in extension_locations[:20]:  # Show first 20
                    app.logger.info(f'  {loc}')
                if len(extension_locations) > 20:
                    app.logger.info(f'  ... and {len(extension_locations) - 20} more')
            else:
                app.logger.warning(f'NO extension-related files or directories found!')
                
            # Specifically check for the expected Extensions directory
            extensions_dir = os.path.join(profile_dir, 'Default', 'Extensions')
            if os.path.exists(extensions_dir):
                extension_folders = os.listdir(extensions_dir)
                app.logger.info(f'Default/Extensions directory found with {len(extension_folders)} items: {extension_folders}')
            else:
                app.logger.warning(f'Default/Extensions directory NOT found at: {extensions_dir}')
                
        except Exception as e:
            app.logger.error(f'Error checking for extensions: {str(e)}')

    def capture_session_data(self, driver, account_id):
        """Capture essential session data from browser"""
        try:
            from datetime import datetime as dt
            app.logger.info(f"Capturing session data for account {account_id}")

            session_data = {
                'cookies': [],
                'localStorage': {},
                'sessionStorage': {},
                'timestamp': str(dt.now())
            }
            
            # Capture cookies
            try:
                cookies = driver.get_cookies()
                # Filter and store essential cookies
                essential_cookie_names = [
                    'sb-', 'auth', 'token', 'session', 'login', 'jwt', 
                    'access', 'refresh', 'maloum', '_ga', 'ph_'
                ]
                
                for cookie in cookies:
                    cookie_name = cookie.get('name', '').lower()
                    # Include if cookie name contains any essential keywords
                    if any(essential in cookie_name for essential in essential_cookie_names):
                        session_data['cookies'].append({
                            'name': cookie.get('name'),
                            'value': cookie.get('value'),
                            'domain': cookie.get('domain'),
                            'path': cookie.get('path'),
                            'secure': cookie.get('secure', False),
                            'httpOnly': cookie.get('httpOnly', False)
                        })
                        app.logger.info(f"Captured cookie: {cookie.get('name')}")
                
                app.logger.info(f"Captured {len(session_data['cookies'])} essential cookies")
                
            except Exception as e:
                app.logger.error(f"Error capturing cookies: {str(e)}")
            
            # Capture localStorage
            try:
                localStorage_script = """
                var localStorage_data = {};
                for (var key in localStorage) {
                    if (localStorage.hasOwnProperty(key)) {
                        localStorage_data[key] = localStorage.getItem(key);
                    }
                }
                return localStorage_data;
                """
                localStorage_data = driver.execute_script(localStorage_script)
                session_data['localStorage'] = localStorage_data
                app.logger.info(f"Captured localStorage with {len(localStorage_data)} items: {list(localStorage_data.keys())}")
                
            except Exception as e:
                app.logger.error(f"Error capturing localStorage: {str(e)}")
            
            # Capture sessionStorage
            try:
                sessionStorage_script = """
                var sessionStorage_data = {};
                for (var key in sessionStorage) {
                    if (sessionStorage.hasOwnProperty(key)) {
                        sessionStorage_data[key] = sessionStorage.getItem(key);
                    }
                }
                return sessionStorage_data;
                """
                sessionStorage_data = driver.execute_script(sessionStorage_script)
                session_data['sessionStorage'] = sessionStorage_data
                app.logger.info(f"Captured sessionStorage with {len(sessionStorage_data)} items: {list(sessionStorage_data.keys())}")
                
            except Exception as e:
                app.logger.error(f"Error capturing sessionStorage: {str(e)}")
            
            return session_data
            
        except Exception as e:
            app.logger.error(f"Error capturing session data: {str(e)}")
            return None

    def save_session_to_supabase(self, account_id, session_data):
        """Save session data to Supabase"""
        try:
            from datetime import datetime
            
            # Update the model account with session data
            update_data = {
                'auth_tokens': session_data.get('localStorage', {}),
                'session_cookies': session_data.get('cookies', []),
                'session_storage': session_data.get('sessionStorage', {}),
                'last_session_update': datetime.now().isoformat()
            }
            
            response = supabase.table('model_accounts').update(update_data).eq('id', account_id).execute()
            
            if response.data:
                app.logger.info(f"Session data saved to Supabase for account {account_id}")
                return True
            else:
                app.logger.error(f"No data returned when saving session for account {account_id}")
                return False
                
        except Exception as e:
            app.logger.error(f"Error saving session to Supabase: {str(e)}")
            return False

    def restore_session_from_supabase(self, driver, account_id):
        """Restore session data from Supabase to browser"""
        try:
            app.logger.info(f"Restoring session from Supabase for account {account_id}")
            
            # Get session data from Supabase
            response = supabase.table('model_accounts').select('auth_tokens, session_cookies, session_storage, last_session_update').eq('id', account_id).execute()
            
            if not response.data:
                app.logger.warning(f"No session data found in Supabase for account {account_id}")
                return False
            
            account_data = response.data[0]
            
            # Restore cookies
            if account_data.get('session_cookies'):
                try:
                    for cookie_data in account_data['session_cookies']:
                        driver.add_cookie({
                            'name': cookie_data['name'],
                            'value': cookie_data['value'],
                            'domain': cookie_data['domain'],
                            'path': cookie_data['path'],
                            'secure': cookie_data.get('secure', False),
                            'httpOnly': cookie_data.get('httpOnly', False)
                        })
                    app.logger.info(f"Restored {len(account_data['session_cookies'])} cookies")
                except Exception as e:
                    app.logger.error(f"Error restoring cookies: {str(e)}")
            
            # Restore localStorage
            if account_data.get('auth_tokens'):
                try:
                    for key, value in account_data['auth_tokens'].items():
                        localStorage_script = f"localStorage.setItem('{key}', '{value}');"
                        driver.execute_script(localStorage_script)
                    app.logger.info(f"Restored {len(account_data['auth_tokens'])} localStorage items")
                except Exception as e:
                    app.logger.error(f"Error restoring localStorage: {str(e)}")
            
            # Restore sessionStorage
            if account_data.get('session_storage'):
                try:
                    for key, value in account_data['session_storage'].items():
                        sessionStorage_script = f"sessionStorage.setItem('{key}', '{value}');"
                        driver.execute_script(sessionStorage_script)
                    app.logger.info(f"Restored {len(account_data['session_storage'])} sessionStorage items")
                except Exception as e:
                    app.logger.error(f"Error restoring sessionStorage: {str(e)}")
            
            app.logger.info(f"Session restoration completed for account {account_id}")
            return True
            
        except Exception as e:
            app.logger.error(f"Error restoring session from Supabase: {str(e)}")
            return False

    def backup_browser_profile(self, account_id, model_username):
        """Backup browser profile to Supabase storage"""
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                profile_dir = self.get_user_data_dir(account_id, model_username)
                
                if not os.path.exists(profile_dir):
                    app.logger.error(f'Profile directory does not exist: {profile_dir}')
                    return False
                
                # Create a zip file of the browser profile
                backup_path = f"{profile_dir}_backup.zip"
                
                # Remove existing backup file if it exists
                if os.path.exists(backup_path):
                    try:
                        os.remove(backup_path)
                    except Exception as e:
                        app.logger.warning(f'Could not remove existing backup file: {str(e)}')
                
                # Essential files for session and extension restoration
                # CRITICAL: These specific files contain authentication tokens and session data
                essential_files = [
                    'cookies', 'login data', 'preferences', 'local storage', 
                    'session storage', 'web data', 'bookmarks', 'history',
                    'network', 'secure preferences', 'extensions',
                    # Specific authentication/session files:
                    'current', 'log', 'manifest', 'lock',  # LevelDB files
                    'leveldb', '.log', '.ldb', '.dbtmp'  # LevelDB extensions
                ]
                
                # Essential directories that must be included
                # CRITICAL: localStorage leveldb directory is where authentication tokens are stored
                # CRITICAL: Default\Extensions directory is where Chrome stores installed extensions
                essential_dirs = [
                    'extensions', 'local extension settings', 'extension state',
                    'extension scripts', 'extension rules', 'default\\extensions',
                    'default/extensions',  # Both Windows and Unix style paths
                    'local storage', 'local storage\\leveldb',  # CRITICAL: Authentication tokens here
                    'session storage', 'session storage\\leveldb',
                    'network', 'default\\network', 'default\\local storage',
                    'default\\session storage', 'gcm store', 'sync data', 'sync data\\leveldb'
                ]
                
                # Files/patterns to skip (but allow essential ones)
                # NOTE: LOCK files are skipped by default but will be allowed in essential directories
                skip_patterns = [
                    'tmp', 'temp', 'lockfile', 'singleton',
                    'crashpad', 'gpu', 'webrtc', 'pnacl', 'swiftshader',
                    'devtools', 'metrics', 'crash', 'blob', 'pepper',
                    'shader', 'dawn', 'graphics', 'download', 'media', 'thumbnails'
                ]
                
                # Directories to skip (but allow essential ones)
                skip_dirs = [
                    'cache', 'temp', 'tmp', 'logs', 'crashpad', 'metrics',
                    'devtools', 'crash reports', 'blob_storage', 'webrtc logs',
                    'pepper data', 'shader cache', 'grshader', 'dawn',
                    'gpucache', 'certificate transparency', 'download service', 
                    'media', 'thumbnails', 'favicons', 'top sites', 'visit urls',
                    'code cache'  # Keep this as cache files are large but not essential
                ]
                
                files_added = 0
                skipped_files = 0
                
                try:
                    with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
                        for root, dirs, files in os.walk(profile_dir):
                            # Check if this directory or any parent is essential
                            # Normalize path separators for consistent checking
                            rel_path = os.path.relpath(root, profile_dir).lower().replace('\\', '/')

                            # CRITICAL: Specific checks for authentication-related directories
                            is_localStorage_dir = ('local storage' in rel_path) or ('localstorage' in rel_path)
                            is_sessionStorage_dir = ('session storage' in rel_path) or ('sessionstorage' in rel_path)
                            is_extensions_dir = 'extension' in rel_path or rel_path.startswith('default/extensions')
                            is_network_dir = 'network' in rel_path
                            is_cookies_dir = 'cookies' in rel_path
                            is_sync_data_dir = 'sync data' in rel_path or 'syncdata' in rel_path

                            # General essential directory check (also normalize paths in essential_dirs)
                            normalized_essential_dirs = [d.lower().replace('\\', '/') for d in essential_dirs]
                            is_essential_dir = any(essential in rel_path for essential in normalized_essential_dirs)

                            # Force include critical authentication directories INCLUDING chrome.storage.sync
                            is_critical_auth_dir = is_localStorage_dir or is_sessionStorage_dir or is_network_dir or is_cookies_dir or is_sync_data_dir

                            # Final decision: essential OR critical auth directory OR extensions
                            is_essential_dir = is_essential_dir or is_critical_auth_dir or is_extensions_dir

                            # Debug: Log directory decisions for critical paths
                            if is_critical_auth_dir or is_extensions_dir:
                                app.logger.info(f'Directory decision: {rel_path} - Essential: {is_essential_dir} (localStorage: {is_localStorage_dir}, sessionStorage: {is_sessionStorage_dir}, syncData: {is_sync_data_dir}, extensions: {is_extensions_dir})')

                            # Skip directories unless they are essential
                            # IMPORTANT: Check each subdirectory individually to see if it's essential
                            kept_dirs = []
                            for d in dirs:
                                subdir_rel_path = os.path.join(rel_path, d).lower().replace('\\', '/')
                                is_subdir_essential = any(essential in subdir_rel_path for essential in normalized_essential_dirs)
                                is_subdir_extensions = 'extension' in subdir_rel_path or subdir_rel_path.endswith('/extensions')
                                is_subdir_skip = any(skip in d.lower() for skip in skip_dirs)

                                # Keep if: parent is essential, OR subdir is essential, OR subdir is extensions, AND not explicitly skipped
                                if (is_essential_dir or is_subdir_essential or is_subdir_extensions) and not is_subdir_skip:
                                    kept_dirs.append(d)
                                    if is_subdir_extensions:
                                        app.logger.info(f'Keeping extensions subdirectory: {subdir_rel_path}')

                            dirs[:] = kept_dirs
                            
                            for file in files:
                                file_path = os.path.join(root, file)
                                file_lower = file.lower()

                                # Check if file is essential or in essential directory
                                is_essential_file = any(essential in file_lower for essential in essential_files)
                                is_in_essential_dir = is_essential_dir or any(essential in rel_path for essential in normalized_essential_dirs)

                                # CRITICAL: Force include localStorage/sessionStorage/syncData database files
                                is_critical_auth_file = (is_localStorage_dir or is_sessionStorage_dir or is_sync_data_dir) and (
                                    file_lower in ['current', 'log', 'lock', 'manifest-000001'] or
                                    file_lower.endswith(('.log', '.ldb', '.dbtmp')) or
                                    file_lower.startswith(('000', 'manifest'))
                                )

                                # CRITICAL: Include extension files - they were copied for backup
                                is_extension_file = is_extensions_dir

                                is_essential = is_essential_file or is_in_essential_dir or is_critical_auth_file or is_extension_file
                                
                                # Skip temp files (but allow LOCK files in critical auth directories)
                                if file_lower.endswith(('.tmp', '.temp')):
                                    skipped_files += 1
                                    continue
                                
                                # Allow LOCK files in critical auth directories, skip them elsewhere
                                if file_lower.endswith('.lock') and not is_critical_auth_file:
                                    skipped_files += 1
                                    continue
                                
                                # Skip files based on patterns (unless essential)
                                if not is_essential and any(skip in file_lower for skip in skip_patterns):
                                    skipped_files += 1
                                    continue
                                
                                # Handle file size limits
                                try:
                                    file_size = os.path.getsize(file_path)

                                    # For extension files, be much more generous with size limits
                                    # Extensions like Linguana can be several MB per file
                                    if 'extension' in rel_path:
                                        if file_size > 50 * 1024 * 1024:  # 50MB limit for extension files
                                            app.logger.warning(f'Skipping large extension file: {file_path} ({file_size / (1024*1024):.1f} MB)')
                                            skipped_files += 1
                                            continue
                                    # For other essential files (authentication, session data)
                                    elif is_essential:
                                        if file_size > 10 * 1024 * 1024:  # 10MB limit for essential files
                                            skipped_files += 1
                                            continue
                                    # For non-essential files
                                    else:
                                        if file_size > 2 * 1024 * 1024:  # 2MB limit for non-essential files
                                            skipped_files += 1
                                            continue
                                except:
                                    skipped_files += 1
                                    continue
                                
                                # Check if file is accessible before trying to add it
                                try:
                                    # Test if we can read the file
                                    with open(file_path, 'rb') as test_f:
                                        test_f.read(1)
                                    
                                    arcname = os.path.relpath(file_path, profile_dir)
                                    zipf.write(file_path, arcname)
                                    files_added += 1
                                    
                                    # Log files being added for debugging
                                    if is_essential or 'extension' in rel_path or is_critical_auth_file:
                                        file_rel_path = os.path.relpath(file_path, profile_dir)
                                        app.logger.info(f'Added file: {file_rel_path} ({file_size} bytes) - Essential: {is_essential}, CriticalAuth: {is_critical_auth_file}')
                                    
                                except PermissionError:
                                    app.logger.debug(f'Permission denied for file: {file_path}')
                                    skipped_files += 1
                                    continue
                                except Exception as file_error:
                                    app.logger.debug(f'Skipped file {file_path}: {str(file_error)}')
                                    skipped_files += 1
                                    continue
                
                except Exception as zip_error:
                    app.logger.error(f'Error creating zip file (attempt {attempt + 1}): {str(zip_error)}')
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    else:
                        return False
                
                if files_added == 0:
                    app.logger.error(f'No files were added to backup (skipped {skipped_files} files)')
                    if os.path.exists(backup_path):
                        os.remove(backup_path)
                    return False
                
                # Check if zip file was created and has reasonable size
                if not os.path.exists(backup_path):
                    app.logger.error('Backup file was not created')
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    return False
                
                zip_size = os.path.getsize(backup_path)
                if zip_size < 1000:
                    app.logger.error(f'Backup file is too small: {zip_size} bytes')
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    return False
                
                # Check if backup is too large for Supabase (increased limit for extensions)
                max_size = 40 * 1024 * 1024  # 40MB to accommodate extensions like Linguana
                if zip_size > max_size:
                    app.logger.error(f'Backup file too large: {zip_size / (1024*1024):.1f} MB (max: {max_size / (1024*1024):.1f} MB)')
                    if attempt < max_retries - 1:
                        # Try again with even more restrictive filtering
                        time.sleep(retry_delay)
                        continue
                    return False
                
                # Read the zip file and encode as base64 for storage
                try:
                    with open(backup_path, 'rb') as f:
                        backup_data = base64.b64encode(f.read()).decode('utf-8')
                except Exception as read_error:
                    app.logger.error(f'Error reading backup file: {str(read_error)}')
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    return False
                
                # Store in Supabase
                try:
                    response = supabase.table('model_accounts').update({
                        'browser_profile_backup': backup_data
                    }).eq('id', account_id).execute()
                    
                    if not response.data:
                        app.logger.error('Failed to update Supabase record')
                        if attempt < max_retries - 1:
                            time.sleep(retry_delay)
                            continue
                        return False
                        
                except Exception as db_error:
                    app.logger.error(f'Error storing backup in Supabase: {str(db_error)}')
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    return False
                
                # Clean up temporary zip file
                try:
                    os.remove(backup_path)
                except Exception as cleanup_error:
                    app.logger.warning(f'Could not remove temporary backup file: {str(cleanup_error)}')
                
                app.logger.info(f'Browser profile backed up for account {account_id} ({files_added} files, {skipped_files} skipped, {zip_size / (1024*1024):.1f} MB)')

                # Return both success status and backup statistics for verification
                return {
                    'success': True,
                    'files_added': files_added,
                    'skipped_files': skipped_files,
                    'zip_size_mb': round(zip_size / (1024*1024), 2),
                    'has_extensions': files_added > 0
                }
                
            except Exception as e:
                app.logger.error(f'Error backing up browser profile (attempt {attempt + 1}): {str(e)}')
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
                
        app.logger.error(f'Failed to backup browser profile after {max_retries} attempts')
        return {'success': False, 'error': 'Failed after multiple attempts'}
    
    def verify_backup_contents(self, backup_data):
        """Verify what's in a backup without extracting it"""
        try:
            import io
            backup_bytes = base64.b64decode(backup_data)

            with zipfile.ZipFile(io.BytesIO(backup_bytes), 'r') as zipf:
                file_list = zipf.namelist()

                # Analyze backup contents
                extension_files = [f for f in file_list if 'extension' in f.lower()]
                session_files = [f for f in file_list if any(key in f.lower() for key in ['cookies', 'login', 'session', 'preferences', 'local storage', 'network'])]

                # Check for actual extension installations (not just metadata)
                actual_extension_dirs = set()
                for f in extension_files:
                    # Normalize path separators for Windows compatibility
                    f_normalized = f.replace('\\', '/').lower()
                    if 'default/extensions/' in f_normalized:
                        # Extract extension ID from path like "Default/Extensions/abcdef123456/1.0.0_0/manifest.json"
                        parts = f.replace('\\', '/').split('/')
                        if len(parts) >= 3 and parts[0].lower() == 'default' and parts[1].lower() == 'extensions':
                            actual_extension_dirs.add(parts[2])

                return {
                    'total_files': len(file_list),
                    'extension_files': len(extension_files),
                    'session_files': len(session_files),
                    'extension_count': len(actual_extension_dirs),
                    'extension_ids': list(actual_extension_dirs),
                    'has_extensions': len(actual_extension_dirs) > 0
                }
        except Exception as e:
            app.logger.error(f'Error verifying backup contents: {str(e)}')
            return None

    def restore_browser_profile(self, account_id, model_username):
        """Restore browser profile from Supabase storage"""
        try:
            # Get backup data from Supabase
            response = supabase.table('model_accounts').select('browser_profile_backup').eq('id', account_id).execute()
            
            if not response.data or not response.data[0].get('browser_profile_backup'):
                app.logger.info(f'No backup found for account {account_id}')
                return False
            
            backup_data = response.data[0]['browser_profile_backup']
            profile_dir = self.get_user_data_dir(account_id, model_username)
            
            app.logger.info(f'Starting profile restore for account {account_id}, profile_dir: {profile_dir}')
            
            # If profile directory exists, back it up first
            if os.path.exists(profile_dir):
                backup_existing = f"{profile_dir}_existing_backup"
                if os.path.exists(backup_existing):
                    shutil.rmtree(backup_existing)
                shutil.move(profile_dir, backup_existing)
                app.logger.info(f'Moved existing profile to {backup_existing}')
            
            # Create new profile directory
            os.makedirs(profile_dir, exist_ok=True)
            
            # Decode and extract backup
            backup_zip_path = f"{profile_dir}_restore.zip"
            with open(backup_zip_path, 'wb') as f:
                f.write(base64.b64decode(backup_data))
            
            # Check zip file size
            zip_size = os.path.getsize(backup_zip_path)
            app.logger.info(f'Restored zip file size: {zip_size} bytes')
            
            with zipfile.ZipFile(backup_zip_path, 'r') as zipf:
                file_list = zipf.namelist()
                zipf.extractall(profile_dir)
                app.logger.info(f'Extracted {len(file_list)} files from backup')

                # Log detailed file restoration info
                session_files = [f for f in file_list if any(key in f.lower() for key in ['cookies', 'login', 'session', 'preferences', 'local storage', 'network'])]
                extension_files = [f for f in file_list if 'extension' in f.lower()]

                # Check for actual extension installations (not just metadata)
                actual_extension_dirs = set()
                for f in extension_files:
                    if 'default/extensions/' in f.lower():
                        parts = f.split('/')
                        if len(parts) >= 3 and parts[0].lower() == 'default' and parts[1].lower() == 'extensions':
                            actual_extension_dirs.add(parts[2])

                app.logger.info(f'=== RESTORE SUMMARY for account {account_id} ===')
                app.logger.info(f'  Total files: {len(file_list)}')
                app.logger.info(f'  Session files: {len(session_files)}')
                app.logger.info(f'  Extension-related files: {len(extension_files)}')
                app.logger.info(f'  Actual extensions installed: {len(actual_extension_dirs)}')

                if actual_extension_dirs:
                    app.logger.info(f'  Extension IDs: {list(actual_extension_dirs)}')
                    # Sample some extension files for verification
                    sample_ext_files = [f for f in extension_files if 'default/extensions/' in f.lower()][:5]
                    app.logger.info(f'  Sample extension files: {sample_ext_files}')
                else:
                    app.logger.warning(f'  WARNING: No actual extensions found in backup!')

                if not session_files:
                    app.logger.warning(f'  WARNING: No session-related files found in backup!')
            
            # Clean up temporary zip file
            os.remove(backup_zip_path)
            
            app.logger.info(f'Browser profile restored successfully for account {account_id}')
            return True
            
        except Exception as e:
            app.logger.error(f'Error restoring browser profile: {str(e)}')
            return False
        
    def get_user_data_dir(self, account_id, model_username):
        """Get or create a user data directory for a specific account"""
        import tempfile
        import atexit
        import shutil
        
        if account_id not in self.user_data_dirs:
            # Create a persistent directory for this account, not a temp one
            user_dir = os.path.join(os.getcwd(), "browser_profiles", f"account_{account_id}_{model_username}")
            os.makedirs(user_dir, exist_ok=True)
            self.user_data_dirs[account_id] = user_dir
            
            # Register cleanup function to preserve profile data
            def cleanup_func():
                # Don't delete the directory on shutdown to preserve session data
                pass  # Keep profile data between runs
            atexit.register(cleanup_func)
        
        return self.user_data_dirs[account_id]
    
    def check_profile_contents(self, account_id, model_username):
        """Check what files exist in the profile directory for diagnostics"""
        try:
            profile_dir = self.get_user_data_dir(account_id, model_username)
            if not os.path.exists(profile_dir):
                app.logger.warning(f'Profile directory does not exist: {profile_dir}')
                return
            
            # Count different types of files
            total_files = 0
            session_files = 0
            extension_files = 0
            
            for root, dirs, files in os.walk(profile_dir):
                for file in files:
                    total_files += 1
                    file_lower = file.lower()
                    rel_path = os.path.relpath(root, profile_dir).lower()
                    
                    if any(key in file_lower for key in ['cookies', 'login', 'session', 'preferences', 'local storage']) or any(key in rel_path for key in ['network']):
                        session_files += 1
                    if 'extension' in rel_path or 'extension' in file_lower:
                        extension_files += 1
            
            app.logger.info(f'Profile directory contents check for account {account_id}:')
            app.logger.info(f'  - Total files: {total_files}')
            app.logger.info(f'  - Session files: {session_files}')
            app.logger.info(f'  - Extension files: {extension_files}')
            app.logger.info(f'  - Profile path: {profile_dir}')
            
        except Exception as e:
            app.logger.error(f'Error checking profile contents: {str(e)}')

    def start_browser_session(self, account_id, username, password, model_username, open_for_chatter=False):
        """Start a browser session for a model account with persistent profile"""
        # Store credentials for potential reconnection (only for admin setup)
        if not open_for_chatter:
            self.account_credentials[account_id] = {
                'username': username,
                'password': password
            }

        # Get the user data directory for this account
        user_data_dir = self.get_user_data_dir(account_id, username)
        app.logger.info(f'Using browser profile directory: {user_data_dir}')

        chrome_options = Options()
        chrome_options.add_argument(f"--user-data-dir={user_data_dir}")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        # For chatter use, make the browser more visible and user-friendly
        if open_for_chatter:
            chrome_options.add_argument("--start-maximized")
        
        driver = None
        try:
            # Use specific Chrome type to avoid architecture issues
            try:
                service = Service(ChromeDriverManager(chrome_type=ChromeType.GOOGLE).install())
                driver = webdriver.Chrome(service=service, options=chrome_options)
            except Exception as e:
                print(f"ChromeDriverManager failed: {e}, trying direct Chrome")
                # Fallback to direct Chrome if ChromeDriverManager fails
                driver = webdriver.Chrome(options=chrome_options)
            
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

            # For chatter use, restore session from Supabase and verify login
            if open_for_chatter:
                app.logger.info(f"=== RESTORING SESSION FROM SUPABASE for account {account_id} ===")
                
                # First, navigate to the domain to set up for cookie restoration
                driver.get("https://app.maloum.com")
                app.logger.info(f"Initial page load: {driver.current_url}")
                
                # Restore session data from Supabase
                session_restored = self.restore_session_from_supabase(driver, account_id)
                
                if session_restored:
                    app.logger.info(f"✓ Session data restored from Supabase for account {account_id}")
                    
                    # Refresh the page to apply restored session data
                    driver.refresh()
                    
                    # Wait a moment for the page to load with restored session
                    time.sleep(2)
                    
                else:
                    app.logger.warning(f"✗ Failed to restore session data from Supabase for account {account_id}")
                
                # Now try to go to the chat page to verify login
                chat_url = "https://app.maloum.com/chat"
                app.logger.info(f"Navigating to chat page: {chat_url}")
                driver.get(chat_url)
                
                # Log the current URL to see where we actually ended up
                current_url = driver.current_url
                app.logger.info(f"After navigation, current URL: {current_url}")
                
                # Wait to see if we're logged in
                try:
                    # Check if we're already logged in by looking for the Messages header
                    WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Messages')]"))
                    )
                    app.logger.info(f"Session restored successfully for {username}, found Messages header")
                    print(f"Session restored successfully for {username}")

                    # Store the driver in our managers
                    self.browsers[account_id] = driver
                    return True, f"Browser session restored successfully for {username}"
                    
                except:
                    # Check what page we're actually on
                    current_url = driver.current_url
                    page_title = driver.title
                    app.logger.warning(f"Session check failed for {username}. Current URL: {current_url}, Title: {page_title}")
                    
                    # Log cookies again after failed login attempt
                    cookies_after = driver.get_cookies()
                    app.logger.info(f"Cookies after failed login: {len(cookies_after)}")
                    
                    # Check if we're on login page specifically
                    if "login" in current_url.lower():
                        app.logger.info(f"Redirected to login page - session expired for {username}")
                        message = f"Session expired for {username}. Please contact admin to refresh the account session."
                    else:
                        app.logger.info(f"Unknown page state for {username}, may need manual intervention")
                        message = f"Browser opened for {username} but unable to verify login status. Current page: {page_title}"
                    
                    print(f"Session issue for {username}: {message}")
                    self.browsers[account_id] = driver
                    return True, message
            
            # For admin setup, proceed with full login process
            else:
                # First try to go directly to the chat page to check if already logged in
                chat_url = "https://app.maloum.com/chat"
                driver.get(chat_url)
                
                # Wait a moment to see if we're already logged in
                try:
                    # Check if we're already logged in by looking for the Messages header
                    WebDriverWait(driver, 3).until(
                        EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Messages')]"))
                    )
                    print(f"Already logged in for {username}, staying on chat page")
                    
                    # Store the driver in our managers
                    self.browsers[account_id] = driver
                    return True, f"Browser session restored successfully for {username} (already logged in)"
                    
                except:
                    # Not logged in, need to login
                    print(f"Not logged in, proceeding with login for {username}")
                
                # Navigate to Maloum.com login page
                login_url = "https://app.maloum.com/login?returnPath=/chat"
                driver.get(login_url)
                
                # Handle cookie consent if it appears
                try:
                    # Wait for cookie consent button and click it
                    accept_button = WebDriverWait(driver, 5).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, "a.cmpboxbtn.cmpboxbtnyes.cmptxt_btn_yes"))
                    )
                    accept_button.click()
                    print("Cookie consent accepted")
                except:
                    # If cookie consent doesn't appear, continue
                    print("No cookie consent window found, continuing...")
                
                # Wait for and fill in the username field
                username_field = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.NAME, "usernameOrEmail"))
                )
                username_field.clear()
                username_field.send_keys(username)
                
                # Fill in the password field
                password_field = driver.find_element(By.NAME, "password")
                password_field.clear()
                password_field.send_keys(password)
                
                # Click the login button
                login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'].flex.h-fit.w-full")
                login_button.click()
                
                # Wait to see if login was successful by checking for the Messages header
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Messages')]"))
                )
                
                print(f"Successfully logged in for {username}")
                
                # CRITICAL: For admin setup, capture and store session data in Supabase
                if not open_for_chatter:  # Only for admin setup
                    app.logger.info(f"=== CAPTURING SESSION DATA for account {account_id} ===")
                    
                    # Capture session data
                    session_data = self.capture_session_data(driver, account_id)
                    
                    # Save session data to Supabase
                    if session_data:
                        success = self.save_session_to_supabase(account_id, session_data)
                        if success:
                            app.logger.info(f"Session data saved to Supabase for account {account_id}")
                        else:
                            app.logger.error(f"Failed to save session data to Supabase for account {account_id}")
                    else:
                        app.logger.warning(f"No session data captured for account {account_id}")

                # Store the driver in our managers
                self.browsers[account_id] = driver

                return True, f"Browser session started successfully for {username}"
        
        except Exception as e:
            error_msg = str(e)
            print(f"Error starting browser session: {error_msg}")
            if driver:
                driver.quit()
            return False, f"Failed to start browser session: {error_msg}"

    def test_login(self, username, password):
        """Test login credentials without keeping the session"""
        chrome_options = Options()
        chrome_options.add_argument("--headless")  # Run in background for testing
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        driver = None
        try:
            try:
                service = Service(ChromeDriverManager(chrome_type=ChromeType.GOOGLE).install())
                driver = webdriver.Chrome(service=service, options=chrome_options)
            except Exception as e:
                print(f"ChromeDriverManager failed: {e}, trying direct Chrome")
                driver = webdriver.Chrome(options=chrome_options)
            
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # Navigate to Maloum.com login page
            login_url = "https://app.maloum.com/login?returnPath=/chat"
            driver.get(login_url)
            
            # Handle cookie consent if it appears
            try:
                accept_button = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "a.cmpboxbtn.cmpboxbtnyes.cmptxt_btn_yes"))
                )
                accept_button.click()
                print("Cookie consent accepted during test")
            except:
                print("No cookie consent window found during test")
            
            # Fill in the username field
            username_field = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.NAME, "usernameOrEmail"))
            )
            username_field.clear()
            username_field.send_keys(username)
            
            # Fill in the password field
            password_field = driver.find_element(By.NAME, "password")
            password_field.clear()
            password_field.send_keys(password)
            
            # Click the login button
            login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'].flex.h-fit.w-full")
            login_button.click()
            
            # Wait to see if login was successful by checking for the Messages header
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Messages')]"))
            )
            
            return True, "Login successful!"
        
        except Exception as e:
            error_msg = str(e)
            return False, f"Login failed: {error_msg}"
        
        finally:
            if driver:
                driver.quit()

    def cleanup(self):
        """Close all browser sessions"""
        for account_id, driver in self.browsers.items():
            try:
                driver.quit()
                print(f"Closed browser session for account {account_id}")
            except Exception as e:
                print(f"Error closing browser session for account {account_id}: {e}")
        self.browsers.clear()

# Create model manager instance
model_manager = ModelAccountManager()

@login_manager.user_loader
def load_user(user_id):
    return User.get(str(user_id))

@app.route('/')
def home():
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        username = sanitize_input(form.username.data)
        password = form.password.data
        
        user = User.get_by_username(username)
        if user and user.password_hash and check_password_hash(user.password_hash, password):
            login_user(user)
            log_activity(current_user.id, 'login', {'ip': request.remote_addr}, request.remote_addr)
            return redirect(url_for('dashboard'))
        else:
            app.logger.warning(f'Failed login attempt for username: {username} from IP: {request.remote_addr}')
            return render_template('login.html', form=form, error='Invalid username or password')
    return render_template('login.html', form=form)

@app.route('/logout')
@login_required
def logout():
    log_activity(current_user.id, 'logout', {'ip': request.remote_addr}, request.remote_addr)
    logout_user()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.is_admin:
        # Admin sees all accounts and all users
        accounts = ModelAccount.get_all()
        users = User.get_all()
        
        # Populate assigned_chatters for each account for display
        all_users = {user.id: user for user in users}
        for account in accounts:
            assigned_ids = account.get('assigned_chatter_ids', [])
            if assigned_ids:
                # Convert to integers and get user objects
                account['assigned_chatters'] = []
                for chatter_id in assigned_ids:
                    try:
                        chatter_id = int(chatter_id)
                        if chatter_id in all_users:
                            account['assigned_chatters'].append(all_users[chatter_id])
                    except (ValueError, TypeError):
                        continue
            else:
                account['assigned_chatters'] = []
        
        # Calculate statistics for admin dashboard
        assigned_accounts_count = sum(1 for account in accounts if account.get('assigned_chatter_ids'))
        unassigned_accounts_count = len(accounts) - assigned_accounts_count
        
        log_activity(current_user.id, 'view_dashboard', {'role': 'admin', 'account_count': len(accounts)}, request.remote_addr)
    else:
        # Chatter sees only assigned accounts
        accounts = ModelAccount.get_for_chatter(current_user.id)
        users = []
        assigned_accounts_count = 0
        unassigned_accounts_count = 0
        
        # Add assigned_chatters field for consistency (though not needed for chatters)
        for account in accounts:
            account['assigned_chatters'] = []
        
        log_activity(current_user.id, 'view_dashboard', {'role': 'chatter', 'account_count': len(accounts)}, request.remote_addr)
    
    return render_template('dashboard.html', 
                         accounts=accounts, 
                         users=users,
                         assigned_accounts_count=assigned_accounts_count,
                         unassigned_accounts_count=unassigned_accounts_count,
                         is_admin=current_user.is_admin,
                         app_version=APP_VERSION)

@app.route('/model_accounts')
@login_required
def model_accounts():
    if not current_user.is_admin:
        return redirect(url_for('dashboard'))
    
    # Get all accounts and users for admin
    accounts = ModelAccount.get_all()
    users = User.get_all()
    
    # Populate assigned_chatters for each account for display
    all_users = {user.id: user for user in users}
    for account in accounts:
        assigned_ids = account.get('assigned_chatter_ids', [])
        if assigned_ids:
            # Convert to integers and get user objects
            account['assigned_chatters'] = []
            for chatter_id in assigned_ids:
                try:
                    chatter_id = int(chatter_id)
                    if chatter_id in all_users:
                        account['assigned_chatters'].append(all_users[chatter_id])
                except (ValueError, TypeError):
                    continue
        else:
            account['assigned_chatters'] = []
    
    log_activity(current_user.id, 'view_model_accounts', {'account_count': len(accounts)}, request.remote_addr)
    
    return render_template('model_accounts.html', 
                         accounts=accounts, 
                         users=users,
                         app_version=APP_VERSION)

@app.route('/user_management')
@login_required
def user_management():
    if not current_user.is_admin:
        return redirect(url_for('dashboard'))
    
    # Get all users for admin
    users = User.get_all()
    
    log_activity(current_user.id, 'view_user_management', {'user_count': len(users)}, request.remote_addr)
    
    return render_template('user_management.html', 
                         users=users,
                         app_version=APP_VERSION)

@app.route('/delete_user/<int:user_id>')
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        return 'Access denied', 403
    
    if user_id == current_user.id:
        return jsonify({'error': 'Cannot delete yourself'}), 400
    
    if User.delete(user_id):
        log_activity(current_user.id, 'delete_user', {'deleted_user_id': user_id}, request.remote_addr)
        return redirect(url_for('dashboard'))
    else:
        return jsonify({'error': 'User not found'}), 404

@app.route('/delete_account/<int:account_id>')
@login_required
def delete_account(account_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        # Get account details for logging
        accounts = ModelAccount.get_all()
        account = next((acc for acc in accounts if acc['id'] == account_id), None)
        
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        # Close browser session if it's open
        if account_id in model_manager.browsers:
            try:
                model_manager.browsers[account_id].quit()
                del model_manager.browsers[account_id]
                app.logger.info(f'Closed browser session for deleted account {account_id}')
            except Exception as e:
                app.logger.warning(f'Could not close browser for account {account_id}: {str(e)}')
        
        # Clean up browser profile directory
        try:
            profile_dir = model_manager.get_user_data_dir(account_id, account['model_username'])
            if os.path.exists(profile_dir):
                shutil.rmtree(profile_dir)
                app.logger.info(f'Cleaned up browser profile directory for account {account_id}')
        except Exception as e:
            app.logger.warning(f'Could not clean up profile directory for account {account_id}: {str(e)}')
        
        # Delete from database
        if ModelAccount.delete(account_id):
            log_activity(current_user.id, 'delete_account', {
                'account_id': account_id,
                'model_username': account['model_username']
            }, request.remote_addr)
            return jsonify({'success': True, 'message': 'Account deleted successfully'})
        else:
            return jsonify({'error': 'Failed to delete account'}), 500
        
    except Exception as e:
        app.logger.error(f'Error deleting account {account_id}: {str(e)}')
        return jsonify({'error': f'Error deleting account: {str(e)}'}), 500

@app.route('/launch_account/<int:account_id>')
@login_required
def launch_account(account_id):
    accounts = ModelAccount.get_all()
    account = next((acc for acc in accounts if acc['id'] == account_id), None)
    
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    
    # Check if the current user has access to this account
    if not current_user.is_admin:
        assigned_ids = account.get('assigned_chatter_ids', [])
        # Convert assigned_ids to integers for comparison
        try:
            assigned_ids = [int(x) for x in assigned_ids if x is not None]
            if int(current_user.id) not in assigned_ids:
                app.logger.warning(f'Access denied: User {current_user.id} not in assigned_ids {assigned_ids} for account {account_id}')
                return jsonify({'error': 'Access denied'}), 403
        except (ValueError, TypeError) as e:
            app.logger.error(f'Error processing assigned_chatter_ids for account {account_id}: {str(e)}')
            return jsonify({'error': 'Access denied'}), 403
    
    # Decrypt the password
    try:
        encrypted_password = account['encrypted_password']
        # If it's a base64 string, decode it first
        if isinstance(encrypted_password, str):
            encrypted_password = base64.b64decode(encrypted_password.encode('utf-8'))
        decrypted_password = cipher_suite.decrypt(encrypted_password).decode()
    except Exception as e:
        return jsonify({'error': f'Failed to decrypt password: {str(e)}'}), 500
    
    # Use actual_username if available, otherwise fall back to model_username
    login_username = account.get('actual_username') or account['model_username']
    
    # Try to restore browser profile first
    app.logger.info(f'=== LAUNCHING ACCOUNT {account_id} ({account["model_username"]}) ===')
    app.logger.info(f'Step 1: Attempting to restore browser profile from Supabase backup')
    restore_success = model_manager.restore_browser_profile(account_id, account['model_username'])
    app.logger.info(f'Profile restore result: {restore_success}')

    # Check what's actually in the profile directory after restore
    model_manager.check_profile_contents(account_id, account['model_username'])

    # Give Chrome MORE time to recognize the restored profile and extensions
    # Extensions need time to be registered by Chrome
    if restore_success:
        app.logger.info('Step 2: Waiting 5 seconds for Chrome to recognize restored profile and extensions')
        time.sleep(5)
        app.logger.info('Profile should now be ready for browser launch')
    
    # Start browser session
    success, message = model_manager.start_browser_session(
        account_id,
        login_username,
        decrypted_password,
        account['model_username'],
        open_for_chatter=True
    )
    
    if success:
        log_activity(current_user.id, 'launch_account', {
            'account_id': account_id, 
            'model_username': account['model_username']
        }, request.remote_addr)
        return jsonify({'success': True, 'message': message})
    else:
        return jsonify({'success': False, 'message': message})


@app.route('/setup_accounts', methods=['GET', 'POST'])
@login_required
def setup_accounts():
    if not current_user.is_admin:
        return 'Access denied', 403
        
    chatters = User.get_all_chatters()
    chatter_choices = [(0, '(Unassigned)')] + [(chatter.id, chatter.username) for chatter in chatters]
    
    form = SetupAccountForm()
    form.chatter_id.choices = chatter_choices
    
    if form.validate_on_submit():
        model_username = sanitize_input(form.model_username.data)
        actual_username = sanitize_input(request.form.get('actual_username', ''))
        model_password = form.model_password.data
        chatter_id = form.chatter_id.data if form.chatter_id.data != 0 else None
        
        # Use actual_username if provided, otherwise fall back to model_username
        login_username = actual_username if actual_username else model_username
        
        # Encrypt the password
        encrypted_password = cipher_suite.encrypt(model_password.encode())
        
        # Create assigned_chatter_ids list (convert to int for BIGINT)
        assigned_chatter_ids = [int(chatter_id)] if chatter_id else []
        
        # Check if model username already exists
        existing_accounts = ModelAccount.get_all()
        if any(acc['model_username'].lower() == model_username.lower() for acc in existing_accounts):
            return render_template('setup_accounts.html', form=form, 
                                 error=f'Model username "{model_username}" already exists. Please choose a different name.')
        
        # Create the account first
        account = ModelAccount.create(model_username, actual_username, encrypted_password, assigned_chatter_ids)
        
        if account:
            # Start browser session to verify login and allow extension installation
            success, message = model_manager.start_browser_session(
                account['id'],
                login_username,
                model_password,
                model_username,
                open_for_chatter=False  # This is for setup, not chatter use
            )
            
            if success:
                log_activity(current_user.id, 'setup_account', {
                    'model_username': model_username,
                    'actual_username': actual_username,
                    'assigned_chatter_id': chatter_id,
                    'browser_opened': True
                }, request.remote_addr)
                return render_template('setup_accounts.html', form=form, 
                                     success=f'Account "{model_username}" created successfully! Browser opened for extension installation. You can backup the browser profile after installing extensions.',
                                     account_id=account['id'])
            else:
                # If browser session failed, still keep the account but show warning
                log_activity(current_user.id, 'setup_account', {
                    'model_username': model_username,
                    'actual_username': actual_username,
                    'assigned_chatter_id': chatter_id,
                    'browser_opened': False,
                    'browser_error': message
                }, request.remote_addr)
                return render_template('setup_accounts.html', form=form, 
                                     warning=f'Account "{model_username}" created, but browser session failed: {message}')
        else:
            return render_template('setup_accounts.html', form=form, error='Failed to create account')
    
    return render_template('setup_accounts.html', form=form)

@app.route('/backup_profile/<int:account_id>')
@login_required
def backup_profile(account_id):
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    try:
        # Get account details
        accounts = ModelAccount.get_all()
        account = next((acc for acc in accounts if acc['id'] == account_id), None)
        
        if not account:
            return jsonify({'success': False, 'message': 'Account not found'}), 404
        
        app.logger.info(f'Starting backup process for account {account_id}')
        
        # CRITICAL: Close browser first to unlock database files for backup
        browser_was_open = False
        if account_id in model_manager.browsers:
            try:
                browser_was_open = True
                app.logger.info(f'Closing browser for account {account_id} before backup to unlock database files')
                model_manager.browsers[account_id].quit()
                del model_manager.browsers[account_id]
                # Wait longer for Windows to release file locks (especially for extension files)
                app.logger.info(f'Waiting 5 seconds for Windows to release file locks...')
                time.sleep(5)
                app.logger.info(f'Browser closed successfully, database files should now be accessible')
            except Exception as e:
                app.logger.warning(f'Error closing browser: {str(e)}')
        
        # Check if profile directory exists
        profile_dir = model_manager.get_user_data_dir(account_id, account['model_username'])
        if not os.path.exists(profile_dir):
            return jsonify({'success': False, 'message': f'Browser profile directory not found. Please open the browser first to create a profile.'})

        # Copy Linguana extension to profile before backing up
        app.logger.info('Copying Linguana extension to profile before backup...')
        linguana_copied = copy_linguana_to_profile(profile_dir)
        if linguana_copied:
            app.logger.info('Linguana extension copied to profile successfully')
        else:
            app.logger.warning('Failed to copy Linguana extension to profile')

        # List profile structure for debugging
        model_manager.list_profile_structure(account_id, account['model_username'])
        
        # Additional check specifically for extensions
        model_manager.check_for_extensions(account_id, account['model_username'])
        
        # Check directory size and file count for diagnostic info
        total_size = 0
        file_count = 0
        for root, dirs, files in os.walk(profile_dir):
            for file in files:
                try:
                    file_path = os.path.join(root, file)
                    total_size += os.path.getsize(file_path)
                    file_count += 1
                except:
                    pass
        
        app.logger.info(f'Profile directory contains {file_count} files, total size: {total_size / (1024*1024):.1f} MB')
        
        # Backup the browser profile
        backup_result = model_manager.backup_browser_profile(account_id, account['model_username'])

        if backup_result and backup_result.get('success'):
            # Verify backup contents
            response = supabase.table('model_accounts').select('browser_profile_backup').eq('id', account_id).execute()
            verification = None
            if response.data and response.data[0].get('browser_profile_backup'):
                verification = model_manager.verify_backup_contents(response.data[0]['browser_profile_backup'])

            log_activity(current_user.id, 'backup_profile', {
                'account_id': account_id,
                'model_username': account['model_username'],
                'file_count': backup_result.get('files_added', 0),
                'skipped_files': backup_result.get('skipped_files', 0),
                'profile_size_mb': backup_result.get('zip_size_mb', 0),
                'browser_was_open': browser_was_open,
                'extensions_count': verification.get('extension_count', 0) if verification else 0
            }, request.remote_addr)

            status_msg = 'Browser profile backed up successfully!'
            if browser_was_open:
                status_msg += ' (Browser was closed during backup)'
            status_msg += f"\nBackup Stats: {backup_result.get('files_added', 0)} files ({backup_result.get('zip_size_mb', 0)} MB)"

            if verification:
                status_msg += f"\nVerification: {verification['extension_count']} extension(s) found"
                if verification['extension_count'] == 0:
                    status_msg += " - No extensions in backup - install extensions first!"

            return jsonify({
                'success': True,
                'message': status_msg,
                'backup_info': backup_result,
                'verification': verification
            })
        else:
            app.logger.error(f'Backup failed for account {account_id}')
            return jsonify({'success': False, 'message': 'Failed to backup browser profile. Check logs for details.'})
        
    except Exception as e:
        app.logger.error(f'Backup error for account {account_id}: {str(e)}')
        return jsonify({'success': False, 'message': f'Backup error: {str(e)}'})

@app.route('/add_user', methods=['GET', 'POST'])
@login_required
def add_user():
    if not current_user.is_admin:
        return 'Access denied', 403
    
    form = AddUserForm()
    if form.validate_on_submit():
        username = sanitize_input(form.username.data)
        password = form.password.data
        is_admin = form.is_admin.data
        
        # Validate input
        if not validate_username(username):
            return render_template('add_user.html', form=form, 
                                 error='Username must be 3-50 characters and contain only letters, numbers, underscores, or hyphens')
        
        if not validate_password(password):
            return render_template('add_user.html', form=form,
                                 error='Password must be at least 8 characters with uppercase, lowercase, and digit')
        
        # Check if user already exists
        existing_user = User.get_by_username(username)
        if existing_user:
            app.logger.warning(f'Admin {current_user.username} tried to create duplicate user: {username}')
            return render_template('add_user.html', form=form, error='Username already exists')
        
        # Create new user
        password_hash = generate_password_hash(password)
        new_user = User.create(username, password_hash, is_admin)
        
        if new_user:
            log_activity(current_user.id, 'add_user', {
                'new_username': username,
                'is_admin': is_admin
            }, request.remote_addr)
            return redirect(url_for('dashboard'))
        else:
            return render_template('add_user.html', form=form, error='Failed to create user')
    
    return render_template('add_user.html', form=form)

@app.route('/assign_chatter', methods=['POST'])
@csrf.exempt
@login_required
def assign_chatter():
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    try:
        data = request.get_json()
        account_id = data.get('account_id')
        chatter_id = data.get('chatter_id')
        action = data.get('action', 'assign')  # 'assign', 'unassign', or 'unassign_all'
        
        app.logger.info(f'Assignment request: account_id={account_id}, chatter_id={chatter_id}, action={action}')
        
        accounts = ModelAccount.get_all()
        account = next((acc for acc in accounts if acc['id'] == account_id), None)
        
        if not account:
            return jsonify({'success': False, 'message': 'Account not found'})
        
        # Ensure current_assignments is a list of integers
        current_assignments = account.get('assigned_chatter_ids', [])
        if current_assignments is None:
            current_assignments = []
        
        # Convert all assignments to integers for consistent comparison
        current_assignments = [int(x) for x in current_assignments if x is not None]
        
        if action == 'assign':
            if chatter_id and chatter_id not in current_assignments:
                current_assignments.append(int(chatter_id))
        elif action == 'unassign':
            if int(chatter_id) in current_assignments:
                current_assignments.remove(int(chatter_id))
        elif action == 'unassign_all':
            current_assignments = []
        
        app.logger.info(f'Updated assignments: {current_assignments}')
        
        # Update the account
        updated_account = ModelAccount.update_assignments(account_id, current_assignments)
        
        if updated_account:
            log_activity(current_user.id, f'chatter_{action}', {
                'account_id': account_id,
                'chatter_id': chatter_id,
                'current_assignments': current_assignments
            }, request.remote_addr)
            return jsonify({'success': True, 'message': f'Assignment {action}ed successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to update assignment'})
        
    except Exception as e:
        app.logger.error(f'Assignment error: {str(e)}')
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

# Auto-update routes
@app.route('/api/check-updates')
@csrf.exempt
@login_required
def check_updates():
    """Check for available updates"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    try:
        update_info = app_updater.check_for_updates()
        return jsonify(update_info)
    except Exception as e:
        app.logger.error(f'Error checking for updates: {str(e)}')
        return jsonify({
            'update_available': False,
            'error': f'Error checking for updates: {str(e)}'
        })

@app.route('/api/install-update', methods=['POST'])
@csrf.exempt
@login_required
def install_update():
    """Install available update"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    try:
        # First check for updates
        update_info = app_updater.check_for_updates()
        
        if not update_info.get('update_available'):
            return jsonify({
                'success': False,
                'message': 'No updates available'
            })
        
        # Install the update
        install_result = app_updater.download_and_install_update(update_info)
        
        if install_result.get('success'):
            log_activity(current_user.id, 'system_update', {
                'from_version': update_info['current_version'],
                'to_version': update_info['latest_version']
            }, request.remote_addr)
        
        return jsonify(install_result)
        
    except Exception as e:
        app.logger.error(f'Error installing update: {str(e)}')
        return jsonify({
            'success': False,
            'message': f'Error installing update: {str(e)}'
        })

@app.route('/api/version')
def get_version():
    """Get current application version"""
    return jsonify({
        'version': APP_VERSION,
        'last_updated': datetime.now().isoformat()
    })

@app.route('/api/backup-status/<int:account_id>')
@login_required
def get_backup_status(account_id):
    """Get backup status and extension info for an account"""
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403

    try:
        response = supabase.table('model_accounts').select('browser_profile_backup, model_username').eq('id', account_id).execute()

        if not response.data:
            return jsonify({'error': 'Account not found'}), 404

        account_data = response.data[0]
        has_backup = bool(account_data.get('browser_profile_backup'))

        result = {
            'has_backup': has_backup,
            'model_username': account_data['model_username']
        }

        if has_backup:
            verification = model_manager.verify_backup_contents(account_data['browser_profile_backup'])
            if verification:
                result['verification'] = verification
                result['status_text'] = f"{verification['extension_count']} extension(s)"
            else:
                result['status_text'] = "Backup exists"
        else:
            result['status_text'] = "No backup"

        return jsonify(result)

    except Exception as e:
        app.logger.error(f'Error getting backup status: {str(e)}')
        return jsonify({'error': str(e)}), 500

# Setup logging
if not os.path.exists('logs'):
    os.makedirs('logs')

file_handler = RotatingFileHandler('logs/maloum_chatter.log', maxBytes=10240000, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)

app.logger.setLevel(logging.INFO)
app.logger.info('Maloum Chatter Control startup')

# Cleanup function for graceful shutdown
def cleanup():
    """Clean up resources on shutdown"""
    try:
        model_manager.cleanup()
        app.logger.info('Application cleanup completed')
    except Exception as e:
        app.logger.error(f'Error during cleanup: {str(e)}')

import atexit
atexit.register(cleanup)

def find_available_port(start_port, max_attempts):
    """Find an available port starting from start_port"""
    import socket
    
    for i in range(max_attempts):
        port = start_port + i
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    
    return None

if __name__ == '__main__':
    # Create a default admin user if none exists
    if not User.admin_exists():
        admin = User.create('admin', generate_password_hash('admin123'), True)
        if admin:
            app.logger.info('Default admin user created')
    
    # Find an available port starting from 5000
    available_port = find_available_port(5000, 10)  # Try 10 ports (5000-5009)
    
    if available_port:
        try:
            print(f"Starting application on http://127.0.0.1:{available_port}")
            print("Application is ready. Browser should open automatically via the batch script, or navigate to the URL above.")
            
            app.run(debug=True, host='127.0.0.1', port=available_port, use_reloader=False)
        except KeyboardInterrupt:
            app.logger.info("Application shutdown initiated by user")
            print("\nShutting down application...")
            cleanup()
    else:
        print("No available ports found in range 5000-5009. Please free up a port in that range.")