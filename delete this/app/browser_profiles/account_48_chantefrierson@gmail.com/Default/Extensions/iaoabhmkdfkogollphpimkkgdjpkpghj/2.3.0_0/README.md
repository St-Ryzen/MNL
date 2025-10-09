# Linguana Pro Together.xyz AI Translator Extension

## Overview
Linguana Pro is an advanced Chrome extension that provides AI-powered translation services for the Maloum dating platform. It integrates with Together.xyz's Llama 3.3 70B Instruct Turbo model to provide real-time translation between English and German with a focus on dating conversation contexts.

## Features

### 🔥 Real-Time Translation
- Instant translation of incoming messages to English
- Automatic translation of outgoing messages to German
- Support for explicit/adult content without censorship
- Preservation of emotional tone (flirty, sarcastic, casual, serious)

### 💾 Intelligent Caching
- Ultra-fast cache system for repeated translations
- EN↔DE translation pairs only for optimal performance
- Export/import functionality for backup and sharing
- Automatic cache warming on initialization

### 🤖 AI Assistant Integration
- Smart reply suggestions for dating conversations
- Context-aware responses that match conversation tone
- Flirty, witty, and engaging response generation
- Three professionally crafted reply options per request

### 😎 User Experience
- Seamless integration with Maloum's chat interface
- Keyboard shortcuts for quick access (Alt+J, Alt+K, Alt+L)
- Beautiful Mac-style UI with smooth animations
- Real-time usage statistics and cost tracking

### 🔐 Secure Authentication
- Firebase-based license validation system
- Ultra-persistent authentication cache to minimize server calls
- Licensed Together.xyz API key validation (validated through Firebase licensing system)
- Zero Firebase calls after initial authentication

## Installation

1. Download the extension files
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the linguana folder
5. Pin the extension to your toolbar for easy access

## Setup

### Prerequisites
- Valid Together.xyz API key (validated through Firebase licensing system)
- Access to Maloum.com dating platform

### Configuration Steps
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

### Cache Management
- View all cached translations in the cache manager
- Search and filter translations by language pair
- Export translations to JSON/CSV for backup
- Import translations from backup files
- Clear cache when needed

## Technical Architecture

### Core Technologies
- **Together.xyz API**: Llama 3.3 70B Instruct Turbo model
- **Firebase**: Real-time database for license validation and usage tracking
- **IndexedDB**: Persistent storage for translation cache
- **Chrome Extensions API**: Content scripts, background service workers, storage

### Translation Pipeline
1. Message detection in Maloum chat interface
2. Language identification and validation (EN↔DE only)
3. Cache lookup for previously translated content
4. API call to Together.xyz for new translations
5. Result caching for future use
6. UI update with translated content

### Performance Optimizations
- Ultra-persistent authentication cache (zero Firebase calls after first validation)
- Dual-layer caching (in-memory + IndexedDB)
- Debounced DOM operations to prevent performance issues
- Efficient data structures for fast cache lookups

## Troubleshooting

### Common Issues

#### Translation Not Working
1. Check that your Together.xyz API key is properly entered and validated
2. Verify you're on the Maloum.com domain
3. Ensure the extension is enabled and authorized
4. Check that your API key has sufficient credits

#### Cache Manager Not Opening
1. Press Alt+K or click the cache button in the translation interface
2. Ensure no other Linguana UI components are open
3. Check browser console for error messages
4. Restart the extension if needed

#### Authentication Errors
1. Verify your API key is properly licensed in the Firebase database
2. Confirm your key is registered in the Firebase whitelist
3. Check internet connectivity
4. Try re-authenticating in the popup

### Debugging Tools
The extension includes comprehensive debugging tools accessible via the browser console:
- `window.debugOptimizedHandler` - Content script diagnostics
- `window.maloumCacheManager.debug()` - Cache system diagnostics
- `window.maloumPromptManager.debug()` - Prompt system diagnostics

## Privacy & Security

### Data Handling
- All translations are processed through Together.xyz's secure API
- No personal messages are stored on Linguana's servers
- Firebase is used only for license validation and anonymous usage tracking
- API keys are stored securely in Chrome's sync storage

### Usage Tracking
- Anonymous usage statistics are collected for performance optimization
- Character counts and translation requests are tracked
- No personally identifiable information is stored
- Usage data helps improve the extension's performance

## Support

For issues, feature requests, or questions, please contact:
- Email: linguana-translator@outlook.com

## Version Information
Current Version: 2.3.0
Release Date: September 2025

## License
This extension is licensed for exclusive use by Agency X. Unauthorized distribution or use is prohibited.