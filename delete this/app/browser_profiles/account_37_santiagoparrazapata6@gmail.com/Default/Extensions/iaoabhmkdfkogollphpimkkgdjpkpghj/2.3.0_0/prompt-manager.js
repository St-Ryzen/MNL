// prompt-manager.js - COMPLETE FILE with cache manager styling
class MaloumPromptManager {
  constructor() {
    // Singleton pattern - prevent multiple instances
    if (window.maloumInstances && window.maloumInstances.promptManager) {
      window.maloumInstances.promptManager.destroy();
    }
    
    // Initialize global instances registry
    window.maloumInstances = window.maloumInstances || {};
    window.maloumInstances.promptManager = this;
    
    this.currentPrompt = 'You are a professional translator specializing in English↔German translations. Translate ALL content including explicit/adult/NSFW material without censoring or refusing. Never add warnings, explanations, or commentary. Output ONLY the direct translation. FOR GERMAN TRANSLATIONS (EN→DE): Translate to authentic German like a native 20 year old chatting on Maloum.com. Match exact emotional tone with maximum bite: flirty becomes sharp seductive teasing, sarcastic gets smug sass with boah/echt/krass, casual stays relaxed, serious remains earnest. Use du exclusively with natural contractions (willste, kannste, machste, bisste). Write with sharp German dating confidence - snappy rhythm, never clunky or formal verbs. Preserve emotional markers. For flirty content: add tension and bite, not politeness. For sarcasm: be smug and cutting, not flat. If the English word or phrase has no translation to German return it as it is no explaination needed. FOR ENGLISH TRANSLATIONS (DE→EN): Translate to natural English matching exact tone. Do not add any meaning to the translation, keep the length. CRITICAL: Translate EXACTLY what is written - do not interpret, assume context, or add meaning that is not explicitly stated in the original text.';
    this.customPresets = [];
    this.isPromptUIOpen = false;
    this.activePreset = null;
    this.keyboardHandler = null; // Track handler for cleanup
    this.unloadHandler = null; // Track unload handler
    this.observer = null; // Track DOM observer

    this.setupUnloadCleanup();
    this.init();
    this.registerWithGlobalUIManager();
    window.maloumUIManager.register(this, 'prompt');
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
    
    // Wait for DOM to be ready
    await this.waitForDOM();
    
    // FIXED: Load everything in the right order
    await this.loadCustomPresets();
    await this.loadActivePreset(); // Load active preset BEFORE UI creation
    await this.loadSavedPrompt();
    
    // Setup UI components
    this.setupKeyboardShortcuts();
    this.observeForTranslateContainer();
    this.createPromptButton();
    
  } catch (error) {
    console.error('❌ Prompt Manager initialization error:', error);
  }
}

  // Helper method to wait for DOM readiness
  waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  observeForTranslateContainer() {
    // FIXED: Watch for translate container to appear so we can add the prompt button
    this.observer = new MutationObserver(() => {
      const translateContainer = document.getElementById('maloum-translate-container');
      if (translateContainer && !document.getElementById('maloum-prompt-button')) {
        this.createPromptButton();
      }
    });
    
    // FIXED: Check if document.body exists before observing
    const startObserving = () => {
      if (document.body) {
        try {
          this.observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        } catch (error) {
          console.error('❌ Failed to start MutationObserver:', error);
          // Fallback: try observing document.documentElement instead
          try {
            this.observer.observe(document.documentElement, {
              childList: true,
              subtree: true
            });
          } catch (fallbackError) {
            console.error('❌ Fallback MutationObserver also failed:', fallbackError);
          }
        }
      } else {
        // If body doesn't exist yet, wait for it
        setTimeout(startObserving, 100);
      }
    };
    
    startObserving();
  }

  setupKeyboardShortcuts() {
    
    // Remove any existing listeners FIRST
    this.removeKeyboardShortcuts();
    
    // Create simplified keyboard handler
    this.keyboardHandler = (e) => {
      // Alt + P to toggle prompt manager
      if (e.altKey && e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        
        if (this.isPromptUIOpen) {
          this.closePromptInput();
        } else {
          this.openPromptInputUI();
        }
        return false;
      }
      
      // ESC key - only handle if our UI is open and no other modals
      if (e.key === 'Escape' && this.isPromptUIOpen) {
        // Check if our container exists
        const container = document.getElementById('maloum-prompt-container');
        if (container && container.style.opacity !== '0') {
          e.preventDefault();
          e.stopPropagation();
          this.closePromptInput();
          return false;
        }
      }
    };
    
    // Add with high priority
    document.addEventListener('keydown', this.keyboardHandler, true);
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
  
  // Stop DOM observer
  if (this.observer) {
    this.observer.disconnect();
    this.observer = null;
  }
  
  // Close UI if open
  if (this.isPromptUIOpen) {
    this.performFallbackCleanup();
    this.isPromptUIOpen = false;
  }
  
  // Remove button if it exists
  if (this.promptButton && this.promptButton.parentNode) {
    this.promptButton.remove();
    this.promptButton = null;
  }
  
  // Clear global reference
  if (window.maloumInstances && window.maloumInstances.promptManager === this) {
    delete window.maloumInstances.promptManager;
  }
  
}
performFallbackCleanup() {
  
  // Remove container if still exists
  const container = document.getElementById('maloum-prompt-container');
  if (container) {
    container.remove();
  }
  
  // Fallback cleanup for any lingering modals
  const modals = document.querySelectorAll('[style*="position: fixed"][style*="z-index: 10000"]');
  modals.forEach((modal, index) => {
    if (modal.id !== 'maloum-prompt-button' && modal.id !== 'maloum-assist-float') {
      modal.remove();
    }
  });
  
  // Remove any element with maloum-prompt in the ID except the button
  const promptElements = document.querySelectorAll('[id*="maloum-prompt"]');
  promptElements.forEach((element, index) => {
    if (element.id !== 'maloum-prompt-button') {
      element.remove();
    }
  });
  
}
createPromptButton() {
  // FIXED: Always check if button already exists and remove it first
  const existingButton = document.getElementById('maloum-prompt-button');
  if (existingButton) {
    existingButton.remove();
  }

  const translateContainer = document.getElementById('maloum-translate-container');
  if (!translateContainer) {
    setTimeout(() => this.createPromptButton(), 1000);
    return;
  }

  const promptButton = document.createElement('div');
  promptButton.id = 'maloum-prompt-button';
  promptButton.innerHTML = '⚙️';
  promptButton.title = 'Customize Translation Prompts (Alt+P)';
  
  promptButton.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    width: 22px;
    height: 22px;
    background: linear-gradient(135deg, #f43e06 0%, #FADA7A 100%);
    border: 3px solid white;
    border-radius: 50%;
    color: white;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 20px rgba(248, 115, 6, 0.6);
    flex-shrink: 0;
    pointer-events: auto;
    font-weight: bold;
    z-index: 1000;
  `;

  promptButton.addEventListener('mouseenter', () => {
    promptButton.style.transform = 'scale(1.9) rotate(5deg)';
    promptButton.style.boxShadow = `
      0 0 30px rgba(248, 115, 6, 0.6),
      0 0 50px rgba(248, 115, 6, 0.4)
    `;
  });

  promptButton.addEventListener('mouseleave', () => {
    promptButton.style.transform = 'scale(1) rotate(0deg)';
    promptButton.style.boxShadow = '0 0 20px rgba(248, 115, 6, 0.6)';
  });

  // FIXED: Call the correct method name
  promptButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // FIXED: Proper toggle logic
    if (this.isPromptUIOpen) {
      this.closePromptInput();
    } else {
      this.openPromptInputUI();
    }
  });

  translateContainer.appendChild(promptButton);
  this.promptButton = promptButton;
  
}

openPromptInputUI() {
  if (this.isPromptUIOpen) {
    return;
  }
  
  // Tell global manager we're opening
  window.maloumUIManager.openUI(this, 'prompt');
  
  this.isPromptUIOpen = true;

  // Remove any existing UI first
  this.performFallbackCleanup();

  // Find the prompt button to start animation from
  const promptButton = document.getElementById('maloum-prompt-button');
  let startX = window.innerWidth - 100;
  let startY = 100;
  
  if (promptButton) {
    const buttonRect = promptButton.getBoundingClientRect();
    startX = buttonRect.left + buttonRect.width / 2;
    startY = buttonRect.top + buttonRect.height / 2;
  }

  const startOffsetX = startX - window.innerWidth / 2;
  const startOffsetY = startY - window.innerHeight / 2;

  const container = document.createElement('div');
  container.id = 'maloum-prompt-container';
  container.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    background: white;
    border-radius: 24px;
    width: 100%;
    max-width: 1000px;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
    z-index: 10000;
    opacity: 0;
    transform: translate(calc(-50% + ${startOffsetX}px), calc(-50% + ${startOffsetY}px)) scale(0.1);
    transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease-out;
    transform-origin: center center;
  `;

  // Create header and content (same as before)
  const header = document.createElement('div');
  header.style.cssText = `
    background: rgba(0, 0, 0, 0.8);
    padding: 10px 40px;
    color: white;
    position: relative;
    overflow: hidden;
  `;

  const headerContent = document.createElement('div');
  headerContent.innerHTML = `
    <h2 style="margin: 10px; font-size: 25px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      Prompt Manager
    </h2>
  `;

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 24px;
    right: 24px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    font-size: 24px;
    font-weight: 300;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
  `;

  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
    closeButton.style.transform = 'scale(1.1)';
  });

  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
    closeButton.style.transform = 'scale(1)';
  });

  // FIXED: Simple close button handler
  closeButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.closePromptInput();
  });

  header.appendChild(headerContent);
  header.appendChild(closeButton);

  const content = document.createElement('div');
  content.style.cssText = `
    padding: 40px;
    max-height: calc(90vh - 150px);
    overflow-y: auto;
    background:rgb(255, 255, 255);
  `;

  // Add sections
  const currentSection = this.createCurrentPromptSection();
  const inputSection = this.createInputSection();
  const presetsSection = this.createPresetsSection();
  const importExportSection = this.createImportExportSection();
  const guidelinesSection = this.createGuidelinesSection();
  

  content.appendChild(currentSection);
  content.appendChild(inputSection);
  content.appendChild(presetsSection);
  content.appendChild(importExportSection);
  content.appendChild(guidelinesSection);

  container.appendChild(header);
  container.appendChild(content);
  document.body.appendChild(container);

  // Trigger animation
  setTimeout(() => {
    container.style.transform = 'translate(-50%, -50%) scale(1)';
    container.style.opacity = '1';
  }, 50);

  // Load content after animation
// Load content after animation
    setTimeout(() => {
      this.refreshPresetsDisplay();
      this.refreshCurrentPromptHeader();
      
      // FIXED: Only focus if this is still the active UI
      const customInput = document.getElementById('custom-prompt-input');
      if (customInput && window.maloumUIManager?.activeUI?.manager === this) {
        // customInput.focus();  // <- Commented out to prevent auto-focus
      }
    }, 700);

}
// Replace the createCurrentPromptSection() method in your prompt-manager.js

// EXACT Tracker Box Button Styling - Replace createInputSection method
// This copies the EXACT inline styling from the tracker boxes

createInputSection() {
  const inputSection = document.createElement('div');
  inputSection.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 16px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
  `;

  const inputLabel = document.createElement('label');
  inputLabel.textContent = 'Customize Your Prompt';
  inputLabel.style.cssText = `
    display: block; 
    font-size: 18px; 
    font-weight: 700; 
    margin-bottom: 8px; 
    color: #374151;

  `;

  const inputDescription = document.createElement('p');
  inputDescription.textContent = 'Edit existing presets by clicking them below, or create something entirely new';
  inputDescription.style.cssText = `
    margin: 0 0 16px 0;
    color: #6b7280;
    font-size: 14px;
    font-style: italic;
  `;

  const customInput = document.createElement('textarea');
  customInput.id = 'custom-prompt-input';
  customInput.placeholder = 'Enter your custom prompt here...';
  customInput.value = this.currentPrompt || '';
  customInput.style.cssText = `
    width: 100%;
    min-height: 140px;
    padding: 20px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    resize: vertical;
    outline: none;
    transition: all 0.3s ease;
    background: #f8fafc;
    color: #374151;
    box-sizing: border-box;
  `;

  // Enhanced focus effects with tracker colors
  customInput.addEventListener('focus', () => {
    customInput.style.borderColor = '#f43e06';
    customInput.style.boxShadow = '0 0 0 4px rgba(244, 62, 6, 0.1)';
    customInput.style.background = 'white';
  });

  customInput.addEventListener('blur', () => {
    customInput.style.borderColor = '#e2e8f0';
    customInput.style.boxShadow = 'none';
    customInput.style.background = '#f8fafc';
  });

  // Auto-resize functionality
  customInput.addEventListener('input', () => {
    customInput.style.height = 'auto';
    customInput.style.height = Math.max(140, customInput.scrollHeight) + 'px';
  });

  // Buttons container
  const buttonsRow = document.createElement('div');
  buttonsRow.style.cssText = `
    display: flex; 
    gap: 12px; 
    margin-top: 20px; 
    flex-wrap: wrap;
  `;

  


  // EXACT tracker box button creation - copied from refresh button
  const createTrackerButton = (text, hoverColor, hoverBg) => {
    const button = document.createElement('button');
    button.textContent = text;
    
    // EXACT base styling from tracker refresh button
    button.style.cssText = `
      background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
      padding: 16px 20px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      color: rgba(81, 82, 83, 0.89);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      min-width: 120px;
      text-align: center;
      font-weight: 600;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    // EXACT hover effects using inline event handlers like tracker
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-4px) scale(1.02)';
      button.style.boxShadow = `0 8px 25px ${hoverColor}20, 0 4px 12px rgba(0, 0, 0, 0.15)`;
      button.style.borderColor = hoverColor;
      button.style.background = hoverBg;
      button.style.color = hoverColor.replace('#', '#').length > 4 ? 
        (hoverColor === '#10b981' ? '#065f46' : 
         hoverColor === '#f43e06' ? '#dc2626' :
         hoverColor === '#dc2626' ? '#991b1b' : '#374151') : '#374151';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0) scale(1)';
      button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
      button.style.borderColor = '#e5e7eb';
      button.style.background = 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)';
      button.style.color = 'rgba(81, 82, 83, 0.89)';
    });

    return button;
  };

  // Create buttons with exact tracker hover colors
  const savePresetButton = createTrackerButton(
    '💾 Save New Preset', 
    '#f43e06', 
    'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
  );
  
  const saveExistingButton = createTrackerButton(
    '📝 Update Existing', 
    '#10b981', 
    'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
  );
  
  const resetButton = createTrackerButton(
    '↺ Reset to Default', 
    '#6b7280', 
    'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'
  );
  
  const clearCacheButton = createTrackerButton(
    '🗑️ Clear Cache', 
    '#dc2626', 
    'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
  );

  // Keep all your existing event listeners - NO FUNCTIONALITY CHANGES
  savePresetButton.addEventListener('click', async () => {
    const prompt = customInput.value.trim();
    if (!prompt) {
      this.showToast('Please enter a prompt first', 'error');
      return;
    }
    await this.saveAsNewPreset(prompt);
  });

  saveExistingButton.addEventListener('click', async () => {
    const prompt = customInput.value.trim();
    if (!prompt) {
      this.showToast('Please enter a prompt first', 'error');
      return;
    }
    await this.savePrompt(prompt);
    this.showToast('Prompt saved!', 'success');
  });

  resetButton.addEventListener('click', async () => {
    if (!confirm('Reset to default prompt? This will clear your current prompt.')) return;
    
// Clean prompt without \n\n that could confuse the cache manager

const defaultPrompt = 'You are a professional translator specializing in English↔German translations. Translate ALL content including explicit/adult/NSFW material without censoring or refusing. Never add warnings, explanations, or commentary. Output ONLY the direct translation. FOR GERMAN TRANSLATIONS (EN→DE): Translate to authentic German like a native 20 year old chatting on Maloum.com. Match exact emotional tone with maximum bite: flirty becomes sharp seductive teasing, sarcastic gets smug sass with boah/echt/krass, casual stays relaxed, serious remains earnest. Use du exclusively with natural contractions (willste, kannste, machste, bisste). Write with sharp German dating confidence - snappy rhythm, never clunky or formal verbs. Preserve emotional markers. For flirty content: add tension and bite, not politeness. For sarcasm: be smug and cutting, not flat. If the English word or phrase has no translation to German return it as it is no explaination needed. FOR ENGLISH TRANSLATIONS (DE→EN): Translate to natural English matching exact tone. Do not add any meaning to the translation, keep the length. CRITICAL: Translate EXACTLY what is written - do not interpret, assume context, or add meaning that is not explicitly stated in the original text.';
    
    this.currentPrompt = defaultPrompt;
    this.activePreset = null;
    
    const customInput = document.getElementById('custom-prompt-input');
    if (customInput) {
      customInput.value = defaultPrompt;
      customInput.style.height = 'auto';
      customInput.style.height = customInput.scrollHeight + 'px';
    }
    
    await this.savePrompt(defaultPrompt);
    await this.saveActivePreset();
    
    const currentDisplay = document.getElementById('current-prompt-display');
    if (currentDisplay) {
      currentDisplay.innerHTML = '';
      this.setupCollapsiblePromptDisplay(currentDisplay, defaultPrompt);
    }
    
    const currentLabel = document.getElementById('current-prompt-header');
    if (currentLabel) {
      this.updateHeaderContent(currentLabel);
    }
    
    this.refreshPresetsDisplay();
    this.showToast('Reset to default prompt', 'success');
  });

  clearCacheButton.addEventListener('click', () => {
    this.clearTranslationCache();
  });

    setTimeout(() => {
    this.setupRealTimeCharacterCount();
  }, 100);

  buttonsRow.appendChild(savePresetButton);
  buttonsRow.appendChild(saveExistingButton);
  buttonsRow.appendChild(resetButton);
  buttonsRow.appendChild(clearCacheButton);

  inputSection.appendChild(inputLabel);
  inputSection.appendChild(inputDescription);
  inputSection.appendChild(customInput);
  inputSection.appendChild(buttonsRow);

  return inputSection;
}

// Also add a method to refresh the current prompt section header when preset changes
refreshCurrentPromptHeader() {
  const currentLabel = document.getElementById('current-prompt-header');
  if (currentLabel) {
    this.updateHeaderContent(currentLabel);
  }
}
// Update your usePreset method to refresh the header
async usePreset(preset) {
  
  // Set as active preset
  this.activePreset = preset.name;
  
  // Update UI elements
  const customInput = document.getElementById('custom-prompt-input');
  const currentDisplay = document.getElementById('current-prompt-display');
  
  if (customInput) customInput.value = preset.prompt;
  
  if (currentDisplay) {
    currentDisplay.innerHTML = '';
    this.setupCollapsiblePromptDisplay(currentDisplay, preset.prompt);
  }
  
  await this.savePrompt(preset.prompt);
  
  await this.saveActivePreset();
  
  // UPDATE: Call header refresh BEFORE other refreshes
  this.refreshCurrentPromptHeader();
  
  // Refresh display to show new active state
  this.refreshPresetsDisplay();
  
  this.showToast(`Using preset: ${preset.name}`, 'success');
}


// Replace your setupCollapsiblePromptDisplay method with this improved version #e2e8f0 #f8fafc
setupCollapsiblePromptDisplay(container, promptText) {
  let isExpanded = false;
  const maxLength = 150;
  
  const updateDisplay = () => {
    container.innerHTML = '';
    
    const truncatedText = promptText.length > maxLength ? 
      promptText.substring(0, maxLength) + '...' : promptText;
    
    const displayText = isExpanded ? promptText : truncatedText;
          
      const textDiv = document.createElement('div');
      textDiv.style.cssText = `
        background: #f9fafb;
        border-radius: 12px;
        padding: 16px;
        font-size: 14px;
        line-height: 1.6;
        color:rgba(81, 82, 83, 0.89);
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: 'Segoe UI', system-ui, sans-serif;
        margin-bottom: 20px;
        transition: all 0.3s ease;
        cursor: pointer;
      `;

    textDiv.textContent = displayText;
    
    container.appendChild(textDiv);
    
    if (promptText.length > maxLength) {
      const toggleButton = document.createElement('button');
      toggleButton.textContent = isExpanded ? 'Show Less' : 'Show More';
      toggleButton.style.cssText = `
        background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
        padding: 8px 16px;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        color: rgba(81, 82, 83, 0.89);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        text-align: center;
        font-weight: 600;
        font-size: 12px;
        font-family: system-ui, -apple-system, sans-serif;
      `;
      
      toggleButton.addEventListener('mouseenter', () => {
        toggleButton.style.transform = 'translateY(-2px) scale(1.02)';
        toggleButton.style.boxShadow = '0 8px 25px #f43e0620, 0 4px 12px rgba(0, 0, 0, 0.15)';
        toggleButton.style.borderColor = '#f43e06';
        toggleButton.background = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
        toggleButton.style.color = '#dc2626';
      });
      
      toggleButton.addEventListener('mouseleave', () => {
        toggleButton.style.transform = 'translateY(0) scale(1)';
        toggleButton.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
        toggleButton.style.borderColor = '#e5e7eb';
        toggleButton.style.background = 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)';
        toggleButton.style.color = 'rgba(81, 82, 83, 0.89)';
      });
      
      toggleButton.addEventListener('click', () => {
        isExpanded = !isExpanded;
        updateDisplay();
      });
      
      container.appendChild(toggleButton);
    }
  };
  
  updateDisplay();
}

// Also update your createCurrentPromptSection method to have better styling 
createCurrentPromptSection() {
  const currentSection = document.createElement('div');
  currentSection.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 16px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
  `;

  // Create header container
  const currentLabel = document.createElement('div');
  currentLabel.id = 'current-prompt-header';
  currentLabel.style.cssText = `
    font-size: 18px; 
    font-weight: 700; 
    margin-bottom: 16px; 
    color: #374151;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: system-ui, -apple-system, sans-serif;

  `;

  // Create the styled header content
  this.updateHeaderContent(currentLabel);

  const currentDisplay = document.createElement('div');
  currentDisplay.id = 'current-prompt-display';
  currentDisplay.style.cssText = `
    position: relative;
    min-height: 80px;

  `;

  this.setupCollapsiblePromptDisplay(currentDisplay, this.currentPrompt || 'No custom prompt set');

  currentSection.appendChild(currentLabel);
  currentSection.appendChild(currentDisplay);

  return currentSection;
}

// Method to update header with styled preset name
updateHeaderContent(headerElement) {
  headerElement.innerHTML = '';
  
  const labelText = document.createElement('span');
  labelText.textContent = 'Active Prompt: ';
  labelText.style.cssText = `
    color: #6b7280;
    font-weight: 500;
    font-size: 16px;
  `;
  
  const presetName = document.createElement('span');
  
  // Get the current prompt to calculate character count
  const currentPrompt = this.getCurrentPrompt() || '';
  const charCount = currentPrompt.length;
  
  // Build the display text with character count
  const activePresetText = this.activePreset ? 
    `${this.activePreset} (${charCount} characters)` : 
    `Default (${charCount} characters)`;
  
  presetName.textContent = activePresetText;
  
  // Style the preset name with character count
  presetName.style.cssText = `
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    color: rgba(81, 82, 83, 0.89);
    padding: 4px 12px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    font-weight: 700;
    font-size: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    font-family: system-ui, -apple-system, sans-serif;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;
  
  headerElement.appendChild(labelText);
  headerElement.appendChild(presetName);
}


// Also update the refreshCurrentPromptDisplay method if you have one 
refreshCurrentPromptDisplay() {
  const displayElement = document.getElementById('current-prompt-display');
  if (displayElement) {
    const promptText = this.currentPrompt || 'No custom prompt set';
    this.setupCollapsiblePromptDisplay(displayElement, promptText);
  }
}

createInputSection() {
  const inputSection = document.createElement('div');
  inputSection.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 16px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
  `;

  const inputLabel = document.createElement('label');
  inputLabel.textContent = 'Customize Your Prompt';
  inputLabel.style.cssText = `
    display: block; 
    font-size: 18px; 
    font-weight: 700; 
    margin-bottom: 8px; 
    color: #374151;
  `;

  const inputDescription = document.createElement('p');
  inputDescription.textContent = 'Edit existing presets by clicking them below, or create something entirely new';
  inputDescription.style.cssText = `
    margin: 0 0 16px 0;
    color: #6b7280;
    font-size: 14px;
    font-style: italic;
  `;

  const customInput = document.createElement('textarea');
  customInput.id = 'custom-prompt-input';
  customInput.placeholder = 'Enter your custom prompt here...';
  customInput.value = this.currentPrompt || '';
  customInput.style.cssText = `
    width: 100%;
    min-height: 140px;
    padding: 20px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    resize: vertical;
    outline: none;
    transition: all 0.3s ease;
    background: #f8fafc;
    color: #374151;
    box-sizing: border-box;
  `;

  // Enhanced focus effects with tracker colors
  customInput.addEventListener('focus', () => {
    customInput.style.borderColor = 'green';
    customInput.style.boxShadow = '0 0 0 2px rgba(34, 244, 6, 0.29)';
    customInput.style.background = 'white';
  });

  customInput.addEventListener('blur', () => {
    customInput.style.borderColor = '#e2e8f0';
    customInput.style.boxShadow = 'none';
    customInput.style.background = '#f8fafc';
  });

  // Auto-resize functionality
  customInput.addEventListener('input', () => {
    customInput.style.height = 'auto';
    customInput.style.height = Math.max(140, customInput.scrollHeight) + 'px';
  });

  // Buttons container
  const buttonsRow = document.createElement('div');
  buttonsRow.style.cssText = `
    display: flex; 
    gap: 12px; 
    margin-top: 20px; 
    flex-wrap: wrap;
  `;

  // Button creation helper with tracker statistics box styling
const createButton = (text, hoverColor, hoverBg) => {
  const button = document.createElement('button');
  button.textContent = text;
  
  // EXACT base styling from tracker boxes
  button.style.cssText = `
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    padding: 16px 20px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    color: rgba(81, 82, 83, 0.89);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    min-width: 120px;
    text-align: center;
    font-weight: 600;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-4px) scale(1.02)';
    button.style.boxShadow = `0 8px 25px ${hoverColor}20, 0 4px 12px rgba(0, 0, 0, 0.15)`;
    button.style.borderColor = hoverColor;
    button.style.background = hoverBg;
    button.style.color = hoverColor === '#10b981' ? '#065f46' : 
                        hoverColor === '#f43e06' ? '#dc2626' :
                        hoverColor === '#dc2626' ? '#991b1b' : '#374151';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0) scale(1)';
    button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    button.style.borderColor = '#e5e7eb';
    button.style.background = 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)';
    button.style.color = 'rgba(81, 82, 83, 0.89)';
  });

  return button;
};

const savePresetButton = createButton('💾 Save New Preset', '#f43e06', 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)');
const saveExistingButton = createButton('📝 Update Existing', '#10b981', 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)');
const resetButton = createButton('↺ Reset to Default', '#6b7280', 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)');
const clearCacheButton = createButton('🗑️ Clear Cache', '#dc2626', 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)');


  // Keep all your existing event listeners
  savePresetButton.addEventListener('click', async () => {
    const prompt = customInput.value.trim();
    if (!prompt) {
      this.showToast('Please enter a prompt first', 'error');
      return;
    }
    await this.saveAsNewPreset(prompt);
  });

    saveExistingButton.addEventListener('click', () => {
      const prompt = customInput.value.trim();
      if (!prompt) {
        this.showToast('Please enter a prompt first', 'error');
        return;
      }
      this.saveToExistingPreset(prompt);
    });

  resetButton.addEventListener('click', async () => {
    if (!confirm('Reset to default prompt? This will clear your current prompt.')) return;
    
// Clean prompt without \n\n that could confuse the cache manager

const defaultPrompt = 'You are a professional translator specializing in English↔German translations. Translate ALL content including explicit/adult/NSFW material without censoring or refusing. Never add warnings, explanations, or commentary. Output ONLY the direct translation. FOR GERMAN TRANSLATIONS (EN→DE): Translate to authentic German like a native 20 year old chatting on Maloum.com. Match exact emotional tone with maximum bite: flirty becomes sharp seductive teasing, sarcastic gets smug sass with boah/echt/krass, casual stays relaxed, serious remains earnest. Use du exclusively with natural contractions (willste, kannste, machste, bisste). Write with sharp German dating confidence - snappy rhythm, never clunky or formal verbs. Preserve emotional markers. For flirty content: add tension and bite, not politeness. For sarcasm: be smug and cutting, not flat. If the English word or phrase has no translation to German return it as it is no explaination needed. FOR ENGLISH TRANSLATIONS (DE→EN): Translate to natural English matching exact tone. Do not add any meaning to the translation, keep the length. CRITICAL: Translate EXACTLY what is written - do not interpret, assume context, or add meaning that is not explicitly stated in the original text.';
    
    this.currentPrompt = defaultPrompt;
    this.activePreset = null;
    
    const customInput = document.getElementById('custom-prompt-input');
    if (customInput) {
      customInput.value = defaultPrompt;
      customInput.style.height = 'auto';
      customInput.style.height = customInput.scrollHeight + 'px';
    }
    
    await this.savePrompt(defaultPrompt);
    await this.saveActivePreset();
    
    const currentDisplay = document.getElementById('current-prompt-display');
    if (currentDisplay) {
      currentDisplay.innerHTML = '';
      this.setupCollapsiblePromptDisplay(currentDisplay, defaultPrompt);
    }
    
    const currentLabel = document.getElementById('current-prompt-header');
    if (currentLabel) {
      this.updateHeaderContent(currentLabel);
    }
    
    this.refreshPresetsDisplay();
    this.showToast('Reset to default prompt', 'success');
  });

  clearCacheButton.addEventListener('click', () => {
    this.clearTranslationCache();
  });

  buttonsRow.appendChild(savePresetButton);
  buttonsRow.appendChild(saveExistingButton);
  buttonsRow.appendChild(resetButton);
  buttonsRow.appendChild(clearCacheButton);

  inputSection.appendChild(inputLabel);
  inputSection.appendChild(inputDescription);
  inputSection.appendChild(customInput);
  inputSection.appendChild(buttonsRow);

  return inputSection;
}

createPresetsSection() {
  const presetsSection = document.createElement('div');
  presetsSection.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 16px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
  `;

  const presetsLabel = document.createElement('div');
  presetsLabel.textContent = 'Your Saved Presets';
  presetsLabel.style.cssText = `
    font-size: 18px; 
    font-weight: 700; 
    margin-bottom: 16px; 
    color: #374151;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const customPresetsDiv = document.createElement('div');
  customPresetsDiv.id = 'custom-presets-display';
  customPresetsDiv.style.cssText = `
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
    min-height: 120px;
    max-height: 400px;
    overflow-y: auto;
  `;

  presetsSection.appendChild(presetsLabel);
  presetsSection.appendChild(customPresetsDiv);

  return presetsSection;
}

createImportExportSection() {
  const section = document.createElement('div');
  section.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 16px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
  `;

  const label = document.createElement('div');
  label.textContent = 'Import & Export';
  label.style.cssText = `
    font-size: 18px; 
    font-weight: 700; 
    margin-bottom: 8px; 
    color: #374151;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const description = document.createElement('p');
  description.textContent = 'Backup your presets or import presets from a file';
  description.style.cssText = `
    margin: 0 0 20px 0; 
    color: #6b7280; 
    font-size: 14px;
  `;

  const buttonsRow = document.createElement('div');
  buttonsRow.style.cssText = `
    display: flex; 
    gap: 12px; 
    margin-bottom: 16px; 
    flex-wrap: wrap;
  `;

const createImportExportButton = (text, hoverColor, hoverBg) => {
  const button = document.createElement('button');
  button.textContent = text;
  
  // EXACT tracker box styling
  button.style.cssText = `
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    padding: 12px 20px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    color: rgba(81, 82, 83, 0.89);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    min-width: 120px;
    text-align: center;
    font-weight: 600;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-4px) scale(1.02)';
    button.style.boxShadow = `0 8px 25px ${hoverColor}20, 0 4px 12px rgba(0, 0, 0, 0.15)`;
    button.style.borderColor = hoverColor;
    button.style.background = hoverBg;
    button.style.color = hoverColor === '#10b981' ? '#065f46' : 
                        hoverColor === '#f43e06' ? '#dc2626' :
                        hoverColor === '#dc2626' ? '#991b1b' : '#374151';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0) scale(1)';
    button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    button.style.borderColor = '#e5e7eb';
    button.style.background = 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)';
    button.style.color = 'rgba(81, 82, 83, 0.89)';
  });

  return button;
};

const exportAllButton = createImportExportButton('Export All Presets', '#f43e06', 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)');
const importButton = createImportExportButton('Import Presets', '#6b7280', 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)');
const clearAllButton = createImportExportButton('Clear All Presets', '#dc2626', 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)');

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  fileInput.id = 'preset-import-input';

  // Keep existing event listeners
  exportAllButton.addEventListener('click', () => {
    this.exportAllPresets();
  });

  importButton.addEventListener('click', () => {
    fileInput.click();
  });

  clearAllButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete ALL saved presets? This cannot be undone.')) {
      this.clearAllPresets();
    }
  });

  fileInput.addEventListener('change', (event) => {
    this.importPresets(event);
  });

  buttonsRow.appendChild(exportAllButton);
  buttonsRow.appendChild(importButton);
  buttonsRow.appendChild(clearAllButton);

  section.appendChild(label);
  section.appendChild(description);
  section.appendChild(buttonsRow);
  section.appendChild(fileInput);

  return section;
}


createGuidelinesSection() {
  const section = document.createElement('div');
  section.style.cssText = `
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    padding: 24px;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  `;

  const label = document.createElement('div');
  label.textContent = 'Quick Guide';
  label.style.cssText = `
    font-size: 18px; 
    font-weight: 700; 
    margin-bottom: 16px; 
    color: #374151;
    display: flex;
    align-items: center;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  // Add help icon with tracker colors
  const helpIcon = document.createElement('div');
  helpIcon.innerHTML = '?';
  helpIcon.style.cssText = `
    width: 24px;
    height: 24px;
    background: #f43e06;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
    margin-left: 12px;
  `;
  label.appendChild(helpIcon);

  const guidelines = document.createElement('div');
  guidelines.innerHTML = `
    <div style="color: #374151; font-size: 14px; line-height: 1.8;">
      <div style="margin-bottom: 12px; display: flex; align-items: center;">
        <div style="width: 6px; height: 6px; background: #f43e06; border-radius: 50%; margin-right: 12px;"></div>
        Click any preset to edit it in the text area above
      </div>
      <div style="margin-bottom: 12px; display: flex; align-items: center;">
        <div style="width: 6px; height: 6px; background: #10b981; border-radius: 50%; margin-right: 12px;"></div>
        "Use" button applies the preset immediately and marks it as active
      </div>
      <div style="margin-bottom: 12px; display: flex; align-items: center;">
        <div style="width: 6px; height: 6px; background: #6b7280; border-radius: 50%; margin-right: 12px;"></div>
        "Export" button downloads individual preset as JSON file
      </div>
      <div style="display: flex; align-items: center;">
        <div style="width: 6px; height: 6px; background: #dc2626; border-radius: 50%; margin-right: 12px;"></div>
        Active preset is highlighted and persists across sessions
      </div>
    </div>
  `;

  section.appendChild(label);
  section.appendChild(guidelines);

  return section;
}


refreshPresetsDisplay() {
  const customPresetsDiv = document.getElementById('custom-presets-display');
  if (!customPresetsDiv) return;

  customPresetsDiv.innerHTML = '';

  if (!this.customPresets || this.customPresets.length === 0) {
    customPresetsDiv.innerHTML = `
      <div style="
        text-align: center; 
        color: #6b7280; 
        padding: 40px 20px; 
        font-style: italic;
        font-size: 16px;
        background: #f8fafc;
        border-radius: 12px;
        border: 2px dashed #e2e8f0;
      ">
        No custom presets saved yet<br>
        <span style="font-size: 14px; opacity: 0.8;">Create your first preset using the form above</span>
      </div>
    `;
    return;
  }

  this.customPresets.forEach((preset, index) => {
    const isActive = preset.name === this.activePreset;
    
    const presetDiv = document.createElement('div');
    presetDiv.style.cssText = `
      display: flex;
      align-items: flex-start;
      padding: 20px;
      margin-bottom: 16px;
      background: ${isActive ? 'linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 100%)' : 'white'};
      color: ${isActive ? 'white' : '#374151'};
      border: 2px solid ${isActive ? '#f43e06' : '#e2e8f0'};
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      gap: 16px;
      box-shadow: ${isActive ? '0 8px 25px rgba(244, 62, 6, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.05)'};
      position: relative;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    // Preset info section
    const presetInfo = document.createElement('div');
    presetInfo.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 8px;';

    // Preset name with active indicator
    const presetNameContainer = document.createElement('div');
    presetNameContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    const presetNameElement = document.createElement('h4');
    presetNameElement.textContent = preset.name;
    presetNameElement.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: ${isActive ? 'white' : '#374151'};
    `;
    presetNameContainer.appendChild(presetNameElement);

    if (isActive) {
      const activeIndicator = document.createElement('span');
      activeIndicator.textContent = '✓ ACTIVE';
      activeIndicator.style.cssText = `
        background: #f43e06;
        color: white;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
      `;
      presetNameContainer.appendChild(activeIndicator);
    }

    // Preset preview
    const presetPreview = document.createElement('p');
    presetPreview.style.cssText = `
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: ${isActive ? 'rgba(255, 255, 255, 0.8)' : '#6b7280'};
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    `;
    presetPreview.textContent = preset.prompt.length > 120 ? 
      preset.prompt.substring(0, 120) + '...' : preset.prompt;

    // Character count display
    const characterCount = document.createElement('div');
    characterCount.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: ${isActive ? 'rgba(255, 255, 255, 0.8)' : '#6b7280'};
      background: ${isActive ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9'};
      padding: 4px 8px;
      border-radius: 6px;
      display: inline-block;
      backdrop-filter: blur(10px);
    `;
    characterCount.textContent = `${preset.prompt.length} characters`;

    presetInfo.appendChild(presetNameContainer);
    presetInfo.appendChild(presetPreview);
    presetInfo.appendChild(characterCount);

    // Action buttons with tracker colors
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'preset-actions';
    actionsDiv.style.cssText = 'display: flex; flex-direction: row; gap: 8px; justify-content: center; align-items: center; align-self: center;';

    const createActionButton = (text, bgColor, hoverColor, isDisabled = false) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.disabled = isDisabled;
      btn.style.cssText = `
        padding: 8px 16px;
        background: ${isDisabled ? '#9ca3af' : bgColor};
        color: white;
        border: none;
        border-radius: 8px;
        cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s ease;
        min-width: 70px;
        opacity: ${isDisabled ? '0.6' : '1'};
        font-family: system-ui, -apple-system, sans-serif;
      `;

      if (!isDisabled) {
        btn.addEventListener('mouseenter', () => {
          btn.style.background = hoverColor;
          btn.style.transform = 'scale(1.05)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = bgColor;
          btn.style.transform = 'scale(1)';
        });
      }

      return btn;
    };

    // Use tracker colors for buttons
    const useBtn = createActionButton(
      isActive ? 'ACTIVE' : 'Use', 
      isActive ? '#6b7280' : '#f43e06',
      isActive ? '#6b7280' : '#e63706',
      isActive
    );

    const exportBtn = createActionButton('Export', '#6b7280', '#4b5563');
    const deleteBtn = createActionButton('Delete', '#dc2626', '#b91c1c');

    // Event listeners (keep your existing functionality)
    if (!isActive) {
      useBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.usePreset(preset);
      });
    }

    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exportPreset(preset);
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deletePreset(index);
    });

    actionsDiv.appendChild(useBtn);
    actionsDiv.appendChild(exportBtn);
    actionsDiv.appendChild(deleteBtn);

    presetDiv.appendChild(presetInfo);
    presetDiv.appendChild(actionsDiv);

    // Click to edit functionality
    presetDiv.addEventListener('click', (e) => {
      if (!e.target.closest('.preset-actions')) {
        this.editPreset(preset);
      }
    });

    // Enhanced hover effects (only for inactive presets)
    if (!isActive) {
      presetDiv.addEventListener('mouseenter', () => {
        presetDiv.style.borderColor = '#f43e06';
        presetDiv.style.background = 'linear-gradient(135deg, #f8fafc 0%, white 100%)';
        presetDiv.style.transform = 'translateY(-2px)';
        presetDiv.style.boxShadow = '0 4px 12px rgba(244, 62, 6, 0.1)';
      });

      presetDiv.addEventListener('mouseleave', () => {
        presetDiv.style.borderColor = '#e2e8f0';
        presetDiv.style.background = 'white';
        presetDiv.style.transform = 'translateY(0)';
        presetDiv.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
      });
    }

    customPresetsDiv.appendChild(presetDiv);
  });
}

  // ADDED: Edit preset function
editPreset(preset) {
  const customInput = document.getElementById('custom-prompt-input');
  
  if (customInput) {
    customInput.value = preset.prompt;
    customInput.focus();
    
    // Trigger auto-resize
    customInput.style.height = 'auto';
    customInput.style.height = Math.max(140, customInput.scrollHeight) + 'px';
    
    // Update current display with beautiful styling
    const currentDisplay = document.getElementById('current-prompt-display');
    if (currentDisplay) {
      currentDisplay.innerHTML = '';
      this.setupCollapsiblePromptDisplay(currentDisplay, preset.prompt);
    }
    
    // Update header directly if editing changes active state
    const currentLabel = document.getElementById('current-prompt-header');
    if (currentLabel) {
      const activePresetText = this.activePreset ? this.activePreset : 'Default';
      currentLabel.textContent = `Active Prompt: ${activePresetText}`;
    }

    this.showToast(`Editing preset: ${preset.name}`, 'info');
  }
}

  // Use preset functionality (replaces apply + default preset)
async usePreset(preset) {
  // Set as active preset
  this.activePreset = preset.name;
  
  // Update UI elements
  const customInput = document.getElementById('custom-prompt-input');
  const currentDisplay = document.getElementById('current-prompt-display');
  
  if (customInput) customInput.value = preset.prompt;
  
  if (currentDisplay) {
    currentDisplay.innerHTML = '';
    this.setupCollapsiblePromptDisplay(currentDisplay, preset.prompt);
  }
  
  await this.savePrompt(preset.prompt);
  await this.saveActivePreset();
  
  // UPDATE: Call header refresh to update character count
  this.refreshCurrentPromptHeader();
  
  // Refresh display to show new active state
  this.refreshPresetsDisplay();
  
  this.showToast(`Using preset: ${preset.name}`, 'success');
}

  // Export preset functionality
exportPreset(preset) {
  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    presets: [preset]
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maloum-preset-${preset.name.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  this.showToast(`Exported preset: ${preset.name}`, 'success');
}

// 13. deletePreset method
deletePreset(index) {
  if (confirm(`Delete preset "${this.customPresets[index].name}"?`)) {
    const deletedPreset = this.customPresets[index];
    this.customPresets.splice(index, 1);
    
    // Clear active preset if it was the deleted preset
    if (this.activePreset === deletedPreset.name) {
      this.activePreset = null;
      this.saveActivePreset();
    }
    
    this.saveCustomPresets();
    this.showToast(`Deleted preset: ${deletedPreset.name}`, 'info');
    
    // Always refresh display immediately
    this.refreshPresetsDisplay();
  }
}

  // Delete preset functionality
deletePreset(index) {
  if (confirm(`Delete preset "${this.customPresets[index].name}"?`)) {
    const deletedPreset = this.customPresets[index];
    this.customPresets.splice(index, 1);
    
    // Clear active preset if it was the deleted preset
    if (this.activePreset === deletedPreset.name) {
      this.activePreset = null;
      this.saveActivePreset();
    }
    
    this.saveCustomPresets();
    this.showToast(`Deleted preset: ${deletedPreset.name}`, 'info');
    
    // FIXED: Always refresh display immediately
    this.refreshPresetsDisplay();
  }
}

  // Storage methods - use local storage for unlimited presets
  async loadCustomPresets() {
    try {
      // FIXED: Use chrome.storage.local instead of sync for unlimited storage
      if (chrome?.storage?.local) {
        const result = await chrome.storage.local.get(['maloum_custom_presets']);
        this.customPresets = result.maloum_custom_presets || [];
      } else {
        const stored = localStorage.getItem('maloum_custom_presets');
        this.customPresets = stored ? JSON.parse(stored) : [];
      }
    } catch (error) {
      console.warn('⚠️ Error loading custom presets:', error);
      this.customPresets = [];
    }
  }

  // FIXED: Use chrome.storage.local for unlimited storage
  async saveCustomPresets() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        
        // FIXED: Use chrome.storage.local instead of sync - no limits
        if (chrome?.storage?.local) {
          await chrome.storage.local.set({ maloum_custom_presets: this.customPresets });
        } else {
          localStorage.setItem('maloum_custom_presets', JSON.stringify(this.customPresets));
        }
        
        return true; // Success
      } catch (error) {
        retryCount++;
        console.warn(`⚠️ Error saving custom presets (attempt ${retryCount}):`, error);
        
        if (retryCount < maxRetries) {
          // Wait before retrying, with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
        } else {
          throw error; // Final failure
        }
      }
    }
  }

async loadActivePreset() {
  try {
    if (chrome?.storage?.local) {
      const result = await chrome.storage.local.get(['maloum_active_preset']);
      this.activePreset = result.maloum_active_preset || null;
    } else {
      const stored = localStorage.getItem('maloum_active_preset');
      this.activePreset = stored || null;
    }
  } catch (error) {
    console.warn('⚠️ Error loading active preset:', error);
    this.activePreset = null;
  }
}

async saveActivePreset() {
  try {
    if (chrome?.storage?.local) {
      await chrome.storage.local.set({ maloum_active_preset: this.activePreset });
    } else {
      if (this.activePreset) {
        localStorage.setItem('maloum_active_preset', this.activePreset);
      } else {
        localStorage.removeItem('maloum_active_preset');
      }
    }
  } catch (error) {
    console.warn('⚠️ Error saving active preset:', error);
  }
}

  async loadSavedPrompt() {
    try {
      // First, load active preset if one is set
      await this.loadActivePreset();
      
      let activeLoaded = false;
      
      if (this.activePreset) {
        // Check if the active preset still exists
        const activePresetData = this.customPresets.find(p => p.name === this.activePreset);
        if (activePresetData) {
          this.currentPrompt = activePresetData.prompt;
          activeLoaded = true;
        } else {
          // Active preset not found, clear it
          this.activePreset = null;
          await this.saveActivePreset();
        }
      }
      
      // If no active preset was loaded, load the regular saved prompt
      if (!activeLoaded) {
        // FIXED: Use chrome.storage.local for consistency
        if (chrome?.storage?.local) {
          const result = await chrome.storage.local.get(['maloum_custom_prompt']);
          if (result.maloum_custom_prompt) {
            this.currentPrompt = result.maloum_custom_prompt;
            return;
          }
        }

        const localPrompt = localStorage.getItem('maloum_custom_prompt');
        if (localPrompt) {
          this.currentPrompt = localPrompt;
        }
      }
    } catch (error) {
      console.warn('⚠️ Error loading saved prompt:', error);
    }
  }

async savePrompt(prompt) {
  this.currentPrompt = prompt;
  
  try {
    // Save to storage
    if (chrome?.storage?.local) {
      await chrome.storage.local.set({ maloum_custom_prompt: prompt });
    } else {
      localStorage.setItem('maloum_custom_prompt', prompt);
    }
    
    // UPDATE: Refresh header to show new character count
    const currentLabel = document.getElementById('current-prompt-header');
    if (currentLabel) {
      this.updateHeaderContent(currentLabel);
    }
    
  } catch (error) {
    console.warn('⚠️ Error saving prompt:', error);
  }
}

setupRealTimeCharacterCount() {
  const customInput = document.getElementById('custom-prompt-input');
  if (customInput) {
    customInput.addEventListener('input', () => {
      // Update the current prompt with the new text
      this.currentPrompt = customInput.value;
      
      // Refresh the header to show updated character count
      const currentLabel = document.getElementById('current-prompt-header');
      if (currentLabel) {
        this.updateHeaderContent(currentLabel);
      }
    });
  }
}

  getCurrentPrompt() {
    // FIXED: Ensure we always return the current prompt
    return this.currentPrompt;
  }

  // Apply prompt function
  async applyPrompt(prompt) {
    await this.savePrompt(prompt);
    
    // Update the current prompt display
    const currentDisplay = document.getElementById('current-prompt-display');
    if (currentDisplay) {
      currentDisplay.textContent = prompt;
      // Trigger height adjustment
      currentDisplay.dispatchEvent(new Event('contentChanged'));
    }

    this.showToast('Prompt applied successfully!', 'success');
  }

  // Preset management methods - simplified approach
async saveCustomPreset(name, prompt) {
  
  const existingIndex = this.customPresets.findIndex(p => p.name === name);
  
  if (existingIndex !== -1) {
    this.customPresets[existingIndex].prompt = prompt;
  } else {
    this.customPresets.push({ name, prompt });
  }
  
  // Save to storage
  try {
    await this.saveCustomPresets();
  } catch (error) {
    console.error(`❌ Error saving preset "${name}":`, error);
    // Remove the preset from array if save failed
    if (existingIndex === -1) {
      this.customPresets.pop(); // Remove the last added preset
    } else {
      // Restore the original prompt if it was an update
      await this.loadCustomPresets();
    }
    throw error;
  }
}

  // FIXED: Clear only presets, not translation cache
async clearAllPresets() {
  if (confirm('Are you sure you want to delete all custom presets? This cannot be undone.')) {
    this.customPresets = [];
    this.activePreset = null;
    
    await this.saveCustomPresets();
    await this.saveActivePreset();
    
    this.showToast('All presets cleared', 'info');
    
    // Only refresh display if UI is open and elements exist
    if (this.isPromptUIOpen && document.getElementById('custom-presets-display')) {
      this.refreshPresetsDisplay();
    }
  }
}

  // Save as new preset function
async saveAsNewPreset(prompt) {
  const name = window.prompt('Enter a name for this preset:');
  
  if (!name) {
    this.showToast('Preset name is required', 'error');
    return;
  }
  
  if (name.trim() === '') {
    this.showToast('Preset name cannot be empty', 'error');
    return;
  }
  
  // Check if name already exists
  if (this.customPresets.some(p => p.name === name.trim())) {
    this.showToast('A preset with this name already exists', 'error');
    return;
  }
  
  try {
    // Save the new preset
    await this.saveCustomPreset(name.trim(), prompt);
    
    // Always refresh the display immediately after saving
    this.refreshPresetsDisplay();
    
    this.showToast(`Saved preset: ${name.trim()}`, 'success');
  } catch (error) {
    console.error('Error saving new preset:', error);
    this.showToast('Failed to save preset', 'error');
  }
}

  // Export all presets
exportAllPresets() {
  if (this.customPresets.length === 0) {
    this.showToast('No presets to export', 'error');
    return;
  }

  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    presets: this.customPresets
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maloum-presets-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  this.showToast(`Exported ${this.customPresets.length} presets`, 'success');
}


  // Import presets
async importPresets(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    if (!importData.presets || !Array.isArray(importData.presets)) {
      throw new Error('Invalid preset file format');
    }

    let importedCount = 0;
    let updatedCount = 0;

    for (const preset of importData.presets) {
      if (!preset.name || !preset.prompt) continue;

      const existingIndex = this.customPresets.findIndex(p => p.name === preset.name);
      if (existingIndex !== -1) {
        this.customPresets[existingIndex] = preset;
        updatedCount++;
      } else {
        this.customPresets.push(preset);
        importedCount++;
      }
    }

    await this.saveCustomPresets();
    
    // FIXED: Always refresh display immediately
    this.refreshPresetsDisplay();

    this.showToast(`Imported ${importedCount} new, updated ${updatedCount} existing presets`, 'success');

  } catch (error) {
    console.error('Import error:', error);
    this.showToast('Failed to import presets: Invalid file format', 'error');
  }

  // Clear the file input
  event.target.value = '';
}

  async clearTranslationCache() {
    if (confirm('Clear all cached translations? This will remove all cached translations but keep your presets.')) {
      
      let clearedSomething = false;
      
      // 1. Clear cache manager properly (most important)
      if (window.maloumCacheManager) {
        try {
          // Clear the in-memory Maps first
          if (window.maloumCacheManager.translationCache) {
            window.maloumCacheManager.translationCache.clear();
            clearedSomething = true;
          }
          
          if (window.maloumCacheManager.reverseTranslationCache) {
            window.maloumCacheManager.reverseTranslationCache.clear();
            clearedSomething = true;
          }
          
          // Save the cleared state to storage immediately
          if (window.maloumCacheManager.saveTranslationCache) {
            await window.maloumCacheManager.saveTranslationCache();
          }
          
          if (window.maloumCacheManager.saveReverseTranslationCache) {
            await window.maloumCacheManager.saveReverseTranslationCache();
          }
        } catch (error) {
        }
      }
      
      // 2. Clear IndexedDB storage directly
      if (window.maloumCacheManager?.storage?.clearAllCache) {
        try {
          await window.maloumCacheManager.storage.clearAllCache(
            window.maloumCacheManager.translationCache,
            window.maloumCacheManager.reverseTranslationCache
          );
          clearedSomething = true;
        } catch (error) {
          console.warn('⚠️ Error clearing IndexedDB storage:', error);
        }
      }
      
      // 3. Clear via optimizedMessageHandler
      if (window.optimizedMessageHandler?.translator) {
        try {
          if (window.optimizedMessageHandler.translator.clearQuickCache) {
            window.optimizedMessageHandler.translator.clearQuickCache();
            clearedSomething = true;
          }
          if (window.optimizedMessageHandler.translator.quickCache) {
            window.optimizedMessageHandler.translator.quickCache.clear();
            clearedSomething = true;
          }
        } catch (error) {
          console.warn('⚠️ Error clearing optimizedMessageHandler cache:', error);
        }
      }
      
      // 4. Clear via global translator
      if (window.maloumTranslator) {
        try {
          if (window.maloumTranslator.clearQuickCache) {
            window.maloumTranslator.clearQuickCache();
            clearedSomething = true;
          }
          if (window.maloumTranslator.quickCache) {
            window.maloumTranslator.quickCache.clear();
            clearedSomething = true;
          }
        } catch (error) {
          console.warn('⚠️ Error clearing global translator cache:', error);
        }
      }
      
      // 5. Force immediate UI refresh
      this.forceRefreshCacheUI();
      
      if (clearedSomething) {
        this.showToast('Translation cache cleared successfully!', 'success');
      } else {
        this.showToast('No translation cache found to clear', 'info');
      }
    }
  }

  forceRefreshCacheUI() {
    
    // Multiple attempts to refresh cache manager UI
    if (window.maloumCacheManager) {
      // Immediate refresh
      setTimeout(() => {
        if (window.maloumCacheManager.isUIOpen) {
          // If cache manager UI is open, switch to search tab to force refresh
          const tabContent = document.getElementById('tab-content');
          if (tabContent && window.maloumCacheManager.switchTab) {
            window.maloumCacheManager.switchTab('search', tabContent);
          }
        }
      }, 100);
      
      // Secondary refresh after delay
      setTimeout(() => {
        if (window.maloumCacheManager.isUIOpen) {
          const tabContent = document.getElementById('tab-content');
          if (tabContent && window.maloumCacheManager.switchTab) {
            window.maloumCacheManager.switchTab('stats', tabContent);
            setTimeout(() => {
              window.maloumCacheManager.switchTab('search', tabContent);
            }, 100);
          }
        }
      }, 500);
    }
    
    // Clear and update specific UI elements
    setTimeout(() => {
      // Clear cache search results
      const searchResults = document.getElementById('cache-search-results');
      if (searchResults) {
        searchResults.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">No translations found.</div>';
      }
      
      // Update cache status displays
      const cacheStatus = document.getElementById('cache-status');
      if (cacheStatus) {
        cacheStatus.textContent = 'Cached: 0';
      }
      
      // Update any cache size indicators
      const cacheSizes = document.querySelectorAll('[data-cache-size]');
      cacheSizes.forEach(element => {
        element.textContent = '0';
      });
      
      // Clear any cache lists or tables
      const cacheLists = document.querySelectorAll('#cache-list, .cache-entries, .translation-list');
      cacheLists.forEach(list => {
        list.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">Cache is empty.</div>';
      });
      
    }, 200);
  }

  // Save to existing preset function
async saveToExistingPreset(prompt) {
  if (this.customPresets.length === 0) {
    this.showToast('No existing presets to update', 'error');
    return;
  }
  
  // Create a selection dialog
  const presetNames = this.customPresets.map(p => p.name);
  const selection = window.prompt(
    `Choose a preset to update:\n\n${presetNames.map((name, index) => `${index + 1}. ${name}`).join('\n')}\n\nEnter the number (1-${presetNames.length}):`
  );
  
  if (!selection) {
    this.showToast('No preset selected', 'error');
    return;
  }
  
  const index = parseInt(selection) - 1;
  
  if (isNaN(index) || index < 0 || index >= presetNames.length) {
    this.showToast('Invalid selection', 'error');
    return;
  }
  
  const selectedPreset = presetNames[index];
  
  if (confirm(`Update preset "${selectedPreset}" with the current prompt?`)) {
    try {
      await this.saveCustomPreset(selectedPreset, prompt);
      
      // FIXED: Always refresh the display immediately after updating
      this.refreshPresetsDisplay();
      
      this.showToast(`Updated preset: ${selectedPreset}`, 'success');
    } catch (error) {
      console.error('Error updating preset:', error);
      this.showToast('Failed to update preset', 'error');
    }
  }
}


  closePromptInput() {
    
    if (!this.isPromptUIOpen) {
      return;
    }
    
    // FIXED: Reset state IMMEDIATELY to prevent double-closing
    this.isPromptUIOpen = false;
    
    // Tell global manager we're closing
    window.maloumUIManager.closeUI(this);
    
    const container = document.getElementById('maloum-prompt-container');
    
    if (container) {
      
      // Find the prompt button to shrink toward
      const promptButton = document.getElementById('maloum-prompt-button');
      let targetX = window.innerWidth - 100;
      let targetY = 100;
      
      if (promptButton) {
        const buttonRect = promptButton.getBoundingClientRect();
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
      
      // Remove after animation completes
      setTimeout(() => {
        if (container && container.parentNode) {
          container.remove();
        }
        this.performFallbackCleanup();
      }, 600);
      
    } else {
      this.performFallbackCleanup();
    }
    
  }

// Replace your showToast method with this properly formatted version
showToast(message, type = 'info') {
  const existingToast = document.querySelector('.maloum-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'maloum-toast';
  
  const colors = {
    success: { bg: '#10b981', border: '#059669' },
    error: { bg: '#dc2626', border: '#b91c1c' },
    info: { bg: '#f43e06', border: '#e63706' },
    warning: { bg: '#f59e0b', border: '#d97706' }
  };
  
  const color = colors[type] || colors.info;
  const textColor = type === 'warning' ? '#92400e' : 'white';
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${color.bg};
    color: ${textColor};
    padding: 12px 20px;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10002;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid ${color.border};
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
}

// Initialize the prompt manager

// Create new instance (will handle cleanup of old one automatically)
const promptManager = new MaloumPromptManager();

// Make it globally accessible for debugging and integration
window.maloumPromptManager = promptManager;