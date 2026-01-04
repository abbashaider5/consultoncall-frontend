# Assets Directory

This directory contains static assets for the application.

## Audio Files

### new-message-tone.mp3
This file should contain the notification sound played when a new chat message arrives.

**Requirements:**
- Format: MP3
- Duration: Short (1-3 seconds recommended)
- Volume: Moderate (not too loud)
- Type: Subtle notification tone

**To add the sound:**
1. Place your audio file in this directory as `new-message-tone.mp3`
2. The file will be automatically loaded by the chat system
3. Recommended to use a free notification sound from sites like:
   - https://www.soundjay.com/buttons/sounds-1.html
   - https://freesound.org/
   - Or use any preferred short notification tone

**Current Status:**
- File is referenced in code but needs to be added
- The chat system will gracefully handle missing files
- No errors will occur if file is not present
