// popup.js - FIXED: API key validation to match your Firebase structure
let currentApiKey = '';
let isPasswordVisible = false;
let firebaseLicenseValidator = null;

// Enable debug mode
const DEBUG = true;

function debugLog(message) {
  if (DEBUG) {
    console.log('[Linguana Pro Together.xyz Firebase License Debug]', message);
  }
}

// FIXED: Ultra-persistent authentication cache - same as content script
// UPDATED: Ultra-persistent authentication cache with username support
class PopupUltraAuthCache {
  constructor() {
    this.storageKey = 'maloum_ultra_auth_v2';
    this.cache = null;
    this.loadFromAllStorages();
  }

  loadFromAllStorages() {
    try {
      // Try localStorage first (most persistent)
      let stored = localStorage.getItem(this.storageKey);
      
      // Fallback to sessionStorage
      if (!stored) {
        stored = sessionStorage.getItem(this.storageKey);
      }
      
      if (stored) {
        this.cache = JSON.parse(stored);
        debugLog('✅ Loaded ultra-persistent authentication cache in popup');
        this.saveToAllStorages();
        return;
      }

      // MIGRATION: Check old cache format
      const oldStored = localStorage.getItem('maloum_auth_cache');
      if (oldStored) {
        const oldCache = JSON.parse(oldStored);
        debugLog('🔄 Migrating from old cache format in popup');
        
        this.cache = {
          apiKeyHash: oldCache.apiKeyHash,
          isAuthenticated: oldCache.isAuthenticated,
          timestamp: oldCache.timestamp || Date.now(),
          validatedOnce: true,
          username: null, // NEW: Initialize username as null for migration
          version: 2
        };
        
        this.saveToAllStorages();
        localStorage.removeItem('maloum_auth_cache');
        debugLog('✅ Migration completed in popup');
        return;
      }

      debugLog('ℹ️ No existing authentication cache found in popup');
    } catch (error) {
      console.warn('⚠️ Failed to load auth cache in popup:', error);
      this.cache = null;
    }
  }

  saveToAllStorages() {
    try {
      if (this.cache) {
        const cacheString = JSON.stringify(this.cache);
        localStorage.setItem(this.storageKey, cacheString);
        sessionStorage.setItem(this.storageKey, cacheString);
        debugLog('✅ Saved ultra-persistent authentication cache in popup');
      }
    } catch (error) {
      console.warn('⚠️ Failed to save auth cache in popup:', error);
    }
  }

  generateApiKeyHash(apiKey) {
    if (!apiKey) return null;
    
    let hash = 0;
    const str = apiKey + 'maloum_salt_v2';
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  }

  // NEW: Save authentication with username
  setValidated(apiKey, username = null) {
    const hash = this.generateApiKeyHash(apiKey);
    this.cache = {
      apiKeyHash: hash,
      isAuthenticated: true,
      timestamp: Date.now(),
      validatedOnce: true,
      username: username, // NEW: Store username
      version: 2
    };
    this.saveToAllStorages();
    debugLog('✅ API key marked as validated in ultra-persistent cache with username');
  }

  // NEW: Get stored username
  getUsername() {
    return this.cache?.username || null;
  }

  // NEW: Update username only
  updateUsername(username) {
    if (this.cache) {
      this.cache.username = username;
      this.saveToAllStorages();
      debugLog('✅ Username updated in cache');
    }
  }

  isValidated(apiKey) {
    if (!this.cache || !apiKey) {
      debugLog('❌ No cache or API key provided in popup');
      return false;
    }
    
    const currentHash = this.generateApiKeyHash(apiKey);
    const isValid = this.cache.apiKeyHash === currentHash && 
                   this.cache.isAuthenticated && 
                   this.cache.validatedOnce;
    
    if (isValid) {
      debugLog('✅ API key is authenticated (ultra-persistent cache in popup) - NO Firebase call needed');
    } else {
      debugLog('❌ API key not authenticated in ultra-persistent cache in popup');
    }
    
    return isValid;
  }

  clearValidation() {
    this.cache = null;
    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.storageKey);
    debugLog('❌ Ultra-persistent authentication cache cleared in popup');
  }

  getStatus() {
    if (!this.cache) return 'No cache';
    
    return {
      hasHash: !!this.cache.apiKeyHash,
      isAuthenticated: this.cache.isAuthenticated,
      validatedOnce: this.cache.validatedOnce,
      username: this.cache.username, // NEW: Include username in status
      timestamp: new Date(this.cache.timestamp).toLocaleString(),
      version: this.cache.version
    };
  }
}

// FIXED: Create instance of ultra-persistent auth cache
const authCache = new PopupUltraAuthCache();

// FIXED: Firebase validation configuration - same as in firebase-license-validator.js
const firebaseConfig = {
  databaseURL: "https://authentication-4f34f-default-rtdb.asia-southeast1.firebasedatabase.app"
};

function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 8) return 'Invalid key';
  return '*'.repeat(apiKey.length - 6) + apiKey.slice(-6);
}

function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleBtn = document.getElementById('toggleVisibility');
  
  if (isPasswordVisible) {
    apiKeyInput.type = 'password';
    toggleBtn.innerHTML = '👁'; // Simple eye
    isPasswordVisible = false;
  } else {
    apiKeyInput.type = 'text';
    toggleBtn.innerHTML = '👁‍🗨'; // Eye with bubble
    isPasswordVisible = true;
  }
}

function showStatus(message, type, duration = 4000) {
  const statusDiv = document.getElementById('status');
  debugLog(`Status: ${message} (${type})`);
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  statusDiv.style.display = 'block';
  
  if (duration > 0) {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, duration);
  }
}

function updateApiKeyStatus(isValid, text) {
  const apiKeyStatus = document.getElementById('apiKeyStatusIndicator');
  const apiKeyStatusText = document.getElementById('apiKeyStatusText');
  const apiKeyInput = document.getElementById('apiKey');
  
  apiKeyStatus.className = 'status-indicator ' + (isValid === null ? 'unknown' : isValid ? 'valid' : 'invalid');
  apiKeyStatusText.textContent = text;
  apiKeyInput.className = isValid === null ? '' : isValid ? 'valid' : 'invalid';
  debugLog(`API key status updated: ${text} (${isValid})`);
}

function updateFirebaseStatus(isConnected, text) {
  const firebaseStatusDisplay = document.getElementById('firebaseStatus');
  
  if (firebaseStatusDisplay) {
    firebaseStatusDisplay.textContent = isConnected ? '✔ Connected' : '❌ Not Connected';
  }
}

function updateMainStatus() {
  const apiKeyStatusDisplay = document.getElementById('apiKeyStatus');
  
  if (apiKeyStatusDisplay) {
    apiKeyStatusDisplay.textContent = currentApiKey ? '✔ Licensed' : '❌ No Licensed Together.xyz API Key';
  }
}

function checkChromeRuntime() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    debugLog('Chrome runtime not available - extension context invalid');
    showStatus('Extension context not available. Please reload the extension.', 'error');
    return false;
  }
  debugLog('Chrome runtime is available');
  return true;
}

// FIXED: Local Firebase connection test
async function testFirebaseConnection() {
  try {
    debugLog('Testing Firebase connection locally...');
    
    const response = await fetch(`${firebaseConfig.databaseURL}/.json`);
    const isConnected = response.ok;
    
    updateFirebaseStatus(isConnected);
    debugLog(`Firebase connection test: ${isConnected ? 'SUCCESS' : 'FAILED'}`);
    return isConnected;
  } catch (error) {
    debugLog(`Firebase connection test failed: ${error.message}`);
    updateFirebaseStatus(false);
    return false;
  }
}

// FIXED: Simplified API key format validation - only basic checks before Firebase validation
function validateApiKeyFormat(apiKey) {
  if (!apiKey || apiKey.length < 10) {  // Minimum reasonable length
    return { valid: false, error: 'Together.xyz API key appears to be too short. Please check your key.' };
  }
  
  // Skip detailed format validation - rely on Firebase licensing validation instead
  return { valid: true, message: 'API key format appears valid, checking license...' };
}

// FIXED: Local Firebase validation to match your database structure
async function validateWithFirebase(apiKey) {
  try {
    debugLog('🔥 Validating API key with Firebase locally (ONE-TIME validation)...');
    
    // FIXED: Use the exact API key as stored (don't change case)
    const normalizedKey = apiKey.trim();
    
    debugLog(`🔥 Looking for key in Firebase: ${normalizedKey.substring(0, 10)}...`);
    
    // Firebase REST API call to check if key exists in whitelist
    const firebaseUrl = `${firebaseConfig.databaseURL}/whitelisted_apis/${normalizedKey}.json`;
    
    debugLog(`🔥 Firebase URL: ${firebaseUrl}`);
    
    const response = await fetch(firebaseUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Firebase API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    debugLog(`🔥 Firebase response:`, data);
    
    // FIXED: Check if data exists and has the right structure
    if (data !== null && typeof data === 'object') {
      debugLog(`🔥 Found data in Firebase:`, data);
      
      // FIXED: Check for active status if it exists, otherwise assume active
      const status = data.status || 'active';
      
      if (status === 'active') {
        // Update last access time
        await updateLastAccess(normalizedKey);
        
        debugLog('✅ Firebase validation successful - API key is licensed and active');
        return {
          success: true,
          license: normalizedKey,
          customer_name: data.customer_name || 'Licensed User',
          added_date: data.added_date || 'Unknown'
        };
      } else {
        debugLog(`❌ Firebase validation failed - License status: ${status}`);
        return {
          success: false,
          error: `License is ${status}. Please contact support.`
        };
      }
    } else {
      debugLog('❌ Firebase validation failed - API key not found in license database');
      debugLog('🔍 Exact Firebase response:', JSON.stringify(data));
      return {
        success: false,
        error: 'API key not found in license database. Please verify your licensed Together.xyz API key is properly registered.'
      };
    }
    
  } catch (error) {
    console.error('❌ Firebase validation error:', error);
    return {
      success: false,
      error: `License validation failed: ${error.message}`
    };
  }
}

// FIXED: Update last access in Firebase
async function updateLastAccess(licenseKey) {
  try {
    const updateUrl = `${firebaseConfig.databaseURL}/whitelisted_apis/${licenseKey}/last_access.json`;
    const response = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(new Date().toISOString())
    });
    
    if (response.ok) {
      debugLog(`📝 Updated last access for ${licenseKey}`);
    } else {
      console.warn('⚠️ Failed to update last access:', response.status);
    }
  } catch (error) {
    console.warn('⚠️ Failed to update last access:', error);
  }
}

// FIXED: Check ultra-persistent cache first, then validate if needed
async function validateApiKey(apiKey, showToast = true) {
  debugLog(`Validating API key format: ${apiKey ? apiKey.substring(0, 10) + '...' : 'empty'}`);
  
  if (!checkChromeRuntime()) return false;
  
  if (!apiKey || !apiKey.trim()) {
    updateApiKeyStatus(null, 'Not validated');
    debugLog('API key is empty');
    return false;
  }
  
  // Format validation
  const formatCheck = validateApiKeyFormat(apiKey);
  if (!formatCheck.valid) {
    updateApiKeyStatus(false, 'Invalid format');
    if (showToast) showStatus(formatCheck.error, 'error');
    return false;
  }
  
  // FIXED: Check ultra-persistent cache first - NO Firebase call
  const isAuthenticatedInCache = authCache.isValidated(apiKey);
  if (isAuthenticatedInCache) {
    updateApiKeyStatus(true, 'Authenticated (ultra-persistent cache)');
    if (showToast) showStatus('✅ API key authenticated from ultra-persistent cache! (NO Firebase call)', 'success');
    return true;
  }
    try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.url.includes('maloum.com')) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'authenticationUpdated',
            authenticated: true,
            apiKey: apiKey,
            username: username
          });
        } catch (e) {
          // Ignore errors for tabs without content scripts
        }
      }
    }
    debugLog('✅ Notified all content scripts about login');
  } catch (error) {
    debugLog('⚠️ Could not notify content scripts:', error);
  }
  // Not in cache, show format OK
  updateApiKeyStatus(true, 'Format valid (click Test to validate with Firebase once)');
  if (showToast) showStatus('Together.xyz API key format looks valid. Click "Test API" to validate with Firebase once.', 'info');
  
  return true;
}

// FIXED: API key testing with one-time Firebase validation and ultra-persistent cache update
async function testApiKeyWithLicenseCheck(apiKey, showToast = true) {
  debugLog(`Testing API key with one-time Firebase validation: ${apiKey ? apiKey.substring(0, 10) + '...' : 'empty'}`);
  
  if (!checkChromeRuntime()) return false;
  
  if (!apiKey || !apiKey.trim()) {
    updateApiKeyStatus(false, 'No API key provided');
    if (showToast) showStatus('Please enter your licensed Together.xyz API key first', 'error');
    return false;
  }
  
  const formatCheck = validateApiKeyFormat(apiKey);
  if (!formatCheck.valid) {
    updateApiKeyStatus(false, 'Invalid format');
    if (showToast) showStatus(formatCheck.error, 'error');
    return false;
  }

  // FIXED: Check ultra-persistent cache first - NO Firebase call
  const isAuthenticatedInCache = authCache.isValidated(apiKey);
  if (isAuthenticatedInCache) {
    debugLog('✅ Using ultra-persistent cache - API key already authenticated (NO Firebase call)');
    updateApiKeyStatus(true, 'Licensed & verified (ultra-persistent cache)');
    if (showToast) showStatus('✅ Licensed API key verified from ultra-persistent cache! (NO Firebase call)', 'success');
    return true;
  }
  
  try {
    updateApiKeyStatus(null, 'Checking license with Firebase (one-time)...');
    debugLog('🔥 Making ONE-TIME Firebase license check - not in ultra-persistent cache');
    
    // FIXED: Use local Firebase validation instead of background script
    const response = await validateWithFirebase(apiKey);
    
    if (response && response.success) {
      // FIXED: Store in ultra-persistent cache for future use - NO more Firebase calls
      authCache.setValidated(apiKey);
      
      updateApiKeyStatus(true, 'Licensed & verified');
      if (showToast) showStatus('✅ Licensed API key verified with Firebase and cached! (~5 characters used for test)', 'success');
      debugLog('🔥 Firebase validation successful - ultra-persistent cache updated - NO future Firebase calls needed');
      return true;
    } else {
      updateApiKeyStatus(false, 'License failed');
      
      const errorMessage = response?.error || 'Unknown error';
      
      if (errorMessage.includes('not licensed') || errorMessage.includes('license') || errorMessage.includes('not found')) {
        if (showToast) {
          showStatus('❌ This API key is not licensed for this extension. Please use a licensed Together.xyz API key.', 'error');
        }
      } else {
        if (showToast) {
          showStatus('License check failed: ' + errorMessage, 'error');
        }
      }
      return false;
    }
  } catch (error) {
    debugLog(`License check error: ${error.message}`);
    updateApiKeyStatus(false, 'License check failed');
    if (showToast) showStatus('License check error: ' + error.message, 'error');
    return false;
  }
}

// FIXED: Enhanced storage listener setup
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.togetherApiKey) {
      if (changes.togetherApiKey.newValue === undefined) {
        // API key was removed
        debugLog('🗑️ API key removed from storage externally');
        currentApiKey = '';
        authCache.clearValidation(); // Clear ultra-persistent cache
        updateApiKeyStatus(null, 'License removed');
        updateMainStatus();
        showStatus('API key license was revoked and removed from storage', 'info');
      } else {
        // API key was changed externally
        debugLog('🔄 API key changed externally');
        const newKey = changes.togetherApiKey.newValue;
        
        // Check if new key is authenticated in ultra-persistent cache
        const isAuthenticated = authCache.isValidated(newKey);
        if (isAuthenticated) {
          debugLog('✅ New API key is authenticated in ultra-persistent cache (NO Firebase call)');
          currentApiKey = newKey;
          updateApiKeyStatus(true, 'Licensed & Ready');
        } else {
          debugLog('❌ New API key not in ultra-persistent cache');
          currentApiKey = '';
          updateApiKeyStatus(null, 'Not validated');
        }
        updateMainStatus();
      }
    }
  });
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
  debugLog('Linguana Pro Together.xyz Firebase License Popup DOM loaded');
  
  if (!checkChromeRuntime()) {
    return;
  }
  
  // Test Firebase connection
  await testFirebaseConnection();
  
  // Setup storage listener for external changes
  setupStorageListener();
  
  const apiKeyInput = document.getElementById('apiKey');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const toggleVisibilityBtn = document.getElementById('toggleVisibility');
  
  // Set up toggle visibility button
  toggleVisibilityBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleApiKeyVisibility();
  });
  
  // Load saved API key
  try {
    debugLog('Loading saved API key from storage');
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Storage read timeout'));
      }, 5000);
      
      chrome.storage.sync.get(['togetherApiKey', 'username'], (result) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          debugLog(`Storage error: ${chrome.runtime.lastError.message}`);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          debugLog(`Loaded from storage: apiKey=${!!result.togetherApiKey}`);
          resolve(result);
        }
      });
    });
    
    if (result.togetherApiKey) {
      currentApiKey = result.togetherApiKey;
      updateApiKeyStatus(null, 'Loaded from storage');
      
      // FIXED: Check ultra-persistent cache for authentication status - NO Firebase call
      setTimeout(async () => {
        const isValidFormat = await validateApiKey(currentApiKey, false);
        if (isValidFormat) {
          const isAuthenticated = authCache.isValidated(currentApiKey);
          if (isAuthenticated) {
            updateApiKeyStatus(true, 'Licensed & Ready');
            chrome.runtime.sendMessage({
              action: 'updateBadge',
              status: 'success'
            });
            debugLog('✅ API key authenticated from ultra-persistent cache (NO Firebase call)');
          } else {
            updateApiKeyStatus(true, 'Format valid (click Test to validate with Firebase once)');
            chrome.runtime.sendMessage({
              action: 'updateBadge',
              status: 'warning'
            });
            debugLog('⚠️ API key not in ultra-persistent cache - Firebase validation needed');
          }
        }
      }, 500);
    } else {
      // No API key, clear badge
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        status: 'clear'
      });
    }
    
    updateMainStatus();
    // NEW: Load username into input field
const usernameInput = document.getElementById('username');
if (result.username && usernameInput) {
  usernameInput.value = result.username;
  debugLog(`✅ Loaded username into input field: ${result.username}`);
}
  } catch (error) {
    debugLog(`Error loading settings: ${error.message}`);
    showStatus('Error loading settings: ' + error.message, 'error');
  }
  
  // Input change handler
  apiKeyInput.addEventListener('input', function() {
    const newKey = apiKeyInput.value.trim();
    debugLog(`API key input changed: ${newKey ? newKey.substring(0, 10) + '...' : 'empty'}`);
    if (newKey !== currentApiKey) {
      updateApiKeyStatus(null, 'Not validated');
    }
  });

loginBtn.addEventListener('click', async function(e) {
  e.preventDefault();
  debugLog('Login button clicked');
  
  if (!checkChromeRuntime()) return;
  
  const apiKey = apiKeyInput.value.trim();
  const usernameInput = document.getElementById('username');
  const username = usernameInput ? usernameInput.value.trim() : null;
  
  debugLog(`Attempting to save API key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'empty'}`);
  debugLog(`Username: ${username || 'not provided'}`);
  
  if (!apiKey) {
    showStatus('Please enter your licensed Together.xyz API key', 'error');
    return;
  }

  if (usernameInput && !username) {
    showStatus('Please enter a username', 'error');
    usernameInput.focus();
    return;
  }
  
  // Do format validation first
  const formatCheck = validateApiKeyFormat(apiKey);
  if (!formatCheck.valid) {
    showStatus(formatCheck.error, 'error');
    return;
  }
  
  // Disable button during login
  loginBtn.disabled = true;
  const originalText = loginBtn.innerHTML;
  loginBtn.innerHTML = '<div class="loading"></div> Logging In...';
  
  try {
    debugLog('Starting login process - ALWAYS checking Firebase database');
    
    // REMOVED: Cache check - always validate with Firebase on login
    // Force Firebase validation on every login attempt
    debugLog('🔥 Login: Always validating with Firebase database (no cache bypass)');

    if (!checkChromeRuntime()) {
      throw new Error('Chrome runtime not available. Please check your internet connection.');
    }
    
    showStatus('Validating credentials with Firebase...', 'info', 2000);
    const response = await chrome.runtime.sendMessage({
      action: 'testApiKey',
      apiKey: apiKey
    });
    
    if (response && response.success) {
      debugLog('✅ API key validated successfully with Firebase');
      
      // Mark as validated with username (update cache after Firebase validation)
      authCache.setValidated(apiKey, username);
      
      // Save to storage
      const storageData = { togetherApiKey: apiKey };
      if (username) {
        storageData.username = username;
      }
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Storage save timeout'));
        }, 5000);
        
        chrome.storage.sync.set(storageData, () => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            debugLog(`Save error: ${chrome.runtime.lastError.message}`);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            debugLog('Logged in and validated successfully');
            resolve();
          }
        });
      });
      
      // Update state
      currentApiKey = apiKey;
      updateMainStatus();
      
      // Clear input fields
      apiKeyInput.value = '';
      if (usernameInput) usernameInput.value = '';
      
      if (isPasswordVisible) {
        toggleApiKeyVisibility();
      }
      
      updateApiKeyStatus(true, 'Logged In & Validated');
      
      loginBtn.className = 'btn success';
      loginBtn.innerHTML = '✓ Logged In';
      showStatus(`✅ Successfully logged in and validated${username ? ' as ' + username : ''}!`, 'success', 3000);
      
      // Notify content scripts about successful login
      try {
        const tabs = await chrome.tabs.query({});
        let notifiedCount = 0;
        for (const tab of tabs) {
          if (tab.url && tab.url.includes('maloum.com')) {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                action: 'authenticationUpdated',
                authenticated: true,
                apiKey: apiKey,
                username: username
              });
              notifiedCount++;
              debugLog(`✅ Notified tab ${tab.id} about login`);
            } catch (e) {
              debugLog(`⚠️ Could not notify tab ${tab.id}: ${e.message}`);
            }
          }
        }
        debugLog(`✅ Notified ${notifiedCount} content scripts about login (Firebase validation path)`);
      } catch (error) {
        debugLog('⚠️ Could not notify content scripts:', error);
      }
      
      setTimeout(() => {
        loginBtn.className = 'btn';
        loginBtn.innerHTML = originalText;
      }, 2000);
      
    } else {
      const errorMsg = response?.error || 'Unknown validation error';
      debugLog(`❌ Login failed: ${errorMsg}`);
      throw new Error(`Login failed: ${errorMsg}`);
    }
    
  } catch (error) {
    debugLog(`❌ Login error: ${error.message}`);
    showStatus(`❌ Login failed: ${error.message}`, 'error', 3000);
    
    loginBtn.className = 'btn error';
    loginBtn.innerHTML = '✗ Failed';
    
    setTimeout(() => {
      loginBtn.className = 'btn';
      loginBtn.innerHTML = originalText;
    }, 2000);
    
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async function(e) {
  e.preventDefault();
  
  if (!confirm('Are you sure you want to log out? You will need to enter your credentials again to use the extension.')) {
    return;
  }
  
  try {
    debugLog('Logging out user');
    
    // Clear ultra-persistent cache
    authCache.clearValidation();
    
    // Clear Chrome storage completely
    await new Promise((resolve, reject) => {
      chrome.storage.sync.clear(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    
    // Clear current state
    currentApiKey = '';
    
    // Clear input fields
    const usernameInput = document.getElementById('username');
    const apiKeyInput = document.getElementById('apiKey');
    
    if (usernameInput) usernameInput.value = '';
    if (apiKeyInput) apiKeyInput.value = '';
    
    // Reset password visibility
    if (isPasswordVisible) {
      toggleApiKeyVisibility();
    }
    
    // Update UI to logged out state
    updateApiKeyStatus(null, 'Logged Out');
    updateMainStatus();
    
    // Clear extension badge
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      status: 'clear'
    });
    
    showStatus('✅ Successfully logged out. Extension is now disabled.', 'success');
    debugLog('✅ User logged out - extension disabled');
    
  } catch (error) {
    debugLog(`❌ Logout error: ${error.message}`);
    showStatus(`❌ Logout failed: ${error.message}`, 'error');
  }
});
  
  debugLog('All event listeners set up, Linguana Pro Together.xyz Firebase License popup ready');
});