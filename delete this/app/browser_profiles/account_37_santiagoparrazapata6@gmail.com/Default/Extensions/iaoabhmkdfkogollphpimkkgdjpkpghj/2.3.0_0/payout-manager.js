// payout-manager.js - Clean Maloum Payout Manager
class MaloumPayoutManager {
  constructor() {
    this.isPayoutPage = false;
    this.checkedTransactions = new Set();
    this.calculationPopup = null;
    this.isPopupOpen = false;
    
    console.log('💰 Maloum Payout Manager starting...');
    this.init();
  }

  init() {
    // Hide bank account IMMEDIATELY if we're on payout page
    if (window.location.href.includes('/payout')) {
      this.isPayoutPage = true;
      this.hideElementsImmediately();
    }
    
    // Always setup page monitoring, regardless of current page
    this.setupPageMonitoring();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  hideElementsImmediately() {
    // Remove existing style first to avoid conflicts
    const existingStyle = document.getElementById('maloum-immediate-hide');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Add CSS to hide bank account elements as soon as possible
    const hideStyle = document.createElement('style');
    hideStyle.id = 'maloum-immediate-hide';
    hideStyle.textContent = `
      /* Hide bank account section immediately - SPECIFIC TARGETING */
      div.pb-10.pt-5:has(h2:contains("Payout")),
      div[class*="pb-10"][class*="pt-5"]:has(h2:contains("Payout")),
      h2:contains("Payout to"),
      h2:contains("Payout method"),
      *:contains("IBAN"),
      button:has(dl:contains("IBAN")),
      dl:has(dd:contains("IBAN")),
      div:has(> h2:contains("Payout to")),
      div:has(> h2:contains("Payout method")) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -99999px !important;
        pointer-events: none !important;
        z-index: -999999 !important;
      }
    `;
    
    // Insert at the very beginning of head with highest priority
    if (document.head) {
      document.head.insertBefore(hideStyle, document.head.firstChild);
    } else {
      // If head doesn't exist yet, add when it does
      const observer = new MutationObserver(() => {
        if (document.head) {
          document.head.insertBefore(hideStyle, document.head.firstChild);
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }
    
    console.log('🚨 Specific immediate hide styles applied');
  }

  setup() {
    this.checkIfPayoutPage();
    
    if (this.isPayoutPage) {
      console.log('💰 Payout page detected');
      this.hideBankAccountInfo();
      this.setupTransactionCheckboxes();
    }
  }

  setupPageMonitoring() {
    let lastUrl = window.location.href;
    
    const checkForChanges = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('💰 URL changed from', lastUrl, 'to', currentUrl);
        lastUrl = currentUrl;
        
        // Reset state
        this.checkedTransactions.clear();
        this.hidePopup();
        
        // Immediate hide if it's payout page
        this.checkIfPayoutPage();
        if (this.isPayoutPage) {
          console.log('💰 URL change - immediate hide');
          this.hideElementsImmediately();
        }
        
        // Small delay to let the page load
        setTimeout(() => {
          this.checkIfPayoutPage();
          if (this.isPayoutPage) {
            console.log('💰 Back on payout page - re-hiding bank info');
            this.hideBankAccountInfo();
            this.setupTransactionCheckboxes();
          }
        }, 500);
      }
    };
    
    // Check for URL changes every 500ms
    setInterval(checkForChanges, 500);
    
    // Also listen to browser navigation events
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        this.checkIfPayoutPage();
        if (this.isPayoutPage) {
          console.log('💰 Popstate - re-hiding bank info');
          this.hideBankAccountInfo();
          this.setupTransactionCheckboxes();
        }
      }, 500);
    });

    // Listen for pushstate/replacestate (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    const self = this;
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      // Immediate check for payout page
      self.checkIfPayoutPage();
      if (self.isPayoutPage) {
        console.log('💰 PushState - immediate hide');
        self.hideElementsImmediately();
      }
      setTimeout(() => {
        self.checkIfPayoutPage();
        if (self.isPayoutPage) {
          console.log('💰 PushState - re-hiding bank info');
          self.hideBankAccountInfo();
          self.setupTransactionCheckboxes();
        }
      }, 500);
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      // Immediate check for payout page
      self.checkIfPayoutPage();
      if (self.isPayoutPage) {
        console.log('💰 ReplaceState - immediate hide');
        self.hideElementsImmediately();
      }
      setTimeout(() => {
        self.checkIfPayoutPage();
        if (self.isPayoutPage) {
          console.log('💰 ReplaceState - re-hiding bank info');
          self.hideBankAccountInfo();
          self.setupTransactionCheckboxes();
        }
      }, 500);
    };

    console.log('💰 Page monitoring setup complete');
  }

  checkIfPayoutPage() {
    this.isPayoutPage = window.location.href.includes('/payout');
    console.log('💰 Is payout page:', this.isPayoutPage);
  }

  hideBankAccountInfo() {
    // Look for multiple possible selectors
    const selectors = [
      'div.pb-10.pt-5',
      'div[class*="pb-10"][class*="pt-5"]',
      'div:has(h2:contains("Payout to"))',
      'h2:contains("Payout to")'
    ];
    
    let bankSection = null;
    
    // Try each selector
    for (let selector of selectors) {
      if (selector.includes(':has') || selector.includes(':contains')) {
        // For complex selectors, use manual search
        const allDivs = document.querySelectorAll('div');
        for (let div of allDivs) {
          const h2 = div.querySelector('h2');
          if (h2 && h2.textContent.includes('Payout to')) {
            bankSection = div;
            break;
          }
        }
      } else {
        bankSection = document.querySelector(selector);
      }
      if (bankSection) break;
    }
    
    // Also try finding by text content
    if (!bankSection) {
      const allH2s = document.querySelectorAll('h2');
      for (let h2 of allH2s) {
        if (h2.textContent.includes('Payout to')) {
          bankSection = h2.closest('div');
          break;
        }
      }
    }
    
    if (bankSection) {
      console.log('🙈 Found bank section, hiding it:', bankSection);
      bankSection.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important;';
      
      // Add hidden indicator if not already present
      if (!document.getElementById('bank-hidden-indicator')) {
        const hiddenIndicator = document.createElement('div');
        hiddenIndicator.id = 'bank-hidden-indicator';
        hiddenIndicator.style.cssText = 'padding: 8px 12px; background: rgba(0, 0, 0, 0.05); border: 1px dashed #e5e7eb; border-radius: 6px; text-align: center; font-size: 12px; color: #6b7280; margin: 10px 0;';
        hiddenIndicator.textContent = '🔒 Bank account information hidden for privacy';
        
        if (bankSection.parentNode) {
          bankSection.parentNode.insertBefore(hiddenIndicator, bankSection);
        }
      }
      
      console.log('✅ Bank account information successfully hidden');
      return true;
    } else {
      console.log('💰 Bank section not found yet, retrying in 1 second...');
      setTimeout(() => this.hideBankAccountInfo(), 1000);
      return false;
    }
  }

  setupTransactionCheckboxes() {
    const transactions = document.querySelectorAll('a[data-testid="transaction-item"]');
    
    if (transactions.length === 0) {
      console.log('💰 No transactions found, retrying...');
      setTimeout(() => this.setupTransactionCheckboxes(), 1000);
      return;
    }
    
    console.log('💰 Found ' + transactions.length + ' transactions');
    
    transactions.forEach((transaction, index) => {
      this.addCheckboxToTransaction(transaction, index);
    });
  }

  addCheckboxToTransaction(transactionElement, index) {
    if (transactionElement.querySelector('.maloum-checkbox')) {
      return;
    }

    const data = this.extractTransactionData(transactionElement);
    
    if (data.description.toLowerCase().includes('payout')) {
      console.log('💰 Skipping payout transaction ' + index);
      return;
    }

    console.log('💰 Adding checkbox ' + index + ':', data);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'maloum-checkbox';
    checkbox.id = 'cb-' + index;
    
    checkbox.style.cssText = 'position: absolute; top: 15px; right: 15px; width: 20px; height: 20px; z-index: 999; cursor: pointer; accent-color: #f43c04; text-align: center; accent-color: #f43c04;';

    checkbox.setAttribute('data-index', index);
    checkbox.setAttribute('data-net', data.netAmount);
    checkbox.setAttribute('data-gross', data.grossAmount);
    checkbox.setAttribute('data-desc', data.description);

    transactionElement.style.position = 'relative';
    transactionElement.style.paddingRight = '50px';
    transactionElement.appendChild(checkbox);

    const self = this;
    checkbox.onchange = function(e) {
      console.log('💰 Checkbox ' + index + ' changed - checked: ' + checkbox.checked);
      
      if (checkbox.checked) {
        self.checkedTransactions.add(index);
        console.log('✅ Added transaction ' + index + ' to checked set');
      } else {
        self.checkedTransactions.delete(index);
        console.log('❌ Removed transaction ' + index + ' from checked set');
      }
      
      console.log('💰 Total checked: ' + self.checkedTransactions.size);
      
      if (self.checkedTransactions.size > 0) {
        if (!self.isPopupOpen) {
          self.showPopup();
        } else {
          self.updatePopupContent();
        }
      } else {
        self.hidePopup();
      }
    };

    checkbox.onclick = function(e) {
      e.stopPropagation();
    };

    console.log('✅ Checkbox ' + index + ' added successfully');
  }

extractTransactionData(element) {
    let description = 'Transaction';
   
    const text = element.textContent;
    const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4},?\s*\d{2}:\d{2}\s*(?:AM|PM|am|pm)?/i);
    if (dateMatch) {
      description = dateMatch[0];
    } else {
      const h3 = element.querySelector('h3');
      if (h3) {
        const h3Text = h3.textContent.trim();
        if (h3Text === 'Exclusive content') {
          const spans = element.querySelectorAll('span');
          for (let span of spans) {
            const spanText = span.textContent.trim();
            if (spanText.match(/\d{2}\/\d{2}\/\d{4}/)) {
              description = spanText;
              break;
            }
          }
        } else {
          description = h3Text;
        }
      }
    }
    const amounts = [];
    const euroRegex = /(\d+\.\d*)\s*€/g;
    let match;
    while ((match = euroRegex.exec(text)) !== null) {
      const amount = parseFloat(match[1]);
      if (amount > 0) {
        amounts.push(amount);
      }
    }
    let netAmount = 0;
    let grossAmount = 0;
    if (amounts.length >= 2) {
      netAmount = amounts[0];
      grossAmount = amounts[1];
    } else if (amounts.length === 1) {
      netAmount = grossAmount = amounts[0];
    }
    return { description: description, netAmount: netAmount, grossAmount: grossAmount };
  }

  showPopup() {
    const existingPopup = document.getElementById('calc-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    console.log('🚀 Showing calculator sliding from left to center');

    const popup = document.createElement('div');
    popup.id = 'calc-popup';
    
    // UPDATED: Set initial cursor to grab instead of move
    popup.style.cssText = `
      position: fixed;
      top: 100px;
      left: -420px;
      background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(12, 10, 10, 0.57));
      border: 2px solid #f43c04;
      border-radius: 12px;
      padding: 24px;
      color: white;
      font-family: system-ui;
      width: 400px;
      max-width: 90vw;
      max-height: 80vh;
      overflow: hidden;
      z-index: 999999;
      cursor: grab;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      min-width: 300px;
      min-height: 200px;
      resize: both;
    `;

    // Add resize handles
    const resizeHandles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    resizeHandles.forEach(direction => {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-${direction}`;
      handle.style.cssText = this.getResizeHandleStyle(direction);
      popup.appendChild(handle);
    });

    document.body.appendChild(popup);
    
    // Add transition only for slide-in, then remove it
    setTimeout(() => {
      popup.style.transition = 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      popup.style.left = '200px';
      
      // Remove transition after slide-in completes
      setTimeout(() => {
        popup.style.transition = 'none';
      }, 450);
    }, 50);
    
    this.updatePopupContent();
    this.makeDraggable(popup);
    this.makeResizable(popup);
    this.isPopupOpen = true;
  }

// ========================================
// REPLACE the entire makeDraggable() method for easier dragging
// Find: makeDraggable(element) {
// Replace with this improved version:
// ========================================

  makeDraggable(element) {
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const self = this;
    
    // UPDATED: Set default cursor to grab for the entire element
    element.style.cursor = 'grab';
    
    element.addEventListener('mousedown', function(e) {
      // Don't drag if clicking on resize handles, buttons, or scrollable areas
      if (e.target.tagName === 'BUTTON' || 
          e.target.classList.contains('resize-handle') ||
          e.target.closest('#transaction-list') ||
          e.target.closest('button')) {
        return;
      }
      
      // Allow dragging from anywhere now (removed header restriction)
      isDragging = true;
      
      // Calculate offset from mouse to element's current position
      const rect = element.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      
      // Remove ALL transitions during drag
      element.style.transition = 'none';
      // UPDATED: Change to grabbing cursor during drag
      element.style.cursor = 'grabbing';
      
      // Prevent text selection and default behavior
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      
      // Direct positioning based on mouse location minus offset
      let newX = e.clientX - dragOffsetX;
      let newY = e.clientY - dragOffsetY;
      
      // Keep within screen bounds
      const maxX = window.innerWidth - element.offsetWidth;
      const maxY = window.innerHeight - element.offsetHeight;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      // Set both left AND top immediately
      element.style.left = newX + 'px';
      element.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', function(e) {
      if (isDragging) {
        isDragging = false;
        // UPDATED: Return to grab cursor (not move)
        element.style.cursor = 'grab';
        
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
    // UPDATED: Handle cursor changes for different elements
    element.addEventListener('mouseover', function(e) {
      if (!isDragging) {
        // Check if hovering over interactive elements
        if (e.target.tagName === 'BUTTON' || 
            e.target.classList.contains('resize-handle') ||
            e.target.closest('button')) {
          // Let buttons and resize handles keep their own cursor
          return;
        } else {
          // Default to grab cursor for everything else
          element.style.cursor = 'grab';
        }
      }
    });
    
    // UPDATED: Ensure grab cursor when entering the element
    element.addEventListener('mouseenter', function(e) {
      if (!isDragging && !e.target.closest('button') && !e.target.classList.contains('resize-handle')) {
        element.style.cursor = 'grab';
      }
    });
  }



  makeDraggable(element) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    const self = this;
    element.addEventListener('mousedown', function(e) {
      // Don't drag if clicking on resize handles or buttons
      if (e.target.tagName === 'BUTTON' || e.target.classList.contains('resize-handle')) return;
      
      isDragging = true;
      initialX = e.clientX - element.offsetLeft;
      initialY = e.clientY - element.offsetTop;
      element.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      const maxX = window.innerWidth - element.offsetWidth;
      const maxY = window.innerHeight - element.offsetHeight;
      
      currentX = Math.max(0, Math.min(currentX, maxX));
      currentY = Math.max(0, Math.min(currentY, maxY));
      
      element.style.left = currentX + 'px';
      element.style.top = currentY + 'px';
    });

    document.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
      }
    });
  }

  getResizeHandleStyle(direction) {
    const baseStyle = 'position: absolute; background: #f43c04; opacity: 0.7; z-index: 1000;';
    
    switch(direction) {
      case 'nw':
        return baseStyle + 'top: -5px; left: -5px; width: 10px; height: 10px; cursor: nw-resize; border-radius: 50%;';
      case 'ne':
        return baseStyle + 'top: -5px; right: -5px; width: 10px; height: 10px; cursor: ne-resize; border-radius: 50%;';
      case 'sw':
        return baseStyle + 'bottom: -5px; left: -5px; width: 10px; height: 10px; cursor: sw-resize; border-radius: 50%;';
      case 'se':
        return baseStyle + 'bottom: -5px; right: -5px; width: 10px; height: 10px; cursor: se-resize; border-radius: 50%;';
      case 'n':
        return baseStyle + 'top: -3px; left: 50%; transform: translateX(-50%); width: 20px; height: 6px; cursor: n-resize; border-radius: 3px;';
      case 's':
        return baseStyle + 'bottom: -3px; left: 50%; transform: translateX(-50%); width: 20px; height: 6px; cursor: s-resize; border-radius: 3px;';
      case 'e':
        return baseStyle + 'top: 50%; right: -3px; transform: translateY(-50%); width: 6px; height: 20px; cursor: e-resize; border-radius: 3px;';
      case 'w':
        return baseStyle + 'top: 50%; left: -3px; transform: translateY(-50%); width: 6px; height: 20px; cursor: w-resize; border-radius: 3px;';
      default:
        return baseStyle;
    }
  }

  makeResizable(element) {
    const handles = element.querySelectorAll('.resize-handle');
    let isResizing = false;
    let resizeDirection = '';
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isResizing = true;
        resizeDirection = handle.classList[1].replace('resize-', '');
        
        const rect = element.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        startLeft = rect.left;
        startTop = rect.top;
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
      });
    });

    function handleResize(e) {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;
      
      // Handle different resize directions
      if (resizeDirection.includes('e')) {
        newWidth = Math.max(300, startWidth + deltaX);
      }
      if (resizeDirection.includes('w')) {
        newWidth = Math.max(300, startWidth - deltaX);
        newLeft = startLeft + deltaX;
        if (newWidth === 300) newLeft = startLeft + startWidth - 300;
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(200, startHeight + deltaY);
      }
      if (resizeDirection.includes('n')) {
        newHeight = Math.max(200, startHeight - deltaY);
        newTop = startTop + deltaY;
        if (newHeight === 200) newTop = startTop + startHeight - 200;
      }
      
      // Apply constraints
      const maxWidth = window.innerWidth - newLeft;
      const maxHeight = window.innerHeight - newTop;
      
      newWidth = Math.min(newWidth, maxWidth);
      newHeight = Math.min(newHeight, maxHeight);
      
      // Update element
      element.style.width = newWidth + 'px';
      element.style.height = newHeight + 'px';
      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
    }

    function stopResize() {
      isResizing = false;
      resizeDirection = '';
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
    }
  }

  updatePopupContent() {
    const popup = document.getElementById('calc-popup');
    if (!popup) return;
    
    const totals = this.calculateTotals();
    popup.innerHTML = '<div style="display: flex; justify-content: space-between; margin-bottom: 20px; cursor: grab;"><strong style="color: #ff8c42; margin: 0; font-size: 25px; cursor: grab;">Sales Calculator</strong><button id="close-popup" style="background: #ef4444; border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer !important;">✕</button></div><div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px; cursor: grab;"><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: center; cursor: grab;"><div style="cursor: grab;"><div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px; cursor: grab;">NET TOTAL</div><div style="font-size: 24px; font-weight: bold; color: #ff8c42; cursor: grab;">' + totals.net.toFixed(2) + ' €</div></div><div style="cursor: grab;"><div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px; cursor: grab;">GROSS TOTAL</div><div style="font-size: 24px; font-weight: bold; color: #ff8c42; cursor: grab;">' + totals.gross.toFixed(2) + ' €</div></div></div></div><div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; cursor: grab;"><div style="font-size: 12px; margin-bottom: 8px; opacity: 0.8; cursor: grab;">SELECTED (' + totals.count + ')</div><div id="transaction-list" style="max-height: 200px; overflow-y: auto; cursor: grab;">' + this.generateTransactionList(totals.items) + '</div></div><div style="display: flex; gap: 8px;"><button id="uncheck-all" style="flex: 1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 10px; border-radius: 6px; cursor: pointer !important; font-size: 12px;">Clear All</button><button id="export-csv" style="flex: 1; background: linear-gradient(135deg, #f43c04, #ff6b35); border: none; color: white; padding: 10px; border-radius: 6px; cursor: pointer !important; font-size: 12px; font-weight: bold;">Export CSV</button></div>';
    
    // CRITICAL FIX: Force grab cursor on the main popup container
    popup.style.cursor = 'grab !important';
    
    this.addCustomScrollbarStyles();
    const self = this;
    document.getElementById('close-popup').onclick = function() { self.hidePopup(); };
    document.getElementById('uncheck-all').onclick = function() { self.uncheckAll(); };
    document.getElementById('export-csv').onclick = function() { self.exportToCSV(); };
  }

  generateTransactionList(items) {
    return items.map(function(item) {
      return '<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: grab;"><span style="font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; cursor: grab;">' + item.description + '</span><span style="font-size: 12px; color: #ff8c42; font-weight: bold; cursor: grab;">' + item.net.toFixed(2) + ' €</span></div>';
    }).join('');
  }

  addCustomScrollbarStyles() {
    let style = document.getElementById('custom-scrollbar-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'custom-scrollbar-style';
      style.textContent = '#transaction-list::-webkit-scrollbar { width: 6px; } #transaction-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); border-radius: 3px; } #transaction-list::-webkit-scrollbar-thumb { background: rgba(244,60,4,0.7); border-radius: 3px; } #transaction-list::-webkit-scrollbar-thumb:hover { background: rgba(244,60,4,0.9); }';
      document.head.appendChild(style);
    }
  }

hidePopup() {
  const popup = document.getElementById('calc-popup');
  if (popup) {
    console.log('🚪 Sliding calculator out to left');
    
    // Add transition only for slide-out
    popup.style.transition = 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    popup.style.left = '-420px';
    
    // Remove after animation completes
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 400);
  }
  this.isPopupOpen = false;
  console.log('🚪 Popup hidden');
}

  calculateTotals() {
    let net = 0;
    let gross = 0;
    const items = [];

    const self = this;
    this.checkedTransactions.forEach(function(index) {
      const checkbox = document.getElementById('cb-' + index);
      if (checkbox) {
        const itemNet = parseFloat(checkbox.getAttribute('data-net')) || 0;
        const itemGross = parseFloat(checkbox.getAttribute('data-gross')) || 0;
        const description = checkbox.getAttribute('data-desc') || 'Transaction';

        net += itemNet;
        gross += itemGross;
        items.push({ description: description, net: itemNet, gross: itemGross });
      }
    });

    return {
      net: net,
      gross: gross,
      count: this.checkedTransactions.size,
      items: items
    };
  }

  uncheckAll() {
    const self = this;
    this.checkedTransactions.forEach(function(index) {
      const checkbox = document.getElementById('cb-' + index);
      if (checkbox) {
        checkbox.checked = false;
      }
    });
    this.checkedTransactions.clear();
    this.hidePopup();
    console.log('🗑️ All unchecked');
  }

  exportToCSV() {
    const totals = this.calculateTotals();
    
    let csvContent = 'Date/Time,Description,Net Amount,Gross Amount\n';
    
    totals.items.forEach(function(item) {
      const description = item.description.replace(/"/g, '""');
      csvContent += '"' + description + '","Exclusive content",' + item.net.toFixed(2) + ',' + item.gross.toFixed(2) + '\n';
    });
    
    csvContent += '\n"TOTALS","Summary",' + totals.net.toFixed(2) + ',' + totals.gross.toFixed(2) + '\n';
    csvContent += '"COUNT","' + totals.count + ' transactions","",""\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'maloum-transactions-' + new Date().toISOString().split('T')[0] + '.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('📊 CSV exported successfully');
      
      const exportBtn = document.getElementById('export-csv');
      if (exportBtn) {
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = '✅ Exported!';
        exportBtn.style.background = 'linear-gradient(135deg, #10b981, #34d399)';
        setTimeout(function() {
          exportBtn.innerHTML = originalText;
          exportBtn.style.background = 'linear-gradient(135deg, #f43c04, #ff6b35)';
        }, 2000);
      }
    }
  }

  monitorForTransactionChanges() {
    const self = this;
    setInterval(function() {
      if (self.isPayoutPage) {
        self.setupTransactionCheckboxes();
      }
    }, 3000);
  }
}

// Initialize immediately when script loads
(function() {
  // Hide bank elements immediately if on payout page
  if (window.location.href.includes('/payout')) {
    const immediateHideStyle = document.createElement('style');
    immediateHideStyle.id = 'maloum-immediate-hide';
    immediateHideStyle.textContent = `
      /* Immediate hide for bank account sections */
      div.pb-10.pt-5,
      div[class*="pb-10"][class*="pt-5"],
      *:contains("Payout to"),
      *:contains("IBAN"),
      button:has(dl),
      dl:has(dd:contains("IBAN")) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -9999px !important;
        pointer-events: none !important;
      }
    `;
    
    if (document.head) {
      document.head.insertBefore(immediateHideStyle, document.head.firstChild);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        if (document.head) {
          document.head.insertBefore(immediateHideStyle, document.head.firstChild);
        }
      });
    }
    
    console.log('🚨 Bank elements hidden immediately on script load');
  }
})();

function initPayoutManager() {
  if (typeof window !== 'undefined') {
    const payoutManager = new MaloumPayoutManager();
    window.maloumPayoutManager = payoutManager;
    console.log('💰 Payout Manager initialized');
    
    // Start monitoring for transaction changes
    payoutManager.monitorForTransactionChanges();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPayoutManager);
} else {
  initPayoutManager();
}