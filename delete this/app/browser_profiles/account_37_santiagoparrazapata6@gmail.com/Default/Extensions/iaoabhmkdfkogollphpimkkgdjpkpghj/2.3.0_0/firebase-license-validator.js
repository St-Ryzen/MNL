// firebase-license-validator.js - Local Firebase License Validation System (No External CDN) - NO PERIODIC CALLS
class FirebaseLicenseValidator {
  constructor() {
    console.log('🔥 Firebase License Validator initializing (Local Implementation - Event-driven only)...');
    
    // Firebase configuration from your project
    this.firebaseConfig = {
      apiKey: "AIzaSyB3Hf5z9Ek4p8Io8BPsTMdUDJpmfV6ZA5w",
      authDomain: "authentication-4f34f.firebaseapp.com",
      databaseURL: "https://authentication-4f34f-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "authentication-4f34f",
      storageBucket: "authentication-4f34f.firebasestorage.app",
      messagingSenderId: "12296892140",
      appId: "1:12296892140:web:80125137f3daeab1c2bfc9",
      measurementId: "G-2286H3K52L"
    };
    
    this.isInitialized = false;
    this.initPromise = null;
    
    // Configuration from your database structure
    this.config = {
      version: 1
    };
    
    // Start initialization
    this.initPromise = this.initializeFirebase();
  }

  // Initialize Firebase using REST API (no external CDN needed)
  async initializeFirebase() {
    try {
      console.log('🔥 Initializing Firebase REST API...');
      
      // Test connection to Firebase
      await this.testConnection();
      
      // Load configuration from Firebase
      await this.loadConfig();
      
      this.isInitialized = true;
      console.log('✅ Firebase REST API initialized successfully (Event-driven only)');
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // Test Firebase connection
  async testConnection() {
    try {
      const response = await fetch(`${this.firebaseConfig.databaseURL}/.json`);
      if (!response.ok) {
        throw new Error(`Firebase connection failed: ${response.status}`);
      }
      console.log('✅ Firebase connection test successful');
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      throw error;
    }
  }

  // Load configuration from Firebase using REST API
  async loadConfig() {
    try {
      console.log('📋 Loading configuration from Firebase...');
      
      const response = await fetch(`${this.firebaseConfig.databaseURL}/config.json`);
      
      if (response.ok) {
        const firebaseConfig = await response.json();
        if (firebaseConfig) {
          this.config = {
            version: firebaseConfig.version || 1
          };
          console.log('✅ Configuration loaded from Firebase:', this.config);
        }
      } else {
        console.log('ℹ️ No configuration found in Firebase, using defaults');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load configuration from Firebase:', error);
    }
  }

  // Ensure Firebase is initialized
  async ensureInitialized() {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.isInitialized) {
      throw new Error('Firebase not properly initialized');
    }
  }

  // Validate license key against Firebase using REST API
  async validateLicense(licenseKey) {
    try {
      console.log(`🔐 Validating license with Firebase REST API: ${licenseKey ? licenseKey.substring(0, 15) + '...' : 'empty'}`);
      
      await this.ensureInitialized();
      
      if (!licenseKey || typeof licenseKey !== 'string') {
        return { valid: false, error: 'Invalid license format' };
      }

      // Normalize license key
      const normalizedKey = licenseKey.trim().toUpperCase();
      
      // Check format (LINGUANA-PRO-YYYY-XXXXXX)
      const formatRegex = /^LINGUANA-PRO-\d{4}-[A-Z0-9]{6}$/;
      if (!formatRegex.test(normalizedKey)) {
        return { valid: false, error: 'Invalid license key format. Use: LINGUANA-PRO-2024-XXXXXX' };
      }

      // Query Firebase using REST API
      const apiUrl = `${this.firebaseConfig.databaseURL}/whitelisted_apis/${normalizedKey}.json`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Firebase API error: ${response.status}`);
      }
      
      const licenseData = await response.json();
      
      if (licenseData && typeof licenseData === 'object') {
        console.log('📋 License data from Firebase:', licenseData);
        
        // Check if license is active
        if (licenseData.status === 'active') {
          console.log('✅ Valid license found in Firebase');
          
          // Update last access time
          await this.updateLastAccess(normalizedKey);
          
          // Check if trial license is expired
          if (licenseData.trial && licenseData.expires) {
            const isExpired = await this.isLicenseExpired(normalizedKey);
            if (isExpired) {
              return {
                valid: false,
                error: 'Trial license has expired. Please purchase a full license.'
              };
            }
          }
          
          return {
            valid: true,
            license: normalizedKey,
            customer_name: licenseData.customer_name || 'Unknown',
            added_date: licenseData.added_date || 'Unknown',
            last_access: new Date().toISOString(),
            trial: licenseData.trial || false,
            expires: licenseData.expires || null
          };
        } else {
          console.log('❌ License found but not active:', licenseData.status);
          return { 
            valid: false, 
            error: `License is ${licenseData.status}. Please contact support.` 
          };
        }
      } else {
        console.log('❌ License not found in Firebase database');
        return { 
          valid: false, 
          error: 'License key not found. Please check your key or contact support.' 
        };
      }
    } catch (error) {
      console.error('❌ License validation error:', error);
      return {
        valid: false,
        error: `Validation failed: ${error.message}`
      };
    }
  }

  // Update last access time for a license using REST API
  async updateLastAccess(licenseKey) {
    try {
      const updateUrl = `${this.firebaseConfig.databaseURL}/whitelisted_apis/${licenseKey}/last_access.json`;
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(new Date().toISOString())
      });
      
      if (response.ok) {
        console.log(`📝 Updated last access for ${licenseKey}`);
      } else {
        console.warn('⚠️ Failed to update last access:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Failed to update last access:', error);
    }
  }

  // Generate a trial license using REST API
  async generateTrialLicense() {
    try {
      await this.ensureInitialized();
      
      const timestamp = Date.now().toString().slice(-6);
      const trialKey = `LINGUANA-PRO-2024-T${timestamp}`;
      
      // Add trial license to Firebase
      const trialData = {
        customer_name: 'Trial User',
        status: 'active',
        added_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        last_access: new Date().toISOString(),
        trial: true,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };
      
      const trialUrl = `${this.firebaseConfig.databaseURL}/whitelisted_apis/${trialKey}.json`;
      const response = await fetch(trialUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(trialData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create trial license: ${response.status}`);
      }
      
      console.log('🔑 Trial license generated and saved to Firebase:', trialKey);
      return trialKey;
    } catch (error) {
      console.error('❌ Trial license generation failed:', error);
      throw error;
    }
  }

  // Check if license is expired (for trial licenses)
  async isLicenseExpired(licenseKey) {
    try {
      await this.ensureInitialized();
      
      const apiUrl = `${this.firebaseConfig.databaseURL}/whitelisted_apis/${licenseKey}.json`;
      const response = await fetch(apiUrl);
      
      if (response.ok) {
        const licenseData = await response.json();
        
        if (licenseData && licenseData.trial && licenseData.expires) {
          const expiryDate = new Date(licenseData.expires);
          const now = new Date();
          
          if (now > expiryDate) {
            console.log('⏰ Trial license has expired');
            
            // Update status to expired in Firebase
            const statusUrl = `${this.firebaseConfig.databaseURL}/whitelisted_apis/${licenseKey}/status.json`;
            await fetch(statusUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify('expired')
            });
            
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.warn('⚠️ Error checking license expiry:', error);
      return false;
    }
  }

  // Get license information using REST API
  async getLicenseInfo(licenseKey) {
    try {
      await this.ensureInitialized();
      
      const apiUrl = `${this.firebaseConfig.databaseURL}/whitelisted_apis/${licenseKey}.json`;
      const response = await fetch(apiUrl);
      
      if (response.ok) {
        const licenseData = await response.json();
        return licenseData;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting license info:', error);
      return null;
    }
  }

  // Get all active licenses (admin function) using REST API
  async getAllActiveLicenses() {
    try {
      await this.ensureInitialized();
      
      const apisUrl = `${this.firebaseConfig.databaseURL}/whitelisted_apis.json`;
      const response = await fetch(apisUrl);
      
      if (response.ok) {
        const allLicenses = await response.json();
        const activeLicenses = {};
        
        if (allLicenses && typeof allLicenses === 'object') {
          Object.keys(allLicenses).forEach(key => {
            if (allLicenses[key].status === 'active') {
              activeLicenses[key] = allLicenses[key];
            }
          });
        }
        
        return activeLicenses;
      }
      
      return {};
    } catch (error) {
      console.error('❌ Error getting active licenses:', error);
      return {};
    }
  }

  // REMOVED: performPeriodicCheck() - No longer needed
  // REMOVED: startPeriodicChecking() - No longer needed

  // Test Firebase connectivity
  async testConnection() {
    try {
      const response = await fetch(`${this.firebaseConfig.databaseURL}/.json`);
      return response.ok;
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      return false;
    }
  }

  // Get Firebase database status
  async getDatabaseStatus() {
    try {
      await this.ensureInitialized();
      
      const configUrl = `${this.firebaseConfig.databaseURL}/config.json`;
      const whitelistedUrl = `${this.firebaseConfig.databaseURL}/whitelisted_apis.json`;
      
      const [configResponse, whitelistedResponse] = await Promise.all([
        fetch(configUrl),
        fetch(whitelistedUrl)
      ]);
      
      const config = configResponse.ok ? await configResponse.json() : null;
      const whitelisted = whitelistedResponse.ok ? await whitelistedResponse.json() : null;
      
      const activeCount = whitelisted ? Object.values(whitelisted).filter(license => license.status === 'active').length : 0;
      
      return {
        connected: true,
        config: config,
        totalLicenses: whitelisted ? Object.keys(whitelisted).length : 0,
        activeLicenses: activeCount,
        version: config?.version || 'Unknown'
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

// Create global instance for Firebase license validation
window.FirebaseLicenseValidator = FirebaseLicenseValidator;

// Initialize Firebase license validator when the script loads
console.log('🔥 Firebase License Validator script loaded (Event-driven only - No periodic checks)');