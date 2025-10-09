// ai-assist-manager.js - AI Assist Manager for Reply Suggestions
class MaloumAIAssistManager {
  constructor() {
    // Singleton pattern - prevent multiple instances
    if (window.maloumInstances && window.maloumInstances.aiAssistManager) {
      console.log('🤖 AI Assist Manager instance already exists, cleaning up old one...');
      window.maloumInstances.aiAssistManager.destroy();
    }
    
    // Initialize global instances registry
    window.maloumInstances = window.maloumInstances || {};
    window.maloumInstances.aiAssistManager = this;
    
    this.isAssistUIOpen = false;
    this.assistButton = null;
    this.conversationHistory = [];
    this.maxHistoryMessages = 10;
    this.domObserver = null;
    this.buttonCheckTimeout = null;
    this.keyboardHandler = null; // Track handler for cleanup
    this.unloadHandler = null; // Track unload handler
    
    console.log('🤖 AI Assist Manager initializing...');
    this.setupUnloadCleanup();
    this.initialize();
    this.registerWithGlobalUIManager();
    window.maloumUIManager.register(this, 'assist');
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
  initialize() {
    // Wait for DOM and other components to be ready
    setTimeout(() => {
      this.setupKeyboardShortcuts();
      this.addAssistButton();
      this.setupDOMMonitoring(); // Add DOM monitoring
    }, 1000);
  }

  setupDOMMonitoring() {
    // Monitor for DOM changes to re-add button when chat switches
    const observer = new MutationObserver((mutations) => {
      let shouldCheckButton = false;
      
      mutations.forEach((mutation) => {
        // Check if nodes were added/removed that might affect our button
        if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
          shouldCheckButton = true;
        }
      });
      
      if (shouldCheckButton) {
        // Debounce the button check to avoid too many calls
        clearTimeout(this.buttonCheckTimeout);
        this.buttonCheckTimeout = setTimeout(() => {
          this.ensureButtonExists();
        }, 500);
      }
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.domObserver = observer;
    console.log('🤖 DOM monitoring setup for button persistence');
  }

  ensureButtonExists() {
    // Check if our button still exists and is visible
    const existingButton = document.getElementById('maloum-ai-assist-btn');
    const promptButton = document.getElementById('maloum-prompt-button');
    
    if (promptButton && !existingButton) {
      console.log('🤖 Button missing after DOM change, re-adding...');
      this.addAssistButton();
    } else if (existingButton && !promptButton) {
      console.log('🤖 Prompt button gone, removing AI assist button...');
      existingButton.remove();
    }
  }

  setupKeyboardShortcuts() {
    console.log('🎹 Setting up AI Assist keyboard shortcuts...');
    
    // Remove any existing listeners FIRST
    this.removeKeyboardShortcuts();
    
    this.keyboardHandler = (e) => {
      // Alt + O shortcut for AI Assist
      if (e.altKey && e.key.toLowerCase() === 'o' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        console.log('🤖 AI Assist shortcut triggered (Alt+O)');
        this.toggleAssistUI();
      }

      // Escape key to close AI Assist UI
      if (e.key === 'Escape' && this.isAssistUIOpen) {
        e.preventDefault();
        this.closeAssistUI();
      }

      // Number key shortcuts (1, 2, 3) to select reply suggestions
      if (this.isAssistUIOpen && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= 3) {
          e.preventDefault();
          this.selectSuggestionByNumber(keyNum);
        }
      }
    };
    
    document.addEventListener('keydown', this.keyboardHandler, true);
    console.log('✅ AI Assist keyboard shortcuts setup complete');
  }
  setupUnloadCleanup() {
    this.unloadHandler = () => {
      console.log('🧹 Page unloading, cleaning up AI Assist Manager...');
      this.destroy();
    };
    
    window.addEventListener('beforeunload', this.unloadHandler);
    window.addEventListener('unload', this.unloadHandler);
  }

  removeKeyboardShortcuts() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, true);
      console.log('🧹 Removed AI Assist keyboard handler');
      this.keyboardHandler = null;
    }
  }
  addAssistButton() {
    // Find the prompt manager button to position next to it
    const promptButton = document.getElementById('maloum-prompt-button');
    
    if (!promptButton) {
      setTimeout(() => this.addAssistButton(), 1000);
      return;
    }

    // Remove existing AI Assist button if it exists
    const existingButton = document.getElementById('maloum-ai-assist-btn');
    if (existingButton) {
      existingButton.remove();
      console.log('🤖 Removed existing AI Assist button');
    }

    // Create AI Assist button
    this.assistButton = document.createElement('button');
    this.assistButton.id = 'maloum-ai-assist-btn';
    this.assistButton.innerHTML = '🤖';
    this.assistButton.title = 'AI Assist - Reply Suggestions (Alt+O)';
    
    // UPDATED: Warm theme styling matching prompt manager
    this.assistButton.style.cssText = `
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f43e06 0%, #FADA7A 100%);
      border: 3px solid white;
      color: white;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 
        0 4px 12px rgba(244, 62, 6, 0.3),
        0 0 20px rgba(250, 218, 122, 0.4);
      flex-shrink: 0;
      pointer-events: auto;
      font-weight: bold;
      z-index: 1000;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    `;

    // UPDATED: Warm theme hover effects
    this.assistButton.addEventListener('mouseenter', () => {
      this.assistButton.style.transform = 'scale(1.9) rotate(5deg)';
      this.assistButton.style.boxShadow = `
        0 6px 20px rgba(244, 62, 6, 0.4),
        0 0 30px rgba(250, 218, 122, 0.6)
      `;
    });

    this.assistButton.addEventListener('mouseleave', () => {
      this.assistButton.style.transform = 'scale(1) rotate(0deg)';
      this.assistButton.style.boxShadow = `
        0 4px 12px rgba(244, 62, 6, 0.3),
        0 0 20px rgba(250, 218, 122, 0.4)
      `;
    });

    // Add click handler
    this.assistButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleAssistUI();
    });

    try {
      // Since prompt button uses absolute positioning, we need to do the same
      const promptButtonParent = promptButton.parentNode;
      
      // Position AI Assist button next to prompt button using absolute positioning
      this.assistButton.style.position = 'absolute';
      this.assistButton.style.top = '-8px';
      this.assistButton.style.right = '20px'; // Position to the left of prompt button
      this.assistButton.style.zIndex = '1000';
      this.assistButton.style.margin = '0'; // Remove margin since we're using absolute positioning
      
      // Add to the same parent as prompt button
      promptButtonParent.appendChild(this.assistButton);
      
    } catch (error) {
      console.error('🤖 Error inserting button:', error);
    }
  }

  toggleAssistUI() {
    if (this.isAssistUIOpen) {
      this.closeAssistUI();
    } else {
      this.openAssistUI();
    }
  }

  async openAssistUI() {
    if (this.isAssistUIOpen || document.getElementById('maloum-assist-float')) {
      return;
    }

    // NEW: Check if Prompt UI is open and prevent opening
    if (window.maloumInstances?.promptManager?.isPromptUIOpen) {
      console.log('🔧 Prompt UI is open, cannot open AI Assist');
      this.showErrorToast('Please close Prompt Manager first');
      return;
    }

    // Tell global manager we're opening
    window.maloumUIManager.openUI(this, 'assist');

    console.log('🤖 Opening AI Assist UI as floating window...');
    this.isAssistUIOpen = true;

    try {
      // First, read current conversation
      await this.readConversationHistory();

      // SAFETY CHECK: Ensure document.body exists
      if (!document.body) {
        console.error('🤖 Error: document.body is null');
        this.isAssistUIOpen = false;
        return;
      }

      // Create compact floating window
      const floatingWindow = document.createElement('div');
      floatingWindow.id = 'maloum-assist-float';
      floatingWindow.style.cssText = `
        position: fixed;
        top: 50%;
        right: -320px;
        width: 400px;
        height: 450px;
        background: white;
        z-index: 10000;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        border-radius: 12px;
        border: 2px solid #FCE7C8;
        transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transform: translateY(-50%);
        overflow: hidden;
      `;

      // Compact header
      const header = document.createElement('div');
      header.style.cssText = `
        background: linear-gradient(135deg, #f43e06 0%, #FADA7A 100%);
        padding: 12px 15px;
        color: white;
        position: relative;
        flex-shrink: 0;
      `;

      // Close button (top-right corner)
      const closeButton = document.createElement('div');
      closeButton.innerHTML = '×';
      closeButton.title = 'Close AI Assist (ESC)';
      closeButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 10px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 16px;
        font-weight: bold;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 10001;
        user-select: none;
      `;

      // SAFE close button functionality
      const safeCloseHandler = (e) => {
        e && e.preventDefault && e.preventDefault();
        e && e.stopPropagation && e.stopPropagation();
        console.log('🤖 Close button clicked!');
        this.closeAssistUI();
      };

      closeButton.addEventListener('click', safeCloseHandler);
      closeButton.addEventListener('mouseenter', () => {
        closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
        closeButton.style.transform = 'scale(1.1)';
      });
      closeButton.addEventListener('mouseleave', () => {
        closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
        closeButton.style.transform = 'scale(1)';
      });

      // Compact title
      const title = document.createElement('h3');
      title.textContent = 'AI Assist';
      title.style.cssText = `
        color: white;
        font-size: 18px;
        font-weight: 700;
        margin: 0 25px 3px 0;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      `;

      const subtitle = document.createElement('p');
      subtitle.textContent = 'Smart reply suggestions';
      subtitle.style.cssText = `
        margin: 0 25px 0 0;
        font-size: 11px;
        opacity: 0.9;
        font-weight: 400;
      `;

      // SAFE DOM ASSEMBLY
      try {
        header.appendChild(closeButton);
        header.appendChild(title);
        header.appendChild(subtitle);
      } catch (headerError) {
        console.error('🤖 Error building header:', headerError);
        this.isAssistUIOpen = false;
        return;
      }

      // Scrollable content area
      const content = document.createElement('div');
      content.id = 'maloum-assist-content';
      content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 15px;
        background: white;
      `;
      
      // Show loading state
      content.innerHTML = `
        <div style="text-align: center; padding: 20px 5px; color: #6b7280;">
          <div style="font-size: 24px; margin-bottom: 8px;">🤖</div>
          <div style="font-size: 13px; margin-bottom: 4px; color: #1f2937;">Analyzing...</div>
          <div style="font-size: 11px; opacity: 0.7;">Generating suggestions</div>
        </div>
      `;

      // SAFE FINAL ASSEMBLY
      try {
        floatingWindow.appendChild(header);
        floatingWindow.appendChild(content);
        
        // CRITICAL SAFETY CHECK before appendChild
        if (document.body && typeof document.body.appendChild === 'function') {
          document.body.appendChild(floatingWindow);
          console.log('🤖 Floating window added to DOM successfully');
        } else {
          throw new Error('document.body is not available or appendChild is not a function');
        }
      } catch (assemblyError) {
        console.error('🤖 Error assembling floating window:', assemblyError);
        this.isAssistUIOpen = false;
        return;
      }

      // Animate slide in from right (smaller distance)
      setTimeout(() => {
        if (document.getElementById('maloum-assist-float')) {
          floatingWindow.style.right = '20px';
        }
      }, 100);

      // Generate suggestions after UI is shown
      setTimeout(() => {
        if (document.getElementById('maloum-assist-float')) {
          this.generateSuggestions(content);
        }
      }, 600);

      // ESC key to close
      const escHandler = (e) => {
        if (e.key === 'Escape' && this.isAssistUIOpen) {
          e.preventDefault();
          this.closeAssistUI();
        }
      };
      
      // Store handler for cleanup
      floatingWindow.escHandler = escHandler;
      document.addEventListener('keydown', escHandler);

    } catch (mainError) {
      console.error('🤖 Critical error in openAssistUI:', mainError);
      this.isAssistUIOpen = false;
      
      // Cleanup any partial elements
      const existingFloat = document.getElementById('maloum-assist-float');
      if (existingFloat && existingFloat.parentNode) {
        existingFloat.parentNode.removeChild(existingFloat);
      }
    }
  }
  selectSuggestionByNumber(number) {
    try {
      console.log(`🤖 Selecting suggestion ${number} via keyboard shortcut`);
      
      const suggestionCards = document.querySelectorAll('.suggestion-card');
      
      if (suggestionCards.length >= number) {
        const targetCard = suggestionCards[number - 1];
        const suggestionText = targetCard.getAttribute('data-suggestion');
        
        if (suggestionText) {
          this.highlightSelectedCard(targetCard);
          this.insertSuggestion(suggestionText);
          console.log(`🤖 Successfully selected suggestion ${number}: "${suggestionText}"`);
        }
      } else {
        console.log(`🤖 Only ${suggestionCards.length} suggestions available, cannot select option ${number}`);
      }
    } catch (error) {
      console.error('🤖 Error selecting suggestion by number:', error);
    }
  }
  highlightSelectedCard(card) {
    if (!card) return;
    
    const originalBorder = card.style.borderColor;
    const originalBackground = card.style.background;
    const originalTransform = card.style.transform;
    
    // Apply highlight effect
    card.style.borderColor = '#f43e06';
    card.style.background = 'linear-gradient(135deg, #f43e06 0%, #FADA7A 100%)';
    card.style.transform = 'scale(1.02)';
    card.style.transition = 'all 0.15s ease';
    
    const pressLabel = card.querySelector('div:first-child');
    const suggestionText = card.querySelector('div:last-child');
    
    if (pressLabel) {
      pressLabel.style.color = 'white';
      pressLabel.style.fontWeight = '700';
    }
    if (suggestionText) {
      suggestionText.style.color = 'rgba(255, 255, 255, 0.95)';
    }
    
    // Reset after animation
    setTimeout(() => {
      card.style.borderColor = originalBorder;
      card.style.background = originalBackground;
      card.style.transform = originalTransform;
      
      if (pressLabel) {
        pressLabel.style.color = '#f43e06';
        pressLabel.style.fontWeight = '600';
      }
      if (suggestionText) {
        suggestionText.style.color = '#1f2937';
      }
    }, 200);
  }
  closeAssistUI() {
    console.log('🤖 Closing AI Assist floating window...');
    
    try {
      const floatingWindow = document.getElementById('maloum-assist-float');
      if (floatingWindow) {
        console.log('🤖 Found floating window, sliding out...');
        
        // Slide out animation
        floatingWindow.style.right = '-320px';
        
        // Remove window after animation
        setTimeout(() => {
          try {
            if (floatingWindow && floatingWindow.parentNode) {
              // Remove ESC key handler
              if (floatingWindow.escHandler) {
                document.removeEventListener('keydown', floatingWindow.escHandler);
              }
              floatingWindow.remove();
              console.log('🤖 Floating window removed successfully');
            }
          } catch (removeError) {
            console.error('🤖 Error removing floating window:', removeError);
            // Force removal
            const existingFloat = document.getElementById('maloum-assist-float');
            if (existingFloat && existingFloat.parentNode) {
              existingFloat.parentNode.removeChild(existingFloat);
            }
          }
        }, 450);
        
      } else {
        console.log('🤖 No floating window found to remove');
      }
      
      // Reset the state
      this.isAssistUIOpen = false;
      console.log('🤖 AI Assist UI state reset to closed');
      
    } catch (error) {
      console.error('🤖 Error closing AI Assist UI:', error);
      this.isAssistUIOpen = false;
      
      // Force cleanup
      try {
        const existingFloat = document.getElementById('maloum-assist-float');
        if (existingFloat && existingFloat.parentNode) {
          existingFloat.parentNode.removeChild(existingFloat);
        }
      } catch (forceError) {
        console.error('🤖 Force cleanup also failed:', forceError);
      }
    }

    // Tell global manager we're closed
    window.maloumUIManager.closeUI(this);
  }
async readConversationHistory() {
  try {
    console.log('🤖 Reading conversation history...');
    
    // FIXED: Use the correct container that has flex-col-reverse
    const messagesContainer = document.querySelector('.flex.flex-col-reverse.pt-8');
    
    if (!messagesContainer) {
      console.log('🤖 Messages container not found');
      this.conversationHistory = [];
      return;
    }
    
    // Get direct children (message containers)
    const messageContainers = messagesContainer.children;
    console.log(`🤖 Found ${messageContainers.length} message containers in flex-col-reverse`);
    
    this.conversationHistory = [];
    const allMessages = [];
    
    // IMPORTANT: Because of flex-col-reverse, index 0 = newest, higher index = older
    Array.from(messageContainers).forEach((container, index) => {
      try {
        // Look for .notranslate span
        const textElement = container.querySelector('span.notranslate');
        
        if (textElement && textElement.textContent) {
          const messageText = textElement.textContent.trim();
          
          if (messageText && messageText.length > 0) {
            const isUserMessage = this.detectUserMessage(container);
            
            allMessages.push({
              id: index,
              text: messageText,
              isUser: isUserMessage,
              domIndex: index, // Lower index = newer message in flex-col-reverse
              timestamp: { 
                raw: `msg-${index}`, 
                // FIXED: Reverse timestamp so lower index = newer time
                parsed: new Date(Date.now() - index) 
              }
            });
            
            console.log(`🤖 Message ${index} (${index === 0 ? 'NEWEST' : index === messageContainers.length-1 ? 'OLDEST' : 'MIDDLE'}): ${isUserMessage ? 'SENT' : 'RECEIVED'} - "${messageText}"`);
          }
        }
      } catch (msgError) {
        console.warn('🤖 Error processing message:', msgError);
      }
    });

    // FIXED: Sort by domIndex ASC because lower index = newer in flex-col-reverse
    // But we want chronological order (oldest first), so we need to reverse
    allMessages.sort((a, b) => b.domIndex - a.domIndex); // Reverse sort
    
    // Limit to last 10 sent + 10 received messages
    const userMessages = allMessages.filter(msg => msg.isUser).slice(-10);
    const theirMessages = allMessages.filter(msg => !msg.isUser).slice(-10);
    
    // Combine and maintain chronological order
    const limitedMessages = [...userMessages, ...theirMessages]
      .sort((a, b) => b.domIndex - a.domIndex); // Keep reverse sort for chronological
    
    this.conversationHistory = limitedMessages;
    
    console.log(`🤖 Limited conversation history: ${this.conversationHistory.length} messages (max 20)`);
    
    // Debug final conversation
    console.log('🤖 FINAL CONVERSATION ORDER (chronological - oldest to newest):');
    this.conversationHistory.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. ${msg.isUser ? 'Me' : 'Them'} [DOM:${msg.domIndex}]: "${msg.text}"`);
    });
    
    if (this.conversationHistory.length > 0) {
      // Latest message is last in chronologically sorted array
      const latestMessage = this.conversationHistory[this.conversationHistory.length - 1];
      console.log(`🤖 LATEST MESSAGE (${latestMessage.isUser ? 'SENT' : 'RECEIVED'}) [DOM:${latestMessage.domIndex}]: "${latestMessage.text}"`);
    }
    
  } catch (error) {
    console.error('🤖 Error reading conversation:', error);
    this.conversationHistory = [];
  }
}

  // NEW: Read and parse the note section for personal information
  readPersonalNotes() {
    try {
      console.log('📝 Reading personal notes...');
      
      // Strategy 1: Look for "Note about" pattern and get the text after it
      const noteHeaders = document.querySelectorAll('p.font-semibold');
      let noteElement = null;
      
      for (const header of noteHeaders) {
        const headerText = header.textContent || '';
        console.log('📝 Found header:', headerText);
        
        if (headerText.toLowerCase().includes('note about')) {
          console.log('📝 Found "Note about" header, looking for following element');
          
          // Look for the next p.whitespace-pre-wrap element after this header
          let nextElement = header.nextElementSibling;
          while (nextElement) {
            if (nextElement.classList.contains('whitespace-pre-wrap') && nextElement.classList.contains('break-words')) {
              noteElement = nextElement;
              console.log('📝 Found note element after "Note about" header');
              break;
            }
            nextElement = nextElement.nextElementSibling;
          }
          
          if (noteElement) break;
        }
      }
      
      // Strategy 2: If not found, look for elements with note-like content patterns
      if (!noteElement) {
        console.log('📝 "Note about" strategy failed, trying content-based detection');
        
        const allNoteElements = document.querySelectorAll('p.whitespace-pre-wrap.break-words');
        let bestScore = 0;
        
        for (const element of allNoteElements) {
          const text = element.textContent || '';
          console.log('📝 Checking element text:', text);
          
          let score = 0;
          
          // Score based on note-like patterns
          if (text.toLowerCase().includes('call sign') || text.toLowerCase().includes('callsign')) score += 10;
          if (text.toLowerCase().includes('age:')) score += 5;
          if (text.toLowerCase().includes('work:')) score += 5;
          if (text.toLowerCase().includes('hobby') || text.toLowerCase().includes('hobbies')) score += 5;
          if (text.toLowerCase().includes('name:')) score += 3;
          if (text.includes(':')) score += 2; // General colon pattern
          if (text.includes('\n')) score += 1; // Multi-line content
          
          // Penalize if it's just a name/nickname without colons
          if (!text.includes(':') && text.length < 50) score -= 5;
          
          console.log(`📝 Element scored ${score} points`);
          
          if (score > bestScore && score > 0) {
            bestScore = score;
            noteElement = element;
            console.log('📝 New best element found with score:', score);
          }
        }
      }
      
      if (!noteElement) {
        console.log('📝 No suitable note element found');
        return this.getEmptyNotesStructure();
      }
      
      const noteText = noteElement.textContent || '';
      console.log('📝 Final selected note text:', noteText);
      console.log('📝 Note text length:', noteText.length);
      
      if (noteText.trim().length === 0) {
        console.log('📝 Note text is empty');
        return this.getEmptyNotesStructure();
      }
      
      const parsedNotes = this.parsePersonalNotes(noteText);
      console.log('📝 Parsed notes result:', parsedNotes);
      
      return parsedNotes;
      
    } catch (error) {
      console.warn('📝 Error reading personal notes:', error);
      return this.getEmptyNotesStructure();
    }
  }

  // NEW: Parse the note text to extract structured information
  parsePersonalNotes(noteText) {
    const notes = {
      realName: null,
      nickname: null,
      callSign: null,
      work: null,
      hobbies: [],
      location: null,
      age: null,
      other: [],
      rawText: noteText
    };

    if (!noteText || noteText.trim().length === 0) {
      console.log('📝 Empty note text provided to parser');
      return notes;
    }

    console.log('📝 Parsing note text:', noteText);
    
    // Split by lines and also try to split by common separators
    const lines = noteText.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);
    console.log('📝 Split into lines:', lines);
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      console.log('📝 Processing line:', line);
      
      // Extract real name
      if (lowerLine.includes('name:') || lowerLine.includes('real name:')) {
        notes.realName = this.extractValue(line);
        console.log('📝 Found real name:', notes.realName);
      }
      // Extract nickname
      else if (lowerLine.includes('nickname:') || lowerLine.includes('nick:')) {
        notes.nickname = this.extractValue(line);
        console.log('📝 Found nickname:', notes.nickname);
      }
      // Extract call sign (highest priority) - check multiple variations
      else if (lowerLine.includes('callsign:') || lowerLine.includes('call sign:') || lowerLine.includes('call-sign:') || lowerLine.includes('callsign ')) {
        notes.callSign = this.extractValue(line);
        console.log('📝 Found call sign:', notes.callSign);
      }
      // Extract work information
      else if (lowerLine.includes('work:') || lowerLine.includes('job:') || lowerLine.includes('career:')) {
        notes.work = this.extractValue(line);
        console.log('📝 Found work:', notes.work);
      }
      // Extract hobbies
      else if (lowerLine.includes('hobbies:') || lowerLine.includes('interests:') || lowerLine.includes('likes:')) {
        const hobbiesText = this.extractValue(line);
        if (hobbiesText) {
          notes.hobbies = hobbiesText.split(',').map(h => h.trim()).filter(h => h.length > 0);
          console.log('📝 Found hobbies:', notes.hobbies);
        }
      }
      // Extract location
      else if (lowerLine.includes('location:') || lowerLine.includes('city:') || lowerLine.includes('from:')) {
        notes.location = this.extractValue(line);
        console.log('📝 Found location:', notes.location);
      }
      // Extract age
      else if (lowerLine.includes('age:') || lowerLine.includes('years old:')) {
        notes.age = this.extractValue(line);
        console.log('📝 Found age:', notes.age);
      }
      // Everything else goes to other
      else {
        notes.other.push(line);
        console.log('📝 Added to other:', line);
      }
    }

    console.log('📝 Final parsed notes:', notes);
    return notes;
  }

  // NEW: Extract value after colon in note lines
  extractValue(line) {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1 && colonIndex < line.length - 1) {
      return line.substring(colonIndex + 1).trim();
    }
    return null;
  }

  // NEW: Get empty notes structure
  getEmptyNotesStructure() {
    return {
      realName: null,
      nickname: null,
      callSign: null,
      work: null,
      hobbies: [],
      location: null,
      age: null,
      other: [],
      rawText: ''
    };
  }

  // NEW: Determine preferred name to use (call sign > nickname > real name)
  getPreferredName(notes) {
    if (notes.callSign) {
      return { name: notes.callSign, type: 'call-sign' };
    } else if (notes.nickname) {
      return { name: notes.nickname, type: 'nickname' };
    } else if (notes.realName) {
      return { name: notes.realName, type: 'real-name' };
    }
    return null;
  }

  extractTimestamp(container) {
    try {
      // Look for timestamp elements with multiple selectors
      const timeSelectors = [
        'time',
        '[datetime]',
        '.timestamp',
        '.time',
        '.message-time',
        '[data-time]',
        '.text-gray-400', // Maloum-specific timestamp class
        '.text-xs.text-gray-400' // More specific Maloum timestamp
      ];
      
      for (const selector of timeSelectors) {
        const timeElement = container.querySelector(selector);
        if (timeElement) {
          const timeText = timeElement.textContent || timeElement.getAttribute('datetime') || timeElement.getAttribute('data-time');
          if (timeText && timeText.trim()) {
            // Parse Maloum timestamp format: "DD/MM/YY HH:MM"
            const match = timeText.trim().match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
            if (match) {
              const [, day, month, year, hour, minute] = match;
              // Create Date object (year + 2000 to convert YY to YYYY)
              const parsedDate = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
              
              console.log(`🤖 Parsed timestamp: "${timeText}" -> ${parsedDate.toISOString()}`);
              
              return {
                raw: timeText.trim(),
                parsed: parsedDate.getTime()
              };
            }
            
            // Fallback: try to parse as general date
            const fallbackDate = new Date(timeText.trim());
            if (!isNaN(fallbackDate.getTime())) {
              return {
                raw: timeText.trim(),
                parsed: fallbackDate.getTime()
              };
            }
          }
        }
      }
      
      // Fallback: use current time if no timestamp found
      console.log(`🤖 No timestamp found for message, using current time`);
      return {
        raw: 'no timestamp',
        parsed: Date.now()
      };
    } catch (error) {
      console.warn('🤖 Error parsing timestamp:', error);
      return {
        raw: 'error',
        parsed: Date.now()
      };
    }
  }

  extractMessageText(element) {
    // FIXED: Extract text from Maloum's specific structure
    const textElement = element.querySelector('span.notranslate');
    
    if (textElement && textElement.textContent) {
      return textElement.textContent.trim();
    }

    // Fallback: try to get any text content
    return element.textContent?.replace(/[\r\n\t]+/g, ' ').trim() || '';
  }

detectUserMessage(container) {
  // Look for the message bubble inside the container
  const messageBubble = container.querySelector('div[class*="max-w-[70%]"]');
  
  if (messageBubble) {
    const classString = messageBubble.className;
    
    // Check for background color
    if (classString.includes('bg-beige-400')) {
      return true; // Sent messages (beige background)
    } else if (classString.includes('bg-gray-100')) {
      return false; // Received messages (gray background)
    }
  }
  
  // Fallback
  return false;
}

  // Helper function to calculate time difference and provide time context
  getTimeContext(lastMessageTimestamp) {
    const now = Date.now();
    const timeDiff = now - lastMessageTimestamp;
    
    // Convert to different time units
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    
    // Determine appropriate time context for reply with more granular detection
    if (minutes < 1) {
      return { 
        context: "immediate", 
        description: "just received",
        conversationType: "ongoing",
        timeGap: "none"
      };
    } else if (minutes < 15) {
      return { 
        context: "very_recent", 
        description: `${minutes} minute${minutes > 1 ? 's' : ''} ago`,
        conversationType: "ongoing",
        timeGap: "minimal"
      };
    } else if (minutes < 60) {
      return { 
        context: "recent", 
        description: `${minutes} minutes ago`,
        conversationType: "ongoing",
        timeGap: "short"
      };
    } else if (hours < 3) {
      return { 
        context: "few_hours", 
        description: `${hours} hour${hours > 1 ? 's' : ''} ago`,
        conversationType: "ongoing",
        timeGap: "moderate"
      };
    } else if (hours < 12) {
      return { 
        context: "several_hours", 
        description: `${hours} hours ago`,
        conversationType: "revival_needed",
        timeGap: "significant"
      };
    } else if (days === 1) {
      return { 
        context: "yesterday", 
        description: "yesterday",
        conversationType: "revival_needed",
        timeGap: "daily"
      };
    } else if (days < 3) {
      return { 
        context: "few_days", 
        description: `${days} days ago`,
        conversationType: "revival_needed",
        timeGap: "multi_day"
      };
    } else if (weeks === 1) {
      return { 
        context: "week_old", 
        description: "about a week ago",
        conversationType: "conversation_restart",
        timeGap: "weekly"
      };
    } else if (weeks < 4) {
      return { 
        context: "weeks_old", 
        description: `${weeks} weeks ago`,
        conversationType: "conversation_restart",
        timeGap: "multiple_weeks"
      };
    } else {
      return { 
        context: "very_old", 
        description: "over a month ago",
        conversationType: "fresh_start",
        timeGap: "extended"
      };
    }
  }

  // Helper function to get current time of day for contextual suggestions
  getCurrentTimeContext() {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      return "morning";
    } else if (hour >= 12 && hour < 17) {
      return "afternoon";
    } else if (hour >= 17 && hour < 22) {
      return "evening";
    } else {
      return "night";
    }
  }

getGermanTimeContext() {
  const germanTime = new Date().toLocaleString("en-US", {
    timeZone: "Europe/Berlin",
    hour12: false
  });
  
  const hour = new Date(germanTime).getHours();
  const isWeekend = new Date(germanTime).getDay() === 0 || new Date(germanTime).getDay() === 6;
  
  let period, greeting;
  
  if (hour >= 5 && hour < 12) {
    period = 'morning'; greeting = 'Good morning';
  } else if (hour >= 12 && hour < 18) {
    period = 'afternoon'; greeting = 'Hi';
  } else if (hour >= 18 && hour < 23) {
    period = 'evening'; greeting = 'Hey';
  } else {
    period = 'night'; greeting = 'Hey';
  }
  
  return { hour, period, greeting, isWeekend };
}


  async generateSuggestions(contentElement) {
    try {
      console.log('🤖 Generating AI reply suggestions...');

      if (this.conversationHistory.length === 0) {
        contentElement.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #ef4444;">
            <div style="font-size: 32px; margin-bottom: 16px;">💬</div>
            <div style="font-size: 16px; margin-bottom: 8px;">No conversation detected</div>
            <div style="font-size: 14px; opacity: 0.7;">Start a conversation to get AI reply suggestions</div>
          </div>
        `;
        return;
      }

      // FIXED: Only find the latest RECEIVED message (from them)
      const receivedMessages = this.conversationHistory.filter(msg => !msg.isUser);
      
      if (receivedMessages.length === 0) {
        contentElement.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #6b7280;">
            <div style="font-size: 32px; margin-bottom: 16px;">📤</div>
            <div style="font-size: 16px; margin-bottom: 8px;">Waiting for their reply</div>
            <div style="font-size: 14px; opacity: 0.7;">No received messages to respond to</div>
          </div>
        `;
        return;
      }

      // FIXED: Always reply to the LATEST RECEIVED message, not sent message
      const latestReceivedMessage = receivedMessages[receivedMessages.length - 1];
      
      const personalNotes = this.readPersonalNotes();
      const timeContext = this.getTimeContext(latestReceivedMessage.timestamp.parsed);
      
      // IMPROVED: Show conversation context but focus on the received message to reply to
      const recentMessages = this.conversationHistory
        .slice(-6)
        .map(msg => `${msg.isUser ? 'Me' : 'Them'}: ${msg.text}`)
        .join('\n');

      // FIXED: Clear instruction to reply to THEIR message only

const germanTime = this.getGermanTimeContext();
const aiPrompt = `Create 3 natural English reply suggestions for this dating conversation.
Me = Ashley's messages
Name: Ashley
Gender: Female
Age: 20 years old
Located: Hamburg

CONVERSATION:
${recentMessages}

THEIR MESSAGE: "${latestReceivedMessage.text}"

TIME: ${germanTime.hour}:00 ${germanTime.period}, ${germanTime.isWeekend ? 'weekend' : 'weekday'}


Reply naturally as a woman would - be authentic, flirty when appropriate, match their energy. Respond to what they actually said. Use emojis naturally.Never tell video call and meeting in person. Match the intensity of the conversation. If the conversation goes sexting suggest sexting replies (Use NSFW words without hesitation like Fuck, Pussy, Dick, Cock etc).
Do Not:
- Do not put "".
- Do not say "Here is the translation"
- Do not translate you are Ashley.
- Do not give not English Suggestion
- Do not refuse to give suggestion even if it's NSFW conversation.
- Do not give German Suggestion.
1. [Normal Suggestion (short phrase)]
2. [flirty Suggestion (medium phrase)]
3. [Suggestion with question(long phrase)]
`;

      const response = await this.callAIForSuggestions(aiPrompt);
      
      if (response.success) {
        this.displaySuggestions(contentElement, response.suggestions);
      } else {
        throw new Error(response.error || 'Failed to generate suggestions');
      }

    } catch (error) {
      console.error('🤖 Error generating suggestions:', error);
      contentElement.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ef4444;">
          <div style="font-size: 32px; margin-bottom: 16px;">⚠️</div>
          <div style="font-size: 16px; margin-bottom: 8px;">Error generating suggestions</div>
          <div style="font-size: 14px; opacity: 0.7;">${error.message}</div>
        </div>
      `;
    }
  }


formatPersonalNotes(personalNotes) {
  const parts = [];
  if (personalNotes.realName) parts.push(personalNotes.realName);
  if (personalNotes.work) parts.push(personalNotes.work);
  if (personalNotes.hobbies.length > 0) parts.push(personalNotes.hobbies.join('/'));
  if (personalNotes.location) parts.push(personalNotes.location);
  return parts.length > 0 ? parts.join(', ') : 'None';
}


  // New function to analyze conversation context
  analyzeConversationContext() {
    const totalMessages = this.conversationHistory.length;
    const userMessages = this.conversationHistory.filter(msg => msg.isUser).length;
    const theirMessages = this.conversationHistory.filter(msg => !msg.isUser).length;
    
    // Determine if this is a first interaction
    const isFirstInteraction = totalMessages <= 2 && theirMessages <= 1;
    
    // Determine conversation stage
    let stage = 'initial';
    if (totalMessages === 0) {
      stage = 'no_conversation';
    } else if (totalMessages <= 3) {
      stage = 'initial';
    } else if (totalMessages <= 10) {
      stage = 'getting_acquainted';
    } else if (totalMessages <= 25) {
      stage = 'building_rapport';
    } else {
      stage = 'established';
    }
    
    // Determine familiarity level
    let familiarity = 'strangers';
    if (totalMessages === 0) {
      familiarity = 'no_contact';
    } else if (totalMessages <= 2) {
      familiarity = 'strangers';
    } else if (totalMessages <= 8) {
      familiarity = 'acquaintances';
    } else if (totalMessages <= 20) {
      familiarity = 'getting_to_know';
    } else {
      familiarity = 'familiar';
    }
    
    // Extract topics mentioned in conversation
    const topics = [];
    const conversationText = this.conversationHistory.map(msg => msg.text.toLowerCase()).join(' ');
    
    // Common topic keywords to detect
    const topicKeywords = {
      'work': ['work', 'job', 'office', 'career', 'business'],
      'fitness': ['gym', 'workout', 'fitness', 'exercise', 'training'],
      'food': ['food', 'restaurant', 'cooking', 'dinner', 'lunch'],
      'travel': ['travel', 'trip', 'vacation', 'holiday', 'visit'],
      'hobbies': ['hobby', 'music', 'movie', 'book', 'game'],
      'personal': ['family', 'friend', 'home', 'weekend', 'day']
    };
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => conversationText.includes(keyword))) {
        topics.push(topic);
      }
    }
    
    return {
      totalMessages,
      userMessages,
      theirMessages,
      isFirstInteraction,
      stage,
      familiarity,
      topics
    };
  }

  async callAIForSuggestions(prompt) {
    try {
      console.log('🤖 AI Assist: Making request for prompt:', prompt);
      
      // FIXED: Much clearer system prompt that prevents explanations
      const systemPrompt = "You are a dating conversation assistant. Generate ONLY direct reply suggestions - no explanations, no commentary, no analysis. Respond with exactly 3 numbered replies that someone would actually send. Never explain or describe the suggestions.";
      
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('AI request timeout after 30 seconds'));
        }, 30000);

        chrome.runtime.sendMessage({
          action: 'ai_suggestions',
          prompt: prompt
        }, (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (!response) {
            console.error('❌ No response from background script');
            reject(new Error('No response from AI service'));
            return;
          }
          
          resolve(response);
        });
      });

      if (response.success) {
        console.log('🤖 AI Assist: Got successful response:', response.text);
        
        // Keep existing cache manager integration
        if (window.maloumCacheManager) {
          console.log('🤖 AI Assist: Updating cache manager with actual response');
          window.maloumCacheManager.incrementApiRequests(
            prompt,
            systemPrompt,
            response.text
          );
        }
        
        let suggestions = this.parseAISuggestions(response.text);
        suggestions = await this.ensureEnglishSuggestions(suggestions);
        
        return { success: true, suggestions };
      } else {
        console.error('❌ AI service error:', response.error);
        throw new Error(response.error || 'AI service failed');
      }

    } catch (error) {
      console.error('🤖 AI suggestion request failed:', error);
      return { success: false, error: error.message };
    }
  }

  parseAISuggestions(aiResponse) {
    console.log('🤖 Raw AI Response:', aiResponse);
    
    const suggestions = [];
    const lines = aiResponse.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentSuggestion = '';
    let currentType = '';
    
    for (const line of lines) {
      // Skip AI explanatory text
      if (line.toLowerCase().includes('here are') || 
          line.toLowerCase().includes('suggestions') ||
          line.toLowerCase().includes('reply options') ||
          line.toLowerCase().includes('based on')) {
        continue;
      }
      
      // Look for category indicators
      if (line.toLowerCase().includes('option 1') || line.startsWith('1.')) {
        if (currentSuggestion && suggestions.length < 3) {
          suggestions.push({
            type: 'Option 1',
            text: this.cleanSuggestionText(currentSuggestion)
          });
        }
        currentType = 'Option 1';
        currentSuggestion = line.replace(/^1\.\s*/, '').replace(/option 1:?\s*/i, '');
      } else if (line.toLowerCase().includes('option 2') || line.startsWith('2.')) {
        if (currentSuggestion && currentType === 'Option 1' && suggestions.length < 3) {
          suggestions.push({
            type: 'Option 1',
            text: this.cleanSuggestionText(currentSuggestion)
          });
        }
        currentType = 'Option 2';
        currentSuggestion = line.replace(/^2\.\s*/, '').replace(/option 2:?\s*/i, '');
      } else if (line.toLowerCase().includes('option 3') || line.startsWith('3.')) {
        if (currentSuggestion && currentType === 'Option 2' && suggestions.length < 3) {
          suggestions.push({
            type: 'Option 2',
            text: this.cleanSuggestionText(currentSuggestion)
          });
        }
        currentType = 'Option 3';
        currentSuggestion = line.replace(/^3\.\s*/, '').replace(/option 3:?\s*/i, '');
      } else if (currentType && !line.toLowerCase().includes('rule') && !line.toLowerCase().includes('format')) {
        // Add to current suggestion if we're in a category
        currentSuggestion += ' ' + line;
      }
    }
    
    // Add the last suggestion
    if (currentSuggestion && suggestions.length < 3) {
      suggestions.push({
        type: currentType || 'Option',
        text: this.cleanSuggestionText(currentSuggestion)
      });
    }
    
    // If parsing failed, try simpler approach
    if (suggestions.length === 0) {
      const cleanLines = lines.filter(line => 
        !line.toLowerCase().includes('here are') &&
        !line.toLowerCase().includes('suggestions') &&
        !line.toLowerCase().includes('reply options') &&
        !line.toLowerCase().includes('based on') &&
        !line.toLowerCase().includes('rules') &&
        !line.toLowerCase().includes('format') &&
        line.length > 5 &&
        line.length < 100
      );
      
      cleanLines.slice(0, 3).forEach((line, index) => {
        const types = ['Option 1', 'Option 2', 'Option 3'];
        suggestions.push({
          type: types[index] || 'Option',
          text: this.cleanSuggestionText(line)
        });
      });
    }
    
    console.log('🤖 Parsed suggestions:', suggestions);
    return suggestions.slice(0, 3);
  }

  async ensureEnglishSuggestions(suggestions) {
    const translatedSuggestions = [];
    
    for (const suggestion of suggestions) {
      // Check if suggestion contains German words (basic detection)
      const germanWords = ['ich', 'du', 'der', 'die', 'das', 'und', 'mit', 'für', 'auf', 'nicht', 'dich', 'mir', 'dir', 'auch', 'schön', 'heute', 'wir', 'sie', 'kann', 'will', 'mich', 'bin', 'bist', 'ist', 'haben', 'war', 'sind'];
      const hasGerman = germanWords.some(word => 
        suggestion.text.toLowerCase().includes(' ' + word + ' ') || 
        suggestion.text.toLowerCase().startsWith(word + ' ') ||
        suggestion.text.toLowerCase().endsWith(' ' + word)
      );
      
      if (hasGerman) {
        console.log('🤖 Detected German text, translating to English:', suggestion.text);
        
        try {
          // Translate German suggestion to English
          const translationResponse = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              action: 'translate',
              text: suggestion.text,
              targetLang: 'EN',
              sourceLang: 'DE',
              customPrompt: 'Translate this dating/romantic message to natural English. Keep it casual and appropriate for texting.'
            }, (response) => {
              if (chrome.runtime.lastError || !response) {
                reject(new Error('Translation failed'));
                return;
              }
              resolve(response);
            });
          });
          
          if (translationResponse.success) {
            translatedSuggestions.push({
              type: suggestion.type,
              text: translationResponse.text.trim()
            });
            console.log('🤖 Translated to English:', translationResponse.text);
          } else {
            // Keep original if translation fails
            translatedSuggestions.push(suggestion);
          }
        } catch (error) {
          console.error('🤖 Translation error:', error);
          // Keep original if translation fails
          translatedSuggestions.push(suggestion);
        }
      } else {
        // Already in English (or no German detected)
        translatedSuggestions.push(suggestion);
      }
    }
    
    return translatedSuggestions;
  }

  cleanSuggestionText(text) {
    // Remove quotes, category labels, numbers, and clean up
    return text
      .replace(/^["'`]|["'`]$/g, '') // Remove quotes
      .replace(/^\d+\.\s*/, '') // Remove numbering
      .replace(/^(option [123]|rapport|flirt[y]?|passionate):?\s*/i, '') // Remove category labels
      .replace(/^\*+:?\s*/, '') // Remove asterisks and colon at the beginning
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  getSuggestionType(index) {
    const types = ['Rapport', 'Flirty', 'Passionate'];
    return types[index] || 'Suggestion';
  }

displaySuggestions(contentElement, suggestions) {
  if (!suggestions || suggestions.length === 0) {
    contentElement.innerHTML = `
      <div style="text-align: center; padding: 20px 5px; color: #6b7280;">
        <div style="font-size: 24px; margin-bottom: 8px;">🤔</div>
        <div style="font-size: 13px;">No suggestions</div>
      </div>
    `;
    return;
  }

  let suggestionsHTML = `
    <div style="margin-bottom: 15px;">
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
        <span style="background: linear-gradient(135deg, #f43e06 0%, #FADA7A 100%); padding: 2px 6px; border-radius: 4px; color: white; font-size: 10px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
          SUGGESTIONS
        </span>
      </div>
      <p style="color: #6b7280; font-size: 10px; margin: 0; font-style: italic;">
        Click to use any suggestion
      </p>
    </div>
    
    <div id="suggestions-list">
  `;

  suggestions.forEach((suggestion, index) => {
    // FIXED: Don't truncate - show full text with proper wrapping
    const displayText = suggestion.text;

    suggestionsHTML += `
      <div class="suggestion-card" data-suggestion="${suggestion.text}" title="Press ${index + 1} to select" style="
        background: white;
        border: 1px solid #FCE7C8;
        border-radius: 6px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-bottom: 8px;
        box-shadow: 0 1px 3px rgba(177, 194, 158, 0.1);
        position: relative;
      ">
        <div style="color: #f43e06; font-weight: 600; font-size: 14px; margin-bottom: 4px;">
          Press ${index + 1}
        </div>
        <div style="color: #1f2937; font-size: 13px; line-height: 1.4; font-style: italic; word-wrap: break-word; white-space: normal;">
          ${displayText}
        </div>
      </div>
    `;
  });

  suggestionsHTML += `</div>`;
  contentElement.innerHTML = suggestionsHTML;

  // Rest of the method stays the same (event handlers)
  const suggestionCards = contentElement.querySelectorAll('.suggestion-card');
  suggestionCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = '#f43e06';
      card.style.boxShadow = '0 2px 8px rgba(244, 62, 6, 0.2)';
      card.style.transform = 'translateY(-1px)';
      card.style.background = 'linear-gradient(135deg, #FCE7C8 0%, rgba(252, 231, 200, 0.5) 100%)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '#FCE7C8';
      card.style.boxShadow = '0 1px 3px rgba(177, 194, 158, 0.1)';
      card.style.transform = 'translateY(0)';
      card.style.background = 'white';
    });
    
    card.addEventListener('click', () => {
      const suggestion = card.getAttribute('data-suggestion');
      this.insertSuggestion(suggestion);
    });
  });
  if (!document.querySelector('#maloum-ai-assist-styles')) {
  const style = document.createElement('style');
  style.id = 'maloum-ai-assist-styles';
  style.textContent = `
    @keyframes maloumBackdropFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes maloumModalSlide {
      from { 
        opacity: 0; 
        transform: scale(0.9) translateY(20px); 
      }
      to { 
        opacity: 1; 
        transform: scale(1) translateY(0); 
      }
    }
    
    @keyframes maloumToastSlide {
      from { 
        opacity: 0; 
        transform: translateX(100%); 
      }
      to { 
        opacity: 1; 
        transform: translateX(0); 
      }
    }

    /* Hide scrollbars for AI Assist content */
    #maloum-assist-content {
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* Internet Explorer 10+ */
    }
    
    #maloum-assist-content::-webkit-scrollbar {
      width: 0px; /* Chrome, Safari, Opera */
      background: transparent;
    }

    #maloum-assist-content::-webkit-scrollbar-thumb {
      background: transparent;
    }

    /* Ensure smooth scrolling */
    #maloum-assist-content {
      scroll-behavior: smooth;
    }
  `;
  if (document.head && typeof document.head.appendChild === 'function') {
    document.head.appendChild(style);
  }
}
}

  insertSuggestion(suggestionText) {
    try {
      console.log('🤖 Inserting suggestion:', suggestionText);
      
      // Find the textarea where messages are typed
      const textarea = document.querySelector('textarea[placeholder="Write a message"]');
      
      if (textarea) {
        // IMPROVED: More robust text insertion
        textarea.value = suggestionText;
        textarea.focus();
        
        // FIXED: Trigger multiple events like the translation feature does
        const inputEvent = new Event('input', { bubbles: true });
        const changeEvent = new Event('change', { bubbles: true });
        
        textarea.dispatchEvent(inputEvent);
        textarea.dispatchEvent(changeEvent);
        
        // ADDITIONAL: Try to trigger composition events (for better compatibility)
        const compositionEvent = new CompositionEvent('compositionend', { 
          bubbles: true, 
          data: suggestionText 
        });
        textarea.dispatchEvent(compositionEvent);
        
        // ADDITIONAL: Set cursor to end of text
        textarea.setSelectionRange(suggestionText.length, suggestionText.length);
        
        // ADDITIONAL: Force focus again after events
        setTimeout(() => {
          textarea.focus();
        }, 100);
        
        console.log('🤖 Suggestion inserted into textarea');
        console.log('🤖 Textarea value length:', textarea.value.length);
        console.log('🤖 Suggestion length:', suggestionText.length);
        
        // Close the AI Assist UI
        this.closeAssistUI();
        
        // Show success feedback
        this.showSuccessToast('Reply suggestion inserted!');
        
      } else {
        console.error('🤖 Textarea not found');
        this.showErrorToast('Could not find message input field');
      }
      
    } catch (error) {
      console.error('🤖 Error inserting suggestion:', error);
      this.showErrorToast('Error inserting suggestion');
    }
  }
  showSuccessToast(message) {
    this.showToast(message, '#B1C29E', '#9fb085');
  }

  showErrorToast(message) {
    this.showToast(message, '#dc2626', '#b91c1c');
  }

  showToast(message, bgColor, borderColor) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10002;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 2px solid ${borderColor};
      animation: maloumToastSlide 0.3s ease-out;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'maloumToastSlide 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  destroy() {
    console.log('🧹 Destroying AI Assist Manager instance...');
    
    // Remove keyboard handlers
    this.removeKeyboardShortcuts();
    
    // Remove unload handlers
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler);
      window.removeEventListener('unload', this.unloadHandler);
      this.unloadHandler = null;
    }
    
    // Stop DOM observer
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
    
    // Clear timeouts
    if (this.buttonCheckTimeout) {
      clearTimeout(this.buttonCheckTimeout);
      this.buttonCheckTimeout = null;
    }
    
    // Close UI if open
    if (this.isAssistUIOpen) {
      this.closeAssistUI();
    }
    
    // Remove button
    if (this.assistButton && this.assistButton.parentNode) {
      this.assistButton.remove();
      this.assistButton = null;
    }
    
    // Clear global reference
    if (window.maloumInstances && window.maloumInstances.aiAssistManager === this) {
      delete window.maloumInstances.aiAssistManager;
    }
    
    console.log('✅ AI Assist Manager destroyed');
  }
}

// Initialize AI Assist Manager
let maloumAIAssistManager = null;

function initializeAIAssistManager() {
  try {
    // Create new instance (will handle cleanup of old one automatically)
    maloumAIAssistManager = new MaloumAIAssistManager();
    window.maloumAIAssistManager = maloumAIAssistManager;
    
    console.log('🤖 AI Assist Manager initialized');
    return maloumAIAssistManager;
  } catch (error) {
    console.error('🤖 Failed to initialize AI Assist Manager:', error);
    return null;
  }
}
// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeAIAssistManager, 2000);
  });
} else {
  setTimeout(initializeAIAssistManager, 2000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (maloumAIAssistManager) {
    maloumAIAssistManager.destroy();
  }
});
if (!document.querySelector('#maloum-ai-assist-styles')) {
  const style = document.createElement('style');
  style.id = 'maloum-ai-assist-styles';
  style.textContent = `
    @keyframes maloumBackdropFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes maloumModalSlide {
      from { 
        opacity: 0; 
        transform: scale(0.9) translateY(20px); 
      }
      to { 
        opacity: 1; 
        transform: scale(1) translateY(0); 
      }
    }
    
    @keyframes maloumToastSlide {
      from { 
        opacity: 0; 
        transform: translateX(100%); 
      }
      to { 
        opacity: 1; 
        transform: translateX(0); 
      }
    }
  `;
  if (document.head && typeof document.head.appendChild === 'function') {
    document.head.appendChild(style);
  } else {
    // Silently skip style injection when document.head not available
  }
}

console.log('🤖 AI Assist Manager loaded');