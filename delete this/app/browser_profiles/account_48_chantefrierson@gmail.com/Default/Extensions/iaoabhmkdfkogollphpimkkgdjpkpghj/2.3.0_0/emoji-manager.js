// emoji-manager.js - Enhanced with Keyboard Layout & Letter Shortcuts - UPDATED for IndexedDB
class EmojiManager {
  constructor() {
    // Singleton pattern - prevent multiple instances
    if (window.maloumInstances && window.maloumInstances.emojiManager) {
      console.log('🎭 Emoji Manager instance already exists, cleaning up old one...');
      window.maloumInstances.emojiManager.destroy();
    }
    
    // Initialize global instances registry
    window.maloumInstances = window.maloumInstances || {};
    window.maloumInstances.emojiManager = this;
    
    this.isPickerOpen = false;
    this.draggedElement = null;
    this.draggedIndex = null;
    this.dragPlaceholder = null;
    this.originalElementData = null;
    this.lastMouseX = null;
    this.lastMouseY = null;
    this.recentEmojis = [];
    this.maxRecentEmojis = 20;
    this.keyboardHandler = null; // Track handler for cleanup
    this.unloadHandler = null; // Track unload handler
    this.keyboardLayout = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/']
    ];
    this.currentTextarea = null;
    this.closeHandler = null;
    this.globalMouseMoveHandler = null;
    this.globalMouseUpHandler = null;
    this.emojiCategories = {
      'Custom': [],
      'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
      'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
      'Animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵'],
      'Food': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆'],
      'Objects': ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '💽', '💾', '💿', '📀', '📷', '📸'],
      'Symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '🔥', '💯']
    };
    
    this.setupUnloadCleanup();
    this.init();
    this.registerWithGlobalUIManager();
    window.maloumUIManager.register(this, 'emoji');
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
  // UPDATED: Now async to handle IndexedDB loading
  async init() {
    console.log('Enhanced Emoji Manager with Recent Emojis initializing...');
    await this.loadCustomEmojis();
    await this.loadRecentEmojis(); // NEW: Add this line
    this.setupEmojiButtonMonitoring();
    this.setupKeyboardShortcuts();
  }

  // Add this method to your EmojiManager class
  syncStateWithDOM() {
    const pickerExists = document.getElementById('maloum-emoji-picker');
    if (!pickerExists && this.isPickerOpen) {
      console.log('🔧 State sync: Picker state was true but no DOM element found, resetting state');
      this.isPickerOpen = false;
      this.currentTextarea = null;
    } else if (pickerExists && !this.isPickerOpen) {
      console.log('🔧 State sync: Found picker in DOM but state was false, removing picker');
      pickerExists.remove();
    }
    console.log('🔧 State sync complete. isPickerOpen:', this.isPickerOpen, 'DOM exists:', !!pickerExists);
  }
  // UPDATED: Load custom emojis from IndexedDB with localStorage migration
  async loadCustomEmojis() {
    try {
      // Use IndexedDB via cache storage
      if (window.maloumCacheManager && window.maloumCacheManager.storage) {
        const stored = await window.maloumCacheManager.storage.loadCustomEmojis();
        if (stored && stored.length > 0) {
          this.emojiCategories.Custom = stored;
          console.log(`✅ Loaded ${this.emojiCategories.Custom.length} custom emojis from IndexedDB`);
          return;
        }
      }
      
      // Fallback to localStorage for migration
      const legacyStored = localStorage.getItem('maloum-custom-emojis');
      if (legacyStored) {
        this.emojiCategories.Custom = JSON.parse(legacyStored);
        console.log(`🔄 Migrated ${this.emojiCategories.Custom.length} custom emojis from localStorage`);
        
        // Save to IndexedDB and remove from localStorage
        await this.saveCustomEmojis();
        localStorage.removeItem('maloum-custom-emojis');
        console.log('🧹 Cleaned up localStorage after migration');
      } else {
        // Default custom emojis for first-time users - Adult dating platform focused
        // Keyboard layout mapping (33 positions total):
        // Row 1 (Q-]): positions 0-11
        // Row 2 (A-'): positions 12-22
        // Row 3 (Z-/): positions 23-32
        this.emojiCategories.Custom = [
          // Row 1: Q W E R T Y U I O P [ ]
          '😘', '😍', '🥰', '😈', '🔥', '💋', '👅', '💦', '🍑', '🍆', '💯', '🎉',
          // Row 2: A S D F G H J K L ; '
          '❤️', '💕', '💖', '😏', '🤤', '👀', '😉', '🥵', '💪', '👑', '✨',
          // Row 3: Z X C V B N M , . /
          '🌹', '💐', '🍾', '🥂', '🎁', '💝', '💞', '😻', '🤗', '🙈'
        ];
        await this.saveCustomEmojis();
        console.log('📦 Initialized with default adult dating emojis (33 keys filled)');
      }
    } catch (error) {
      console.warn('⚠️ Error loading custom emojis:', error);
      this.emojiCategories.Custom = ['😊', '👍', '❤️', '🔥', '💯', '🎉'];
    }
  }

  // UPDATED: Save custom emojis to IndexedDB with localStorage fallback
  async saveCustomEmojis() {
    try {
      // Use IndexedDB via cache storage
      if (window.maloumCacheManager && window.maloumCacheManager.storage) {
        const success = await window.maloumCacheManager.storage.saveCustomEmojis(this.emojiCategories.Custom);
        if (success) {
          console.log('✅ Custom emojis saved to IndexedDB');
          return;
        }
      }
      // Fallback to localStorage
      localStorage.setItem('maloum-custom-emojis', JSON.stringify(this.emojiCategories.Custom));
      console.log('⚠️ Custom emojis saved to localStorage (fallback)');
    } catch (error) {
      console.warn('❌ Error saving custom emojis:', error);
    }
  }
async loadRecentEmojis() {
  try {
    // Use IndexedDB via cache storage (with fallback if method doesn't exist)
    if (window.maloumCacheManager && 
        window.maloumCacheManager.storage && 
        typeof window.maloumCacheManager.storage.loadRecentEmojis === 'function') {
      const stored = await window.maloumCacheManager.storage.loadRecentEmojis();
      if (stored && stored.length > 0) {
        this.recentEmojis = stored;
        console.log(`✅ Loaded ${this.recentEmojis.length} recent emojis from IndexedDB`);
        return;
      }
    }
    
    // Fallback to localStorage
    const legacyStored = localStorage.getItem('maloum-recent-emojis');
    if (legacyStored) {
      this.recentEmojis = JSON.parse(legacyStored);
      console.log(`🔄 Loaded ${this.recentEmojis.length} recent emojis from localStorage`);
    } else {
      this.recentEmojis = [];
      console.log('📝 Starting with empty recent emojis');
    }
  } catch (error) {
    console.warn('⚠️ Error loading recent emojis:', error);
    this.recentEmojis = [];
  }
}

async saveRecentEmojis() {
  try {
    // Use IndexedDB via cache storage (with fallback if method doesn't exist)
    if (window.maloumCacheManager && 
        window.maloumCacheManager.storage && 
        typeof window.maloumCacheManager.storage.saveRecentEmojis === 'function') {
      const success = await window.maloumCacheManager.storage.saveRecentEmojis(this.recentEmojis);
      if (success) {
        console.log('✅ Recent emojis saved to IndexedDB');
        return;
      }
    }
    
    // Fallback to localStorage
    localStorage.setItem('maloum-recent-emojis', JSON.stringify(this.recentEmojis));
    console.log('⚠️ Recent emojis saved to localStorage (fallback)');
  } catch (error) {
    console.warn('❌ Error saving recent emojis:', error);
  }
}

addToRecentEmojis(emoji) {
  // Store current focus before updating
  const currentFocus = document.activeElement;
  
  // Remove if already exists (to move to front)
  this.recentEmojis = this.recentEmojis.filter(e => e !== emoji);
  
  // Add to front
  this.recentEmojis.unshift(emoji);
  
  // Keep only max recent emojis
  if (this.recentEmojis.length > this.maxRecentEmojis) {
    this.recentEmojis = this.recentEmojis.slice(0, this.maxRecentEmojis);
  }
  
  // Save asynchronously
  this.saveRecentEmojis();
  
  // Always refresh the recent emojis UI if picker is open
  if (this.isPickerOpen) {
    setTimeout(() => {
      this.refreshRecentEmojisSection();
      
      // IMPORTANT: Restore focus to the original element (usually textarea)
      if (currentFocus && currentFocus.tagName === 'TEXTAREA') {
        currentFocus.focus();
      }
    }, 10);
  }
}
refreshRecentEmojisSection() {
  const recentGrid = document.getElementById('recent-emojis-grid');
  
  if (!recentGrid) {
    console.log('Recent emojis grid not found');
    return;
  }
  
  console.log('Refreshing recent emojis with', this.recentEmojis.length, 'emojis');
  
  // Clear current content
  recentGrid.innerHTML = '';
  
  // Show recent emojis
  if (this.recentEmojis.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.textContent = 'No recent emojis yet. Start using emojis to see them here!';
    emptyMessage.style.cssText = `
      grid-column: 1 / -1;
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 12px;
      font-style: italic;
    `;
    recentGrid.appendChild(emptyMessage);
  } else {
    this.recentEmojis.forEach(emoji => {
      const emojiBtn = document.createElement('button');
      emojiBtn.textContent = emoji;
      emojiBtn.style.cssText = `
        padding: 4px;
        border: 1px solid #e5e7eb;
        background: white;
        cursor: pointer;
        font-size: 14px;
        border-radius: 3px;
        transition: all 0.2s;
      `;

  emojiBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // SYNC STATE WITH DOM FIRST
    this.syncStateWithDOM();
    
    console.log('🔧 Emoji button clicked, current state:', this.isPickerOpen);
    
    if (this.isPickerOpen) {
      console.log('🔧 Picker is open, closing...');
      this.closeEmojiPicker();
    } else {
      console.log('🔧 Picker is closed, opening...');
      this.openEmojiPicker(textarea, emojiBtn);
    }
  });

      recentGrid.appendChild(emojiBtn);
    });
  }
}
// Fixed setupKeyboardShortcuts to not interfere with input fields

  setupKeyboardShortcuts() {
    console.log('🎹 Setting up emoji manager keyboard shortcuts...');
    
    // Remove any existing listeners FIRST
    this.removeKeyboardShortcuts();

    this.keyboardHandler = (e) => {
      // Alt + L to toggle emoji picker
      if (e.altKey && e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const textarea = document.querySelector('textarea[placeholder="Write a message"]');
        const button = document.getElementById('maloum-emoji-btn');
        
        if (textarea && button) {
          this.syncStateWithDOM();
          console.log('🎹 Alt+L pressed, current state:', this.isPickerOpen);
          
          if (this.isPickerOpen) {
            console.log('🔧 Picker is open, closing...');
            this.closeEmojiPicker();
          } else {
            console.log('🔧 Picker is closed, opening...');
            this.openEmojiPicker(textarea, button);
          }
        }
        return false;
      }
      
      // Handle shortcuts when picker is open
      if (this.isPickerOpen && this.currentTextarea) {
        // Escape to close picker
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          console.log('🎹 ESC: Closing emoji picker');
          this.closeEmojiPicker();
          return false;
        }
        
        // Don't interfere if user is typing in emoji picker input fields
        const activeElement = document.activeElement;
        const isEmojiPickerInput = activeElement && 
          activeElement.tagName === 'INPUT' && 
          activeElement.placeholder === 'Type or paste your emoji here...';
        
        if (isEmojiPickerInput) {
          console.log('🔧 Ignoring key event - user is typing in input field');
          return;
        }
        
        // Letter shortcuts for custom emojis
        const key = e.key.toLowerCase();
        const allLetters = this.keyboardLayout.flat().map(l => l.toLowerCase());
        
        if (allLetters.includes(key)) {
          e.preventDefault();
          
          console.log(`🔧 Letter shortcut pressed: ${key}`);
          
          const position = this.getLetterPosition(key.toUpperCase());
          console.log(`🔧 Letter position: ${position}`);
          
          if (position !== -1 && position < this.emojiCategories.Custom.length) {
            const emoji = this.emojiCategories.Custom[position];
            console.log(`🔧 Found emoji at position ${position}: ${emoji}`);
            
            if (emoji) {
              console.log(`🔧 Inserting emoji: ${emoji}`);
              this.insertEmoji(this.currentTextarea, emoji);
              
              // Visual effect on the key box
              const keyBox = this.findKeyBoxByPosition(position);
              if (keyBox) {
                console.log('🔧 Found keyBox, applying visual effect');
                keyBox.style.transform = 'scale(0.5)';
                keyBox.style.background = '#f43e06';
                keyBox.style.borderColor = '#f43e06';
                keyBox.style.boxShadow = '0 2px 8px rgba(244, 62, 6, 0.3)';
                
                setTimeout(() => {
                  keyBox.style.transform = 'scale(1)';
                  keyBox.style.background = 'white';
                  keyBox.style.borderColor = '#d1d5db';
                  keyBox.style.boxShadow = 'none';
                }, 150);
              }
            }
          }
        }
      }
    };
    
    document.addEventListener('keydown', this.keyboardHandler, true);
    console.log('✅ Emoji keyboard shortcuts setup complete');
  }
  setupUnloadCleanup() {
    this.unloadHandler = () => {
      console.log('🧹 Page unloading, cleaning up Emoji Manager...');
      this.destroy();
    };
    
    window.addEventListener('beforeunload', this.unloadHandler);
    window.addEventListener('unload', this.unloadHandler);
  }

  removeKeyboardShortcuts() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, true);
      console.log('🧹 Removed emoji manager keyboard handler');
      this.keyboardHandler = null;
    }
  }
  getLetterPosition(letter) {
    console.log(`🔧 getLetterPosition called with: ${letter}`);
    for (let rowIndex = 0; rowIndex < this.keyboardLayout.length; rowIndex++) {
      const colIndex = this.keyboardLayout[rowIndex].indexOf(letter);
      if (colIndex !== -1) {
        // Calculate absolute position
        let position = 0;
        for (let i = 0; i < rowIndex; i++) {
          position += this.keyboardLayout[i].length;
        }
        position += colIndex;
        console.log(`🔧 Letter ${letter} found at position: ${position}`);
        return position;
      }
    }
    console.log(`🔧 Letter ${letter} not found in keyboard layout`);
    return -1;
  }
  getLetterAtPosition(position) {
    let currentPos = 0;
    for (let rowIndex = 0; rowIndex < this.keyboardLayout.length; rowIndex++) {
      if (position < currentPos + this.keyboardLayout[rowIndex].length) {
        return this.keyboardLayout[rowIndex][position - currentPos];
      }
      currentPos += this.keyboardLayout[rowIndex].length;
    }
    return null;
  }

  findKeyBoxByPosition(position) {
    console.log(`🔧 findKeyBoxByPosition called with position: ${position}`);
    const keyboardContainer = document.getElementById('custom-emoji-keyboard');
    if (!keyboardContainer) {
      console.log('🔧 Keyboard container not found');
      return null;
    }
    
    const rows = keyboardContainer.children;
    let currentPos = 0;
    
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const keyBoxes = row.children;
      
      for (let boxIndex = 0; boxIndex < keyBoxes.length; boxIndex++) {
        if (currentPos === position) {
          console.log(`🔧 Found keyBox at position ${position}`);
          return keyBoxes[boxIndex];
        }
        currentPos++;
      }
    }
    
    console.log(`🔧 KeyBox not found at position ${position}`);
    return null;
  }

  setupEmojiButtonMonitoring() {
    // Monitor for translate container and add emoji button
    this.addEmojiButton();
    
    // Monitor for new textareas/containers and URL changes
    const observer = new MutationObserver(() => {
      const hasTextarea = document.querySelector('textarea[placeholder="Write a message"]');
      const hasTranslateContainer = document.getElementById('maloum-translate-container');
      const hasEmojiButton = document.getElementById('maloum-emoji-btn');
      
      if (hasTextarea && hasTranslateContainer && !hasEmojiButton) {
        setTimeout(() => this.addEmojiButton(), 500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Monitor URL changes for chat switching - FIX: Only close if actually open
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('URL changed, checking emoji picker state');
        
        // ONLY close if picker is actually open and exists in DOM
        const pickerExists = document.getElementById('maloum-emoji-picker');
        if (this.isPickerOpen && pickerExists) {
          console.log('URL changed and picker is open, closing it');
          this.closeEmojiPicker();
        } else if (this.isPickerOpen && !pickerExists) {
          console.log('URL changed, state was open but no picker found, resetting state');
          this.isPickerOpen = false;
          this.currentTextarea = null;
        }
        
        setTimeout(() => this.addEmojiButton(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  addEmojiButton() {
    const checkForContainer = () => {
      const textarea = document.querySelector('textarea[placeholder="Write a message"]');
      const translateContainer = document.getElementById('maloum-translate-container');
      
      if (textarea && translateContainer && !document.getElementById('maloum-emoji-btn')) {
        this.createEmojiButton(textarea, translateContainer);
      } else if (!translateContainer) {
        setTimeout(checkForContainer, 1000);
      }
    };
    checkForContainer();
  }

  createEmojiButton(textarea, translateContainer) {
    if (document.getElementById('maloum-emoji-btn')) return;

    const emojiBtn = document.createElement('button');
    emojiBtn.id = 'maloum-emoji-btn';
    emojiBtn.textContent = '😋';
    emojiBtn.title = 'Insert Emoji (Alt+L)';
    emojiBtn.style.cssText = `
      padding: 3px 10px; 
      background: rgba(0, 0, 0, 0.8); 
      color: rgba(255, 255, 255, 0.9); 
      border: none; 
      border-radius: 4px; 
      cursor: pointer; 
      font-size: 14px; 
      font-weight: 500; 
      transition: all 0.3s ease;
      min-width: 35px;
      margin-left: auto;
      transform: scale(1);
      max-height: 26px;
    `;

    emojiBtn.addEventListener('mouseenter', () => {
      emojiBtn.style.background = 'rgba(244, 62, 6, 1)';
      emojiBtn.style.color = 'rgba(0, 0, 0, 0.8)';
      emojiBtn.style.transform = 'scale(1.05)';
      emojiBtn.textContent = '🖤';
    });

    emojiBtn.addEventListener('mouseleave', () => {
      emojiBtn.style.background = 'rgba(0, 0, 0, 0.8)';
      emojiBtn.style.color = 'rgba(255, 255, 255, 0.9)';
      emojiBtn.style.transform = 'scale(1)';
      emojiBtn.textContent = '😋';
    });

    // FIXED: Updated click handler to toggle
    emojiBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔧 Emoji button clicked, current state:', this.isPickerOpen);
      
      if (this.isPickerOpen) {
        console.log('🔧 Picker is open, closing...');
        this.closeEmojiPicker();
      } else {
        console.log('🔧 Picker is closed, opening...');
        this.openEmojiPicker(textarea, emojiBtn);
      }
    });

    translateContainer.appendChild(emojiBtn);
  }

  openEmojiPicker(textarea, button) {
    if (this.isPickerOpen) {
      console.log('🔧 Emoji picker already open, skipping');
      return;
    }

    // NEW: Check if Prompt UI is open and prevent opening
    if (window.maloumInstances?.promptManager?.isPromptUIOpen) {
      console.log('🔧 Prompt UI is open, cannot open Emoji picker');
      this.showToast('Please close Prompt Manager first', 'warning');
      return;
    }
    
    // Tell global manager we're opening
    window.maloumUIManager.openUI(this, 'emoji');

    console.log('🔧 Opening emoji picker with reverse Mac-style animation...');
    this.closeEmojiPicker();
    this.currentTextarea = textarea;
    this.isPickerOpen = true;

    // Get button position for animation
    const buttonRect = button.getBoundingClientRect();
    console.log('🔧 Button rect:', buttonRect);

    // Calculate safe positioning (same as debug version)
    const pickerWidth = 600;
    const pickerHeight = 500;
    
    let finalLeft = Math.max(10, buttonRect.left - 400);
    let finalTop = buttonRect.top - pickerHeight - 10;
    
    if (finalTop < 10) {
      finalTop = buttonRect.bottom + 10;
    }
    
    if (finalLeft + pickerWidth > window.innerWidth - 10) {
      finalLeft = window.innerWidth - pickerWidth - 10;
    }
    
    if (finalTop + pickerHeight > window.innerHeight - 10) {
      finalTop = window.innerHeight - pickerHeight - 10;
    }

    // Animation start position (from button center)
    const startX = buttonRect.left + buttonRect.width / 2;
    const startY = buttonRect.top + buttonRect.height / 2;
    const startOffsetX = startX - (finalLeft + pickerWidth / 2);
    const startOffsetY = startY - (finalTop + pickerHeight / 2);

    const picker = document.createElement('div');
    picker.id = 'maloum-emoji-picker';
    picker.style.cssText = `
      position: fixed;
      left: ${finalLeft}px;
      top: ${finalTop}px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      width: ${pickerWidth}px;
      height: ${pickerHeight}px;
      z-index: 10000;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      opacity: 0;
      transform: translate(${startOffsetX}px, ${startOffsetY}px) scale(0.1);
      transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease-out;
      transform-origin: center center;
    `;

    // Add ESC key handler
    picker.escHandler = (e) => {
      if (e.key === 'Escape' && this.isPickerOpen) {
        e.preventDefault();
        e.stopPropagation();
        this.closeEmojiPicker();
      }
    };
    document.addEventListener('keydown', picker.escHandler, true);

    // Create header
    const header = this.createPickerHeader(() => {
      console.log('🔧 Close button clicked');
      this.closeEmojiPicker();
    });
    
    // Create tabs
    const tabContainer = this.createTabs(textarea);
    
    picker.appendChild(header);
    picker.appendChild(tabContainer);
    document.body.appendChild(picker);

    // Trigger animation to final position
    setTimeout(() => {
      picker.style.transform = 'translate(0, 0) scale(1)';
      picker.style.opacity = '1';
    }, 25);

    // Initialize with Custom tab after animation
    setTimeout(() => {
      this.switchToTab('Custom', textarea);
    }, 100);

    // Focus text area after animation
    setTimeout(() => {
      if (textarea && typeof textarea.focus === 'function') {
        textarea.focus();
      }
    }, 100);

    // Outside click handler
    this.closeHandler = (e) => {
      // Don't close if click is from UI manager transitions
      if (e.target && (
        e.target.closest('#maloum-prompt-container') ||
        e.target.closest('#maloum-cache-backdrop') ||
        e.target.closest('#maloum-assist-float')
      )) {
        return;
      }
      
      if (!picker.contains(e.target) && 
          e.target !== button && 
          !button.contains(e.target)) {
        this.closeEmojiPicker();
      }
    };
    
    // Longer delay to allow UI manager transitions to complete
    setTimeout(() => {
      document.addEventListener('click', this.closeHandler, true);
    }, 500);

    console.log('✅ Emoji picker opened successfully');
  }
showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 8px 12px;
    background: ${type === 'warning' ? '#f59e0b' : type === 'error' ? '#dc2626' : '#3b82f6'};
    color: white;
    border-radius: 6px;
    font-size: 12px;
    z-index: 10001;
    opacity: 0;
    transition: opacity 0.3s;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  `;
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.style.opacity = '1', 10);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
  createPickerHeader(onClose) {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(0,0,0,0.8);
      color: white;
    `;

    const title = document.createElement('strong');
    title.textContent = 'Emoji Picker';
    title.style.cssText = 'margin: 0; font-size: 15px; font-weight: 600; color: white;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
    `;

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onClose) onClose();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    return header;
  }

  createTabs(textarea) {
    const container = document.createElement('div');
    
    // Tab header
    const tabHeader = document.createElement('div');
    tabHeader.id = 'emoji-tab-header';
    tabHeader.style.cssText = `
      display: flex;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
      padding-left: 10px;
      padding-top: 10px;
      overflow-x: auto;
    `;

    const categories = Object.keys(this.emojiCategories);
    
    categories.forEach((category) => {
      const tab = document.createElement('button');
      tab.textContent = `${this.getCategoryIcon(category)} ${category}`;
      tab.dataset.category = category;
      tab.style.cssText = `
        padding: 8px 12px;
        border: none;
        background: ${category === 'Custom' ? '#f43e06' : 'transparent'};
        color: ${category === 'Custom' ? 'white' : '#6b7280'};
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s;
        flex-shrink: 0;
        white-space: nowrap;
      `;

      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchToTab(category, textarea);
      });

      tabHeader.appendChild(tab);
    });

    // Tab content
    const tabContent = document.createElement('div');
    tabContent.id = 'emoji-tab-content';
    tabContent.style.cssText = 'min-height: 300px; max-height: 400px; overflow-y: auto;';

    container.appendChild(tabHeader);
    container.appendChild(tabContent);
    return container;
  }

  switchToTab(category, textarea) {
    // Update active tab styling
    const tabs = document.querySelectorAll('#emoji-tab-header button');
    tabs.forEach(tab => {
      const isActive = tab.dataset.category === category;
      tab.style.background = isActive ? '#f43e06' : 'transparent';
      tab.style.color = isActive ? 'white' : '#6b7280';
      tab.style.borderRadius = '8px 8px 0px 0px';
    });

    // Update tab content
    const tabContent = document.getElementById('emoji-tab-content');
    if (category === 'Custom') {
      tabContent.innerHTML = '';
      tabContent.appendChild(this.createCustomTab(textarea));
    } else {
      tabContent.innerHTML = '';
      tabContent.appendChild(this.createRegularTab(category, textarea));
    }
  }
  createCustomTab(textarea) {
    const container = document.createElement('div');
    container.style.cssText = 'padding: 16px;';

    // Your Custom Emojis section with keyboard layout
    const customTitle = document.createElement('h4');
    customTitle.textContent = '⭐ Your Custom Emojis (Keyboard Layout) - Long press to drag & drop';
    customTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 14px; color: #374151; font-weight: 600;';

    const keyboardContainer = document.createElement('div');
    keyboardContainer.id = 'custom-emoji-keyboard';
    keyboardContainer.style.cssText = `
      background: rgba(0, 0, 0, 0.8);
      border-radius: 8px;
      border: 2px dashed #d1d5db;
      padding: 16px;
      margin-bottom: 16px;
    `;

    this.renderKeyboardLayout(keyboardContainer, textarea);

    // Add emoji input
    const addSection = document.createElement('div');
    addSection.style.cssText = 'margin-bottom: 16px; display: flex; gap: 8px; align-items: center;';
    
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = 'Type or paste your emoji here...';
    addInput.style.cssText = `
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 12px;
    `;

    // Add paste event listener for proper emoji pasting
    addInput.addEventListener('paste', (e) => {
      e.preventDefault();
      
      // Get pasted data
      const pastedData = (e.clipboardData || window.clipboardData).getData('text');
      
      if (pastedData) {
        // Clean the pasted data (remove extra whitespace)
        const cleanedEmoji = pastedData.trim();
        
        // Set the value and trigger input event
        addInput.value = cleanedEmoji;
        addInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Add Enter key support to trigger the add button
    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addBtn.click(); // Trigger the add button
      }
    });

    // Add input event listener for real-time validation feedback
    addInput.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      
      // Optional: Add visual feedback for valid emoji input
      if (value) {
        // Check if it's already in custom emojis
        if (this.emojiCategories.Custom.includes(value)) {
          addInput.style.borderColor = '#f59e0b'; // Yellow for duplicate
          addInput.title = 'This emoji is already in your keyboard';
        } else {
          addInput.style.borderColor = '#10b981'; // Green for valid
          addInput.title = 'Ready to add this emoji';
        }
      } else {
        addInput.style.borderColor = '#d1d5db'; // Default gray
        addInput.title = '';
      }
    });

    // Reset border color on focus
    addInput.addEventListener('focus', () => {
      if (!addInput.value.trim()) {
        addInput.style.borderColor = '#3b82f6'; // Blue on focus
      }
    });

    addInput.addEventListener('blur', () => {
      if (!addInput.value.trim()) {
        addInput.style.borderColor = '#d1d5db'; // Default when empty
      }
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.style.cssText = `
      padding: 6px 12px;
      background: rgba(0,0,0,0.6);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    `;

    // Reset to Defaults button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 Reset';
    resetBtn.title = 'Reset custom emojis to defaults (33 adult dating emojis)';
    resetBtn.style.cssText = `
      padding: 6px 12px;
      background: rgba(0,0,0,0.6);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    `;

    // UPDATED: Add async/await for saving emojis
    addBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const emoji = addInput.value.trim();
      
      if (!emoji) {
        this.showToast('Please enter an emoji!', 'info');
        return;
      }
      
      if (this.emojiCategories.Custom.includes(emoji)) {
        this.showToast(`${emoji} is already in your custom keyboard!`, 'info');
        addInput.value = ''; // Clear the input
        return;
      }
      
      // Check for available slots in first 33 positions
      const hasAvailableSlot = this.emojiCategories.Custom.length < 33 || 
                            this.emojiCategories.Custom.slice(0, 33).some(slot => !slot || slot === '');
      
      if (hasAvailableSlot) {
        // Find first empty slot or add to end
        let insertIndex = this.emojiCategories.Custom.findIndex(slot => !slot || slot === '');
        if (insertIndex === -1 && this.emojiCategories.Custom.length < 33) {
          insertIndex = this.emojiCategories.Custom.length;
        }
        
        if (insertIndex !== -1 && insertIndex < 33) {
          // Extend array if needed
          while (this.emojiCategories.Custom.length <= insertIndex) {
            this.emojiCategories.Custom.push('');
          }
          this.emojiCategories.Custom[insertIndex] = emoji;
          
          await this.saveCustomEmojis();
          this.renderKeyboardLayout(keyboardContainer, textarea);
          addInput.value = '';
          
          // Get the letter at this position for the enhanced toast
          const letter = this.getLetterAtPosition(insertIndex);
          if (letter) {
            this.showToast(`${emoji} added to key "${letter.toLowerCase()}"!`, 'success');
          } else {
            this.showToast(`${emoji} added!`, 'success');
          }
        }
      } else {
        this.showToast('Maximum 33 custom emojis reached!', 'info');
      }
    });

    // Available emojis
    // Recent Emojis section (replaces "Add from Available")
    const recentTitle = document.createElement('h4');
    recentTitle.textContent = '🕒 Recently Used';
    recentTitle.style.cssText = 'margin: 0 0 8px 0; font-size: 12px; color: #374151; font-weight: 600;';

    const recentGrid = document.createElement('div');
    recentGrid.className = 'recent-emojis-grid';
    recentGrid.id = 'recent-emojis-grid'; // ADD THIS LINE
    recentGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 2px;
      max-height: 120px;
      overflow-y: auto;
      min-height: 40px;
    `;

    // Show recent emojis
    if (this.recentEmojis.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No recent emojis yet. Start using emojis to see them here!';
      emptyMessage.style.cssText = `
        grid-column: 1 / -1;
        text-align: center;
        padding: 20px;
        color: #6b7280;
        font-size: 12px;
        font-style: italic;
      `;
      recentGrid.appendChild(emptyMessage);
    } else {
      this.recentEmojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.textContent = emoji;
        emojiBtn.style.cssText = `
          padding: 4px;
          border: 1px solid #e5e7eb;
          background: white;
          cursor: pointer;
          font-size: 14px;
          border-radius: 3px;
          transition: all 0.2s;
        `;

        emojiBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.insertEmoji(textarea, emoji);
        });

        recentGrid.appendChild(emojiBtn);
      });
    }

    // Reset button click handler
    resetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      // Confirm before reset
      if (confirm('Reset all custom emojis to default adult dating emojis? This will fill all 33 keyboard keys.')) {
        resetBtn.textContent = '⏳ Resetting...';
        resetBtn.disabled = true;

        await this.resetToDefaults();

        resetBtn.textContent = '✅ Done!';
        setTimeout(() => {
          resetBtn.textContent = '🔄 Reset';
          resetBtn.disabled = false;
        }, 2000);
      }
    });

    addSection.appendChild(addInput);
    addSection.appendChild(addBtn);
    addSection.appendChild(resetBtn);

    container.appendChild(customTitle);
    container.appendChild(keyboardContainer);
    container.appendChild(addSection);
    container.appendChild(recentTitle);       // NEW
    container.appendChild(recentGrid);        // NEW
    return container;
  }

  renderKeyboardLayout(container, textarea) {
    container.innerHTML = '';

    // Create keyboard rows
    this.keyboardLayout.forEach((row, rowIndex) => {
      const rowDiv = document.createElement('div');
      rowDiv.style.cssText = `
        display: flex;
        gap: 6px;
        margin-bottom: 6px;
        justify-content: center;
      `;

      row.forEach((letter, colIndex) => {
        const position = this.getLetterPosition(letter);
        const emoji = this.emojiCategories.Custom[position];

        const keyBox = document.createElement('div');
        keyBox.style.cssText = `
          width: 40px;
          height: 40px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: ${emoji ? 'white' : '#f3f4f6'};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: ${emoji ? 'pointer' : 'default'};
          position: relative;
          transition: all 0.2s;
          font-size: 18px;
          user-select: none;
        `;

        if (emoji) {
          // Create emoji span
          const emojiSpan = document.createElement('span');
          emojiSpan.textContent = emoji;
          emojiSpan.style.cssText = `
            font-size: 18px;
            line-height: 1;
            pointer-events: none;
          `;

          // Add small letter in upper-left corner
          const letterLabel = document.createElement('div');
          letterLabel.textContent = letter.toLowerCase();
          letterLabel.style.cssText = `
            position: absolute;
            top: 2px;
            left: 3px;
            font-size: 8px;
            color: #6b7280;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 2px;
            padding: 1px 2px;
            line-height: 1;
            z-index: 1;
            pointer-events: none;
          `;

          keyBox.appendChild(emojiSpan);
          keyBox.appendChild(letterLabel);

          // Hover effects
          keyBox.addEventListener('mouseenter', () => {
            if (!keyBox.classList.contains('dragging')) {
              keyBox.style.background = '#f43e06';
              keyBox.style.transform = 'scale(1.1)';
              keyBox.style.borderColor = '#f43e06';
              keyBox.style.boxShadow = '0 2px 8px rgba(244, 62, 6, 0.3)';
            }
          });

          keyBox.addEventListener('mouseleave', () => {
            if (!keyBox.classList.contains('dragging')) {
              keyBox.style.background = 'white';
              keyBox.style.transform = 'scale(1)';
              keyBox.style.borderColor = '#d1d5db';
              keyBox.style.boxShadow = 'none';
            }
          });

          // Click to use emoji - DON'T close picker
          keyBox.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!keyBox.classList.contains('dragging')) {
              this.insertEmoji(textarea, emoji);
              // Click effect
              keyBox.style.transform = 'scale(0.5)';
              // Return to normal size after a short delay
              setTimeout(() => {
                keyBox.style.transform = 'scale(1)';
              }, 150); // 150ms delay before returning to normal size
            }
          });

          // UPDATED: Right-click to remove with async/await
            keyBox.addEventListener('contextmenu', async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (confirm(`Remove ${emoji}?`)) {
                this.emojiCategories.Custom[position] = ''; // ← SET TO EMPTY STRING INSTEAD
                await this.saveCustomEmojis();
                this.renderKeyboardLayout(container, textarea);
                this.showMiniToast('Removed!', 'success');
              }
            });

          // Drag and Drop functionality
          this.setupDragAndDrop(keyBox, position, container, textarea);

        } else {
          // Empty slot - show the key letter
          keyBox.textContent = letter.toLowerCase();
          keyBox.style.color = '#9ca3af';
          keyBox.style.fontSize = '12px';
          keyBox.style.fontWeight = '600';
        }

        rowDiv.appendChild(keyBox);
      });

      container.appendChild(rowDiv);
    });

    // Add instruction
    const instruction = document.createElement('div');
    instruction.textContent = 'Press letter keys for quick access • Long press & drag to reorder • Right-click to remove';
    instruction.style.cssText = `
      text-align: center;
      font-size: 12px;
      color: white;
      margin-top: 8px;
      padding: 4px;
      background: rgba(107, 114, 128, 0.1);
      border-radius: 4px;
    `;
    container.appendChild(instruction);
  }

createRegularTab(category, textarea) {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 16px;';

  // Add instruction at the top
  const instruction = document.createElement('div');
  instruction.textContent = '💡 Left click to use • Right click to add to custom keyboard';
  instruction.style.cssText = `
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 4px;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 12px;
    color: #92400e;
    text-align: center;
    font-weight: 500;
  `;

  const emojiGrid = document.createElement('div');
  emojiGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
  `;

  const emojis = this.emojiCategories[category] || [];

  emojis.forEach(emoji => {
    const emojiBtn = document.createElement('button');
    emojiBtn.textContent = emoji;
    emojiBtn.style.cssText = `
      padding: 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      border-radius: 4px;
      transition: background-color 0.2s;
      position: relative;
    `;

    // Left click - insert emoji into textarea (existing behavior)
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.insertEmoji(textarea, emoji);
      // Don't close picker - let user continue selecting emojis
    });

    // RIGHT CLICK - add to custom keyboard
    emojiBtn.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (this.emojiCategories.Custom.includes(emoji)) {
        this.showToast(`${emoji} is already in your custom keyboard!`, 'info');
        return;
      }
      
      const hasAvailableSlot = this.emojiCategories.Custom.length < 33 || 
                             this.emojiCategories.Custom.slice(0, 33).some(slot => !slot || slot === '');
      
      if (hasAvailableSlot) {
        let insertIndex = this.emojiCategories.Custom.findIndex(slot => !slot || slot === '');
        if (insertIndex === -1 && this.emojiCategories.Custom.length < 33) {
          insertIndex = this.emojiCategories.Custom.length;
        }
        
        if (insertIndex !== -1 && insertIndex < 33) {
          while (this.emojiCategories.Custom.length <= insertIndex) {
            this.emojiCategories.Custom.push('');
          }
          this.emojiCategories.Custom[insertIndex] = emoji;
          
          await this.saveCustomEmojis();
          
          // Update custom tab if it's currently visible
          const tabContent = document.getElementById('emoji-tab-content');
          const activeTab = document.querySelector('#emoji-tab-header button[style*="rgba(0,0,0,0.8)"]');
          if (activeTab && activeTab.dataset.category === 'Custom') {
            tabContent.innerHTML = '';
            tabContent.appendChild(this.createCustomTab(textarea));
          }
          
          const letter = this.getLetterAtPosition(insertIndex);
          if (letter) {
            this.showToast(`${emoji} added to key "${letter.toLowerCase()}"!`, 'success');
          } else {
            this.showToast(`${emoji} added to custom keyboard!`, 'success');
          }
          
          // Visual feedback on the button
          emojiBtn.style.background = '#10b981';
          emojiBtn.style.color = 'white';
          setTimeout(() => {
            emojiBtn.style.background = 'transparent';
            emojiBtn.style.color = '';
          }, 500);
        }
      } else {
        this.showToast('Maximum 33 custom emojis reached!', 'info');
      }
    });

    // Hover effects
    emojiBtn.addEventListener('mouseenter', () => {
      emojiBtn.style.background = '#f3f4f6';
    });

    emojiBtn.addEventListener('mouseleave', () => {
      emojiBtn.style.background = 'transparent';
    });

    emojiGrid.appendChild(emojiBtn);
  });

  container.appendChild(instruction);
  container.appendChild(emojiGrid);
  return container;
}

  getCategoryIcon(category) {
    const icons = {
      'Custom': '⭐',
      'Smileys': '😊',
      'Gestures': '👋',
      'Animals': '🐶',
      'Food': '🍎',
      'Objects': '⌚',
      'Symbols': '❤️'
    };
    return icons[category] || '📦';
  }
  // Setup drag and drop functionality
  setupDragAndDrop(keyBox, position, container, textarea) {
    let longPressTimer;
    let isDragging = false;
    let dragStartPos = { x: 0, y: 0 };

    // Mouse down - start long press timer
    keyBox.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragStartPos = { x: e.clientX, y: e.clientY };
      
      longPressTimer = setTimeout(() => {
        this.startDrag(keyBox, position, e);
        isDragging = true;
      }, 300); // 300ms long press
    });

    // Mouse move - check if we should cancel long press due to movement
    keyBox.addEventListener('mousemove', (e) => {
      if (longPressTimer && !isDragging) {
        const distance = Math.sqrt(
          Math.pow(e.clientX - dragStartPos.x, 2) + 
          Math.pow(e.clientY - dragStartPos.y, 2)
        );
        
        // Cancel long press if mouse moved too much
        if (distance > 10) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    });

    // Mouse up - cancel long press or handle click
    keyBox.addEventListener('mouseup', (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      
      if (isDragging) {
        // Pass the actual mouse event to endDrag
        this.endDrag(container, textarea, e);
        isDragging = false;
      }
    });

    // Mouse leave - cancel long press
    keyBox.addEventListener('mouseleave', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    // Touch events for mobile
    keyBox.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      dragStartPos = { x: touch.clientX, y: touch.clientY };
      
      longPressTimer = setTimeout(() => {
        this.startDrag(keyBox, position, touch);
        isDragging = true;
      }, 300); // 300ms for touch too
    });

    keyBox.addEventListener('touchmove', (e) => {
      if (isDragging) {
        e.preventDefault();
        const touch = e.touches[0];
        this.updateDrag(touch);
      } else if (longPressTimer) {
        const touch = e.touches[0];
        const distance = Math.sqrt(
          Math.pow(touch.clientX - dragStartPos.x, 2) + 
          Math.pow(touch.clientY - dragStartPos.y, 2)
        );
        
        if (distance > 10) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    });

    keyBox.addEventListener('touchend', (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      
      if (isDragging) {
        e.preventDefault();
        // Pass the touch event to endDrag
        this.endDrag(container, textarea, e);
        isDragging = false;
      }
    });
  }

  // Start drag operation
  startDrag(element, fromPosition, event) {
    this.draggedElement = element;
    this.draggedIndex = fromPosition;
    
    // Store the original position and size for later restoration
    const rect = element.getBoundingClientRect();
    this.originalElementData = {
      parent: element.parentNode,
      nextSibling: element.nextSibling,
      position: element.style.position,
      left: element.style.left,
      top: element.style.top,
      zIndex: element.style.zIndex,
      width: rect.width,
      height: rect.height
    };
    
    // Create a placeholder in the original position
    const placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
    placeholder.style.cssText = `
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px dashed #f43e06;
      border-radius: 6px;
      background: rgba(244, 62, 6, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f43e06;
      font-size: 12px;
      font-weight: bold;
    `;
    placeholder.textContent = '↻';
    
    // Insert placeholder where the original element was
    element.parentNode.insertBefore(placeholder, element);
    this.dragPlaceholder = placeholder;
    
    // Move element to document body for free positioning
    document.body.appendChild(element);
    
    // Visual feedback for dragging - make it follow cursor
    element.classList.add('dragging');
    element.style.position = 'fixed';
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.style.opacity = '0.9';
    element.style.transform = 'scale(1.1) rotate(5deg)';
    element.style.zIndex = '10000';
    element.style.cursor = 'grabbing';
    element.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3)';
    element.style.pointerEvents = 'none';
    element.style.transition = 'none'; // Disable transitions during drag
    
    // Change cursor for the whole document
    document.body.style.cursor = 'grabbing';
    
    // Add global mouse/touch move handlers
    this.setupGlobalDragHandlers();
    
    // Show drop zones
    this.showDropZones();
    
    this.showMiniToast('Dragging emoji - follows your cursor!', 'info');
  }

  // Setup global drag handlers
  setupGlobalDragHandlers() {
    this.globalMouseMoveHandler = (e) => {
      if (this.draggedElement) {
        this.updateDrag(e);
      }
    };

    this.globalMouseUpHandler = (e) => {
      if (this.draggedElement) {
        // Pass the event to endDrag
        this.endDrag(document.getElementById('custom-emoji-keyboard'), this.currentTextarea, e);
      }
    };

    document.addEventListener('mousemove', this.globalMouseMoveHandler);
    document.addEventListener('mouseup', this.globalMouseUpHandler);
    document.addEventListener('touchmove', this.globalMouseMoveHandler, { passive: false });
    document.addEventListener('touchend', this.globalMouseUpHandler);
  }

  // Update drag position
  updateDrag(event) {
    if (!this.draggedElement) return;
    
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    
    // Store coordinates for later use
    this.lastMouseX = clientX;
    this.lastMouseY = clientY;
    
    // Move the emoji to follow the cursor
    if (this.draggedElement && this.originalElementData) {
      const offsetX = this.originalElementData.width / 2;
      const offsetY = this.originalElementData.height / 2;
      
      this.draggedElement.style.left = `${clientX - offsetX}px`;
      this.draggedElement.style.top = `${clientY - offsetY}px`;
    }
    
    // Highlight drop zones
    this.highlightDropZone(clientX, clientY);
  }

  // Show drop zones
  showDropZones() {
    const keyBoxes = document.querySelectorAll('#custom-emoji-keyboard > div > div');
    keyBoxes.forEach(box => {
      if (box !== this.draggedElement) {
        box.style.border = '2px dashed #f43e06';
        box.style.background = 'rgba(244, 62, 6, 0.1)';
      }
    });
  }

  // Highlight drop zone under cursor
  highlightDropZone(clientX, clientY) {
    const keyBoxes = document.querySelectorAll('#custom-emoji-keyboard > div > div');
    keyBoxes.forEach(box => {
      if (box !== this.draggedElement) {
        const rect = box.getBoundingClientRect();
        const isOver = clientX >= rect.left && clientX <= rect.right && 
                      clientY >= rect.top && clientY <= rect.bottom;
        
        if (isOver) {
          box.style.border = '2px solid #f43e06';
          box.style.background = 'rgba(244, 62, 6, 0.3)';
          box.style.transform = 'scale(1.05)';
        } else {
          box.style.border = '2px dashed #f43e06';
          box.style.background = 'rgba(244, 62, 6, 0.1)';
          box.style.transform = 'scale(1)';
        }
      }
    });
  }

    // Fixed endDrag function to show keyboard letters instead of positions

    // UPDATED: End drag operation with async save
    async endDrag(container, textarea, event) {
      if (!this.draggedElement) return;
      
      // Get coordinates from the actual drop event
      let dropX, dropY;
      if (event) {
        dropX = event.clientX || (event.changedTouches && event.changedTouches[0].clientX);
        dropY = event.clientY || (event.changedTouches && event.changedTouches[0].clientY);
      }
      
      // Fallback to stored coordinates if event doesn't have them
      if (!dropX || !dropY) {
        dropX = this.lastMouseX;
        dropY = this.lastMouseY;
      }
      
      // Get drop position using the coordinates from the actual drop event
      const dropPosition = this.getDropPosition(dropX, dropY);
      
      console.log(`Drag ended: from ${this.draggedIndex} to ${dropPosition} at (${dropX}, ${dropY})`);
      
      // Perform the swap if valid drop position
      if (dropPosition !== null && dropPosition !== this.draggedIndex) {
        this.swapEmojis(this.draggedIndex, dropPosition);
        await this.saveCustomEmojis(); // UPDATED: Added await
        
        // FIXED: Get the keyboard letters for the toast instead of numeric positions
        const fromLetter = this.getLetterAtPosition(this.draggedIndex);
        const toLetter = this.getLetterAtPosition(dropPosition);
        
        if (fromLetter && toLetter) {
          this.showMiniToast(`Emoji moved from "${fromLetter.toLowerCase()}" to "${toLetter.toLowerCase()}"!`, 'success');
        } else {
          // Fallback to position numbers if letters can't be found
          this.showMiniToast(`Emoji moved from position ${this.draggedIndex} to ${dropPosition}!`, 'success');
        }
      } else {
        this.showMiniToast('Drag cancelled - dropped on same position', 'info');
      }
      
      // Clean up
      this.cleanupDrag();
      
      // Re-render keyboard
      if (container && textarea) {
        this.renderKeyboardLayout(container, textarea);
      }
    }
  // Get drop position from cursor coordinates
  getDropPosition(mouseX, mouseY) {
    if (!mouseX || !mouseY) {
      console.log('No coordinates provided to getDropPosition');
      return null;
    }
    
    console.log(`Getting drop position for coordinates: (${mouseX}, ${mouseY})`);
    
    // Get all key boxes in the correct order
    const keyboardContainer = document.getElementById('custom-emoji-keyboard');
    if (!keyboardContainer) {
      console.log('Keyboard container not found');
      return null;
    }
    
    const rows = keyboardContainer.children;
    let position = 0;
    
    // Go through each row and each box in order
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const keyBoxes = row.children;
      
      for (let boxIndex = 0; boxIndex < keyBoxes.length; boxIndex++) {
        const box = keyBoxes[boxIndex];
        
        // Skip if this is the dragged element
        if (box === this.draggedElement) {
          position++;
          continue;
        }
        
        const rect = box.getBoundingClientRect();
        
        // Check if mouse is over this box
        if (mouseX >= rect.left && mouseX <= rect.right && 
            mouseY >= rect.top && mouseY <= rect.bottom) {
          console.log(`Found drop target at position ${position}, box bounds:`, rect);
          return position;
        }
        
        position++;
      }
    }
    
    console.log('No valid drop target found');
    return null;
  }

  // Swap emojis in the array
  swapEmojis(fromIndex, toIndex) {
    console.log(`Swapping emoji from ${fromIndex} to ${toIndex}`);
    console.log('Current emoji array:', this.emojiCategories.Custom);
    
    if (fromIndex < 0 || fromIndex >= this.emojiCategories.Custom.length) {
      console.log('Invalid fromIndex');
      return;
    }
    
    if (toIndex < 0 || toIndex >= 33) { // Max 33 keyboard positions
      console.log('Invalid toIndex - outside keyboard range');
      return;
    }
    
    // Get the emoji to move
    const emojiToMove = this.emojiCategories.Custom[fromIndex];
    
    if (toIndex >= this.emojiCategories.Custom.length) {
      // Moving to an empty position beyond current array
      console.log('Moving to empty position');
      
      // Remove from old position
      this.emojiCategories.Custom[fromIndex] = '';
      
      // Extend array if necessary and place emoji
      while (this.emojiCategories.Custom.length <= toIndex) {
        this.emojiCategories.Custom.push('');
      }
      this.emojiCategories.Custom[toIndex] = emojiToMove;
      
    } else {
      // Swapping with existing position (may be emoji or empty)
      console.log('Swapping with existing position');
      const targetEmoji = this.emojiCategories.Custom[toIndex] || '';
      
      // Perform the swap
      this.emojiCategories.Custom[fromIndex] = targetEmoji;
      this.emojiCategories.Custom[toIndex] = emojiToMove;
    }
    

    
    console.log('New emoji array:', this.emojiCategories.Custom);
  }

  // Clean up drag operation
  cleanupDrag() {
    if (this.draggedElement) {
      // Restore element to its original state and position
      if (this.originalElementData) {
        // Remove from body and restore to original position
        const parent = this.originalElementData.parent;
        const nextSibling = this.originalElementData.nextSibling;
        
        if (parent) {
          if (nextSibling) {
            parent.insertBefore(this.draggedElement, nextSibling);
          } else {
            parent.appendChild(this.draggedElement);
          }
        }
        
        // Restore original styles
        this.draggedElement.style.position = this.originalElementData.position;
        this.draggedElement.style.left = this.originalElementData.left;
        this.draggedElement.style.top = this.originalElementData.top;
        this.draggedElement.style.zIndex = this.originalElementData.zIndex;
        this.draggedElement.style.width = '';
        this.draggedElement.style.height = '';
      }
      
      // Reset all drag-related styles
      this.draggedElement.classList.remove('dragging');
      this.draggedElement.style.opacity = '';
      this.draggedElement.style.transform = '';
      this.draggedElement.style.cursor = '';
      this.draggedElement.style.boxShadow = '';
      this.draggedElement.style.pointerEvents = '';
      this.draggedElement.style.transition = '';
      
      this.draggedElement = null;
    }
    
    // Remove placeholder
    if (this.dragPlaceholder) {
      this.dragPlaceholder.remove();
      this.dragPlaceholder = null;
    }
    
    // Clear stored data
    this.originalElementData = null;
    this.draggedIndex = null;
    this.lastMouseX = null;
    this.lastMouseY = null;
    
    // Reset document cursor
    document.body.style.cursor = '';
    
    // Remove global handlers
    if (this.globalMouseMoveHandler) {
      document.removeEventListener('mousemove', this.globalMouseMoveHandler);
      document.removeEventListener('touchmove', this.globalMouseMoveHandler);
      this.globalMouseMoveHandler = null;
    }
    if (this.globalMouseUpHandler) {
      document.removeEventListener('mouseup', this.globalMouseUpHandler);
      document.removeEventListener('touchend', this.globalMouseUpHandler);
      this.globalMouseUpHandler = null;
    }
    
    // Reset all key box styles
    const keyBoxes = document.querySelectorAll('#custom-emoji-keyboard > div > div');
    keyBoxes.forEach(box => {
      box.style.border = '';
      box.style.background = '';
      box.style.transform = '';
    });
  }

insertEmoji(textarea, emoji) {
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);
  const textAfter = textarea.value.substring(textarea.selectionEnd);
  
  textarea.value = textBefore + emoji + textAfter;
  textarea.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
  
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Track this emoji as recently used FIRST
  this.addToRecentEmojis(emoji);
  
  // IMPORTANT: Always ensure focus returns to textarea AFTER recent emojis update
  textarea.focus();
  
  this.showMiniToast(`${emoji}`, 'success');
}
  closeEmojiPicker() {
      console.log('🔧 closeEmojiPicker called, current state:', this.isPickerOpen);
  if (!this.isPickerOpen) {
    console.log('🔧 Picker already closed, skipping animation');
    return;
  }
    console.log('🔧 Attempting to close emoji picker with Mac-style animation...');
    
    if (!this.isPickerOpen) {
      console.log('🔧 Picker already closed, skipping animation');
      return;
    }
    
    const picker = document.getElementById('maloum-emoji-picker');
    
    if (picker) {
      console.log('🎬 Starting Mac-style shrink animation...');
      
      // Find the emoji button to shrink toward
      const emojiButton = document.getElementById('maloum-emoji-btn');
      let targetX = window.innerWidth - 100;
      let targetY = 100;
      
      if (emojiButton) {
        const buttonRect = emojiButton.getBoundingClientRect();
        targetX = buttonRect.left + buttonRect.width / 2;
        targetY = buttonRect.top + buttonRect.height / 2;
        console.log(`🎯 Shrinking toward button at (${targetX}, ${targetY})`);
      }
      
      // Get current picker position
      const pickerRect = picker.getBoundingClientRect();
      const currentCenterX = pickerRect.left + pickerRect.width / 2;
      const currentCenterY = pickerRect.top + pickerRect.height / 2;
      
      // Calculate offset from current position to button
      const finalX = targetX - currentCenterX;
      const finalY = targetY - currentCenterY;
      
      // Disable interactions during animation
      picker.style.pointerEvents = 'none';
      
      // Apply Mac-style shrink animation
      picker.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease-out';
      picker.style.transformOrigin = 'center center';
      picker.style.transform = `translate(${finalX}px, ${finalY}px) scale(0.1)`;
      picker.style.opacity = '0';
      
      // Remove picker ESC handler
      if (picker.escHandler) {
        document.removeEventListener('keydown', picker.escHandler, true);
        picker.escHandler = null;
      }
      
      // Reset state immediately after starting animation
      this.isPickerOpen = false;
      
      // Remove after animation completes
      setTimeout(() => {
        if (picker && picker.parentNode) {
          picker.remove();
          console.log('✅ Picker removed after shrink animation');
        }
        this.performFallbackCleanup();
      }, 300);
      
    } else {
      console.log('🔧 No picker found, performing immediate cleanup');
      this.performFallbackCleanup();
      this.isPickerOpen = false;
    }
    
    // Clean up
    this.cleanupDrag();
    
    if (this.closeHandler) {
      document.removeEventListener('click', this.closeHandler, true);
      this.closeHandler = null;
    }
    
    this.currentTextarea = null;
    console.log('✅ Emoji picker state reset');

  // Tell global manager we're closed
  window.maloumUIManager.closeUI(this);

  }
  performFallbackCleanup() {
    console.log('🧹 Performing emoji picker fallback cleanup...');
    
    // Remove picker if still exists
    const picker = document.getElementById('maloum-emoji-picker');
    if (picker) {
      picker.remove();
      console.log('✅ Removed emoji picker in fallback cleanup');
    }
    
    // Remove any lingering handlers
    if (this.closeHandler) {
      document.removeEventListener('click', this.closeHandler, true);
      this.closeHandler = null;
    }
    
    // RESET STATE
    this.isPickerOpen = false;
    this.currentTextarea = null;
    
    console.log('✅ Emoji picker cleanup complete');
  }
  showMiniToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; 
      top: 80px; 
      right: 20px; 
      padding: 4px 8px;
      background: ${type === 'success' ? '#10b981' : type === 'info' ? '#3b82f6' : '#f59e0b'};
      color: white;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10002;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 1000);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; 
      top: 20px; 
      right: 20px; 
      padding: 8px 12px;
      background: ${type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      border-radius: 6px;
      font-size: 12px;
      z-index: 10001;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  async resetToDefaults() {
    console.log('🔄 Resetting custom emojis to defaults...');

    // Set default emojis - Adult dating platform focused
    this.emojiCategories.Custom = [
      // Row 1: Q W E R T Y U I O P [ ]
      '😘', '😍', '🥰', '😈', '🔥', '💋', '👅', '💦', '🍑', '🍆', '💯', '🎉',
      // Row 2: A S D F G H J K L ; '
      '❤️', '💕', '💖', '😏', '🤤', '👀', '😉', '🥵', '💪', '👑', '✨',
      // Row 3: Z X C V B N M , . /
      '🌹', '💐', '🍾', '🥂', '🎁', '💝', '💞', '😻', '🤗', '🙈'
    ];

    // Save to IndexedDB
    await this.saveCustomEmojis();

    console.log('✅ Custom emojis reset to default adult dating emojis (33 keys filled)');
    console.log('🔄 Please close and reopen the emoji picker to see changes');

    // If picker is open, refresh it
    if (this.isPickerOpen) {
      const textarea = this.currentTextarea;
      this.closeEmojiPicker();
      // Small delay to ensure cleanup
      setTimeout(() => {
        this.openEmojiPicker(textarea);
      }, 100);
    }

    return true;
  }

  destroy() {
    console.log('🧹 Destroying Emoji Manager instance...');

    // Remove keyboard handlers
    this.removeKeyboardShortcuts();
    
    // Remove unload handlers
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler);
      window.removeEventListener('unload', this.unloadHandler);
      this.unloadHandler = null;
    }
    
    // Close picker if open
    this.closeEmojiPicker();
    
    // Remove button
    const button = document.getElementById('maloum-emoji-btn');
    if (button) {
      button.remove();
    }
    
    // Clean up event handlers
    if (this.closeHandler) {
      document.removeEventListener('click', this.closeHandler);
      this.closeHandler = null;
    }
    
    if (this.globalMouseMoveHandler) {
      document.removeEventListener('mousemove', this.globalMouseMoveHandler);
      this.globalMouseMoveHandler = null;
    }
    
    if (this.globalMouseUpHandler) {
      document.removeEventListener('mouseup', this.globalMouseUpHandler);
      this.globalMouseUpHandler = null;
    }
    
    // Clear global reference
    if (window.maloumInstances && window.maloumInstances.emojiManager === this) {
      delete window.maloumInstances.emojiManager;
    }
    
    console.log('✅ Emoji Manager destroyed');
  }
}

// UPDATED: Initialize with singleton pattern
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    // Create new instance (will handle cleanup of old one automatically)
    window.maloumEmojiManager = new EmojiManager();
  });
} else {
  // Create new instance (will handle cleanup of old one automatically)
  window.maloumEmojiManager = new EmojiManager();
}

// Global helper function to reset emojis to defaults
window.resetEmojisToDefaults = async function() {
  if (window.maloumInstances && window.maloumInstances.emojiManager) {
    await window.maloumInstances.emojiManager.resetToDefaults();
    console.log('✅ Emojis have been reset! All 33 keyboard keys are now filled with adult dating emojis.');
  } else {
    console.error('❌ Emoji Manager not found. Please reload the page.');
  }
};