
class FirebaseUsageTracker {
  constructor() {
    // Firebase configuration for usage tracking
    this.firebaseConfig = {
      apiKey: "AIzaSyBl3vp-11RvSqUNlQ-kp9WFMXgwYsHOP3s",
      authDomain: "linguana-24d87.firebaseapp.com",
      databaseURL: "https://linguana-24d87-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "linguana-24d87",
      storageBucket: "linguana-24d87.firebasestorage.app",
      messagingSenderId: "221221344365",
      appId: "1:221221344365:web:dc69ef57081829ff03db64",
      measurementId: "G-94D0M5Y4YJ"
    };
    
    // Database paths for Firebase Realtime Database
    this.paths = {
      usageTracking: 'usage_tracking_realtime',
      userActivity: 'user_activity',
      teamStats: 'team_stats'
    };
    
    this.agencyId = 'default_agency';
    this.username = null;
    this.isOnline = true;
    this.lastActivityTime = Date.now();
    
    console.log('🔥 Firebase Usage Tracker initializing...');
    this.init();
  }

  async init() {
    try {
      await this.initializeUsername();
      
      // Test Firebase connection
      await this.testFirebaseConnection();
      
      // 🔥 CRITICAL: DON'T update user activity on initialization
      // 🔥 CRITICAL: DON'T start heartbeat that could update activity
      // this.startHeartbeat(); // ← COMMENT OUT OR REMOVE THIS LINE
      
      console.log('✅ Firebase Usage Tracker ready for user:', this.username);
      console.log('⚠️ User activity will ONLY be updated on actual API usage');
    } catch (error) {
      console.error('❌ Firebase Usage Tracker initialization failed:', error);
    }
    
    // Keep the cleanup interval (this doesn't affect user activity)
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }


  async initializeUsername() {
    try {
      // Try auth cache first
      const authCacheData = localStorage.getItem('maloum_ultra_auth_v2') || 
                           sessionStorage.getItem('maloum_ultra_auth_v2');
      
      if (authCacheData) {
        const authCache = JSON.parse(authCacheData);
        if (authCache.username) {
          this.username = authCache.username;
          console.log('🔥 Using username from auth cache:', this.username);
          return;
        }
      }
      
      // Fallback to Chrome storage
      const stored = await chrome.storage.sync.get(['username']);
      if (stored.username) {
        this.username = stored.username;
        console.log('🔥 Using username from Chrome storage:', this.username);
        return;
      }
      
      // Final fallback to chatterId
      const result = await chrome.storage.sync.get(['chatterId']);
      this.username = result.chatterId || `user_${Date.now()}`;
      console.log('🔥 Using chatterId as fallback:', this.username);
      
    } catch (error) {
      console.warn('⚠️ Error getting username:', error);
      this.username = `fallback_${Date.now()}`;
    }
  }

  startHeartbeatOnFirstUsage() {
    if (!this.heartbeatStarted) {
      this.heartbeatStarted = true;
      this.startHeartbeat();
      console.log('✅ Heartbeat started after first real usage');
    }
  }

  async testFirebaseConnection() {
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

  async sendUsageData(usageRecord) {
  try {
    console.log('🔥 sendUsageData called with:', usageRecord);
    
    const payload = {
      username: this.username,
      agency_id: this.agencyId,
      timestamp: new Date().toISOString(),
      api_type: usageRecord.apiType || 'unknown',
      input_chars: usageRecord.inputChars || 0,
      prompt_chars: usageRecord.promptChars || 0,
      output_chars: usageRecord.outputChars || 0,
      task_chars: usageRecord.taskChars || 0,
      total_chars: usageRecord.totalChars || 0,
      total_cost: usageRecord.totalCost || 0,
      cache_hits: usageRecord.cacheHits || 0
    };
    
    console.log('🔥 Sending payload to Firebase:', payload);
    
    const response = await fetch(
      `${this.firebaseConfig.databaseURL}/${this.paths.usageTracking}.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    console.log('🔥 Firebase response status:', response.status, response.ok);

    if (response.ok) {
      console.log('✅ Real-time data stored in Firebase');
      
      // 🔥 FIX: Use the new method that only updates for real usage
      await this.updateActivityOnRealUsageOnly(usageRecord.apiType);
      
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to store data:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error storing usage data:', error);
    return false;
  }
}

  async updateUserActivity() {
    try {
      const activityData = {
        username: this.username,
        agency_id: this.agencyId,
        last_activity: new Date().toISOString(),
        is_online: this.isOnline
      };

      // Use Firebase's update method to merge data
      const response = await fetch(
        `${this.firebaseConfig.databaseURL}/${this.paths.userActivity}/${this.username}.json`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(activityData)
        }
      );

      if (response.ok) {
        console.log('🔥 User activity updated in Firebase');
      } else {
        console.warn('⚠️ Failed to update user activity:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Failed to update user activity:', error);
    }
  }

  // Update activity only when user actually uses features
  async updateUserActivityOnUsage() {
  console.log('⚠️ updateUserActivityOnUsage called - but this should not update Firebase automatically');
  // This method is now a no-op to prevent accidental activity updates
  // All real activity updates should go through updateActivityOnRealUsageOnly()
}


  async getFirebaseActiveUsers() {
  try {
    console.log('🔥 Getting active users from Firebase (ULTRA-SAFE)...');
    
    // Check cache first (2 minutes cache for active users)
    const cacheKey = 'active_users_cache';
    const cachedUsers = this.getFromCache(cacheKey, 2 * 60 * 1000); // 2 minutes
    if (cachedUsers) {
      console.log('📦 Using cached active users (2min cache)');
      return cachedUsers;
    }

    // ULTRA-SAFE: Use basic Firebase URL (no query parameters)
    const response = await fetch(
      `${this.firebaseConfig.databaseURL}/${this.paths.userActivity}.json`
    );
    
    if (!response.ok) return [];

    const userData = await response.json();
    if (!userData) return [];

    console.log('🔥 Got user activity data (ULTRA-SAFE basic query)');

    // Smart client-side processing
    const activeUsers = this.processActiveUsersOptimized(userData);
    
    // Cache for 2 minutes
    this.setInCache(cacheKey, activeUsers);
    
    return activeUsers;

  } catch (error) {
    console.warn('⚠️ Error getting active users from Firebase:', error);
    return [];
  }
}


  async cleanupOldDataPeriodically() {
  // Only run cleanup once per day to avoid excessive requests
  const lastCleanup = localStorage.getItem('firebase_last_cleanup');
  const now = Date.now();
  const oneDayInMs = 24 * 60 * 60 * 1000;
  
  if (!lastCleanup || (now - parseInt(lastCleanup)) > oneDayInMs) {
    console.log('🧹 Starting periodic Firebase cleanup...');
    
    try {
      // Get all data
      const response = await fetch(
        `${this.firebaseConfig.databaseURL}/${this.paths.usageTracking}.json`
      );
      
      if (response.ok) {
        const allData = await response.json();
        if (allData) {
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          let deleteCount = 0;
          
          // Delete records older than 30 days
          for (const [key, record] of Object.entries(allData)) {
            if (new Date(record.timestamp).getTime() < thirtyDaysAgo) {
              await fetch(
                `${this.firebaseConfig.databaseURL}/${this.paths.usageTracking}/${key}.json`,
                { method: 'DELETE' }
              );
              deleteCount++;
              
              // Prevent too many rapid requests
              if (deleteCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          }
          
          console.log(`🧹 Cleaned up ${deleteCount} old records`);
        }
      }
      
      localStorage.setItem('firebase_last_cleanup', now.toString());
    } catch (error) {
      console.warn('⚠️ Cleanup failed:', error);
    }
  }
}

  getFromCache(key, maxAge) {
  try {
    const cached = localStorage.getItem(`firebase_cache_${key}`);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > maxAge) {
      localStorage.removeItem(`firebase_cache_${key}`);
      return null;
    }
    
    return data.value;
  } catch (error) {
    return null;
  }
}

  setInCache(key, value) {
  try {
    const data = {
      value: value,
      timestamp: Date.now()
    };
    localStorage.setItem(`firebase_cache_${key}`, JSON.stringify(data));
  } catch (error) {
    // Cache failed, not critical
  }
}





  async getFirebaseCurrentStats() {
  try {
    console.log('🔥 Fetching current stats from Firebase (ULTRA-SAFE)...');
    
    // Check if we have recent cached data (5 minutes cache)
    const cacheKey = 'current_stats_cache';
    const cachedData = this.getFromCache(cacheKey, 5 * 60 * 1000); // 5 minutes
    if (cachedData) {
      console.log('📦 Using cached current stats (5min cache)');
      return cachedData;
    }

    // ULTRA-SAFE: Use basic Firebase URL (no query parameters at all)
    const response = await fetch(
      `${this.firebaseConfig.databaseURL}/${this.paths.usageTracking}.json`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch usage data: ${response.status}`);
    }

    const usageData = await response.json();
    console.log('🔥 Got usage data successfully (ULTRA-SAFE basic query)');
    
    // Smart client-side optimization: Only process recent data
    const processedStats = this.processUsageDataOptimized(usageData);
    
    // Cache the result for 5 minutes to avoid repeated requests
    this.setInCache(cacheKey, processedStats);
    
    return processedStats;

  } catch (error) {
    console.error('❌ Error getting current stats from Firebase:', error);
    return this.getEmptyStats();
  }
}

// HELPER METHOD: Extract processing logic to avoid duplication
  async processUsageData(usageData, needsDateFiltering = false) {
  // Get active users (we'll optimize this separately)
  const activeUsers = await this.getFirebaseActiveUsers();

  // Calculate stats
  let totalApiRequests = 0;
  let totalCacheHits = 0;
  let totalCharacters = 0;
  let totalCost = 0;
  let translationApi = 0;
  let aiAssistApi = 0;

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago for current stats
  let processedRecords = 0;
  
  if (usageData) {
    // If we need client-side filtering (fallback case), apply it
    const recordsToProcess = needsDateFiltering 
      ? Object.values(usageData).filter(r => 
          r.agency_id === this.agencyId && 
          new Date(r.timestamp).getTime() > oneDayAgo
        )
      : Object.values(usageData).filter(r => 
          r.agency_id === this.agencyId
        );

    recordsToProcess.forEach(record => {
      processedRecords++;
      
      if (record.api_type === 'cache_hit') {
        totalCacheHits += record.cache_hits || 1;
        totalCharacters += record.total_chars || 0;
      } else {
        if (record.api_type === 'translation') {
          totalApiRequests++;
          translationApi++;
        } else if (record.api_type === 'ai_assist') {
          totalApiRequests++;
          aiAssistApi++;
        } else if (record.api_type === 'admin_sync_update' || record.api_type === 'admin_refresh_ping') {
          // Don't count admin operations
        } else {
          totalApiRequests++;
        }
        
        totalCharacters += record.total_chars || 0;
        totalCost += record.total_cost || 0;
      }
    });
  }

  const totalRequests = totalApiRequests + totalCacheHits;
  const cacheEfficiency = totalRequests > 0 ? 
    ((totalCacheHits / totalRequests) * 100).toFixed(1) : 0;

  const stats = {
    apiRequests: totalApiRequests,
    cacheHits: totalCacheHits,
    totalCharacters: totalCharacters,
    estimatedCost: Math.max(0, totalCost),
    translationApi: translationApi,
    aiAssistApi: aiAssistApi,
    activeUsers: activeUsers,
    usageData: needsDateFiltering 
      ? Object.values(usageData || {}).filter(r => 
          r.agency_id === this.agencyId && 
          new Date(r.timestamp).getTime() > oneDayAgo
        )
      : Object.values(usageData || {}).filter(r => 
          r.agency_id === this.agencyId
        ),
    languageStats: [],
    cacheEfficiency: parseFloat(cacheEfficiency)
  };

  console.log(`🔥 Processed ${processedRecords} records - Final Firebase stats:`, stats);
  return stats;
}

  

  async cleanupOldData() {
  try {
    // Only run cleanup once per day
    const lastCleanup = localStorage.getItem('firebase_last_cleanup');
    const now = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    
    if (lastCleanup && (now - parseInt(lastCleanup)) < oneDayInMs) {
      console.log('🧹 Cleanup skipped - already ran today');
      return;
    }

    console.log('🧹 Starting Firebase data cleanup (ULTRA-SAFE)...');
    
    // ULTRA-SAFE: Use basic Firebase URL (no query parameters)
    const response = await fetch(
      `${this.firebaseConfig.databaseURL}/${this.paths.usageTracking}.json`
    );

    if (!response.ok) {
      console.warn('⚠️ Cleanup failed - could not fetch data');
      return;
    }

    const allData = await response.json();
    if (!allData) {
      console.log('🧹 No data found for cleanup');
      localStorage.setItem('firebase_last_cleanup', now.toString());
      return;
    }

    console.log('🔥 Got data for cleanup (ULTRA-SAFE basic query)');

    // Smart cleanup: Only process data that's actually old
    const cleaned = await this.performSmartCleanup(allData);
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old records (ULTRA-SAFE)`);
    } else {
      console.log('🧹 No old records found to cleanup');
    }
    
    localStorage.setItem('firebase_last_cleanup', now.toString());
    
  } catch (error) {
    console.warn('⚠️ Data cleanup failed:', error);
  }
}

  processUsageDataOptimized(usageData) {
  const activeUsers = []; // Will get this separately
  
  // Process only recent data for current stats
  let totalApiRequests = 0;
  let totalCacheHits = 0;
  let totalCharacters = 0;
  let totalCost = 0;
  let translationApi = 0;
  let aiAssistApi = 0;

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000; // 24 hours for current stats
  const recentRecords = [];
  
  if (usageData) {
    // Smart filtering: Only process records from last 24 hours for current stats
    Object.values(usageData).forEach(record => {
      if (record.agency_id === this.agencyId) {
        const recordTime = new Date(record.timestamp).getTime();
        
        if (recordTime > oneDayAgo) {
          recentRecords.push(record);
          
          if (record.api_type === 'cache_hit') {
            totalCacheHits += record.cache_hits || 1;
            totalCharacters += record.total_chars || 0;
          } else {
            if (record.api_type === 'translation') {
              totalApiRequests++;
              translationApi++;
            } else if (record.api_type === 'ai_assist') {
              totalApiRequests++;
              aiAssistApi++;
            } else if (record.api_type === 'admin_sync_update' || record.api_type === 'admin_refresh_ping') {
              // Don't count admin operations
            } else {
              totalApiRequests++;
            }
            
            totalCharacters += record.total_chars || 0;
            totalCost += record.total_cost || 0;
          }
        }
      }
    });
  }

  const totalRequests = totalApiRequests + totalCacheHits;
  const cacheEfficiency = totalRequests > 0 ? 
    ((totalCacheHits / totalRequests) * 100).toFixed(1) : 0;

  const stats = {
    apiRequests: totalApiRequests,
    cacheHits: totalCacheHits,
    totalCharacters: totalCharacters,
    estimatedCost: Math.max(0, totalCost),
    translationApi: translationApi,
    aiAssistApi: aiAssistApi,
    activeUsers: activeUsers, // Will be populated separately
    usageData: recentRecords,
    languageStats: [],
    cacheEfficiency: parseFloat(cacheEfficiency)
  };

  console.log(`🔥 Processed ${recentRecords.length} recent records (ULTRA-SAFE)`);
  return stats;
}

  processActiveUsersOptimized(userData) {
  const activeUsers = [];
  const threeDaysAgoMs = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
  const onlineThreshold = 2 * 60 * 1000; // 2 minutes for online status

  // Smart filtering: Only process users with recent activity
  Object.entries(userData).forEach(([userId, userInfo]) => {
    if (userInfo.agency_id !== this.agencyId) return;
    
    const lastActivityTime = new Date(userInfo.last_activity).getTime();
    
    // Skip users with very old activity
    if (lastActivityTime <= threeDaysAgoMs) return;
    
    // FIXED: Only check recent activity for online status, ignore is_online flag
    // This fixes the page reload issue where is_online gets reset
    const isOnline = (Date.now() - lastActivityTime) < onlineThreshold;
    
    // Format display time
    let displayTime;
    if (isOnline) {
      displayTime = 'Online';
    } else {
      const activityDate = new Date(userInfo.last_activity);
      const minutesAgo = Math.floor((Date.now() - activityDate.getTime()) / (1000 * 60));
      
      if (minutesAgo < 60) {
        displayTime = `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
      } else {
        displayTime = this.formatRelativeTime(userInfo.last_activity);
      }
    }
    
    activeUsers.push({
      username: userInfo.username,
      lastActivity: displayTime,
      lastActivityTimestamp: lastActivityTime,
      isOnline: isOnline
    });
  });

  // Sort by most recent activity
  activeUsers.sort((a, b) => b.lastActivityTimestamp - a.lastActivityTimestamp);

  console.log(`🔥 Found ${activeUsers.length} active users (ULTRA-SAFE)`);
  return activeUsers;
}

  async performSmartCleanup(allData) {
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const oldKeys = [];
  
  // Smart filtering: Only find actually old records
  Object.entries(allData).forEach(([key, record]) => {
    if (new Date(record.timestamp).getTime() < thirtyDaysAgoMs) {
      oldKeys.push(key);
    }
  });

  if (oldKeys.length === 0) return 0;

  console.log(`🧹 Found ${oldKeys.length} old records to delete`);
  
  // Delete in very small batches to be safe
  let deleteCount = 0;
  for (let i = 0; i < oldKeys.length; i += 2) {
    const batch = oldKeys.slice(i, i + 2);
    
    const deletePromises = batch.map(key =>
      fetch(`${this.firebaseConfig.databaseURL}/${this.paths.usageTracking}/${key}.json`, {
        method: 'DELETE'
      })
    );
    
    await Promise.all(deletePromises);
    deleteCount += batch.length;
    
    // Small delay between batches
    if (i + 2 < oldKeys.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return deleteCount;
}

  getEmptyStats() {
    return {
      apiRequests: 0,
      cacheHits: 0,
      totalCharacters: 0,
      estimatedCost: 0,
      translationApi: 0,
      aiAssistApi: 0,
      activeUsers: [],
      usageData: [],
      languageStats: [],
      cacheEfficiency: 0
    };
  }

  startHeartbeat() {
  // Browser close detection - mark offline when user closes browser
  window.addEventListener('beforeunload', () => {
    this.isOnline = false;
    // Update immediately on browser close only
    fetch(`${this.firebaseConfig.databaseURL}/${this.paths.userActivity}/${this.username}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        agency_id: this.agencyId,
        last_activity: new Date().toISOString(),
        is_online: false
      }),
      keepalive: true
    });
  });
  
  // 🔥 CRITICAL FIX: Don't start any intervals that could update activity
  // The old setInterval that called checkIfShouldGoOffline is REMOVED
  console.log('✅ Heartbeat started (browser close detection only, no periodic updates)');
}

  async checkIfShouldGoOffline() {
  // 🔥 CRITICAL FIX: Only mark offline, NEVER update Firebase automatically
  const inactiveThreshold = 10 * 60 * 1000; // 10 minutes of no usage
  
  if (this.lastActivityTime && (Date.now() - this.lastActivityTime) > inactiveThreshold) {
    console.log('🔥 User inactive for 10+ minutes, marking offline (locally only)');
    this.isOnline = false;
    
    // 🔥 CRITICAL: DON'T update Firebase here - let it stay with last real usage time
    // await this.updateUserActivity(); // ← REMOVE THIS LINE COMPLETELY
    console.log('⏭️ Firebase activity NOT updated - preserving last real usage time');
  }
}

  async updateActivityOnRealUsageOnly(apiType) {
  // Only update for real API usage, not admin operations
  if (apiType === 'translation' || apiType === 'ai_assist' || apiType === 'cache_hit') {
    try {
      this.lastActivityTime = Date.now();
      this.isOnline = true;
      
      const activityData = {
        username: this.username,
        agency_id: this.agencyId,
        last_activity: new Date().toISOString(),
        is_online: true
      };

      const response = await fetch(
        `${this.firebaseConfig.databaseURL}/${this.paths.userActivity}/${this.username}.json`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(activityData)
        }
      );
      
      if (response.ok) {
        console.log(`✅ User activity updated for real usage: ${apiType}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to update user activity:', error);
    }
  } else {
    console.log(`⏭️ Skipped activity update for: ${apiType} (not real usage)`);
  }
}

  // Force send current data (used by admin refresh)
  async forceSendCurrentData() {
  try {
    console.log('🔥 MaloumCacheManager: Force sending activity ping only (NO cumulative data)');
    
    // 🔥 CRITICAL FIX: Send ZERO for all data - this is just an activity ping
    const usageRecord = {
      timestamp: new Date().toISOString(),
      apiType: 'admin_refresh_ping', // This will be ignored for user activity updates
      inputChars: 0,        // ← ZERO (not cumulative)
      promptChars: 0,       // ← ZERO (not cumulative)
      outputChars: 0,       // ← ZERO (not cumulative)
      taskChars: 0,         // ← ZERO (not cumulative)
      totalChars: 0,        // ← ZERO (not cumulative data!)
      totalCost: 0,         // ← ZERO (not cumulative)
      cacheHits: 0          // ← ZERO (not cumulative)
    };
    
    console.log('🔥 Sending ZERO-DATA activity ping only:', usageRecord);
    console.log('⚠️ This should NOT add any numbers to Firebase totals');
    
    // Send to Firebase tracker
    if (this.firebaseTracker) { 
      await this.firebaseTracker.sendUsageData(usageRecord);  
      console.log('✅ Activity ping sent (zero data, no user activity update)');
    } else {
      console.warn('⚠️ No firebaseTracker available');
    }
    
    console.log('✅ MaloumCacheManager: Activity ping sent successfully (NO DATA ADDED)');
    return true;
  } catch (error) {
    console.error('❌ MaloumCacheManager: Error sending activity ping:', error);
    return false;
  }
}
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseUsageTracker;
}

class MaloumCacheManager {
  constructor() {
    // Singleton pattern - prevent multiple instances
    if (window.maloumInstances && window.maloumInstances.cacheManager) {
      window.maloumInstances.cacheManager.destroy();
    }

    // Initialize global instances registry
    window.maloumInstances = window.maloumInstances || {};
    window.maloumInstances.cacheManager = this;

    // DEBUG FLAG: Set to false to hide verbose logs (only show batch translation logs)
    this.verboseLogging = false;

    this.firebaseTracker = new FirebaseUsageTracker();
    this.translationCache = new Map();
    this.reverseTranslationCache = new Map();
    this.cacheKey = 'maloum_translations_cache';
    this.reverseCacheKey = 'maloum_reverse_translations_cache';
    this.initialized = false;
    this.initPromise = null;
    this.isUIOpen = false;
    this.keyboardHandler = null; // Track handler for cleanup
    this.unloadHandler = null; // Track unload handler
    this.storage = null;
    this.storageReady = false;
    this.cacheHits = 0;
    this.apiRequests = 0;
    this.totalCharactersUsed = 0;
    this.translationRequests = 0;
    this.aiAssistRequests = 0;
    this.translationCost = 0;
    this.aiAssistCost = 0;
    this.lastRequestId = null;
    this.lastRequestTime = 0;
    this.lastCacheHitTime = 0;

    // Setup cleanup before other initialization
    this.setupUnloadCleanup();
    this.setupKeyboardShortcuts();
    this.initPromise = this.init().catch(error => {
      console.error('❌ Cache Manager initialization failed:', error);
    });
    this.registerWithGlobalUIManager();
    window.maloumUIManager.register(this, 'cache');
    this.loadTrackingStats();
    this.startBatchSending();

    // PRICING CONSTANTS for Llama 3.3 70B Instruct Turbo (Together.xyz)
    this.PRICING = {
      COST_PER_1M_TOKENS: 0.88,  // ✅ OFFICIAL Together.xyz price: $0.88 per 1M tokens
      CHARS_PER_TOKEN: 4  // Average characters per token
    };

    // Approximate tokens per character (rough estimate: 1 token ≈ 4 characters)
    this.CHARS_PER_TOKEN = 4;
  }

  // Helper method for verbose logging
  vlog(...args) {
    if (this.verboseLogging) {
      console.log(...args);
    }
  }
  // Add this to each manager class
  registerWithGlobalUIManager() {
    // Initialize global UI manager if it doesn't exist
    if (!window.maloumUIManager) {
      window.maloumUIManager = {
        activeUI: null,
        managers: new Set(),
        escapeHandler: null,
        
        register(manager, uiType) {
          this.managers.add({ manager, uiType });
          
          // Set up global escape handler only once
          if (!this.escapeHandler) {
            this.escapeHandler = (e) => {
              if (e.key === 'Escape' && this.activeUI) {
                e.preventDefault();
                e.stopPropagation();
                this.closeActiveUI();
              }
            };
            document.addEventListener('keydown', this.escapeHandler, true);
          }
        },
        
        openUI(manager, uiType) {
          // Close all other UIs first
          this.closeAllExcept(manager);
          this.activeUI = { manager, uiType };
        },
        
        closeUI(manager) {
          if (this.activeUI && this.activeUI.manager === manager) {
            this.activeUI = null;
          }
        },
        
        closeActiveUI() {
          if (this.activeUI) {
            const { manager, uiType } = this.activeUI;
            switch(uiType) {
              case 'cache':
                if (manager.isUIOpen) manager.closeCacheUI();
                break;
              case 'assist':
                if (manager.isAssistUIOpen) manager.closeAssistUI();
                break;
              case 'prompt':
                if (manager.isPromptUIOpen) manager.closePromptInput();
                break;
              case 'emoji':
                if (manager.isPickerOpen) manager.closeEmojiPicker();
                break;
            }
          }
        },
        
        closeAllExcept(exceptManager) {
          this.managers.forEach(({ manager, uiType }) => {
            if (manager !== exceptManager) {
              switch(uiType) {
                case 'cache':
                  if (manager.isUIOpen) manager.closeCacheUI();
                  break;
                case 'assist':
                  if (manager.isAssistUIOpen) manager.closeAssistUI();
                  break;
                case 'prompt':
                  if (manager.isPromptUIOpen) manager.closePromptInput();
                  break;
                case 'emoji':
                  if (manager.isPickerOpen) manager.closeEmojiPicker();
                  break;
              }
            }
          });
        }
      };
    }
  }
  async init() {
    try {
      // FIXED: Initialize storage first
      await this.initializeStorage();
      
      await this.loadTranslationCache();
      await this.loadReverseTranslationCache();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Cache Manager initialization failed:', error);
      // Set as initialized even if some parts failed
      this.initialized = true;
      return false;
    }
  }
  setupKeyboardShortcuts() {
    
    // Remove any existing listeners FIRST to prevent duplicates
    this.removeKeyboardShortcuts();
    
    this.keyboardHandler = (e) => {
      // Alt + K to toggle cache manager
      if (e.altKey && e.key.toLowerCase() === 'k' && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        // Prevent default behavior and event bubbling
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        
        // Add a small delay to ensure proper state handling
        setTimeout(() => {
          try {
            if (this.isUIOpen) {
              this.closeCacheUI();
            } else {
              this.openCacheUI();
            }
          } catch (error) {
            console.error('❌ Error handling Alt+K shortcut:', error);
          }
        }, 10);
        
        return false;
      }
      
      // ESC key - only handle if our UI is open and visible
      if (e.key === 'Escape' && this.isUIOpen) {
        const container = document.getElementById('maloum-cache-backdrop');
        if (container && container.style.opacity !== '0' && container.style.display !== 'none') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          setTimeout(() => {
            this.closeCacheUI();
          }, 10);
          
          return false;
        }
      }
    };
    
    // Add event listener with capture phase and high priority
    document.addEventListener('keydown', this.keyboardHandler, {
      capture: true,
      passive: false
    });
    
    // Also add to window as fallback
    window.addEventListener('keydown', this.keyboardHandler, {
      capture: true,
      passive: false
    });
    
  }
  setupUnloadCleanup() {
  this.unloadHandler = () => {
    this.destroy();
  };
  
  window.addEventListener('beforeunload', this.unloadHandler);
  window.addEventListener('unload', this.unloadHandler);
}

  removeKeyboardShortcuts() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, true);
      this.keyboardHandler = null;
    }
  }

  destroy() {
    
    // Remove keyboard handlers
    this.removeKeyboardShortcuts();
    
    // Remove unload handlers
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler);
      window.removeEventListener('unload', this.unloadHandler);
      this.unloadHandler = null;
    }
    
    // Close UI if open
    if (this.isUIOpen) {
      this.performFallbackCleanup();
      this.isUIOpen = false;
    }
    
    // Clear global reference
    if (window.maloumInstances && window.maloumInstances.cacheManager === this) {
      delete window.maloumInstances.cacheManager;
    }
    
  }
  // FIXED: New method to properly initialize storage
  async initializeStorage() {
    try {
      
      // Check if storage class is available
      if (typeof MaloumCacheStorage === 'undefined') {
        console.warn('⚠️ MaloumCacheStorage not available, using fallback methods');
        this.storage = null;
        this.storageReady = false;
        return false;
      }
      
      // Create storage instance
      this.storage = new MaloumCacheStorage();
      
      // Wait for storage to initialize
      if (this.storage.initPromise) {
        await this.storage.initPromise;
      }
      
      this.storageReady = this.storage.isInitialized;
      
      return this.storageReady;
    } catch (error) {
      console.error('❌ Storage initialization failed:', error);
      this.storage = null;
      this.storageReady = false;
      return false;
    }
  }

/* Newly Add */

  async forceSendCurrentData() {
  try {
    console.log('🔥 MaloumCacheManager: Force sending activity ping only (NO cumulative data)');
    
    // 🔥 CRITICAL FIX: Send ZERO for all data - this is just an activity ping
    const usageRecord = {
      timestamp: new Date().toISOString(),
      apiType: 'admin_refresh_ping', // This will be ignored for user activity updates
      inputChars: 0,        // ← ZERO (not cumulative)
      promptChars: 0,       // ← ZERO (not cumulative)
      outputChars: 0,       // ← ZERO (not cumulative)
      taskChars: 0,         // ← ZERO (not cumulative)
      totalChars: 0,        // ← ZERO (not cumulative data!)
      totalCost: 0,         // ← ZERO (not cumulative)
      cacheHits: 0          // ← ZERO (not cumulative)
    };
    
    console.log('🔥 Sending ZERO-DATA activity ping only:', usageRecord);
    console.log('⚠️ This should NOT add any numbers to Firebase totals');
    
    // Send to Firebase tracker
    if (this.firebaseTracker) { 
      await this.firebaseTracker.sendUsageData(usageRecord);  
      console.log('✅ Activity ping sent (zero data, no user activity update)');
    } else {
      console.warn('⚠️ No firebaseTracker available');
    }
    
    console.log('✅ MaloumCacheManager: Activity ping sent successfully (NO DATA ADDED)');
    return true;
  } catch (error) {
    console.error('❌ MaloumCacheManager: Error sending activity ping:', error);
    return false;
  }
}


  detectTaskInPrompt(fullPromptText) {
  if (!fullPromptText) {
    return { promptChars: 0, taskChars: 0, taskFound: false };
  }

  this.vlog('🔍 DETECTING TASK IN PROMPT:');
  this.vlog('📄 Full prompt text:', fullPromptText);
  this.vlog('📏 Total length:', fullPromptText.length);

  let promptChars = fullPromptText.length;
  let taskChars = 0;
  let taskFound = false;

  // Enhanced patterns - more comprehensive and specific
  const taskPatterns = [
    // NEW: Batch translation patterns (most specific - check first!)
    /\n\nTask: Translate from .+ to .+\.\n\nIMPORTANT: You will receive multiple numbered messages.+$/s,
    /\nTask: Translate from .+ to .+\.\n\nIMPORTANT: You will receive multiple numbered messages.+$/s,

    // Translation task patterns (most specific first)
    /\n\nTask: Translate from .+ to .+\.?$/s,
    /\nTask: Translate from .+ to .+\.?$/s,
    /Task: Translate from .+ to .+\.?$/s,

    // Alternative task formats
    /\n\nTranslate from .+ to .+\.?$/s,
    /\nTranslate from .+ to .+\.?$/s,
    /Translate from .+ to .+\.?$/s,

    // Any task patterns
    /\n\nTask: .+$/s,
    /\nTask: .+$/s,
    /Task: .+$/s,

    // AI assist patterns
    /\n\nGenerate exactly 3 numbered .+$/s,
    /\nGenerate exactly 3 numbered .+$/s,
    /Generate exactly 3 numbered .+$/s,

    // General instruction patterns (last resort)
    /\n\n[A-Z][^.]*\.?\s*$/s,
  ];

  // Try each pattern and log results
  for (let i = 0; i < taskPatterns.length; i++) {
    const pattern = taskPatterns[i];
    this.vlog(`🔍 Trying pattern ${i}:`, pattern);

    const taskMatch = fullPromptText.match(pattern);
    if (taskMatch) {
      taskChars = taskMatch[0].length;
      promptChars = fullPromptText.length - taskChars;
      taskFound = true;

      this.vlog('✅ PATTERN MATCHED!');
      this.vlog('📝 Matched text:', `"${taskMatch[0]}"`);
      this.vlog('📊 Task chars:', taskChars);
      this.vlog('📊 Prompt chars:', promptChars);

      break;
    } else {
      this.vlog('❌ Pattern did not match');
    }
  }

  // If no pattern matched, use intelligent estimation
  if (!taskFound) {
    this.vlog('🔍 No patterns matched, using intelligent task estimation...');

    // The issue: We're only getting the custom prompt, but the ACTUAL API call
    // includes a task instruction like "Task: Translate from English to German."
    // Since we can't see it here, we need to estimate it

    // Standard task instruction is usually around 35-45 characters
    // "Task: Translate from English to German." = 39 characters
    // "Task: Translate from German to English." = 39 characters
    const estimatedTaskChars = 39; // Reasonable estimate

    // Treat the current text as just the prompt part
    promptChars = fullPromptText.length;
    taskChars = estimatedTaskChars;
    taskFound = true;

    this.vlog('✅ INTELLIGENT ESTIMATION APPLIED!');
    this.vlog('📊 Estimated task chars:', taskChars);
    this.vlog('📊 Prompt chars:', promptChars);
    this.vlog('💡 Note: Task instruction added separately by API call');
  }

  if (!taskFound) {
    this.vlog('❌ NO TASK FOUND - treating entire text as prompt');
    this.vlog('📊 Final result: promptChars =', promptChars, ', taskChars =', taskChars);
  } else {
    this.vlog('✅ TASK DETECTION COMPLETE');
    this.vlog('📊 Final result: promptChars =', promptChars, ', taskChars =', taskChars);
  }

  return { promptChars, taskChars, taskFound };
}

  detectApiType(inputText, promptText) {
  if (!promptText) return 'unknown';


  // Check for AI assist patterns (more specific patterns first)
  if (promptText.includes('Generate exactly 3 numbered') ||
      promptText.includes('reply suggestions') ||
      promptText.includes('conversation assistant') ||
      promptText.includes('dating conversation') ||
      promptText.includes('romantic conversations')) {
    return 'ai_assist';
  }

  // Check for translation patterns
  if (promptText.includes('Translate from') || 
      promptText.includes('translator') ||
      promptText.includes('translation') ||
      promptText.includes('Translate casual') ||
      promptText.includes('English into') ||
      promptText.includes('German')) {
    return 'translation';
  }

  // Fallback: check input length and content
  if (inputText) {
    if (inputText.length > 50) {
      return 'translation';
    } else if (inputText.length < 20) {
      return 'ai_assist';
    }
  }

  return 'unknown';
}

  calculateCost(inputChars, promptChars, outputChars, taskChars) {
  const inputTokens = Math.ceil(inputChars / this.PRICING.CHARS_PER_TOKEN);
  const promptTokens = Math.ceil(promptChars / this.PRICING.CHARS_PER_TOKEN);
  const outputTokens = Math.ceil(outputChars / this.PRICING.CHARS_PER_TOKEN);
  const taskTokens = Math.ceil(taskChars / this.PRICING.CHARS_PER_TOKEN);

  // ✅ FIXED: Use Together.xyz unified pricing
  const totalTokens = inputTokens + promptTokens + outputTokens + taskTokens;
  const totalCost = (totalTokens * this.PRICING.COST_PER_1M_TOKENS) / 1000000;

  return {
    inputCost: (inputTokens * this.PRICING.COST_PER_1M_TOKENS) / 1000000,
    promptCost: (promptTokens * this.PRICING.COST_PER_1M_TOKENS) / 1000000,
    outputCost: (outputTokens * this.PRICING.COST_PER_1M_TOKENS) / 1000000,
    taskCost: (taskTokens * this.PRICING.COST_PER_1M_TOKENS) / 1000000,
    totalCost: totalCost,
    totalTokens: totalTokens
  };
}
  updateStatistics(apiType, usageRecord) {
  // Update general statistics
  this.apiRequests++;
  this.totalCharactersUsed += usageRecord.totalChars;

  // Update API-specific statistics
  if (apiType === 'translation') {
    this.translationRequests++;
    this.translationCost += usageRecord.totalCost;
  } else if (apiType === 'ai_assist') {
    this.aiAssistRequests++;
    this.aiAssistCost += usageRecord.totalCost;
  }

  // Save updated statistics
  this.saveTrackingStats();
}

  async sendBulkUsageDataBatch(records) {
  try {
    const firebaseConfig = {
      databaseURL: "https://linguana-24d87-default-rtdb.asia-southeast1.firebasedatabase.app"
    };

    console.log(`🔥 Sending bulk data to Firebase (batch): ${records.length} records`);
    
    // Create batch update object
    const updates = {};
    
    records.forEach((record) => {
      // Generate unique key for each record
      const recordKey = `usage_tracking_realtime/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      updates[recordKey] = {
        username: this.username,
        agency_id: this.agencyId,
        timestamp: new Date(record.timestamp).toISOString(),
        api_type: record.apiType || 'unknown',
        input_chars: record.inputChars || 0,
        prompt_chars: record.promptChars || 0,
        output_chars: record.outputChars || 0,
        task_chars: record.taskChars || 0,
        total_chars: record.totalChars || 0,
        total_cost: record.totalCost || 0,
        cache_hits: record.cacheHits || 0
      };
    });

    // Send batch update to Firebase
    const response = await fetch(
      `${firebaseConfig.databaseURL}/.json`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }
    );

    if (response.ok) {
      console.log(`✅ Firebase batch update successful: ${records.length} records stored`);
      
      // Update user activity after batch insert
      await this.updateUserActivityOnUsage();
      
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Firebase batch update failed:', response.status, errorText);
      return false;
    }

  } catch (error) {
    console.error('❌ Firebase batch update error:', error);
    return false;
  }
}
  sendDataToTracker(usageData) {
  try {
    // Format data for tracker consumption
    const trackerData = this.formatDataForTracker(usageData);
    
    // Send to tracker if available
    if (window.agencyTracker && typeof window.agencyTracker.receiveUsageData === 'function') {
      window.agencyTracker.receiveUsageData(trackerData);
    } else {
      // Store for later if tracker isn't loaded yet
      this.storeForTracker(trackerData);
    }

    // CHANGED: Store for batch sending instead of immediate sending
    this.storeForBatchSending(usageData);
    
  } catch (error) {
    console.error('❌ Error sending data to tracker:', error);
  }
}

// NEW: Add this method for batch storage
  storeForBatchSending(usageData) {
  this.vlog('🔍 storeForBatchSending called with:', usageData);

  // Store data for batch sending every 5 minutes
  if (!window.batchPendingData) {
    window.batchPendingData = [];
  }
  window.batchPendingData.push(usageData);

  this.vlog('🔍 Current batch size:', window.batchPendingData.length);
}
// Add this method to your CacheManager class
  startBatchSending() {
  this.vlog('📊 Starting batch sending timer');

  setInterval(async () => {
    if (window.batchPendingData && window.batchPendingData.length > 0) {
      const batchSize = window.batchPendingData.length;
      this.vlog(`🔍 Processing batch of ${batchSize} items`);

      const startTime = Date.now();
      const batchToProcess = [...window.batchPendingData];
      window.batchPendingData = []; // Clear immediately

      try {
        // Process each item individually using existing method
        for (const data of batchToProcess) {
          this.vlog('🔍 Processing batch item:', data);
          await this.sendUsageDataToDatabase(data);
        }

        const duration = Date.now() - startTime;
        this.vlog(`📊 Batch of ${batchSize} processed in ${duration}ms`);

      } catch (error) {
        console.error('❌ Batch processing error:', error);
        // Re-queue failed items
        window.batchPendingData.unshift(...batchToProcess);
      }
    }
  }, 5 * 1000); // Process every 5 seconds
}


  formatDataForTracker(usageData) {
  return {
    timestamp: usageData.timestamp,
    apiType: usageData.apiType,
    inputChars: usageData.inputChars,
    promptChars: usageData.promptChars,
    outputChars: usageData.outputChars,
    othersChars: usageData.othersChars,
    totalChars: usageData.totalChars,
    totalCost: usageData.totalCost,
    source: 'cache_manager'
  };
}

  storeForTracker(data) {
  // Store data that tracker can pick up later
  if (!window.pendingTrackerData) {
    window.pendingTrackerData = [];
  }
  window.pendingTrackerData.push(data);
}

  getApiRequestsCount() {
  return this.apiRequests;
}

  getTotalCharactersUsed() {
  return this.totalCharactersUsed;
}

  getEstimatedCost() {
  // ISSUE 4 FIX: Return total cost with 6 decimal places
  const totalCost = (this.translationCost || 0) + (this.aiAssistCost || 0);
  return totalCost;
}

  getTranslationStats() {
  return {
    requests: this.translationRequests,
    cost: this.translationCost
  };
}

  getAIAssistStats() {
  return {
    requests: this.aiAssistRequests,
    cost: this.aiAssistCost
  };
}

  getCacheEfficiency() {
  if (this.apiRequests === 0) return 0;
  return ((this.cacheHits / this.apiRequests) * 100).toFixed(1);
}

  updateStatistics(apiType, usageRecord) {


  // Update general statistics
  this.apiRequests++;
  this.totalCharactersUsed += usageRecord.totalChars;

  // Update API-specific statistics
  if (apiType === 'translation') {
    this.translationRequests++;
    this.translationCost += usageRecord.totalCost;
  } else if (apiType === 'ai_assist') {
    this.aiAssistRequests++;
    this.aiAssistCost += usageRecord.totalCost;
  }

  // Save updated statistics
  this.saveTrackingStats();
  
}
  createStatisticsBoxes(filteredUsageData = null) {
  // If filtered data is provided, calculate from that data, otherwise use totals
  let apiRequests, cacheHits, totalCharacters, totalCost, translationRequests, aiAssistRequests, translationCost, aiAssistCost;
  
  if (filteredUsageData !== null) {
    // Calculate from filtered data
    const stats = filteredUsageData.reduce((acc, item) => {
      if (item.apiType === 'cache_hit') {
        acc.cacheHits++;
      } else {
        acc.apiRequests++;
      }
      
      acc.totalCharacters += item.totalChars || 0;
      acc.totalCost += item.totalCost || 0;
      
      if (item.apiType === 'translation') {
        acc.translationRequests++;
        acc.translationCost += item.totalCost || 0;
      } else if (item.apiType === 'ai_assist') {
        acc.aiAssistRequests++;
        acc.aiAssistCost += item.totalCost || 0;
      }
      
      return acc;
    }, { 
      apiRequests: 0, 
      cacheHits: 0,
      totalCharacters: 0, 
      totalCost: 0, 
      translationRequests: 0, 
      aiAssistRequests: 0,
      translationCost: 0,
      aiAssistCost: 0
    });
    
    apiRequests = stats.apiRequests;
    cacheHits = stats.cacheHits;
    totalCharacters = stats.totalCharacters;
    totalCost = stats.totalCost;
    translationRequests = stats.translationRequests;
    aiAssistRequests = stats.aiAssistRequests;
    translationCost = stats.translationCost;
    aiAssistCost = stats.aiAssistCost;
  } else {
    // Use global totals (original behavior)
    apiRequests = this.getApiRequestsCount();
    cacheHits = this.cacheHits;
    totalCharacters = this.getTotalCharactersUsed();
    totalCost = this.getEstimatedCost();
    translationRequests = this.translationRequests;
    aiAssistRequests = this.aiAssistRequests;
    translationCost = this.translationCost;
    aiAssistCost = this.aiAssistCost;
  }

  // Calculate efficiency
  const totalRequests = cacheHits + apiRequests;
  const cacheEfficiency = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;

  // Create the grid container with updated values
  let gridHtml = `
    <div style="
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
      gap: 20px !important;
      margin-bottom: 32px !important;
    ">
  `;

  // Define the 6 statistics boxes
  const statCards = [
    { 
      label: 'API Requests', 
      value: apiRequests.toLocaleString(),
      description: 'Total API calls made for translations and AI assist',
      accent: '#3b82f6'
    },
    { 
      label: 'Cache Hits', 
      value: cacheHits.toLocaleString(),
      description: 'Number of times translations were found in cache',
      accent: '#10b981'
    },
    { 
      label: 'Total Characters', 
      value: totalCharacters.toLocaleString(),
      description: 'Total characters processed through both APIs',
      accent: '#8b5cf6'
    },
    { 
      label: 'Estimated Cost', 
      value: `$${totalCost.toFixed(6)}`,
      description: 'Total estimated cost for all API usage',
      accent: '#f59e0b'
    },
    { 
      label: 'Translation API', 
      value: translationRequests.toLocaleString(),
      description: 'Number of translation API requests made',
      accent: '#ef4444'
    },
    { 
      label: 'AI Assist API', 
      value: aiAssistRequests.toLocaleString(),
      description: 'Number of AI assist API requests made',
      accent: '#06b6d4'
    }
  ];

  // Generate each card
  statCards.forEach((stat, index) => {
    // Add efficiency badge for cache hits
    let efficiencyBadge = '';
    if (stat.label === 'Cache Hits' && cacheEfficiency > 0) {
      efficiencyBadge = `
        <div style="
          position: absolute;
          top: 8px;
          right: 8px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
        ">${cacheEfficiency}% efficient</div>
      `;
    }

    gridHtml += `
      <div class="stats-card" style="
        background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%) !important;
        padding: 24px !important;
        border-radius: 12px !important;
        border: 1px solid #e5e7eb !important;
        text-align: center !important;
        position: relative !important;
        overflow: hidden !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
      "
      onmouseenter="
        this.style.transform = 'translateY(-4px) scale(1.02)';
        this.style.boxShadow = '0 8px 25px ${stat.accent}20, 0 4px 12px rgba(0, 0, 0, 0.15)';
        this.style.borderColor = '${stat.accent}';
        this.style.background = 'linear-gradient(135deg, ${stat.accent}08 0%, #ffffff 100%)';
        this.querySelector('.accent-line').style.width = '100%';
        this.querySelector('.card-tooltip').style.opacity = '1';
        this.querySelector('.card-tooltip').style.transform = 'translateY(0)';
      "
      onmouseleave="
        this.style.transform = 'translateY(0) scale(1)';
        this.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
        this.style.borderColor = '#e5e7eb';
        this.style.background = 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)';
        this.querySelector('.accent-line').style.width = '0%';
        this.querySelector('.card-tooltip').style.opacity = '0';
        this.querySelector('.card-tooltip').style.transform = 'translateY(8px)';
      ">
        ${efficiencyBadge}
        <div class="accent-line" style="
          position: absolute;
          top: 0;
          left: 0;
          height: 3px;
          width: 0%;
          background: ${stat.accent};
          transition: width 0.3s ease;
        "></div>
        <div style="
          font-size: 28px;
          font-weight: 700;
          color: #374151;
          margin-bottom: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        ">${stat.value}</div>
        <div style="
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
          margin-bottom: 4px;
        ">${stat.label}</div>
        <div class="card-tooltip" style="
          font-size: 12px;
          color: #9ca3af;
          opacity: 0;
          transform: translateY(8px);
          transition: all 0.2s ease;
          margin-top: 8px;
          line-height: 1.4;
        ">${stat.description}</div>
      </div>
    `;
  });

  gridHtml += '</div>';
  return gridHtml;
}

  createCustomDatePickerContainer() {
  return `
    <div style="
      margin-top: 16px;
      padding: 16px;
      background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
      border-radius: 12px;
      border: 1px solid #fed7aa;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    ">
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 12px;
      ">
        <h5 style="
          margin: 0;
          font-size: 14px;
          color: #c2410c;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          📅 Custom Date Range
        </h5>
      </div>
      
      <div style="
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        background: white;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #fed7aa;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="
            font-size: 12px;
            color: #9a3412;
            font-weight: 500;
            min-width: 35px;
          ">From:</label>
          <input 
            type="date" 
            id="usage-from-date" 
            style="
              padding: 6px 8px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 12px;
              color: #374151;
              background: white;
              cursor: pointer;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.borderColor='#f43e06'"
            onmouseout="this.style.borderColor='#d1d5db'"
          />
        </div>
        
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="
            font-size: 12px;
            color: #9a3412;
            font-weight: 500;
            min-width: 25px;
          ">To:</label>
          <input 
            type="date" 
            id="usage-to-date" 
            style="
              padding: 6px 8px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 12px;
              color: #374151;
              background: white;
              cursor: pointer;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.borderColor='#f43e06'"
            onmouseout="this.style.borderColor='#d1d5db'"
          />
        </div>
        
        <button 
          id="apply-custom-date" 
          style="
            padding: 6px 16px;
            background: linear-gradient(135deg, #f43e06 0%, #ff6b35 100%);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(244, 62, 6, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          "
          onmouseenter="
            this.style.transform = 'translateY(-2px) scale(1.02)';
            this.style.boxShadow = '0 4px 12px rgba(244, 62, 6, 0.4)';
            this.style.background = 'linear-gradient(135deg, #dc2626 0%, #f43e06 100%)';
          "
          onmouseleave="
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '0 2px 4px rgba(244, 62, 6, 0.3)';
            this.style.background = 'linear-gradient(135deg, #f43e06 0%, #ff6b35 100%)';
          "
        >Apply</button>
        
        <button 
          id="clear-custom-date" 
          style="
            padding: 6px 12px;
            background: rgba(107, 114, 128, 0.1);
            color: #6b7280;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
          "
          onmouseenter="
            this.style.background = 'rgba(107, 114, 128, 0.2)';
            this.style.borderColor = '#9ca3af';
          "
          onmouseleave="
            this.style.background = 'rgba(107, 114, 128, 0.1)';
            this.style.borderColor = '#d1d5db';
          "
        >Clear</button>
      </div>
    </div>
  `;
}

  setupCustomDatePicker(container) {
  const applyButton = container.querySelector('#apply-custom-date');
  const clearButton = container.querySelector('#clear-custom-date');
  const fromDateInput = container.querySelector('#usage-from-date');
  const toDateInput = container.querySelector('#usage-to-date');
  
  // Apply custom date filter
  applyButton.addEventListener('click', async () => {
    const fromDate = fromDateInput.value;
    const toDate = toDateInput.value;
    
    if (!fromDate || !toDate) {
      this.showToast('Please select both from and to dates', 'error');
      return;
    }
    
    if (new Date(fromDate) > new Date(toDate)) {
      this.showToast('From date cannot be later than to date', 'error');
      return;
    }
    
    // Clear active state from quick filter buttons
    const quickFilterButtons = container.querySelectorAll('.filter-btn');
    quickFilterButtons.forEach(btn => {
      btn.style.border = '1px solid #d1d5db';
      btn.style.background = 'white';
      btn.style.color = '#374151';
      btn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    });
    
    // FIXED: Get custom filtered data and update statistics boxes
    try {
      const customData = await this.getCharacterUsageData('Custom', fromDate, toDate);
      
      // Update statistics boxes with custom filtered data
      const statsContainer = document.querySelector('#responsive-stats-grid');
      if (statsContainer) {
        statsContainer.innerHTML = this.createStatisticsBoxes(customData);
      }
    } catch (error) {
      console.error('❌ Error updating statistics boxes for custom date:', error);
    }
    
    // Update the table
    const reportContent = container.querySelector('#character-usage-report');
    if (reportContent) {
      await this.loadCharacterUsageReport(reportContent, 'Custom', fromDate, toDate);
    }
    
    this.showToast(`Applied custom filter: ${fromDate} to ${toDate}`, 'success');
  });
  
  // Clear custom date filter
  clearButton.addEventListener('click', async () => {
    fromDateInput.value = '';
    toDateInput.value = '';
    
    // Reset to Today filter
    const todayButton = container.querySelector('.filter-btn[data-filter="Today"]');
    if (todayButton) {
      // Trigger the Today filter which will update both boxes and table
      await this.applyDateFilter('Today', container);
      
      // Update button styling for Today
      todayButton.style.border = '1px solid #f43e06';
      todayButton.style.background = 'linear-gradient(135deg, #f43e06, #ff6b35)';
      todayButton.style.color = 'white';
      todayButton.style.boxShadow = '0 2px 4px rgba(244, 62, 6, 0.3)';
    }
    
    this.showToast('Custom date filter cleared', 'success');
  });
  
  // Set default dates (last 7 days)
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
  
  toDateInput.value = today.toISOString().split('T')[0];
  fromDateInput.value = sevenDaysAgo.toISOString().split('T')[0];
}


  async loadTrackingStats() {
  try {
    const result = await chrome.storage.local.get(['cacheManagerStats']);
    const stats = result.cacheManagerStats;
    
    if (stats) {
      this.apiRequests = stats.apiRequests || 0;
      this.cacheHits = stats.cacheHits || 0;
      this.totalCharactersUsed = stats.totalCharactersUsed || 0;
      // NEW: Load API-specific stats
      this.translationRequests = stats.translationRequests || 0;
      this.aiAssistRequests = stats.aiAssistRequests || 0;
      this.translationCost = stats.translationCost || 0;
      this.aiAssistCost = stats.aiAssistCost || 0;
      
    }
  } catch (error) {
    console.error('❌ Error loading tracking stats:', error);
  }
}



  saveTrackingStats() {
  try {
    const stats = {
      apiRequests: this.apiRequests,
      cacheHits: this.cacheHits,
      totalCharactersUsed: this.totalCharactersUsed,
      // NEW: Save API-specific stats
      translationRequests: this.translationRequests,
      aiAssistRequests: this.aiAssistRequests,
      translationCost: this.translationCost,
      aiAssistCost: this.aiAssistCost,
      lastUpdated: Date.now()
    };
    
    chrome.storage.local.set({ 
      cacheManagerStats: stats 
    }, () => {
    });
    
  } catch (error) {
    console.error('❌ Error saving tracking stats:', error);
  }
}


  incrementCacheHits(sendToFirebase = true) {
  // Prevent rapid duplicate calls
  const now = Date.now();
  if (this.lastCacheHitTime && (now - this.lastCacheHitTime) < 100) {
    this.vlog('🚫 Duplicate cache hit prevented');
    return;
  }
  this.lastCacheHitTime = now;
  
  // Start heartbeat on first real usage
  if (window.maloumCacheManager && window.maloumCacheManager.firebaseTracker) {
    window.maloumCacheManager.firebaseTracker.startHeartbeatOnFirstUsage();
  }
  
  // Always increment local counter
  this.cacheHits++;
  this.vlog(`🎯 Cache hit incremented: ${this.cacheHits} total`);
  
  // Send to Firebase if requested
  if (sendToFirebase) {
    const cacheHitRecord = {
      timestamp: Date.now(),
      apiType: 'cache_hit',
      originalText: '',
      inputChars: 0,
      promptChars: 0,
      outputChars: 0,
      taskChars: 0,
      totalChars: 0,
      translatedText: '',
      totalCost: 0,
      cacheHits: 1
    };
   
    this.storeCharacterUsageRecord(cacheHitRecord);
    this.storeForBatchSending(cacheHitRecord);
    this.vlog('✅ Cache hit recorded and will update user activity');
  }
  
  this.saveTrackingStats();
}
  trackCacheHitSource(source, text) {
    
    // NEW: Store cache hit with more details
    const cacheHitRecord = {
      timestamp: Date.now(),
      apiType: 'cache_hit',
      originalText: text || '',
      inputChars: text ? text.length : 0,
      promptChars: 0,
      outputChars: 0,
      othersChars: 0,
      totalChars: text ? text.length : 0,
      translatedText: '',
      totalCost: 0,
      source: source
    };
    
    this.storeCharacterUsageRecord(cacheHitRecord);
    this.incrementCacheHits();
  }
// FIXED: Method to check if translation exists in cache (for external callers)
  async checkCache(text, targetLanguage, sourceLanguage = 'AUTO') {
  console.log('🔍 checkCache called - internal use, no counting');
  
  // Normalize languages for EN↔DE only
  const normalizedSource = sourceLanguage === 'AUTO' ? 'EN' : sourceLanguage.toUpperCase();
  const normalizedTarget = targetLanguage.toUpperCase();
  
  // Only support EN↔DE
  if (!((normalizedSource === 'EN' && normalizedTarget === 'DE') || 
        (normalizedSource === 'DE' && normalizedTarget === 'EN'))) {
    return { found: false };
  }
  
  // 🔥 CRITICAL FIX: Internal checks should NOT count as user requests
  const directResult = await this.getCachedTranslation(text, false); // false = don't count hits
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
  
  // Try reverse lookup (doesn't count as additional cache hit)
  const reverseResult = await this.getReverseTranslation(text);
  if (reverseResult && 
      reverseResult.targetLanguage === normalizedSource && 
      reverseResult.sourceLanguage === normalizedTarget) {
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
  async checkCacheForUser(text, targetLanguage, sourceLanguage = 'AUTO') {
  console.log('🔍 checkCacheForUser called - this should count cache hits');
  
  const result = await this.checkCache(text, targetLanguage, sourceLanguage);
  
  // 🔥 FIXED: Only count if cache hit found and not already counted
  if (result.found) {
    this.incrementCacheHits(true); // Send to Firebase
    this.vlog('🎯 Cache hit counted via checkCacheForUser');
  }
  
  return result;
}
  resetCacheHits() {
    this.cacheHits = 0;
    this.saveTrackingStats();
  }



  async sendUsageDataToDatabase(usageRecord) {
  console.log('🔥 sendUsageDataToDatabase called with:', usageRecord);
  
  try {
    // Initialize Firebase tracker if not already done
    if (!this.firebaseTracker) {  
      console.log('🔥 Creating new Firebase tracker');
      this.firebaseTracker = new FirebaseUsageTracker();  
    }
    
    console.log('🔥 Calling firebaseTracker.sendUsageData for single record');  // ← Updated log
    const result = await this.firebaseTracker.sendUsageData(usageRecord);  
    
    console.log('🔥 Firebase send result:', result);  // ← Updated log
    return result;
    
  } catch (error) {
    console.error('❌ Error sending to Firebase:', error);  // ← Updated log
    return false;
  }
}



// New method specifically for user-initiated translation requests
  async getUserCachedTranslation(text, targetLanguage, sourceLanguage = 'AUTO') {
    
    // This method is specifically for user requests, so pass true
    const result = await this.getCachedTranslation(text, true);
    
    if (result && 
        (sourceLanguage === 'AUTO' || result.sourceLanguage === sourceLanguage.toUpperCase()) &&
        result.targetLanguage === targetLanguage.toUpperCase()) {
      return result;
    }
    
    return null;
  }



  incrementApiRequests(inputText, promptText, outputText, additionalData = null) {
  console.log('🚀 incrementApiRequests CALLED!', { inputText: inputText?.substring(0, 20), outputText: outputText?.substring(0, 20) });
  
  try {
    // ISSUE 1 & 2 FIX: Prevent duplicate counting
    const requestId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    if (this.lastRequestId === requestId || (Date.now() - (this.lastRequestTime || 0)) < 100) {
      return;
    }
    this.lastRequestId = requestId;
    this.lastRequestTime = Date.now();

    // Calculate basic character counts
    const inputChars = inputText ? inputText.length : 0;
    const outputChars = outputText ? outputText.length : 0;

    // FIX: Detect API type first
    const apiType = this.detectApiType(inputText, promptText);

    // FIX: Calculate prompt and task characters
    let promptChars = 0;
    let taskChars = 0;
    
    if (promptText) {
      const promptAnalysis = this.detectTaskInPrompt(promptText);
      promptChars = promptAnalysis.promptChars;
      taskChars = promptAnalysis.taskChars;
    }

    // FIX: Calculate total characters
    const totalChars = inputChars + promptChars + outputChars + taskChars;

    // FIX: Calculate cost
    const costCalculation = this.calculateCost(inputChars, promptChars, outputChars, taskChars);

    // FIX: Create usage record with all required properties
    const usageRecord = {
      timestamp: Date.now(),
      apiType: apiType,
      originalText: inputText,
      inputChars: inputChars,
      promptChars: promptChars,
      outputChars: outputChars,
      othersChars: taskChars, // This should be taskChars, not othersChars
      taskChars: taskChars,
      totalChars: totalChars,
      translatedText: outputText,
      totalCost: costCalculation.totalCost,
      inputCost: costCalculation.inputCost,
      promptCost: costCalculation.promptCost,
      outputCost: costCalculation.outputCost,
      taskCost: costCalculation.taskCost,
      totalTokens: costCalculation.totalTokens,
      cacheHits: 0 // Will be incremented separately when cache is hit
    };

    // FIX: Handle additional data if provided (from agency tracker)
    if (additionalData && typeof additionalData === 'object') {
      // Use provided data if available
      if (additionalData.totalChars) usageRecord.totalChars = additionalData.totalChars;
      if (additionalData.inputChars) usageRecord.inputChars = additionalData.inputChars;
      if (additionalData.promptChars) usageRecord.promptChars = additionalData.promptChars;
      if (additionalData.outputChars) usageRecord.outputChars = additionalData.outputChars;
      if (additionalData.apiType) usageRecord.apiType = additionalData.apiType;
      
      // Recalculate cost if total changed
      if (additionalData.totalChars) {
        const recalculatedCost = this.calculateCost(
          usageRecord.inputChars, 
          usageRecord.promptChars, 
          usageRecord.outputChars, 
          usageRecord.totalChars - usageRecord.inputChars - usageRecord.promptChars - usageRecord.outputChars
        );
        usageRecord.totalCost = recalculatedCost.totalCost;
      }
    }

    console.log('📊 Usage record created:', {
      apiType: usageRecord.apiType,
      totalChars: usageRecord.totalChars,
      totalCost: usageRecord.totalCost
    });

    // Now it's safe to use usageRecord
    this.updateStatistics(apiType, usageRecord);
    this.storeCharacterUsageRecord(usageRecord);
    this.sendDataToTracker(usageRecord);

  } catch (error) {
    console.error('❌ Error in incrementApiRequests:', error);
  }
}
  async checkCacheInternal(text, targetLanguage, sourceLanguage = 'AUTO') {
  
  // Normalize languages for EN↔DE only
  const normalizedSource = sourceLanguage === 'AUTO' ? 'EN' : sourceLanguage.toUpperCase();
  const normalizedTarget = targetLanguage.toUpperCase();
  
  // Only support EN↔DE
  if (!((normalizedSource === 'EN' && normalizedTarget === 'DE') || 
        (normalizedSource === 'DE' && normalizedTarget === 'EN'))) {
    return { found: false };
  }
  
  // Try direct cache lookup (NOT a user request - don't count hits)
  const directResult = await this.getCachedTranslation(text, false); // false = internal lookup
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
  
  // Try reverse lookup
  const reverseResult = await this.getReverseTranslation(text);
  if (reverseResult && 
      reverseResult.targetLanguage === normalizedSource && 
      reverseResult.sourceLanguage === normalizedTarget) {
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


  async storeCharacterUsageRecord(record) {
  try {
    // Get existing records
    const result = await chrome.storage.local.get(['characterUsageRecords']);
    const records = result.characterUsageRecords || [];
    
    // Add new record with API type and calculations
    records.push(record);
    
    // Keep only last 1000 records
    if (records.length > 1000) {
      records.splice(0, records.length - 1000);
    }
    
    // Save back to storage
    await chrome.storage.local.set({ characterUsageRecords: records });
    
    
  } catch (error) {
    console.error('❌ Error storing character usage record:', error);
  }
}

  async ensureInitialized() {
    if (this.initPromise) {
      await this.initPromise;
    }
    return this.initialized;
  }

  // FIXED: Enhanced storage check with fallbacks
  async ensureStorageReady() {
    if (!this.storageReady && this.storage) {
      try {
        await this.storage.ensureInitialized();
        this.storageReady = this.storage.isInitialized;
      } catch (error) {
        console.warn('⚠️ Storage not ready, using in-memory fallback');
        this.storageReady = false;
      }
    }
    return this.storageReady;
  }

  async loadTranslationCache() {
    try {
      
      // FIXED: Try IndexedDB first if storage is ready
      if (await this.ensureStorageReady()) {
        try {
          const cacheMap = await this.storage.loadTranslationCache();
          if (cacheMap && cacheMap.size > 0) {
            this.translationCache = cacheMap;
            // DO NOT increment cache hits during loading!
            return;
          }
        } catch (storageError) {
        }
      }
      
      // Fallback to chrome storage first, then localStorage
      if (chrome?.storage?.local) {
        try {
          const result = await chrome.storage.local.get([this.cacheKey]);
          if (result[this.cacheKey]) {
            this.translationCache = new Map(result[this.cacheKey]);
            // DO NOT increment cache hits during loading!
            return;
          }
        } catch (chromeError) {
        }
      }
      
      // Final fallback to localStorage
      const localData = localStorage.getItem(this.cacheKey);
      if (localData) {
        this.translationCache = new Map(JSON.parse(localData));
        // DO NOT increment cache hits during loading!
      } else {
      }
    } catch (error) {
      console.error('❌ Error loading translation cache:', error);
      this.translationCache = new Map();
    }
  }


  async loadReverseTranslationCache() {
    try {
      
      // FIXED: Try IndexedDB first if storage is ready
      if (await this.ensureStorageReady()) {
        try {
          const reverseCacheMap = await this.storage.loadReverseTranslationCache();
          if (reverseCacheMap && reverseCacheMap.size > 0) {
            this.reverseTranslationCache = reverseCacheMap;
            // DO NOT increment cache hits during loading!
            return;
          }
        } catch (storageError) {
        }
      }
      
      // Fallback to chrome storage
      if (chrome?.storage?.local) {
        try {
          const result = await chrome.storage.local.get([this.reverseCacheKey]);
          if (result[this.reverseCacheKey]) {
            this.reverseTranslationCache = new Map(result[this.reverseCacheKey]);
            // DO NOT increment cache hits during loading!
            return;
          }
        } catch (chromeError) {
        }
      }
      
      // Final fallback to localStorage
      const localData = localStorage.getItem(this.reverseCacheKey);
      if (localData) {
        this.reverseTranslationCache = new Map(JSON.parse(localData));
        // DO NOT increment cache hits during loading!
      } else {
      }
    } catch (error) {
      console.error('❌ Error loading reverse translation cache:', error);
      this.reverseTranslationCache = new Map();
    }
  }

  async saveTranslationCache() {
    try {
      
      // FIXED: Try IndexedDB first if storage is ready
      if (await this.ensureStorageReady()) {
        try {
          const success = await this.storage.saveTranslationCache(this.translationCache, this.reverseTranslationCache);
          if (success) {
            return;
          }
        } catch (storageError) {
        }
      }
      
      // Fallback to chrome storage and localStorage
      const cacheData = Array.from(this.translationCache.entries());
      const reverseCacheData = Array.from(this.reverseTranslationCache.entries());
      
      // Try chrome storage first, then localStorage as fallback
      if (chrome?.storage?.local) {
        try {
          await chrome.storage.local.set({ 
            [this.cacheKey]: cacheData,
            [this.reverseCacheKey]: reverseCacheData
          });
          return;
        } catch (chromeError) {
        }
      }
      
      // Final fallback to localStorage
      localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
      localStorage.setItem(this.reverseCacheKey, JSON.stringify(reverseCacheData));
    } catch (error) {
      console.error('❌ Error saving translation cache:', error);
    }
  }

  generateCacheKey(text, targetLang, sourceLang = null, messageType = null) {
  const normalizedText = text.trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\u00C0-\u017F\u0100-\u024F]/g, '')
    .trim();
  
  // Normalize languages to EN↔DE only
  const normalizedSource = sourceLang ? sourceLang.toUpperCase() : 'AUTO';
  const normalizedTarget = targetLang ? targetLang.toUpperCase() : 'EN';
  
  // Ensure valid EN↔DE pair
  if (!((normalizedSource === 'EN' && normalizedTarget === 'DE') || 
        (normalizedSource === 'DE' && normalizedTarget === 'EN') ||
        (normalizedSource === 'AUTO'))) {
    // console.warn(`Invalid language pair: ${normalizedSource}→${normalizedTarget}`);
  }
  
  // ✅ UNIFIED CACHE KEY - NO MESSAGE TYPE SUFFIX
  // This allows textarea and message translations to share the same cache entries
  const cacheKey = `${normalizedText}_${normalizedTarget}_${normalizedSource}`;
  
  return cacheKey;
}

  // FIXED: Simplified text hash generation for reverse lookups
  generateTextHash(text) {
    const normalized = text.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString();
  }

  // FIXED: Simplified cache lookup - only checks 2 possible keys max
  async getCachedTranslation(textOrKey, isUserRequest = false, targetLanguage = null, sourceLanguage = 'AUTO') {
  // Add tracking to prevent duplicate counting within the same request
  const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let cacheHitAlreadyCounted = false;
  
  if (!textOrKey) return null;
  
  let foundResult = null;
  const possibleKeys = [];
  
  // Generate all possible cache keys
  if (typeof textOrKey === 'string') {
    if (targetLanguage) {
      const messageTypes = ['message', 'user_message', 'assistant_message', 'other'];
      possibleKeys.push(this.generateCacheKey(textOrKey, targetLanguage, sourceLanguage));
      
      for (const msgType of messageTypes) {
        possibleKeys.push(this.generateCacheKey(textOrKey, targetLanguage, sourceLanguage, msgType));
      }
      
      if (sourceLanguage === 'AUTO') {
        for (const lang of ['EN', 'DE']) {
          possibleKeys.push(this.generateCacheKey(textOrKey, targetLanguage, lang));
          for (const msgType of messageTypes) {
            possibleKeys.push(this.generateCacheKey(textOrKey, targetLanguage, lang, msgType));
          }
        }
      }
    } else {
      const languages = ['EN', 'DE'];
      const messageTypes = ['message', 'user_message', 'assistant_message', 'other'];
      
      for (const sourceLang of languages) {
        for (const targetLang of languages) {
          if (sourceLang !== targetLang) {
            possibleKeys.push(this.generateCacheKey(textOrKey, targetLang, sourceLang));
            for (const msgType of messageTypes) {
              possibleKeys.push(this.generateCacheKey(textOrKey, targetLang, sourceLang, msgType));
            }
          }
        }
      }
    }
  } else {
    possibleKeys.push(textOrKey);
  }
  
  // Try in-memory cache first
  for (const key of possibleKeys) {
    if (!foundResult) {
      foundResult = this.translationCache.get(key);
      if (foundResult) {
        // 🔥 FIXED: Only count once per user request
        if (isUserRequest && !cacheHitAlreadyCounted) {
          this.incrementCacheHits(true); // Send to Firebase
          cacheHitAlreadyCounted = true;
          this.vlog('🎯 Cache hit counted for user request (in-memory)');
        }
        return foundResult;
      }
    }
  }
  
  // Try IndexedDB if available
  if (!foundResult && await this.ensureStorageReady()) {
    try {
      for (const key of possibleKeys) {
        if (!foundResult) {
          const storageResult = await this.storage.getCachedTranslation(key, this.translationCache);
          if (storageResult) {
            this.translationCache.set(key, storageResult);
            foundResult = storageResult;
            
            // 🔥 FIXED: Only count once per user request
            if (isUserRequest && !cacheHitAlreadyCounted) {
              this.incrementCacheHits(true); // Send to Firebase
              cacheHitAlreadyCounted = true;
              this.vlog('🎯 Cache hit counted for user request (IndexedDB)');
            }
            return foundResult;
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ IndexedDB lookup failed:', error);
    }
  }
  
  return null;
}



      // FIXED: Enhanced reverse translation lookup
  async getReverseTranslation(text) {
    
    const textHash = this.generateTextHash(text);
    let foundResult = null;
    
    // Try in-memory cache first
    foundResult = this.reverseTranslationCache.get(textHash);
    if (foundResult) {
      return foundResult;
    }
    
    // Try IndexedDB if not in memory
    if (!foundResult && await this.ensureStorageReady()) {
      try {
        const storageResult = await this.storage.getReverseTranslation(text, this.reverseTranslationCache);
        if (storageResult) {
          // Update in-memory cache
          this.reverseTranslationCache.set(textHash, storageResult);
          foundResult = storageResult;
          return foundResult;
        }
      } catch (error) {
        console.warn('⚠️ IndexedDB reverse lookup failed:', error);
      }
    }
    
    return null;
  }


// Replace the storeCachedTranslation method in your cache-manager.js with this corrected version:

  async storeCachedTranslation(cacheKeyOrText, originalText, translatedText, sourceLanguage, targetLanguage, messageType) {
  try {
    
    // Validate inputs
    if (!originalText || !translatedText) {
      console.error('❌ Missing required fields: originalText or translatedText');
      return false;
    }
    
    // Normalize language codes
    const normalizedSource = (sourceLanguage || 'EN').toUpperCase();
    const normalizedTarget = (targetLanguage || 'DE').toUpperCase();
    
    // Validate EN↔DE only
    if (!((normalizedSource === 'EN' && normalizedTarget === 'DE') || 
          (normalizedSource === 'DE' && normalizedTarget === 'EN'))) {
      return false;
    }

    // Check if already exists (prevent duplicates)
    const normalizedOriginal = originalText.trim().toLowerCase();
    const normalizedTranslated = translatedText.trim().toLowerCase();
    
    for (const [existingKey, existingEntry] of this.translationCache.entries()) {
      if (existingEntry.originalText.trim().toLowerCase() === normalizedOriginal &&
          existingEntry.translatedText.trim().toLowerCase() === normalizedTranslated &&
          existingEntry.sourceLanguage === normalizedSource &&
          existingEntry.targetLanguage === normalizedTarget) {
        return true;
      }
    }

    // Generate cache key
    const forwardKey = this.generateCacheKey(originalText, normalizedTarget, normalizedSource);

    const timestamp = Date.now();

    // Store forward translation
    const forwardEntry = {
      originalText: originalText.trim(),
      translatedText: translatedText.trim(),
      sourceLanguage: normalizedSource,
      targetLanguage: normalizedTarget,
      messageType: messageType || 'manual',
      timestamp: timestamp
    };

    this.translationCache.set(forwardKey, forwardEntry);

    // Store in reverse cache for lookup
    const translatedTextHash = this.generateTextHash(translatedText);
    if (!this.reverseTranslationCache.has(translatedTextHash)) {
      const reverseEntry = {
        originalText: originalText.trim(),
        translatedText: translatedText.trim(),
        sourceLanguage: normalizedSource,
        targetLanguage: normalizedTarget,
        messageType: messageType || 'manual',
        originalMessageHash: forwardKey,
        timestamp: timestamp
      };

      this.reverseTranslationCache.set(translatedTextHash, reverseEntry);
    }

    // Save to persistent storage
    try {
      await this.saveTranslationCache();
    } catch (error) {
      console.error('❌ Error saving cache:', error);
    }

    // CRITICAL: Auto-refresh counter
    this.refreshTranslationCounter();

    return true;

  } catch (error) {
    console.error('❌ Error storing translation:', error);
    return false;
  }
}

  // FIXED: Simplified search functionality
  async searchCache(query, options = {}) {
    const results = [];
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
      // Return all entries from in-memory cache
      this.translationCache.forEach((entry, hash) => {
        const languageMatch = options.sourceLanguage ? entry.sourceLanguage === options.sourceLanguage : true;
        const targetMatch = options.targetLanguage ? entry.targetLanguage === options.targetLanguage : true;

        if (languageMatch && targetMatch) {
          results.push({
            hash,
            ...entry,
            matchType: 'all'
          });
        }
      });
      
      // FIXED: Also search IndexedDB if available
      if (await this.ensureStorageReady()) {
        try {
          const storageResults = await this.storage.searchCache(this.translationCache, '', options);
          // Merge results, avoiding duplicates
          const existingHashes = new Set(results.map(r => r.hash));
          storageResults.forEach(result => {
            if (!existingHashes.has(result.hash)) {
              results.push(result);
            }
          });
        } catch (error) {
          console.warn('⚠️ IndexedDB search failed:', error);
        }
      }
      
      return results.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Search with term in in-memory cache
    this.translationCache.forEach((entry, hash) => {
      const originalMatch = entry.originalText.toLowerCase().includes(searchTerm);
      const translatedMatch = entry.translatedText.toLowerCase().includes(searchTerm);
      const languageMatch = options.sourceLanguage ? entry.sourceLanguage === options.sourceLanguage : true;
      const targetMatch = options.targetLanguage ? entry.targetLanguage === options.targetLanguage : true;

      if ((originalMatch || translatedMatch) && languageMatch && targetMatch) {
        results.push({
          hash,
          ...entry,
          matchType: originalMatch ? 'original' : 'translated'
        });
      }
    });
    
    // FIXED: Also search IndexedDB if available
    if (await this.ensureStorageReady()) {
      try {
        const storageResults = await this.storage.searchCache(this.translationCache, searchTerm, options);
        // Merge results, avoiding duplicates
        const existingHashes = new Set(results.map(r => r.hash));
        storageResults.forEach(result => {
          if (!existingHashes.has(result.hash)) {
            results.push(result);
          }
        });
      } catch (error) {
        console.warn('⚠️ IndexedDB search failed:', error);
      }
    }

    // Sort by timestamp (newest first)
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  // FIXED: Enhanced statistics with IndexedDB support and fallbacks
// FIXED: Enhanced statistics with IndexedDB support and fallbacks
  async getCacheStats() {
  try {
    
    // FIXED: Try IndexedDB first if available
    if (await this.ensureStorageReady()) {
      try {
        const storageStats = await this.storage.getCacheStats(this.translationCache, this.reverseTranslationCache);
        if (storageStats && storageStats.totalEntries >= 0) {
          // Add tracking data to IndexedDB stats
          storageStats.cacheHits = this.cacheHits;
          storageStats.apiRequests = this.apiRequests;
          storageStats.totalCharactersUsed = this.totalCharactersUsed;
          return storageStats;
        }
      } catch (error) {
        console.warn('⚠️ IndexedDB stats failed, using in-memory fallback:', error);
      }
    }
    
    // FIXED: Fallback to in-memory statistics
    const stats = {
      totalEntries: this.translationCache.size,
      reverseEntries: this.reverseTranslationCache.size,
      oldestEntry: null,
      newestEntry: null,
      actualSizeBytes: 0,
      actualSizeMB: 0,
      maxStorageMB: this.storageReady ? 'Unlimited (IndexedDB)' : '5 (Chrome Storage)',
      storageType: this.storageReady ? 'IndexedDB' : 'Chrome Storage/localStorage',
      translationPairs: 'EN↔DE only',
      cacheStrategy: 'Simplified 2-entry system',
      // Add tracking data
      cacheHits: this.cacheHits,
      apiRequests: this.apiRequests,
      totalCharactersUsed: this.totalCharactersUsed
    };

    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    // Calculate actual storage size by stringifying the data (same as stored)
    const cacheData = Array.from(this.translationCache.entries());
    const reverseCacheData = Array.from(this.reverseTranslationCache.entries());
    
    // Calculate actual bytes used by JSON stringifying the data
    const cacheString = JSON.stringify(cacheData);
    const reverseCacheString = JSON.stringify(reverseCacheData);
    
    stats.actualSizeBytes = new Blob([cacheString + reverseCacheString]).size;
    stats.actualSizeMB = (stats.actualSizeBytes / (1024 * 1024)).toFixed(2);

    this.translationCache.forEach(entry => {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        stats.oldestEntry = new Date(entry.timestamp);
      }
      
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
        stats.newestEntry = new Date(entry.timestamp);
      }
    });

    return stats;
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    // Return minimal stats with tracking data
    return {
      totalEntries: this.translationCache?.size || 0,
      reverseEntries: this.reverseTranslationCache?.size || 0,
      oldestEntry: null,
      newestEntry: null,
      actualSizeBytes: 0,
      actualSizeMB: 0,
      maxStorageMB: 'Unknown',
      storageType: 'Error',
      cacheHits: this.cacheHits || 0,
      apiRequests: this.apiRequests || 0,
      totalCharactersUsed: this.totalCharactersUsed || 0,
      error: error.message
    };
  }
}
  // FIXED: Enhanced export with IndexedDB support
  async exportCache(format = 'json') {
    try {
      
      // FIXED: Try IndexedDB export first if available
      if (await this.ensureStorageReady()) {
        try {
          const exportData = await this.storage.exportCache(this.translationCache, this.reverseTranslationCache, format);
          if (exportData) {
            return exportData;
          }
        } catch (error) {
          console.warn('⚠️ IndexedDB export failed, using in-memory fallback:', error);
        }
      }
      
      // FIXED: Fallback to in-memory export
      const data = {
        translations: Array.from(this.translationCache.entries()).map(([hash, entry]) => ({
          hash,
          ...entry
        })),
        reverseTranslations: Array.from(this.reverseTranslationCache.entries()).map(([hash, entry]) => ({
          hash,
          ...entry
        })),
        exportDate: new Date().toISOString(),
        version: '2.0-FIXED',
        storageType: this.storageReady ? 'IndexedDB' : 'In-Memory',
        translationPairs: 'EN↔DE only',
        cacheStrategy: 'Simplified 2-entry system'
      };

      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      } else if (format === 'csv') {
        return this.exportToCSV(data.translations);
      }
    } catch (error) {
      console.error('❌ Export failed:', error);
      return '';
    }
  }

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

  // FIXED: Enhanced import with IndexedDB support
  async importCache(data, format = 'json') {
    try {
      
      let importData;
      
      if (format === 'json') {
        importData = typeof data === 'string' ? JSON.parse(data) : data;
      } else if (format === 'csv') {
        importData = this.parseCSV(data);
      }

      let imported = 0;
      
      if (importData.translations) {
        // Process each translation entry
        for (const entry of importData.translations) {
          if (entry.hash && entry.originalText && entry.translatedText) {
            // FIXED: Use the improved storage method
            const success = await this.storeCachedTranslation(
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
          }
        }
      }

      
      return { success: true, imported };
    } catch (error) {
      console.error('❌ Import failed:', error);
      return { success: false, error: error.message };
    }
  }

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
        // Legacy format: Just Original and Translated (for backward compatibility)
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

  // Helper function to properly parse CSV lines with quoted values
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    // Add the last field
    values.push(current);
    
    return values;
  }

  // Cache UI Methods
  async showCacheUI() {
    try {
      await this.ensureInitialized();
      
      // TOGGLE instead of always opening
      if (this.isUIOpen) {
        this.closeCacheUI();
      } else {
        this.openCacheUI();
      }
      
    } catch (error) {
      console.error('❌ Error toggling cache UI:', error);
      this.showToast('Failed to toggle cache UI: ' + error.message, 'error');
    }
  }

  openCacheUI() {
    if (this.isUIOpen) {
      return;
    }
    
    // NEW: Check if Prompt UI is open and prevent opening
    if (window.maloumInstances?.promptManager?.isPromptUIOpen) {
      this.showToast('Please close Prompt Manager first', 'warning');
      return;
    }
    
    this.isUIOpen = true;

    // Remove any existing UI first
    this.performFallbackCleanup();

    // Find the cache button to start animation from
    const cacheButton = document.getElementById('maloum-cache-btn');
    let startX = window.innerWidth - 100;
    let startY = 100;
    
    if (cacheButton) {
      const buttonRect = cacheButton.getBoundingClientRect();
      startX = buttonRect.left + buttonRect.width / 2;
      startY = buttonRect.top + buttonRect.height / 2;
    }

    const startOffsetX = startX - window.innerWidth / 2;
    const startOffsetY = startY - window.innerHeight / 2;

    const container = document.createElement('div');
    container.id = 'maloum-cache-backdrop';
    container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      background: white;
      border-radius: 24px;
      width: 100%;
      max-width: 900px;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
      z-index: 10000;
      border: 2px solid #FCE7C8;
      opacity: 0;
      transform: translate(calc(-50% + ${startOffsetX}px), calc(-50% + ${startOffsetY}px)) scale(0.1);
      transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease-out;
      transform-origin: center center;
    `;

    // Create header
    const header = this.createHeader(() => {
      this.closeCacheUI();
    });

    // Create content
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 20px;
      max-height: calc(90vh - 150px);
      overflow-y: auto;
      background: rgb(255, 255, 255);
    `;

    // Create tabs
    const tabs = this.createTabs();
    content.appendChild(tabs);

    container.appendChild(header);
    container.appendChild(content);
    document.body.appendChild(container);

    // Trigger animation
    setTimeout(() => {
      container.style.transform = 'translate(-50%, -50%) scale(1)';
      container.style.opacity = '1';
    }, 50);

    // Focus search input after animation
    setTimeout(() => {
      const searchInput = container.querySelector('#cache-search-input');
      if (searchInput) {
        searchInput.focus();
      }
    }, 700);

  }
  showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    warning: { bg: '#f59e0b', border: '#d97706' },
    info: { bg: '#3b82f6', border: '#2563eb' },
    error: { bg: '#dc2626', border: '#b91c1c' },
    success: { bg: '#10b981', border: '#059669' }
  };
  const color = colors[type] || colors.info;
  
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    background: ${color.bg};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    border: 2px solid ${color.border};
    font-size: 14px;
    font-weight: 600;
    z-index: 10001;
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  `;
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
  // Close cache UI method
  closeCacheUI() {
    
    if (!this.isUIOpen) {
      return;
    }
    
    const container = document.getElementById('maloum-cache-backdrop');
    
    if (container) {
      
      // Find the cache button to shrink toward
      const cacheButton = document.getElementById('maloum-cache-btn');
      let targetX = window.innerWidth - 100;
      let targetY = 100;
      
      if (cacheButton) {
        const buttonRect = cacheButton.getBoundingClientRect();
        targetX = buttonRect.left + buttonRect.width / 2;
        targetY = buttonRect.top + buttonRect.height / 2;
      }
      
      // Calculate the final position relative to the current center position
      const finalX = targetX - window.innerWidth / 2;
      const finalY = targetY - window.innerHeight / 2;
      
      // Disable interactions during animation
      container.style.pointerEvents = 'none';
      
      // Apply Mac-style shrink animation
      container.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease-out';
      container.style.transformOrigin = 'center center';
      container.style.transform = `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px)) scale(0.1)`;
      container.style.opacity = '0';
      
      // Remove container ESC handler
      if (container.escHandler) {
        document.removeEventListener('keydown', container.escHandler, true);
        container.escHandler = null;
      }
      
      // Reset state immediately after starting animation
      this.isUIOpen = false;
      
      // Remove after animation completes
      setTimeout(() => {
        if (container && container.parentNode) {
          container.remove();
        }
        this.performFallbackCleanup();
      }, 600);
      
    } else {
      this.performFallbackCleanup();
      this.isUIOpen = false;
    }
    

    // Tell global manager we're closed
    window.maloumUIManager.closeUI(this);
  }
  performFallbackCleanup() {
    
    // Remove container if still exists
    const container = document.getElementById('maloum-cache-backdrop');
    if (container) {
      container.remove();
    }
    
    // Remove any lingering ESC handlers
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, true);
    }
    
  }
  createHeader(onClose) {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px !important;
      background: rgba(0, 0, 0, 0.8);
      color: white !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Cache Manager';
    title.style.cssText = 'margin: 0 !important; font-size: 18px !important; font-weight: 600 !important; color: white !important;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none !important;
      border: none !important;
      color: white !important;
      font-size: 20px !important;
      cursor: pointer !important;
      padding: 4px !important;
      width: 30px !important;
      height: 30px !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: background-color 0.2s !important;
    `;
    
    closeBtn.addEventListener('click', onClose);
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.backgroundColor = 'transparent';
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    return header;
  }

  createTabs() {
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
      border-bottom: 1px solid #e5e7eb !important;
      margin-bottom: 20px !important;
    `;

    const tabHeader = document.createElement('div');
    tabHeader.style.cssText = `
      display: flex !important;
      gap: 0 !important;
    `;

    const tabs = [
      { id: 'search', label: 'Search & Browse', icon: '🔍' },
      { id: 'stats', label: 'Statistics', icon: '📊' },
      { id: 'backup-manage', label: 'Backup & Manage', icon: '💾' },
      { id: 'settings', label: 'Settings', icon: '⚙️' }
    ];

    const tabContent = document.createElement('div');
    tabContent.id = 'tab-content';
    tabContent.style.cssText = `
      height: 500px;
      padding-top: 20px !important; 
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    `;
    
    // Hide scrollbars completely
    const style = document.createElement('style');
    style.textContent = `
      #tab-content::-webkit-scrollbar {
        display: none;
      }
      #tab-content {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
    `;
    document.head.appendChild(style);

    tabs.forEach((tab, index) => {
      const tabBtn = document.createElement('button');
      tabBtn.textContent = `${tab.icon} ${tab.label}`;
      tabBtn.style.cssText = `
        padding: 12px 20px !important;
        border: none !important;
        background: ${index === 0 ? 'rgba(244, 62, 6, 0.9)' : 'transparent'} !important;
        color: ${index === 0 ? 'white' : '#6b7280'} !important;
        cursor: pointer !important;
        font-size: 14px !important;
        border-radius: 8px 8px 0 0 !important;
        transition: all 0.2s !important;
        font-weight: 500 !important;
      `;

      tabBtn.addEventListener('click', () => {
        // Update active tab
        tabHeader.querySelectorAll('button').forEach(btn => {
          btn.style.background = 'transparent';
          btn.style.color = '#6b7280';
        });
        tabBtn.style.background = 'rgba(244, 62, 6, 0.9)';
        tabBtn.style.color = 'white';
        
        this.switchTab(tab.id, tabContent);
      });

      tabHeader.appendChild(tabBtn);
    });

    // Initialize with first tab
    this.switchTab('search', tabContent);

    tabContainer.appendChild(tabHeader);
    tabContainer.appendChild(tabContent);
    return tabContainer;
  }

  switchTab(tabId, tabContent) {
    switch (tabId) {
      case 'search':
        tabContent.innerHTML = '';
        tabContent.appendChild(this.createSearchTab());
        break;
      case 'stats':
        tabContent.innerHTML = '';
        tabContent.appendChild(this.createStatsTab());
        break;
      case 'backup-manage':
        tabContent.innerHTML = '';
        tabContent.appendChild(this.createBackupManageTab());
        break;
      case 'settings':
        tabContent.innerHTML = '';
        tabContent.appendChild(this.createSettingsTab());
        break;
    }
  }

  createSearchTab() {
  const container = document.createElement('div');
  
  // Search form
  const searchForm = document.createElement('div');
  searchForm.style.cssText = `
    background: #f9fafb !important;
    padding: 16px !important;
    border-radius: 8px !important;
    margin-bottom: 20px !important;
  `;

  // UPDATED: Create title with simple text counter
  const titleContainer = document.createElement('div');
  titleContainer.style.cssText = 'margin: 0 0 12px 0;';
  
  const searchTitle = document.createElement('strong');
  searchTitle.textContent = 'Search Translations ';
  searchTitle.style.cssText = 'font-size: 16px !important; color: #374151 !important;';

  // NEW: Simple text counter
  const translationCounter = document.createElement('span');
  translationCounter.id = 'translation-counter';
  translationCounter.style.cssText = `
    font-size: 14px;
    color: #6b7280;
    font-weight: normal;
  `;
  
  // Get initial count and update counter
  this.updateTranslationCounter(translationCounter);

  titleContainer.appendChild(searchTitle);
  titleContainer.appendChild(translationCounter);

  const searchInput = document.createElement('input');
  searchInput.id = 'cache-search-input';
  searchInput.type = 'text';
  searchInput.placeholder = 'Search original or translated text...';
  searchInput.style.cssText = `
    width: 100% !important;
    padding: 10px 12px !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    font-size: 14px !important;
    margin-bottom: 12px !important;
    box-sizing: border-box !important;
  `;

  const filterRow = document.createElement('div');
  filterRow.style.cssText = 'display: flex !important; gap: 12px !important; margin-bottom: 12px !important;';

  const sourceSelect = document.createElement('select');
  sourceSelect.id = 'source-filter';
  sourceSelect.style.cssText = `
    padding: 8px 12px !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    font-size: 14px !important;
  `;
  sourceSelect.innerHTML = `
    <option value="">All source languages</option>
    <option value="EN">English</option>
    <option value="DE">German</option>
  `;

  const targetSelect = document.createElement('select');
  targetSelect.id = 'target-filter';
  targetSelect.style.cssText = `
    padding: 8px 12px !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    font-size: 14px !important;
  `;
  targetSelect.innerHTML = `
    <option value="">All target languages</option>
    <option value="EN">English</option>
    <option value="DE">German</option>
  `;

  const searchBtn = document.createElement('button');
  searchBtn.textContent = 'Search';
  searchBtn.style.cssText = `
    padding: 8px 16px !important;
    background: #f43e06 !important;
    color: white !important;
    border: none !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    font-weight: 500 !important;
  `;

  filterRow.appendChild(sourceSelect);
  filterRow.appendChild(targetSelect);
  filterRow.appendChild(searchBtn);

  searchForm.appendChild(titleContainer);
  searchForm.appendChild(searchInput);
  searchForm.appendChild(filterRow);

  // Results container
  const resultsContainer = document.createElement('div');
  resultsContainer.id = 'search-results';
  resultsContainer.style.cssText = 'min-height: 200px !important;';

  // Search functionality
  const performSearch = async () => {
    const query = searchInput.value.trim();
    const options = {
      sourceLanguage: sourceSelect.value || null,
      targetLanguage: targetSelect.value || null
    };

    const results = await this.searchCache(query, options);
    this.displaySearchResults(results, resultsContainer);
  };

  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  // Initial display of all entries
  setTimeout(async () => {
    const allResults = await this.searchCache('', {});
    this.displaySearchResults(allResults.slice(0, 50), resultsContainer); // Show first 50
  }, 100);

  container.appendChild(searchForm);
  container.appendChild(resultsContainer);
  return container;
}


  // Create statistics tab with async data loading and better error handling
  createStatsTab() {
    const container = document.createElement('div');
    
    // Show loading state initially
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #6b7280;">
        <div style="font-size: 24px; margin-bottom: 12px;">📊</div>
        <div style="font-size: 16px; margin-bottom: 8px;">Loading FIXED Statistics...</div>
        <div style="font-size: 12px;">Reading EN↔DE cache data...</div>
      </div>
    `;
    
    // Load stats asynchronously
    this.loadStatsData(container);
    
    return container;
  }

  async updateTranslationCounter(counterElement) {
  try {
    let totalCount = 0;
    
    // Count in-memory cache
    totalCount += this.translationCache.size;
    
    // Also count IndexedDB entries if available (for more accurate count)
    if (await this.ensureStorageReady()) {
      try {
        const stats = await this.storage.getCacheStats(this.translationCache, this.reverseTranslationCache);
        if (stats && stats.totalEntries >= 0) {
          totalCount = stats.totalEntries; // Use IndexedDB count as it's more accurate
        }
      } catch (error) {
        console.warn('⚠️ Could not get IndexedDB count, using in-memory count');
      }
    }
    
    // Update counter display with simple text
    if (counterElement) {
      const countText = totalCount === 1 ? 'translation' : 'translations';
      counterElement.textContent = `(${totalCount.toLocaleString()} total ${countText})`;
      counterElement.title = `${totalCount} translations cached`;
    }
    
    return totalCount;
  } catch (error) {
    console.error('❌ Error updating translation counter:', error);
    if (counterElement) {
      counterElement.textContent = '(unknown total)';
      counterElement.title = 'Could not load count';
    }
    return 0;
  }
}

// ALSO ADD: Method to refresh counter when translations are added/deleted
  refreshTranslationCounter() {
  const counter = document.getElementById('translation-counter');
  if (counter) {
    this.updateTranslationCounter(counter);
  }
}

  async loadStatsData(container) {
  try {
    
    const stats = await this.getCacheStats();
    
    if (stats.error) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #dc2626;">
          <div style="font-size: 24px; margin-bottom: 12px;">❌</div>
          <div style="font-size: 16px; margin-bottom: 8px;">Failed to Load Statistics</div>
          <div style="font-size: 12px; color: #6b7280;">Error: ${stats.error}</div>
        </div>
      `;
      return;
    }
    
    // Create the stats grid using responsive statistics (starts with Today data)
    const statsGrid = document.createElement('div');
    statsGrid.id = 'responsive-stats-grid';
    
    // Get today's data for initial display
    const todayData = await this.getCharacterUsageData('Today');
    statsGrid.innerHTML = this.createStatisticsBoxes(todayData);
    
    // Enhanced Character Usage Report Section
    const reportSection = document.createElement('div');
    reportSection.style.cssText = `
      margin-bottom: 24px !important;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    `;
    
    // THREE ROW LAYOUT
    const reportHeader = document.createElement('div');
    reportHeader.innerHTML = `
      <!-- ROW 1: Title Only -->
      <div style="margin-bottom: 20px;">
        <h4 style="
          margin: 0;
          font-size: 18px;
          color: #f43e06;
          font-weight: 700;
          text-shadow: 0 1px 2px rgba(244, 62, 6, 0.2);
        ">📈 Character Usage Analytics</h4>
      </div>
      
      <!-- ROW 2: Quick Filter Buttons -->
      <div style="
        margin-bottom: 16px;
        display: flex;
        gap: 4px;
        background: white;
        padding: 8px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        flex-wrap: wrap;
      ">
        <button class="filter-btn" data-filter="Last 1 hour" style="
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        ">Last 1 hour</button>
        
        <button class="filter-btn" data-filter="Today" style="
          padding: 6px 12px;
          border: 1px solid #f43e06;
          background: linear-gradient(135deg, #f43e06, #ff6b35);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(244, 62, 6, 0.3);
        ">Today</button>
        
        <button class="filter-btn" data-filter="Yesterday" style="
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        ">Yesterday</button>
        
        <button class="filter-btn" data-filter="Last 7 Days" style="
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        ">Last 7 Days</button>
        
        <button class="filter-btn" data-filter="This Month" style="
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        ">This Month</button>
        
        <button class="filter-btn" data-filter="All Time" style="
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        ">All Time</button>
      </div>
      
      <!-- ROW 3: Date Picker -->
      <div style="
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        background: white;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="
            font-size: 12px;
            color: #374151;
            font-weight: 500;
            min-width: 35px;
          ">From:</label>
          <input 
            type="date" 
            id="usage-from-date" 
            style="
              padding: 6px 8px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 12px;
              color: #374151;
              background: white;
              cursor: pointer;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.borderColor='#f43e06'"
            onmouseout="this.style.borderColor='#d1d5db'"
          />
        </div>
        
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="
            font-size: 12px;
            color: #374151;
            font-weight: 500;
            min-width: 25px;
          ">To:</label>
          <input 
            type="date" 
            id="usage-to-date" 
            style="
              padding: 6px 8px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 12px;
              color: #374151;
              background: white;
              cursor: pointer;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.borderColor='#f43e06'"
            onmouseout="this.style.borderColor='#d1d5db'"
          />
        </div>
        
        <button 
          id="apply-custom-date" 
          style="
            padding: 6px 16px;
            background: linear-gradient(135deg, #f43e06 0%, #ff6b35 100%);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(244, 62, 6, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          "
          onmouseenter="
            this.style.transform = 'translateY(-2px) scale(1.02)';
            this.style.boxShadow = '0 4px 12px rgba(244, 62, 6, 0.4)';
            this.style.background = 'linear-gradient(135deg, #dc2626 0%, #f43e06 100%)';
          "
          onmouseleave="
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '0 2px 4px rgba(244, 62, 6, 0.3)';
            this.style.background = 'linear-gradient(135deg, #f43e06 0%, #ff6b35 100%)';
          "
        >Apply</button>
        
        <button 
          id="clear-custom-date" 
          style="
            padding: 6px 12px;
            background: rgba(107, 114, 128, 0.1);
            color: #6b7280;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
          "
          onmouseenter="
            this.style.background = 'rgba(107, 114, 128, 0.2)';
            this.style.borderColor = '#9ca3af';
          "
          onmouseleave="
            this.style.background = 'rgba(107, 114, 128, 0.1)';
            this.style.borderColor = '#d1d5db';
          "
        >Clear</button>
      </div>
    `;
    
    // Character usage report content
    const reportContent = document.createElement('div');
    reportContent.id = 'character-usage-report';
    
    reportSection.appendChild(reportHeader);
    reportSection.appendChild(reportContent);
    
    // Load initial report (Today)
    await this.loadCharacterUsageReport(reportContent, 'Today');
    
    // Setup custom date picker functionality
    this.setupCustomDatePicker(reportSection);
    
    // *** SINGLE EVENT LISTENER SETUP - REMOVED DUPLICATES ***
    const filterButtons = reportHeader.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const filter = e.target.getAttribute('data-filter');
        
        
        // Use the applyDateFilter method (which updates both table and boxes)
        await this.applyDateFilter(filter, reportSection);
        
        // Clear custom date inputs when using quick filters
        const fromDateInput = reportSection.querySelector('#usage-from-date');
        const toDateInput = reportSection.querySelector('#usage-to-date');
        if (fromDateInput && toDateInput) {
          fromDateInput.value = '';
          toDateInput.value = '';
        }
      });
    });
    // *** END OF SINGLE EVENT LISTENER SETUP ***
    
    // Add stats-container class for reference
    container.className = 'stats-container';
    container.innerHTML = '';
    container.appendChild(statsGrid);
    container.appendChild(reportSection);
    
  } catch (error) {
    console.error('❌ Error loading stats data:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #dc2626;">
        <div style="font-size: 24px; margin-bottom: 12px;">❌</div>
        <div style="font-size: 16px; margin-bottom: 8px;">Failed to Load Statistics</div>
        <div style="font-size: 12px; color: #6b7280;">Error: ${error.message}</div>
      </div>
    `;
  }
}


  async applyDateFilter(filter, container) {
  
  // Update button states - More specific targeting
  const filterButtons = container.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    const buttonText = btn.textContent.trim();
    
    if (buttonText === filter) {
      // Style the active button (orange)
      btn.style.border = '1px solid #f43e06';
      btn.style.background = 'linear-gradient(135deg, #f43e06, #ff6b35)';
      btn.style.color = 'white';
      btn.style.boxShadow = '0 2px 4px rgba(244, 62, 6, 0.3)';
    } else {
      // Style inactive buttons (white)
      btn.style.border = '1px solid #d1d5db';
      btn.style.background = 'white';
      btn.style.color = '#374151';
      btn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    }
  });

  // FIXED: Get filtered data and update statistics boxes
  try {
    const filteredData = await this.getCharacterUsageData(filter);
    
    // Update statistics boxes with filtered data
    const statsContainer = document.querySelector('#responsive-stats-grid');
    if (statsContainer) {
      statsContainer.innerHTML = this.createStatisticsBoxes(filteredData);
    }
  } catch (error) {
    console.error('❌ Error updating statistics boxes:', error);
  }

  // Load report with filter (existing code)
  const reportContent = container.querySelector('#character-usage-report');
  if (reportContent) {
    await this.loadCharacterUsageReport(reportContent, filter);
  }
}


// Method to apply custom date filter
  applyCustomDateFilter(container) {
  const fromDate = container.querySelector('#usage-from-date').value;
  const toDate = container.querySelector('#usage-to-date').value;
  
  if (!fromDate || !toDate) {
    alert('Please select both from and to dates');
    return;
  }

  // Update button states (clear quick filters)
  const buttons = container.querySelectorAll('button');
  buttons.forEach(btn => {
    if (['Today', 'Last 7 Days', 'Last 30 Days', 'All Time'].includes(btn.textContent)) {
      btn.style.background = 'white';
      btn.style.color = '#374151';
    }
  });

  // Load report with custom date range
  const reportContent = container.querySelector('#character-usage-report');
  this.loadCharacterUsageReport(reportContent, 'Custom', fromDate, toDate);
}


  async loadCharacterUsageReport(container, filter, fromDate = null, toDate = null) {
  try {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #6b7280;">
        <div style="font-size: 14px;">Loading character usage report...</div>
      </div>
    `;

    // Get filtered usage data
    const usageData = await this.getCharacterUsageData(filter, fromDate, toDate);
    
    if (!usageData || usageData.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #6b7280;">
          <div style="font-size: 14px;">No translation data found for the selected period</div>
        </div>
      `;
      return;
    }

    // Calculate totals
    const totals = usageData.reduce((acc, item) => {
      acc.inputChars += item.inputChars || 0;
      acc.promptChars += item.promptChars || 0;
      acc.outputChars += item.outputChars || 0;
      
      if (item.othersChars !== undefined) {
        acc.othersChars += item.othersChars;
      } else {
        const basicTotal = (item.inputChars || 0) + (item.promptChars || 0) + (item.outputChars || 0);
        const realTotal = item.totalChars || basicTotal;
        acc.othersChars += Math.max(0, realTotal - basicTotal);
      }
      
      acc.totalChars += item.totalChars || 0;
      
      if (item.totalCost !== undefined) {
        acc.totalCost += item.totalCost;
      } else {
        const inputTokens = Math.ceil((item.inputChars || 0) / this.CHARS_PER_TOKEN);
        const promptTokens = Math.ceil((item.promptChars || 0) / this.CHARS_PER_TOKEN);
        const outputTokens = Math.ceil((item.outputChars || 0) / this.CHARS_PER_TOKEN);
        
        const inputCost = (inputTokens * this.PRICING.INPUT_COST_PER_1M_TOKENS) / 1000000;
        const promptCost = (promptTokens * this.PRICING.INPUT_COST_PER_1M_TOKENS) / 1000000;
        const outputCost = (outputTokens * this.PRICING.OUTPUT_COST_PER_1M_TOKENS) / 1000000;
        
        acc.totalCost += inputCost + promptCost + outputCost;
      }
      
      return acc;
    }, { inputChars: 0, promptChars: 0, outputChars: 0, othersChars: 0, totalChars: 0, totalCost: 0 });

    // Create summary section with PROPER SPACING
    const summaryHtml = `
      <div style="
        margin-top: 24px;
        margin-bottom: 16px; 
        padding: 12px; 
        background: white; 
        border-radius: 6px; 
        border: 1px solid #e5e7eb;
      ">
        <h5 style="margin: 0 0 8px 0; font-size: 14px; color: #374151;">Summary for ${filter}${fromDate && toDate ? ` (${fromDate} to ${toDate})` : ''}</h5>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(20px, 1fr)); gap: 4px; font-size: 12px;">
          <div><strong>Input:</strong> ${totals.inputChars.toLocaleString()} chars</div>
          <div><strong>Prompt:</strong> ${totals.promptChars.toLocaleString()} chars</div>
          <div><strong>Output:</strong> ${totals.outputChars.toLocaleString()} chars</div>
          <div><strong>Others:</strong> ${totals.othersChars.toLocaleString()} chars</div>
          <div><strong>Total:</strong> ${totals.totalChars.toLocaleString()} chars</div>
          <div style="color: #16a34a; font-weight: 700;"><strong>Cost:</strong> $${totals.totalCost.toFixed(6)}</div>
        </div>
        <div style="font-size: 10px; margin: 5px 5px 5px 0px;">🟢API Translation 🟡 Cache Translation 🟠AI Assist </div
      </div>
    `;

    // Create detailed table
    const tableHtml = `
      <div style="max-height: 300px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead style="background: #f3f4f6; position: sticky; top: 0;">
            <tr>
              <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb; min-width: 80px;">Date & API</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb; min-width: 150px;">Original Text</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; min-width: 50px;">Input</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; min-width: 60px;">Prompt</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; min-width: 60px;">Output</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; min-width: 50px;">Others (Task)</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; min-width: 50px;">Total</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; min-width: 80px;">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            ${usageData
              .sort((a, b) => b.timestamp - a.timestamp) // ✅ Sort newest first
              .map(item => {
              // API Type styling and indicators
              const isTranslation = item.apiType === 'translation';
              const isAIAssist = item.apiType === 'ai_assist';
              
              let apiIndicator = '';
              let dateBackground = '#f9fafb';
              
              if (isTranslation) {
                apiIndicator = '🟢'; // Translation icon

              } else if (isAIAssist) {
                apiIndicator = '🟠'; // AI robot icon

              } else {
                apiIndicator = '🟡'; // Unknown API type

              }
              
              const dateString = new Date(item.timestamp).toLocaleDateString();
              const timeString = new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

              let othersChars;
              if (item.othersChars !== undefined) {
                othersChars = item.othersChars;
              } else {
                const basicTotal = (item.inputChars || 0) + (item.promptChars || 0) + (item.outputChars || 0);
                const realTotal = item.totalChars || basicTotal;
                othersChars = Math.max(0, realTotal - basicTotal);
              }

              let itemCost;
              if (item.totalCost !== undefined) {
                itemCost = item.totalCost;
              } else {
                const inputTokens = Math.ceil((item.inputChars || 0) / this.CHARS_PER_TOKEN);
                const promptTokens = Math.ceil((item.promptChars || 0) / this.CHARS_PER_TOKEN);
                const outputTokens = Math.ceil((item.outputChars || 0) / this.CHARS_PER_TOKEN);
                
                const inputCost = (inputTokens * this.PRICING.INPUT_COST_PER_1M_TOKENS) / 1000000;
                const promptCost = (promptTokens * this.PRICING.INPUT_COST_PER_1M_TOKENS) / 1000000;
                const outputCost = (outputTokens * this.PRICING.OUTPUT_COST_PER_1M_TOKENS) / 1000000;
                
                itemCost = inputCost + promptCost + outputCost;
              }

              const calculatedTotal = (item.inputChars || 0) + (item.promptChars || 0) + (item.outputChars || 0) + othersChars;
              const displayTotal = item.totalChars || calculatedTotal;

              return `
                <tr style="background: #f9fafb;">
                  <td style="
                    padding: 6px; 
                    border: 1px solid #e5e7eb; 
                    background: ${dateBackground};
                    font-weight: 600;
                  ">
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <span style="font-size: 14px;">${apiIndicator}</span>
                      <div>
                        <div style="font-size: 11px;">${dateString}</div>
                        <div style="font-size: 9px; color: #6b7280;">${timeString}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding: 6px; border: 1px solid #e5e7eb; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.originalText}">${item.originalText}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${item.inputChars || 0}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${item.promptChars || 0}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${item.outputChars || 0}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${othersChars}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">${displayTotal}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600; color: #16a34a; background: #f0fdf4;">$${itemCost.toFixed(6)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = summaryHtml + tableHtml;

  } catch (error) {
    console.error('❌ Error loading character usage report:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #dc2626;">
        <div style="font-size: 14px;">Error loading usage report: ${error.message}</div>
      </div>
    `;
  }
}


  updateTranslationWithResponse(originalMessage, responseText) {
  console.warn('🔍 AGENCY TRACKER - Got translation response:', responseText);
  
  const recentTranslations = this.trackedRequests.filter(req => 
    req.type === 'translation' && 
    req.inputText === originalMessage.text &&
    Date.now() - new Date(req.timestamp).getTime() < 10000
  );
  
  if (recentTranslations.length > 0) {
    const latestRequest = recentTranslations[recentTranslations.length - 1];
    
    latestRequest.outputText = responseText;
    latestRequest.actualResponse = true;
    
    // Recalculate usage with real output
    this.recalculateUsage(latestRequest);
    
    // CRITICAL FIX: Pass complete Agency Tracker data to Cache Manager
    if (window.maloumCacheManager) {
      console.warn('🔍 SYNCING - Calling Cache Manager with complete data:');
      console.warn(`🔍 Agency Tracker Total: ${latestRequest.totalChars} chars`);
      
      // FIXED: Pass the complete tracking data as 4th parameter
      window.maloumCacheManager.incrementApiRequests(
        latestRequest.inputText, 
        latestRequest.systemPrompt, 
        responseText,
        {
          totalChars: latestRequest.totalChars,
          inputChars: latestRequest.inputChars,
          promptChars: latestRequest.promptChars,
          outputChars: responseText.length,
          source: 'agency_tracker'
        }
      );
    }
    
    console.warn('🔍 FINAL STATS:', {
      agencyTotal: latestRequest.totalChars,
      breakdown: {
        input: latestRequest.inputChars,
        prompt: latestRequest.promptChars, 
        output: responseText.length,
        others: latestRequest.totalChars - (latestRequest.inputChars + latestRequest.promptChars + responseText.length)
      }
    });
  }
}

  async getCharacterUsageData(filter, fromDate = null, toDate = null) {
  try {
    const result = await chrome.storage.local.get(['characterUsageRecords']);
    const records = result.characterUsageRecords || [];
    
    if (records.length === 0) {
      return [];
    }
    
    // Add debugging
    if (records.length > 0) {
    }
    
    const now = new Date();
    let startTime, endTime;
    
    switch (filter) {
      case 'Last 1 hour':
        startTime = new Date(now.getTime() - (60 * 60 * 1000));
        endTime = now;
        break;
        
      case 'Today':
        // FIXED: Use constructor to avoid modifying original date
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
        
      case 'Yesterday':
        // FIXED: Use constructor to create proper yesterday range
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
        
      case 'Last 7 Days':
        startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        endTime = now;
        break;
        
      case 'This Month':
        startTime = new Date(now.getFullYear(), now.getMonth(), 1);
        endTime = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
        
      case 'All Time':
        return records;
        
      case 'Custom':
        if (fromDate && toDate) {
          startTime = new Date(fromDate);
          startTime.setHours(0, 0, 0, 0);
          endTime = new Date(toDate);
          endTime.setHours(23, 59, 59, 999);
        } else {
          return records;
        }
        break;
        
      default:
        return records;
    }
    
    
    const filtered = records.filter(record => {
      const recordDate = new Date(record.timestamp);
      const isInRange = recordDate >= startTime && recordDate <= endTime;
      
      // Debug each record for Yesterday filter
      if (filter === 'Yesterday') {
      }
      
      return isInRange;
    });
    
    return filtered;
    
  } catch (error) {
    console.error('❌ Error getting character usage data:', error);
    return [];
  }
}

  displaySearchResults(results, container) {
    container.innerHTML = '';

    if (results.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = 'No EN↔DE translations found.';
      noResults.style.cssText = `
        text-align: center !important;
        color: #6b7280 !important;
        padding: 40px !important;
        font-size: 16px !important;
      `;
      container.appendChild(noResults);
      return;
    }

    const resultsList = document.createElement('div');
    resultsList.style.cssText = 'display: flex !important; flex-direction: column !important; gap: 12px !important;';

    results.forEach(result => {
      const resultItem = document.createElement('div');
      resultItem.style.cssText = `
        background: white !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 8px !important;
        padding: 16px !important;
        transition: box-shadow 0.2s !important;
      `;

      resultItem.addEventListener('mouseenter', () => {
        resultItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      });

      resultItem.addEventListener('mouseleave', () => {
        resultItem.style.boxShadow = 'none';
      });

      const header = document.createElement('div');
      header.style.cssText = 'display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 8px !important;';

      const langPair = document.createElement('span');
      langPair.textContent = `${result.sourceLanguage || 'EN'} → ${result.targetLanguage || 'DE'}`;
      langPair.style.cssText = 'font-size: 12px !important; color: #f43e06 !important; font-weight: 600 !important;';

      const date = document.createElement('span');
      date.textContent = new Date(result.timestamp).toLocaleDateString();
      date.style.cssText = 'font-size: 12px !important; color: #6b7280 !important;';

      const originalText = document.createElement('div');
      originalText.style.cssText = 'margin-bottom: 8px !important;';
      originalText.innerHTML = `<strong>Original:</strong> ${result.originalText}`;

      const translatedText = document.createElement('div');
      translatedText.style.cssText = 'margin-bottom: 12px !important;';
      translatedText.innerHTML = `<strong>Translation:</strong> ${result.translatedText}`;

      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex !important; gap: 8px !important;';

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.style.cssText = `
        padding: 4px 8px !important;
        background: #3b82f6 !important;
        color: white !important;
        border: none !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 12px !important;
      `;
      editBtn.addEventListener('click', () => this.editCacheEntry(result));

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.style.cssText = `
        padding: 4px 8px !important;
        background: #ef4444 !important;
        color: white !important;
        border: none !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 12px !important;
      `;
      deleteBtn.addEventListener('click', () => this.deleteCacheEntry(result.hash, resultItem));

      header.appendChild(langPair);
      header.appendChild(date);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      resultItem.appendChild(header);
      resultItem.appendChild(originalText);
      resultItem.appendChild(translatedText);
      resultItem.appendChild(actions);

      resultsList.appendChild(resultItem);
    });

    if (results.length >= 50) {
      const showMore = document.createElement('div');
      showMore.textContent = `Showing first 50 results. Use search to narrow down.`;
      showMore.style.cssText = `
        text-align: center !important;
        color: #6b7280 !important;
        padding: 12px !important;
        font-size: 14px !important;
        font-style: italic !important;
      `;
      resultsList.appendChild(showMore);
    }

    container.appendChild(resultsList);
  }

  editCacheEntry(entry) {
  // Create edit modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 500px !important;
    max-width: 90vw !important;
    background: white !important;
    border: 1px solid #d1d5db !important;
    border-radius: 12px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15) !important;
    z-index: 1000000 !important;
    overflow: hidden !important;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px 20px !important;
    background: #f43e06 !important;
    color: white !important;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
  `;

  const title = document.createElement('h3');
  title.textContent = 'Edit EN↔DE Translation';
  title.style.cssText = 'margin: 0 !important; font-size: 16px !important; color: white !important;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    background: none !important;
    border: none !important;
    color: white !important;
    font-size: 18px !important;
    cursor: pointer !important;
    padding: 4px !important;
    width: 25px !important;
    height: 25px !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `;
  closeBtn.addEventListener('click', () => modal.remove());

  const content = document.createElement('div');
  content.style.cssText = `
    padding: 20px !important;
  `;

  const form = document.createElement('form');
  form.innerHTML = `
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-weight: 500; margin-bottom: 8px; color: #374151;">Original Text:</label>
      <textarea id="edit-original" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; resize: vertical; min-height: 60px; box-sizing: border-box;">${entry.originalText}</textarea>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-weight: 500; margin-bottom: 8px; color: #374151;">Translated Text:</label>
      <textarea id="edit-translated" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; resize: vertical; min-height: 60px; box-sizing: border-box;">${entry.translatedText}</textarea>
    </div>
    <div style="margin-bottom: 16px;">
      <small style="color: #6b7280;">
        <strong>Language Pair:</strong> ${entry.sourceLanguage} → ${entry.targetLanguage}<br>
        <strong>Type:</strong> ${entry.messageType || 'manual'}<br>
        <strong>Last Updated:</strong> ${new Date(entry.timestamp).toLocaleString()}
      </small>
    </div>
    <div style="display: flex; gap: 8px;">
      <button type="submit" style="flex: 1; padding: 10px; background: #f43e06; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Save Changes</button>
      <button type="button" id="cancel-edit" style="flex: 1; padding: 10px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Cancel</button>
    </div>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newOriginal = form.querySelector('#edit-original').value.trim();
    const newTranslated = form.querySelector('#edit-translated').value.trim();

    if (!newOriginal || !newTranslated) {
      this.showToast('Both fields are required', 'error');
      return;
    }

    // Validate that the text actually changed
    if (newOriginal === entry.originalText && newTranslated === entry.translatedText) {
      this.showToast('No changes detected', 'info');
      modal.remove();
      return;
    }

    try {
      // Update the cache entry
      const updatedEntry = {
        ...entry,
        originalText: newOriginal,
        translatedText: newTranslated,
        timestamp: Date.now() // Update timestamp
      };

      this.translationCache.set(entry.hash, updatedEntry);
      
      // Update reverse cache if translated text changed
      const oldTextHash = this.generateTextHash(entry.translatedText);
      const newTextHash = this.generateTextHash(newTranslated);
      
      if (oldTextHash !== newTextHash) {
        this.reverseTranslationCache.delete(oldTextHash);
        this.reverseTranslationCache.set(newTextHash, {
          originalText: newOriginal,
          translatedText: newTranslated,
          sourceLanguage: entry.sourceLanguage,
          targetLanguage: entry.targetLanguage,
          messageType: entry.messageType,
          originalMessageHash: entry.hash,
          timestamp: Date.now()
        });
      }

      // Save to persistent storage
      await this.saveTranslationCache();
      
      // Show success message
      this.showToast('Translation updated successfully!', 'success');
      
      // Close modal
      modal.remove();

      // CRITICAL: Auto-refresh counter after edit
      this.refreshTranslationCounter();

      // CRITICAL: Refresh search results to show updated entry
      setTimeout(async () => {
        
        // Get the search input and filters
        const searchInput = document.getElementById('cache-search-input');
        const sourceSelect = document.getElementById('source-filter');
        const targetSelect = document.getElementById('target-filter');
        
        if (searchInput) {
          const query = searchInput.value.trim();
          const options = {
            sourceLanguage: sourceSelect ? sourceSelect.value || null : null,
            targetLanguage: targetSelect ? targetSelect.value || null : null
          };

          // Re-run the search with current parameters
          const results = await this.searchCache(query, options);
          const resultsContainer = document.getElementById('search-results');
          if (resultsContainer) {
            this.displaySearchResults(results, resultsContainer);
          }
        }
      }, 100);

    } catch (error) {
      console.error('❌ Error updating translation:', error);
      this.showToast('Failed to update translation: ' + error.message, 'error');
    }
  });

  // Cancel button handler
  form.querySelector('#cancel-edit').addEventListener('click', () => {
    modal.remove();
  });

  // Assemble modal
  header.appendChild(title);
  header.appendChild(closeBtn);
  content.appendChild(form);
  modal.appendChild(header);
  modal.appendChild(content);

  // Add modal to page
  document.body.appendChild(modal);

  // Focus on first textarea
  setTimeout(() => {
    const firstTextarea = form.querySelector('#edit-original');
    if (firstTextarea) {
      firstTextarea.focus();
      firstTextarea.select();
    }
  }, 100);

  // Add escape key handler
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Remove escape handler when modal is removed
  const originalRemove = modal.remove.bind(modal);
  modal.remove = () => {
    document.removeEventListener('keydown', escapeHandler);
    originalRemove();
  };
}

  async deleteCacheEntry(hash, resultItem) {
  if (!confirm('Are you sure you want to delete this translation?')) {
    return;
  }

  const entry = this.translationCache.get(hash);
  if (entry) {
    // Remove from both caches
    this.translationCache.delete(hash);
    const textHash = this.generateTextHash(entry.translatedText);
    this.reverseTranslationCache.delete(textHash);

    // Save to persistent storage
    await this.saveTranslationCache();
    
    // Show success message
    this.showToast('Translation deleted successfully!', 'success');
    
    // Remove from UI
    resultItem.remove();

    // CRITICAL: Auto-refresh counter
    this.refreshTranslationCounter();

    // Update other UI elements
    const cacheStatus = document.getElementById('cache-status');
    if (cacheStatus) {
      cacheStatus.textContent = `Cached: ${this.translationCache.size}`;
    }
    
  }
}

  createBackupManageTab() {
    const container = document.createElement('div');

    // Manual translation entry section
    const manualSection = document.createElement('div');
    manualSection.style.cssText = `
      background: #f0f9ff !important;
      padding: 20px !important;
      border-radius: 8px !important;
      margin-bottom: 24px !important;
      border: 2px solid #0ea5e9 !important;
    `;

    manualSection.innerHTML = `
      <h4 style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">✨ Add Translation Manually</h4>
      <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">Add your own translation pairs directly to the cache.</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div>
          <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151; font-size: 12px;">Original Text:</label>
          <textarea id="manual-original" placeholder="Enter original text..." style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; resize: vertical; min-height: 80px; box-sizing: border-box; font-size: 14px;"></textarea>
        </div>
        <div>
          <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151; font-size: 12px;">Translated Text:</label>
          <textarea id="manual-translated" placeholder="Enter translation..." style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; resize: vertical; min-height: 80px; box-sizing: border-box; font-size: 14px;"></textarea>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div>
          <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151; font-size: 12px;">Source Language:</label>
          <select id="manual-source" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            <option value="EN">English</option>
            <option value="DE">German</option>
          </select>
        </div>
        <div>
          <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151; font-size: 12px;">Target Language:</label>
          <select id="manual-target" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            <option value="DE">German</option>
            <option value="EN">English</option>
          </select>
        </div>
        <div style="display: flex; align-items: end;">
          <button id="add-manual-translation" style="width: 100%; padding: 10px 16px; background: #0ea5e9; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px;">Add to Cache</button>
        </div>
      </div>
      
      <div id="manual-status" style="display: none; margin-top: 8px;"></div>
    `;

    // Export section
    const exportSection = document.createElement('div');
    exportSection.style.cssText = `
      background: #f9fafb !important;
      padding: 20px !important;
      border-radius: 8px !important;
      margin-bottom: 24px !important;
    `;

    exportSection.innerHTML = `
      <strong style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Export Cache</strong>
      <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">Download your translation cache as a backup file.</p>
      <div style="display: flex; gap: 12px;">
        <button id="export-json" style="padding: 10px 16px; background: #f43e06; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Export as JSON</button>
        <button id="export-csv" style="padding: 10px 16px; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Export as CSV</button>
      </div>
    `;

    // Import section
    const importSection = document.createElement('div');
    importSection.style.cssText = `
      background: #f9fafb !important;
      padding: 20px !important;
      border-radius: 8px !important;
    `;

    importSection.innerHTML = `
      <strong style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Import Cache</strong>
      <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">Import translations from a backup file.</p>
      <div style="margin-bottom: 16px;">
        <input type="file" id="import-file" accept=".json,.csv" style="margin-bottom: 12px; width: 100%;">
        <button id="import-btn" style="padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;" disabled>Import File</button>
      </div>
      <div id="import-status" style="display: none;"></div>
    `;

    // Event listeners
    setTimeout(() => {
      // Manual translation addition with improved error handling
      document.getElementById('add-manual-translation')?.addEventListener('click', async () => {
        const originalText = document.getElementById('manual-original').value.trim();
        const translatedText = document.getElementById('manual-translated').value.trim();
        const sourceLanguage = document.getElementById('manual-source').value;
        const targetLanguage = document.getElementById('manual-target').value;
        const statusDiv = document.getElementById('manual-status');



        if (!originalText || !translatedText) {
          statusDiv.style.display = 'block';
          statusDiv.textContent = 'Both original and translated text are required.';
          statusDiv.style.color = '#dc2626';
          return;
        }

        // FIXED: Validate EN↔DE only
        if (!((sourceLanguage === 'EN' && targetLanguage === 'DE') || (sourceLanguage === 'DE' && targetLanguage === 'EN'))) {
          statusDiv.style.display = 'block';
          statusDiv.textContent = 'Only EN↔DE translation pairs are allowed.';
          statusDiv.style.color = '#dc2626';
          return;
        }

        try {
          
          // Use the improved storage method
          const success = await this.storeCachedTranslation(
            null, // Let the method generate the cache key
            originalText,
            translatedText,
            sourceLanguage,
            targetLanguage,
            'manual'
          );


          if (success) {
            // Clear form
            document.getElementById('manual-original').value = '';
            document.getElementById('manual-translated').value = '';
            document.getElementById('manual-source').value = 'EN';
            document.getElementById('manual-target').value = 'DE';

            // Show success with cache size
            const cacheSize = this.translationCache.size;
            statusDiv.style.display = 'block';
            statusDiv.textContent = `EN↔DE translation added successfully! Cache now has ${cacheSize} entries.`;
            statusDiv.style.color = '#059669';
            
            this.showToast(`Manual EN↔DE translation added! Cache: ${cacheSize} entries`, 'success');


            // Hide status after delay
            setTimeout(() => {
              statusDiv.style.display = 'none';
            }, 5000);
          } else {
            throw new Error('Storage method returned false - check console for details');
          }

        } catch (error) {
          console.error('❌ Error adding manual translation:', error);
          statusDiv.style.display = 'block';
          statusDiv.textContent = `Error: ${error.message}`;
          statusDiv.style.color = '#dc2626';
          this.showToast('Failed to add translation: ' + error.message, 'error');
        }
      });

      // Export JSON
      document.getElementById('export-json')?.addEventListener('click', async () => {
        const data = await this.exportCache('json');
        this.downloadFile(data, 'maloum-en-de-cache-backup.json', 'application/json');
        this.showToast('EN↔DE cache exported as JSON!', 'success');
      });

      // Export CSV
      document.getElementById('export-csv')?.addEventListener('click', async () => {
        const data = await this.exportCache('csv');
        this.downloadFile(data, 'maloum-en-de-cache-backup.csv', 'text/csv');
        this.showToast('EN↔DE cache exported as CSV!', 'success');
      });

      // Import file
      const fileInput = document.getElementById('import-file');
      const importBtn = document.getElementById('import-btn');
      const importStatus = document.getElementById('import-status');

      fileInput?.addEventListener('change', (e) => {
        importBtn.disabled = !e.target.files.length;
      });

      importBtn?.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            importStatus.style.display = 'block';
            importStatus.textContent = 'Importing EN↔DE translations...';
            importStatus.style.color = '#3b82f6';

            const format = file.name.endsWith('.csv') ? 'csv' : 'json';
            const result = await this.importCache(e.target.result, format);

            if (result.success) {
              importStatus.textContent = `Successfully imported ${result.imported} EN↔DE translations!`;
              importStatus.style.color = '#059669';
              this.showToast(`Imported ${result.imported} EN↔DE translations!`, 'success');
              fileInput.value = '';
              importBtn.disabled = true;
            } else {
              importStatus.textContent = `Import failed: ${result.error}`;
              importStatus.style.color = '#dc2626';
              this.showToast('Import failed: ' + result.error, 'error');
            }
          } catch (error) {
            importStatus.textContent = `Import error: ${error.message}`;
            importStatus.style.color = '#dc2626';
            this.showToast('Import error: ' + error.message, 'error');
          }
        };
        reader.readAsText(file);
      });
    }, 100);

    container.appendChild(manualSection);
    container.appendChild(exportSection);
    container.appendChild(importSection);
    return container;
  }

  createSettingsTab() {
    const container = document.createElement('div');

    const settingsSection = document.createElement('div');
    settingsSection.style.cssText = `
      background: #f9fafb !important;
      padding: 20px !important;
      border-radius: 8px !important;
    `;

    settingsSection.innerHTML = `
      <strong style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Cache Management</strong>
      <div style="margin-bottom: 20px;">
        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">Clear all cached translations. This action cannot be undone.</p>
        <button id="clear-cache" style="padding: 10px 16px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Clear All Cache</button>
      </div>
      <div style="margin-bottom: 20px;">
        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">Remove translations older than a specific date.</p>
        <div style="display: flex; gap: 12px; align-items: center;">
          <input type="date" id="cleanup-date" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
          <button id="cleanup-old" style="padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Remove Old</button>
        </div>
      </div>
      <div>
        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">Optimize cache by removing duplicate entries.</p>
        <button id="optimize-cache" style="padding: 10px 16px; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Optimize Cache</button>
      </div>
    `;

    // Event listeners
    setTimeout(() => {
      document.getElementById('clear-cache').addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all cached EN↔DE translations? This cannot be undone.')) {
          this.translationCache.clear();
          this.reverseTranslationCache.clear();
          await this.saveTranslationCache();
          this.showToast('All EN↔DE cache cleared!', 'success');
          
          // Update cache status if available
          const cacheStatus = document.getElementById('cache-status');
          if (cacheStatus) {
            cacheStatus.textContent = 'Cached: 0';
          }
        }
      });

      document.getElementById('cleanup-old').addEventListener('click', async () => {
        const dateInput = document.getElementById('cleanup-date');
        if (!dateInput.value) {
          this.showToast('Please select a date', 'error');
          return;
        }

        const cutoffDate = new Date(dateInput.value).getTime();
        let removed = 0;

        const toRemove = [];
        this.translationCache.forEach((entry, hash) => {
          if (entry.timestamp < cutoffDate) {
            toRemove.push(hash);
          }
        });

        toRemove.forEach(hash => {
          const entry = this.translationCache.get(hash);
          this.translationCache.delete(hash);
          if (entry) {
            const textHash = this.generateTextHash(entry.translatedText);
            this.reverseTranslationCache.delete(textHash);
          }
          removed++;
        });

        await this.saveTranslationCache();
        this.showToast(`Removed ${removed} old EN↔DE translations`, 'success');
      });

      document.getElementById('optimize-cache').addEventListener('click', async () => {
        // Find and remove duplicates based on original text + target language
        const seen = new Set();
        const toRemove = [];
        let removed = 0;

        this.translationCache.forEach((entry, hash) => {
          const key = `${entry.originalText.toLowerCase()}_${entry.targetLanguage}`;
          if (seen.has(key)) {
            toRemove.push(hash);
          } else {
            seen.add(key);
          }
        });

        toRemove.forEach(hash => {
          const entry = this.translationCache.get(hash);
          this.translationCache.delete(hash);
          if (entry) {
            const textHash = this.generateTextHash(entry.translatedText);
            this.reverseTranslationCache.delete(textHash);
          }
          removed++;
        });

        await this.saveTranslationCache();
        this.showToast(`Removed ${removed} duplicate EN↔DE entries`, 'success');
      });
    }, 100);

    container.appendChild(settingsSection);
    return container;
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  showToast(message, type = 'info') {
    try {
      
      // Remove existing toasts
      const existingToasts = document.querySelectorAll('.maloum-toast');
      existingToasts.forEach(toast => toast.remove());
      
      const toast = document.createElement('div');
      toast.className = 'maloum-toast';
      toast.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        padding: 12px 16px !important;
        border-radius: 6px !important;
        color: white !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 14px !important;
        z-index: 1000001 !important;
        max-width: 300px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#3b82f6'} !important;
        opacity: 0 !important;
        transition: opacity 0.3s ease !important;
      `;
      
      toast.textContent = message;
      document.body.appendChild(toast);
      
      // Animate in
      setTimeout(() => {
        toast.style.opacity = '1';
      }, 10);
      
      // Remove after delay
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }, 3000);
    } catch (error) {
      console.warn('Error showing toast:', error);
    }
  }

  // Cleanup method
  destroy() {
    try {
      this.closeCacheUI();
      this.saveTranslationCache();
    } catch (error) {
      console.warn('Error during cache manager cleanup:', error);
    }
  }
}

// Enhanced initialization with better error handling
let cacheManager = null;

function initializeCacheManager() {
  try {
    console.log('🔧 initializeCacheManager() called');

    // Prevent multiple initializations
    if (window.maloumCacheManager) {
      console.log('⚠️ Cache Manager already exists, skipping re-initialization');
      return window.maloumCacheManager;
    }

    // Check if we're on the right domain
    if (!window.location.hostname.includes('maloum.com')) {
      console.log('⏭️ Not on maloum.com, skipping cache manager');
      return;
    }

    console.log('✅ On maloum.com, creating MaloumCacheManager...');
    console.log('🔍 MaloumCacheManager class available:', typeof MaloumCacheManager);

    // Create new instance (will handle cleanup of old one automatically)
    cacheManager = new MaloumCacheManager();

    // Store globally with Object.defineProperty to make it non-configurable
    Object.defineProperty(window, 'maloumCacheManager', {
      value: cacheManager,
      writable: false,
      configurable: false,
      enumerable: true
    });

    window.MaloumCacheManager = MaloumCacheManager;

    console.log('✅ Cache Manager created and stored globally:', typeof window.maloumCacheManager);
    console.log('🔒 Cache Manager is now non-configurable and non-writable');

    return cacheManager;
  } catch (error) {
    console.error('❌ Failed to initialize FIXED Cache Manager:', error);
    console.error('Error details:', error.message, error.stack);
    return null;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCacheManager);
} else {
  initializeCacheManager();
}

// Fallback initialization
  setTimeout(() => {
  if (!cacheManager || !cacheManager.initialized) {
    initializeCacheManager();
  }
}, 2000);

// Debug functions
window.debugCache = {
  showUI: async () => {
    if (cacheManager) {
      await cacheManager.showCacheUI();
    } else {
    }
  },
  getStats: async () => {
    if (cacheManager) {
      const stats = await cacheManager.getCacheStats();
      return stats;
    } else {
      return null;
    }
  },
  search: async (query) => {
    if (cacheManager) {
      const results = await cacheManager.searchCache(query);
      return results;
    } else {
      return [];
    }
  },
  restart: initializeCacheManager,
  getInstance: () => cacheManager,
  testEscape: () => {
    if (cacheManager && cacheManager.isUIOpen) {
    } else {
    }
  },
  testCacheLookup: async (text) => {
    if (cacheManager) {
      const result = await cacheManager.getCachedTranslation(text);
      return result;
    } else {
      return null;
    }
  },
  listCacheKeys: () => {
    if (cacheManager) {
      const keys = Array.from(cacheManager.translationCache.keys());
      return keys;
    } else {
      return [];
    }
  },
  testStorage: async () => {
    if (cacheManager) {
      if (cacheManager.storage) {
      }
      return {
        storageReady: cacheManager.storageReady,
        hasStorageInstance: !!cacheManager.storage,
        storageInitialized: cacheManager.storage?.isInitialized,
        translationStrategy: 'EN↔DE only, 2 entries per translation'
      };
    } else {
      return null;
    }
  }
};



// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (cacheManager) {
    cacheManager.destroy();
  }
});
