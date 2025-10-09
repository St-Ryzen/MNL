// content.js - FIXED: Chat-Specific Translation with EN↔DE Cache Integration
class OptimizedMaloumMessageHandler {
  constructor() {
    this.processedMessages = new Set();
    this.targetLanguage = 'DE'; // This is for textarea (user input)
    this.isInitialized = false;
    this.translator = null;
    this.authenticationReady = false;
    
    // Enhanced selectors for the new chat structure
    this.selectors = {
      // Textarea selector for user input (will translate to German)
      textarea: 'textarea[placeholder="Write a message"]',
      translateContainer: '#maloum-translate-container',
      translateBtn: '#maloum-translate-btn',
      // Chat message selectors (will translate to English)
      chatMessages: '.notranslate',
      messageContainers: 'div[class*="max-w-[70%]"][class*="rounded"]',
      // Elements to exclude from translation
      excludeSelectors: [
        'div.flex.w-full.items-center.justify-center.gap-2',
        'a[data-testid="transaction-item"]',
        'div.flex.gap-x-3',
        '.shrink-0',
        'h3',
        'span[class*="text-xs"]'
      ],
      emojiBtn: '#maloum-emoji-btn',
      cacheBtn: '#maloum-cache-btn'
    };
    
    // Debounced operations
    this.debounceTimers = new Map();
    
    // Cached DOM elements
    this.domCache = new Map();
    this.domCacheTimeout = 5000;
    
    // Performance tracking
    this.performanceMetrics = {
      translationsCount: 0,
      averageTime: 0,
      fastestTime: Infinity,
      slowestTime: 0
    };

    // NEW: Batch translation queue
    this.batchQueue = [];
    this.batchTimeout = null;
    this.batchConfig = {
      maxSize: 20,           // Max messages per batch
      timeoutMs: 500,        // Wait 500ms to collect messages
      enabled: true          // Enable batch translation
    };

    // Wake up background service worker immediately
    this.wakeUpBackgroundScript();

    // Wait for authentication before initializing
    this.waitForAuthentication().then(() => {
      this.init();
    }).catch(error => {
      console.error('Authentication wait failed:', error);
      setTimeout(() => this.init(), 5000);
    });

    // Observe for user bio elements
    this.observeUserBios();
  }

  // Wake up the background service worker (Manifest V3 service workers sleep)
  async wakeUpBackgroundScript() {
    try {
      console.log('🔔 Waking up background service worker...');
      await chrome.runtime.sendMessage({ action: 'ping' });
      console.log('✅ Background service worker is awake');
    } catch (error) {
      console.warn('⚠️ Could not wake background script:', error.message);
    }
  }
// NEW: Translation with automatic retry logic
async translateWithRetry(text, targetLang, sourceLang, messageType, maxRetries = 3) {
  const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s delays
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      
      // Add delay for retries
      if (attempt > 0) {
        const delay = retryDelays[attempt - 1] || 4000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Attempt translation
      const result = await this.translator.translate(text, targetLang, sourceLang, messageType);
      
      if (result && result.success) {
        if (attempt > 0) {
          this.showToast(`Translation successful after ${attempt + 1} attempts`, 'success');
        }
          if (window.maloumCacheManager) {
            const customPrompt = this.translator?.getCustomPrompt?.() || 'You are a professional translator. Output exactly and only the translated text. No explanations, notes, comments, or additional text of any kind.';
            window.maloumCacheManager.incrementApiRequests(text, customPrompt, result.translation || result.text);
          }
        return result;
      } else {
        throw new Error(result?.error || 'Translation failed');
      }

    } catch (error) {
      lastError = error;
      console.error(`❌ Translation attempt ${attempt + 1} failed:`, error.message);

      // Check if it's a retryable error
      const isRetryableError = error.message.includes('500') || 
                              error.message.includes('502') || 
                              error.message.includes('503') || 
                              error.message.includes('timeout') ||
                              error.message.includes('Background communication failed');

      if (isRetryableError && attempt < maxRetries - 1) {
        this.showToast(`Translation failed (attempt ${attempt + 1}), retrying...`, 'warning');
        continue;
      } else {
        break;
      }
    }
  }

  // All retries failed
  console.error(`❌ All ${maxRetries} translation attempts failed`);
  return {
    success: false,
    error: this.getUserFriendlyErrorMessage(lastError?.message || 'Translation failed after multiple attempts')
  };
}
  // Wait for authentication handler to be ready
  async waitForAuthentication() {
    
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      if (window.firebaseApiKeyHandler && window.firebaseApiKeyHandler.authChecked) {
        this.authenticationReady = true;
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    console.warn('⚠️ Authentication handler not ready after 10s, proceeding anyway');
    return false;
  }

  async init() {
    
    try {
      await this.initializeWithAuth();
      this.setupKeyboardShortcuts();
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.startMessageHandling());
      } else {
        this.startMessageHandling();
      }
      
      this.isInitialized = true;
      this.setupDebugFunctions();
      
    } catch (error) {
      console.error('Error during initialization:', error);
      this.startMessageHandling();
      this.setupDebugFunctions();
    }
  }

  // Initialize translator with authentication awareness
  async initializeWithAuth() {
    
    let isAuthenticated = false;
    
    if (window.firebaseApiKeyHandler) {
    }
    
    if (window.MaloumTranslator) {
      this.translator = new window.MaloumTranslator();
    } else {
      console.warn('⚠️ MaloumTranslator class not available yet');
    }
  }

startMessageHandling() {
  try {
    this.setupTranslateButtonMonitoring();
    this.observeMessages();
    
    // FIXED: Process existing messages immediately AND repeatedly
    this.processExistingMessages();
    
    // FIXED: Retry processing existing messages multiple times for page reloads
    setTimeout(() => this.processExistingMessages(), 500);
    setTimeout(() => this.processExistingMessages(), 1000);
    setTimeout(() => this.processExistingMessages(), 2000);
    setTimeout(() => this.processExistingMessages(), 3000);

    this.startTextareaMonitoring();
    
  } catch (error) {
    console.error('Error starting message handling:', error);
  }
}

  setupTranslateButtonMonitoring() {
    try {
      this.addTranslateButton();
      
      const observer = new MutationObserver(() => {
        this.debounce('addTranslateButton', () => {
          const hasTextarea = this.getCachedElement(this.selectors.textarea);
          const hasTranslateButton = this.getCachedElement(this.selectors.translateBtn);
          if (hasTextarea && !hasTranslateButton) {
            this.addTranslateButton();
          }
        }, 500);
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (error) {
      console.error('Error setting up translate button monitoring:', error);
    }
  }

  addTranslateButton() {
    const checkForTextarea = () => {
      try {
        const textarea = this.getCachedElement(this.selectors.textarea, false);
        if (textarea && !this.getCachedElement(this.selectors.translateBtn, false)) {
          this.createTranslateButton(textarea);
        } else if (!textarea) {
          setTimeout(checkForTextarea, 1000);
        }
      } catch (error) {
        console.warn('Error checking for textarea:', error);
      }
    };
    checkForTextarea();
  }

  createTranslateButton(textarea) {
    try {
      const existingContainer = document.getElementById('maloum-translate-container');
      if (existingContainer) existingContainer.remove();

      const buttonContainer = document.createElement('div');
      buttonContainer.id = 'maloum-translate-container';
      buttonContainer.style.cssText = `
        display: flex; 
        gap: 6px; 
        margin-top: 6px; 
        align-items: center; 
        padding: 6px 10px; 
        background: #f9fafb; 
        border-radius: 6px; 
        border: 1px solid #e5e7eb;
      `;

      const isAuthenticated = true; // Always assume authenticated - API key is in chrome.storage.sync

      // Translate button (for textarea only)
      const translateBtn = document.createElement('button');
      translateBtn.id = 'maloum-translate-btn';
      translateBtn.textContent = 'Translate to German';
      translateBtn.title = 'Translate (Alt+J)'
      translateBtn.style.cssText = `
        padding: 5px 10px; 
        background: rgba(0, 0, 0, 0.8); 
        color: white; 
        border: none; 
        border-radius: 4px; 
        cursor: pointer; 
        font-size: 11px; 
        font-weight: 500; 
        transition: all 0.2s;
        min-width: 35px;
        opacity: ${isAuthenticated ? '1' : '0.5'};
      `;

      // Cache button
      const cacheBtn = document.createElement('button');
      cacheBtn.id = 'maloum-cache-btn';
      cacheBtn.textContent = 'Cache';
      cacheBtn.title = 'Open Cache Manager (Alt+K)';
      cacheBtn.style.cssText = `
        padding: 5px 10px; 
        background: rgba(0, 0, 0, 0.8); 
        color: white; 
        border: none; 
        border-radius: 4px; 
        cursor: pointer; 
        font-size: 11px; 
        font-weight: 500; 
        transition: all 0.2s;
        min-width: 35px;
        opacity: ${isAuthenticated ? '1' : '0.5'};
      `;

      // Show authentication status
      if (!isAuthenticated) {
        translateBtn.title = 'Authentication required - check popup';
        cacheBtn.title = 'Authentication required - check popup';
        
        const indicator = document.createElement('span');
        indicator.textContent = '⚠️ AUTH REQUIRED';
        indicator.style.cssText = `
          font-size: 9px;
          color: #dc2626;
          font-weight: 600;
          margin-left: 8px;
        `;
        buttonContainer.appendChild(indicator);
      }


      [translateBtn, cacheBtn].forEach(btn => {
        btn.addEventListener('mouseenter', () => {
          if (isAuthenticated) {
            btn.style.background = 'rgba(244, 62, 6, 1)';
            btn.style.transform = 'scale(1.05)';
            btn.style.color = 'black';
          }
        });

        btn.addEventListener('mouseleave', () => {
          if (isAuthenticated) {
            btn.style.background = 'rgba(0, 0, 0, 0.8)';
            btn.style.transform = 'scale(1)';
            btn.style.color = 'white';
          }
        });
      });

      translateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (!isAuthenticated) {
          this.showToast('Please authenticate API key in popup first', 'error');
          return;
        }
        
        await this.handleOptimizedTextareaTranslation(textarea, translateBtn);
      });

      cacheBtn.addEventListener('click', () => {
        if (!isAuthenticated) {
          this.showToast('Please authenticate API key in popup first', 'error');
          return;
        }
        
        if (window.maloumCacheManager?.initialized) {
          window.maloumCacheManager.showCacheUI();
        } else {
          this.showToast('Cache manager not ready', 'error');
        }
      });

      buttonContainer.appendChild(translateBtn);
      buttonContainer.appendChild(cacheBtn);

      // Find the textarea container and insert button container after it
      const textareaContainer = textarea.closest('div');
      if (textareaContainer?.parentNode) {
        textareaContainer.parentNode.insertBefore(buttonContainer, textareaContainer.nextSibling);
      }

      this.domCache.set(this.selectors.translateBtn, {
        element: translateBtn,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error creating translate button:', error);
    }
  }

  async handleOptimizedTextareaTranslation(textarea, translateBtn) {
    const startTime = performance.now();
    const text = textarea.value.trim();
    
    if (!text) {
      this.showToast('Enter text to translate', 'error');
      return;
    }

    // Removed authentication check - assume API key is configured
    const isAuthenticated = true;

    if (!this.translator) {
      this.showToast('Translator not ready', 'error');
      return;
    }

    const originalText = translateBtn.textContent;
    translateBtn.textContent = 'Translating...';
    translateBtn.disabled = true;

    try {
      const targetLanguage = this.targetLanguage;
      
      // SKIP CACHE CHECK - Always use API for textarea translations
      // Removed STEP 1: Cache checking
      
      // STEP 2: Call API with AUTO detection (always)
      const result = await this.translator.translate(text, targetLanguage, 'AUTO', 'textarea');
      
      if (result && result.success) {
        const detectedSource = result.sourceLanguage || 'AUTO';
        
        // STEP 3: Check if source and target are the same (no translation needed)
        if (detectedSource === targetLanguage) {
          this.showToast(`Text is already in ${targetLanguage}`, 'info');
          
          // Still save to cache for future reference (avoid API calls)
          await this.saveToCacheForTextarea(text, text, detectedSource, targetLanguage, 'textarea_same_lang');
          return;
        }
        
        // STEP 4: Handle API skipping
        if (result.skipped) {
          textarea.value = result.translation;
          this.triggerTextareaEvents(textarea);
          this.showToast(`Skipped: ${result.reason}`, 'info');
          
          // Save skipped result to cache
          await this.saveToCacheForTextarea(text, result.translation, detectedSource, targetLanguage, 'textarea_skipped');
          return;
        }
        
        // STEP 5: Successful translation - update UI and save to cache
        textarea.value = result.translation;
        this.triggerTextareaEvents(textarea);
        
        // STEP 6: CRITICAL - Save to cache with detected source language
        
        const cacheSuccess = await this.saveToCacheForTextarea(text, result.translation, detectedSource, targetLanguage, 'textarea');

        // CRITICAL FIX: Also save reverse direction for message lookup
        if (cacheSuccess && window.maloumCacheManager && window.maloumCacheManager.initialized) {
          // Save reverse direction so when message appears, it can find the cached translation
          const reverseSuccess = await window.maloumCacheManager.storeCachedTranslation(
            null,              // Let it generate the key
            result.translation, // Now this becomes the "original"
            text,              // And this becomes the "translation"
            targetLanguage,    // Source becomes target
            detectedSource,    // Target becomes source  
            'textarea_reverse' // Mark it as reverse direction
          );
          
          if (reverseSuccess) {
            console.log('✅ Saved reverse direction for message lookup:', result.translation, '→', text);
          } else {
            console.warn('⚠️ Failed to save reverse direction');
          }
        }
        
        // STEP 7: Track API usage for statistics
        if (window.maloumCacheManager && window.maloumCacheManager.incrementApiRequests) {
          const customPrompt = this.translator.getCustomPrompt ? this.translator.getCustomPrompt() : 'Default prompt';
          
          // Build the complete system prompt like the API actually receives
          const sourceLangName = result.sourceLanguage || 'English';
          const targetLangName = targetLanguage || 'German';
          const taskInstruction = `Task: Translate from ${sourceLangName} to ${targetLangName}.`;
          const completeSystemPrompt = `${customPrompt}\n\n${taskInstruction}`;
          
          console.log('🔍 Calling incrementApiRequests for textarea translation');
          
          // Call with the complete system prompt
          window.maloumCacheManager.incrementApiRequests(
            text, 
            completeSystemPrompt, 
            result.translation
          );
        }
        
        const totalTime = performance.now() - startTime;
        this.updatePerformanceMetrics(totalTime);
        
        const message = `Translated from ${detectedSource} to ${targetLanguage} in ${totalTime.toFixed(0)}ms!`;
        this.showToast(message, 'success');
        
        
      } else {
        console.error('❌ API FAILED:', result?.error);
        this.showToast(this.getUserFriendlyErrorMessage(result?.error), 'error');
      }
      
    } catch (error) {
      console.error('❌ TRANSLATION ERROR:', error);
      this.showToast(this.getUserFriendlyErrorMessage(error.message), 'error');
    } finally {
      translateBtn.textContent = originalText;
      translateBtn.disabled = false;
    }
  }

    // FIXED: Method to check if translation exists in cache (for external callers)
    async checkCache(text, targetLanguage, sourceLanguage = 'AUTO') {
      
      // Normalize languages for EN↔DE only
      const normalizedSource = sourceLanguage === 'AUTO' ? 'EN' : sourceLanguage.toUpperCase();
      const normalizedTarget = targetLanguage.toUpperCase();
      
      // Only support EN↔DE
      if (!((normalizedSource === 'EN' && normalizedTarget === 'DE') || 
            (normalizedSource === 'DE' && normalizedTarget === 'EN'))) {
        return { found: false };
      }
      
      // CRITICAL FIX: External checks are now treated as USER REQUESTS and DO count hits
      const directResult = await this.getCachedTranslation(text, true); // true = count as user request
      if (directResult && 
          directResult.sourceLanguage === normalizedSource && 
          directResult.targetLanguage === normalizedTarget) {
        return {
          found: true,
          translation: directResult.translatedText,
          sourceLanguage: directResult.sourceLanguage,
          targetLanguage: directResult.targetLanguage,
          fromCache: true
        };
      }
      
      // Try reverse lookup (also count as user request)
      const reverseResult = await this.getReverseTranslation(text);
      if (reverseResult && 
          reverseResult.targetLanguage === normalizedSource && 
          reverseResult.sourceLanguage === normalizedTarget) {
        // Manually count this hit since getReverseTranslation doesn't count by default
        this.incrementCacheHits();
        return {
          found: true,
          translation: reverseResult.originalText,
          sourceLanguage: normalizedSource,
          targetLanguage: normalizedTarget,
          fromCache: true,
          isReverse: true
        };
      }
      
      return { found: false };
    }

async checkCacheForTextarea(text, targetLang, sourceLang = null) {
  try {
    
    // Only support EN↔DE translations
    if (!(targetLang === 'DE' || targetLang === 'EN')) {
      return { found: false };
    }
    
    // If no source specified, try both EN and DE
    const sourcesToCheck = sourceLang ? [sourceLang] : ['EN', 'DE'];
    
    // Check cache manager first - THIS IS A USER REQUEST, COUNT HITS
    if (window.maloumCacheManager && window.maloumCacheManager.initialized) {
      for (const sourceToCheck of sourcesToCheck) {
        // Only check valid EN↔DE pairs
        if ((sourceToCheck === 'EN' && targetLang === 'DE') || 
            (sourceToCheck === 'DE' && targetLang === 'EN')) {
          
          
          // Use getUserCachedTranslation which automatically counts hits
          const cacheResult = await window.maloumCacheManager.getCachedTranslation(text, true); // true = user request, count hits
          
          if (cacheResult && 
              cacheResult.sourceLanguage === sourceToCheck && 
              cacheResult.targetLanguage === targetLang) {
            return {
              found: true,
              translation: cacheResult.translatedText,
              sourceLanguage: sourceToCheck,
              targetLanguage: targetLang,
              cacheKey: 'cache_manager'
            };
          }
        }
      }
      
      // Try reverse lookup
      const reverseResult = await window.maloumCacheManager.getReverseTranslation(text);
      if (reverseResult) {
        // Check if reverse result matches any of our target scenarios
        for (const sourceToCheck of sourcesToCheck) {
          if (reverseResult.sourceLanguage === targetLang && 
              reverseResult.targetLanguage === sourceToCheck) {
            // CRITICAL: Count this cache hit manually since getReverseTranslation doesn't count
            window.maloumCacheManager.incrementCacheHits();
            return {
              found: true,
              translation: reverseResult.originalText,
              sourceLanguage: sourceToCheck,
              targetLanguage: targetLang,
              cacheKey: 'reverse_cache'
            };
          }
        }
      }
    }
    
    // Check translator cache as fallback
    if (this.translator && this.translator.checkCache) {
      for (const sourceToCheck of sourcesToCheck) {
        if ((sourceToCheck === 'EN' && targetLang === 'DE') || 
            (sourceToCheck === 'DE' && targetLang === 'EN')) {
          
          const translatorResult = await this.translator.checkCache(text, targetLang, sourceToCheck);
          
          if (translatorResult.found) {
            // CRITICAL: Count this hit manually since translator cache doesn't count automatically
            return translatorResult;
          }
        }
      }
    }
    
    return { found: false };
    
  } catch (error) {
    console.error('❌ CACHE CHECK ERROR:', error);
    return { found: false };
  }
}

async checkCacheForMessage(text, isPageLoad = false) {
  try {
    const isUserRequest = !isPageLoad;
    
    // Messages/captions/comments ALWAYS translate TO English
    const targetLanguage = 'EN';
    
    // Check cache manager using getCachedTranslation directly (it handles AUTO properly)
    if (window.maloumCacheManager && window.maloumCacheManager.initialized) {
      
      // Use getCachedTranslation directly - it already handles AUTO→specific language conversion
      const directResult = await window.maloumCacheManager.getCachedTranslation(
        text, 
        isUserRequest, // This will count cache hits for user requests only
        targetLanguage, 
        'AUTO' // This will be expanded to try ['EN', 'DE'] internally
      );
      
      if (directResult) {
        return {
          found: true,
          translation: directResult.translatedText,
          sourceLanguage: directResult.sourceLanguage,
          targetLanguage: directResult.targetLanguage,
          cacheKey: 'cache_manager_direct',
          isReverse: false
        };
      }
    }
    
    return { found: false };
    
  } catch (error) {
    console.error('❌ CACHE CHECK ERROR:', error);
    return { found: false };
  }
}
  // FIXED: Save to cache for textarea with EN↔DE validation
async saveToCacheForTextarea(originalText, translatedText, sourceLanguage, targetLanguage, messageType) {
  try {
    
    // Validate inputs
    if (!originalText || !translatedText) {
      console.error('❌ CACHE SAVE FAILED: Missing originalText or translatedText');
      return false;
    }
    
    if (!sourceLanguage || !targetLanguage) {
      console.error('❌ CACHE SAVE FAILED: Missing sourceLanguage or targetLanguage');
      return false;
    }
    
    // Normalize language codes
    const normalizedSource = sourceLanguage.toUpperCase();
    const normalizedTarget = targetLanguage.toUpperCase();
    
    // Only save EN↔DE pairs (but allow same language for statistics)
    const validPairs = [
      'EN→DE', 'DE→EN',  // Normal translations
      'EN→EN', 'DE→DE'   // Same language (for statistics)
    ];
    
    const currentPair = `${normalizedSource}→${normalizedTarget}`;
    
    if (!validPairs.includes(currentPair)) {
      return false;
    }
    
    
    // Try cache manager first
    if (window.maloumCacheManager && window.maloumCacheManager.initialized) {
      
      const success = await window.maloumCacheManager.storeCachedTranslation(
        null, // Let cache manager generate the key
        originalText,
        translatedText,
        normalizedSource,
        normalizedTarget,
        messageType || 'textarea'
      );
      
      if (success) {
        return true;
      } else {
        console.warn(`⚠️ CACHE MANAGER FAILED: Could not save to cache manager`);
      }
    } else {
      console.warn(`⚠️ CACHE MANAGER NOT AVAILABLE: window.maloumCacheManager not initialized`);
    }
    
    // Try translator cache as fallback
    if (this.translator && this.translator.saveTranslationToCache) {
      
      const success = await this.translator.saveTranslationToCache(
        originalText,
        translatedText,
        normalizedSource,
        normalizedTarget,
        messageType || 'textarea'
      );
      
      if (success) {
        return true;
      } else {
        console.warn(`⚠️ TRANSLATOR CACHE FAILED: Could not save to translator cache`);
      }
    } else {
      console.warn(`⚠️ TRANSLATOR CACHE NOT AVAILABLE: this.translator.saveTranslationToCache not found`);
    }
    
    console.error(`❌ ALL CACHE METHODS FAILED: Could not save textarea translation anywhere`);
    return false;
    
  } catch (error) {
    console.error('❌ CACHE SAVE ERROR: Exception occurred while saving textarea translation:', error);
    return false;
  }
}

  // Enhanced message observation for chat messages
observeMessages() {
  try {
    const observer = new MutationObserver((mutations) => {
      // REMOVE the debounce delay for immediate processing
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Process new messages IMMEDIATELY without debounce
            this.checkForNewChatMessages(node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (error) {
    console.error('Error setting up message observer:', error);
  }
}

  // Observe user bio elements for automatic translation
observeUserBios() {
  try {
    // Process existing bios immediately
    this.processExistingUserBios();
    
    // Process existing mass messages immediately
    this.processExistingMassMessages();
    
    // Set up observer for new bios and messages
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Process new user bios IMMEDIATELY
            this.checkForNewUserBios(node);
            
            // Process new mass messages IMMEDIATELY
            this.checkForNewMassMessages(node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (error) {
    console.error('Error setting up user bio and mass message observer:', error);
  }
}

  // Enhanced message detection for chat structure
checkForNewChatMessages(node) {
  try {
    // Check if this node contains chat messages
    const messageElements = this.findChatMessages(node);
    
    messageElements.forEach(messageElement => {
      if (!this.processedMessages.has(messageElement) && this.isValidChatMessage(messageElement)) {
        // CRITICAL: Use false to show cached translations immediately
        this.processMessageElement(messageElement, false);
      }
    });
  } catch (error) {
    console.warn('Error checking for new chat messages:', error);
  }
}

  // Find chat messages using multiple selectors
  findChatMessages(node) {
    const messageElements = [];
    
    // Check if the node itself is a message container
    if (this.matchesChatMessageSelector(node)) {
      const notranslateSpan = node.querySelector('.notranslate');
      if (notranslateSpan && !this.isBioElement(notranslateSpan)) {
        messageElements.push(notranslateSpan);
      }
    }
    
    // Look for message containers within the node
    const messageContainers = node.querySelectorAll(this.selectors.messageContainers);
    messageContainers.forEach(container => {
      if (this.matchesChatMessageSelector(container)) {
        const notranslateSpan = container.querySelector('.notranslate');
        if (notranslateSpan && !this.isBioElement(notranslateSpan)) {
          messageElements.push(notranslateSpan);
        }
      }
    });
    
    // Also check for direct .notranslate spans in chat context
    const directSpans = node.querySelectorAll('.notranslate');
    directSpans.forEach(span => {
      const container = span.closest('div[class*="max-w-[70%]"]');
      if (container && this.matchesChatMessageSelector(container) && !this.isBioElement(span)) {
        messageElements.push(span);
      }
    });
    
    // NEW: Check for all .notranslate elements as a fallback
    const allNotranslateElements = node.querySelectorAll('.notranslate');
    allNotranslateElements.forEach(element => {
      // Skip if already processed
      if (this.processedMessages.has(element)) return;
      
      // Skip if it's already been added through other selectors
      if (messageElements.includes(element)) return;
      
      // Skip if it's a bio element
      if (this.isBioElement(element)) return;
      
      // Get the text content
      const textContent = element.textContent.trim();
      
      // Skip if empty
      if (!textContent) return;
      
      // Skip if it's within an excluded container
      let isExcluded = false;
      for (const excludeSelector of this.selectors.excludeSelectors) {
        if (element.closest(excludeSelector)) {
          isExcluded = true;
          break;
        }
      }
      
      // Skip if it's part of a system message pattern
      if (/^(joined|left|online|offline|typing|away|is typing|has joined|has left|connected|disconnected)$/i.test(textContent)) {
        isExcluded = true;
      }
      
      // Skip if it looks like a username link (short text with no spaces)
      if (element.tagName === 'A' && textContent.length < 20 && !textContent.includes(' ')) {
        isExcluded = true;
      }
      
      if (!isExcluded) {
        messageElements.push(element);
      }
    });
    
    return messageElements;
  }

// Check if element matches chat message selector patterns
matchesChatMessageSelector(element) {
  if (!element || !element.classList) return false;
  
  // Check for message container patterns
  const classString = element.className;
  
  // Match the pattern from your examples - be more flexible
  const isMessageContainer = classString.includes('max-w-[70%]') && 
                            classString.includes('rounded');
  
  return isMessageContainer;
}
  // Enhanced validation for chat messages
  isValidChatMessage(messageElement) {
    try {
      const messageText = messageElement.textContent.trim();
      
      // Accept ALL text messages, even single characters
      if (!messageText) {
        // DEBUG: Log invalid message
        // console.log('Message is empty:', messageText);
        return false;
      }
      
      // Check if this element should be excluded
      for (const excludeSelector of this.selectors.excludeSelectors) {
        if (messageElement.closest(excludeSelector)) {
          return false;
        }
      }
      
      // Only exclude very obvious system messages and pure numbers
      if (/^(joined|left|online|offline|typing|away|is typing|has joined|has left|connected|disconnected)$/i.test(messageText)) {
        return false;
      }
      
      // Accept ALL other text including single words, names, short messages
      return true;
    } catch (error) {
      console.warn('Error validating chat message:', error);
      return false;
    }
  }

processExistingMessages() {
  try {
    const messageElements = this.findChatMessages(document);
    
    messageElements.forEach((messageElement) => {
      try {
        if (!this.processedMessages.has(messageElement) && this.isValidChatMessage(messageElement)) {
          // CRITICAL: Use false to show cached translations immediately
          this.processMessageElement(messageElement, false);
        }
      } catch (error) {
        console.warn('Error processing message element:', error);
      }
    });
  } catch (error) {
    console.error('Error processing existing messages:', error);
  }
}

startTextareaMonitoring() {
  // Clear any existing interval to prevent duplicates
  if (this.textareaIntervalId) {
    clearInterval(this.textareaIntervalId);
  }
  
  let lastValue = '';
  
  // Monitor textarea changes every 500ms
  this.textareaIntervalId = setInterval(() => {
    const textarea = this.getCachedElement(this.selectors.textarea, false);
    if (!textarea) return;
    
    const currentValue = textarea.value.trim();
    
    // Check if value changed
    if (currentValue !== lastValue) {
      lastValue = currentValue;
      this.checkTextareaForCacheHint(currentValue, textarea);
    }
  }, 500);
  
  // CRITICAL FIX: Add direct event listeners to textarea for immediate response
  const textarea = this.getCachedElement(this.selectors.textarea, false);
  if (textarea) {
    // Track event listeners to remove them later during cleanup
    if (!this.textareaEventListeners) {
      this.textareaEventListeners = {
        input: null,
        keydown: null,
        paste: null
      };
    }
    
    // Remove existing listeners if they exist to prevent duplicates
    if (this.textareaEventListeners.input) {
      textarea.removeEventListener('input', this.textareaEventListeners.input);
    }
    if (this.textareaEventListeners.keydown) {
      textarea.removeEventListener('keydown', this.textareaEventListeners.keydown);
    }
    if (this.textareaEventListeners.paste) {
      textarea.removeEventListener('paste', this.textareaEventListeners.paste);
    }
    
    // Create new listener functions and store them for removal
    this.textareaEventListeners.input = () => {
      const currentValue = textarea.value.trim();
      this.checkTextareaForCacheHint(currentValue, textarea);
    };
    
    this.textareaEventListeners.keydown = () => {
      // Use setTimeout to get the value after the key is processed
      setTimeout(() => {
        const currentValue = textarea.value.trim();
        this.checkTextareaForCacheHint(currentValue, textarea);
      }, 10);
    };
    
    this.textareaEventListeners.paste = () => {
      setTimeout(() => {
        const currentValue = textarea.value.trim();
        this.checkTextareaForCacheHint(currentValue, textarea);
      }, 10);
    };
    
    // Add the new event listeners
    textarea.addEventListener('input', this.textareaEventListeners.input);
    textarea.addEventListener('keydown', this.textareaEventListeners.keydown);
    textarea.addEventListener('paste', this.textareaEventListeners.paste);
  }
}

async checkTextareaForCacheHint(text, textarea) {
  try {
    // CRITICAL FIX: Hide hint immediately if textarea is empty or text is too short
    if (!text || text.length < 3) {
      this.hideCacheHint();
      return;
    }
    
    // Check for EN to DE cache (most common textarea direction)
    const cacheResult = await this.checkCacheForTextarea(text, 'DE', 'EN');
    
    if (cacheResult.found) {
      this.showCacheHint(textarea, cacheResult.translation);
    } else {
      // Hide hint if no cache found
      this.hideCacheHint();
    }
  } catch (error) {
    console.error('Error checking textarea cache hint:', error);
    // Hide hint on error too
    this.hideCacheHint();
  }
}

showCacheHint(textarea, translation) {
  this.hideCacheHint(); // Remove existing
  
  const hint = document.createElement('div');
  hint.id = 'maloum-cache-hint';
  hint.title = `Cached: "${translation.length > 30 ? translation.substring(0, 30) + '...' : translation}" - Click to use`;
  
  // SIMPLE ICON STYLING
  hint.style.cssText = `
    position: absolute;
    top: -22px;
    right: 8px;
    width: 18px;
    height: 18px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 50%;
    font-size: 10px;
    z-index: 1000;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  `;
  
  // LIGHTNING ICON (you can change to ⚡ or 💡 if you prefer)
  hint.innerHTML = '⚡';
  
  // HOVER EFFECTS
  hint.addEventListener('mouseenter', () => {
    hint.style.transform = 'scale(1.1)';
    hint.style.background = 'rgba(0, 0, 0, 1)';
    hint.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  });
  
  hint.addEventListener('mouseleave', () => {
    hint.style.transform = 'scale(1)';
    hint.style.background = 'rgba(0, 0, 0, 0.8)';
    hint.style.borderColor = 'rgba(255, 255, 255, 0.2)';
  });
  
  // CLICK TO USE FUNCTIONALITY
  hint.addEventListener('click', () => {
    textarea.value = translation;
    this.triggerTextareaEvents(textarea);
    this.hideCacheHint();
    this.showToast('Used cached translation!', 'success');
    
    // Increment cache hit counter
    if (window.maloumCacheManager && window.maloumCacheManager.incrementCacheHits) {
      window.maloumCacheManager.incrementCacheHits(false);
    }
  });
  
  // Position relative to textarea
  const container = textarea.closest('div');
  if (container) {
    container.style.position = 'relative';
    container.appendChild(hint);
    
    // SUBTLE ENTRANCE ANIMATION
    hint.style.opacity = '0';
    hint.style.transform = 'scale(0.5)';
    setTimeout(() => {
      hint.style.opacity = '1';
      hint.style.transform = 'scale(1)';
    }, 100);
  }
}


hideCacheHint() {
  const hint = document.getElementById('maloum-cache-hint');
  if (hint) {
    // Force removal even if hovered
    hint.style.pointerEvents = 'none';
    hint.style.opacity = '0';
    setTimeout(() => {
      if (hint.parentNode) {
        hint.parentNode.removeChild(hint);
      }
    }, 100);
  }
}


// FIXED: Add this method to force reprocessing when needed
forceReprocessAllMessages() {
  this.processedMessages.clear(); // Clear the processed set
  this.processExistingMessages(); // Process all messages again
}
// FIXED: Process individual message element with EN↔DE cache checking
async processMessageElement(messageElement, isPageLoad = true) {
  try {
    if (this.processedMessages.has(messageElement)) return;
    this.processedMessages.add(messageElement);

    const messageText = messageElement.textContent.trim();
    const messageType = this.detectMessageType(messageElement);

    // FIXED: Pass isPageLoad flag to prevent counting cache hits during automatic processing
    const cacheResult = await this.checkCacheForMessage(messageText, isPageLoad);

    if (cacheResult.found) {
      this.showTranslation(
        messageElement,
        cacheResult.translation,
        messageType,
        null,
        cacheResult.cacheKey || 'cached',
        true,
        cacheResult.sourceLanguage,
        cacheResult.isReverse
      );
      return;
    }

    // NEW: Use batch queue for uncached messages (saves API costs!)
    await this.addToBatchQueue(messageElement, messageText, messageType);
  } catch (error) {
    console.warn('Error processing message element:', error);
  }
}


  // Add translate button to individual messages
  addTranslateButtonToMessage(messageElement, messageText) {
    try {
      // ENHANCED: Find container for messages, captions, and comments
      let messageContainer = messageElement.closest('div[class*="max-w-[70%]"]');
      
      // If not found (captions/comments), just use parent element
      if (!messageContainer) {
        messageContainer = messageElement.parentElement;
      }
      
      if (!messageContainer || messageContainer.querySelector('.maloum-translate-btn-msg')) return;

      const messageType = this.detectMessageType(messageElement);
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'maloum-translate-controls';
      buttonContainer.style.cssText = `
        margin-top: 6px; 
        display: flex; 
        gap: 6px; 
        align-items: center;
        justify-content: flex-start;
      `;
      // NEW: Check if translation already exists - don't add button
      const parentElement = messageElement.parentElement;
      if (parentElement && parentElement.querySelector('.maloum-translation')) {
        return; // Translation already shown, don't add button
      }
      const translateBtn = document.createElement('button');
      translateBtn.className = 'maloum-translate-btn-msg';
      translateBtn.innerHTML = '<span class="translate-icon">⚡</span>Translate';
      
      const isAuthenticated = true; // Always assume authenticated - API key is in chrome.storage.sync
      
      translateBtn.style.cssText = `
        padding: 2px 8px;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, #000000 100%); 
        color: white; 
        border: none; 
        border-radius: 8px; 
        cursor: pointer; 
        font-size: 10px; 
        font-weight: 600;
        opacity: ${isAuthenticated ? '1' : '0.5'};
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 85px;
        justify-content: center;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        position: relative;
        overflow: hidden;
      `;
      
      // Add hover glow effect styles if not already added
      if (!document.querySelector('#maloum-translate-styles')) {
        const style = document.createElement('style');
        style.id = 'maloum-translate-styles';
        style.textContent = `
          .maloum-translate-btn-msg::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            transition: left 0.6s ease;
          }
          .maloum-translate-btn-msg:hover::before {
            left: 100%;
          }
          .maloum-translate-btn-msg:active {
            transform: translateY(-1px) scale(0.98);
          }
          .translate-icon {
            font-size: 13px;
            transition: transform 0.3s ease;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
          }
          .maloum-translate-btn-msg:hover .translate-icon {
            transform: scale(1.15) rotate(10deg);
          }
          .translate-spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 4px;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
      
      if (!isAuthenticated) {
        translateBtn.title = 'Authentication required - check popup';
      } else {
        translateBtn.title = 'Translate to English (any language → EN)';
      }

      translateBtn.addEventListener('mouseenter', () => {
        if (isAuthenticated) {
          translateBtn.style.background = 'linear-gradient(135deg,rgba(244, 62, 6, 0.6) 0%, #f43e06 100%)';
          translateBtn.style.transform = 'translateY(-2px) scale(1.02)';
          translateBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
        }
      });

      translateBtn.addEventListener('mouseleave', () => {
        if (isAuthenticated) {
          translateBtn.style.background = 'linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, #000000 100%)';
          translateBtn.style.transform = 'translateY(0) scale(1)';
          translateBtn.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
        }
      });

      translateBtn.addEventListener('click', async () => {
        if (!isAuthenticated) {
          this.showToast('Authentication required - check popup', 'error');
          return;
        }
        
        await this.handleOptimizedMessageTranslation(messageElement, messageText, messageType, buttonContainer);
      });

      buttonContainer.appendChild(translateBtn);
      
      // ENHANCED: Smart insertion - try existing logic first, then simple fallback
      const messageContent = messageContainer.querySelector('.group.flex.flex-col.justify-center');
      if (messageContent) {
        messageContent.appendChild(buttonContainer);
      } else {
        // Simple fallback for captions/comments - just append to container
        messageContainer.appendChild(buttonContainer);
      }
      
    } catch (error) {
      console.warn('Error adding translate button to message:', error);
    }
  }

  // FIXED: Message translation - ALWAYS translate to English with proper cache integration
  async handleOptimizedMessageTranslation(messageElement, messageText, messageType, buttonContainer) {
    try {
      const translateBtn = buttonContainer.querySelector('.maloum-translate-btn-msg');
      
      if (!this.translator) {
        this.showToast('Translator not ready', 'error');
        return;
      }
      
      translateBtn.innerHTML = '<span class="translate-spinner"></span>Translating...';
      translateBtn.disabled = true;
      
      // STEP 1: CHECK CACHE FIRST - This is the critical fix!
      const cacheResult = await this.checkCacheForMessage(messageText, false); // false = user-initiated
      
      if (cacheResult.found) {
        
        // Show translation immediately from cache
        this.showTranslation(
          messageElement, 
          cacheResult.translation, 
          messageType, 
          buttonContainer, 
          cacheResult.cacheKey, 
          true, // fromCache = true
          cacheResult.sourceLanguage,
          cacheResult.isReverse
        );
        

        return; // EXIT EARLY - CRITICAL!
      }
      
      // STEP 2: CACHE MISS - Need to translate via API      
      // STEP 3: Language detection to determine if translation is needed
      const detectedLanguage = this.detectMessageLanguage(messageText);
      
      if (detectedLanguage === 'EN') {
        
        // Show as "already English" without API call
        this.showTranslation(
          messageElement, 
          messageText, // Return the same text
          messageType, 
          buttonContainer, 
          'already_english', 
          false, // fromCache = false
          'EN',
          false
        );
        
        // Save to cache as EN→EN for future cache hits
        await this.saveToCacheForMessage(messageText, messageText, 'EN', 'EN', messageType);
        this.showToast('Text is already in English', 'info');
        return;
      }
      
      // STEP 4: Text needs translation - call API
      const result = await this.translator.translate(messageText, 'EN', detectedLanguage, messageType);
      
      if (result && result.success) {        
        // STEP 5: Save to cache with proper format
        await this.saveToCacheForMessage(messageText, result.translation, result.sourceLanguage || detectedLanguage, 'EN', messageType);
        
        // STEP 6: Show translation
        this.showTranslation(
          messageElement, 
          result.translation, 
          messageType, 
          buttonContainer, 
          result.cacheKey, 
          result.fromCache, 
          result.sourceLanguage || detectedLanguage,
          result.isReverse
        );
        
        // STEP 7: Track API usage for statistics
        if (window.maloumCacheManager && window.maloumCacheManager.incrementApiRequests) {
          const customPrompt = this.translator.getCustomPrompt ? this.translator.getCustomPrompt() : 'Default prompt';
          window.maloumCacheManager.incrementApiRequests(messageText, customPrompt, result.translation);
        }
        
      } else {
        console.error('❌ API FAILED:', result?.error);
        this.showToast(this.getUserFriendlyErrorMessage(result?.error), 'error');
        translateBtn.innerHTML = '<span class="translate-icon">🔄</span>English';
        translateBtn.disabled = false;
      }
    } catch (error) {
      console.error('❌ MESSAGE TRANSLATION ERROR:', error);
      this.showToast(this.getUserFriendlyErrorMessage(error.message), 'error');
      const translateBtn = buttonContainer.querySelector('.maloum-translate-btn-msg');
      if (translateBtn) {
        translateBtn.innerHTML = '<span class="translate-icon">🔄</span>English';
        translateBtn.disabled = false;
      }
    }
  }
// ADD THIS RIGHT HERE:
// NEW: Conservative language detection method for messages
// Only skips translation if text is CLEARLY English to avoid mixed-language issues
detectMessageLanguage(text) {  
  // Basic text cleaning
  const cleanText = text.trim().toLowerCase();
  
  if (!cleanText || cleanText.length < 3) {
    return 'DE'; // Default to German for very short text
  }
  
  // CONSERVATIVE: Only very strong English indicators that rarely appear in German
  const strongEnglishIndicators = [
    // English-only grammatical patterns
    "i'm ", "you're ", "we're ", "they're ", "don't ", "can't ", "won't ",
    "isn't ", "aren't ", "wasn't ", "weren't ", "haven't ", "hasn't ", "doesn't ",
    " are you", " are we", " are they", "hello ", "hi ",
    
    // English-only word combinations  
    'how are you', 'nice to meet', 'good morning', 'good evening', 'good night',
    'thank you', 'see you', 'talk to you', 'miss you', 'love you',
    'how was your', 'what are you', 'where are you', 'when are you',
    
    // English sentence starters that are never German
    'i hope', 'i think', 'i feel', 'i want', 'i need', 'i love',
    'you look', 'you seem', 'you sound', 'this is', 'that was',
  ];
  
  // Strong German indicators (definitive German words)
  const strongGermanIndicators = [
    // German-only words that never appear in English
    'ich ', 'du ', 'der ', 'die ', 'das ', 'und ', 'mit ', 'für ', 'auf ',
    'nicht ', 'aber ', 'oder ', 'wenn ', 'dass ', 'wie ', 'was ', 'wer ', 'wo ',
    'auch ', 'noch ', 'nur ', 'sehr ', 'mehr ', 'heute ', 'morgen ',
    
    // German-specific characters and patterns
    'ß', 'ä', 'ö', 'ü', 
    ' sich ', ' wird ', ' kann ', ' soll ', ' muss ', ' dich ', ' mich ',
    ' bin ', ' bist ', ' ist ', ' sind ', ' war ', ' waren ',
    ' habe ', ' hast ', ' hat ', ' haben ', ' hatte ', ' hätte ',
    
    // German phrases that are never English
    'wie geht', 'guten morgen', 'gute nacht', 'schönen tag', 'bis bald',
    'freue mich', 'vermisse dich', 'liebe dich', 'bei dir', 'mit dir',
  ];
  
  // Count strong indicators only
  let strongEnglishCount = 0;
  let strongGermanCount = 0;
  
  // Check for strong English indicators
  for (const indicator of strongEnglishIndicators) {
    if (cleanText.includes(indicator)) {
      strongEnglishCount++;
    }
  }
  
  // Check for strong German indicators  
  for (const indicator of strongGermanIndicators) {
    if (cleanText.includes(indicator)) {
      strongGermanCount++;
    }
  }
  
  // Additional pattern checks
  const hasEnglishVerb = /\\b(i|you|we|they)\\s+(am|are|is|was|were|have|has|had|will|would|can|could|should|do|does|did)\\b/i.test(cleanText);
  const hasGermanVerb = /\\b(ich|du|er|sie|es|wir|ihr)\\s+(bin|bist|ist|sind|war|waren|habe|hast|hat|haben)\\b/i.test(cleanText);
  
  if (hasEnglishVerb) strongEnglishCount++;
  if (hasGermanVerb) strongGermanCount++;
  
  
  if (strongGermanCount > 0) {
    return 'DE';
  }
  
  if (strongEnglishCount >= 2 && strongGermanCount === 0) {
    return 'EN'; 
  } 
  
  // For everything else (ambiguous, unknown, mixed), default to German for translation
  return 'DE';
}
// NEW: Conservative language detection method for messages
// Only skips translation if text is CLEARLY English to avoid mixed-language issues
detectMessageLanguage(text) {
  
  // Basic text cleaning
  const cleanText = text.trim().toLowerCase();
  
  if (!cleanText || cleanText.length < 3) {
    return 'DE'; // Default to German for very short text
  }
  
  // CONSERVATIVE: Only very strong English indicators that rarely appear in German
  const strongEnglishIndicators = [
    // English-only grammatical patterns
    "i'm ", "you're ", "we're ", "they're ", "don't ", "can't ", "won't ",
    "isn't ", "aren't ", "wasn't ", "weren't ", "haven't ", "hasn't ", "doesn't ",
    " are you", " are we", " are they", " do you", " did you", " will you",
    
    // English-only word combinations  
    'how are you', 'nice to meet', 'good morning', 'good evening', 'good night',
    'thank you', 'see you', 'talk to you', 'miss you', 'love you',
    'how was your', 'what are you', 'where are you', 'when are you',
    ' to you', ' with you', ' for you', ' about you', ' like it when', 'how are', 'hello', 'hi',
    
    // English sentence starters that are never German
    'i hope', 'i think', 'i feel', 'i want', 'i need', 'i love',
    'you look', 'you seem', 'you sound', 'this is', 'that was',
    ' here too', ' each other', ' get to know',
  ];
  
  // Strong German indicators (definitive German words)
  const strongGermanIndicators = [
    // German-only words that never appear in English
    'ich ', 'du ', 'der ', 'die ', 'das ', 'und ', 'mit ', 'für ', 'auf ',
    'nicht ', 'aber ', 'oder ', 'wenn ', 'dass ', 'wie ', 'was ', 'wer ', 'wo ',
    'auch ', 'noch ', 'nur ', 'sehr ', 'mehr ', 'heute ', 'morgen ',
    
    // German-specific characters and patterns
    'ß', 'ä', 'ö', 'ü', 
    ' sich ', ' wird ', ' kann ', ' soll ', ' muss ', ' dich ', ' mich ',
    ' bin ', ' bist ', ' ist ', ' sind ', ' war ', ' waren ',
    ' habe ', ' hast ', ' hat ', ' haben ', ' hatte ', ' hätte ',
    
    // German phrases that are never English
    'wie geht', 'guten morgen', 'gute nacht', 'schönen tag', 'bis bald',
    'freue mich', 'vermisse dich', 'liebe dich', 'bei dir', 'mit dir',
  ];
  
  // Count strong indicators only
  let strongEnglishCount = 0;
  let strongGermanCount = 0;
  
  // Check for strong English indicators
  for (const indicator of strongEnglishIndicators) {
    if (cleanText.includes(indicator)) {
      strongEnglishCount++;
    }
  }
  
  // Check for strong German indicators  
  for (const indicator of strongGermanIndicators) {
    if (cleanText.includes(indicator)) {
      strongGermanCount++;
    }
  }
  
  // Additional pattern checks
  const hasEnglishVerb = /\\b(i|you|we|they)\\s+(am|are|is|was|were|have|has|had|will|would|can|could|should|do|does|did)\\b/i.test(cleanText);
  const hasGermanVerb = /\\b(ich|du|er|sie|es|wir|ihr)\\s+(bin|bist|ist|sind|war|waren|habe|hast|hat|haben)\\b/i.test(cleanText);
  
  if (hasEnglishVerb) strongEnglishCount++;
  if (hasGermanVerb) strongGermanCount++;
  
  
  // ULTRA-CONSERVATIVE DECISION: Only classify as English if:
  // 1. Strong English indicators found AND
  // 2. ZERO German indicators found (even one German word means translate) AND  
  // 3. Text has multiple English indicators (not just one word)
  
  if (strongGermanCount > 0) {
    return 'DE';
  }
  
  if (strongEnglishCount >= 2 && strongGermanCount === 0) {
    return 'EN'; 
  } 
  
  // For everything else (ambiguous, unknown, mixed), default to German for translation
  return 'DE';
}

  // FIXED: Save to cache for messages with EN↔DE validation
  async saveToCacheForMessage(originalText, translatedText, sourceLanguage, targetLanguage, messageType) {
    try {
      
      // Normalize source language (AUTO detection result)
      let normalizedSource = sourceLanguage;
      if (!sourceLanguage || sourceLanguage === 'AUTO' || sourceLanguage === 'auto') {
        // If target is EN, source is probably DE, and vice versa
        normalizedSource = (targetLanguage === 'EN') ? 'DE' : 'EN';
      }
      
      // Only save EN↔DE pairs
      if (!((normalizedSource === 'EN' && targetLanguage === 'DE') || (normalizedSource === 'DE' && targetLanguage === 'EN'))) {
        return false;
      }
      
      // Save to cache manager
      if (window.maloumCacheManager && window.maloumCacheManager.initialized) {
        const success = await window.maloumCacheManager.storeCachedTranslation(
          null, // Let it generate the cache key
          originalText,
          translatedText,
          normalizedSource,
          targetLanguage,
          messageType
        );
        
        if (success) {
        } else {
          console.warn(`⚠️ FIXED: Failed to save message translation to cache manager`);
        }
        
        return success;
      }
      
      // Save to translator cache as fallback
      if (this.translator && this.translator.saveTranslationToCache) {
        const success = await this.translator.saveTranslationToCache(
          originalText,
          translatedText,
          normalizedSource,
          targetLanguage,
          messageType
        );
        
        if (success) {
        }
        
        return success;
      }
      
      console.warn(`⚠️ FIXED: No cache storage available for message translation`);
      return false;
      
    } catch (error) {
      console.error('❌ FIXED: Error saving message translation to cache:', error);
      return false;
    }
  }

  // Enhanced translation display
// Replace ONLY the first few lines of your showTranslation method
// Keep everything else exactly the same as your original

showTranslation(messageElement, translatedText, messageType, buttonContainer, cacheKey, fromCache, sourceLanguage, isReverseTranslation = false) {
  try {
    // MINIMAL FIX: Enhanced container finding for captions/comments
      let messageContainer = messageElement.closest('div[class*="max-w-[70%]"]');
      if (!messageContainer) {
        messageContainer = messageElement.parentElement;
      }
    
    // If not found (captions/comments), use parent element
    if (!messageContainer) {
      messageContainer = messageElement.parentElement;
    }
    
    if (!messageContainer || messageContainer.querySelector('.maloum-translation')) return;

    if (buttonContainer) buttonContainer.remove();

    // KEEP ALL THE REST OF YOUR ORIGINAL CODE EXACTLY THE SAME
    const translationDiv = document.createElement('div');
    translationDiv.className = 'maloum-translation';
    
    const isSkipped = cacheKey === 'skipped';
    const borderColor = isSkipped ? '#f59e0b' : '#f43e06';
    const bgColor = isSkipped ? 'rgba(245, 158, 11, 0.3)' : 
                   isReverseTranslation ? 'rgba(244, 60, 4, 0.5)' : 'rgba(255,146,112,255)';
    translationDiv.style.cssText = `
      margin-top: 4px; 
      padding: 12px 25px 6px 5px; 
      border-left: 2px solid ${borderColor}; 
      background-color: ${bgColor}; 
      border-radius: 3px; 
      font-family: Roboto; 
      font-size: 16px;
      line-height: 1.2; 
      color: rgb(22, 21, 21); 
      font-style: normal;
      position: relative;
    `;

    const translationText = document.createElement('span');
    translationText.textContent = translatedText;
    translationDiv.appendChild(translationText);

    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = `display: flex; gap: 8px; margin-top: 4px; align-items: center;`;


    const targetIndicator = document.createElement('span');
    targetIndicator.style.cssText = `font-size: 10px; color: rgba(0, 0, 0, 0.7); font-weight: bold;`;
 
    controlsDiv.appendChild(targetIndicator);



const removeBtn = document.createElement('button');
removeBtn.textContent = '×';
removeBtn.style.cssText = `
  position: absolute;
  top: 0px;
  right: 0px;
  width: 18px;
  height: 18px;
  background: transparent;
  color: rgba(0, 0, 0, 0.5); 
  border: none; 
  border-radius: 50%; 
  cursor: pointer; 
  font-size: 17px;
  font-weight: bold;
  opacity: 0.7;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 10;
`;

removeBtn.addEventListener('mouseenter', () => {
removeBtn.style.background = 'linear-gradient(180deg,rgb(247, 82, 5), #fca5a5)';
removeBtn.style.rotate = '350deg';
  removeBtn.style.opacity = '1';
  removeBtn.style.transform = 'scale(1.1)';
});

removeBtn.addEventListener('mouseleave', () => {
  removeBtn.style.background = 'transparent';
  removeBtn.style.rotate = '-360deg';
  removeBtn.style.opacity = '0.7';
  removeBtn.style.transform = 'scale(1)';
});

// KEEP YOUR EXACT ORIGINAL CLICK FUNCTIONALITY
removeBtn.addEventListener('click', () => {
  translationDiv.remove();
  this.addTranslateButtonToMessage(messageElement, messageElement.textContent.trim());
});

    controlsDiv.appendChild(removeBtn);
    translationDiv.appendChild(controlsDiv);
    
    // MINIMAL FIX: Enhanced insertion logic
    const messageContent = messageContainer.querySelector('.group.flex.flex-col.justify-center');
    if (messageContent) {
      // Regular message - use your original logic
      messageContent.appendChild(translationDiv);
    } else {
      // Caption/comment - just append to container
      messageContainer.appendChild(translationDiv);
    }
  } catch (error) {
    console.error('Error showing translation:', error);
  }
}

  // Detect message type based on container styling
  detectMessageType(messageElement) {
    try {
      let messageContainer = messageElement.closest('div[class*="max-w-[70%]"]');
      if (!messageContainer) {
        messageContainer = messageElement.parentElement;
      }
      if (!messageContainer) return 'incoming';
      
      const classString = messageContainer.className;
      
      // Check for background color to determine if sent or received
      if (classString.includes('bg-beige-400')) {
        return 'outgoing'; // Sent messages (beige background)
      } else if (classString.includes('bg-gray-100')) {
        return 'incoming'; // Received messages (gray background)
      }
      
      // Fallback: check border radius patterns
      if (classString.includes('rounded-br-[1.5rem]')) {
        return 'incoming'; // Received messages have bottom-right radius
      } else if (classString.includes('rounded-l-[1.5rem]')) {
        return 'outgoing'; // Sent messages have left radius
      }
      
      return 'incoming'; // Default
    } catch (error) {
      console.warn('Error detecting message type:', error);
      return 'incoming';
    }
  }

  // Keyboard shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle escape if NO UI managers are open
      if (e.key === 'Escape') {
        const anyUIOpen = window.maloumUIManager?.activeUI !== null;
        if (!anyUIOpen) {
          e.preventDefault();
          this.closeAllPickers();
          return;
        }
      }

      if (!e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault();
          this.triggerTranslate();
          break;
        case 'k':
          e.preventDefault();
          this.openCache();
          break;
        case 'l':
          e.preventDefault();
          this.openEmoji();
          break;
        case 'm':
          e.preventDefault();
          this.focusTextarea();
          break;
        case 'g':
          e.preventDefault();
          this.openGalleryVault();
          break;
      }
    });
  }


  triggerTranslate() {
    const translateBtn = this.getCachedElement(this.selectors.translateBtn);
    if (translateBtn && !translateBtn.disabled) {
      translateBtn.click();
    }
  }

  openCache() {
    if (window.maloumCacheManager?.initialized) {
      window.maloumCacheManager.showCacheUI(); // This will now toggle properly
    } else {
      this.showToast('Cache manager not ready', 'error');
    }
  }

  openEmoji() {
    const textarea = this.getCachedElement(this.selectors.textarea);
    const emojiBtn = this.getCachedElement(this.selectors.emojiBtn);
    
    if (textarea && emojiBtn && window.maloumEmojiManager && !window.maloumEmojiManager.isPickerOpen) {
      window.maloumEmojiManager.openEmojiPicker(textarea, emojiBtn);
    }
  }

  focusTextarea() {
    const textarea = this.getCachedElement(this.selectors.textarea);
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      this.showToast('Ready to type!', 'success');
    }
  }
openGalleryVault() {
  // Find the Gallery Vault button using the SVG path you provided
  const galleryButton = document.querySelector('button svg[viewBox="0 0 24 24"] path[d*="m2.25 15.75"]')?.closest('button');
  
  if (galleryButton && !galleryButton.disabled) {
    galleryButton.click();
    this.showToast('Gallery Vault opened!', 'success');
  } else {
    this.showToast('Gallery Vault button not found', 'error');
  }
  }

  closeAllPickers() {
    if (window.maloumEmojiManager?.isPickerOpen) {
      window.maloumEmojiManager.closeEmojiPicker();
    }
    
    const cacheUI = document.getElementById('maloum-cache-ui') || document.getElementById('maloum-cache-backdrop');
    if (cacheUI) {
      cacheUI.remove();
    }
  }

  triggerTextareaEvents(textarea) {
    const inputEvent = new Event('input', { bubbles: true });
    const changeEvent = new Event('change', { bubbles: true });
    textarea.dispatchEvent(inputEvent);
    textarea.dispatchEvent(changeEvent);
  }

  updatePerformanceMetrics(time) {
    this.performanceMetrics.translationsCount++;
    this.performanceMetrics.averageTime = 
      (this.performanceMetrics.averageTime * (this.performanceMetrics.translationsCount - 1) + time) / 
      this.performanceMetrics.translationsCount;
    
    if (time < this.performanceMetrics.fastestTime) {
      this.performanceMetrics.fastestTime = time;
    }
    if (time > this.performanceMetrics.slowestTime) {
      this.performanceMetrics.slowestTime = time;
    }
  }

  getCachedElement(selector, useCache = true) {
    if (!useCache) {
      return document.querySelector(selector);
    }
    
    const now = Date.now();
    const cached = this.domCache.get(selector);
    
    if (cached && (now - cached.timestamp) < this.domCacheTimeout && cached.element && cached.element.isConnected) {
      return cached.element;
    }
    
    const element = document.querySelector(selector);
    if (element) {
      this.domCache.set(selector, {
        element,
        timestamp: now
      });
    }
    
    return element;
  }

  debounce(key, func, delay = 100) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    
    const timer = setTimeout(() => {
      try {
        func();
      } catch (error) {
        console.error('Error in debounced function:', error);
      }
      this.debounceTimers.delete(key);
    }, delay);
    
    this.debounceTimers.set(key, timer);
  }

  getUserFriendlyErrorMessage(errorMessage) {
    if (!errorMessage) return 'Unknown error occurred';
    
    const message = errorMessage.toLowerCase();
    
    if (message.includes('timeout')) {
      return 'Translation is taking too long. Please try again.';
    }
    
    if (message.includes('api key') || message.includes('authentication')) {
      return 'Please check your API key in the extension popup.';
    }
    
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return 'Network connection issue. Please check your internet.';
    }
    
    if (message.includes('invalid') && message.includes('format')) {
      return 'Invalid text format for translation.';
    }
    
    if (message.includes('empty') || message.includes('missing')) {
      return 'Please enter some text to translate.';
    }
    
    if (message.includes('skip') || message.includes('pattern')) {
      return 'Text type not suitable for translation.';
    }
    
    if (!message.includes('error') && !message.includes('failed') && message.length < 100) {
      return errorMessage;
    }
    // ADD these lines to your existing getUserFriendlyErrorMessage method:
    if (message.includes('500') || message.includes('Translation API error')) {
      return 'Together.xyz servers are temporarily unavailable. Retrying automatically...';
    }

    if (message.includes('multiple attempts')) {
      return 'Translation failed after multiple retries. Please wait a moment and try again.';
    }
    
    return 'Translation failed. Please try again or check your connection.';
  }

  showToast(message, type = 'info') {
    try {
      const existingToasts = document.querySelectorAll('.maloum-toast');
      existingToasts.forEach(toast => toast.remove());
      
      const toast = document.createElement('div');
      toast.className = 'maloum-toast';
      toast.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        padding: 12px 16px !important;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'} !important;
        color: white !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        z-index: 10001 !important;
        transition: all 0.3s ease !important;
        transform: translateX(100%) !important;
        opacity: 0 !important;
      `;
      
      toast.textContent = message;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
      }, 10);
      
      setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 3000);
    } catch (error) {
      console.warn('Error showing toast:', error);
    }
  }

  getPerformanceStats() {
    const translatorStats = this.translator?.getPerformanceStats() || {};
    
    return {
      ...this.performanceMetrics,
      domCacheSize: this.domCache.size,
      processedMessages: this.processedMessages.size,
      activeDebounceTimers: this.debounceTimers.size,
      authenticationReady: this.authenticationReady,
      targetPerformance: '<2 seconds',
      translatorStats: translatorStats
    };
  }

  clearPerformanceCaches() {
    this.domCache.clear();
    this.debounceTimers.clear();
    this.processedMessages.clear();
    this.performanceMetrics = {
      translationsCount: 0,
      averageTime: 0,
      fastestTime: Infinity,
      slowestTime: 0
    };
    
    if (this.translator?.clearQuickCache) {
      this.translator.clearQuickCache();
    }
    
  }

  setupDebugFunctions() {
    const self = this;
    
    window.debugOptimizedHandler = {
      restart: () => {
        initializeOptimizedHandler();
      },
      
      getInstance: () => {
        return self;
      },
      
      getTranslator: () => {
        return self?.translator;
      },
      
      getPerformanceStats: () => {
        if (self) {
          const stats = self.getPerformanceStats();
          return stats;
        }
        return null;
      },
      
      testMessageTranslation: async (text = "Hallo, wie geht es dir?") => {
        const startTime = performance.now();
        
        if (self?.translator) {
          try {
            // FORCE translation to English regardless of input language
            const result = await self.translator.translate(text, 'EN', 'AUTO', 'message');
            const duration = performance.now() - startTime;
            
            return { duration, result, targetAchieved: duration < 2000 };
          } catch (error) {
            const duration = performance.now() - startTime;
            return { duration, error: error.message, targetAchieved: false };
          }
        } else {
          return null;
        }
      },
      
      testTextareaTranslation: async (text = "Hello, how are you?") => {
        const startTime = performance.now();
        
        if (self?.translator) {
          try {
            const result = await self.translator.translate(text, self.targetLanguage, 'EN', 'textarea');
            const duration = performance.now() - startTime;
            
            
            return { duration, result, targetAchieved: duration < 2000 };
          } catch (error) {
            const duration = performance.now() - startTime;
            return { duration, error: error.message, targetAchieved: false };
          }
        } else {
          return null;
        }
      },
      
      clearCaches: () => {
        if (self) {
          self.clearPerformanceCaches();
        }
        
        if (self?.translator?.clearQuickCache) {
          self.translator.clearQuickCache();
        }
        
        if (typeof chrome !== 'undefined' && chrome?.runtime) {
          chrome.runtime.sendMessage({ action: 'clearCaches' }).catch(() => {
          });
        }
      },
      
      checkAuth: () => {
        const authStatus = window.firebaseApiKeyHandler?.isAuthenticated || false;
        return authStatus;
      },

      testAuthFlow: async () => {
        
        if (!window.firebaseApiKeyHandler) {
          return false;
        }
        
        const isAuth = window.firebaseApiKeyHandler.isAuthenticated;
        
        if (!self?.translator) {
          return false;
        }
        
        if (isAuth) {
          try {
            const testResult = await self.translator.translate('Hello', 'EN', 'AUTO', 'message');
            return true;
          } catch (error) {
            return false;
          }
        } else {
          return false;
        }
      },

      checkAllComponents: () => {
        
        const components = {
          messageHandler: !!self,
          messageHandlerInitialized: self?.isInitialized || false,
          translator: !!self?.translator,
          authHandler: !!window.firebaseApiKeyHandler,
          cacheManager: !!window.maloumCacheManager,
          emojiManager: !!window.maloumEmojiManager,
          isAuthenticated: window.firebaseApiKeyHandler?.isAuthenticated || false,
          hasTextarea: !!document.querySelector('textarea[placeholder="Write a message"]'),
          hasTranslateButton: !!document.getElementById('maloum-translate-btn'),
          MaloumTranslatorClass: !!window.MaloumTranslator,
          currentDomain: window.location.hostname,
          debugFunctionsReady: true,
          messageTranslationTarget: 'English (FORCED)',
          textareaTranslationTarget: self?.targetLanguage || 'German'
        };
        
        
        if (!components.messageHandler) {
          console.warn('⚠️ Message handler not found - script may not have loaded properly');
        }
        if (!components.translator && components.messageHandler) {
          console.warn('⚠️ Translator not created - check MaloumTranslator class availability');
        }
        if (!components.isAuthenticated) {
          console.warn('⚠️ Not authenticated - check API key setup in popup');
        }
        
        return components;
      },
      
      diagnose: () => {
        
        const diagnosis = {
          timestamp: new Date().toISOString(),
          domain: window.location.hostname,
          url: window.location.href,
          scriptLoadOrder: {
            firebaseHandler: !!window.firebaseApiKeyHandler,
            cacheStorage: !!window.MaloumCacheStorage,
            cacheManager: !!window.maloumCacheManager,
            emojiManager: !!window.maloumEmojiManager,
            translator: !!window.MaloumTranslator,
            optimizedHandler: !!self
          },
          translationBehavior: {
            messages: 'ALWAYS translate to English regardless of source language',
            textarea: `Translate from English to ${self?.targetLanguage || 'German'}`,
            buttonLabels: 'Message buttons show "English", textarea shows target language'
          },
          cacheIntegration: {
            cacheManagerAvailable: !!window.maloumCacheManager,
            cacheManagerInitialized: window.maloumCacheManager?.initialized || false,
            translatorCacheEnabled: !!(self?.translator?.checkCache),
            onlyEnDeSupported: 'EN↔DE translations only'
          },
          errors: [],
          warnings: []
        };
        
        if (!window.location.hostname.includes('maloum.com')) {
          diagnosis.warnings.push('Not on maloum.com domain');
        }
        
        if (!window.MaloumTranslator) {
          diagnosis.errors.push('MaloumTranslator class not loaded');
        }
        
        if (!window.firebaseApiKeyHandler) {
          diagnosis.warnings.push('Firebase API key handler not loaded');
        }
        
        if (!window.maloumCacheManager?.initialized) {
          diagnosis.warnings.push('Cache manager not properly initialized');
        }
        
        return diagnosis;
      },

      testChatDetection: () => {
        
        const messageElements = self.findChatMessages(document);
        
        messageElements.forEach((element, index) => {
          const isValid = self.isValidChatMessage(element);
          const messageType = self.detectMessageType(element);
          const text = element.textContent.trim();
          
        });
        
        return { messageCount: messageElements.length, elements: messageElements };
      },

      forceProcessMessages: () => {
        self.processedMessages.clear();
        self.processExistingMessages();
      },

      // FIXED: Test cache integration specifically
      testCacheIntegration: async () => {
        
        const testData = {
          textareaTest: {
            originalText: 'Hello world',
            expectedTarget: 'DE',
            expectedSource: 'EN'
          },
          messageTest: {
            originalText: 'Hallo Welt',
            expectedTarget: 'EN',
            expectedSource: 'DE'
          }
        };

        const results = {
          cacheManagerAvailable: !!window.maloumCacheManager,
          cacheManagerInitialized: window.maloumCacheManager?.initialized || false,
          textareaCacheTest: null,
          messageCacheTest: null
        };

        // Test textarea cache
        try {
          const textareaResult = await self.checkCacheForTextarea(testData.textareaTest.originalText, testData.textareaTest.expectedTarget);
          results.textareaCacheTest = {
            found: textareaResult.found,
            translation: textareaResult.translation,
            sourceLanguage: textareaResult.sourceLanguage,
            targetLanguage: textareaResult.targetLanguage || testData.textareaTest.expectedTarget
          };
        } catch (error) {
          results.textareaCacheTest = { error: error.message };
          console.error('❌ Textarea cache test failed:', error);
        }

        // Test message cache  
        try {
          const messageResult = await self.checkCacheForMessage(testData.messageTest.originalText);
          results.messageCacheTest = {
            found: messageResult.found,
            translation: messageResult.translation,
            sourceLanguage: messageResult.sourceLanguage,
            targetLanguage: messageResult.targetLanguage || testData.messageTest.expectedTarget
          };
        } catch (error) {
          results.messageCacheTest = { error: error.message };
          console.error('❌ Message cache test failed:', error);
        }

        return results;
      },

      // FIXED: Test cache saving specifically  
      testCacheSaving: async () => {
        
        const testTranslations = [
          {
            type: 'textarea',
            originalText: 'Test message for textarea',
            translatedText: 'Testnachricht für Textarea',
            sourceLanguage: 'EN',
            targetLanguage: 'DE',
            messageType: 'textarea'
          },
          {
            type: 'message',
            originalText: 'Test Nachricht für Message', 
            translatedText: 'Test message for message',
            sourceLanguage: 'DE',
            targetLanguage: 'EN',
            messageType: 'message'
          }
        ];

        const results = [];

        for (const test of testTranslations) {
          try {
            let success = false;
            
            if (test.type === 'textarea') {
              success = await self.saveToCacheForTextarea(
                test.originalText,
                test.translatedText, 
                test.sourceLanguage,
                test.targetLanguage,
                test.messageType
              );
            } else {
              success = await self.saveToCacheForMessage(
                test.originalText,
                test.translatedText,
                test.sourceLanguage, 
                test.targetLanguage,
                test.messageType
              );
            }
            
            results.push({
              type: test.type,
              success: success,
              originalText: test.originalText,
              translatedText: test.translatedText,
              languagePair: `${test.sourceLanguage} → ${test.targetLanguage}`
            });
            
            
          } catch (error) {
            results.push({
              type: test.type,
              success: false,
              error: error.message,
              originalText: test.originalText,
              languagePair: `${test.sourceLanguage} → ${test.targetLanguage}`
            });
            console.error(`❌ ${test.type} cache save failed:`, error);
          }
        }

        return results;
      }
    };
    
  }

  destroy() {
    try {
      // Clear all debounce timers
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();
      
      // Clear DOM cache
      this.domCache.clear();
      
      // Clear processed messages
      this.processedMessages.clear();
      
      // Remove textarea event listeners if textarea exists
      const textarea = document.querySelector(this.selectors.textarea);
      if (textarea && this.textareaEventListeners) {
        // We'll need to track the listeners to remove them
        // These were added in startTextareaMonitoring but not tracked for removal
        console.log('🔍 Need to remove textarea event listeners'); 
      }
      
      // Clear any intervals that might have been set (like textarea monitoring interval)
      if (this.textareaIntervalId) {
        clearInterval(this.textareaIntervalId);
        console.log('🧹 Cleared textarea monitoring interval');
      }
      
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }

  // NEW: Add message to batch queue instead of translating immediately
  async addToBatchQueue(messageElement, messageText, messageType) {
    // Check if batch translation is enabled
    if (!this.batchConfig.enabled) {
      // Fall back to individual translation
      return this.handleAutoMessageTranslation(messageElement, messageText, messageType);
    }

    console.log(`📦 Adding message to batch queue: "${messageText.substring(0, 30)}..."`);

    // Add to queue
    this.batchQueue.push({
      element: messageElement,
      text: messageText,
      type: messageType,
      targetLang: 'EN',
      sourceLang: 'AUTO'
    });

    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Process immediately if batch is full
    if (this.batchQueue.length >= this.batchConfig.maxSize) {
      console.log(`📦 Batch queue full (${this.batchQueue.length}), processing immediately...`);
      await this.processBatchQueue();
      return;
    }

    // Otherwise, wait for timeout
    this.batchTimeout = setTimeout(() => {
      console.log(`⏰ Batch timeout reached, processing ${this.batchQueue.length} messages...`);
      this.processBatchQueue();
    }, this.batchConfig.timeoutMs);
  }

  // NEW: Process entire batch queue
  async processBatchQueue() {
    if (this.batchQueue.length === 0) {
      console.log('📦 Batch queue is empty, nothing to process');
      return;
    }

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    console.log(`📦 Processing batch of ${batch.length} messages`);

    // If only 1 message, use individual translation (no benefit to batching)
    if (batch.length === 1) {
      console.log('📦 Only 1 message in batch, using individual translation');
      const item = batch[0];
      await this.handleAutoMessageTranslation(item.element, item.text, item.type);
      return;
    }

    try {
      // Prepare messages array for batch API call
      const messagesArray = batch.map(item => ({
        text: item.text,
        element: item.element,
        type: item.type
      }));

      // Get custom prompt
      const customPrompt = this.translator?.getCustomPrompt?.() || undefined;

      // Call background script for batch translation
      const response = await chrome.runtime.sendMessage({
        action: 'batchTranslate',
        messagesArray: messagesArray,
        targetLang: 'EN',
        sourceLang: 'AUTO',
        customPrompt: customPrompt
      });

      if (response.success && response.translations) {
        console.log(`✅ Batch translation successful: ${response.translations.length} translations received`);

        // Process each translation
        for (let i = 0; i < batch.length; i++) {
          const item = batch[i];
          const translation = response.translations[i];

          if (translation) {
            // Detect source language
            const detectedLanguage = this.detectMessageLanguage(item.text);

            // Save to cache
            await this.saveToCacheForMessage(
              item.text,
              translation,
              detectedLanguage,
              'EN',
              item.type
            );

            // Show translation
            this.showTranslation(
              item.element,
              translation,
              item.type,
              null,
              'batch',
              false,
              detectedLanguage,
              false
            );
          }
        }

        // Track batch API usage - use numbered format as it was actually sent
        if (window.maloumCacheManager && window.maloumCacheManager.incrementApiRequests) {
          // Build the exact numbered format that was sent to the API
          const numberedInput = batch.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
          const numberedOutput = response.translations.map((t, i) => `${i + 1}. ${t}`).join('\n');

          console.log(`📊 Tracking batch API usage: ${batch.length} messages`);
          window.maloumCacheManager.incrementApiRequests(numberedInput, customPrompt || 'Default', numberedOutput);
        }

      } else {
        console.error('❌ Batch translation failed, falling back to individual translations');
        // Fall back to individual translations
        for (const item of batch) {
          await this.handleAutoMessageTranslation(item.element, item.text, item.type);
        }
      }

    } catch (error) {
      console.error('❌ Batch processing error, falling back to individual translations:', error);
      // Fall back to individual translations
      for (const item of batch) {
        await this.handleAutoMessageTranslation(item.element, item.text, item.type);
      }
    }
  }

  // NEW: Handle auto-message translation without button interface
  async handleAutoMessageTranslation(messageElement, messageText, messageType) {
    try {
      if (!this.translator) {
        console.warn('Translator not ready for auto-translation');
        return;
      }

      // STEP 1: CHECK CACHE FIRST
      const cacheResult = await this.checkCacheForMessage(messageText, false); // false = user-initiated

      if (cacheResult.found) {
        // Show translation immediately from cache
        this.showTranslation(
          messageElement,
          cacheResult.translation,
          messageType,
          null, // No button container for auto-translation
          cacheResult.cacheKey,
          true, // fromCache = true
          cacheResult.sourceLanguage,
          cacheResult.isReverse
        );
        return; // EXIT EARLY
      }

      // STEP 2: Language detection to determine if translation is needed
      const detectedLanguage = this.detectMessageLanguage(messageText);

      if (detectedLanguage === 'EN') {
        // Text is already in English - no need to show anything since we don't have buttons
        // Save to cache as EN→EN for future cache hits
        await this.saveToCacheForMessage(messageText, messageText, 'EN', 'EN', messageType);
        return;
      }

      // STEP 3: Text needs translation - call API
      const result = await this.translator.translate(messageText, 'EN', detectedLanguage, messageType);

      if (result && result.success) {
        // STEP 4: Save to cache with proper format
        await this.saveToCacheForMessage(messageText, result.translation, result.sourceLanguage || detectedLanguage, 'EN', messageType);

        // STEP 5: Show translation
        this.showTranslation(
          messageElement,
          result.translation,
          messageType,
          null, // No button container for auto-translation
          result.cacheKey,
          result.fromCache,
          result.sourceLanguage || detectedLanguage,
          result.isReverse
        );

        // STEP 6: Track API usage for statistics
        if (window.maloumCacheManager && window.maloumCacheManager.incrementApiRequests) {
          const customPrompt = this.translator.getCustomPrompt ? this.translator.getCustomPrompt() : 'Default prompt';
          window.maloumCacheManager.incrementApiRequests(messageText, customPrompt, result.translation);
        }

      } else {
        console.error('❌ Auto-translation API FAILED:', result?.error);
        // For auto-translation, we just fail silently rather than showing an error button
      }
    } catch (error) {
      console.error('❌ AUTO-MESSAGE TRANSLATION ERROR:', error);
      // For auto-translation, we just fail silently rather than showing an error button
    }
  }

  // Process existing user bios on page load
processExistingUserBios() {
  try {
    // Find all user bio elements with data-testid="user-bio"
    const bioElements = document.querySelectorAll('p[data-testid="user-bio"], div[data-testid="user-bio"], span[data-testid="user-bio"]');
    
    console.log(`🔍 Found ${bioElements.length} user bio elements on page load`);
    
    bioElements.forEach((bioElement, index) => {
      console.log(`🔍 Processing bio element ${index + 1}:`, bioElement.textContent.substring(0, 50) + '...');
      
      if (!this.processedMessages.has(bioElement) && this.isValidBioContent(bioElement)) {
        console.log(`✅ Bio element ${index + 1} is valid, processing...`);
        // Process the bio element with auto-translation
        this.processUserBioElement(bioElement);
      } else {
        console.log(`❌ Bio element ${index + 1} is invalid or already processed`);
      }
    });
  } catch (error) {
    console.error('Error processing existing user bios:', error);
  }
}

  // Process existing mass messages on page load
processExistingMassMessages() {
  try {
    // Find all mass message elements with class="text-sm"
    const messageElements = document.querySelectorAll('p[class="text-sm"], div[class="text-sm"], span[class="text-sm"]');
    
    console.log(`📢 Found ${messageElements.length} mass message elements on page load`);
    
    messageElements.forEach((messageElement, index) => {
      console.log(`📢 Processing mass message ${index + 1}:`, messageElement.textContent.substring(0, 50) + '...');
      
      if (!this.processedMessages.has(messageElement) && this.isValidMassMessageContent(messageElement)) {
        console.log(`✅ Mass message ${index + 1} is valid, processing...`);
        // Process the mass message with auto-translation
        this.processMassMessageElement(messageElement);
      } else {
        console.log(`❌ Mass message ${index + 1} is invalid or already processed`);
      }
    });
  } catch (error) {
    console.error('Error processing existing mass messages:', error);
  }
}

  // Check for new user bios in dynamically added content
checkForNewUserBios(node) {
  try {
    // Check if the node itself is a user bio
    if (this.isBioElement(node) && !this.processedMessages.has(node) && this.isValidBioContent(node)) {
      console.log('🆕 Found new user bio element (node itself):', node.textContent.substring(0, 50) + '...');
      this.processUserBioElement(node);
    }
    
    // Look for user bios within the node
    const bioElements = node.querySelectorAll('p[data-testid="user-bio"], div[data-testid="user-bio"], span[data-testid="user-bio"]');
    
    if (bioElements.length > 0) {
      console.log(`🔍 Found ${bioElements.length} new user bio elements within node`);
    }
    
    bioElements.forEach((bioElement, index) => {
      console.log(`🔍 Processing new bio element ${index + 1}:`, bioElement.textContent.substring(0, 50) + '...');
      
      if (!this.processedMessages.has(bioElement) && this.isValidBioContent(bioElement)) {
        console.log(`✅ New bio element ${index + 1} is valid, processing...`);
        this.processUserBioElement(bioElement);
      } else {
        console.log(`❌ New bio element ${index + 1} is invalid or already processed`);
      }
    });
  } catch (error) {
    console.warn('Error checking for new user bios:', error);
  }
}

  // Check for new mass messages in dynamically added content
checkForNewMassMessages(node) {
  try {
    // Check if the node itself is a mass message
    if (this.isMassMessageElement(node) && !this.processedMessages.has(node) && this.isValidMassMessageContent(node)) {
      console.log('🆕 Found new mass message element (node itself):', node.textContent.substring(0, 50) + '...');
      this.processMassMessageElement(node);
    }
    
    // Look for mass messages within the node
    const messageElements = node.querySelectorAll('p[class="text-sm"], div[class="text-sm"], span[class="text-sm"]');
    
    if (messageElements.length > 0) {
      console.log(`🔍 Found ${messageElements.length} new mass message elements within node`);
    }
    
    messageElements.forEach((messageElement, index) => {
      console.log(`🔍 Processing new mass message ${index + 1}:`, messageElement.textContent.substring(0, 50) + '...');
      
      if (!this.processedMessages.has(messageElement) && this.isValidMassMessageContent(messageElement)) {
        console.log(`✅ New mass message ${index + 1} is valid, processing...`);
        this.processMassMessageElement(messageElement);
      } else {
        console.log(`❌ New mass message ${index + 1} is invalid or already processed`);
      }
    });
  } catch (error) {
    console.warn('Error checking for new mass messages:', error);
  }
}

  // Check if an element is a user bio element
isBioElement(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
  
  // Check for data-testid attribute - this is the most reliable way
  const testId = element.getAttribute('data-testid');
  if (testId === 'user-bio') return true;
  
  // Additional check for class pattern commonly used for bios
  if (element.classList && element.classList.contains('notranslate')) {
    // Check if it has other characteristics of a bio element
    const textContent = element.textContent.trim();
    // Bio elements typically have longer text content
    if (textContent.length > 20) {
      // Check parent for bio-related classes
      const parent = element.parentElement;
      if (parent) {
        const parentClasses = parent.className;
        // Common parent patterns for user bios
        if (parentClasses.includes('bio') || parentClasses.includes('profile') || parentClasses.includes('user-info')) {
          return true;
        }
      }
    }
  }
  
  return false;
}

  // Validate if bio content should be translated
isValidBioContent(bioElement) {
  try {
    const bioText = bioElement.textContent.trim();
    
    // Accept ALL text content, even single characters
    if (!bioText) {
      return false;
    }
    
    // Check if this element should be excluded
    for (const excludeSelector of this.selectors.excludeSelectors) {
      if (bioElement.closest(excludeSelector)) {
        return false;
      }
    }
    
    // Only exclude very obvious system messages and pure numbers
    if (/^(joined|left|online|offline|typing|away|is typing|has joined|has left|connected|disconnected)$/i.test(bioText)) {
      return false;
    }
    
    // Exclude pure monetary amounts and timestamps
    if (/^\d+[.,]\d+\s*€$|^\d{2}\/\d{2}\/\d{4}$|^\d{2}:\d{2}$/.test(bioText)) {
      return false;
    }
    
    // Accept ALL other text including single words, names, short messages
    return true;
  } catch (error) {
    console.warn('Error validating bio content:', error);
    return false;
  }
}

  // Process individual user bio element with auto-translation
async processUserBioElement(bioElement) {
  try {
    if (this.processedMessages.has(bioElement)) {
      console.log('🔄 Bio element already processed, skipping');
      return;
    }
    
    this.processedMessages.add(bioElement);
    console.log('➕ Added bio element to processed set');

    const bioText = bioElement.textContent.trim();
    console.log('📝 Processing bio text:', bioText.substring(0, 50) + '...');
    
    // Check cache first for user bio translation (always to English)
    const cacheResult = await this.checkCacheForMessage(bioText, false); // false = user-initiated
    
    if (cacheResult.found) {
      console.log('⚡ Using cached translation for bio');
      this.showBioTranslation(bioElement, cacheResult.translation);
      return;
    }
    
    // Auto-translate the bio content
    console.log('🌐 Auto-translating bio content');
    await this.handleAutoBioTranslation(bioElement, bioText);
  } catch (error) {
    console.warn('Error processing user bio element:', error);
  }
}

  // Handle auto-translation for user bio content
async handleAutoBioTranslation(bioElement, bioText) {
  try {
    if (!this.translator) {
      console.warn('Translator not ready for auto-bio translation');
      return;
    }
    
    console.log('🔍 Checking cache for bio translation');
    
    // STEP 1: CHECK CACHE FIRST
    const cacheResult = await this.checkCacheForMessage(bioText, false); // false = user-initiated
    
    if (cacheResult.found) {
      console.log('⚡ Using cached translation for bio');
      // Show translation immediately from cache
      this.showBioTranslation(bioElement, cacheResult.translation);
      return; // EXIT EARLY
    }
    
    console.log('🌐 Detecting language for bio translation');
    
    // STEP 2: Language detection to determine if translation is needed
    const detectedLanguage = this.detectMessageLanguage(bioText);
    console.log('🌐 Detected language:', detectedLanguage);
    
    if (detectedLanguage === 'EN') {
      console.log('✅ Bio text is already in English, saving to cache');
      // Text is already in English - no need to show anything since we don't have buttons
      // Save to cache as EN→EN for future cache hits
      await this.saveToCacheForMessage(bioText, bioText, 'EN', 'EN', 'bio');
      return;
    }
    
    console.log('📤 Calling API for bio translation');
    
    // STEP 3: Text needs translation - call API
    const result = await this.translator.translate(bioText, 'EN', detectedLanguage, 'bio');
    
    if (result && result.success) {
      console.log('✅ Bio translation successful');
      
      // STEP 4: Save to cache with proper format
      await this.saveToCacheForMessage(bioText, result.translation, result.sourceLanguage || detectedLanguage, 'EN', 'bio');
      
      // STEP 5: Show translation
      this.showBioTranslation(bioElement, result.translation);
      
      // STEP 6: Track API usage for statistics
      if (window.maloumCacheManager && window.maloumCacheManager.incrementApiRequests) {
        const customPrompt = this.translator.getCustomPrompt ? this.translator.getCustomPrompt() : 'Default prompt';
        window.maloumCacheManager.incrementApiRequests(bioText, customPrompt, result.translation);
      }
      
    } else {
      console.error('❌ Auto-bio translation API FAILED:', result?.error);
      // For auto-translation, we just fail silently rather than showing an error button
    }
  } catch (error) {
    console.error('❌ AUTO-BIO TRANSLATION ERROR:', error);
    // For auto-translation, we just fail silently rather than showing an error button
  }
}

  // Display translation for user bio
showBioTranslation(bioElement, translatedText) {
  try {
    // Check if translation already exists
    if (bioElement.nextElementSibling && bioElement.nextElementSibling.classList.contains('maloum-bio-translation')) {
      return; // Translation already shown
    }
    
    // Create translation div
    const translationDiv = document.createElement('div');
    translationDiv.className = 'maloum-bio-translation';
    translationDiv.style.cssText = `
      margin-top: 8px; 
      padding: 12px 16px; 
      border-left: 3px solid #f43e06; 
      background-color: rgba(255,146,112,0.3); 
      border-radius: 6px; 
      font-family: Roboto; 
      font-size: 14px;
      line-height: 1.4; 
      color: rgb(22, 21, 21); 
      font-style: normal;
      position: relative;
    `;

    const translationText = document.createElement('span');
    translationText.textContent = translatedText;
    translationText.style.cssText = 'word-break: break-word;';
    translationDiv.appendChild(translationText);

    // Add controls
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = `display: flex; gap: 8px; margin-top: 8px; align-items: center;`;

    const targetIndicator = document.createElement('span');
    targetIndicator.textContent = 'EN';
    targetIndicator.style.cssText = `font-size: 10px; color: rgba(0, 0, 0, 0.7); font-weight: bold;`;
    controlsDiv.appendChild(targetIndicator);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      background: transparent;
      color: rgba(0, 0, 0, 0.5); 
      border: none; 
      border-radius: 50%; 
      cursor: pointer; 
      font-size: 18px;
      font-weight: bold;
      opacity: 0.7;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      z-index: 10;
    `;

    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.background = 'linear-gradient(180deg,rgb(247, 82, 5), #fca5a5)';
      removeBtn.style.rotate = '350deg';
      removeBtn.style.opacity = '1';
      removeBtn.style.transform = 'scale(1.1)';
    });

    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.background = 'transparent';
      removeBtn.style.rotate = '-360deg';
      removeBtn.style.opacity = '0.7';
      removeBtn.style.transform = 'scale(1)';
    });

    // Remove button click handler
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      translationDiv.remove();
      // Note: We don't re-add the original bio element since it's still there
    });

    controlsDiv.appendChild(removeBtn);
    translationDiv.appendChild(controlsDiv);
    
    // Insert translation after the bio element
    bioElement.parentNode.insertBefore(translationDiv, bioElement.nextSibling);
    
    console.log('✅ Bio translation displayed:', translatedText.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('Error showing bio translation:', error);
  }
}

  // Check if an element is a mass message element
isMassMessageElement(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
  
  // Check for class pattern commonly used for mass messages
  const className = element.className;
  if (className === 'text-sm') return true;
  
  return false;
}

  // Validate if mass message content should be translated
isValidMassMessageContent(messageElement) {
  try {
    const messageText = messageElement.textContent.trim();
    
    // Accept ALL text content, even single characters
    if (!messageText) {
      return false;
    }
    
    // Check if this element should be excluded
    for (const excludeSelector of this.selectors.excludeSelectors) {
      if (messageElement.closest(excludeSelector)) {
        return false;
      }
    }
    
    // Only exclude very obvious system messages and pure numbers
    if (/^(joined|left|online|offline|typing|away|is typing|has joined|has left|connected|disconnected)$/i.test(messageText)) {
      return false;
    }
    
    // Exclude pure monetary amounts and timestamps
    if (/^\d+[.,]\d+\s*€$|^\d{2}\/\d{2}\/\d{4}$|^\d{2}:\d{2}$/.test(messageText)) {
      return false;
    }
    
    // Accept ALL other text including single words, names, short messages
    return true;
  } catch (error) {
    console.warn('Error validating mass message content:', error);
    return false;
  }
}

  // Process individual mass message element with auto-translation
async processMassMessageElement(messageElement) {
  try {
    if (this.processedMessages.has(messageElement)) {
      console.log('🔄 Mass message element already processed, skipping');
      return;
    }
    
    this.processedMessages.add(messageElement);
    console.log('➕ Added mass message element to processed set');

    const messageText = messageElement.textContent.trim();
    console.log('📝 Processing mass message text:', messageText.substring(0, 50) + '...');
    
    // Check cache first for mass message translation (always to English)
    const cacheResult = await this.checkCacheForMessage(messageText, false); // false = user-initiated
    
    if (cacheResult.found) {
      console.log('⚡ Using cached translation for mass message');
      this.showMassMessageTranslation(messageElement, cacheResult.translation);
      return;
    }
    
    // Auto-translate the mass message content
    console.log('🌐 Auto-translating mass message content');
    await this.handleAutoMassMessageTranslation(messageElement, messageText);
  } catch (error) {
    console.warn('Error processing mass message element:', error);
  }
}

  // Handle auto-translation for mass message content
async handleAutoMassMessageTranslation(messageElement, messageText) {
  try {
    if (!this.translator) {
      console.warn('Translator not ready for auto-mass message translation');
      return;
    }
    
    console.log('🔍 Checking cache for mass message translation');
    
    // STEP 1: CHECK CACHE FIRST
    const cacheResult = await this.checkCacheForMessage(messageText, false); // false = user-initiated
    
    if (cacheResult.found) {
      console.log('⚡ Using cached translation for mass message');
      // Show translation immediately from cache
      this.showMassMessageTranslation(messageElement, cacheResult.translation);
      return; // EXIT EARLY
    }
    
    console.log('🌐 Detecting language for mass message translation');
    
    // STEP 2: Language detection to determine if translation is needed
    const detectedLanguage = this.detectMessageLanguage(messageText);
    console.log('🌐 Detected language:', detectedLanguage);
    
    if (detectedLanguage === 'EN') {
      console.log('✅ Mass message text is already in English, saving to cache');
      // Text is already in English - no need to show anything since we don't have buttons
      // Save to cache as EN→EN for future cache hits
      await this.saveToCacheForMessage(messageText, messageText, 'EN', 'EN', 'mass_message');
      return;
    }
    
    console.log('📤 Calling API for mass message translation');
    
    // STEP 3: Text needs translation - call API
    const result = await this.translator.translate(messageText, 'EN', detectedLanguage, 'mass_message');
    
    if (result && result.success) {
      console.log('✅ Mass message translation successful');
      
      // STEP 4: Save to cache with proper format
      await this.saveToCacheForMessage(messageText, result.translation, result.sourceLanguage || detectedLanguage, 'EN', 'mass_message');
      
      // STEP 5: Show translation
      this.showMassMessageTranslation(messageElement, result.translation);
      
      // STEP 6: Track API usage for statistics
      if (window.maloumCacheManager && window.maloumCacheManager.incrementApiRequests) {
        const customPrompt = this.translator.getCustomPrompt ? this.translator.getCustomPrompt() : 'Default prompt';
        window.maloumCacheManager.incrementApiRequests(messageText, customPrompt, result.translation);
      }
      
    } else {
      console.error('❌ Auto-mass message translation API FAILED:', result?.error);
      // For auto-translation, we just fail silently rather than showing an error button
    }
  } catch (error) {
    console.error('❌ AUTO-MASS MESSAGE TRANSLATION ERROR:', error);
    // For auto-translation, we just fail silently rather than showing an error button
  }
}

  // Display translation for mass messages
showMassMessageTranslation(messageElement, translatedText) {
  try {
    // Check if translation already exists
    if (messageElement.nextElementSibling && messageElement.nextElementSibling.classList.contains('maloum-mass-message-translation')) {
      return; // Translation already shown
    }
    
    // Create translation div
    const translationDiv = document.createElement('div');
    translationDiv.className = 'maloum-mass-message-translation';
    translationDiv.style.cssText = `
      margin-top: 8px; 
      padding: 12px 16px; 
      border-left: 3px solid #f43e06; 
      background-color: rgba(255,146,112,0.3); 
      border-radius: 6px; 
      font-family: Roboto; 
      font-size: 14px;
      line-height: 1.4; 
      color: rgb(22, 21, 21); 
      font-style: normal;
      position: relative;
    `;

    const translationText = document.createElement('span');
    translationText.textContent = translatedText;
    translationText.style.cssText = 'word-break: break-word;';
    translationDiv.appendChild(translationText);

    // Add controls
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = `display: flex; gap: 8px; margin-top: 8px; align-items: center;`;

    const targetIndicator = document.createElement('span');
    targetIndicator.textContent = 'EN';
    targetIndicator.style.cssText = `font-size: 10px; color: rgba(0, 0, 0, 0.7); font-weight: bold;`;
    controlsDiv.appendChild(targetIndicator);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      background: transparent;
      color: rgba(0, 0, 0, 0.5); 
      border: none; 
      border-radius: 50%; 
      cursor: pointer; 
      font-size: 18px;
      font-weight: bold;
      opacity: 0.7;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      z-index: 10;
    `;

    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.background = 'linear-gradient(180deg,rgb(247, 82, 5), #fca5a5)';
      removeBtn.style.rotate = '350deg';
      removeBtn.style.opacity = '1';
      removeBtn.style.transform = 'scale(1.1)';
    });

    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.background = 'transparent';
      removeBtn.style.rotate = '-360deg';
      removeBtn.style.opacity = '0.7';
      removeBtn.style.transform = 'scale(1)';
    });

    // Remove button click handler
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      translationDiv.remove();
      // Note: We don't re-add the original message element since it's still there
    });

    controlsDiv.appendChild(removeBtn);
    translationDiv.appendChild(controlsDiv);
    
    // Insert translation after the message element
    messageElement.parentNode.insertBefore(translationDiv, messageElement.nextSibling);
    
    console.log('✅ Mass message translation displayed:', translatedText.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('Error showing mass message translation:', error);
  }
}

}

// Enhanced initialization
let optimizedMessageHandler = null;
let initAttemptCount = 0;  // Counter to track initialization attempts

function initializeOptimizedHandler() {
  try {
    
    if (!window.location.hostname.includes('maloum.com')) {
      return;
    }
    
    // Prevent excessive re-initialization
    initAttemptCount++;
    if (initAttemptCount > 10) {
      console.warn('⚠️ Preventing excessive re-initialization of OptimizedHandler');
      return;
    }
    
    if (optimizedMessageHandler) {
      optimizedMessageHandler.destroy();
    }
    
    optimizedMessageHandler = new OptimizedMaloumMessageHandler();
    window.optimizedMessageHandler = optimizedMessageHandler;
    
  } catch (error) {
    console.error('Failed to initialize FIXED Handler:', error);
  }
}

// Prevent multiple initializations
let isInitializing = false;

// Enhanced initialization with prevention of multiple calls
function safeInitialize() {
  if (isInitializing) {
    console.log('⚠️ Initialization already in progress, skipping duplicate call');
    return;
  }
  
  isInitializing = true;
  initializeOptimizedHandler();
  
  setTimeout(() => {
    isInitializing = false;
  }, 2000); // Reset flag after 2 seconds to allow re-initialization if needed
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInitialize);
} else {
  setTimeout(safeInitialize, 1000);
}

// Fallback initialization after ensuring DOM is fully loaded
setTimeout(() => {
  if (!optimizedMessageHandler?.isInitialized) {
    safeInitialize();
  }
}, 3000);

// Enhanced URL change monitoring with debouncing
let lastOptimizedUrl = location.href;
let urlChangeTimer = null;

new MutationObserver(() => {
  const url = location.href;
  if (url !== lastOptimizedUrl) {
    lastOptimizedUrl = url;
    
    if (urlChangeTimer) clearTimeout(urlChangeTimer);
    urlChangeTimer = setTimeout(() => {
      console.log('🌐 URL changed, re-initializing handler...');
      safeInitialize();
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });

// Setup immediate debug functions
window.debugOptimizedHandler = {
  restart: initializeOptimizedHandler,
  getInstance: () => optimizedMessageHandler,
  getTranslator: () => optimizedMessageHandler?.translator,
  checkAllComponents: () => {
    return {
      messageHandler: !!optimizedMessageHandler,
      messageHandlerInitialized: optimizedMessageHandler?.isInitialized || false,
      translator: !!optimizedMessageHandler?.translator,
      authHandler: !!window.firebaseApiKeyHandler,
      cacheManager: !!window.maloumCacheManager,
      emojiManager: !!window.maloumEmojiManager,
      isAuthenticated: window.firebaseApiKeyHandler?.isAuthenticated || false,
      hasTextarea: !!document.querySelector('textarea[placeholder="Write a message"]'),
      hasTranslateButton: !!document.getElementById('maloum-translate-btn'),
      MaloumTranslatorClass: !!window.MaloumTranslator,
      currentDomain: window.location.hostname,
      debugFunctionsReady: true,
      messageTranslationTarget: 'English (ALWAYS)',
      textareaTranslationTarget: 'User Selected (Default: German)',
      cacheIntegration: 'FIXED - EN↔DE Only with proper validation'
    };
  }
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (optimizedMessageHandler) {
    optimizedMessageHandler.destroy();
  }
  
  if (window.performanceMonitorInterval) {
    clearInterval(window.performanceMonitorInterval);
  }
});