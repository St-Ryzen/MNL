# Linguana Pro Together.xyz AI Translator Extension - Project Summary

## Project Overview
Linguana Pro is a Chrome extension that provides AI-powered translation services for the Maloum dating platform. It integrates with Together.xyz's Llama 3.3 70B Instruct Turbo model to provide real-time translation between English and German with a focus on dating conversation contexts.

## Core Architecture

### Main Components
1. **Background Script** (`background.js`) - Handles API communications and authentication
2. **Content Script** (`content.js`) - Injects functionality into Maloum.com
3. **Popup UI** (`popup.html/popup.js`) - User settings and authentication interface
4. **Translation Service** (`translation-service.js`) - Core translation logic
5. **Cache Manager** (`cache-manager.js`) - Handles translation caching and storage
6. **Prompt Manager** (`prompt-manager.js`) - Manages custom translation prompts
7. **Firebase License Validator** (`firebase-license-validator.js`) - Validates API keys against whitelist
8. **Emoji Manager** (`emoji-manager.js`) - Emoji picker functionality
9. **AI Assist Manager** (`ai-assist-manager.js`) - AI-generated reply suggestions
10. **Tracker** (`tracker.js`) - Usage statistics and analytics

### Key Technologies
- **Together.xyz API** - Llama 3.3 70B Instruct Turbo model for translations
- **Firebase** - Real-time database for license validation and usage tracking
- **IndexedDB** - Persistent storage for translation cache
- **Chrome Extensions API** - Content scripts, background service workers, storage

## Authentication System

### License Validation Flow
1. User enters Together.xyz API key in popup
2. Key is validated against Firebase whitelist database
3. Valid keys are stored in ultra-persistent cache (localStorage/sessionStorage)
4. Subsequent uses skip Firebase validation using cache
5. Extension features are unlocked only for validated keys

### Security Features
- Ultra-persistent authentication cache to minimize Firebase calls
- Licensed API key validation (validated through Firebase licensing system)
- Secure storage in Chrome sync storage
- Zero Firebase calls after initial validation

## Translation System

### Core Functionality
- Real-time message translation in chat (EN↔DE)
- Textarea translation for outgoing messages
- Support for explicit/adult content without censorship
- Emotional tone preservation (flirty, sarcastic, casual, serious)

### Specialized Prompts
The extension uses custom prompts optimized for dating conversations:
- Translation to authentic German like a native 20-year-old
- Preservation of emotional markers and tone
- Use of colloquial German expressions (du, willste, kannste, etc.)
- Context-aware responses that match conversation style

### Translation Pipeline
1. Message detection in Maloum chat interface
2. Language identification and validation (EN↔DE only)
3. Cache lookup for previously translated content
4. API call to Together.xyz for new translations
5. Result caching for future use
6. UI update with translated content

## Caching System

### Storage Strategy
- Dual-layer caching (in-memory Map + IndexedDB)
- EN↔DE translation pairs only
- Automatic cache warming on initialization
- Export/import functionality for backup

### Performance Features
- Intelligent caching to reduce API calls
- Cache hit tracking for analytics
- Automatic cleanup of old cache entries
- Reverse lookup for bidirectional translation

## User Interface

### Chat Integration
- Translation buttons on individual messages
- Textarea translation button for outgoing messages
- Real-time translation of incoming messages
- Visual indicators for translation status

### Management Interfaces
- **Cache Manager** - View/edit cached translations
- **Prompt Manager** - Customize translation prompts
- **Emoji Picker** - Enhanced emoji selection
- **Statistics Dashboard** - Usage analytics and cost tracking

### Keyboard Shortcuts
- **Alt + J** - Translate current message or textarea content
- **Alt + K** - Open cache manager
- **Alt + L** - Open emoji picker
- **Alt + M** - Focus on message textarea
- **Alt + G** - Open gallery vault

## Performance Optimization

### Efficiency Measures
- Ultra-persistent authentication cache (zero Firebase calls after first validation)
- Debounced DOM operations to prevent performance issues
- Efficient data structures for fast cache lookups
- Lazy initialization of heavy components

### Error Handling
- Automatic retry logic for 500/502/503/504/429 errors
- User-friendly error messages
- Graceful degradation when services unavailable
- Detailed logging for debugging

## Data Management

### Usage Tracking
- Real-time usage statistics collection
- Character count tracking for cost calculation
- API request monitoring
- Cache efficiency metrics

### Storage Locations
- **Chrome Storage Sync** - API keys and user preferences
- **localStorage/sessionStorage** - Ultra-persistent cache
- **IndexedDB** - Translation cache storage
- **Firebase** - License validation and analytics

## File Structure
```
linguana/
├── manifest.json                 # Extension manifest
├── background.js                 # Background service worker
├── content.js                   # Main content script
├── popup.html                   # Extension popup UI
├── popup.js                     # Popup functionality
├── styles.css                   # Global styles
├── icons/                       # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   └── icon128.png
├── ai-assist-manager.js         # AI assistant functionality
├── cache-manager.js             # Translation caching system
├── cache-storage.js             # Persistent cache storage
├── emoji-manager.js             # Emoji management
├── firebase-license-validator.js # License validation
├── licensed-content.js          # Licensed content handling
├── prompt-manager.js            # Custom prompt management
├── tracker.js                   # Usage tracking
└── translation-service.js       # Translation service wrapper
```

## Development Notes

### Best Practices Implemented
- Modular architecture with separate managers for each feature
- Singleton pattern for global instances
- Event-driven architecture with message passing
- Comprehensive error handling and logging
- Memory leak prevention through proper cleanup

### Debugging Features
- Global debug functions for each component
- Console logging with consistent prefixes
- Performance monitoring and metrics
- Error simulation and testing tools

## Privacy & Security

### Data Handling
- All translations processed through Together.xyz's secure API
- No personal messages stored on Linguana's servers
- Firebase used only for license validation and anonymous usage tracking
- API keys stored securely in Chrome's sync storage

### Compliance
- Together.xyz API terms of service compliance
- Chrome Web Store policy adherence
- GDPR-compliant data processing
- Secure handling of user authentication