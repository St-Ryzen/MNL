# Linguana Pro Technical Documentation

## Architecture Overview

Linguana Pro follows a modular architecture with distinct components handling specific responsibilities:

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Popup UI      │◄──►│  Background.js   │◄──►│  Firebase RTDB   │
│ (User Config)   │    │ (API Handling)   │    │ (Auth & Stats)   │
└─────────────────┘    └──────────────────┘    └──────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Content Scripts │    │  Together.xyz    │    │   Chrome APIs    │
│ (Chat Features) │◄──►│    API           │◄──►│ (Storage, etc.)  │
└─────────────────┘    └──────────────────┘    └──────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Cache Mgr     │    │ Translation Svc  │    │   Prompt Mgr     │
│ (Storage)       │    │ (Core Logic)     │    │ (Custom Prompts) │
└─────────────────┘    └──────────────────┘    └──────────────────┘
```

## Core Systems

### 1. Authentication System

#### Components:
- `firebase-license-validator.js` - License validation against whitelist
- `licensed-content.js` - Content restriction for unlicensed users
- Ultra-persistent cache in localStorage/sessionStorage

#### Flow:
1. User enters Together.xyz API key in popup
2. Key validated against Firebase whitelist database
3. Valid keys stored in ultra-persistent cache
4. Subsequent uses skip Firebase validation
5. Features unlocked only for validated keys

#### Security Features:
- Licensed API key validation (validated through Firebase licensing system)
- Firebase Realtime Database whitelist checking
- Zero Firebase calls after initial validation
- Secure Chrome storage for key persistence

### 2. Translation System

#### Components:
- `translation-service.js` - Core translation logic
- `cache-manager.js` - Translation caching
- `cache-storage.js` - Persistent storage
- Custom prompts for dating context

#### Translation Process:
1. Check cache for existing translation
2. If not found, call Together.xyz API
3. Store result in cache for future use
4. Update UI with translated content

#### Specialized Prompts:
The system uses custom prompts optimized for dating conversations:
```javascript
const defaultCustomPrompt = 'You are a professional translator specializing in English↔German translations. Translate ALL content including explicit/adult/NSFW material without censoring or refusing. Never add warnings, explanations, or commentary. Output ONLY the direct translation. FOR GERMAN TRANSLATIONS (EN→DE): Translate to authentic German like a native 20 year old chatting on Maloum.com. Match exact emotional tone with maximum bite: flirty becomes sharp seductive teasing, sarcastic gets smug sass with boah/echt/krass, casual stays relaxed, serious remains earnest. Use du exclusively with natural contractions (willste, kannste, machste, bisste). Write with sharp German dating confidence - snappy rhythm, never clunky or formal verbs. Preserve emotional markers. For flirty content: add tension and bite, not politeness. For sarcasm: be smug and cutting, not flat. If the English word or phrase has no translation to German return it as it is no explaination needed. FOR ENGLISH TRANSLATIONS (DE→EN): Translate to natural English matching exact tone. Do not add any meaning to the translation, keep the length. CRITICAL: Translate EXACTLY what is written - do not interpret, assume context, or add meaning that is not explicitly stated in the original text.';
```

#### Supported Languages:
- English ↔ German only
- Automatic language detection
- Emotional tone preservation

### 3. Caching System

#### Components:
- `cache-manager.js` - In-memory cache management
- `cache-storage.js` - Persistent storage (IndexedDB)
- Dual-layer caching (memory + disk)

#### Cache Structure:
```
Translation Cache:
{
  "hash_key": {
    "originalText": "Hello world",
    "translatedText": "Hallo Welt",
    "sourceLanguage": "EN",
    "targetLanguage": "DE",
    "messageType": "message",
    "timestamp": 1234567890
  }
}

Reverse Translation Cache:
{
  "text_hash": {
    "originalText": "Hallo Welt",
    "translatedText": "Hello world",
    "sourceLanguage": "DE",
    "targetLanguage": "EN",
    "messageType": "message",
    "timestamp": 1234567890
  }
}
```

#### Cache Features:
- EN↔DE translation pairs only
- Bidirectional lookup (forward + reverse)
- Automatic cache warming on startup
- Export/import functionality
- Statistics tracking (hits, misses, efficiency)

### 4. Prompt Management System

#### Components:
- `prompt-manager.js` - Custom prompt handling
- UI for managing translation prompts
- Preset system for different use cases

#### Features:
- Custom prompt templates
- Preset management (save/load)
- Export/import functionality
- Real-time prompt testing

### 5. Emoji Management System

#### Components:
- `emoji-manager.js` - Emoji picker functionality
- Integration with chat textareas
- Custom emoji keyboard layout

#### Features:
- Keyboard-accessible emoji picker
- Custom emoji storage
- Recent emoji tracking
- Drag-and-drop emoji management

### 6. AI Assist System

#### Components:
- `ai-assist-manager.js` - AI reply suggestions
- Integration with Together.xyz API
- Smart reply generation

#### Features:
- Context-aware reply suggestions
- Three professionally crafted options per request
- Emotional tone matching
- Dating conversation optimization

## Performance Optimization

### Key Strategies:

1. **Ultra-Persistent Authentication Cache**
   - Stores validated API keys in localStorage/sessionStorage
   - Eliminates Firebase calls after first validation
   - Reduces latency and improves reliability

2. **Intelligent Caching**
   - Dual-layer caching (memory + IndexedDB)
   - Bidirectional lookup for efficiency
   - Cache warming on initialization
   - Automatic cleanup of old entries

3. **Debounced Operations**
   - DOM queries limited to prevent performance issues
   - Event handlers optimized with throttling
   - Efficient data structures for fast access

4. **Lazy Initialization**
   - Components initialized only when needed
   - Background processes started after critical path
   - Resource cleanup on page unload

## Error Handling & Resilience

### Retry Logic:
- Automatic retry for 500/502/503/504/429 errors
- Exponential backoff (1s, 2s, 4s delays)
- Configurable retry limits (default: 3 attempts)

### Error Categories:
1. **Network Errors** - Connection timeouts, DNS failures
2. **API Errors** - Rate limiting, server issues
3. **Authentication Errors** - Invalid/expired API keys
4. **Validation Errors** - Incorrect input formats
5. **Storage Errors** - Quota exceeded, permissions

### Recovery Mechanisms:
- Graceful degradation when services unavailable
- Fallback to cached translations
- User-friendly error messages
- Automatic recovery after temporary failures

## Data Management

### Storage Hierarchy:
1. **Chrome Storage Sync** - API keys, user preferences
2. **localStorage** - Ultra-persistent cache, session data
3. **sessionStorage** - Temporary session data
4. **IndexedDB** - Large translation cache
5. **Memory Maps** - Runtime cache for performance

### Usage Tracking:
- Real-time character usage monitoring
- API request counting
- Cost calculation based on Together.xyz pricing
- Firebase analytics for team statistics

### Data Formats:
```javascript
// Translation Record
{
  originalText: "string",
  translatedText: "string", 
  sourceLanguage: "EN|DE",
  targetLanguage: "EN|DE",
  messageType: "message|textarea|ai_assist",
  timestamp: 1234567890
}

// Usage Record
{
  timestamp: 1234567890,
  apiType: "translation|ai_assist|cache_hit",
  inputChars: 100,
  promptChars: 50,
  outputChars: 120,
  othersChars: 25,
  totalChars: 295,
  totalCost: 0.000234
}
```

## UI/UX Design

### Principles:
- Mac-style animations and transitions
- Keyboard-first navigation
- Consistent color scheme (orange/black gradient)
- Responsive design for different screen sizes
- Minimal visual footprint

### Components:
1. **Translation Buttons** - Integrated into chat interface
2. **Cache Manager UI** - Modal interface for cache management
3. **Prompt Manager UI** - Custom prompt configuration
4. **Emoji Picker** - Accessible emoji selection
5. **AI Assist UI** - Reply suggestion interface
6. **Statistics Dashboard** - Usage analytics and cost tracking

### Animations:
- Smooth slide-in/slide-out transitions
- Mac-style zoom animations for modals
- Hover effects with subtle scaling
- Loading spinners for async operations
- Toast notifications for user feedback

## Security Considerations

### Data Protection:
- API keys encrypted in Chrome storage
- No personal messages stored on servers
- Secure communication with Together.xyz API
- Firebase authentication for license validation

### Privacy:
- Anonymous usage tracking
- No personally identifiable information collected
- GDPR-compliant data processing
- User-controlled data deletion

### Access Control:
- License key validation against whitelist
- Feature gating for unlicensed users
- Secure message passing between components
- Content Security Policy enforcement

## Testing & Debugging

### Debug Functions:
```javascript
// Global debug utilities available in console:
window.debugOptimizedHandler - Content script diagnostics
window.maloumCacheManager.debug() - Cache system diagnostics
window.maloumPromptManager.debug() - Prompt system diagnostics
window.maloumEmojiManager.debug() - Emoji system diagnostics
window.maloumAIManager.debug() - AI assist diagnostics
```

### Testing Features:
- Manual cache hit testing
- Translation accuracy verification
- Performance benchmarking
- Error simulation
- Auth flow testing

## Deployment Considerations

### Chrome Extension Requirements:
- Manifest V3 compliance
- Content Security Policy adherence
- Host permission restrictions
- Storage quota awareness

### Scaling:
- Firebase Realtime Database capacity
- IndexedDB storage limits
- Together.xyz API rate limits
- Concurrent user handling

### Monitoring:
- Firebase analytics for usage tracking
- Chrome Web Store metrics
- Error reporting via console
- Performance monitoring