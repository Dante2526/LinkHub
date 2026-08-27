---
name: firebase-environment
description: Describes the Firebase environment configuration and database structure for other agents.
---

# Firebase Configuration & Database Structure

## Environment Variables
The Firebase environment credentials for this project are configured **directly in the Cloudflare Pages deploy environment variables**, and NOT in a local `.env` file for production. 
When making changes to Firebase initialization or connection logic, do not expect `.env` variables to be present locally unless the user is specifically running a local development server with their own `.env`. In production (Cloudflare Pages), the environment handles these variables.

## Database Structure (Firestore)
Currently, the application uses a single document to store all the state.

**Collection Name:** `profiles`
**Document Name:** `main`

### Data Saved (AppData type)
The `profiles/main` document contains the following data structure:
1. `profile`: Basic user information (`name`, `bio`, `avatarUrl`).
2. `theme`: All visual settings (`backgroundType`, `backgroundColor`, `buttonStyle`, `fontFamily`, etc.).
3. `links`: An array of link objects. Each link stores `id`, `title`, `url`, `thumbnailUrl`, `isVisible`, and analytics like `clicks` and `clickTimestamps`.
4. `views`: An integer tracking total page views.

All updates to the application state (links added, theme changed, link clicks, profile views) are serialized and saved back to this single `profiles/main` document.
