// Enhanced translation-service.js with AUTOMATIC RETRY LOGIC for 500 errors
class MaloumTranslator {
  constructor() {
    this.quickCache = new Map();
    this.reverseQuickCache = new Map();
    this.maxRetries = 3; // Maximum number of retries
    this.retryDelays = [1000, 2000, 4000]; // Exponential backoff delays in ms
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.cooldownPeriod = 30000; // 30 seconds cooldown after too many failures
  }

  // FIXED: Enhanced translate method with automatic retry logic
  async translate(text, targetLang, sourceLang = 'AUTO', messageType = 'message') {
    const startTime = performance.now();
    console.log(`🔄 TRANSLATION START: "${text}" (${sourceLang} → ${targetLang})`);

    // Check if we're in cooldown period
    if (this.isInCooldown()) {
      console.log('⏳ Translation cooldown active - waiting...');
      return {
        success: false,
        error: 'Too many consecutive failures. Please wait 30 seconds.',
        performanceMs: performance.now() - startTime
      };
    }

    // Try cache first
    try {
      const cacheResult = await this.checkCache(text, targetLang, sourceLang);
      if (cacheResult.found) {
        console.log('✅ CACHE HIT - returning cached translation');
        return {
          success: true,
          translation: cacheResult.translation,
          sourceLanguage: cacheResult.sourceLanguage,
          fromCache: true,
          performanceMs: performance.now() - startTime
        };
      }
    } catch (cacheError) {
      console.warn('⚠️ Cache check failed:', cacheError);
    }

    // Try translation with automatic retry
    return await this.translateWithRetry(text, targetLang, sourceLang, messageType, startTime);
  }

  // NEW: Translation with automatic retry logic
  async translateWithRetry(text, targetLang, sourceLang, messageType, startTime) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Translation attempt ${attempt + 1}/${this.maxRetries + 1}`);

        // Add delay for retries (exponential backoff)
        if (attempt > 0) {
          const delay = this.retryDelays[attempt - 1] || 4000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }

        // Attempt translation
        const result = await this.attemptTranslation(text, targetLang, sourceLang, messageType);
        
        // Success! Reset failure counter
        this.consecutiveFailures = 0;
        this.lastFailureTime = 0;
        
        console.log(`✅ Translation successful on attempt ${attempt + 1}`);
        
        // Save to cache for future use
        try {
          await this.saveTranslationToCache(text, result.translation, result.sourceLanguage, targetLang, messageType);
        } catch (cacheError) {
          console.warn('⚠️ Failed to save to cache:', cacheError);
        }

        return {
          success: true,
          translation: result.translation,
          sourceLanguage: result.sourceLanguage,
          fromCache: false,
          attempt: attempt + 1,
          performanceMs: performance.now() - startTime
        };

      } catch (error) {
        lastError = error;
        console.error(`❌ Translation attempt ${attempt + 1} failed:`, error.message);

        // Check if it's a 500 error that we should retry
        if (this.shouldRetry(error, attempt)) {
          console.log(`🔄 Will retry... (${this.maxRetries - attempt} attempts remaining)`);
          continue;
        } else {
          console.log(`🛑 Not retrying: ${error.message}`);
          break;
        }
      }
    }

    // All retries failed
    this.handleConsecutiveFailure();
    
    return {
      success: false,
      error: this.getUserFriendlyError(lastError),
      attempts: this.maxRetries + 1,
      performanceMs: performance.now() - startTime
    };
  }

  // NEW: Single translation attempt
  async attemptTranslation(text, targetLang, sourceLang, messageType) {
    // Preprocessing
    const preprocessing = this.preprocessText(text);
    
    // Background translation
    const result = await this.translateViaBackground({
      text: preprocessing.processedText,
      targetLang: targetLang,
      sourceLang: sourceLang,
      customPrompt: this.getCustomPrompt()
    });

    if (!result.success) {
      throw new Error(result.error || 'Translation failed');
    }

    // Postprocessing
    const finalTranslation = this.postprocessText(result.text, preprocessing.placeholderMap);

    return {
      translation: finalTranslation,
      sourceLanguage: sourceLang === 'AUTO' ? this.detectSourceLanguage(text, targetLang) : sourceLang
    };
  }

  // NEW: Determine if we should retry based on error type
  shouldRetry(error, attempt) {
    // Don't retry if we've exhausted attempts
    if (attempt >= this.maxRetries) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();
    
    // Retry for these specific errors
    const retryableErrors = [
      'translation api error: 500',
      'translation api error: 502',
      'translation api error: 503',
      'translation api error: 504',
      'background script timeout',
      'background communication failed',
      'network error',
      'fetch failed'
    ];

    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  // NEW: Handle consecutive failures
  handleConsecutiveFailure() {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    
    console.warn(`⚠️ Consecutive failures: ${this.consecutiveFailures}`);
    
    if (this.consecutiveFailures >= 3) {
      console.warn(`🚫 Entering cooldown period for ${this.cooldownPeriod / 1000} seconds`);
    }
  }

  // NEW: Check if we're in cooldown period
  isInCooldown() {
    if (this.consecutiveFailures < 3) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure < this.cooldownPeriod;
  }

  // NEW: Get user-friendly error message
  getUserFriendlyError(error) {
    if (!error) return 'Translation failed';
    
    const message = error.message.toLowerCase();
    
    if (message.includes('500')) {
      return 'Together.xyz servers are experiencing issues. Please try again in a moment.';
    }
    
    if (message.includes('timeout')) {
      return 'Translation timed out. The servers may be busy.';
    }
    
    if (message.includes('cooldown')) {
      return 'Taking a break due to server issues. Please wait 30 seconds.';
    }
    
    return 'Translation failed. Please try again.';
  }

  // Enhanced background communication with better error handling
  async translateViaBackground({ text, targetLang, sourceLang, customPrompt }) {
    try {
      console.log('🔧 BACKGROUND: Sending translation request');
      console.log(`🔧 BACKGROUND: "${text}" (${sourceLang} → ${targetLang})`);
      
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('❌ BACKGROUND: Timeout after 30 seconds');
          reject(new Error('Background script timeout'));
        }, 30000);
        
        chrome.runtime.sendMessage({
          action: 'translate',
          text: text,
          targetLang: targetLang,
          sourceLang: sourceLang,
          customPrompt: customPrompt
        }, (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.error('❌ BACKGROUND: Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (!response) {
            console.error('❌ BACKGROUND: No response from background script');
            reject(new Error('No response from background script'));
            return;
          }
          
          resolve(response);
        });
      });
      
        if (response.success) {
          console.log('✅ BACKGROUND: Translation successful');
          
          // Track API request BEFORE returning
          if (window.maloumCacheManager) {
            window.maloumCacheManager.incrementApiRequests(text, customPrompt || 'Default prompt', response.text);
          }
          
          return {
            success: true,
            text: response.text,
            sourceLanguage: sourceLang
          };
        }
      else {
        console.error('❌ BACKGROUND: Translation failed:', response.error);
        throw new Error(response.error || 'Background translation failed');
      }
      
    } catch (error) {
      console.error('❌ BACKGROUND: Communication failed:', error);
      throw new Error(`Background communication failed: ${error.message}`);
    }
  }

  // Utility methods
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  detectSourceLanguage(text, targetLang) {
    // Simple heuristic - if target is EN, source is probably DE
    return targetLang === 'EN' ? 'DE' : 'EN';
  }

// REPLACE this method in your translation-service.js:

getCustomPrompt() {
  // FIXED: Use prompt manager instead of hardcoded prompt
  if (window.maloumPromptManager && window.maloumPromptManager.getCurrentPrompt) {
    const customPrompt = window.maloumPromptManager.getCurrentPrompt();
    if (customPrompt) {
      console.log('🗝️ Using custom prompt from prompt manager');
      return customPrompt;
    }
  }
  
  // Fallback if prompt manager not available
  console.log('⚠️ Prompt manager not available, using fallback prompt');
  return 'You are a professional translator. Output exactly and only the translated text. No explanations, notes, comments, or additional text of any kind.';
}

  // Existing methods (preprocessText, postprocessText, etc.) remain the same...
  preprocessText(text) {
    // Your existing preprocessing logic
    return {
      processedText: text,
      placeholderMap: new Map()
    };
  }

  postprocessText(text, placeholderMap) {
    // Your existing postprocessing logic
    return text;
  }

  async checkCache(text, targetLang, sourceLang) {
    // Your existing cache checking logic
    return { found: false };
  }

  async saveTranslationToCache(originalText, translatedText, sourceLang, targetLang, messageType) {
    // Your existing cache saving logic
    console.log(`💾 Saving to cache: "${originalText}" → "${translatedText}"`);
  }

  // NEW: Public method to get retry status
  getRetryStatus() {
    return {
      consecutiveFailures: this.consecutiveFailures,
      isInCooldown: this.isInCooldown(),
      cooldownRemaining: this.isInCooldown() ? 
        Math.max(0, this.cooldownPeriod - (Date.now() - this.lastFailureTime)) : 0
    };
  }

  // NEW: Public method to reset failure counter
  resetFailureCounter() {
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    console.log('✅ Failure counter reset');
  } 
}
// FIX FOR ADMIN DOUBLE TRANSLATION ISSUE
// Add this fix to licensed-content.js in the enhanceTranslationMethods() function

// FIXED: Enhanced translate method with proper cache respect
const enhancedTranslate = async (text, targetLang, sourceLang, messageType) => {
  try {
    console.log('🔧 ADMIN FIX: Enhanced translate called with:', {
      text: text.substring(0, 50) + '...',
      targetLang,
      sourceLang,
      messageType
    });

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
    
    // 🔥 CRITICAL FIX: Check cache FIRST before calling original translate
    // This prevents the double translation issue for admin users
    if (window.maloumCacheManager && window.maloumCacheManager.initialized) {
      console.log('🔧 ADMIN FIX: Checking cache first...');
      
      // Check if translation exists in cache
      const cacheResult = await window.maloumCacheManager.checkCache(text, targetLang, sourceLang);
      
      if (cacheResult && cacheResult.success && cacheResult.fromCache) {
        console.log('🔧 ADMIN FIX: Found in cache, returning cached result');
        return {
          success: true,
          translation: cacheResult.translation,
          sourceLanguage: cacheResult.sourceLanguage,
          fromCache: true
        };
      }
    }
    
    // 🔥 CRITICAL FIX: Only call original translate if NOT found in cache
    console.log('🔧 ADMIN FIX: Not in cache, proceeding with original translate');
    const result = await originalTranslate(text, targetLang, sourceLang, messageType);
    
    console.log('🔧 ADMIN FIX: Original translate result:', {
      success: result?.success,
      fromCache: result?.fromCache,
      hasTranslation: !!result?.translation
    });
    
    return result;
    
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

// ADDITIONAL FIX: Add cache check method to admin users
// Add this method to the cache manager if it doesn't exist
if (window.maloumCacheManager && !window.maloumCacheManager.checkCache) {
  window.maloumCacheManager.checkCache = async function(text, targetLanguage, sourceLanguage = 'AUTO') {
    try {
      // Normalize languages for EN↔DE only
      const normalizedSource = sourceLanguage === 'AUTO' ? 'EN' : sourceLanguage.toUpperCase();
      const normalizedTarget = targetLanguage.toUpperCase();
      
      // Only support EN↔DE
      if (!((normalizedSource === 'EN' && normalizedTarget === 'DE') || 
            (normalizedSource === 'DE' && normalizedTarget === 'EN'))) {
        return { success: false, fromCache: false };
      }
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(text, normalizedTarget, normalizedSource);
      
      // Check if exists in cache
      const cached = this.translationCache.get(cacheKey);
      
      if (cached) {
        console.log('✅ ADMIN FIX: Translation found in cache');
        return {
          success: true,
          translation: cached.translatedText,
          sourceLanguage: cached.sourceLanguage,
          fromCache: true
        };
      }
      
      console.log('❌ ADMIN FIX: Translation not found in cache');
      return { success: false, fromCache: false };
      
    } catch (error) {
      console.error('❌ Error checking cache:', error);
      return { success: false, fromCache: false };
    }
  };
}

// DEBUGGING: Add console logging to track translation flow
console.log('🔧 ADMIN DOUBLE TRANSLATION FIX APPLIED');
console.log('🔧 This fix ensures admin users respect cache before making API calls');
// Export for use in your extension
window.MaloumTranslator = MaloumTranslator;