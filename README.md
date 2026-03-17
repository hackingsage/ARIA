# ARIA AI Assistant

ARIA is a personal Web-based AI Assistant powered by OpenRouter. It features real-time chat, a customizable "skills" system, task automation, and persistent memory.

## Features

*   **Real-time AI Chat**: WebSocket-powered chat interface communicating with OpenRouter models.
*   **Skills System**: Extend ARIA's capabilities by writing custom JavaScript snippets that the AI can trigger based on conversation context.
*   **Automations**: Set up cron-based automated tasks that run scripts in the background.
*   **Memory & History**: Persistent conversation history and a specific "memory" system to store facts or user preferences.
*   **Local Database**: Uses SQLite (`better-sqlite3`) to efficiently store conversations, memories, skills, and automations locally.
*   **API Usage Tracking**: View OpenRouter credit and API usage directly from the UI.
*   **Rich UI Presentation**: Frontend supports Markdown rendering, math equations (LaTeX), and a modern dark-mode interface.

## Tech Stack

*   **Backend**: Node.js, Express, WebSockets (`ws`), `better-sqlite3`
*   **Frontend**: Vanilla HTML/CSS/JavaScript with real-time DOM updates.
*   **AI Integration**: OpenRouter API

## Prerequisites

*   Node.js (v18+ recommended)
*   An [OpenRouter](https://openrouter.ai/) API Key

## Installation

1.  Clone this repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the application:
    ```bash
    npm start
    ```
4.  Open your browser and navigate to `http://localhost:3000`.

## Configuration

When you first open the app, go to the **Settings** section in the UI to enter your OpenRouter API Key. Once saved, you can select which AI model you want to use from the available OpenRouter models list.

## Usage

*   **Chat**: Interact with the AI normally. The AI has access to pre-defined tools and your custom "skills".
*   **Skills**: Navigate to the Skills tab to define new JavaScript functions. The AI can decide to run these skills based on the context of your conversation.
*   **Automations**: Go to the Automations tab to set up cron jobs (e.g., `0 9 * * *` for 9 AM daily) that can trigger specific actions or skills autonomously.

## License

MIT License
