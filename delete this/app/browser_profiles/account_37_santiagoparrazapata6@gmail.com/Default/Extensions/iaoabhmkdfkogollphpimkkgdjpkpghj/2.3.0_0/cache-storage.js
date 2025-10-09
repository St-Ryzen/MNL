// cache-storage.js - FIXED: IndexedDB Storage Handler for EN↔DE Only Translation Cache
class MaloumCacheStorage {
  constructor() {
    this.dbName = 'MaloumTranslationCache';
    this.dbVersion = 3; // Increment for EN↔DE only migrations
    this.translationStoreName = 'translations';
    this.reverseTranslationStoreName = 'reverseTranslations';
    this.emojiStoreName = 'customEmojis';
    this.db = null;
    this.initPromise = null;
    this.isInitialized = false;
    
    // Legacy keys for migration
    this.legacyCacheKey = 'maloum_translations_cache';
    this.legacyReverseCacheKey = 'maloum_reverse_translations_cache';
    
    // FIXED: Valid language pairs (EN↔DE ONLY)
    this.validLanguagePairs = [
      { source: 'EN', target: 'DE' },
      { source: 'DE', target: 'EN' }
    ];
    
    // Start initialization
    this.initPromise = this.initializeDB();
  }

  // Initialize IndexedDB database
  async initializeDB() {
    try {
      
      this.db = await this.openDatabase();
      
      // Migrate data from localStorage/chrome.storage if needed
      await this.migrateFromLegacyStorage();
      
      // FIXED: Clean up any non-EN↔DE entries
      await this.cleanupInvalidLanguagePairs();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ FIXED: IndexedDB initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // Open IndexedDB database with proper schema
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        console.error('❌ FIXED: IndexedDB open error:', request.error);
        reject(new Error(`IndexedDB open failed: ${request.error}`));
      };
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create translations store
        if (!db.objectStoreNames.contains(this.translationStoreName)) {
          const translationStore = db.createObjectStore(this.translationStoreName, { 
            keyPath: 'cacheKey' 
          });
          
          // Create indexes for efficient searching
          translationStore.createIndex('originalText', 'originalText', { unique: false });
          translationStore.createIndex('translatedText', 'translatedText', { unique: false });
          translationStore.createIndex('sourceLanguage', 'sourceLanguage', { unique: false });
          translationStore.createIndex('targetLanguage', 'targetLanguage', { unique: false });
          translationStore.createIndex('timestamp', 'timestamp', { unique: false });
          translationStore.createIndex('messageType', 'messageType', { unique: false });
          
        }
        
        // Create reverse translations store
        if (!db.objectStoreNames.contains(this.reverseTranslationStoreName)) {
          const reverseStore = db.createObjectStore(this.reverseTranslationStoreName, { 
            keyPath: 'textHash' 
          });
          
          // Create indexes
          reverseStore.createIndex('translatedText', 'translatedText', { unique: false });
          reverseStore.createIndex('originalText', 'originalText', { unique: false });
          reverseStore.createIndex('timestamp', 'timestamp', { unique: false });
          
        }
        
        // Create emoji store
        if (!db.objectStoreNames.contains(this.emojiStoreName)) {
          const emojiStore = db.createObjectStore(this.emojiStoreName, { 
            keyPath: 'id' 
          });
          
        }
      };
    });
  }

  // Ensure database is initialized before operations
  async ensureInitialized() {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.isInitialized || !this.db) {
      throw new Error('IndexedDB not properly initialized');
    }
  }

  // FIXED: Clean up any invalid language pairs (keep only EN↔DE)
  async cleanupInvalidLanguagePairs() {
    try {
      
      const transaction = this.db.transaction([this.translationStoreName, this.reverseTranslationStoreName], 'readwrite');
      const translationStore = transaction.objectStore(this.translationStoreName);
      const reverseStore = transaction.objectStore(this.reverseTranslationStoreName);
      
      // Get all translations
      const allTranslations = await this.getAllData(translationStore);
      let removedCount = 0;
      
      for (const entry of allTranslations) {
        const isValid = this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage);
        if (!isValid) {
          await this.deleteData(translationStore, entry.cacheKey);
          removedCount++;
        }
      }
      
      // Get all reverse translations
      const allReverseTranslations = await this.getAllData(reverseStore);
      let reverseRemovedCount = 0;
      
      for (const entry of allReverseTranslations) {
        const isValid = this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage);
        if (!isValid) {
          await this.deleteData(reverseStore, entry.textHash);
          reverseRemovedCount++;
        }
      }
      
      await this.waitForTransaction(transaction);
      
      if (removedCount > 0 || reverseRemovedCount > 0) {
      } else {
      }
      
    } catch (error) {
      console.error('❌ FIXED: Error cleaning up invalid language pairs:', error);
    }
  }

  // FIXED: Check if language pair is valid (EN↔DE only)
  isValidLanguagePair(sourceLanguage, targetLanguage) {
    const normalizedSource = (sourceLanguage || '').toUpperCase();
    const normalizedTarget = (targetLanguage || '').toUpperCase();
    
    return this.validLanguagePairs.some(pair => 
      pair.source === normalizedSource && pair.target === normalizedTarget
    );
  }

  // FIXED: Normalize language codes to EN↔DE only
  normalizeLanguagePair(sourceLanguage, targetLanguage) {
    let normalizedSource = (sourceLanguage || 'AUTO').toUpperCase();
    let normalizedTarget = (targetLanguage || 'DE').toUpperCase();
    
    // Convert AUTO to appropriate language based on context
    if (normalizedSource === 'AUTO') {
      normalizedSource = (normalizedTarget === 'EN') ? 'DE' : 'EN';
    }
    if (normalizedTarget === 'AUTO') {
      normalizedTarget = (normalizedSource === 'EN') ? 'DE' : 'EN';
    }
    
    // Ensure only EN↔DE pairs
    if (!this.isValidLanguagePair(normalizedSource, normalizedTarget)) {
      // Default to EN→DE if invalid
      normalizedSource = 'EN';
      normalizedTarget = 'DE';
    }
    
    return { source: normalizedSource, target: normalizedTarget };
  }

  // Migrate data from legacy storage (localStorage/chrome.storage)
  async migrateFromLegacyStorage() {
    try {
      
      let migratedCount = 0;
      
      // First, try chrome.storage
      if (chrome?.storage?.local) {
        try {
          const chromeData = await new Promise((resolve) => {
            chrome.storage.local.get([this.legacyCacheKey, this.legacyReverseCacheKey], resolve);
          });
          
          if (chromeData[this.legacyCacheKey]?.length > 0) {
            await this.migrateLegacyData(chromeData[this.legacyCacheKey], chromeData[this.legacyReverseCacheKey] || []);
            migratedCount += chromeData[this.legacyCacheKey].length;
            
            // Clean up chrome.storage after migration
            chrome.storage.local.remove([this.legacyCacheKey, this.legacyReverseCacheKey]);
          }
        } catch (chromeError) {
        }
      }
      
      // Fallback to localStorage if no chrome.storage data found
      if (migratedCount === 0) {
        const localData = localStorage.getItem(this.legacyCacheKey);
        const localReverseData = localStorage.getItem(this.legacyReverseCacheKey);
        
        if (localData) {
          const translationData = JSON.parse(localData);
          const reverseData = localReverseData ? JSON.parse(localReverseData) : [];
          
          await this.migrateLegacyData(translationData, reverseData);
          migratedCount += translationData.length;
          
          // Clean up localStorage after migration
          localStorage.removeItem(this.legacyCacheKey);
          localStorage.removeItem(this.legacyReverseCacheKey);
        }
      }
      
      if (migratedCount > 0) {
      } else {
      }
      
    } catch (error) {
      console.warn('⚠️ FIXED: Migration from legacy storage failed (non-critical):', error);
    }
  }

  // FIXED: Migrate legacy data format to IndexedDB (EN↔DE only)
  async migrateLegacyData(translationData, reverseData) {
    const transaction = this.db.transaction([this.translationStoreName, this.reverseTranslationStoreName], 'readwrite');
    const translationStore = transaction.objectStore(this.translationStoreName);
    const reverseStore = transaction.objectStore(this.reverseTranslationStoreName);
    
    try {
      let migratedTranslations = 0;
      let skippedTranslations = 0;
      
      // Migrate translation data (only EN↔DE)
      for (const [cacheKey, entry] of translationData) {
        const normalizedPair = this.normalizeLanguagePair(entry.sourceLanguage, entry.targetLanguage);
        
        // Only migrate valid EN↔DE pairs
        if (this.isValidLanguagePair(normalizedPair.source, normalizedPair.target)) {
          const migrationEntry = {
            cacheKey: this.generateCacheKey(entry.originalText, normalizedPair.target, normalizedPair.source),
            originalText: entry.originalText || '',
            translatedText: entry.translatedText || '',
            sourceLanguage: normalizedPair.source,
            targetLanguage: normalizedPair.target,
            messageType: entry.messageType || 'migrated',
            timestamp: entry.timestamp || Date.now()
          };
          
          await this.putData(translationStore, migrationEntry);
          migratedTranslations++;
        } else {
          skippedTranslations++;
        }
      }
      
      let migratedReverse = 0;
      let skippedReverse = 0;
      
      // Migrate reverse translation data (only EN↔DE)
      for (const [textHash, entry] of reverseData) {
        const normalizedPair = this.normalizeLanguagePair(entry.sourceLanguage, entry.targetLanguage);
        
        // Only migrate valid EN↔DE pairs
        if (this.isValidLanguagePair(normalizedPair.source, normalizedPair.target)) {
          const migrationEntry = {
            textHash: textHash,
            originalText: entry.originalText || '',
            translatedText: entry.translatedText || '',
            sourceLanguage: normalizedPair.source,
            targetLanguage: normalizedPair.target,
            messageType: entry.messageType || 'migrated',
            originalMessageHash: entry.originalMessageHash || '',
            timestamp: entry.timestamp || Date.now()
          };
          
          await this.putData(reverseStore, migrationEntry);
          migratedReverse++;
        } else {
          skippedReverse++;
        }
      }
      
      await this.waitForTransaction(transaction);
      
    } catch (error) {
      console.error('❌ FIXED: Error during legacy data migration:', error);
      throw error;
    }
  }

  // Helper method to put data into IndexedDB
  putData(store, data) {
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Helper method to get data from IndexedDB
  getData(store, key) {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Helper method to get all data from a store
  getAllData(store) {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Helper method to delete data from IndexedDB
  deleteData(store, key) {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Helper method to wait for transaction completion
  waitForTransaction(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  // FIXED: Load translation cache from IndexedDB (EN↔DE only)
  async loadTranslationCache() {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db.transaction([this.translationStoreName], 'readonly');
      const store = transaction.objectStore(this.translationStoreName);
      const data = await this.getAllData(store);
      
      const cacheMap = new Map();
      let loadedCount = 0;
      let skippedCount = 0;
      
      data.forEach(entry => {
        // Validate that this is a valid EN↔DE entry
        if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
          cacheMap.set(entry.cacheKey, {
            originalText: entry.originalText,
            translatedText: entry.translatedText,
            sourceLanguage: entry.sourceLanguage,
            targetLanguage: entry.targetLanguage,
            messageType: entry.messageType,
            timestamp: entry.timestamp
          });
          loadedCount++;
        } else {
          skippedCount++;
        }
      });
      
      return cacheMap;
      
    } catch (error) {
      console.error('❌ FIXED: Error loading translation cache from IndexedDB:', error);
      return new Map();
    }
  }

  // FIXED: Load reverse translation cache from IndexedDB (EN↔DE only)
  async loadReverseTranslationCache() {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db.transaction([this.reverseTranslationStoreName], 'readonly');
      const store = transaction.objectStore(this.reverseTranslationStoreName);
      const data = await this.getAllData(store);
      
      const reverseCacheMap = new Map();
      let loadedCount = 0;
      let skippedCount = 0;
      
      data.forEach(entry => {
        // Validate that this is a valid EN↔DE entry
        if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
          reverseCacheMap.set(entry.textHash, {
            originalText: entry.originalText,
            translatedText: entry.translatedText,
            sourceLanguage: entry.sourceLanguage,
            targetLanguage: entry.targetLanguage,
            messageType: entry.messageType,
            originalMessageHash: entry.originalMessageHash,
            timestamp: entry.timestamp
          });
          loadedCount++;
        } else {
          skippedCount++;
        }
      });
      
      return reverseCacheMap;
      
    } catch (error) {
      console.error('❌ FIXED: Error loading reverse translation cache from IndexedDB:', error);
      return new Map();
    }
  }

  // FIXED: Save both caches to IndexedDB (EN↔DE only)
  async saveTranslationCache(translationCache, reverseTranslationCache) {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db.transaction([this.translationStoreName, this.reverseTranslationStoreName], 'readwrite');
      const translationStore = transaction.objectStore(this.translationStoreName);
      const reverseStore = transaction.objectStore(this.reverseTranslationStoreName);
      
      // Clear existing data
      await this.clearStore(translationStore);
      await this.clearStore(reverseStore);
      
      let savedTranslations = 0;
      let skippedTranslations = 0;
      
      // Save translation cache (only EN↔DE)
      for (const [cacheKey, entry] of translationCache.entries()) {
        if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
          const dbEntry = {
            cacheKey: cacheKey,
            originalText: entry.originalText,
            translatedText: entry.translatedText,
            sourceLanguage: entry.sourceLanguage,
            targetLanguage: entry.targetLanguage,
            messageType: entry.messageType,
            timestamp: entry.timestamp
          };
          await this.putData(translationStore, dbEntry);
          savedTranslations++;
        } else {
          skippedTranslations++;
        }
      }
      
      let savedReverse = 0;
      let skippedReverse = 0;
      
      // Save reverse translation cache (only EN↔DE)
      for (const [textHash, entry] of reverseTranslationCache.entries()) {
        if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
          const dbEntry = {
            textHash: textHash,
            originalText: entry.originalText,
            translatedText: entry.translatedText,
            sourceLanguage: entry.sourceLanguage,
            targetLanguage: entry.targetLanguage,
            messageType: entry.messageType,
            originalMessageHash: entry.originalMessageHash,
            timestamp: entry.timestamp
          };
          await this.putData(reverseStore, dbEntry);
          savedReverse++;
        } else {
          skippedReverse++;
        }
      }
      
      await this.waitForTransaction(transaction);
      return true;
      
    } catch (error) {
      console.error('❌ FIXED: Error saving translation cache to IndexedDB:', error);
      return false;
    }
  }

  // Helper method to clear a store
  clearStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // FIXED: Generate consistent cache key with EN↔DE normalization
  generateCacheKey(text, targetLang, sourceLang = null) {
    const normalizedText = text.trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\u00C0-\u017F\u0100-\u024F]/g, '')
      .trim();
    
    // FIXED: Normalize to EN↔DE only
    const normalizedPair = this.normalizeLanguagePair(sourceLang, targetLang);
    
    const baseKey = `${normalizedText}_${normalizedPair.target}_${normalizedPair.source}`;
    
    return baseKey;
  }

  // FIXED: Generate EN↔DE cache key variations for lookup
  generatePossibleCacheKeys(text, targetLang, sourceLang = null) {
    const normalizedText = text.trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\u00C0-\u017F\u0100-\u024F]/g, '')
      .trim();
    
    // FIXED: Only generate EN↔DE variations
    const possibleKeys = [
      `${normalizedText}_DE_EN`,  // English → German
      `${normalizedText}_EN_DE`,  // German → English
      `${normalizedText}_DE_AUTO`,
      `${normalizedText}_EN_AUTO`,
      `${normalizedText}_AUTO_DE`,
      `${normalizedText}_AUTO_EN`
    ];
    
    // Add the requested combination if it's EN↔DE
    const normalizedPair = this.normalizeLanguagePair(sourceLang, targetLang);
    if (this.isValidLanguagePair(normalizedPair.source, normalizedPair.target)) {
      possibleKeys.unshift(`${normalizedText}_${normalizedPair.target}_${normalizedPair.source}`);
    }
    
    const uniqueKeys = [...new Set(possibleKeys)];
    return uniqueKeys;
  }

  // Generate message hash for specific message translations
  generateMessageHash(text, targetLang, messageType) {
    const normalizedPair = this.normalizeLanguagePair('AUTO', targetLang);
    return this.generateCacheKey(text, normalizedPair.target, normalizedPair.source) + `_${messageType || 'message'}`;
  }

  // Generate text hash for reverse lookups
  generateTextHash(text) {
    const normalized = text.trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\u00C0-\u017F\u0100-\u024F]/g, '')
      .trim();
    
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString();
  }

  // Helper method to get data by index
  getDataByIndex(index, key) {
    return new Promise((resolve, reject) => {
      const request = index.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // FIXED: IndexedDB-powered cache lookup with EN↔DE only matching
  async getCachedTranslation(textOrKey, translationCache) {
    
    try {
      await this.ensureInitialized();
      
      // First try in-memory cache (for performance)
      if (translationCache && translationCache.has(textOrKey)) {
        const result = translationCache.get(textOrKey);
        // Validate it's EN↔DE
        if (this.isValidLanguagePair(result.sourceLanguage, result.targetLanguage)) {
          return result;
        } else {
        }
      }
      
      // Try all possible EN↔DE cache key variations in IndexedDB
      const possibleKeys = this.generatePossibleCacheKeys(textOrKey, 'DE', 'EN');
      possibleKeys.push(...this.generatePossibleCacheKeys(textOrKey, 'EN', 'DE'));
      const uniqueKeys = [...new Set(possibleKeys)];
      
      const transaction = this.db.transaction([this.translationStoreName], 'readonly');
      const store = transaction.objectStore(this.translationStoreName);
      
      for (const key of uniqueKeys) {
        const result = await this.getData(store, key);
        if (result && this.isValidLanguagePair(result.sourceLanguage, result.targetLanguage)) {
          return {
            originalText: result.originalText,
            translatedText: result.translatedText,
            sourceLanguage: result.sourceLanguage,
            targetLanguage: result.targetLanguage,
            messageType: result.messageType,
            timestamp: result.timestamp
          };
        }
      }
      
      // Fallback: text-based search using index (EN↔DE only)
      const textIndex = store.index('originalText');
      const normalizedSearchText = textOrKey.trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s\u00C0-\u017F\u0100-\u024F]/g, '')
        .trim();
      
      const textSearchResult = await this.getDataByIndex(textIndex, normalizedSearchText);
      if (textSearchResult && this.isValidLanguagePair(textSearchResult.sourceLanguage, textSearchResult.targetLanguage)) {
        return {
          originalText: textSearchResult.originalText,
          translatedText: textSearchResult.translatedText,
          sourceLanguage: textSearchResult.sourceLanguage,
          targetLanguage: textSearchResult.targetLanguage,
          messageType: textSearchResult.messageType,
          timestamp: textSearchResult.timestamp
        };
      }
      
    } catch (error) {
    }
    
    return null;
  }

  // FIXED: Enhanced reverse translation lookup with EN↔DE validation
  async getReverseTranslation(text, reverseTranslationCache) {
    
    try {
      await this.ensureInitialized();
      
      const textHash = this.generateTextHash(text);
      
      // First try in-memory cache
      if (reverseTranslationCache && reverseTranslationCache.has(textHash)) {
        const result = reverseTranslationCache.get(textHash);
        // Validate it's EN↔DE
        if (this.isValidLanguagePair(result.sourceLanguage, result.targetLanguage)) {
          return result;
        } else {
        }
      }
      
      // Try IndexedDB
      const transaction = this.db.transaction([this.reverseTranslationStoreName], 'readonly');
      const store = transaction.objectStore(this.reverseTranslationStoreName);
      
      const result = await this.getData(store, textHash);
      if (result && this.isValidLanguagePair(result.sourceLanguage, result.targetLanguage)) {
        return {
          originalText: result.originalText,
          translatedText: result.translatedText,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          messageType: result.messageType,
          originalMessageHash: result.originalMessageHash,
          timestamp: result.timestamp
        };
      }
      
      // Fallback: text-based search using index (EN↔DE only)
      const textIndex = store.index('translatedText');
      const normalizedSearchText = text.trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s\u00C0-\u017F\u0100-\u024F]/g, '')
        .trim();
      
      const textSearchResult = await this.getDataByIndex(textIndex, normalizedSearchText);
      if (textSearchResult && this.isValidLanguagePair(textSearchResult.sourceLanguage, textSearchResult.targetLanguage)) {
        return {
          originalText: textSearchResult.originalText,
          translatedText: textSearchResult.translatedText,
          sourceLanguage: textSearchResult.sourceLanguage,
          targetLanguage: textSearchResult.targetLanguage,
          messageType: textSearchResult.messageType,
          originalMessageHash: textSearchResult.originalMessageHash,
          timestamp: textSearchResult.timestamp
        };
      }
      
    } catch (error) {
      console.error('❌ FIXED: Error searching reverse translation in IndexedDB:', error);
    }
    
    return null;
  }

  // FIXED: Store translation in IndexedDB with EN↔DE validation and improved key generation
  async storeTranslation(translationCache, reverseTranslationCache, cacheKeyOrText, originalText, translatedText, sourceLanguage, targetLanguage, messageType) {
    try {
      await this.ensureInitialized();
      

      
      // FIXED: Normalize to EN↔DE only
      const normalizedPair = this.normalizeLanguagePair(sourceLanguage, targetLanguage);
      
      // FIXED: Validate that this is an EN↔DE pair
      if (!this.isValidLanguagePair(normalizedPair.source, normalizedPair.target)) {
        return false;
      }
      
      const cacheKey = this.generateCacheKey(originalText, normalizedPair.target, normalizedPair.source);
      
      if (!originalText || !translatedText) {
        console.error('❌ FIXED: Missing required fields: originalText or translatedText');
        return false;
      }
      
      const timestamp = Date.now();
      
      // Prepare entries with normalized language pairs
      const cacheEntry = {
        cacheKey: cacheKey,
        originalText: originalText.trim(),
        translatedText: translatedText.trim(),
        sourceLanguage: normalizedPair.source,
        targetLanguage: normalizedPair.target,
        messageType: messageType || 'manual',
        timestamp: timestamp
      };
      
      const translatedTextHash = this.generateTextHash(translatedText);
      const reverseCacheEntry = {
        textHash: translatedTextHash,
        originalText: originalText.trim(),
        translatedText: translatedText.trim(),
        sourceLanguage: normalizedPair.source,
        targetLanguage: normalizedPair.target,
        messageType: messageType || 'manual',
        originalMessageHash: cacheKey,
        timestamp: timestamp
      };
      
      // Store in IndexedDB
      const transaction = this.db.transaction([this.translationStoreName, this.reverseTranslationStoreName], 'readwrite');
      const translationStore = transaction.objectStore(this.translationStoreName);
      const reverseStore = transaction.objectStore(this.reverseTranslationStoreName);
      
      await this.putData(translationStore, cacheEntry);
      await this.putData(reverseStore, reverseCacheEntry);
      
      // FIXED: Store additional EN↔DE key variations for comprehensive lookup
      const additionalKeys = [
        this.generateCacheKey(originalText, normalizedPair.target, 'AUTO'),
        this.generateCacheKey(originalText, 'AUTO', normalizedPair.source)
      ].filter(key => key !== cacheKey); // Avoid duplicates
      
      for (const key of additionalKeys) {
        const additionalEntry = { ...cacheEntry, cacheKey: key };
        await this.putData(translationStore, additionalEntry);
      }
      
      await this.waitForTransaction(transaction);
      
      // Update in-memory caches
      if (translationCache) {
        translationCache.set(cacheKey, {
          originalText: cacheEntry.originalText,
          translatedText: cacheEntry.translatedText,
          sourceLanguage: cacheEntry.sourceLanguage,
          targetLanguage: cacheEntry.targetLanguage,
          messageType: cacheEntry.messageType,
          timestamp: cacheEntry.timestamp
        });
      }
      
      if (reverseTranslationCache) {
        reverseTranslationCache.set(translatedTextHash, {
          originalText: reverseCacheEntry.originalText,
          translatedText: reverseCacheEntry.translatedText,
          sourceLanguage: reverseCacheEntry.sourceLanguage,
          targetLanguage: reverseCacheEntry.targetLanguage,
          messageType: reverseCacheEntry.messageType,
          originalMessageHash: reverseCacheEntry.originalMessageHash,
          timestamp: reverseCacheEntry.timestamp
        });
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ FIXED: Error storing cached translation in IndexedDB:', error);
      return false;
    }
  }

  // FIXED: Enhanced search functionality with IndexedDB indexes (EN↔DE only)
  async searchCache(translationCache, query, options = {}) {
    try {
      await this.ensureInitialized();
      
      const results = [];
      const searchTerm = query.toLowerCase().trim();
      
      const transaction = this.db.transaction([this.translationStoreName], 'readonly');
      const store = transaction.objectStore(this.translationStoreName);
      
      if (!searchTerm) {
        // Return all EN↔DE entries with filtering
        const allData = await this.getAllData(store);
        allData.forEach(entry => {
          // FIXED: Only return EN↔DE entries
          if (!this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
            return; // Skip non-EN↔DE entries
          }
          
          const languageMatch = options.sourceLanguage ? entry.sourceLanguage === options.sourceLanguage : true;
          const targetMatch = options.targetLanguage ? entry.targetLanguage === options.targetLanguage : true;
          
          if (languageMatch && targetMatch) {
            results.push({
              hash: entry.cacheKey,
              originalText: entry.originalText,
              translatedText: entry.translatedText,
              sourceLanguage: entry.sourceLanguage,
              targetLanguage: entry.targetLanguage,
              messageType: entry.messageType,
              timestamp: entry.timestamp,
              matchType: 'all'
            });
          }
        });
      } else {
        // Search with term using indexes (EN↔DE only)
        const allData = await this.getAllData(store);
        allData.forEach(entry => {
          // FIXED: Only search EN↔DE entries
          if (!this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
            return; // Skip non-EN↔DE entries
          }
          
          const originalMatch = entry.originalText.toLowerCase().includes(searchTerm);
          const translatedMatch = entry.translatedText.toLowerCase().includes(searchTerm);
          const languageMatch = options.sourceLanguage ? entry.sourceLanguage === options.sourceLanguage : true;
          const targetMatch = options.targetLanguage ? entry.targetLanguage === options.targetLanguage : true;

          if ((originalMatch || translatedMatch) && languageMatch && targetMatch) {
            results.push({
              hash: entry.cacheKey,
              originalText: entry.originalText,
              translatedText: entry.translatedText,
              sourceLanguage: entry.sourceLanguage,
              targetLanguage: entry.targetLanguage,
              messageType: entry.messageType,
              timestamp: entry.timestamp,
              matchType: originalMatch ? 'original' : 'translated'
            });
          }
        });
      }

      // Sort by timestamp (newest first)
      return results.sort((a, b) => b.timestamp - a.timestamp);
      
    } catch (error) {
      console.error('❌ FIXED: Error searching cache in IndexedDB:', error);
      return [];
    }
  }

  // FIXED: Get cache statistics from IndexedDB with EN↔DE validation
  async getCacheStats(translationCache, reverseTranslationCache) {
    try {
      await this.ensureInitialized();
      
      // Check if database is actually ready
      if (!this.db || !this.isInitialized) {
        console.warn('⚠️ FIXED: IndexedDB not ready, using fallback statistics');
        return this.getFallbackStats(translationCache, reverseTranslationCache);
      }
      
      const transaction = this.db.transaction([this.translationStoreName, this.reverseTranslationStoreName], 'readonly');
      const translationStore = transaction.objectStore(this.translationStoreName);
      const reverseStore = transaction.objectStore(this.reverseTranslationStoreName);
      
      const [translationData, reverseData] = await Promise.all([
        this.getAllData(translationStore),
        this.getAllData(reverseStore)
      ]);
      
      // FIXED: Filter to only count EN↔DE entries
      const validTranslations = translationData.filter(entry => 
        this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)
      );
      const validReverseTranslations = reverseData.filter(entry => 
        this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)
      );
      
      
      const stats = {
        totalEntries: validTranslations.length,
        reverseEntries: validReverseTranslations.length,
        invalidEntriesSkipped: translationData.length - validTranslations.length,
        oldestEntry: null,
        newestEntry: null,
        actualSizeBytes: 0,
        actualSizeMB: 0,
        maxStorageMB: 'Unlimited (IndexedDB)',
        storageType: 'IndexedDB',
        supportedLanguagePairs: 'EN↔DE Only'
      };

      let oldestTimestamp = Infinity;
      let newestTimestamp = 0;

      // Calculate size with valid entries only
      try {
        const allValidDataString = JSON.stringify([...validTranslations, ...validReverseTranslations]);
        stats.actualSizeBytes = new Blob([allValidDataString]).size;
        stats.actualSizeMB = (stats.actualSizeBytes / (1024 * 1024)).toFixed(2);
      } catch (sizeError) {
        console.warn('⚠️ FIXED: Size calculation failed:', sizeError);
        stats.actualSizeBytes = 0;
        stats.actualSizeMB = '0.00';
      }

      // Process timestamps from valid translations only
      validTranslations.forEach(entry => {
        if (entry.timestamp && typeof entry.timestamp === 'number') {
          if (entry.timestamp < oldestTimestamp) {
            oldestTimestamp = entry.timestamp;
            stats.oldestEntry = new Date(entry.timestamp);
          }
          
          if (entry.timestamp > newestTimestamp) {
            newestTimestamp = entry.timestamp;
            stats.newestEntry = new Date(entry.timestamp);
          }
        }
      });

      return stats;
      
    } catch (error) {
      console.error('❌ FIXED: Error getting cache stats from IndexedDB:', error);
      return this.getFallbackStats(translationCache, reverseTranslationCache);
    }
  }

  // FIXED: Fallback method for when IndexedDB fails (EN↔DE only)
  getFallbackStats(translationCache, reverseTranslationCache) {
    try {
      
      // Count only valid EN↔DE entries in memory cache
      let validInMemoryCount = 0;
      let validReverseInMemoryCount = 0;
      
      if (translationCache) {
        translationCache.forEach(entry => {
          if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
            validInMemoryCount++;
          }
        });
      }
      
      if (reverseTranslationCache) {
        reverseTranslationCache.forEach(entry => {
          if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
            validReverseInMemoryCount++;
          }
        });
      }
      
      const stats = {
        totalEntries: validInMemoryCount,
        reverseEntries: validReverseInMemoryCount,
        oldestEntry: null,
        newestEntry: null,
        actualSizeBytes: 0,
        actualSizeMB: 0,
        maxStorageMB: 'Chrome Storage (5MB)',
        storageType: 'In-Memory + Chrome Storage (EN↔DE Only)',
        supportedLanguagePairs: 'EN↔DE Only'
      };

      if (!translationCache || validInMemoryCount === 0) {
        return stats;
      }

      let oldestTimestamp = Infinity;
      let newestTimestamp = 0;

      // Calculate size from valid in-memory cache entries only
      try {
        const validCacheEntries = [];
        const validReverseCacheEntries = [];
        
        if (translationCache) {
          translationCache.forEach((entry, key) => {
            if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
              validCacheEntries.push([key, entry]);
            }
          });
        }
        
        if (reverseTranslationCache) {
          reverseTranslationCache.forEach((entry, key) => {
            if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
              validReverseCacheEntries.push([key, entry]);
            }
          });
        }
        
        const allValidDataString = JSON.stringify([...validCacheEntries, ...validReverseCacheEntries]);
        stats.actualSizeBytes = new Blob([allValidDataString]).size;
        stats.actualSizeMB = (stats.actualSizeBytes / (1024 * 1024)).toFixed(2);
      } catch (sizeError) {
        console.warn('⚠️ FIXED: Fallback size calculation failed:', sizeError);
      }

      // Process timestamps from valid in-memory cache only
      if (translationCache) {
        translationCache.forEach(entry => {
          if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage) && 
              entry.timestamp && typeof entry.timestamp === 'number') {
            if (entry.timestamp < oldestTimestamp) {
              oldestTimestamp = entry.timestamp;
              stats.oldestEntry = new Date(entry.timestamp);
            }
            
            if (entry.timestamp > newestTimestamp) {
              newestTimestamp = entry.timestamp;
              stats.newestEntry = new Date(entry.timestamp);
            }
          }
        });
      }

      return stats;
    } catch (error) {
      console.error('❌ FIXED: Fallback statistics calculation failed:', error);
      return {
        totalEntries: 0,
        reverseEntries: 0,
        oldestEntry: null,
        newestEntry: null,
        actualSizeBytes: 0,
        actualSizeMB: '0.00',
        maxStorageMB: 'Unknown',
        storageType: 'Error (EN↔DE Only)',
        supportedLanguagePairs: 'EN↔DE Only',
        error: error.message
      };
    }
  }

  // FIXED: Export cache data from IndexedDB (EN↔DE only)
  async exportCache(translationCache, reverseTranslationCache, format = 'json') {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db.transaction([this.translationStoreName, this.reverseTranslationStoreName], 'readonly');
      const translationStore = transaction.objectStore(this.translationStoreName);
      const reverseStore = transaction.objectStore(this.reverseTranslationStoreName);
      
      const [translationData, reverseData] = await Promise.all([
        this.getAllData(translationStore),
        this.getAllData(reverseStore)
      ]);
      
      // FIXED: Filter to only export EN↔DE entries
      const validTranslations = translationData.filter(entry => 
        this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)
      );
      const validReverseTranslations = reverseData.filter(entry => 
        this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)
      );
      
      const data = {
        translations: validTranslations.map(entry => ({
          hash: entry.cacheKey,
          originalText: entry.originalText,
          translatedText: entry.translatedText,
          sourceLanguage: entry.sourceLanguage,
          targetLanguage: entry.targetLanguage,
          messageType: entry.messageType,
          timestamp: entry.timestamp
        })),
        reverseTranslations: validReverseTranslations.map(entry => ({
          hash: entry.textHash,
          originalText: entry.originalText,
          translatedText: entry.translatedText,
          sourceLanguage: entry.sourceLanguage,
          targetLanguage: entry.targetLanguage,
          messageType: entry.messageType,
          originalMessageHash: entry.originalMessageHash,
          timestamp: entry.timestamp
        })),
        exportDate: new Date().toISOString(),
        version: '3.0-FIXED',
        storageType: 'IndexedDB (EN↔DE Only)',
        supportedLanguagePairs: 'EN↔DE Only',
        filteredEntries: {
          totalExported: validTranslations.length + validReverseTranslations.length,
          translationsExported: validTranslations.length,
          reverseTranslationsExported: validReverseTranslations.length,
          invalidEntriesSkipped: (translationData.length - validTranslations.length) + (reverseData.length - validReverseTranslations.length)
        }
      };

      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      } else if (format === 'csv') {
        return this.exportToCSV(data.translations);
      }
      
    } catch (error) {
      console.error('❌ FIXED: Error exporting cache from IndexedDB:', error);
      return '';
    }
  }

  // Convert to CSV format (unchanged)
  exportToCSV(translations) {
    const headers = [
      'Hash',
      'Original Text', 
      'Translated Text', 
      'Source Language', 
      'Target Language', 
      'Message Type', 
      'Timestamp'
    ];
    
    const rows = translations.map(entry => [
      `"${entry.hash || ''}"`,
      `"${entry.originalText.replace(/"/g, '""')}"`,
      `"${entry.translatedText.replace(/"/g, '""')}"`,
      `"${entry.sourceLanguage || 'EN'}"`,
      `"${entry.targetLanguage || 'DE'}"`,
      `"${entry.messageType || 'manual'}"`,
      `"${entry.timestamp || Date.now()}"`
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  // FIXED: Import cache data to IndexedDB (EN↔DE only)
  async importCache(translationCache, reverseTranslationCache, data, format = 'json') {
    try {
      await this.ensureInitialized();
      
      let importData;
      
      if (format === 'json') {
        importData = typeof data === 'string' ? JSON.parse(data) : data;
      } else if (format === 'csv') {
        importData = this.parseCSV(data);
      }

      let imported = 0;
      let skipped = 0;
      
      if (importData.translations) {
        for (const entry of importData.translations) {
          if (entry.hash && entry.originalText && entry.translatedText) {
            // FIXED: Only import EN↔DE entries
            if (this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
              const success = await this.storeTranslation(
                translationCache,
                reverseTranslationCache,
                entry.hash,
                entry.originalText,
                entry.translatedText,
                entry.sourceLanguage || 'EN',
                entry.targetLanguage || 'DE',
                entry.messageType || 'imported'
              );
              
              if (success) {
                imported++;
              }
            } else {
              skipped++;
            }
          }
        }
      }

      return { success: true, imported, skipped };
      
    } catch (error) {
      console.error('❌ FIXED: Import to IndexedDB failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Parse CSV data (unchanged from original)
  parseCSV(csvData) {
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { translations: [] };
    
    const translations = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      
      if (values.length >= 7) {
        const hash = values[0].trim().replace(/^"|"$/g, '');
        const originalText = values[1].trim().replace(/^"|"$/g, '');
        const translatedText = values[2].trim().replace(/^"|"$/g, '');
        const sourceLanguage = values[3].trim().replace(/^"|"$/g, '') || 'EN';
        const targetLanguage = values[4].trim().replace(/^"|"$/g, '') || 'DE';
        const messageType = values[5].trim().replace(/^"|"$/g, '') || 'imported';
        const timestamp = parseInt(values[6].trim().replace(/^"|"$/g, '')) || Date.now();
        
        if (originalText && translatedText) {
          translations.push({
            hash: hash || this.generateCacheKey(originalText, targetLanguage, sourceLanguage),
            originalText,
            translatedText,
            sourceLanguage,
            targetLanguage,
            messageType,
            timestamp
          });
        }
      } else if (values.length >= 2) {
        const originalText = values[0].trim().replace(/^"|"$/g, '');
        const translatedText = values[1].trim().replace(/^"|"$/g, '');
        
        if (originalText && translatedText) {
          const hash = this.generateCacheKey(originalText, 'DE', 'EN');
          translations.push({
            hash,
            originalText,
            translatedText,
            sourceLanguage: 'EN',
            targetLanguage: 'DE',
            messageType: 'imported',
            timestamp: Date.now()
          });
        }
      }
    }

    return { translations };
  }

  // Helper function to properly parse CSV lines with quoted values (unchanged)
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    values.push(current);
    return values;
  }

  // FIXED: Clean up old cache entries in IndexedDB (EN↔DE only)
  async cleanupOldEntries(translationCache, reverseTranslationCache, cutoffDate) {
    try {
      await this.ensureInitialized();
      
      const cutoffTimestamp = cutoffDate.getTime();
      let removed = 0;
      
      const transaction = this.db.transaction([this.translationStoreName, this.reverseTranslationStoreName], 'readwrite');
      const translationStore = transaction.objectStore(this.translationStoreName);
      const reverseStore = transaction.objectStore(this.reverseTranslationStoreName);
      
      // Get all data and filter by timestamp and language pair
      const translationData = await this.getAllData(translationStore);
      const reverseData = await this.getAllData(reverseStore);
      
      // Remove old EN↔DE translations
      for (const entry of translationData) {
        if (entry.timestamp < cutoffTimestamp && this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
          await this.deleteData(translationStore, entry.cacheKey);
          
          // Remove from in-memory cache
          if (translationCache) {
            translationCache.delete(entry.cacheKey);
          }
          
          removed++;
        }
      }
      
      // Remove old EN↔DE reverse translations
      for (const entry of reverseData) {
        if (entry.timestamp < cutoffTimestamp && this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
          await this.deleteData(reverseStore, entry.textHash);
          
          // Remove from in-memory cache
          if (reverseTranslationCache) {
            reverseTranslationCache.delete(entry.textHash);
          }
        }
      }
      
      await this.waitForTransaction(transaction);
      
      return removed;
      
    } catch (error) {
      console.error('❌ FIXED: Error cleaning up old entries in IndexedDB:', error);
      return 0;
    }
  }

  // FIXED: Optimize cache by removing duplicates in IndexedDB (EN↔DE only)
  async optimizeCache(translationCache, reverseTranslationCache) {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db.transaction([this.translationStoreName, this.reverseTranslationStoreName], 'readwrite');
      const translationStore = transaction.objectStore(this.translationStoreName);
      const reverseStore = transaction.objectStore(this.reverseTranslationStoreName);
      
      const translationData = await this.getAllData(translationStore);
      
      const seen = new Set();
      let removed = 0;
      
      for (const entry of translationData) {
        // Only process EN↔DE entries
        if (!this.isValidLanguagePair(entry.sourceLanguage, entry.targetLanguage)) {
          continue;
        }
        
        const key = `${entry.originalText.toLowerCase()}_${entry.targetLanguage}`;
        if (seen.has(key)) {
          await this.deleteData(translationStore, entry.cacheKey);
          
          // Remove from in-memory cache
          if (translationCache) {
            translationCache.delete(entry.cacheKey);
          }
          
          // Remove corresponding reverse entry
          const textHash = this.generateTextHash(entry.translatedText);
          await this.deleteData(reverseStore, textHash);
          
          if (reverseTranslationCache) {
            reverseTranslationCache.delete(textHash);
          }
          
          removed++;
        } else {
          seen.add(key);
        }
      }
      
      await this.waitForTransaction(transaction);
      
      return removed;
      
    } catch (error) {
      console.error('❌ FIXED: Error optimizing cache in IndexedDB:', error);
      return 0;
    }
  }

  // FIXED: Clear all cache data from IndexedDB
  async clearAllCache(translationCache, reverseTranslationCache) {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db.transaction([this.translationStoreName, this.reverseTranslationStoreName], 'readwrite');
      const translationStore = transaction.objectStore(this.translationStoreName);
      const reverseStore = transaction.objectStore(this.reverseTranslationStoreName);
      
      await this.clearStore(translationStore);
      await this.clearStore(reverseStore);
      
      await this.waitForTransaction(transaction);
      
      // Clear in-memory caches
      if (translationCache) {
        translationCache.clear();
      }
      if (reverseTranslationCache) {
        reverseTranslationCache.clear();
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ FIXED: Error clearing all cache from IndexedDB:', error);
      return false;
    }
  }

  // Custom emoji storage methods for emoji-manager.js integration (unchanged)
  async saveCustomEmojis(emojiArray) {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db.transaction([this.emojiStoreName], 'readwrite');
      const store = transaction.objectStore(this.emojiStoreName);
      
      // Store emoji array with a fixed ID
      const emojiData = {
        id: 'custom_emojis',
        emojis: emojiArray,
        timestamp: Date.now()
      };
      
      await this.putData(store, emojiData);
      await this.waitForTransaction(transaction);
      
      return true;
      
    } catch (error) {
      console.error('❌ FIXED: Error saving custom emojis to IndexedDB:', error);
      return false;
    }
  }

  async loadCustomEmojis() {
    try {
      await this.ensureInitialized();
      
      const transaction = this.db.transaction([this.emojiStoreName], 'readonly');
      const store = transaction.objectStore(this.emojiStoreName);
      
      const result = await this.getData(store, 'custom_emojis');
      
      if (result && result.emojis) {
        return result.emojis;
      } else {
        return [];
      }
      
    } catch (error) {
      console.error('❌ FIXED: Error loading custom emojis from IndexedDB:', error);
      return [];
    }
  }

  // Close IndexedDB connection
  closeDatabase() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  // Cleanup method
  destroy() {
    this.closeDatabase();
  }
}

// Export for use in other files
window.MaloumCacheStorage = MaloumCacheStorage;