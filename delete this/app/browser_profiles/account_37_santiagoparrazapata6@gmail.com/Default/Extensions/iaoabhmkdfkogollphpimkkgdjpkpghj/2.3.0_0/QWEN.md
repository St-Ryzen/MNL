# Linguana Pro Together.xyz AI Translator Extension

## Project Overview

Linguana Pro is an advanced Chrome extension that provides AI-powered translation services for the Maloum dating platform. It integrates with Together.xyz's Llama 3.3 70B Instruct Turbo model to provide real-time translation between English and German with a focus on dating conversation contexts.

## Project Architecture

The extension follows a modular architecture with specialized components handling specific responsibilities:

- `manifest.json` - Extension manifest configuration
- `background.js` - Background service worker handling API communication
- `content.js` - Content script injecting functionality into Maloum.com
- `popup.html`/`popup.js` - Extension popup UI for settings and authentication
- `styles.css` - Global CSS styles
- `translation-service.js` - Core translation logic and API integration
- `cache-manager.js` - Translation caching system with EN↔DE optimization
- `cache-storage.js` - Persistent IndexedDB storage for cached translations
- `firebase-license-validator.js` - License validation against Firebase database
- `prompt-manager.js` - Custom translation prompt management
- `emoji-manager.js` - Emoji picker functionality
- `ai-assist-manager.js` - AI-generated reply suggestions
- `tracker.js` - Usage statistics and analytics

## Core Functionality

### Translation System
- Real-time message translation between English and German
- Textarea translation for outgoing messages
- Support for explicit/adult content without censorship
- Emotional tone preservation (flirty, sarcastic, casual, serious)
- Language detection with conservative validation

### Caching System
- Dual-layer caching (in-memory Map + IndexedDB)
- EN↔DE translation pair optimization
- Automatic cache warming on initialization
- Export/import functionality for backup and sharing

### Authentication
- Firebase-based license validation against whitelist
- Ultra-persistent authentication cache to minimize server calls
- Licensed Together.xyz API key validation (any format, validated through Firebase licensing system)
- Zero Firebase calls after initial authentication

### User Interface
- Seamless integration with Maloum's chat interface
- Translation buttons on individual messages
- Textarea translation button for outgoing messages
- Cache manager UI for viewing/editing cached translations
- Keyboard shortcuts (Alt+J, Alt+K, Alt+L, etc.)

## Building and Running

### Prerequisites
- Valid Together.xyz API key (validated through Firebase licensing system)
- Access to Maloum.com dating platform
- Chrome browser with developer mode enabled

### Installation
1. Download or clone the extension files
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the linguana folder
5. Pin the extension to your toolbar for easy access

### Setup
1. Click the Linguana extension icon in your toolbar
2. Enter your Together.xyz API key in the popup
3. The extension will automatically validate your key with Firebase
4. Once validated, translation features will be enabled

## Usage

### Translating Messages
- Incoming German messages are automatically translated to English
- Outgoing English messages are automatically translated to German
- Translation buttons appear on individual messages for manual control
- Textarea translation button appears when writing messages

### Keyboard Shortcuts
- **Alt + J**: Translate current message or textarea content
- **Alt + K**: Open cache manager
- **Alt + L**: Open emoji picker
- **Alt + M**: Focus on message textarea
- **Alt + G**: Open gallery vault

## Development Conventions

### Code Structure
- Modular architecture with separate managers for each feature
- Singleton pattern for global instances
- Event-driven architecture with message passing
- Comprehensive error handling and logging

### Performance Optimization
- Ultra-persistent authentication cache to minimize Firebase calls
- Dual-layer caching (in-memory + IndexedDB) for translation results
- Debounced DOM operations to prevent performance issues
- Efficient data structures for fast cache lookups

### Error Handling
- Automatic retry logic for 500/502/503/504/429 errors
- User-friendly error messages
- Graceful degradation when services unavailable
- Detailed logging for debugging

## APIs and External Services

### Together.xyz API
- Model: meta-llama/Llama-3.3-70B-Instruct-Turbo
- Rate limits and pricing apply per Together.xyz terms
- Custom prompts for dating context translation

### Firebase Realtime Database
- License validation against whitelist
- Usage tracking and analytics
- User activity monitoring

## Technical Implementation Notes

### Translation Pipeline
1. Message detection in Maloum chat interface
2. Language identification and validation (EN↔DE only)
3. Cache lookup for previously translated content
4. API call to Together.xyz for new translations
5. Result caching for future use
6. UI update with translated content

### Security Features
- API keys stored securely in Chrome sync storage
- Firebase authentication for license validation
- Secure message passing between components
- Content Security Policy compliance

### Debugging Tools
- Global debug functions accessible via browser console
- Performance monitoring and metrics
- Error simulation and testing tools
- Component-specific diagnostic functions

## Support and Maintenance

### Troubleshooting
- Check Together.xyz API key format and validity
- Verify Firebase whitelist registration
- Confirm Maloum.com domain access
- Monitor network connectivity

### Privacy & Security
- All translations processed through Together.xyz's secure API
- No personal messages stored on Linguana's servers
- Firebase used only for license validation and anonymous usage tracking
- API keys stored securely in Chrome's sync storage

## Version Information

Current Version: 2.3.0