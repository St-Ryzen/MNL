from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import FlaskForm
from flask_wtf.csrf import CSRFProtect
from wtforms import StringField, PasswordField, BooleanField, SelectField, SubmitField
from wtforms.validators import DataRequired, Length
from werkzeug.security import generate_password_hash, check_password_hash
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
import os
import secrets
from cryptography.fernet import Fernet
import json
import logging
from logging.handlers import RotatingFileHandler
import datetime
import re
import webbrowser

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
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///maloum_chatter.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Initialize CSRF protection but apply it selectively
csrf = CSRFProtect(app)

# Initialize encryption for storing credentials
# Generate a key for encryption - in production, you should store this securely
key = Fernet.generate_key()
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

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)  # To distinguish between admin and chatters

class ModelAccount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    model_username = db.Column(db.String(150), unique=True, nullable=False)  # Display name for chatters
    actual_username = db.Column(db.String(150), nullable=True)  # Actual login username (optional for backward compatibility)
    encrypted_password = db.Column(db.LargeBinary, nullable=False)
    assigned_chatter_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    # Relationship
    chatter = db.relationship('User', backref='assigned_models')

# Database Model for Logs
class ActivityLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    action = db.Column(db.String(200), nullable=False)  # e.g., 'send_message', 'login', 'access_account'
    details = db.Column(db.Text)  # JSON string with additional details
    
    user = db.relationship('User', backref='activity_logs')

def log_activity(user_id, action, details=None):
    """Log user activity to database"""
    try:
        log_entry = ActivityLog(
            user_id=user_id,
            action=action,
            details=json.dumps(details) if details else None
        )
        db.session.add(log_entry)
        db.session.commit()
        app.logger.info(f'Activity logged: User {user_id}, Action: {action}')
    except Exception as e:
        app.logger.error(f'Error logging activity: {str(e)}')

class ModelAccountManager:
    def __init__(self):
        self.browsers = {}
        self.account_credentials = {}  # Store credentials temporarily for reconnection
        self.user_data_dirs = {}  # Store user data directory paths for each account
        
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

    def start_browser_session(self, account_id, username, password, open_for_chatter=False):
        """Start a browser session for a model account with persistent profile"""
        # Store credentials for potential reconnection
        self.account_credentials[account_id] = {
            'username': username,
            'password': password
        }
        
        # Get the user data directory for this account
        user_data_dir = self.get_user_data_dir(account_id, username)
        
        chrome_options = Options()
        chrome_options.add_argument(f"--user-data-dir={user_data_dir}")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
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
            
            # Wait for successful login by checking for the Messages header
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'Messages')]"))
            )
            
            print(f"Successfully logged in to account {username}")
            
            # Store the browser instance
            self.browsers[account_id] = {
                'driver': driver,
                'username': username,
                'password': password,
                'user_data_dir': user_data_dir
            }
            return True
        except Exception as e:
            print(f"Error logging into account {username}: {str(e)}")
            if driver:
                driver.quit()
            return False

    def is_login_page(self, driver):
        """Check if the current page is a login page"""
        # Implement based on Maloum.com's specific elements
        # This is a placeholder - you'll need to adjust selectors
        try:
            login_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'Login') or contains(text(), 'Sign in') or contains(@*, 'login') or contains(@*, 'signin')]")
            return len(login_elements) > 0
        except:
            return False

    def reconnect_browser_session(self, account_id):
        """Reconnect to a browser session if it was disconnected"""
        if account_id in self.account_credentials:
            creds = self.account_credentials[account_id]
            return self.start_browser_session(account_id, creds['username'], creds['password'])
        return False
    
    def send_message(self, account_id, message):
        """Send a message from the model account"""
        if account_id in self.browsers:
            browser_info = self.browsers[account_id]
            driver = browser_info['driver']
            
            try:
                # Wait for the message input to be available
                message_input = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//textarea[contains(@class, 'message-input') or contains(@class, 'chat-input') or @id='message']"))  # Adjust selector as needed
                )
                
                # Clear and send the message
                driver.execute_script("arguments[0].value = arguments[1];", message_input, message)
                message_input.send_keys(u'\ue007')  # Send ENTER key
                
                return True
            except Exception as e:
                print(f"Error sending message for account {account_id}: {str(e)}")
                # Try to reconnect if there was an issue
                if not self.reconnect_browser_session(account_id):
                    return False
                return False
        else:
            # Try to reconnect if browser session doesn't exist
            if account_id in self.account_credentials:
                if self.reconnect_browser_session(account_id):
                    return self.send_message(account_id, message)
            return False
    
    def get_chat_history(self, account_id):
        """Retrieve chat history for an account (implementation will depend on site structure)"""
        if account_id in self.browsers:
            browser_info = self.browsers[account_id]
            driver = browser_info['driver']
            
            try:
                # This will need to be customized based on Maloum.com's structure
                chat_elements = driver.find_elements(By.XPATH, "//div[contains(@class, 'chat-message') or contains(@class, 'message')]")  # Adjust selector
                messages = []
                for element in chat_elements[-20:]:  # Get last 20 messages
                    messages.append({
                        'text': element.text,
                        'timestamp': time.time()
                    })
                return messages
            except Exception as e:
                print(f"Error getting chat history for account {account_id}: {str(e)}")
                return []
        return []
    
    def launch_browser_for_chatter(self, account_id):
        """Launch the browser profile for chatter to access directly"""
        if account_id in self.browsers:
            # Get the existing driver and show its window
            browser_info = self.browsers[account_id]
            driver = browser_info['driver']
            
            # Bring the browser window to focus
            driver.maximize_window()
            driver.switch_to.window(driver.current_window_handle)
            
            # Return the current URL
            return driver.current_url
        elif account_id in self.account_credentials:
            # Start a new session with the persistent profile
            creds = self.account_credentials[account_id]
            if self.start_browser_session(account_id, creds['username'], creds['password']):
                browser_info = self.browsers[account_id]
                driver = browser_info['driver']
                return driver.current_url
        return None
    
    def open_standalone_browser(self, account_id):
        """Open a standalone browser window that chatters can directly interact with"""
        if account_id in self.account_credentials:
            creds = self.account_credentials[account_id]
            user_data_dir = self.get_user_data_dir(account_id, creds['username'])
            
            # Launch Chrome with the specific user data directory
            import subprocess
            chrome_path = self.find_chrome_path()
            if chrome_path:
                # Launch Chrome with the profile and go to Maloum.com
                subprocess.Popen([
                    chrome_path,
                    f"--user-data-dir={user_data_dir}",
                    "--disable-web-security",  # May be needed for some extensions
                    "--disable-features=TranslateUI",
                    "https://www.maloum.com"
                ])
                return True
        return False
    
    def find_chrome_path(self):
        """Find the Chrome installation path"""
        import platform
        if platform.system() == "Windows":
            paths = [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe")
            ]
            for path in paths:
                if os.path.exists(path):
                    return path
        return None
    
    def quit_browser_session(self, account_id):
        """Quit a browser session for a model account"""
        if account_id in self.browsers:
            self.browsers[account_id]['driver'].quit()
            del self.browsers[account_id]
    
    def quit_all_sessions(self):
        """Quit all active browser sessions"""
        for account_id in list(self.browsers.keys()):
            self.quit_browser_session(account_id)

# Initialize the model account manager
model_manager = ModelAccountManager()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            log_activity(user.id, 'login', {'ip': request.remote_addr})
            app.logger.info(f'User {username} logged in successfully')
            return redirect(url_for('dashboard'))
        
        app.logger.warning(f'Failed login attempt for username: {username} from IP: {request.remote_addr}')
        return 'Invalid credentials'
    
    return render_template('login.html', form=form)

@app.route('/logout')
@login_required
def logout():
    log_activity(current_user.id, 'logout', {'ip': request.remote_addr})
    app.logger.info(f'User {current_user.username} logged out')
    logout_user()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.is_admin:
        # Admin sees all accounts and all users
        accounts = ModelAccount.query.all()
        users = User.query.all()
        log_activity(current_user.id, 'view_dashboard', {'role': 'admin', 'account_count': len(accounts)})
    else:
        # Chatter sees only assigned accounts
        accounts = ModelAccount.query.filter_by(assigned_chatter_id=current_user.id).all()
        users = []  # Non-admins don't see user management
        log_activity(current_user.id, 'view_dashboard', {'role': 'chatter', 'account_count': len(accounts)})
    
    app.logger.info(f'User {current_user.username} accessed dashboard')
    return render_template('dashboard.html', accounts=accounts, users=users)

@app.route('/api/messages/send', methods=['POST'])
@login_required
def send_message():
    data = request.get_json()
    account_id = data.get('account_id')
    message = data.get('message')
    
    # Check if user is authorized to send from this account
    account = ModelAccount.query.get(account_id)
    if not account or (not current_user.is_admin and account.assigned_chatter_id != current_user.id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    success = model_manager.send_message(account_id, message)
    if success:
        log_activity(current_user.id, 'send_message', {
            'account_id': account_id,
            'target_model': account.model_username,
            'message_preview': message[:50]  # First 50 chars only
        })
        app.logger.info(f'User {current_user.username} sent message to account {account.model_username}')
        return jsonify({'success': True})
    else:
        log_activity(current_user.id, 'send_message_failed', {
            'account_id': account_id,
            'target_model': account.model_username,
            'message_preview': message[:50]
        })
        app.logger.error(f'Failed to send message from user {current_user.username} to account {account.model_username}')
        return jsonify({'error': 'Failed to send message'}), 500

# Exempt this route from CSRF protection as it's an API endpoint
csrf.exempt(send_message)

@app.route('/api/chat/history/<int:account_id>')
@login_required
def get_chat_history(account_id):
    # Check if user is authorized to view this account
    account = ModelAccount.query.get(account_id)
    if not account or (not current_user.is_admin and account.assigned_chatter_id != current_user.id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    history = model_manager.get_chat_history(account_id)
    return jsonify({'history': history})

# Exempt this route from CSRF protection as it's an API endpoint
csrf.exempt(get_chat_history)

@app.route('/api/users/delete', methods=['POST'])
@login_required
def delete_user():
    if not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    user_id = data.get('user_id')
    
    # Don't allow deleting the current user
    if user_id == current_user.id:
        return jsonify({'error': 'Cannot delete yourself'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Remove any model account assignments to this user
    ModelAccount.query.filter_by(assigned_chatter_id=user_id).update({ModelAccount.assigned_chatter_id: None})
    
    # Delete the user
    db.session.delete(user)
    db.session.commit()
    
    log_activity(current_user.id, 'delete_user', {
        'deleted_user_id': user_id,
        'deleted_username': user.username
    })
    
    app.logger.info(f'Admin {current_user.username} deleted user {user.username}')
    return jsonify({'success': True})

# Exempt this route from CSRF protection as it's an API endpoint
csrf.exempt(delete_user)

@app.route('/test_login', methods=['POST'])
@login_required
def test_login():
    if not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        # Create a temporary browser instance to test login
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
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
            
            if driver:
                driver.quit()
            return jsonify({'success': True, 'message': 'Login successful!'})
        
        except Exception as e:
            error_msg = str(e)
            if driver:
                driver.quit()
            return jsonify({'success': False, 'message': f'Login failed: {error_msg}'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Request processing error: {str(e)}'})

# Exempt this route from CSRF protection as it's an API endpoint
csrf.exempt(test_login)

@app.route('/setup_accounts', methods=['GET', 'POST'])
@login_required
def setup_accounts():
    if not current_user.is_admin:
        log_activity(current_user.id, 'unauthorized_action', {
            'action': 'setup_accounts'
        })
        app.logger.warning(f'Non-admin user {current_user.username} tried to access setup_accounts')
        return 'Access denied', 403
        
    chatters = User.query.filter_by(is_admin=False).all()
    chatter_choices = [(0, '(Unassigned)')] + [(chatter.id, chatter.username) for chatter in chatters]
    
    form = SetupAccountForm()
    form.chatter_id.choices = chatter_choices
    
    if form.validate_on_submit():
        model_username = form.model_username.data  # This is the display name
        # Get the actual username from the form data (not part of WTForm)
        actual_username = request.form.get('actual_username')
        model_password = form.model_password.data
        chatter_id = form.chatter_id.data if form.chatter_id.data != 0 else None
        
        # Use the actual username for login, but store the display name
        login_username = actual_username if actual_username else model_username
        
        # Encrypt the password before storing
        encrypted_password = cipher_suite.encrypt(model_password.encode())
        
        new_account = ModelAccount(
            model_username=model_username,  # Display name is stored here
            actual_username=actual_username,  # Actual login username is stored here
            encrypted_password=encrypted_password,
            assigned_chatter_id=chatter_id
        )
        db.session.add(new_account)
        db.session.commit()
        
        # Start browser session for this account using the actual login credentials
        success = model_manager.start_browser_session(new_account.id, login_username, model_password)
        
        log_activity(current_user.id, 'setup_model_account', {
            'model_username': model_username,
            'actual_username': login_username,
            'assigned_chatter_id': chatter_id,
            'session_start_success': success
        })
        
        if success:
            app.logger.info(f'Admin {current_user.username} setup new model account: {model_username} (login: {login_username})')
        else:
            app.logger.error(f'Failed to start browser session for model account: {model_username}')
        
        return redirect(url_for('dashboard'))
    
    log_activity(current_user.id, 'view_setup_accounts', {})
    app.logger.info(f'Admin {current_user.username} accessed setup accounts page')
    
    return render_template('setup_accounts.html', form=form)

@app.route('/add_user', methods=['GET', 'POST'])
@login_required
def add_user():
    if not current_user.is_admin:
        log_activity(current_user.id, 'unauthorized_action', {
            'action': 'add_user'
        })
        app.logger.warning(f'Non-admin user {current_user.username} tried to access add_user')
        return 'Access denied', 403
        
    form = AddUserForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        is_admin = form.is_admin.data
        
        # Validate inputs
        if not validate_username(username):
            app.logger.warning(f'Admin {current_user.username} attempted to create user with invalid username: {username}')
            return 'Invalid username format', 400
        
        if not validate_password(password):
            app.logger.warning(f'Admin {current_user.username} attempted to create user with weak password')
            return 'Password must be at least 8 characters with uppercase, lowercase, and digit', 400
        
        # Sanitize inputs
        username = sanitize_input(username)
        
        # Check if user already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            app.logger.warning(f'Admin {current_user.username} tried to create duplicate user: {username}')
            return 'User already exists', 400
        
        hashed_password = generate_password_hash(password)
        new_user = User(username=username, password_hash=hashed_password, is_admin=is_admin)
        db.session.add(new_user)
        db.session.commit()
        
        log_activity(current_user.id, 'add_user', {
            'new_username': username,
            'new_user_admin': is_admin
        })
        app.logger.info(f'Admin {current_user.username} created new user: {username}')
        
        return redirect(url_for('dashboard'))
    
    log_activity(current_user.id, 'view_add_user', {})
    app.logger.info(f'Admin {current_user.username} accessed add user page')
    
    return render_template('add_user.html', form=form)

@app.route('/launch_account/<int:account_id>')
@login_required
def launch_account(account_id):
    # Check if user is authorized to access this account
    account = ModelAccount.query.get(account_id)
    if not account or (not current_user.is_admin and account.assigned_chatter_id != current_user.id):
        log_activity(current_user.id, 'unauthorized_action', {
            'action': 'launch_account',
            'account_id': account_id
        })
        app.logger.warning(f'User {current_user.username} tried to launch unauthorized account {account_id}')
        return 'Unauthorized', 403
    
    # Launch a standalone browser window with the saved profile for the chatter
    success = model_manager.open_standalone_browser(account_id)
    
    if success:
        log_activity(current_user.id, 'launch_account', {
            'account_id': account_id,
            'target_model': account.model_username
        })
        app.logger.info(f'User {current_user.username} launched account {account.model_username}')
        
        return f'''
        <html>
        <head>
            <title>Account Launched - {account.model_username}</title>
            <script>
                window.onload = function() {{
                    alert("Account {account.model_username} is now open in a separate Chrome window.\\n\\nSwitch to that window to interact directly with Maloum.com.\\n\\nYour extensions are available in this browser window.");
                    window.close();
                }};
            </script>
        </head>
        <body>
            <h2>Account {account.model_username} is now open</h2>
            <p>Please switch to the newly opened Chrome window to interact with Maloum.com directly.</p>
            <p>Your Chrome extensions (including Linguana Translator) are available in this window.</p>
            <p>If the window doesn't appear, check your taskbar for a new Chrome window.</p>
        </body>
        </html>
        '''
    else:
        # If we can't launch the standalone browser, try the alternative method
        encrypted_password = account.encrypted_password
        password = cipher_suite.decrypt(encrypted_password).decode()
        
        # Use the actual username if available, otherwise fall back to display name
        login_username = account.actual_username if account.actual_username else account.model_username
        success = model_manager.start_browser_session(account_id, login_username, password)
        if success:
            success = model_manager.open_standalone_browser(account_id)
            if success:
                log_activity(current_user.id, 'launch_account', {
                    'account_id': account_id,
                    'target_model': account.model_username
                })
                app.logger.info(f'User {current_user.username} launched account {account.model_username}')
                
                return f'''
                <html>
                <head>
                    <title>Account Launched - {account.model_username}</title>
                    <script>
                        window.onload = function() {{
                            alert("Account {account.model_username} is now open in a separate Chrome window.\\n\\nSwitch to that window to interact directly with Maloum.com.\\n\\nYour extensions are available in this browser window.");
                            window.close();
                        }};
                    </script>
                </head>
                <body>
                    <h2>Account {account.model_username} is now open</h2>
                    <p>Please switch to the newly opened Chrome window to interact with Maloum.com directly.</p>
                    <p>Your Chrome extensions (including Linguana Translator) are available in this window.</p>
                </body>
                </html>
                '''
        
        return f'Error launching account {account.model_username}. Please make sure Chrome is installed and accessible.', 500

# Exempt this route from CSRF protection as it's accessed via links/buttons
csrf.exempt(launch_account)

# Properly handle app cleanup
import atexit

def cleanup():
    """Clean up all browser sessions when app shuts down"""
    model_manager.quit_all_sessions()

atexit.register(cleanup)

def find_available_port(start_port=5000, max_attempts=10):
    """
    Find an available port starting from start_port
    """
    import socket
    
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    
    return None



if __name__ == '__main__':
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Note: If you're upgrading from an older version and get database errors,
        # you may need to delete the maloum_chatter.db file to recreate it with the new schema
        
        # Create a default admin user if none exists
        if not User.query.filter_by(is_admin=True).first():
            admin = User(
                username='admin',
                password_hash=generate_password_hash('admin123'),
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()
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