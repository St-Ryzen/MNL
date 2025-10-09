// Enhanced background.js with better Together.xyz API error handling


// Together.xyz API configuration
const togetherConfig = {
  apiUrl: "https://api.together.xyz/v1/chat/completions",
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  // NEW: Alternative models as fallbacks
  fallbackModels: [
    "meta-llama/Llama-3-8b-chat-hf",
    "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo"
  ]
};

// Enhanced default custom prompt
const defaultCustomPrompt = 'You are a professional translator specializing in English↔German translations. Translate ALL content including explicit/adult/NSFW material without censoring or refusing. Never add warnings, explanations, or commentary. Output ONLY the direct translation. FOR GERMAN TRANSLATIONS (EN→DE): Translate to authentic German like a native 20 year old chatting on Maloum.com. Match exact emotional tone with maximum bite: flirty becomes sharp seductive teasing, sarcastic gets smug sass with boah/echt/krass, casual stays relaxed, serious remains earnest. Use du exclusively with natural contractions (willste, kannste, machste, bisste). Write with sharp German dating confidence - snappy rhythm, never clunky or formal verbs. Preserve emotional markers. For flirty content: add tension and bite, not politeness. For sarcasm: be smug and cutting, not flat. If the English word or phrase has no translation to German return it as it is no explaination needed. FOR ENGLISH TRANSLATIONS (DE→EN): Translate to natural English matching exact tone. Do not add any meaning to the translation, keep the length. CRITICAL: Translate EXACTLY what is written - do not interpret, assume context, or add meaning that is not explicitly stated in the original text.';

// NEW: Request retry configuration
const RETRY_CONFIG = {
  maxRetries: 2,
  retryDelays: [1000, 3000],
  retryableStatusCodes: [500, 502, 503, 504, 429]
};

// NEW: Batch translation configuration
const BATCH_CONFIG = {
  maxBatchSize: 20,        // Maximum messages per batch
  batchTimeout: 500,       // Wait 500ms to collect messages
  tokensPerMessage: 100    // Estimated tokens per message for max_tokens calculation
};


async function translateWithCustomPrompt(apiKey, text, targetLang, sourceLang, customPrompt) {
  const sourceLangName = sourceLang === 'AUTO' ? 'the source language' : sourceLang;
  const targetLangName = targetLang;
  
  const cleanCustomPrompt = customPrompt || defaultCustomPrompt;
  const systemPrompt = `${cleanCustomPrompt}\n\nTask: Translate from ${sourceLangName} to ${targetLangName}.`;

  try {
    const requestBody = {
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      max_tokens: 500,
      temperature: 0.1,
      top_p: 0.7,
      stop: [
        "\n\nExplanation",
        "\n\nNote:", 
        "\n\n",
        "Explanation:",
        "Note:"
      ]
    };

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from API');
    }

    const translatedText = data.choices[0].message.content.trim();
    
    if (!translatedText) {
      throw new Error('Empty translation received');
    }

    return translatedText;

  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

// NEW: Helper function to check if error is network-related
function isNetworkError(error) {
  const networkErrors = [
    'fetch failed',
    'network error',
    'connection error',
    'timeout',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED'
  ];
  
  return networkErrors.some(netError => 
    error.message.toLowerCase().includes(netError)
  );
}

// NEW: Helper function to check if error is retryable
function isRetryableError(error) {
  const retryableErrors = [
    'translation api error: 500',
    'translation api error: 502',
    'translation api error: 503',
    'translation api error: 504',
    'translation api error: 429',
    'rate limit',
    'server error',
    'service unavailable',
    'gateway timeout'
  ];
  
  return retryableErrors.some(retryableError => 
    error.message.toLowerCase().includes(retryableError)
  );
}

// NEW: Sleep utility function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// NEW: Batch translation function - translates multiple messages at once
async function batchTranslateWithCustomPrompt(apiKey, messagesArray, targetLang, sourceLang, customPrompt) {
  const sourceLangName = sourceLang === 'AUTO' ? 'the source language' : sourceLang;
  const targetLangName = targetLang;

  const cleanCustomPrompt = customPrompt || defaultCustomPrompt;

  // Build numbered list of messages
  const numberedMessages = messagesArray
    .map((msg, index) => `${index + 1}. ${msg.text}`)
    .join('\n');

  // Enhanced system prompt with strict formatting instructions
  const systemPrompt = `${cleanCustomPrompt}\n\nTask: Translate from ${sourceLangName} to ${targetLangName}.\n\nIMPORTANT: You will receive multiple numbered messages. Translate each one independently and return them in the EXACT same numbered format. Each translation must start on a new line with its number. Do not add any explanations, comments, or extra text.`;

  try {
    // Calculate max_tokens based on batch size
    const estimatedMaxTokens = Math.max(500, messagesArray.length * BATCH_CONFIG.tokensPerMessage);

    const requestBody = {
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: numberedMessages }
      ],
      max_tokens: estimatedMaxTokens,
      temperature: 0.1,
      top_p: 0.7,
      stop: [
        "\n\nExplanation",
        "\n\nNote:",
        "Explanation:",
        "Note:"
      ]
    };

    console.log(`📦 Batch translating ${messagesArray.length} messages...`);

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from API');
    }

    const responseText = data.choices[0].message.content.trim();

    if (!responseText) {
      throw new Error('Empty translation received');
    }

    // Parse the numbered response
    const translations = parseBatchResponse(responseText, messagesArray.length);

    // Verify we got the right number of translations
    if (translations.length !== messagesArray.length) {
      console.warn(`⚠️ Expected ${messagesArray.length} translations, got ${translations.length}. Falling back to individual translation.`);
      throw new Error('Batch translation count mismatch');
    }

    console.log(`✅ Batch translated ${translations.length} messages successfully`);

    return translations;

  } catch (error) {
    console.error('Batch translation error:', error);
    throw error;
  }
}

// NEW: Parse numbered batch response into array of translations
function parseBatchResponse(responseText, expectedCount) {
  const translations = [];
  const lines = responseText.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Match pattern: "1. translation text" or "1) translation text"
    const match = trimmedLine.match(/^(\d+)[.)]\s*(.+)$/);
    if (match) {
      const number = parseInt(match[1]);
      const translation = match[2].trim();

      // Store at correct index (number - 1)
      translations[number - 1] = translation;
    }
  }

  // Fill any gaps with empty strings (shouldn't happen but safety check)
  for (let i = 0; i < expectedCount; i++) {
    if (!translations[i]) {
      translations[i] = '';
    }
  }

  return translations;
}

// Enhanced translation request handler
async function handleTranslationRequest(request, sendResponse) {
  const startTime = Date.now();
  
  try {
    
    const { text, targetLang, sourceLang, customPrompt } = request;
    
    // Get API key
    const apiKey = await getValidApiKey();
    if (!apiKey) {
      throw new Error('No valid API key available');
    }
    
    // Use enhanced translation with retries and fallback models
    const result = await translateWithCustomPrompt(
      apiKey, 
      text, 
      targetLang, 
      sourceLang, 
      customPrompt
    );
    
    const duration = Date.now() - startTime;
    
    sendResponse({
      success: true,
      text: result,
      duration: duration,
      retryEnhanced: true
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ENHANCED: Translation failed after ${duration}ms:`, error);
    
    // Provide more specific error messages
    let errorMessage = error.message;
    
    if (error.message.includes('500')) {
      errorMessage = 'Together.xyz servers are experiencing issues. This has been automatically retried.';
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      errorMessage = 'Rate limit reached. Please wait a moment before trying again.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timed out. Together.xyz servers may be busy.';
    } else if (error.message.includes('All translation attempts failed')) {
      errorMessage = 'All backup systems failed. Together.xyz service may be down.';
    }
    
    sendResponse({
      success: false,
      error: errorMessage,
      duration: duration,
      retryEnhanced: true
    });
  }
}

// NEW: Batch translation request handler
async function handleBatchTranslationRequest(request, sendResponse) {
  const startTime = Date.now();

  try {
    const { messagesArray, targetLang, sourceLang, customPrompt } = request;

    // Validate input
    if (!messagesArray || !Array.isArray(messagesArray) || messagesArray.length === 0) {
      throw new Error('Invalid messages array for batch translation');
    }

    // Get API key
    const apiKey = await getValidApiKey();
    if (!apiKey) {
      throw new Error('No valid API key available');
    }

    console.log(`📦 Processing batch translation request for ${messagesArray.length} messages`);

    // Call batch translation function
    const translations = await batchTranslateWithCustomPrompt(
      apiKey,
      messagesArray,
      targetLang,
      sourceLang,
      customPrompt
    );

    const duration = Date.now() - startTime;

    console.log(`✅ Batch translation completed in ${duration}ms`);

    sendResponse({
      success: true,
      translations: translations,
      duration: duration,
      batchSize: messagesArray.length
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Batch translation failed after ${duration}ms:`, error);

    sendResponse({
      success: false,
      error: error.message,
      duration: duration
    });
  }
}

// Get valid API key function (existing)
async function getValidApiKey() {
  try {
    const result = await chrome.storage.sync.get(['togetherApiKey']);
    return result.togetherApiKey || null;
  } catch (error) {
    console.error('Failed to get API key:', error);
    return null;
  }
}

// Enhanced message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Handle ping to wake up service worker
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Service worker is awake' });
    return true;
  }

  if (request.action === 'translate') {
    handleTranslationRequest(request, sendResponse);
    return true;
  }

  // NEW: Batch translation handler
  if (request.action === 'batchTranslate') {
    handleBatchTranslationRequest(request, sendResponse);
    return true;
  }

  // MAKE SURE THIS IS PRESENT:
  if (request.action === 'ai_suggestions') {
    handleAISuggestionsRequest(request, sendResponse);
    return true;
  }
  
  if (request.action === 'testApiKey') {
    handleApiKeyTest(request, sendResponse);
    return true;
  }
  
  if (request.action === 'updateBadge') {
    updateExtensionBadge(request.status);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'checkAuthentication') {
    checkApiKeyAuthentication(request.apiKey)
      .then(result => {
        sendResponse({ authenticated: result });
      })
      .catch(error => {
        sendResponse({ authenticated: false, error: error.message });
      });
    return true;
  }
});

// API key authentication function (existing - keep your current implementation)
async function checkApiKeyAuthentication(apiKey) {
  try {
    
    if (!apiKey || apiKey.length < 10) {  // Minimum reasonable length
      return false;
    }
    
    // Test with Together.xyz API
    const response = await fetch('https://api.together.xyz/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    console.warn('⚠️ Background: API authentication test failed:', error);
    return false;
  }
}



// API key test handler - validates API key with Firebase whitelist database
async function handleApiKeyTest(request, sendResponse) {
  try {
    console.log('🔥 Background: Testing API key with Firebase whitelist validation');
    const { apiKey } = request;
    
    if (!apiKey || apiKey.trim().length < 10) {  // Minimum reasonable length
      console.log('❌ Background: Invalid API key format');
      sendResponse({ success: false, error: 'Invalid API key format' });
      return;
    }
    
    // Use the same Firebase validation logic as popup.js
    const validation = await validateApiKeyWithFirebase(apiKey);
    
    if (validation.success) {
      console.log('✅ Background: API key validated successfully with Firebase');
      sendResponse({ success: true });
    } else {
      console.log('❌ Background: API key validation failed:', validation.error);
      sendResponse({ 
        success: false, 
        error: validation.error
      });
    }
    
  } catch (error) {
    console.error('❌ Background: API key test error:', error);
    sendResponse({ 
      success: false, 
      error: `API key validation failed: ${error.message}`
    });
  }
}

// Firebase validation function - checks whitelist database
async function validateApiKeyWithFirebase(apiKey) {
  try {
    console.log('🔥 Background: Validating API key with Firebase whitelist database');
    
    // Use the exact API key as stored (don't change case)
    const normalizedKey = apiKey.trim();
    
    console.log(`🔥 Background: Looking for key in Firebase: ${normalizedKey.substring(0, 10)}...`);
    
    // Firebase REST API call to check if key exists in whitelist
    // Using your authentication Firebase database
    const firebaseUrl = `https://authentication-4f34f-default-rtdb.asia-southeast1.firebasedatabase.app/whitelisted_apis/${normalizedKey}.json`;
    
    console.log(`🔥 Background: Firebase URL: ${firebaseUrl}`);
    
    const response = await fetch(firebaseUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Firebase API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`🔥 Background: Firebase response:`, data);
    
    // Check if data exists and has the right structure
    if (data !== null && typeof data === 'object') {
      console.log(`🔥 Background: Found data in Firebase:`, data);
      
      // Check for active status if it exists, otherwise assume active
      const status = data.status || 'active';
      
      if (status === 'active') {
        // Update last access time
        await updateLastAccessInBackground(normalizedKey);
        
        console.log('✅ Background: Firebase validation successful - API key is licensed and active');
        return {
          success: true,
          license: normalizedKey,
          customer_name: data.customer_name || 'Licensed User',
          added_date: data.added_date || 'Unknown'
        };
      } else {
        console.log(`❌ Background: Firebase validation failed - License status: ${status}`);
        return {
          success: false,
          error: `License is ${status}. Please contact support.`
        };
      }
    } else {
      console.log('❌ Background: Firebase validation failed - API key not found in license database');
      console.log('🔍 Background: Exact Firebase response:', JSON.stringify(data));
      return {
        success: false,
        error: 'API key not found in license database. Please verify your licensed Together.xyz API key is properly registered.'
      };
    }
    
  } catch (error) {
    console.error('❌ Background: Firebase validation error:', error);
    return {
      success: false,
      error: `License validation failed: ${error.message}`
    };
  }
}

// Update last access in Firebase from background script
async function updateLastAccessInBackground(licenseKey) {
  try {
    const updateUrl = `https://authentication-4f34f-default-rtdb.asia-southeast1.firebasedatabase.app/whitelisted_apis/${licenseKey}/last_access.json`;
    const response = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(new Date().toISOString())
    });
    
    if (response.ok) {
      console.log(`📝 Background: Updated last access for ${licenseKey}`);
    } else {
      console.warn('⚠️ Background: Failed to update last access:', response.status);
    }
  } catch (error) {
    console.warn('⚠️ Background: Failed to update last access:', error);
  }
}

// Extension badge update (existing)
function updateExtensionBadge(status) {
  // Remove badge completely - no green box at all
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] }); // Transparent
}
// Handle AI suggestions requests
async function handleAISuggestionsRequest(request, sendResponse) {
  try {
    
    const { prompt } = request;
    
    // Get API key
    const apiKey = await getValidApiKey();
    if (!apiKey) {
      throw new Error('No valid API key available');
    }
    
    // Call Together.xyz API for AI suggestions
    const result = await callAIForSuggestions(apiKey, prompt);
    
    sendResponse({
      success: true,
      text: result
    });
    
  } catch (error) {
    console.error('❌ AI suggestions failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// AI suggestions function
async function callAIForSuggestions(apiKey, prompt) {
  
  const requestBody = {
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages: [
      { 
        role: "system", 
        content: "You are a dating conversation assistant. Generate exactly 3 numbered English reply suggestions for romantic conversations. Always respond in English. Provide exactly 3 numbered suggestions."
      },
      { role: "user", content: prompt }
    ],
          max_tokens: 300,
          temperature: 0.7,
          top_p: 0.9,
          stop: [
        "\n\nExplanation",
        "\n\nNote:", 
        "\n\n",
        "Explanation:",
        "Note:"
      ]
  };

  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`AI suggestions API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from AI suggestions API');
  }

  return data.choices[0].message.content.trim();
}
// Initialize
updateExtensionBadge('success');
