// Agency Tracker - FULL VERSION with Statistics UI
// tracker.js - Production-ready with cache-manager style UI

console.log('📊 Full-Featured Agency Tracker starting...');

// Global tracker instance
window.AGENCY_TRACKER_INSTANCE = null;

const AUTO_CONFIG = {
  sheetsUrl: "https://script.google.com/macros/s/AKfycbzvAzYPnKKYFUGaYY7GZX6ycMsJ_VmSUMku7-F-i-HaQ0bJhcgbvAxSaIecw45iHCBd/exec",
  agencyId: "default_agency",
  enabled: true
};




class FullFeaturedAgencyTracker {
  constructor() {
    this.isUIOpen = false;
    this.button = null;
    this.uiContainer = null;
    this.chatterId = null;
    this.config = AUTO_CONFIG;
    this.lastTeamStatsCache = null;
    this.lastCacheTime = 0;
    this.cacheTimeout = 30 * 1000; // 30 seconds for realtime testing
    this.realtimeInterval = null;
    this.trackedRequests = [];
    this.pendingRequests = new Map();
    this.isOpening = false;
    this.isClosing = false;
    this.isAnimating = false;
    this.keyboardHandler = null;
    this.currentFilter = 'This Month';
    // Ultra-robust button monitoring (proven to work)
    this.buttonRestoreInterval = null;
    this.urlCheckInterval = null;
    this.lastButtonCheck = 0;
    
    this.lastRefreshRequestId = null;
    this.buttonRestoreInterval = null;
    this.urlCheckInterval = null;
    this.lastButtonCheck = 0;
    
    this.init();
  }

  async init() {
    console.log('📊 Initializing Full-Featured Agency Tracker...');
    await this.setupAutoConfiguration();
    await this.loadPersistedData();
    this.setupChromeMessageInterception();
    this.setupEventListeners();
    this.setupUltraRobustButtonMonitoring();
    this.tryCreateButton();
    console.log('✅ Full-featured tracker initialized');
  }

  async setupAutoConfiguration() {
    try {
      const stored = await chrome.storage.sync.get(['chatterId', 'agencyTrackingEnabled']);
      
      if (!stored.chatterId) {
        this.chatterId = 'chatter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        await chrome.storage.sync.set({ chatterId: this.chatterId });
      } else {
        this.chatterId = stored.chatterId;
      }
      
      console.log('📊 Auto-configuration complete:', {
        chatterId: this.chatterId,
        enabled: stored.agencyTrackingEnabled !== false
      });
    } catch (error) {
      console.error('❌ Setup error:', error);
      this.chatterId = 'fallback_' + Date.now();
    }
  }

  async loadPersistedData() {
    try {
      const stored = await chrome.storage.local.get(['trackedRequests']);
      this.trackedRequests = stored.trackedRequests || [];
      console.log('📊 Loaded persisted data:', this.trackedRequests.length, 'requests');
    } catch (error) {
      console.error('❌ Error loading persisted data:', error);
      this.trackedRequests = [];
    }
  }

  async savePersistedData() {
    try {
      await chrome.storage.local.set({ trackedRequests: this.trackedRequests });
    } catch (error) {
      console.error('❌ Error saving persisted data:', error);
    }
  }

  setupChromeMessageInterception() {
    if (typeof chrome !== 'undefined' && chrome.webRequest) {
      chrome.webRequest.onBeforeRequest.addListener(
        (details) => this.interceptRequest(details),
        { urls: ["*://*.together.xyz/*"] },
        ["requestBody"]
      );
    }
  }

  interceptRequest(details) {
    if (details.method === 'POST' && details.requestBody) {
      const requestId = details.requestId;
      const timestamp = new Date().toISOString();
      
      try {
        let bodyData = null;
        if (details.requestBody.raw) {
          const decoder = new TextDecoder();
          bodyData = JSON.parse(decoder.decode(details.requestBody.raw[0].bytes));
        }
        
        const requestData = {
          requestId,
          timestamp,
          url: details.url,
          type: this.determineRequestType(details.url, bodyData),
          bodyData
        };
        
        this.pendingRequests.set(requestId, requestData);
        console.log('📊 Intercepted request:', requestData);
      } catch (error) {
        console.error('❌ Error intercepting request:', error);
      }
    }
  }

  determineRequestType(url, bodyData) {
    if (url.includes('/chat/completions')) return 'chat';
    if (url.includes('/translate')) return 'translation';
    if (bodyData?.model?.includes('translate')) return 'translation';
    return 'unknown';
  }

  setupUltraRobustButtonMonitoring() {
    console.log('🔥 Setting up ultra-robust button monitoring...');
    
    // Method 1: Fast interval check
    this.buttonRestoreInterval = setInterval(() => {
      this.checkAndRestoreButton();
    }, 1000);
    
    // Method 2: DOM mutation observer
    const observer = new MutationObserver((mutations) => {
      let needsCheck = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && (mutation.removedNodes.length > 0 || mutation.addedNodes.length > 0)) {
          needsCheck = true;
          break;
        }
      }
      if (needsCheck) {
        setTimeout(() => this.checkAndRestoreButton(), 100);
        setTimeout(() => this.checkAndRestoreButton(), 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Method 3: URL change detection
    let lastUrl = window.location.href;
    this.urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        console.log('🔥 URL change detected, restoring button...');
        lastUrl = window.location.href;
        setTimeout(() => this.checkAndRestoreButton(), 500);
        setTimeout(() => this.checkAndRestoreButton(), 2000);
      }
    }, 1000);
    
    // Method 4: Focus events
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(() => this.checkAndRestoreButton(), 500);
      }
    });
    
    console.log('✅ Ultra-robust button monitoring active');
  }

  checkAndRestoreButton() {
    const now = Date.now();
    if (now - this.lastButtonCheck < 500) return;
    this.lastButtonCheck = now;
    
    const existing = document.getElementById('maloum-agency-tracker-btn');
    const promptButton = document.getElementById('maloum-prompt-button');
    const aiAssistButton = document.getElementById('maloum-ai-assist-btn');
    
    if ((promptButton || aiAssistButton) && !existing) {
      console.log('🔥 BUTTON MISSING - Restoring...');
      this.tryCreateButton();
    }
  }

  tryCreateButton() {
    try {
      const existing = document.getElementById('maloum-agency-tracker-btn');
      if (existing) existing.remove();
      
      const promptButton = document.getElementById('maloum-prompt-button');
      const aiAssistButton = document.getElementById('maloum-ai-assist-btn');
      
      let parentContainer = null;
      if (promptButton) {
        parentContainer = promptButton.parentElement;
      } else if (aiAssistButton) {
        parentContainer = aiAssistButton.parentElement;
      }
      
      if (parentContainer) {
        this.createButtonInContainer(parentContainer);
        console.log('✅ BUTTON RESTORED');
      }
    } catch (error) {
      console.error('❌ Error creating button:', error);
    }
  }

createButtonInContainer(parentContainer) {
  // Remove existing button first
  const existing = document.getElementById('maloum-agency-tracker-btn');
  if (existing) {
    existing.remove();
  }

  this.button = document.createElement('button');
  this.button.id = 'maloum-agency-tracker-btn';
  this.button.innerHTML = '📊';
  this.button.title = 'Tracker - Team Usage & Current State (Alt+I)';
  
  // Base styling
  this.button.style.cssText = `
    width: 22px !important;
    height: 22px !important;
    border-radius: 50% !important;
    background: linear-gradient(135deg, #f43e06 0%, #FADA7A 100%) !important;
    border: 3px solid white !important;
    color: white !important;
    font-size: 12px !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 0 20px rgba(248, 115, 6, 0.6) !important;
    flex-shrink: 0 !important;
    pointer-events: auto !important;
    font-weight: bold !important;
    z-index: 1000 !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
    position: absolute !important;
    top: -8px !important;
    right: 48px !important;
    margin: 0px !important;
    transform: scale(1) rotate(0deg) !important;
  `;

  // Click event listener
  this.button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleUI();
  });

  // ✅ ENHANCED HOVER ANIMATIONS - Remove any conflicts and force the new style
  this.button.addEventListener('mouseenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Force the enhanced animation
    this.button.style.setProperty('transform', 'scale(1.9) rotate(5deg)', 'important');
    this.button.style.setProperty('box-shadow', '0 0 30px rgba(248, 115, 6, 0.6), 0 0 50px rgba(248, 115, 6, 0.4)', 'important');
  });

  this.button.addEventListener('mouseleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Force return to normal state
    this.button.style.setProperty('transform', 'scale(1) rotate(0deg)', 'important');
    this.button.style.setProperty('box-shadow', '0 0 20px rgba(248, 115, 6, 0.6)', 'important');
  });

  parentContainer.appendChild(this.button);

}

  createUIContainer() {
    if (this.uiContainer) {
      this.uiContainer.remove();
    }
    
    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'maloum-agency-tracker-ui';
    document.body.appendChild(this.uiContainer);
    
    console.log('✅ UI container created');
  }

  resetStates() {
    this.isUIOpen = false;
    this.isOpening = false;
    this.isClosing = false;
    this.isAnimating = false;
    this.stopRealtimeRefresh(); // ADD this line
  }

  showLoadingState() {
    if (!this.uiContainer) return;
    
    this.uiContainer.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="text-align: center;">
          <div style="
            width: 32px;
            height: 32px;
            border: 3px solid #f43e06;
            border-top: 3px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px auto;
          "></div>
          <div style="
            font-size: 14px;
            color: #6b7280;
            font-weight: 500;
          ">
            Loading tracker data...
          </div>
        </div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    this.uiContainer.style.display = 'block';
    this.uiContainer.style.opacity = '1';
    this.uiContainer.style.transform = 'translate(-50%, -50%) scale(1)';
  }

async loadUIData() {
  try {
    console.log('🔥 Loading UI data from Firebase...');
    
    // Clear any existing cache to ensure fresh data
    this.clearUserCache();
    
    // Get the current filter
    const currentFilter = this.currentFilter || 'This Month';
    console.log(`🔥 Using filter: ${currentFilter}`);
    
    // Get team stats with the current filter
    console.log('🔥 Fetching Firebase team stats with filter:', currentFilter);
    const teamStats = await this.getFilteredTeamStats(currentFilter);
    
    console.log('🔥 Firebase data received:', teamStats);
    console.log(`🔍 Active users in stats: ${teamStats.activeUsers ? teamStats.activeUsers.length : 'undefined'}`);
    
    // Make sure we have active users
    if (!teamStats.activeUsers || teamStats.activeUsers.length === 0) {
      console.log('⚠️ No active users in stats, fetching separately...');
      const activeUsers = await this.getFirebaseActiveUsersBasic();
      teamStats.activeUsers = activeUsers;
      console.log(`🔥 Added ${activeUsers.length} active users to stats`);
    }
    
    // CRITICAL FIX: Force UI update after data is loaded
    console.log('🔥 Forcing UI update with loaded data...');
    this.forceUIUpdate(teamStats);
    
    console.log('✅ UI data loaded from Firebase successfully');
  } catch (error) {
    console.error('❌ Error loading UI data from Firebase:', error);
    this.showToast('Failed to load team statistics', 'error');
    
    // CRITICAL: Even on error, force UI update with empty data to remove loading state
    this.forceUIUpdate(this.getEmptyStats());
  }
}

forceUIUpdate(teamStats) {
  try {
    console.log('🔥 Force UI update starting with data:', teamStats);
    
    if (!this.uiContainer) {
      console.error('❌ UI container not found - cannot update UI');
      return;
    }
    
    // Remove any loading states
    this.removeLoadingState();
    
    // Normalize the data
    const normalizedStats = {
      apiRequests: teamStats?.apiRequests || 0,
      cacheHits: teamStats?.cacheHits || 0,
      totalCharacters: teamStats?.totalCharacters || 0,
      estimatedCost: teamStats?.estimatedCost || 0,
      translationApi: teamStats?.translationApi || 0,
      aiAssistApi: teamStats?.aiAssistApi || 0,
      activeUsers: teamStats?.activeUsers || []
    };
    
    console.log('🔥 Normalized stats for UI:', normalizedStats);
    
    // Force complete UI recreation
    this.renderCompleteUI(normalizedStats);
    
    // Setup event listeners again
    this.setupUIEventListeners();
    
    console.log('✅ Force UI update completed');
    
  } catch (error) {
    console.error('❌ Error in force UI update:', error);
  }
}

removeLoadingState() {
  try {
    // Remove any loading indicators
    const loadingElements = this.uiContainer.querySelectorAll('[class*="loading"], [id*="loading"]');
    loadingElements.forEach(el => el.remove());
    
    // Remove loading text content
    const elementsWithLoadingText = this.uiContainer.querySelectorAll('*');
    elementsWithLoadingText.forEach(el => {
      if (el.textContent && el.textContent.includes('Loading tracker data')) {
        el.style.display = 'none';
      }
    });
    
    console.log('🗑️ Loading state removed');
  } catch (error) {
    console.warn('⚠️ Error removing loading state:', error);
  }
}

// ADD HOVER EFFECT TO REFRESH BUTTON - Update renderCompleteUI() method in tracker.js

renderCompleteUI(normalizedStats) {
  if (!this.uiContainer) return;
  
  console.log('🎨 Rendering EXACT original UI design with enhanced refresh button');
  
  // Use your EXACT original renderUI structure
  this.uiContainer.innerHTML = `
    <div style="
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 100%);
      color: white;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 16px 16px 0 0;
    ">
      <div>
        <h2 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 700;">Tracker</h2>
        <div style="font-size: 12px; opacity: 0.8;">Last updated: ${new Date().toLocaleTimeString()}</div>
      </div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <button id="admin-refresh-btn" style="
          background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(81, 82, 83, 0.89);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          min-width: 100px;
          text-align: center;
          transform: translateY(0) scale(1);
        ">Refresh</button>
        <button 
          id="close-tracker-btn"
          style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: white;
            padding: 4px;
            line-height: 1;
            opacity: 0.8;
            transition: opacity 0.2s;
          "
          title="Close (ESC)"
        >×</button>
      </div>
    </div>
    <div style="
      border: 0.2px solid rgba(172, 175, 174, 0.21);
      margin: 0px 20px 10px 20px;
    "></div>

    <!-- Statistics Grid -->
    <div id="tracker-stats-grid" style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 0 24px 16px 24px;
    ">
      ${this.createFilteredStatisticsBoxes(normalizedStats)}
    </div>

    <!-- Users Section -->
    <div style="
      margin: 0 24px 24px 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    ">
      <h3 style="
        margin: 0 0 16px 0;
        font-size: 16px;
        color: #374151;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <span>👥 All Users (<span id="userCount">${normalizedStats.activeUsers.length}</span>)</span>
      </h3>
      <div id="usersList">
        ${this.createUsersSection(normalizedStats.activeUsers)}
      </div>
    </div>
  `;

  // Ensure original container sizing
  this.uiContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(244, 62, 6, 0.1);
    z-index: 10001;
    width: 800px;
    height: 800px;
    max-width: 95vw;
    max-height: 85vh;
    overflow-y: auto;
    overflow-x: hidden;
    font-family: system-ui, -apple-system, sans-serif;
    transform: translate(-50%, -50%);
    display: block;
    pointer-events: auto;
  `;
  
  // ADD HOVER EFFECTS AFTER UI IS RENDERED
  this.addRefreshButtonHoverEffects();
  
  console.log('✅ EXACT original UI restored with enhanced refresh button');
  this.addTrackerScrollbarStyles();
}
addTrackerScrollbarStyles() {
  // Check if styles already exist
  if (document.getElementById('tracker-scrollbar-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'tracker-scrollbar-styles';
  style.textContent = `
    /* Hide scrollbar for tracker UI */
    #maloum-agency-tracker-ui {
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* Internet Explorer 10+ */
    }

    #maloum-agency-tracker-ui::-webkit-scrollbar {
      width: 0px; /* Chrome, Safari, Opera */
      background: transparent;
    }

    #maloum-agency-tracker-ui::-webkit-scrollbar-thumb {
      background: transparent;
    }
  `;
  
  document.head.appendChild(style);
  console.log('✅ Tracker scrollbar styles injected');
}

// NEW METHOD: Add hover effects to refresh button to match statistics boxes
addRefreshButtonHoverEffects() {
  const refreshBtn = this.uiContainer.querySelector('#admin-refresh-btn');
  if (!refreshBtn) return;
  
  console.log('✨ Adding hover effects to refresh button');
  
  // Add mouseenter event (hover in)
  refreshBtn.addEventListener('mouseenter', () => {
    console.log('🖱️ Refresh button hover in');
    refreshBtn.style.transform = 'translateY(-4px) scale(1.02)';
    refreshBtn.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.15), 0 4px 12px rgba(0, 0, 0, 0.15)';
    refreshBtn.style.borderColor = '#10b981';
    refreshBtn.style.background = 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)';
    refreshBtn.style.color = '#065f46';
  });
  
  // Add mouseleave event (hover out)
  refreshBtn.addEventListener('mouseleave', () => {
    console.log('🖱️ Refresh button hover out');
    refreshBtn.style.transform = 'translateY(0) scale(1)';
    refreshBtn.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    refreshBtn.style.borderColor = '#e5e7eb';
    refreshBtn.style.background = 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)';
    refreshBtn.style.color = 'rgba(81, 82, 83, 0.89)';
  });
  
  console.log('✅ Hover effects added to refresh button');
}

// ALSO UPDATE: setupUIEventListeners() to include the hover effects
setupUIEventListeners() {
  if (!this.uiContainer) return;
  
  console.log('🔧 Setting up UI event listeners...');
  
  // Close button
  const closeBtn = this.uiContainer.querySelector('#close-tracker-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📊 Close button clicked');
      this.closeTrackerUI();
    });
    
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.opacity = '1';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.opacity = '0.8';
    });
  }
  
  // Refresh button - click handler
  const refreshBtn = this.uiContainer.querySelector('#admin-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📊 Admin refresh button clicked');
      this.adminRefresh();
    });
    
    // ADD: Hover effects for refresh button (same as statistics boxes)
    refreshBtn.addEventListener('mouseenter', () => {
      console.log('✨ Refresh button hover - transforming...');
      refreshBtn.style.transform = 'translateY(-4px) scale(1.02)';
      refreshBtn.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.15), 0 4px 12px rgba(0, 0, 0, 0.15)';
      refreshBtn.style.borderColor = '#10b981';
      refreshBtn.style.background = 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)';
      refreshBtn.style.color = '#065f46';
    });
    
    refreshBtn.addEventListener('mouseleave', () => {
      console.log('✨ Refresh button hover out - restoring...');
      refreshBtn.style.transform = 'translateY(0) scale(1)';
      refreshBtn.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
      refreshBtn.style.borderColor = '#e5e7eb';
      refreshBtn.style.background = 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)';
      refreshBtn.style.color = 'rgba(81, 82, 83, 0.89)';
    });
  }
  
  // Use event delegation for all buttons
  this.uiContainer.addEventListener('click', (e) => {
    // Handle tab buttons
    if (e.target.classList.contains('tab-btn')) {
      e.preventDefault();
      e.stopPropagation();
      
      const tab = e.target.getAttribute('data-tab');
      console.log('📊 Tab clicked:', tab);
      
      this.activeTab = tab;
      
      this.uiContainer.querySelectorAll('.tab-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === tab;
        btn.classList.toggle('active', isActive);
        btn.style.background = isActive ? '#f43e06' : 'transparent';
        btn.style.color = isActive ? 'white' : '#6b7280';
      });
      
      this.loadUIData().catch(console.error);
      return;
    }
  });
  
  setTimeout(() => {
    const buttons = this.uiContainer.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.style.pointerEvents = 'auto';
      btn.style.cursor = 'pointer';
      btn.style.zIndex = '1';
    });
    console.log(`🔧 Event listeners setup complete for ${buttons.length} buttons`);
  }, 50);
}

// ==================================================
// FIX 5: Enhanced createUI() - Initial UI creation
// ==================================================

createUI() {
  console.log('🎨 Creating tracker UI...');
  
  // Remove any existing UI
  const existingUI = document.getElementById('maloum-tracker-ui');
  if (existingUI) {
    existingUI.remove();
  }
  
  // Create container
  this.uiContainer = document.createElement('div');
  this.uiContainer.id = 'maloum-tracker-ui';
  this.uiContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    width: 600px;
    max-width: 90vw;
    max-height: 80vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
  `;
  
  // Show loading state initially
  this.uiContainer.innerHTML = `
    <div style="
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(20, 20, 20, 0.9));
      color: white;
      padding: 16px 20px;
      border-radius: 12px 12px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <div>
        <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Tracker</h2>
        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-top: 2px;">
          Loading...
        </div>
      </div>
      <button id="close-tracker-btn" style="
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.8);
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        line-height: 1;
        opacity: 0.8;
        transition: opacity 0.2s ease;
      ">×</button>
    </div>
    
    <div style="padding: 40px; text-align: center;">
      <div style="
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #f43e06;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      "></div>
      <div style="color: #6b7280; font-size: 14px;">Loading tracker data...</div>
    </div>
    
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  
  document.body.appendChild(this.uiContainer);
  
  // Setup close button immediately
  const closeBtn = this.uiContainer.querySelector('#close-tracker-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeTrackerUI();
    });
  }
  
  console.log('✅ UI container created with loading state');
  return this.uiContainer;
}


clearUserCache() {
  try {
    // Clear active users cache to ensure fresh data
    sessionStorage.removeItem('admin_cache_admin_active_users');
    console.log('🗑️ Cleared active users cache');
  } catch (error) {
    // Ignore cache clear errors
  }
}

async getFilteredTeamStats(filter = null, fromDate = null, toDate = null) {
  try {
    const actualFilter = filter || this.currentFilter || 'This Month';
    console.log('🔥 Fetching Firebase team stats with filter:', actualFilter);
    
    // Use real-time data for recent filters, historical for longer periods
    let teamStats;
    
    if (actualFilter === 'Today' || actualFilter === 'Last 7 Days') {
      // Use real-time data for recent timeframes
      teamStats = await this.getFirebaseCurrentStats();
    } else {
      // Use historical data with proper date filtering for "This Month" and other filters
      teamStats = await this.getFirebaseHistoricalStats(actualFilter, fromDate, toDate);
    }
    
    console.log('🔥 Firebase data received:', teamStats);
    
    // Update cache
    this.lastTeamStatsCache = teamStats;
    this.lastCacheTime = Date.now();
    
    return teamStats;
    
  } catch (error) {
    console.error('❌ Error fetching team stats from Firebase:', error);
    
    // Return cached data if available
    if (this.lastTeamStatsCache) {
      console.log('🔥 Returning cached data due to error');
      return this.lastTeamStatsCache;
    }
    
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
}


displayStatisticsUI(teamStats) {
  this.currentFilter = 'This Month';
  
  const totalRequests = teamStats.cacheHits + teamStats.apiRequests;
  const cacheEfficiency = totalRequests > 0 ? Math.round((teamStats.cacheHits / totalRequests) * 100) : 0;

  const normalizedStats = {
    apiRequests: teamStats.apiRequests || 0,
    cacheHits: teamStats.cacheHits || 0,
    totalCharacters: teamStats.totalCharacters || 0,
    estimatedCost: teamStats.estimatedCost || 0,
    translationApi: teamStats.translationApi || 0,
    aiAssistApi: teamStats.aiAssistApi || 0,
    activeUsers: teamStats.activeUsers || []
  };

  // Always set the innerHTML
  this.uiContainer.innerHTML = `
    <!-- Header -->
    <div style="
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 100%);
      color: white;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 16px 16px 0 0;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <h2 style="margin: 0; font-size: 25px; font-weight: 700;">Tracker</h2>
        <div style="font-size: 12px; opacity: 0.8;">Last updated: ${new Date().toLocaleTimeString()}</div>
      </div>
      <button 
        id="close-tracker-btn"
        style="
          margin-left: 30px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: white;
          padding: 4px;
          line-height: 1;
          opacity: 0.8;
          transition: opacity 0.2s;
        "
        title="Close (ESC)"
      >×</button>
    </div>

    <!-- Refresh Button Section -->
    <div style="
      margin: 10px 10px 6px 25px;
      display: flex;
      justify-content: left;
    ">
      <button 
        id="admin-refresh-btn"
        style="
          background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
          padding: 2px 2px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: 600;
          color:rgba(81, 82, 83, 0.89);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          min-width: 100px;
          text-align: center;
        "
        onmouseenter="
          this.style.transform = 'translateY(-4px) scale(1.02)';
          this.style.boxShadow = '0 8px 25px #10b98120, 0 4px 12px rgba(0, 0, 0, 0.15)';
          this.style.borderColor = '#10b981';
          this.style.background = 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)';
          this.style.color = '#065f46';
        "
        onmouseleave="
          this.style.transform = 'translateY(0) scale(1)';
          this.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          this.style.borderColor = '#e5e7eb';
          this.style.background = 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)';
          this.style.color = 'rgba(81, 82, 83, 0.89)';
        "
        title="Request fresh data from all users"
      >
        Refresh
      </button>
    </div>
     <div style="
     border: 0.2px solid rgba(172, 175, 174, 0.21);
     margin: 0px 20px 10px 20px ;
     "></div>
    <!-- Statistics Grid -->
    <div id="tracker-stats-grid" style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 0 24px 16px 24px;
    ">
      ${this.createFilteredStatisticsBoxes(normalizedStats)}
    </div>

    <!-- Users Section -->
    <div style="
      margin: 0 24px 24px 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    ">
      <h3 style="
        margin: 0 0 16px 0;
        font-size: 16px;
        color: #374151;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <span>👥 All Users (<span id="userCount">${normalizedStats.activeUsers.length}</span>)</span>
      </h3>
      <div id="usersList">
        ${this.createUsersSection(normalizedStats.activeUsers)}
      </div>
    </div>
  `;
  
  this.setupUIEventListeners();
  console.log('📊 Statistics UI rendered with refresh button');
}


setupUIEventListeners() {
  if (!this.uiContainer) return;
  
  console.log('🔧 Setting up UI event listeners...');
  
  // Close button
  const closeBtn = this.uiContainer.querySelector('#close-tracker-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📊 Close button clicked');
      this.closeTrackerUI();
    });
    
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.opacity = '1';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.opacity = '0.8';
    });
  }
  
  // Refresh button
  const refreshBtn = this.uiContainer.querySelector('#admin-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📊 Admin refresh button clicked');
      this.adminRefresh();
    });
  }
  
  // Use event delegation for all buttons
  this.uiContainer.addEventListener('click', (e) => {
    // Handle tab buttons
    if (e.target.classList.contains('tab-btn')) {
      e.preventDefault();
      e.stopPropagation();
      
      const tab = e.target.getAttribute('data-tab');
      console.log('📊 Tab clicked:', tab);
      
      this.activeTab = tab;
      
      this.uiContainer.querySelectorAll('.tab-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === tab;
        btn.classList.toggle('active', isActive);
        btn.style.background = isActive ? '#f43e06' : 'transparent';
        btn.style.color = isActive ? 'white' : '#6b7280';
      });
      
      this.loadUIData().catch(console.error);
      return;
    }
  });
  
  setTimeout(() => {
    const buttons = this.uiContainer.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.style.pointerEvents = 'auto';
      btn.style.cursor = 'pointer';
      btn.style.zIndex = '1';
    });
    console.log(`🔧 Event listeners setup complete for ${buttons.length} buttons`);
  }, 50);
}




  renderUsersTab(teamStats) {
    return `
      <div>
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        ">
          <span style="
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
          ">Active Team Members</span>
          <span style="
            background: #dcfce7;
            color: #16a34a;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          ">${teamStats.activeUsers?.filter(u => u.status === 'online').length || 0} online</span>
        </div>
        
        <div>
          ${teamStats.activeUsers ? teamStats.activeUsers.map(user => `
            <div class="user-item">
              <div class="user-avatar">
                ${user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div class="user-info">
                <div class="user-name">${user.name || 'Unknown User'}</div>
                <div class="user-status">Last active: ${user.lastActive || 'Unknown'}</div>
              </div>
              <div class="status-indicator status-${user.status || 'offline'}"></div>
            </div>
          `).join('') : `
            <div style="text-align: center; color: #94a3b8; padding: 24px;">
              No active users found
            </div>
          `}
        </div>
      </div>
    `;
  }



  async toggleUI() {
    console.log('📊 Toggle UI called, current state:', { 
      isUIOpen: this.isUIOpen, 
      isOpening: this.isOpening, 
      isClosing: this.isClosing,
      isAnimating: this.isAnimating 
    });
    
    // Check if user is admin
    const isAdmin = await this.isUserAdmin();
    if (!isAdmin) {
      this.showToast('Access denied. Admin users only.', 'error');
      console.log('📊 Non-admin user tried to access tracker UI');
      return;
    }
    
    if (this.isAnimating || this.isOpening || this.isClosing) {
      console.log('📊 UI is busy, ignoring toggle request');
      return;
    }
    
    if (this.isUIOpen) {
      await this.closeTrackerUI();
    } else {
      await this.openTrackerUI();
    }
  }

async openTrackerUI() {
  console.log('📊 Opening tracker UI...');
  
  // Check if user is admin
  const isAdmin = await this.isUserAdmin();
  if (!isAdmin) {
    this.showToast('Access denied. Admin users only.', 'error');
    console.log('📊 Non-admin user tried to open tracker UI');
    return;
  }
  
  if (this.isUIOpen || this.isOpening || this.isAnimating) {
    console.log('📊 UI already open/opening or animating, skipping');
    return;
  }

  if (window.maloumInstances?.promptManager?.isPromptUIOpen) {
    console.log('📊 Prompt UI is open, cannot open Tracker UI');
    this.showToast('Please close Prompt Manager first', 'warning');
    return;
  }

  this.isOpening = true;
  this.isAnimating = true;

  console.log('📊 Starting UI opening process...');
  
  this.performFallbackCleanup();

  const trackerButton = document.getElementById('maloum-agency-tracker-btn');
  let startX = window.innerWidth - 100;
  let startY = 100;
  
  if (trackerButton) {
    const buttonRect = trackerButton.getBoundingClientRect();
    startX = buttonRect.left + buttonRect.width / 2;
    startY = buttonRect.top + buttonRect.height / 2;
    console.log(`🎯 Starting animation from button at (${startX}, ${startY})`);
  }

  const startOffsetX = startX - window.innerWidth / 2;
  const startOffsetY = startY - window.innerHeight / 2;

  if (!this.uiContainer) {
    this.createUIContainer();
  }

  this.showLoadingState();

  this.uiContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(244, 62, 6, 0.1);
    z-index: 10001;
    width: 800px;
    max-width: 95vw;
    max-height: 85vh;
    overflow-y: auto;
    overflow-x: hidden;
    font-family: system-ui, -apple-system, sans-serif;
    transform: translate(-50%, -50%);
    display: block;
    pointer-events: auto;
  `;

  setTimeout(() => {
    this.uiContainer.style.transform = 'translate(-50%, -50%) scale(1)';
    this.uiContainer.style.opacity = '1';
  }, 50);

  const dataLoadPromise = this.loadUIData().catch(error => {
    console.error('Error loading UI data:', error);
    this.showErrorUI(error.message);
  });

  await new Promise(resolve => setTimeout(resolve, 650));
  await dataLoadPromise;

  this.uiContainer.style.pointerEvents = 'auto';
  this.isUIOpen = true;
  this.isOpening = false;
  this.isAnimating = false;
  
  // REMOVED: No automatic refresh
  console.log('✅ Tracker UI opened successfully (no auto-refresh)');
}

  async closeTrackerUI() {
    console.log('📊 Closing tracker UI...');
    
    if (this.isClosing || !this.isUIOpen) {
      console.log('📊 Already closing or not open, ignoring close request');
      return;
    }
    
    this.isClosing = true;
    this.isAnimating = true;
    
    const fallbackTimeout = setTimeout(() => {
      console.log('⚠️ Animation timeout reached, forcing cleanup');
      this.performFallbackCleanup();
      this.resetStates();
    }, 1000);
    
    try {
      if (!this.uiContainer) {
        console.log('📊 No container found, performing immediate cleanup');
        this.performFallbackCleanup();
        this.resetStates();
        return;
      }

      console.log('🎬 Starting shrink animation...');
      
      const trackerButton = document.getElementById('maloum-agency-tracker-btn');
      let targetX = window.innerWidth - 100;
      let targetY = 100;
      
      if (trackerButton) {
        const buttonRect = trackerButton.getBoundingClientRect();
        targetX = buttonRect.left + buttonRect.width / 2;
        targetY = buttonRect.top + buttonRect.height / 2;
        console.log(`🎯 Shrinking toward button at (${targetX}, ${targetY})`);
      }

      const finalX = targetX - window.innerWidth / 2;
      const finalY = targetY - window.innerHeight / 2;

      this.uiContainer.style.pointerEvents = 'none';
      
      this.uiContainer.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease-out';
      this.uiContainer.style.transformOrigin = 'center center';
      this.uiContainer.style.transform = `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px)) scale(0.1)`;
      this.uiContainer.style.opacity = '0';
      this.stopRealtimeRefresh();
      await new Promise(resolve => setTimeout(resolve, 600));

      clearTimeout(fallbackTimeout);

      this.uiContainer.style.display = 'none';
      this.resetStates();

      console.log('✅ Tracker UI closed successfully');

    } catch (error) {
      console.error('❌ Error closing tracker UI:', error);
      clearTimeout(fallbackTimeout);
      this.performFallbackCleanup();
      this.resetStates();
    }
  }

  performFallbackCleanup() {
    console.log('🧹 Performing tracker UI fallback cleanup...');
    
    if (this.uiContainer) {
      this.uiContainer.style.display = 'none';
      this.uiContainer.style.pointerEvents = 'auto';
      this.uiContainer.style.opacity = '0';
      console.log('✅ Hidden tracker container in fallback cleanup');
    }
    
    console.log('✅ Tracker UI cleanup complete');
  }

  showErrorUI(message) {
    if (!this.uiContainer) return;
    
    this.uiContainer.innerHTML = `
      <div style="
        padding: 40px;
        text-align: center;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="
          font-size: 48px;
          margin-bottom: 16px;
        ">⚠️</div>
        <h3 style="
          margin: 0 0 8px 0;
          color: #dc2626;
          font-size: 18px;
          font-weight: 600;
        ">Error Loading Data</h3>
        <p style="
          margin: 0 0 20px 0;
          color: #6b7280;
          font-size: 14px;
        ">${message}</p>
        <button onclick="window.agencyTracker?.loadUIData()" style="
          background: #f43e06;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          margin-right: 8px;
        ">Retry</button>
        <button onclick="window.agencyTracker?.closeTrackerUI()" style="
          background: #6b7280;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Close</button>
      </div>
    `;
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      info: { bg: '#3b82f6', text: 'white' },
      success: { bg: '#10b981', text: 'white' },
      warning: { bg: '#f59e0b', text: 'white' },
      error: { bg: '#ef4444', text: 'white' }
    };
    
    const color = colors[type] || colors.info;
    
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${color.bg};
      color: ${color.text};
      padding: 12px 20px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10002;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  forceCloseUI() {
    console.log('🔒 Force closing tracker UI...');
    this.performFallbackCleanup();
    this.resetStates();
  }

setupEventListeners() {
  window.agencyTracker = this;
  window.closeAgencyTracker = () => {
    console.log('📊 Global close function called');
    this.forceCloseUI();
  };
  
  if (this.keyboardHandler) {
    document.removeEventListener('keydown', this.keyboardHandler, true);
  }
  
  this.keyboardHandler = async (e) => {
    // Handle Ctrl+I - Check admin access
    if (e.ctrlKey && e.key.toLowerCase() === 'i' && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      console.log('📊 Ctrl+I pressed, checking admin access');
      
      // Check if user is admin
      const isAdmin = await this.isUserAdmin();
      if (!isAdmin) {
        this.showToast('Access denied. Admin users only.', 'error');
        console.log('📊 Non-admin user tried Ctrl+I shortcut');
        return false;
      }
      
      setTimeout(() => {
        try {
          if (this.isUIOpen) {
            console.log('📊 Closing tracker UI...');
            this.closeTrackerUI();
          } else {
            console.log('📊 Opening tracker UI...');
            this.toggleUI();
          }
        } catch (error) {
          console.error('❌ Error handling Ctrl+I shortcut:', error);
        }
      }, 10);
      
      return false;
    }
    
    // Handle Alt+I - Check admin access  
    if (e.altKey && e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      console.log('📊 Alt+I pressed, checking admin access');
      
      // Check if user is admin
      const isAdmin = await this.isUserAdmin();
      if (!isAdmin) {
        this.showToast('Access denied. Admin users only.', 'error');
        console.log('📊 Non-admin user tried Alt+I shortcut');
        return false;
      }
      
      setTimeout(() => {
        try {
          if (this.isUIOpen) {
            console.log('📊 Closing tracker UI...');
            this.closeTrackerUI();
          } else {
            console.log('📊 Opening tracker UI...');
            this.toggleUI();
          }
        } catch (error) {
          console.error('❌ Error handling Alt+I shortcut:', error);
        }
      }, 10);
      
      return false;
    }
    
      if (e.key === 'Escape' && this.isUIOpen) {
        const container = this.uiContainer;
        if (container && container.style.opacity !== '0' && container.style.display !== 'none') {
          console.log('📊 ESC pressed, closing UI');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          setTimeout(() => {
            this.closeTrackerUI();
            // Remove focus from the tracker button to prevent black outline
            const trackerButton = document.getElementById('maloum-agency-tracker-btn');
            if (trackerButton) {
              trackerButton.blur();
            }
          }, 10);
          
          return false;
        }
      }
  };
  
  document.addEventListener('keydown', this.keyboardHandler, { capture: true, passive: false });
  
  // NEW: Setup Chrome message listener for refresh requests
  this.setupChromeMessageListener();
  
  console.log('📊 Event listeners setup complete');
}
  //------------------- New Methods--------------------------------------------











setupChromeMessageListener() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📊 Received Chrome message:', message);
      
      if (message.action === 'ADMIN_REFRESH_REQUEST') {
        // DEDUPLICATION: Check if we already processed this request
        if (this.lastRefreshRequestId === message.timestamp) {
          console.log('📊 Duplicate refresh request ignored');
          sendResponse({ success: true, duplicate: true });
          return true;
        }
        
        this.lastRefreshRequestId = message.timestamp;
        console.log('📊 Processing new admin refresh request');
        
        this.handleAdminRefreshRequest(message);
        sendResponse({ success: true });
      }
      
      return true;
    });
    console.log('📊 Chrome message listener setup complete');
  }
}

// NEW METHOD: Handle admin refresh request
async handleAdminRefreshRequest(message) {
  try {
    console.log('📊 Processing admin refresh request from:', message.adminUser);
    
    // Send current data to database
    await this.sendCurrentDataToDatabase();
    
    console.log('📊 Data sent in response to admin refresh request');
  } catch (error) {
    console.error('❌ Error handling admin refresh request:', error);
  }
}

async getCurrentUsername() {
  try {
    const authCacheData = localStorage.getItem('maloum_ultra_auth_v2') || sessionStorage.getItem('maloum_ultra_auth_v2');
    if (authCacheData) {
      const authCache = JSON.parse(authCacheData);
      if (authCache.username) return authCache.username;
    }
    
    const stored = await chrome.storage.sync.get(['username']);
    if (stored.username) return stored.username;
    
    const result = await chrome.storage.sync.get(['chatterId']);
    return result.chatterId || 'unknown_user';
  } catch (error) {
    console.error('❌ Error getting username:', error);
    return 'unknown_user';
  }
}

// NEW METHOD: Send current data to database
async sendCurrentDataToDatabase() {
  try {
    // Get current cache data
    if (window.maloumCacheManager) {
      await window.maloumCacheManager.forceSendCurrentData();
    }
    
    // 🔥 FIX: DON'T update user activity for admin refresh operations
    // if (window.maloumCacheManager && window.maloumCacheManager.firebaseTracker) {
    //   await window.maloumCacheManager.firebaseTracker.updateUserActivityOnUsage();
    // }
    
    console.log('🔥 Current data sent to Firebase database (no activity update)');
  } catch (error) {
    console.error('❌ Error sending current data to Firebase:', error);
  }
}


async adminRefresh() {
  console.log('🔥 Firebase admin refresh initiated');
  
  // Show loading state on refresh button
  const refreshBtn = this.uiContainer.querySelector('#admin-refresh-btn');
  if (refreshBtn) {
    refreshBtn.innerHTML = 'Refreshing...';
    refreshBtn.disabled = true;
    refreshBtn.style.cursor = 'wait';
    refreshBtn.style.opacity = '0.7';
  }
  
  try {
    // Step 1: Broadcast message to all users to send their data
    console.log('🔥 Broadcasting refresh request to all users');
    chrome.runtime.sendMessage({
      action: 'ADMIN_REFRESH_REQUEST',
      timestamp: Date.now(),
      adminUser: await this.getCurrentUsername()
    });
    
    // Step 2: Admin also sends own data to Firebase
    console.log('🔥 Admin sending own data to Firebase');
    await this.sendCurrentDataToDatabase();
    
    // Step 3: Wait for other users to sync (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Fetch fresh data from Firebase and update UI
    console.log('🔥 Fetching fresh data from Firebase after user sync');
    await this.loadUIData();
    
    console.log('✅ Firebase admin refresh completed');
    
  } catch (error) {
    console.error('❌ Firebase admin refresh failed:', error);
    // Only show toast on error
    this.showToast('Refresh failed: ' + error.message, 'error');
  } finally {
    // Restore refresh button
    if (refreshBtn) {
      refreshBtn.innerHTML = 'Refresh Data';
      refreshBtn.disabled = false;
      refreshBtn.style.cursor = 'pointer';
      refreshBtn.style.opacity = '1';
    }
  }
}

formatRelativeTime(timestamp) {
  const now = Date.now();
  const timeDiff = now - new Date(timestamp).getTime();
  
  const seconds = Math.floor(timeDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 60) {
    return seconds <= 1 ? 'just now' : `${seconds} sec ago`;
  } else if (minutes < 60) {
    return `${minutes} min ago`;
  } else if (hours < 24) {
    return `${hours} hr ago`;
  } else if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (weeks < 4) {
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  } else if (months < 12) {
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  } else {
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  }
}



async isUserAdmin() {
  try {
    // Get username from auth cache first
    const authCacheData = localStorage.getItem('maloum_ultra_auth_v2') ||
                         sessionStorage.getItem('maloum_ultra_auth_v2');
    let username = null;
   
    if (authCacheData) {
      const authCache = JSON.parse(authCacheData);
      username = authCache.username;
    }
   
    // Fallback to Chrome storage
    if (!username) {
      const stored = await chrome.storage.sync.get(['username']);
      username = stored.username;
    }
   
    // Final fallback to chatterId
    if (!username) {
      const result = await chrome.storage.sync.get(['chatterId']);
      username = result.chatterId;
    }
   
    console.log('🔥 Checking admin status for username:', username);
   
    // Check if username contains any admin identifier OR has _admin suffix
    const isAdmin = username && (
      ADMIN_USERS.some(adminId => username.includes(adminId)) || 
      username.includes('_admin')
    );
    console.log('🔥 Is admin:', isAdmin);
   
    return isAdmin;
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    return false;
  }
}

// Get active users from Supabase
async getFirebaseActiveUsers() {
  try {
    const firebaseConfig = {
      databaseURL: "https://linguana-24d87-default-rtdb.asia-southeast1.firebasedatabase.app"
    };
    
    // Separate thresholds: 3 days for display, 2 minutes for online status
    const displayThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const onlineThreshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago for online status
    
    const response = await fetch(
      `${firebaseConfig.databaseURL}/user_activity.json`
    );

    if (!response.ok) return [];

    const userData = await response.json();
    if (!userData) return [];
    
    const activeUsers = [];
    
    // Process Firebase user data - show users active within 3 days
    Object.entries(userData).forEach(([userId, user]) => {
      if (user.agency_id === 'default_agency' && 
          new Date(user.last_activity) > displayThreshold) {
        
        const lastActivityTime = new Date(user.last_activity).getTime();
        const isOnline = user.is_online && 
                        (Date.now() - lastActivityTime) < 2 * 60 * 1000;
        
        // 🔥 FIX: Better time display with relative time for recent activity
        let displayTime;
        if (isOnline) {
          displayTime = 'Online';
        } else {
          const activityDate = new Date(user.last_activity);
          const timeDiff = Date.now() - activityDate.getTime();
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          
          if (hours < 24) {
            displayTime = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
          } else {
            displayTime = this.formatRelativeTime(user.last_activity);
          }
        }
        
        activeUsers.push({
          username: user.username,
          lastActivity: displayTime,
          lastActivityTimestamp: lastActivityTime, // Keep timestamp for sorting
          isOnline: isOnline
        });
      }
    });

    // Sort users by last activity time (most recent first)
    activeUsers.sort((a, b) => {
      return b.lastActivityTimestamp - a.lastActivityTimestamp; // Most recent first
    });

    console.log(`🔥 Found ${activeUsers.length} users active within 3 days`);
    return activeUsers;

  } catch (error) {
    console.warn('⚠️ Error getting active users from Firebase:', error);
    return [];
  }
}

getRecordLimitForFilter(filter) {
  switch(filter) {
    case 'Today':
      return 500;
    case 'Last 7 Days':
      return 1500;
    case 'This Month':
    case 'Last 30 Days':
      return 3000;
    default:
      return 2000;
  }
}

// Get historical statistics from compressed data
async getFirebaseHistoricalStats(filter, fromDate, toDate) {
  try {
    console.log('🔥 Getting historical stats from Firebase (ULTRA-SAFE)');
    
    const firebaseConfig = {
      databaseURL: "https://linguana-24d87-default-rtdb.asia-southeast1.firebasedatabase.app"
    };
    
    // Get date range for the filter
    const { startDate, endDate } = this.getDateRangeForFilter(filter, fromDate, toDate);
    
    // Check cache first (10 minutes cache for historical data)
    const cacheKey = `historical_${filter}_${startDate.getTime()}_${endDate.getTime()}`;
    const cachedStats = this.getCachedData(cacheKey, 10 * 60 * 1000); // 10 minutes
    if (cachedStats) {
      console.log(`📦 Using cached historical stats for ${filter} (10min cache)`);
      return cachedStats;
    }

    // ULTRA-SAFE: Use basic Firebase URL (no query parameters)
    const response = await fetch(
      `${firebaseConfig.databaseURL}/usage_tracking_realtime.json`
    );

    if (!response.ok) throw new Error(`Failed to fetch historical data: ${response.status}`);
    
    const firebaseData = await response.json();
    console.log('🔥 Got historical data (ULTRA-SAFE basic query)');
    
    // Smart processing with date filtering
    const processedStats = this.processHistoricalStatsData(firebaseData, startDate, endDate, filter);
    
    // CRITICAL FIX: Always get active users and add them to stats
    console.log('🔥 Fetching active users for historical stats...');
    const activeUsers = await this.getFirebaseActiveUsersBasic();
    processedStats.activeUsers = activeUsers;
    
    // Cache the result for 10 minutes
    this.setCachedData(cacheKey, processedStats);
    
    console.log(`🔥 Historical stats completed with ${activeUsers.length} active users`);
    return processedStats;

  } catch (error) {
    console.error('❌ Error getting historical stats from Firebase:', error);
    // Return empty stats but still try to get active users
    const emptyStats = this.getEmptyStats();
    try {
      const activeUsers = await this.getFirebaseActiveUsersBasic();
      emptyStats.activeUsers = activeUsers;
      console.log(`⚠️ Error fallback: returning empty stats with ${activeUsers.length} active users`);
    } catch (userError) {
      console.warn('⚠️ Could not get active users for error fallback');
    }
    return emptyStats;
  }
}

// Simple caching system for admin dashboard
getCachedData(key, maxAge) {
  try {
    const cached = sessionStorage.getItem(`admin_cache_${key}`);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > maxAge) {
      sessionStorage.removeItem(`admin_cache_${key}`);
      return null;
    }
    
    return data.value;
  } catch (error) {
    return null;
  }
}

setCachedData(key, value) {
  try {
    const data = {
      value: value,
      timestamp: Date.now()
    };
    sessionStorage.setItem(`admin_cache_${key}`, JSON.stringify(data));
  } catch (error) {
    // Cache failed, not critical
  }
}

// Smart data processing for current stats
processCurrentStatsData(firebaseData) {
  const records = [];
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000; // 24 hours for current stats
  
  if (firebaseData) {
    // Smart filtering: Only process recent records
    Object.values(firebaseData).forEach(record => {
      if (record.agency_id === 'default_agency') {
        const recordTime = new Date(record.timestamp).getTime();
        
        if (recordTime > oneDayAgo) {
          records.push(record);
        }
      }
    });
  }

  console.log(`🔥 Processing ${records.length} recent records for current stats (ULTRA-SAFE)`);

  // Calculate statistics
  let apiRequests = 0;
  let cacheHits = 0;
  let totalCharacters = 0;
  let estimatedCost = 0;
  let translationApi = 0;
  let aiAssistApi = 0;

  records.forEach(record => {
    if (record.api_type === 'cache_hit') {
      cacheHits += record.cache_hits || 1;
      totalCharacters += record.total_chars || 0;
    } else {
      if (record.api_type === 'translation') {
        apiRequests++;
        translationApi++;
      } else if (record.api_type === 'ai_assist') {
        apiRequests++;
        aiAssistApi++;
      } else if (record.api_type === 'admin_sync_update' || record.api_type === 'admin_refresh_ping') {
        // Don't count admin operations
      } else {
        apiRequests++;
      }
      
      totalCharacters += record.total_chars || 0;
      estimatedCost += record.total_cost || 0;
    }
  });

  const totalRequests = apiRequests + cacheHits;
  const cacheEfficiency = totalRequests > 0 ? 
    ((cacheHits / totalRequests) * 100).toFixed(1) : 0;

  return {
    apiRequests: apiRequests,
    cacheHits: cacheHits,
    totalCharacters: totalCharacters,
    estimatedCost: Math.max(0, estimatedCost),
    translationApi: translationApi,
    aiAssistApi: aiAssistApi,
    activeUsers: [], // Will be populated separately
    usageData: records,
    languageStats: [],
    cacheEfficiency: parseFloat(cacheEfficiency),
    lastUpdated: new Date().toISOString()
  };
}

// Smart data processing for active users
// Smart data processing for active users - FIXED for page reload issue
processActiveUsersData(userData) {
  const activeUsers = [];
  const threeDaysAgoMs = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
  const onlineThreshold = 2 * 60 * 1000; // 2 minutes for online status
  
  console.log('🔥 Processing user data for active users...');
  console.log(`🔍 Total users in database: ${Object.keys(userData).length}`);
  console.log(`🔍 Looking for users active since: ${new Date(threeDaysAgoMs).toISOString()}`);
  
  // Process all users and filter by activity
  Object.entries(userData).forEach(([userId, user]) => {
    console.log(`🔍 Checking user: ${user.username} - Agency: ${user.agency_id} - Last activity: ${user.last_activity}`);
    
    if (user.agency_id === 'default_agency') {
      const lastActivity = new Date(user.last_activity).getTime();
      
      // Include users from last 3 days
      if (lastActivity > threeDaysAgoMs) {
        // FIXED: Only check recent activity for online status, ignore is_online flag
        // This fixes the page reload issue where is_online gets reset
        const isOnline = (Date.now() - lastActivity) < onlineThreshold;
        
        let displayTime;
        if (isOnline) {
          displayTime = 'Online';
        } else {
          displayTime = this.formatRelativeTime(user.last_activity);
        }
        
        activeUsers.push({
          username: user.username,
          lastActivity: displayTime,
          lastActivityTimestamp: lastActivity,
          isOnline: isOnline
        });
        
        console.log(`✅ Added user: ${user.username} - ${displayTime} - Online: ${isOnline}`);
      } else {
        console.log(`❌ Skipped user: ${user.username} - Too old (${new Date(lastActivity).toISOString()})`);
      }
    } else {
      console.log(`❌ Skipped user: ${user.username} - Wrong agency (${user.agency_id})`);
    }
  });

  // Sort by most recent activity
  activeUsers.sort((a, b) => b.lastActivityTimestamp - a.lastActivityTimestamp);

  console.log(`🔥 Final result: Found ${activeUsers.length} users active within 3 days`);
  return activeUsers;
}
// Smart data processing for historical stats
processHistoricalStatsData(firebaseData, startDate, endDate, filter) {
  const records = [];
  
  if (firebaseData) {
    // Smart filtering: Only process records within date range
    Object.values(firebaseData).forEach(record => {
      if (record.agency_id === 'default_agency') {
        const recordDate = new Date(record.timestamp);
        
        if (recordDate >= startDate && recordDate <= endDate) {
          records.push(record);
        }
      }
    });
  }

  console.log(`🔥 Retrieved ${records.length} records for ${filter} (ULTRA-SAFE)`);

  // Calculate statistics
  let apiRequests = 0;
  let cacheHits = 0;
  let totalCharacters = 0;
  let estimatedCost = 0;
  let translationApi = 0;
  let aiAssistApi = 0;

  records.forEach(record => {
    if (record.api_type === 'cache_hit') {
      cacheHits += record.cache_hits || 1;
      totalCharacters += record.total_chars || 0;
    } else {
      if (record.api_type === 'translation') {
        apiRequests++;
        translationApi++;
      } else if (record.api_type === 'ai_assist') {
        apiRequests++;
        aiAssistApi++;
      } else if (record.api_type === 'admin_sync_update' || record.api_type === 'admin_refresh_ping') {
        // Don't count admin operations
      } else {
        apiRequests++;
      }
      
      totalCharacters += record.total_chars || 0;
      estimatedCost += record.total_cost || 0;
    }
  });

  const totalRequests = apiRequests + cacheHits;
  const cacheEfficiency = totalRequests > 0 ? 
    ((cacheHits / totalRequests) * 100).toFixed(1) : 0;

  return {
    apiRequests: apiRequests,
    cacheHits: cacheHits,
    totalCharacters: totalCharacters,
    estimatedCost: Math.max(0, estimatedCost),
    translationApi: translationApi,
    aiAssistApi: aiAssistApi,
    activeUsers: [], // Will be populated separately
    usageData: records,
    languageStats: [],
    cacheEfficiency: parseFloat(cacheEfficiency)
  };
}

// Helper method for date ranges
getDateRangeForFilter(filter, fromDate, toDate) {
  const now = new Date();
  let startDate, endDate;

  if (fromDate && toDate) {
    startDate = new Date(fromDate);
    endDate = new Date(toDate);
  } else {
    switch (filter) {
      case 'Today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date();
        break;
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date();
        break;
      case 'This Month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = new Date();
        break;
    }
  }

  return { startDate, endDate };
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

hideUI() {
  this.closeTrackerUI();
}

setupCleanDebug() {
  window.testCleanRefresh = this.testCleanRefresh.bind(this);
  window.cleanManualRefresh = () => {
    this.getFilteredTeamStats(this.currentFilter).then(data => {
      console.log('Manual refresh data:', data);
      this.updateUIContent(data);
    });
  };
  
  console.log('🧪 Clean debug methods:');
  console.log('🧪 - testCleanRefresh() - Test with random data');
  console.log('🧪 - cleanManualRefresh() - Force refresh now');
}

testCleanRefresh() {
  console.log('🧪 Testing clean refresh...');
  
  const testData = {
    apiRequests: Math.floor(Math.random() * 100),
    cacheHits: Math.floor(Math.random() * 50),
    totalCharacters: Math.floor(Math.random() * 10000),
    estimatedCost: Math.random() * 10,
    translationApi: Math.floor(Math.random() * 60),
    aiAssistApi: Math.floor(Math.random() * 40),
    activeUsers: [{username: 'test_user', isOnline: true}]
  };
  
  console.log('🧪 Test data:', testData);
  console.log('🧪 Container position before:', this.uiContainer?.style.position);
  
  this.updateUIContent(testData);
  
  setTimeout(() => {
    console.log('🧪 Container position after:', this.uiContainer?.style.position);
    console.log('🧪 Container top:', this.uiContainer?.style.top);
    console.log('🧪 Container left:', this.uiContainer?.style.left);
  }, 500);
}

setupPerfectRefreshDebug() {
  window.testRefreshApproaches = this.testRefreshApproaches.bind(this);
  window.startMinimalRefresh = this.startMinimalDataRefresh.bind(this);
  window.safeUpdate = this.updateUIContentSafely.bind(this);
  
  console.log('🧪 Perfect refresh debug methods:');
  console.log('🧪 - testRefreshApproaches() - Test safe updates');
  console.log('🧪 - startMinimalRefresh() - Use minimal approach');
  console.log('🧪 - safeUpdate(data) - Test safe update method');
}

testRefreshApproaches() {
  console.log('🧪 Testing different refresh approaches...');
  
  // Test data
  const testData = {
    apiRequests: Math.floor(Math.random() * 100),
    cacheHits: Math.floor(Math.random() * 50),
    totalCharacters: Math.floor(Math.random() * 10000),
    estimatedCost: Math.random() * 10,
    translationApi: Math.floor(Math.random() * 60),
    aiAssistApi: Math.floor(Math.random() * 40),
    activeUsers: []
  };
  
  console.log('🧪 Test data:', testData);
  console.log('🧪 Current container position:', this.uiContainer?.style.position);
  
  // Test safe update
  this.updateUIContentSafely(testData);
  
  setTimeout(() => {
    console.log('🧪 After update - container position:', this.uiContainer?.style.position);
    console.log('🧪 Container top:', this.uiContainer?.style.top);
    console.log('🧪 Container left:', this.uiContainer?.style.left);
  }, 1000);
}


updateSpecificElementsOnly(freshData) {
  try {
    console.log('📊 Updating specific elements only...');
    
    // Find and update the statistics grid specifically
    const statsGrid = document.getElementById('tracker-stats-grid');
    if (statsGrid) {
      // Store current position info
      const rect = statsGrid.getBoundingClientRect();
      
      // Update the grid content
      const normalizedStats = {
        apiRequests: freshData?.apiRequests || 0,
        cacheHits: freshData?.cacheHits || 0,
        totalCharacters: freshData?.totalCharacters || 0,
        estimatedCost: freshData?.estimatedCost || 0,
        translationApi: freshData?.translationApi || 0,
        aiAssistApi: freshData?.aiAssistApi || 0,
        activeUsers: freshData?.activeUsers || []
      };
      
      statsGrid.innerHTML = this.createFilteredStatisticsBoxes(normalizedStats);
      
      console.log('📊 ✅ Stats grid updated specifically');
    }
    
    // Update users count
    const userCount = document.getElementById('userCount');
    if (userCount) {
      userCount.textContent = (freshData?.activeUsers || []).length;
    }
    
    // Update users list
    const usersList = document.getElementById('usersList');
    if (usersList) {
      usersList.innerHTML = this.createUsersSection(freshData?.activeUsers || []);
    }
    
    console.log('📊 ✅ Specific elements updated');
    
  } catch (error) {
    console.error('📊 Error updating specific elements:', error);
  }
}

updateUIContentSafely(teamStats) {
  if (!this.isUIOpen || !this.uiContainer) {
    console.log('📊 Skipping update - UI not ready');
    return;
  }
  
  console.log('📊 Starting safe UI content update...');
  
  // Save the complete container styles to restore later
  const containerElement = this.uiContainer;
  const savedStyles = containerElement.style.cssText;
  const savedClassNames = containerElement.className;
  const savedId = containerElement.id;
  
  console.log('📊 Saved container styles');
  
  // Normalize stats properly
  const normalizedStats = {
    apiRequests: teamStats?.apiRequests || 0,
    cacheHits: teamStats?.cacheHits || 0,
    totalCharacters: teamStats?.totalCharacters || 0,
    estimatedCost: teamStats?.estimatedCost || 0,
    translationApi: teamStats?.translationApi || 0,
    aiAssistApi: teamStats?.aiAssistApi || 0,
    activeUsers: teamStats?.activeUsers || []
  };
  
  console.log('📊 Normalized stats:', normalizedStats);
  
  // Update ONLY the statistics grid content
  const statsContainer = this.uiContainer.querySelector('#tracker-stats-grid');
  if (statsContainer) {
    console.log('📊 Updating statistics grid...');
    statsContainer.innerHTML = this.createFilteredStatisticsBoxes(normalizedStats);
    console.log('📊 ✅ Statistics grid updated');
  }
  
  // Update ONLY the users section
  const usersList = document.getElementById('usersList');
  const userCount = document.getElementById('userCount');
  if (usersList) {
    console.log('📊 Updating users section...');
    usersList.innerHTML = this.createUsersSection(normalizedStats.activeUsers);
    if (userCount) {
      userCount.textContent = normalizedStats.activeUsers.length;
    }
    console.log('📊 ✅ Users section updated');
  }
  
  // Update timestamp in header
  const headerDiv = this.uiContainer.querySelector('h2')?.parentElement;
  if (headerDiv) {
    let timestampDiv = headerDiv.querySelector('div[style*="font-size: 12px"]');
    if (timestampDiv) {
      timestampDiv.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } else {
      timestampDiv = document.createElement('div');
      timestampDiv.style.cssText = 'font-size: 12px; opacity: 0.8;';
      timestampDiv.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
      headerDiv.appendChild(timestampDiv);
    }
    console.log('📊 ✅ Timestamp updated');
  }
  
  // CRITICAL: Restore container positioning if it changed
  if (containerElement.style.cssText !== savedStyles) {
    console.log('📊 ⚠️ Container styles changed, restoring...');
    containerElement.style.cssText = savedStyles;
    containerElement.className = savedClassNames;
    containerElement.id = savedId;
    
    // Force the correct positioning
    containerElement.style.position = 'fixed';
    containerElement.style.top = '50%';
    containerElement.style.left = '50%';
    containerElement.style.transform = 'translate(-50%, -50%)';
    containerElement.style.zIndex = '10001';
    
    console.log('📊 ✅ Container positioning restored');
  }
  
  console.log('📊 ✅ Safe UI content update completed');
}

setupUltraSimpleDebug() {
  window.disableRefresh = this.disableAllRefresh.bind(this);
  window.minimalRefresh = this.startMinimalRefresh.bind(this);
  window.testTextUpdate = this.updateTextContentOnly.bind(this);
  
  console.log('📊 Ultra-simple debug methods:');
  console.log('📊 - disableRefresh() - Turn off all refresh');
  console.log('📊 - minimalRefresh() - Only timestamp updates');
  console.log('📊 - testTextUpdate(data) - Test text updates');
}


disableAllRefresh() {
  this.stopRealtimeRefresh();
  console.log('📊 All refresh disabled for testing');
}

startMinimalRefresh() {
  this.stopRealtimeRefresh();
  
  console.log(`📊 Starting minimal refresh (timestamp only)`);
  
  this.realtimeInterval = setInterval(() => {
    if (this.isUIOpen && !this.isAnimating) {
      try {
        // Only update timestamp - no data fetching, no DOM changes
        this.updateTimestampSafely();
        console.log(`📊 Minimal refresh: ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        console.error('📊 Minimal refresh error:', error);
      }
    }
  }, 30000);
}

updateTimestampSafely() {
  try {
    // Find timestamp element by looking for time-like text
    const timePattern = /\d{1,2}:\d{2}:\d{2}\s*(AM|PM)/i;
    const allElements = this.uiContainer.querySelectorAll('*');
    
    for (const element of allElements) {
      if (element.children.length === 0 && timePattern.test(element.textContent)) {
        element.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        break;
      }
    }
  } catch (error) {
    console.error('📊 Error updating timestamp:', error);
  }
}

updateSpecificNumbers(freshData) {
  try {
    // Find elements that look like numbers (contain only digits and commas)
    const potentialNumberElements = Array.from(this.uiContainer.querySelectorAll('*'))
      .filter(el => {
        const text = el.textContent.trim();
        const hasOnlyNumbers = /^[\d,]+$/.test(text) && text.length > 0;
        const isLeafNode = el.children.length === 0;
        return hasOnlyNumbers && isLeafNode;
      });
    
    // Sort by position in DOM to match them to data in order
    potentialNumberElements.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      
      // Sort by top position first, then left
      if (Math.abs(rectA.top - rectB.top) > 50) {
        return rectA.top - rectB.top;
      }
      return rectA.left - rectB.left;
    });
    
    // Update first few number elements with our data
    const dataValues = [
      freshData.apiRequests || 0,
      freshData.cacheHits || 0, 
      freshData.totalCharacters || 0,
      Math.abs(freshData.estimatedCost || 0).toFixed(6),
      freshData.translationApi || 0,
      freshData.aiAssistApi || 0
    ];
    
    potentialNumberElements.slice(0, 6).forEach((element, index) => {
      if (dataValues[index] !== undefined) {
        const newValue = index === 3 ? `$${dataValues[index]}` : dataValues[index].toLocaleString();
        element.textContent = newValue;
        console.log(`📊 Updated element ${index + 1}: ${newValue}`);
      }
    });
    
  } catch (error) {
    console.error('📊 Error updating specific numbers:', error);
  }
}

updateTextContentOnly(freshData) {
  if (!this.uiContainer) return;
  
  try {
    console.log('📊 Updating text content only...');
    
    // Method 1: Find elements by their text content and update numbers
    const allTextElements = this.uiContainer.querySelectorAll('*');
    
    allTextElements.forEach(element => {
      const text = element.textContent;
      
      // Update API Requests number
      if (text && text.includes('API Requests') && element.children.length === 0) {
        // This is likely a number element near "API Requests"
        const currentNum = parseInt(text.replace(/[^0-9]/g, ''));
        if (!isNaN(currentNum)) {
          element.textContent = (freshData.apiRequests || 0).toLocaleString();
        }
      }
      
      // Update Cache Hits number  
      if (text && text.includes('Cache Hits') && element.children.length === 0) {
        const currentNum = parseInt(text.replace(/[^0-9]/g, ''));
        if (!isNaN(currentNum)) {
          element.textContent = (freshData.cacheHits || 0).toLocaleString();
        }
      }
      
      // Update Total Characters number
      if (text && text.includes('Total Characters') && element.children.length === 0) {
        const currentNum = parseInt(text.replace(/[^0-9]/g, ''));
        if (!isNaN(currentNum)) {
          element.textContent = (freshData.totalCharacters || 0).toLocaleString();
        }
      }
    });
    
    // Method 2: Use more specific selectors to find number elements
    this.updateSpecificNumbers(freshData);
    
    // Method 3: Update timestamp in header only
    this.updateTimestampSafely();
    
    console.log('📊 ✅ Text content updated without DOM changes');
    
  } catch (error) {
    console.error('📊 ❌ Error updating text content:', error);
  }
}


switchToSimpleRefresh() {
  console.log('🔄 Switching to simple number refresh mode...');
  this.stopRealtimeRefresh();
  this.startSimpleRefresh();
}

// Make these available globally for testing
setupSimpleRefreshDebug() {
  window.switchToSimpleRefresh = this.switchToSimpleRefresh.bind(this);
  window.updateNumbersOnly = this.updateNumbersInPlace.bind(this);
  
  console.log('🔄 Simple refresh methods available:');
  console.log('🔄 - switchToSimpleRefresh() - Use number-only updates');
  console.log('🔄 - updateNumbersOnly(data) - Test number updates');
}  

updateNumbersInPlace(freshData) {
  try {
    // Find all number elements and update them
    const statsBoxes = this.uiContainer.querySelectorAll('#tracker-stats-grid > div');
    
    if (statsBoxes.length >= 6) {
      // Update API Requests (first box)
      const apiBox = statsBoxes[0];
      const apiValueElement = apiBox.querySelector('div[style*="font-size: 24px"], div[style*="font-size: 28px"]');
      if (apiValueElement) {
        apiValueElement.textContent = (freshData.apiRequests || 0).toLocaleString();
      }
      
      // Update Cache Hits (second box)
      const cacheBox = statsBoxes[1];
      const cacheValueElement = cacheBox.querySelector('div[style*="font-size: 24px"], div[style*="font-size: 28px"]');
      if (cacheValueElement) {
        cacheValueElement.textContent = (freshData.cacheHits || 0).toLocaleString();
      }
      
      // Update Total Characters (third box)
      const charsBox = statsBoxes[2];
      const charsValueElement = charsBox.querySelector('div[style*="font-size: 24px"], div[style*="font-size: 28px"]');
      if (charsValueElement) {
        charsValueElement.textContent = (freshData.totalCharacters || 0).toLocaleString();
      }
      
      // Update Estimated Cost (fourth box)
      const costBox = statsBoxes[3];
      const costValueElement = costBox.querySelector('div[style*="font-size: 24px"], div[style*="font-size: 28px"]');
      if (costValueElement) {
        const cost = freshData.estimatedCost || 0;
        costValueElement.textContent = `$${Math.abs(cost).toFixed(6)}`;
      }
      
      // Update Translation API (fifth box)
      const transBox = statsBoxes[4];
      const transValueElement = transBox.querySelector('div[style*="font-size: 24px"], div[style*="font-size: 28px"]');
      if (transValueElement) {
        transValueElement.textContent = (freshData.translationApi || 0).toLocaleString();
      }
      
      // Update AI Assist API (sixth box)
      const aiBox = statsBoxes[5];
      const aiValueElement = aiBox.querySelector('div[style*="font-size: 24px"], div[style*="font-size: 28px"]');
      if (aiValueElement) {
        aiValueElement.textContent = (freshData.aiAssistApi || 0).toLocaleString();
      }
    }
    
    // Update user count
    const userCountElement = document.getElementById('userCount');
    if (userCountElement) {
      userCountElement.textContent = (freshData.activeUsers || []).length;
    }
    
    // Update timestamp in header
    this.updateHeaderTimestamp();
    
    console.log('📊 ✅ Numbers updated in place');
    
  } catch (error) {
    console.error('📊 ❌ Error updating numbers in place:', error);
  }
}

startSimpleRefresh() {
  this.stopRealtimeRefresh();
  
  console.log(`📊 Starting simple number refresh every 30 seconds`);
  
  this.realtimeInterval = setInterval(async () => {
    if (this.isUIOpen && !this.isAnimating) {
      try {
        console.log(`📊 Simple refresh triggered at ${new Date().toLocaleTimeString()}`);
        
        // Just get fresh data and update numbers
        const freshData = await this.getFilteredTeamStats(this.currentFilter);
        
        // Update numbers in existing elements without recreating anything
        this.updateNumbersInPlace(freshData);
        
        console.log('📊 ✅ Simple refresh completed');
        
      } catch (error) {
        console.error('📊 ❌ Simple refresh failed:', error);
      }
    }
  }, 30000);
}

updateHeaderTimestamp() {
  const header = this.uiContainer.querySelector('h2');
  if (header && header.parentElement) {
    let timestampDiv = header.parentElement.querySelector('div[style*="font-size: 12px"]');
    
    if (timestampDiv) {
      timestampDiv.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } else {
      // Create timestamp if it doesn't exist
      timestampDiv = document.createElement('div');
      timestampDiv.style.cssText = 'font-size: 12px; opacity: 0.8;';
      timestampDiv.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
      header.parentElement.appendChild(timestampDiv);
    }
    
    console.log('📊 ✅ Header timestamp updated');
  }
}

updateUsersListOnly(freshData) {
  const usersList = document.getElementById('usersList');
  const userCount = document.getElementById('userCount');
  
  if (usersList) {
    const activeUsers = freshData.activeUsers || [];
    usersList.innerHTML = this.createUsersSection(activeUsers);
    
    if (userCount) {
      userCount.textContent = activeUsers.length;
    }
    
    console.log('📊 ✅ Users section updated silently');
  }
}

updateStatisticsBoxesOnly(freshData) {
  const statsContainer = this.uiContainer.querySelector('#tracker-stats-grid');
  if (!statsContainer) {
    console.log('📊 Stats container not found');
    return;
  }
  
  const normalizedStats = {
    apiRequests: freshData.apiRequests || 0,
    cacheHits: freshData.cacheHits || 0,
    totalCharacters: freshData.totalCharacters || 0,
    estimatedCost: freshData.estimatedCost || 0,
    translationApi: freshData.translationApi || 0,
    aiAssistApi: freshData.aiAssistApi || 0,
    activeUsers: freshData.activeUsers || []
  };
  
  // Update only the innerHTML of the stats container
  statsContainer.innerHTML = this.createFilteredStatisticsBoxes(normalizedStats);
  
  console.log('📊 ✅ Statistics boxes updated silently');
}  

showRefreshFeedback() {
  const feedback = document.createElement('div');
  feedback.style.cssText = `
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(16, 185, 129, 0.9);
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    z-index: 10002;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  `;
  feedback.innerHTML = '✅ Updated';
  
  if (this.uiContainer) {
    this.uiContainer.appendChild(feedback);
    
    // Fade out after 2 seconds
    setTimeout(() => {
      feedback.style.transition = 'opacity 0.3s ease';
      feedback.style.opacity = '0';
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }
}

// NEW METHOD: Manual silent reload for testing
async manualSilentReload() {
  console.log('🔄 Manual silent reload triggered...');
  await this.silentReloadUI();
}

// NEW METHOD: Toggle between different refresh modes
setRefreshMode(mode) {
  this.refreshMode = mode;
  console.log(`🔄 Refresh mode set to: ${mode}`);
  
  // Restart refresh with new mode
  if (this.isUIOpen) {
    this.stopRealtimeRefresh();
    this.startRealtimeRefresh();
  }
}

// Add these methods to global scope for easy testing
setupSilentReloadDebug() {
  window.manualSilentReload = this.manualSilentReload.bind(this);
  window.setRefreshMode = this.setRefreshMode.bind(this);
  
  console.log('🔄 Silent reload debug methods available:');
  console.log('🔄 - manualSilentReload() - Trigger reload now');
  console.log('🔄 - setRefreshMode("silent") - Use silent reload');
}
  
hideSilentLoadingIndicator() {
  const indicator = document.getElementById('silent-loading-indicator');
  if (indicator) {
    indicator.style.animation = 'none';
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 200);
  }
}

showSilentLoadingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'silent-loading-indicator';
  indicator.style.cssText = `
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(244, 62, 6, 0.9);
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    z-index: 10002;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    animation: pulse 2s infinite;
  `;
  indicator.innerHTML = '🔄 Refreshing...';
  
  // Add CSS animation
  if (!document.getElementById('silent-loading-styles')) {
    const style = document.createElement('style');
    style.id = 'silent-loading-styles';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  if (this.uiContainer) {
    this.uiContainer.style.position = 'relative';
    this.uiContainer.appendChild(indicator);
  }
}

async recreateUIContent(freshData) {
  if (!this.uiContainer) return;
  
  console.log('🔄 Recreating UI content with fresh data...');
  
  // CRITICAL: Save and restore UI container positioning styles
  const savedStyles = {
    position: this.uiContainer.style.position,
    top: this.uiContainer.style.top,
    left: this.uiContainer.style.left,
    transform: this.uiContainer.style.transform,
    zIndex: this.uiContainer.style.zIndex,
    width: this.uiContainer.style.width,
    maxWidth: this.uiContainer.style.maxWidth,
    maxHeight: this.uiContainer.style.maxHeight,
    background: this.uiContainer.style.background,
    borderRadius: this.uiContainer.style.borderRadius,
    boxShadow: this.uiContainer.style.boxShadow,
    fontFamily: this.uiContainer.style.fontFamily,
    overflow: this.uiContainer.style.overflow,
    overflowX: this.uiContainer.style.overflowX,
    overflowY: this.uiContainer.style.overflowY
  };
  
  // Normalize the data
  const normalizedStats = {
    apiRequests: freshData.apiRequests || 0,
    cacheHits: freshData.cacheHits || 0,
    totalCharacters: freshData.totalCharacters || 0,
    estimatedCost: freshData.estimatedCost || 0,
    translationApi: freshData.translationApi || 0,
    aiAssistApi: freshData.aiAssistApi || 0,
    activeUsers: freshData.activeUsers || []
  };
  
  // Store fresh data in cache
  this.lastTeamStatsCache = normalizedStats;
  this.lastCacheTime = Date.now();
  
  // ONLY update the inner HTML content, not the container styles
  this.uiContainer.innerHTML = `
    <!-- Header -->
    <div style="
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 100%);
      color: white;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 16px 16px 0 0;
    ">
      <div>
        <h2 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 700;">📈 Character Usage Analytics</h2>
        <div style="font-size: 12px; opacity: 0.8;">Last updated: ${new Date().toLocaleTimeString()}</div>
      </div>
      <button 
        id="close-tracker-btn"
        style="
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: white;
          padding: 4px;
          line-height: 1;
          opacity: 0.8;
          transition: opacity 0.2s;
        "
        title="Close (ESC)"
      >×</button>
    </div>

    <!-- Statistics Grid -->
    <div id="tracker-stats-grid" style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 24px;
      margin-bottom: 16px;
    ">
      ${this.createFilteredStatisticsBoxes(normalizedStats)}
    </div>

    <!-- Users Section -->
    <div style="
      margin: 0 24px 24px 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    ">
      <h3 style="
        margin: 0 0 16px 0;
        font-size: 16px;
        color: #374151;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <span>👥 Active Users (<span id="userCount">${normalizedStats.activeUsers.length}</span>)</span>
      </h3>
      <div id="usersList">
        ${this.createUsersSection(normalizedStats.activeUsers)}
      </div>
    </div>
  `;
  
  // CRITICAL: Restore all the positioning styles after updating innerHTML
  Object.keys(savedStyles).forEach(styleProperty => {
    if (savedStyles[styleProperty]) {
      this.uiContainer.style[styleProperty] = savedStyles[styleProperty];
    }
  });
  
  // ENSURE the container maintains its fixed positioning
  this.uiContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(244, 62, 6, 0.1);
    z-index: 10001;
    width: 800px;
    max-width: 95vw;
    max-height: 85vh;
    overflow-y: auto;
    overflow-x: hidden;
    font-family: system-ui, -apple-system, sans-serif;
    transform: translate(-50%, -50%);
    display: block;
    pointer-events: auto;
    opacity: 1;
  `;
  
  // Re-add the innerHTML after ensuring positioning
  if (!this.uiContainer.innerHTML) {
    this.uiContainer.innerHTML = `
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 100%);
        color: white;
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 16px 16px 0 0;
      ">
        <div>
          <h2 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 700;">📈 Character Usage Analytics</h2>
          <div style="font-size: 12px; opacity: 0.8;">Last updated: ${new Date().toLocaleTimeString()}</div>
        </div>
        <button 
          id="close-tracker-btn"
          style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: white;
            padding: 4px;
            line-height: 1;
            opacity: 0.8;
            transition: opacity 0.2s;
          "
          title="Close (ESC)"
        >×</button>
      </div>

      <!-- Statistics Grid -->
      <div id="tracker-stats-grid" style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 24px;
        margin-bottom: 16px;
      ">
        ${this.createFilteredStatisticsBoxes(normalizedStats)}
      </div>

      <!-- Users Section -->
      <div style="
        margin: 0 24px 24px 24px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-radius: 16px;
        padding: 24px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      ">
        <h3 style="
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #374151;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
        ">
          <span>👥 Active Users (<span id="userCount">${normalizedStats.activeUsers.length}</span>)</span>
        </h3>
        <div id="usersList">
          ${this.createUsersSection(normalizedStats.activeUsers)}
        </div>
      </div>
    `;
  }
  
  // Reattach event listeners
  this.setupUIEventListeners();
  
  console.log('🔄 ✅ UI content recreated with preserved positioning');
}


runDataDiagnosis() {
  console.log('🏥 === RUNNING FULL DATA DIAGNOSIS ===');
  
  // Step 1: Test server caching
  console.log('🏥 Step 1: Testing server response caching...');
  this.testServerCaching().then(() => {
    
    // Step 2: Start monitoring
    console.log('🏥 Step 2: Starting data monitoring...');
    this.startDataMonitoring();
    
    // Step 3: Simulate activity after 5 seconds
    setTimeout(() => {
      console.log('🏥 Step 3: Simulating activity...');
      this.simulateActivity();
    }, 5000);
    
    console.log('🏥 Diagnosis running... check console for results');
  });
}

setupDataDebugMethods() {
  window.startDataMonitoring = this.startDataMonitoring.bind(this);
  window.forceCacheSync = this.forceCacheManagerSync.bind(this);
  window.simulateActivity = this.simulateActivity.bind(this);
  window.testServerCaching = this.testServerCaching.bind(this);
  
  console.log('🔍 Data debug methods available:');
  console.log('🔍 - startDataMonitoring() - Monitor server data changes');
  console.log('🔍 - forceCacheSync() - Force cache manager sync');
  console.log('🔍 - simulateActivity() - Create test activity');
  console.log('🔍 - testServerCaching() - Check if server responses cached');
}  

async testServerCaching() {
  console.log('🌐 Testing if server responses are being cached...');
  
  const results = [];
  
  for (let i = 0; i < 3; i++) {
    const timestamp = Date.now() + Math.random(); // Unique timestamp
    const url = `${this.config.sheetsUrl}?action=getTeamStats&agencyId=${this.config.agencyId}&filter=${this.currentFilter}&cacheBuster=${timestamp}`;
    
    console.log(`🌐 Request ${i + 1}/3 with cache buster...`);
    
    const startTime = performance.now();
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    const endTime = performance.now();
    
    const data = await response.json();
    results.push({
      request: i + 1,
      responseTime: Math.round(endTime - startTime),
      data: data,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // Wait 1 second between requests
    if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('🌐 Server response test results:');
  results.forEach(result => {
    console.log(`   ${result.request}. [${result.timestamp}] ${result.responseTime}ms - API: ${result.data.apiRequests}, Cache: ${result.data.cacheHits}`);
  });
  
  // Check if all responses are identical
  const allSame = results.every(r => 
    r.data.apiRequests === results[0].data.apiRequests &&
    r.data.cacheHits === results[0].data.cacheHits &&
    r.data.totalCharacters === results[0].data.totalCharacters
  );
  
  if (allSame) {
    console.log('🌐 ❌ All responses identical - server data not changing or being cached');
  } else {
    console.log('🌐 ✅ Responses differ - server data is changing');
  }
}

async simulateActivity() {
  console.log('🎭 Simulating activity to test tracking...');
  
  try {
    // Simulate cache hit
    if (window.maloumCacheManager) {
      console.log('🎭 Simulating cache hit...');
      window.maloumCacheManager.incrementCacheHits(true);
      
      // Wait and check for updates
      setTimeout(async () => {
        await this.forceCacheManagerSync();
      }, 1000);
    }
    
    // Simulate tracker activity
    if (window.AGENCY_TRACKER_INSTANCE) {
      console.log('🎭 Simulating tracker activity...');
      
      // Send test data
      const testData = {
        timestamp: new Date().toISOString(),
        chatterId: this.chatterId,
        inputChars: 50,
        promptChars: 20,
        outputChars: 80,
        othersChars: 10,
        totalChars: 160,
        totalCost: 0.000234,
        apiType: 'translation',
        agencyId: this.config.agencyId
      };
      
      await this.sendToTrackingService(testData);
      console.log('🎭 Test data sent to server');
      
      // Force refresh after a delay
      setTimeout(async () => {
        console.log('🎭 Fetching data after test activity...');
        const freshData = await this.getFilteredTeamStats(this.currentFilter);
        this.updateUIContent(freshData);
      }, 3000);
    }
    
  } catch (error) {
    console.error('🎭 Error simulating activity:', error);
  }
}


async forceCacheManagerSync() {
  try {
    console.log('🔄 Forcing cache manager to sync fresh data...');
    
    if (window.maloumCacheManager) {
      // Trigger cache manager to send its latest stats
      await window.maloumCacheManager.syncToGoogleSheets();
      console.log('🔄 ✅ Cache manager sync completed');
      
      // Wait a bit for server to process
      setTimeout(async () => {
        console.log('🔄 Fetching updated data after sync...');
        const freshData = await this.getFilteredTeamStats(this.currentFilter);
        this.updateUIContent(freshData);
        console.log('🔄 ✅ UI updated with post-sync data');
      }, 2000);
      
    } else {
      console.log('🔄 ❌ Cache manager not available');
    }
  } catch (error) {
    console.error('🔄 Error forcing sync:', error);
  }
}

compareData(oldData, newData) {
  const changes = [];
  const keys = ['apiRequests', 'cacheHits', 'totalCharacters', 'estimatedCost', 'translationApi', 'aiAssistApi'];
  
  keys.forEach(key => {
    if (oldData[key] !== newData[key]) {
      changes.push({
        field: key,
        old: oldData[key],
        new: newData[key],
        change: newData[key] - oldData[key]
      });
    }
  });
  
  // Check user changes
  const oldUsers = oldData.activeUsers || [];
  const newUsers = newData.activeUsers || [];
  
  if (oldUsers.length !== newUsers.length) {
    changes.push({
      field: 'activeUsers',
      old: `${oldUsers.length} users`,
      new: `${newUsers.length} users`,
      change: newUsers.length - oldUsers.length
    });
  }
  
  return changes;
}

startDataMonitoring() {
  console.log('🔍 Starting comprehensive data monitoring...');
  
  let previousData = null;
  let dataHistory = [];
  
  const monitorData = async () => {
    try {
      // Get fresh data without any caching
      const timestamp = Date.now();
      const url = `${this.config.sheetsUrl}?action=getTeamStats&agencyId=${this.config.agencyId}&filter=${this.currentFilter}&timestamp=${timestamp}`;
      
      console.log('🔍 Fetching fresh data...');
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      const currentData = await response.json();
      const now = new Date().toLocaleTimeString();
      
      console.log(`🔍 [${now}] Fresh server data:`, currentData);
      
      // Store in history
      dataHistory.push({
        time: now,
        data: { ...currentData }
      });
      
      // Keep only last 5 entries
      if (dataHistory.length > 5) {
        dataHistory.shift();
      }
      
      // Compare with previous data
      if (previousData) {
        const changes = this.compareData(previousData, currentData);
        if (changes.length > 0) {
          console.log('🔍 ✅ DATA CHANGES DETECTED:', changes);
        } else {
          console.log('🔍 ❌ No changes - server returning same data');
        }
      }
      
      previousData = { ...currentData };
      
      // Show data history
      console.log('🔍 Data history (last 5 fetches):');
      dataHistory.forEach((entry, i) => {
        console.log(`   ${i + 1}. [${entry.time}] API: ${entry.data.apiRequests}, Cache: ${entry.data.cacheHits}, Chars: ${entry.data.totalCharacters}`);
      });
      
    } catch (error) {
      console.error('🔍 Error monitoring data:', error);
    }
  };
  
  // Check every 15 seconds
  this.dataMonitorInterval = setInterval(monitorData, 15000);
  monitorData(); // Initial check
  
  console.log('🔍 Data monitoring started - check every 15 seconds');
}

// ADD this method to test visual updates manually
testVisualUpdate() {
  console.log('🎨 Testing visual update with random data...');
  
  const testStats = {
    apiRequests: Math.floor(Math.random() * 100) + 1,
    cacheHits: Math.floor(Math.random() * 50) + 1, 
    totalCharacters: Math.floor(Math.random() * 10000) + 1000,
    estimatedCost: (Math.random() * 10).toFixed(6),
    translationApi: Math.floor(Math.random() * 60) + 1,
    aiAssistApi: Math.floor(Math.random() * 40) + 1,
    activeUsers: []
  };
  
  console.log('🎨 Test stats:', testStats);
  this.updateUIContent(testStats);
  
  // Flash the entire UI to make the change obvious
  if (this.uiContainer) {
    this.uiContainer.style.transition = 'transform 0.3s ease';
    this.uiContainer.style.transform = 'translate(-50%, -50%) scale(1.02)';
    
    setTimeout(() => {
      this.uiContainer.style.transform = 'translate(-50%, -50%) scale(1)';
      setTimeout(() => {
        this.uiContainer.style.transition = '';
      }, 300);
    }, 150);
  }
}

// ADD this enhanced method to check if data is actually changing
logDataChanges() {
  console.log('📈 Starting data change monitoring...');
  
  let lastData = null;
  
  const checkData = async () => {
    try {
      const currentData = await this.getFilteredTeamStats(this.currentFilter);
      
      if (lastData) {
        const changes = {};
        Object.keys(currentData).forEach(key => {
          if (currentData[key] !== lastData[key]) {
            changes[key] = {
              old: lastData[key],
              new: currentData[key]
            };
          }
        });
        
        if (Object.keys(changes).length > 0) {
          console.log('📈 DATA CHANGED:', changes);
        } else {
          console.log('📈 No data changes detected');
        }
      }
      
      lastData = { ...currentData };
      
    } catch (error) {
      console.error('📈 Error checking data changes:', error);
    }
  };
  
  // Check every 10 seconds
  setInterval(checkData, 10000);
  checkData(); // Initial check
}

// ADD this method to setup global test functions
setupVisualDebugMethods() {
  window.testVisualUpdate = this.testVisualUpdate.bind(this);
  window.logDataChanges = this.logDataChanges.bind(this);
  
  console.log('🎨 Visual debug methods available:');
  console.log('🎨 - testVisualUpdate() - Test with random data');
  console.log('🎨 - logDataChanges() - Monitor data changes');
}

setupGlobalDebugMethods() {
  if (window.AGENCY_TRACKER_INSTANCE) {
    window.debugTracker = window.AGENCY_TRACKER_INSTANCE.debugRealTimeRefresh.bind(window.AGENCY_TRACKER_INSTANCE);
    window.manualRefresh = window.AGENCY_TRACKER_INSTANCE.manualRefresh.bind(window.AGENCY_TRACKER_INSTANCE);
    window.testStatsUpdate = window.AGENCY_TRACKER_INSTANCE.testStatisticsBoxUpdate.bind(window.AGENCY_TRACKER_INSTANCE);
    window.fullDiagnostic = window.AGENCY_TRACKER_INSTANCE.runFullDiagnostic.bind(window.AGENCY_TRACKER_INSTANCE);
    
    console.log('🔧 Debug methods available:');
    console.log('🔧 - debugTracker() - Check refresh status');
    console.log('🔧 - manualRefresh() - Force refresh now');
    console.log('🔧 - testStatsUpdate() - Test box updates');
    console.log('🔧 - fullDiagnostic() - Run all tests');
  }
}

runFullDiagnostic() {
  console.log('🔧 === FULL TRACKER DIAGNOSTIC ===');
  
  // Test 1: Check basic state
  this.debugRealTimeRefresh();
  
  // Test 2: Force manual refresh
  setTimeout(() => {
    console.log('🔧 Running manual refresh test...');
    this.manualRefresh();
  }, 2000);
  
  // Test 3: Test statistics box update with random data
  setTimeout(() => {
    console.log('🔧 Running statistics box update test...');
    this.testStatisticsBoxUpdate();
  }, 4000);
  
  console.log('🔧 Diagnostic complete - check console logs above');
}

testStatisticsBoxUpdate() {
  const statsContainer = this.uiContainer?.querySelector('#tracker-stats-grid');
  if (!statsContainer) {
    console.log('❌ No stats container found');
    return;
  }
  
  console.log('🧪 Testing statistics box update...');
  
  // Get current HTML
  const originalHTML = statsContainer.innerHTML;
  console.log('🧪 Original HTML length:', originalHTML.length);
  
  // Create test data with different values
  const testData = {
    apiRequests: Math.floor(Math.random() * 100),
    cacheHits: Math.floor(Math.random() * 50),
    totalCharacters: Math.floor(Math.random() * 10000),
    estimatedCost: Math.random() * 10,
    translationApi: Math.floor(Math.random() * 60),
    aiAssistApi: Math.floor(Math.random() * 40),
    activeUsers: []
  };
  
  console.log('🧪 Test data:', testData);
  
  // Update with test data
  const newHTML = this.createFilteredStatisticsBoxes(testData);
  statsContainer.innerHTML = newHTML;
  
  console.log('🧪 New HTML length:', newHTML.length);
  console.log('🧪 HTML changed:', originalHTML !== newHTML);
  console.log('🧪 ✅ Test update completed - you should see different numbers in the boxes');
}

 debugRealTimeRefresh() {
  console.log('🔍 === REAL-TIME REFRESH DEBUG ===');
  console.log('🔍 isUIOpen:', this.isUIOpen);
  console.log('🔍 isAnimating:', this.isAnimating);
  console.log('🔍 currentFilter:', this.currentFilter);
  console.log('🔍 realtimeInterval ID:', this.realtimeInterval);
  console.log('🔍 UI Container exists:', !!this.uiContainer);
  
  if (this.uiContainer) {
    console.log('🔍 Stats container exists:', !!this.uiContainer.querySelector('#tracker-stats-grid'));
  }
  
  // Force a refresh right now
  console.log('🔍 Forcing manual refresh...');
  this.manualRefresh();
}

// ADD this method to manually trigger refresh
async manualRefresh() {
  try {
    console.log('🔍 Manual refresh starting...');
    const filteredData = await this.getFilteredTeamStats(this.currentFilter);
    console.log('🔍 Manual refresh got data:', filteredData);
    this.updateUIContent(filteredData);
    console.log('🔍 Manual refresh completed');
  } catch (error) {
    console.error('🔍 Manual refresh failed:', error);
  }
} 

// Add this method to your FullFeaturedAgencyTracker class
async applyDateFilter(filter, container) {
  console.log(`📊 Applying date filter: ${filter}`);
  
  // IMPORTANT: Update current filter so refresh respects it
  this.currentFilter = filter;
  
  // Update button states
  const filterButtons = container.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    const buttonText = btn.textContent.trim();
    
    if (buttonText === filter) {
      btn.style.border = '1px solid #f43e06';
      btn.style.background = 'linear-gradient(135deg, #f43e06, #ff6b35)';
      btn.style.color = 'white';
      btn.style.boxShadow = '0 2px 4px rgba(244, 62, 6, 0.3)';
    } else {
      btn.style.border = '1px solid #d1d5db';
      btn.style.background = 'white';
      btn.style.color = '#374151';
      btn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    }
  });

  // Get filtered data and update content (no loading state)
  try {
    const filteredData = await this.getFilteredTeamStats(filter);
    
    // Update statistics boxes
    const statsContainer = document.querySelector('#tracker-stats-grid');
    if (statsContainer) {
      statsContainer.innerHTML = this.createFilteredStatisticsBoxes(filteredData);
    }
    
    // Update the table
    const reportContent = container.querySelector('#usage-report-table');
    if (reportContent) {
      await this.loadUsageReport(reportContent, filter);
    }
    
    console.log(`📊 Filter applied: ${filter} (no loading state)`);
  } catch (error) {
    console.error('❌ Error applying filter:', error);
  }
}



// Add this method to your FullFeaturedAgencyTracker class
createFilteredStatisticsBoxes(teamStats) {
    if (!teamStats) {
    teamStats = {
      apiRequests: 0,
      cacheHits: 0,
      totalCharacters: 0,
      estimatedCost: 0,
      translationApi: 0,
      aiAssistApi: 0
    };
  }
  const totalRequests = teamStats.cacheHits + teamStats.apiRequests;
  const cacheEfficiency = totalRequests > 0 ? Math.round((teamStats.cacheHits / totalRequests) * 100) : 0;
  
  return `
    <!-- API Requests -->
    <div class="stats-card" style="
      background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      text-align: center;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    "
    onmouseenter="
      this.style.transform = 'translateY(-4px) scale(1.02)';
      this.style.boxShadow = '0 8px 25px #3b82f620, 0 4px 12px rgba(0, 0, 0, 0.15)';
      this.style.borderColor = '#3b82f6';
      this.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
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
    "
    >
      <div class="accent-line" style="
        position: absolute;
        top: 0;
        left: 0;
        height: 3px;
        width: 0%;
        background: #3b82f6;
        transition: width 0.3s ease;
      "></div>
      <div style="
        font-size: 28px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      ">${teamStats.apiRequests.toLocaleString()}</div>
      <div style="
        font-size: 14px;
        color: #6b7280;
        font-weight: 500;
        margin-bottom: 4px;
      ">API Requests</div>
      <div class="card-tooltip" style="
        font-size: 12px;
        color: #9ca3af;
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.2s ease;
        margin-top: 8px;
        line-height: 1.4;
      ">Total requests made to translation/AI services</div>
    </div>

    <!-- Cache Hits -->
    <div class="stats-card" style="
      background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      text-align: center;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    "
    onmouseenter="
      this.style.transform = 'translateY(-4px) scale(1.02)';
      this.style.boxShadow = '0 8px 25px #10b98120, 0 4px 12px rgba(0, 0, 0, 0.15)';
      this.style.borderColor = '#10b981';
      this.style.background = 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)';
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
    "
    >
      ${cacheEfficiency > 0 ? `
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
      ` : ''}
      <div class="accent-line" style="
        position: absolute;
        top: 0;
        left: 0;
        height: 3px;
        width: 0%;
        background: #10b981;
        transition: width 0.3s ease;
      "></div>
      <div style="
        font-size: 28px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      ">${teamStats.cacheHits.toLocaleString()}</div>
      <div style="
        font-size: 14px;
        color: #6b7280;
        font-weight: 500;
        margin-bottom: 4px;
      ">Cache Hits</div>
      <div class="card-tooltip" style="
        font-size: 12px;
        color: #9ca3af;
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.2s ease;
        margin-top: 8px;
        line-height: 1.4;
      ">Number of times translations were found in cache</div>
    </div>

    <!-- Total Characters -->
    <div class="stats-card" style="
      background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      text-align: center;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    "
    onmouseenter="
      this.style.transform = 'translateY(-4px) scale(1.02)';
      this.style.boxShadow = '0 8px 25px #8b5cf620, 0 4px 12px rgba(0, 0, 0, 0.15)';
      this.style.borderColor = '#8b5cf6';
      this.style.background = 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)';
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
    "
    >
      <div class="accent-line" style="
        position: absolute;
        top: 0;
        left: 0;
        height: 3px;
        width: 0%;
        background: #8b5cf6;
        transition: width 0.3s ease;
      "></div>
      <div style="
        font-size: 28px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      ">${teamStats.totalCharacters.toLocaleString()}</div>
      <div style="
        font-size: 14px;
        color: #6b7280;
        font-weight: 500;
        margin-bottom: 4px;
      ">Total Characters</div>
      <div class="card-tooltip" style="
        font-size: 12px;
        color: #9ca3af;
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.2s ease;
        margin-top: 8px;
        line-height: 1.4;
      ">Characters processed across all API calls</div>
    </div>

    <!-- Estimated Cost -->
    <div class="stats-card" style="
      background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      text-align: center;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    "
    onmouseenter="
      this.style.transform = 'translateY(-4px) scale(1.02)';
      this.style.boxShadow = '0 8px 25px #f59e0b20, 0 4px 12px rgba(0, 0, 0, 0.15)';
      this.style.borderColor = '#f59e0b';
      this.style.background = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
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
    "
    >
      <div class="accent-line" style="
        position: absolute;
        top: 0;
        left: 0;
        height: 3px;
        width: 0%;
        background: #f59e0b;
        transition: width 0.3s ease;
      "></div>
      <div style="
        font-size: 28px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      ">$${teamStats.estimatedCost.toFixed(6)}</div>
      <div style="
        font-size: 14px;
        color: #6b7280;
        font-weight: 500;
        margin-bottom: 4px;
      ">Estimated Cost</div>
      <div class="card-tooltip" style="
        font-size: 12px;
        color: #9ca3af;
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.2s ease;
        margin-top: 8px;
        line-height: 1.4;
      ">Estimated cost based on token usage</div>
    </div>

    <!-- Translation API -->
    <div class="stats-card" style="
      background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      text-align: center;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    "
    onmouseenter="
      this.style.transform = 'translateY(-4px) scale(1.02)';
      this.style.boxShadow = '0 8px 25px #06b6d420, 0 4px 12px rgba(0, 0, 0, 0.15)';
      this.style.borderColor = '#06b6d4';
      this.style.background = 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)';
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
    "
    >
      <div class="accent-line" style="
        position: absolute;
        top: 0;
        left: 0;
        height: 3px;
        width: 0%;
        background: #06b6d4;
        transition: width 0.3s ease;
      "></div>
      <div style="
        font-size: 28px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      ">${teamStats.translationApi.toLocaleString()}</div>
      <div style="
        font-size: 14px;
        color: #6b7280;
        font-weight: 500;
        margin-bottom: 4px;
      ">Translation API</div>
      <div class="card-tooltip" style="
        font-size: 12px;
        color: #9ca3af;
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.2s ease;
        margin-top: 8px;
        line-height: 1.4;
      ">Number of translation API calls made</div>
    </div>

    <!-- AI Assist API -->
    <div class="stats-card" style="
      background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      text-align: center;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    "
    onmouseenter="
      this.style.transform = 'translateY(-4px) scale(1.02)';
      this.style.boxShadow = '0 8px 25px #ef444420, 0 4px 12px rgba(0, 0, 0, 0.15)';
      this.style.borderColor = '#ef4444';
      this.style.background = 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)';
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
    "
    >
      <div class="accent-line" style="
        position: absolute;
        top: 0;
        left: 0;
        height: 3px;
        width: 0%;
        background: #ef4444;
        transition: width 0.3s ease;
      "></div>
      <div style="
        font-size: 28px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      ">${teamStats.aiAssistApi.toLocaleString()}</div>
      <div style="
        font-size: 14px;
        color: #6b7280;
        font-weight: 500;
        margin-bottom: 4px;
      ">AI Assist API</div>
      <div class="card-tooltip" style="
        font-size: 12px;
        color: #9ca3af;
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.2s ease;
        margin-top: 8px;
        line-height: 1.4;
      ">Number of AI assistance API calls made</div>
    </div>
  `;
  
}

// Add this method to your FullFeaturedAgencyTracker class
async loadUsageReport(container, filter, fromDate = null, toDate = null) {
  try {
    // Get filtered usage data from server
    const teamStats = await this.getFilteredTeamStats(filter, fromDate, toDate);
    
    console.log('🔍 Team stats in loadUsageReport:', teamStats); // DEBUG
    
    // FIXED: Check if teamStats exists and has usageData
    if (!teamStats || !teamStats.usageData) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #6b7280;">
          <div style="font-size: 14px;">No usage data found for the selected period</div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Filter: ${filter}</div>
        </div>
      `;
      return;
    }
    
    const usageData = teamStats.usageData;
    
    if (!usageData || usageData.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #6b7280;">
          <div style="font-size: 14px;">No usage data found for the selected period</div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Filter: ${filter} | Records: 0</div>
        </div>
      `;
      return;
    }

    console.log('🔍 Usage data to display:', usageData); // DEBUG

    // Transform the data from your server format to expected format
    const transformedData = usageData.map(item => ({
      dateTime: item.date || 'N/A',
      apiName: item.apiType || 'N/A', 
      originalText: item.userName || 'N/A',  // Using userName as text since original isn't available
      inputChars: Math.floor(item.characters * 0.4) || 0,  // Estimate input chars
      promptChars: Math.floor(item.characters * 0.1) || 0, // Estimate prompt chars  
      outputChars: Math.floor(item.characters * 0.5) || 0, // Estimate output chars
      othersChars: 0,
      totalChars: item.characters || 0,
      totalCost: item.cost || 0,
      apiType: item.apiType || 'Unknown'
    }));

    // Calculate totals
    const totals = transformedData.reduce((acc, item) => {
      acc.inputChars += item.inputChars || 0;
      acc.promptChars += item.promptChars || 0;
      acc.outputChars += item.outputChars || 0;
      acc.othersChars += item.othersChars || 0;
      acc.totalChars += item.totalChars || 0;
      acc.totalCost += item.totalCost || 0;
      return acc;
    }, { inputChars: 0, promptChars: 0, outputChars: 0, othersChars: 0, totalChars: 0, totalCost: 0 });

    // Create summary section
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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; font-size: 12px;">
          <div><strong>Input:</strong> ${totals.inputChars.toLocaleString()}</div>
          <div><strong>Prompt:</strong> ${totals.promptChars.toLocaleString()}</div>
          <div><strong>Output:</strong> ${totals.outputChars.toLocaleString()}</div>
          <div><strong>Others:</strong> ${totals.othersChars.toLocaleString()}</div>
          <div><strong>Total:</strong> ${totals.totalChars.toLocaleString()}</div>
          <div><strong>Cost:</strong> $${totals.totalCost.toFixed(6)}</div>
        </div>
      </div>
    `;

    // Create table HTML
    const tableHtml = `
      <div style="overflow-x: auto; border-radius: 6px; border: 1px solid #e5e7eb; max-height: 400px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: white;">
          <thead style="background: #f9fafb; position: sticky; top: 0; z-index: 1;">
            <tr>
              <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600;">Date & API</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; max-width: 200px;">User/Text</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">Input</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">Prompt</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">Output</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">Others</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">Total</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            ${transformedData.map((item, index) => {
              return `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 6px; border: 1px solid #e5e7eb;">
                    <div style="font-weight: 600; color: #1f2937;">${item.dateTime}</div>
                    <div style="font-size: 10px; color: #6b7280;">${item.apiName}</div>
                  </td>
                  <td style="padding: 6px; border: 1px solid #e5e7eb; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.originalText}">${item.originalText}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${item.inputChars}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${item.promptChars}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${item.outputChars}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${item.othersChars}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">${item.totalChars}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600; color: #16a34a; background: #f0fdf4;">${item.totalCost.toFixed(6)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Set the content directly
    container.innerHTML = summaryHtml + tableHtml;

  } catch (error) {
    console.error('❌ Error loading usage report:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #dc2626;">
        <div style="font-size: 14px;">Error loading usage report: ${error.message}</div>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Check console for details</div>
      </div>
    `;
  }
}

// Add this method to your FullFeaturedAgencyTracker class
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
    
    // Get custom filtered data and update statistics boxes
    try {
      const customData = await this.getFilteredTeamStats('Custom', fromDate, toDate);
      
      // Update statistics boxes with custom filtered data
      const statsContainer = document.querySelector('#tracker-stats-grid');
      if (statsContainer) {
        statsContainer.innerHTML = this.createFilteredStatisticsBoxes(customData);
        console.log(`📊 Updated statistics boxes for custom date: ${fromDate} to ${toDate}`);
      }
    } catch (error) {
      console.error('❌ Error updating statistics boxes for custom date:', error);
    }
    
    // Update the table
    const reportContent = container.querySelector('#usage-report-table');
    if (reportContent) {
      await this.loadUsageReport(reportContent, 'Custom', fromDate, toDate);
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
      todayButton.click();
    }
    
    this.showToast('Custom date filter cleared', 'info');
  });
}

// Helper method for showing toast notifications
showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#3b82f6'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10002;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
  `;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 50);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Add this method to your FullFeaturedAgencyTracker class
setupFilterEventListeners() {
  const filterButtons = this.uiContainer.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const filter = e.target.getAttribute('data-filter');
      
      console.log(`📊 Filter button clicked: ${filter}`);
      
      // Use the applyDateFilter method (which updates both table and boxes)
      await this.applyDateFilter(filter, this.uiContainer);
      
      // Clear custom date inputs when using quick filters
      const fromDateInput = this.uiContainer.querySelector('#usage-from-date');
      const toDateInput = this.uiContainer.querySelector('#usage-to-date');
      if (fromDateInput && toDateInput) {
        fromDateInput.value = '';
        toDateInput.value = '';
      }
    });
  });
  
  // Ensure all buttons are properly configured
  setTimeout(() => {
    const buttons = this.uiContainer.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.style.pointerEvents = 'auto';
      btn.style.cursor = 'pointer';
      btn.style.zIndex = '1';
    });
    console.log(`🔧 Filter event listeners setup complete for ${filterButtons.length} filter buttons`);
  }, 50);
}


startRealtimeRefresh() {
  this.stopRealtimeRefresh();
  
  console.log(`📊 Starting fast refresh every 10 seconds`);
  
  this.realtimeInterval = setInterval(async () => {
    if (this.isUIOpen && !this.isAnimating) {
      try {
        const freshData = await this.getFilteredTeamStats(this.currentFilter);
        this.updateUIContent(freshData);
      } catch (error) {
        console.error('📊 Fast refresh failed:', error);
      }
    }
  }, 10000); // 10 seconds instead of 30
}

stopRealtimeRefresh() {
  if (this.realtimeInterval) {
    console.log('📊 Stopping real-time refresh');
    clearInterval(this.realtimeInterval);
    this.realtimeInterval = null;
  }
}

updateUIContent(teamStats) {
  if (!this.isUIOpen || !this.uiContainer) return;
  
  console.log('📊 Original updateUIContent called with:', teamStats);
  
  // Normalize the data
  const normalizedStats = {
    apiRequests: teamStats?.apiRequests || 0,
    cacheHits: teamStats?.cacheHits || 0,
    totalCharacters: teamStats?.totalCharacters || 0,
    estimatedCost: teamStats?.estimatedCost || 0,
    translationApi: teamStats?.translationApi || 0,
    aiAssistApi: teamStats?.aiAssistApi || 0,
    activeUsers: teamStats?.activeUsers || []
  };
 
  // Update the statistics boxes
  const statsContainer = this.uiContainer.querySelector('#tracker-stats-grid');
  if (statsContainer) {
    statsContainer.innerHTML = this.createFilteredStatisticsBoxes(normalizedStats);
    console.log('📊 ✅ Statistics boxes updated');
  }
 
  // Update users section
  const usersList = document.getElementById('usersList');
  const userCount = document.getElementById('userCount');
  if (usersList && normalizedStats.activeUsers) {
    usersList.innerHTML = this.createUsersSection(normalizedStats.activeUsers);
    if (userCount) {
      userCount.textContent = normalizedStats.activeUsers.length;
    }
    console.log('📊 ✅ Users section updated');
  }
  
  console.log('📊 ✅ Original updateUIContent completed');
}


createUsersSection(activeUsers) {
  if (!activeUsers || activeUsers.length === 0) {
    return `
      <div style="text-align: center; color: #9ca3af; padding: 20px;">
        <div style="font-size: 14px;">No users found</div>
      </div>
    `;
  }

  console.log(`🔥 Creating users section with ${activeUsers.length} users:`, activeUsers);

  const onlineUsers = activeUsers.filter(user => user.isOnline);
  const offlineUsers = activeUsers.filter(user => !user.isOnline);

  let usersHtml = '';

  // Online users first
  if (onlineUsers.length > 0) {
    usersHtml += `
      <div style="margin-bottom: 16px;">
        <div style="
          font-size: 12px; 
          font-weight: 600; 
          color: #10b981; 
          margin-bottom: 8px; 
          display: flex; 
          align-items: center;
        ">
          <span style="
            width: 6px; 
            height: 6px; 
            background: #10b981; 
            border-radius: 50%; 
            margin-right: 6px;
          "></span>
          Online (${onlineUsers.length})
        </div>
        ${onlineUsers.map(user => `
          <div style="
            display: flex; 
            align-items: center; 
            padding: 8px 12px; 
            margin-bottom: 4px; 
            background: #f0fdf4; 
            border-radius: 6px; 
            border-left: 2px solid #10b981;
          ">
            <span style="
              flex: 1; 
              font-size: 13px; 
              font-weight: 500;
              color: #065f46;
            ">${user.username}</span>
            <span style="
              font-size: 10px; 
              color: #10b981; 
              font-weight: 600;
              background: #dcfce7;
              padding: 2px 6px;
              border-radius: 8px;
            ">Online</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Offline users
  if (offlineUsers.length > 0) {
    usersHtml += `
      <div>
        <div style="
          font-size: 12px; 
          font-weight: 600; 
          color: #6b7280; 
          margin-bottom: 8px; 
          display: flex; 
          align-items: center;
        ">
          <span style="
            width: 6px; 
            height: 6px; 
            background: #6b7280; 
            border-radius: 50%; 
            margin-right: 6px;
          "></span>
          Recently Active (${offlineUsers.length})
        </div>
        ${offlineUsers.map(user => `
          <div style="
            display: flex; 
            align-items: center; 
            padding: 8px 12px; 
            margin-bottom: 4px; 
            background: #f9fafb; 
            border-radius: 6px; 
            border-left: 2px solid #d1d5db;
          ">
            <span style="
              flex: 1; 
              font-size: 13px; 
              font-weight: 500;
              color: #374151;
            ">${user.username}</span>
            <span style="
              font-size: 10px; 
              color: #6b7280;
              background: #f3f4f6;
              padding: 2px 6px;
              border-radius: 8px;
            ">${user.lastActivity}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  return usersHtml;
}
async updateTableContent(container, teamStats) {
  // Don't show loading, just update the content directly
  try {
    // Get table data for current filter
    const response = await fetch(`${this.config.sheetsUrl}?action=getUsageReport&agencyId=${this.config.agencyId}&filter=${this.currentFilter}`, {
      method: 'GET',
      mode: 'cors'
    });
    
    if (response.ok) {
      const reportData = await response.json();
      
      // Update table content without loading state
      if (reportData && reportData.length > 0) {
        container.innerHTML = this.generateTableHTML(reportData);
      }
    }
  } catch (error) {
    console.error('❌ Silent table update failed:', error);
    // Don't show error UI, just log it
  }
}









  //-------------------------Debug Methods New--------------------------------------
  
// Add this method to your tracker to test data generation
generateTestData() {
  console.log('📊 Generating test data...');
  
  // Create some fake usage data for testing
  const testData = [
    {
      dateTime: new Date().toISOString(),
      apiName: 'Claude API',
      originalText: 'Hello, how are you?',
      inputChars: 150,
      promptChars: 50,
      outputChars: 200,
      othersChars: 25,
      totalChars: 425,
      totalCost: 0.000123,
      apiType: 'AI Assist'
    },
    {
      dateTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      apiName: 'Translation API',
      originalText: 'Translate this text',
      inputChars: 100,
      promptChars: 30,
      outputChars: 120,
      othersChars: 15,
      totalChars: 265,
      totalCost: 0.000089,
      apiType: 'Translation'
    }
  ];
  
  // Send test data to server
  testData.forEach(data => {
    this.sendToTrackingService({
      ...data,
      agencyId: this.config.agencyId
    });
  });
  
  console.log('📊 Test data sent:', testData);
}


// Add these methods to your FullFeaturedAgencyTracker class

// REPLACE the entire getSupabaseCurrentStats method in tracker.js:
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
    
    // CRITICAL FIX: Always get active users and add them to the stats
    console.log('🔥 Fetching active users for cache manager stats...');
    const activeUsers = await this.getFirebaseActiveUsers();
    processedStats.activeUsers = activeUsers;
    
    // Cache the result for 5 minutes to avoid repeated requests
    this.setInCache(cacheKey, processedStats);
    
    console.log(`🔥 Cache manager stats completed with ${activeUsers.length} active users`);
    return processedStats;

  } catch (error) {
    console.error('❌ Error getting current stats from Firebase:', error);
    return this.getEmptyStats();
  }
}


async getFirebaseActiveUsersBasic() {
  try {
    console.log('🔥 Getting active users (ULTRA-SAFE basic version)...');
    
    const firebaseConfig = {
      databaseURL: "https://linguana-24d87-default-rtdb.asia-southeast1.firebasedatabase.app"
    };
    
    // Check cache first (2 minutes cache for active users)
    const cacheKey = 'admin_active_users';
    const cachedUsers = this.getCachedData(cacheKey, 2 * 60 * 1000); // 2 minutes
    if (cachedUsers) {
      console.log(`📦 Using cached admin active users (2min cache) - ${cachedUsers.length} users`);
      return cachedUsers;
    }

    // ULTRA-SAFE: Use basic Firebase URL (no query parameters)
    console.log('🔥 Fetching user activity data from Firebase...');
    const response = await fetch(
      `${firebaseConfig.databaseURL}/user_activity.json`
    );

    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch user activity data - Status: ${response.status}`);
      return [];
    }

    const userData = await response.json();
    if (!userData) {
      console.warn('⚠️ No user activity data found in Firebase');
      return [];
    }
    
    console.log(`🔥 Got user activity data (ULTRA-SAFE basic query) - ${Object.keys(userData).length} total users`);
    
    // Smart processing
    const activeUsers = this.processActiveUsersData(userData);
    
    // Cache the result
    this.setCachedData(cacheKey, activeUsers);
    
    console.log(`✅ getFirebaseActiveUsersBasic returning ${activeUsers.length} active users`);
    return activeUsers;

  } catch (error) {
    console.warn('⚠️ Error getting active users from Firebase:', error);
    return [];
  }
}

async markUserAsActiveOnRealUsage() {
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
      console.log('✅ User marked as active due to real feature usage');
    }
  } catch (error) {
    console.warn('⚠️ Failed to mark user as active:', error);
  }
}

async getFirebaseActiveUsersSimple() {
  try {
    const firebaseConfig = {
      databaseURL: "https://linguana-24d87-default-rtdb.asia-southeast1.firebasedatabase.app"
    };
    
    const response = await fetch(
      `${firebaseConfig.databaseURL}/user_activity.json`
    );

    if (!response.ok) return [];

    const userData = await response.json();
    if (!userData) return [];
    
    const activeUsers = [];
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
    
    // Client-side filtering for recent activity (within 3 days)
    Object.entries(userData).forEach(([userId, user]) => {
      if (user.agency_id === 'default_agency') {
        const lastActivity = new Date(user.last_activity).getTime();
        if (lastActivity > threeDaysAgo) {
          // FIXED: Only check recent activity for online status, ignore is_online flag
          const isOnline = (Date.now() - lastActivity) < 2 * 60 * 1000;
          
          // 🔥 FIX: Show detailed time information
          let displayTime;
          if (isOnline) {
            displayTime = 'Online';
          } else {
            const activityDate = new Date(user.last_activity);
            // Format: "Dec 29, 2025 at 1:34:22 AM"
            displayTime = this.formatRelativeTime(user.last_activity);
          }
          
          activeUsers.push({
            username: user.username,
            lastActivity: displayTime,
            lastActivityTimestamp: lastActivity, // Keep timestamp for sorting
            isOnline: isOnline
          });
        }
      }
    });

    // Sort users by last activity time (most recent first)
    activeUsers.sort((a, b) => {
      return b.lastActivityTimestamp - a.lastActivityTimestamp; // Most recent first
    });

    console.log(`🔥 Found ${activeUsers.length} users active within 3 days`);
    return activeUsers;

  } catch (error) {
    console.warn('⚠️ Error getting active users from Firebase:', error);
    return [];
  }
}


async getFirebaseActiveUsersOptimized() {
  try {
    const firebaseConfig = {
      databaseURL: "https://linguana-24d87-default-rtdb.asia-southeast1.firebasedatabase.app"
    };
    
    // 🚀 OPTIMIZATION: Only get users active in last 10 minutes
    const recentThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // Use Firebase query to filter by recent activity
    const response = await fetch(
      `${firebaseConfig.databaseURL}/user_activity.json?orderBy="last_activity"&startAt="${recentThreshold}"`
    );

    if (!response.ok) return [];

    const userData = await response.json();
    if (!userData) return [];
    
    const activeUsers = [];
    
    // Process only recent active users
    Object.entries(userData).forEach(([userId, user]) => {
      if (user.agency_id === 'default_agency') {
        activeUsers.push({
          username: user.username,
          lastActivity: new Date(user.last_activity).toLocaleDateString(),
          isOnline: user.is_online && 
                   (Date.now() - new Date(user.last_activity).getTime()) < 2 * 60 * 1000
        });
      }
    });

    console.log(`🔥 Found ${activeUsers.length} recent active users (optimized query)`);
    return activeUsers;

  } catch (error) {
    console.warn('⚠️ Error getting active users from Firebase:', error);
    return [];
  }
}


async getSupabaseActiveUsers(supabaseUrl, supabaseKey) {
  try {
    const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_activity?agency_id=eq.default_agency&last_activity=gte.${onlineThreshold.toISOString()}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    if (!response.ok) return [];

    const users = await response.json();
    
    return users.map(user => ({
      username: user.username,
      lastActivity: new Date(user.last_activity).toLocaleDateString(),
      isOnline: user.is_online && (Date.now() - new Date(user.last_activity).getTime()) < 5 * 60 * 1000
    }));

  } catch (error) {
    console.warn('⚠️ Error getting active users from Supabase:', error);
    return [];
  }
}


getDateRangeForFilter(filter, fromDate, toDate) {
  const now = new Date();
  let startDate, endDate;

  if (fromDate && toDate) {
    startDate = new Date(fromDate);
    endDate = new Date(toDate);
  } else {
    switch (filter) {
      case 'Today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date();
        break;
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date();
        break;
      case 'This Month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = new Date();
        break;
    }
  }

  return { startDate, endDate };
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




//-----------------
  trackCharacterUsage(inputChars, outputChars, requestType = 'unknown') {
    const timestamp = new Date().toISOString();
    const cost = this.calculateCost(inputChars, outputChars);
    
    const requestData = {
      timestamp,
      chatterId: this.chatterId,
      inputChars,
      outputChars,
      totalChars: inputChars + outputChars,
      totalCost: cost,
      requestType,
      source: 'manual'
    };
    
    this.trackedRequests.push(requestData);
    console.log('📊 Tracked character usage:', requestData);
    
    this.sendToTrackingService({
      ...requestData,
      agencyId: this.config.agencyId
    }).catch(console.error);
    
    this.savePersistedData();
  }

calculateCost(inputChars, outputChars) {
  const COST_PER_1M_TOKENS = 0.88;  // ✅ OFFICIAL Together.xyz pricing
  const CHARS_PER_TOKEN = 4;
  
  const inputTokens = Math.ceil(inputChars / CHARS_PER_TOKEN);
  const outputTokens = Math.ceil(outputChars / CHARS_PER_TOKEN);
  const totalTokens = inputTokens + outputTokens;
  
  const totalCost = (totalTokens * COST_PER_1M_TOKENS) / 1000000;
  
  return totalCost;
}

  handleResponseReceived(requestId, responseData) {
    const requestData = this.pendingRequests.get(requestId);
    if (!requestData) {
      console.log('📊 No pending request found for response:', requestId);
      return;
    }
    
    this.pendingRequests.delete(requestId);
    
    const inputText = this.extractInputText(requestData.bodyData);
    const outputText = this.extractOutputText(responseData);
    
    const inputChars = inputText.length;
    const outputChars = outputText.length;
    const totalChars = inputChars + outputChars;
    const totalCost = this.calculateCost(inputChars, outputChars);
    
    const finalRequestData = {
      ...requestData,
      inputChars,
      outputChars,
      totalChars,
      totalCost,
      actualResponse: true
    };
    
    this.trackedRequests.push(finalRequestData);
    
    console.log('📊 Tracked API response:', finalRequestData);
    
    const payload = {
      ...finalRequestData,
      agencyId: this.config.agencyId
    };
    
    this.sendToTrackingService(payload).catch(console.error);
    this.savePersistedData();
  }

  extractInputText(bodyData) {
    if (!bodyData) return '';
    
    if (bodyData.messages && Array.isArray(bodyData.messages)) {
      return bodyData.messages.map(msg => msg.content || '').join(' ');
    }
    
    if (bodyData.prompt) return bodyData.prompt;
    if (bodyData.text) return bodyData.text;
    if (bodyData.input) return bodyData.input;
    
    return JSON.stringify(bodyData);
  }

  extractOutputText(responseData) {
    if (!responseData) return '';
    
    if (responseData.choices && Array.isArray(responseData.choices)) {
      return responseData.choices.map(choice => 
        choice.message?.content || choice.text || ''
      ).join(' ');
    }
    
    if (responseData.text) return responseData.text;
    if (responseData.output) return responseData.output;
    if (responseData.result) return responseData.result;
    
    return JSON.stringify(responseData);
  }

  async sendToTrackingService(payload) {
    try {
      const response = await fetch(this.config.sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log('📊 Sent to tracking service');
    } catch (error) {
      console.error('📊 Error sending to tracking service:', error);
    }
  }

  destroy() {
    console.log('🗑️ Destroying tracker instance...');

    this.stopRealtimeRefresh();
    
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, true);
    }
    
    if (this.buttonRestoreInterval) {
      clearInterval(this.buttonRestoreInterval);
    }
    
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
    }
    
    if (this.realtimeInterval) {
      clearInterval(this.realtimeInterval);
    }
    
    if (this.button) {
      this.button.remove();
    }
    
    if (this.uiContainer) {
      this.uiContainer.remove();
    }
    
    this.resetStates();
    
    console.log('✅ Tracker destroyed');
  }
}

const ADMIN_USERS = [
'admin',
'Admin',
'Linguana',
];

// Initialize the full-featured tracker
function initFullFeaturedTracker() {
  // Destroy any existing instance
  if (window.AGENCY_TRACKER_INSTANCE) {
    window.AGENCY_TRACKER_INSTANCE.destroy();
  }
  
  // Create new full-featured instance
  window.AGENCY_TRACKER_INSTANCE = new FullFeaturedAgencyTracker();
  window.agencyTracker = window.AGENCY_TRACKER_INSTANCE;
  
  console.log('🚀 FULL-FEATURED TRACKER ACTIVE');
}

// Multiple initialization attempts (proven to work)
setTimeout(initFullFeaturedTracker, 1000);
setTimeout(initFullFeaturedTracker, 3000);
setTimeout(initFullFeaturedTracker, 5000);

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFullFeaturedTracker);
} else {
  initFullFeaturedTracker();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.AGENCY_TRACKER_INSTANCE) {
    window.AGENCY_TRACKER_INSTANCE.destroy();
  }
});

console.log('📊 Full-Featured Agency Tracker script loaded');