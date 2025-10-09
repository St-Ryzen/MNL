// licensed-content.js - FIXED: Content Script Authentication with Background Communication
class UnlicensedAccessHandler {
  static showApiKeyError() {
    if (sessionStorage.getItem('maloum-warnings-dismissed')) {
      return;
    }

    const existingError = document.getElementById('maloum-apikey-error');
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.id = 'maloum-apikey-error';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 10001;
      max-width: 320px;
      box-shadow: 0 8px 25px rgba(220, 38, 38, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      animation: slideIn 0.3s ease-out;
    `;
    
    errorDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <div style="font-size: 20px;">🤖</div>
        <div style="font-weight: 700; font-size: 16px;">AI API Key Required</div>
      </div>
      <div style="font-size: 13px; line-height: 1.4; margin-bottom: 12px; opacity: 0.9;">
        This extension requires a valid <strong>Together.xyz API key</strong> authenticated once with Firebase. 
        Please enter your API key in the extension popup to continue using AI translation features.
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : window.open(chrome.runtime.getURL('popup.html'))" 
                style="flex: 1; padding: 8px 12px; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">
          Open Settings
        </button>
        <button onclick="this.parentElement.parentElement.remove(); sessionStorage.setItem('maloum-warnings-dismissed', 'true');" 
                style="padding: 8px 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 6px; cursor: pointer; font-size: 12px;">
          Don't Show Again
        </button>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => errorDiv.remove(), 300);
      }
    }, 15000);
  }

  static disableExtensionFeatures() {
    
    const translateBtns = document.querySelectorAll('.maloum-translate-btn-msg, #maloum-translate-btn');
    translateBtns.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.3';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Together.xyz API key authentication required';
      
      const newBtn = btn.cloneNode(true);
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        UnlicensedAccessHandler.showApiKeyError();
      });
      btn.parentNode.replaceChild(newBtn, btn);
    });
    
    const emojiBtn = document.getElementById('maloum-emoji-btn');
    if (emojiBtn) {
      emojiBtn.disabled = true;
      emojiBtn.style.opacity = '0.3';
      emojiBtn.style.cursor = 'not-allowed';
      emojiBtn.title = 'API key authentication required';
    }
    
    const cacheBtn = document.getElementById('maloum-cache-btn');
    if (cacheBtn) {
      cacheBtn.disabled = true;
      cacheBtn.style.opacity = '0.3';
      cacheBtn.style.cursor = 'not-allowed';
      cacheBtn.title = 'API key authentication required';
    }
    
    const translateContainer = document.getElementById('maloum-translate-container');
    if (translateContainer) {
      const watermark = document.createElement('div');
      watermark.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(220, 38, 38, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #dc2626;
        font-weight: 600;
        pointer-events: none;
        border-radius: 6px;
        z-index: 10;
      `;
      watermark.textContent = '🤖 AI API KEY REQUIRED';
      translateContainer.style.position = 'relative';
      translateContainer.appendChild(watermark);
    }
  }
}

// FIXED: Ultra-Persistent Authentication Cache with Background Communication Support
class UltraPersistentAuthCache {
  constructor() {
    this.storageKey = 'maloum_ultra_auth_v2';
    this.cache = null;
    this.loadFromAllStorages();
  }

  // FIXED: Load from multiple storage layers with migration
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
        
        // Ensure it's saved in both storages
        this.saveToAllStorages();
        return;
      }

      // MIGRATION: Check old cache format
      const oldStored = localStorage.getItem('maloum_auth_cache');
      if (oldStored) {
        const oldCache = JSON.parse(oldStored);
        
        // Convert to new format
        this.cache = {
          apiKeyHash: oldCache.apiKeyHash,
          isAuthenticated: oldCache.isAuthenticated,
          timestamp: oldCache.timestamp || Date.now(),
          validatedOnce: true, // Mark as already validated with Firebase
          version: 2
        };
        
        this.saveToAllStorages();
        localStorage.removeItem('maloum_auth_cache'); // Clean up old format
        return;
      }

    } catch (error) {
      console.warn('⚠️ Failed to load auth cache:', error);
      this.cache = null;
    }
  }

  // FIXED: Save to multiple storage layers for maximum persistence
  saveToAllStorages() {
    try {
      if (this.cache) {
        const cacheString = JSON.stringify(this.cache);
        
        // Save to localStorage (primary)
        localStorage.setItem(this.storageKey, cacheString);
        
        // Save to sessionStorage (backup)
        sessionStorage.setItem(this.storageKey, cacheString);
        
      }
    } catch (error) {
      console.warn('⚠️ Failed to save auth cache:', error);
    }
  }

  generateApiKeyHash(apiKey) {
    if (!apiKey) return null;
    
    // Enhanced hash function for better uniqueness
    let hash = 0;
    const str = apiKey + 'maloum_salt_v2'; // Add salt for security
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Return absolute value as string
    return Math.abs(hash).toString();
  }

  // FIXED: Check if API key is validated (NO Firebase call)
  isValidated(apiKey) {
    if (!this.cache || !apiKey) {
      return false;
    }
    
    const currentHash = this.generateApiKeyHash(apiKey);
    const isValid = this.cache.apiKeyHash === currentHash && 
                   this.cache.isAuthenticated && 
                   this.cache.validatedOnce; // Must have been validated once
    
    if (isValid) {
    } else {
    }
    
    return isValid;
  }

  // FIXED: Mark API key as validated (ONLY called after Firebase validation)
  setValidated(apiKey) {
    const hash = this.generateApiKeyHash(apiKey);
    this.cache = {
      apiKeyHash: hash,
      isAuthenticated: true,
      timestamp: Date.now(),
      validatedOnce: true, // This prevents future Firebase calls
      version: 2
    };
    this.saveToAllStorages();
  }

  // FIXED: Clear authentication (force re-validation)
  clearValidation() {
    this.cache = null;
    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.storageKey);
  }

  // Get cache status for debugging
  getStatus() {
    if (!this.cache) return 'No cache';
    
    return {
      hasHash: !!this.cache.apiKeyHash,
      isAuthenticated: this.cache.isAuthenticated,
      validatedOnce: this.cache.validatedOnce,
      timestamp: new Date(this.cache.timestamp).toLocaleString(),
      version: this.cache.version
    };
  }
}

// FIXED: Firebase API Key Handler with Background Communication
class FirebaseApiKeyHandler {
  constructor() {
    this.isAuthenticated = false;
    this.authChecked = false;
    this.originalHandler = null;
    
    // FIXED: Use ultra-persistent cache that NEVER calls Firebase again
    this.authCache = new UltraPersistentAuthCache();

    
    // FIXED: Listen for authentication updates from popup
    this.setupMessageListener();
    
    this.init();
  }

  // FIXED: Setup message listener for popup communication
// Make sure this exists in the FirebaseApiKeyHandler constructor or setupMessageListener method:

setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'authenticationUpdated') {
      console.log('🔄 Received authentication update from popup:', message);
      
      if (message.authenticated && message.apiKey) {
        // Update ultra-persistent cache
        this.authCache.setValidated(message.apiKey, message.username);
        this.isAuthenticated = true;
        
        console.log('✅ Updated authentication state, reinitializing features...');
        
        // Reinitialize features immediately
        this.initializeAuthenticatedFeatures().then(() => {
          console.log('✅ Extension features reactivated after login');
          
          // Show success message to user
          this.showAuthenticatedMessage();
          
          sendResponse({ success: true });
        }).catch(error => {
          console.error('❌ Failed to reinitialize features:', error);
          sendResponse({ success: false, error: error.message });
        });
        
        return true; // Keep message channel open for async response
        
      } else if (!message.authenticated) {
        // Handle logout
        console.log('🔄 Processing logout from popup');
        this.isAuthenticated = false;
        this.authCache.clearValidation();
        this.handleUnauthenticatedAccess();
        console.log('✅ Extension disabled after logout');
        
        sendResponse({ success: true });
      }
    }
  });
}

  async init() {
    try {
      
      // FIXED: Check authentication using background communication
      await this.checkUltraPersistentAuth();
      
      if (this.isAuthenticated) {
        await this.initializeAuthenticatedFeatures();
      } else {
        this.handleUnauthenticatedAccess();
      }
      
      // FIXED: Only listen to storage changes for API key updates
      this.setupStorageListener();
      
    } catch (error) {
      console.error('❌ Firebase API key handler initialization failed:', error);
      this.handleUnauthenticatedAccess();
    }
  }

  // FIXED: Check ultra-persistent authentication with background communication
  async checkUltraPersistentAuth() {
    try {
      
      // Get stored API key
      const storage = await new Promise((resolve, reject) => {
        if (!chrome?.storage?.sync) {
          reject(new Error('Chrome storage not available'));
          return;
        }
        
        chrome.storage.sync.get(['togetherApiKey'], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });
      
      if (!storage.togetherApiKey) {
        this.isAuthenticated = false;
        this.authChecked = true;
        this.authCache.clearValidation();
        return false;
      }

      // CRITICAL FIX: Instead of checking Firebase directly, ask the background script
      // Background script has better access to Firebase authentication
      const authResult = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'checkAuthentication',
          apiKey: storage.togetherApiKey
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Background script not available, using cache fallback');
            resolve({ authenticated: false, fallback: true });
          } else {
            resolve(response || { authenticated: false });
          }
        });
      });

      // If background script confirms authentication OR we have cached validation
      const isValidInCache = this.authCache.isValidated(storage.togetherApiKey);
      
      if (authResult.authenticated || isValidInCache) {
        
        // Update cache if background script confirmed
        if (authResult.authenticated && !isValidInCache) {
          this.authCache.setValidated(storage.togetherApiKey);
        }
        
        this.isAuthenticated = true;
        this.authChecked = true;
        return true;
      } else if (authResult.fallback && isValidInCache) {
        // Background not available but cache says it's valid
        this.isAuthenticated = true;
        this.authChecked = true;
        return true;
      } else {
        this.isAuthenticated = false;
        this.authChecked = true;
        return false;
      }
      
    } catch (error) {
      console.error('❌ Ultra-persistent auth check failed:', error);
      
      // FALLBACK: If everything fails, just check if API key exists and we have cache
      try {
        const storage = await new Promise((resolve) => {
          chrome.storage.sync.get(['togetherApiKey'], resolve);
        });
        
        if (storage.togetherApiKey) {
          const isValidInCache = this.authCache.isValidated(storage.togetherApiKey);
          if (isValidInCache) {
            this.isAuthenticated = true;
            this.authChecked = true;
            return true;
          } else {
          }
        }
      } catch (fallbackError) {
        console.error('❌ Fallback auth check also failed:', fallbackError);
      }
      
      this.isAuthenticated = false;
      this.authChecked = true;
      this.authCache.clearValidation();
      return false;
    }
  }

  async initializeAuthenticatedFeatures() {
    
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      // FIXED: Wait for the optimized message handler with longer timeout and better error handling
      let attempts = 0;
      const maxAttempts = 50; // Increased from 30 to 50
      
      while (!window.optimizedMessageHandler && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        
        if (attempts % 10 === 0) {
        }
      }
      
      if (window.optimizedMessageHandler) {
        this.originalHandler = window.optimizedMessageHandler;
        
        // FIXED: Try to enhance translation methods with better retry logic
        this.setupTranslationEnhancement();
      } else {
        console.warn('⚠️ Optimized message handler not found after waiting, will work without override');
        // Don't fail completely, just proceed without enhancement
      }
      
      // Add authenticated status indicator (this should work regardless)
      this.addApiKeyStatusIndicator();
      
      
    } catch (error) {
      console.error('❌ Error initializing authenticated features:', error);
      // Don't call handleUnauthenticatedAccess here as it might create a loop
    }
  }

  // FIXED: New method to handle translation enhancement with better retry logic
  setupTranslationEnhancement() {
    const attemptEnhancement = () => {
      try {
        const success = this.enhanceTranslationMethods();
        if (success) {
          return true;
        } else {
          return false;
        }
      } catch (error) {
        console.error('❌ Error during translation enhancement:', error);
        return false;
      }
    };

    // Try immediately
    if (attemptEnhancement()) {
      return;
    }

    // Set up retry with increasing delays
    const retryDelays = [1000, 2000, 5000, 10000];
    retryDelays.forEach((delay, index) => {
      setTimeout(() => {
        if (attemptEnhancement()) {
        } else if (index === retryDelays.length - 1) {
        }
      }, delay);
    });
  }

  // FIXED: Enhanced translation methods with ultra-persistent cache and comprehensive error handling
  enhanceTranslationMethods() {
    try {
      // FIXED: Comprehensive checking with detailed logging
      if (!this.originalHandler) {
        return false;
      }
      
      if (!this.originalHandler.translator) {
        return false;
      }
      
      if (typeof this.originalHandler.translator.translate !== 'function') {
        return false;
      }

      // FIXED: Check if already enhanced to avoid double enhancement
      if (this.originalHandler.translator.translate._enhanced) {
        return true;
      }
      
      
      // Store original translate method with proper binding
      const originalTranslate = this.originalHandler.translator.translate.bind(this.originalHandler.translator);
      
      // FIXED: Enhanced translate method with background communication
      const enhancedTranslate = async (text, targetLang, sourceLang, messageType) => {
        try {
          // FIXED: Quick authentication check using ultra-persistent cache and background
          const storage = await new Promise((resolve) => {
            chrome.storage.sync.get(['togetherApiKey'], resolve);
          });
          
          if (!storage.togetherApiKey) {
            throw new Error('No API key found in storage');
          }
          
          // FIXED: Use ultra-persistent cache first, then background fallback
          const isAuthenticated = this.authCache.isValidated(storage.togetherApiKey);
          
          if (!isAuthenticated) {
            // Try background verification as fallback
            const bgResult = await new Promise((resolve) => {
              chrome.runtime.sendMessage({
                action: 'checkAuthentication',
                apiKey: storage.togetherApiKey
              }, (response) => {
                resolve(response?.authenticated || false);
              });
            });
            
            if (!bgResult) {
              throw new Error('Valid Together.xyz API key authentication required for translation');
            } else {
              // Update cache with background confirmation
              this.authCache.setValidated(storage.togetherApiKey);
            }
          }
          
          
          // FIXED: Proceed with translation - cache will be checked first in translator
          return await originalTranslate(text, targetLang, sourceLang, messageType);
          
        } catch (error) {
          console.error('❌ Enhanced translation failed:', error);
          
          if (error.message.includes('authentication') || error.message.includes('API key')) {
            UnlicensedAccessHandler.showApiKeyError();
            return {
              success: false,
              error: 'API key authentication required',
              fromCache: false
            };
          }
          
          throw error;
        }
      };

      // Mark as enhanced to prevent double enhancement
      enhancedTranslate._enhanced = true;
      
      // Replace the original method
      this.originalHandler.translator.translate = enhancedTranslate;
      
      return true;
      
    } catch (error) {
      console.error('❌ Error enhancing translation methods:', error);
      return false;
    }
  }

  addApiKeyStatusIndicator() {
    // Disabled - no visual indicator needed
    return true;
  }

  handleUnauthenticatedAccess() {
    
    const hasShownThisSession = sessionStorage.getItem('maloum-popup-shown');
    const hasUserDismissed = sessionStorage.getItem('maloum-warnings-dismissed');
    
    if (hasUserDismissed) {
      setTimeout(() => {
        UnlicensedAccessHandler.disableExtensionFeatures();
      }, 1000);
      return;
    }
    
    if (!hasShownThisSession) {
      sessionStorage.setItem('maloum-popup-shown', 'true');
      
      setTimeout(() => {
        this.showApiKeySetupInfo();
      }, 2000);
    } else {
    }
    
    setTimeout(() => {
      UnlicensedAccessHandler.disableExtensionFeatures();
    }, 1000);
  }

  showApiKeySetupInfo() {
    if (sessionStorage.getItem('maloum-warnings-dismissed')) {
      return;
    }

    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      max-width: 280px;
      box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      animation: slideIn 0.3s ease-out;
    `;
    
    infoDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
        <div style="font-size: 18px;">🔥</div>
        <div style="font-weight: 700; font-size: 15px;">One-Time Firebase Setup</div>
      </div>
      <div style="font-size: 12px; line-height: 1.4; margin-bottom: 12px; opacity: 0.9;">
        Get your <strong>Together.xyz API key</strong> and validate it once with Firebase. 
        After that, <strong>ZERO Firebase calls</strong> forever!
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : window.open(chrome.runtime.getURL('popup.html')); this.parentElement.parentElement.remove();" 
                style="flex: 1; padding: 8px 12px; background: rgba(255, 255, 255, 0.9); border: none; color: #1d4ed8; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
          Setup API Key (One-Time)
        </button>
        <button onclick="this.parentElement.parentElement.remove(); sessionStorage.setItem('maloum-warnings-dismissed', 'true');" 
                style="padding: 8px 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 6px; cursor: pointer; font-size: 12px;">
          ✕
        </button>
      </div>
    `;
    
    document.body.appendChild(infoDiv);
    
    setTimeout(() => {
      if (infoDiv.parentNode) {
        infoDiv.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => infoDiv.remove(), 300);
      }
    }, 10000);
  }

  // FIXED: Listen only to storage changes for API key updates
  setupStorageListener() {
    
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.togetherApiKey) {
        
        if (changes.togetherApiKey.newValue === undefined) {
          // API key was removed
          this.isAuthenticated = false;
          this.authCache.clearValidation();
          this.showAuthenticationLostMessage();
          UnlicensedAccessHandler.disableExtensionFeatures();
        } else {
          // API key was changed - check if it's authenticated in ultra-persistent cache
          const newKey = changes.togetherApiKey.newValue;
          const isAuthenticated = this.authCache.isValidated(newKey);
          
          if (isAuthenticated) {
            this.isAuthenticated = true;
            this.showAuthenticatedMessage();
          } else {
            this.isAuthenticated = false;
            this.authCache.clearValidation();
          }
        }
      }
    });
    
  }

showAuthenticatedMessage() {
  // Remove any existing authentication messages
  const existingMessages = document.querySelectorAll('#maloum-auth-success, #maloum-apikey-error');
  existingMessages.forEach(msg => msg.remove());
  
  // Show brief success message
  const successDiv = document.createElement('div');
  successDiv.id = 'maloum-auth-success';
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    z-index: 10001;
    max-width: 320px;
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    animation: slideIn 0.3s ease-out;
  `;
  
  successDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-size: 20px;">✅</div>
      <div style="font-weight: 700; font-size: 16px;">Extension Activated</div>
    </div>
    <div style="font-size: 13px; line-height: 1.4; margin-top: 8px; opacity: 0.9;">
      You can now use all translation features!
    </div>
  `;
  
  document.body.appendChild(successDiv);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (successDiv.parentNode) {
      successDiv.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => successDiv.remove(), 300);
    }
  }, 3000);
}

  showAuthenticationLostMessage() {
    const expiredDiv = document.createElement('div');
    expiredDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 10002;
      max-width: 300px;
      box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3);
      animation: slideIn 0.3s ease-out;
    `;
    
    expiredDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <div style="font-size: 20px;">⚠️</div>
        <div style="font-weight: 700;">Authentication Lost</div>
      </div>
      <div style="font-size: 12px; opacity: 0.9;">
        Your Together.xyz API key authentication has been lost. Please re-authenticate your API key.
      </div>
    `;
    
    document.body.appendChild(expiredDiv);
    
    setTimeout(() => {
      if (expiredDiv.parentNode) expiredDiv.remove();
    }, 5000);
  }

  destroy() {
    if (this.originalHandler && this.originalHandler.destroy) {
      this.originalHandler.destroy();
    }
  }
}

// FIXED: Initialize with background communication support
let firebaseApiKeyHandler = null;

function initializeFirebaseApiKeyHandler() {
  try {
    
    if (!window.location.hostname.includes('maloum.com')) {
      return;
    }
    
    if (firebaseApiKeyHandler) {
      firebaseApiKeyHandler.destroy();
    }
    
    firebaseApiKeyHandler = new FirebaseApiKeyHandler();
    window.firebaseApiKeyHandler = firebaseApiKeyHandler;
    
  } catch (error) {
    console.error('❌ Failed to initialize FIXED Firebase API Key Handler:', error);
  }
}

// FIXED: Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirebaseApiKeyHandler);
} else {
  initializeFirebaseApiKeyHandler();
}

// Fallback initialization
setTimeout(() => {
  if (!firebaseApiKeyHandler) {
    initializeFirebaseApiKeyHandler();
  }
}, 3000);

// FIXED: Handle page navigation without breaking authentication
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    
    // FIXED: Don't reinitialize immediately, just verify auth state
    setTimeout(() => {
      if (firebaseApiKeyHandler && firebaseApiKeyHandler.isAuthenticated) {
        // Authentication is maintained, just add indicator if needed
        firebaseApiKeyHandler.addApiKeyStatusIndicator();
      } else {
        initializeFirebaseApiKeyHandler();
      }
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (firebaseApiKeyHandler) {
    firebaseApiKeyHandler.destroy();
  }
});

// FIXED: Enhanced debug functions with background communication info
window.debugFirebaseApiKeyHandler = {
  checkAuth: async () => {
    if (firebaseApiKeyHandler) {
      const status = await firebaseApiKeyHandler.checkUltraPersistentAuth();
      return status;
    }
    return false;
  },
  showApiKeyError: () => UnlicensedAccessHandler.showApiKeyError(),
  showSetupInfo: () => firebaseApiKeyHandler?.showApiKeySetupInfo(),
  disableFeatures: () => UnlicensedAccessHandler.disableExtensionFeatures(),
  restart: initializeFirebaseApiKeyHandler,
  getInstance: () => firebaseApiKeyHandler,
  getStatus: () => {
    if (!firebaseApiKeyHandler) return null;
    return {
      isAuthenticated: firebaseApiKeyHandler.isAuthenticated,
      authChecked: firebaseApiKeyHandler.authChecked,
      hasOriginalHandler: !!firebaseApiKeyHandler.originalHandler,
      ultraPersistentCacheStatus: firebaseApiKeyHandler.authCache ? firebaseApiKeyHandler.authCache.getStatus() : 'No cache',
      mode: 'Background Communication + Ultra-Persistent Cache',
      sessionWarnings: {
        popupShown: !!sessionStorage.getItem('maloum-popup-shown'),
        dismissed: !!sessionStorage.getItem('maloum-warnings-dismissed')
      }
    };
  },
  clearAuthCache: () => {
    if (firebaseApiKeyHandler && firebaseApiKeyHandler.authCache) {
      firebaseApiKeyHandler.authCache.clearValidation();
    }
  },
  resetSessionWarnings: () => {
    sessionStorage.removeItem('maloum-popup-shown');
    sessionStorage.removeItem('maloum-warnings-dismissed');
  },
  dismissWarnings: () => {
    sessionStorage.setItem('maloum-warnings-dismissed', 'true');
  },
  // FIXED: Test background communication
  testBackgroundCommunication: async () => {
    
    try {
      const storage = await new Promise((resolve) => {
        chrome.storage.sync.get(['togetherApiKey'], resolve);
      });
      
      if (!storage.togetherApiKey) {
        return false;
      }
      
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'checkAuthentication',
          apiKey: storage.togetherApiKey
        }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ authenticated: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { authenticated: false });
          }
        });
      });
      
      return result;
    } catch (error) {
      console.error('❌ Background communication test failed:', error);
      return { authenticated: false, error: error.message };
    }
  },
  // FIXED: New method to manually mark API key as authenticated (for testing)
  markApiKeyAuthenticated: async () => {
    if (firebaseApiKeyHandler && firebaseApiKeyHandler.authCache) {
      const storage = await new Promise((resolve) => {
        chrome.storage.sync.get(['togetherApiKey'], resolve);
      });
      
      if (storage.togetherApiKey) {
        firebaseApiKeyHandler.authCache.setValidated(storage.togetherApiKey);
        firebaseApiKeyHandler.isAuthenticated = true;
        
        // Reinitialize features
        await firebaseApiKeyHandler.initializeAuthenticatedFeatures();
        
        return true;
      }
    }
    return false;
  },
  
  // Get detailed cache information
  getCacheDetails: () => {
    if (firebaseApiKeyHandler && firebaseApiKeyHandler.authCache) {
      const status = firebaseApiKeyHandler.authCache.getStatus();
      return status;
    }
    return null;
  }
};

