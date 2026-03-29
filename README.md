<div align="center">
  <h1>🤖 ARIA AI Assistant</h1>
  <p><strong>Your Personal Web-based AI Assistant powered by OpenRouter</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Status-Active-success.svg?style=flat-square" alt="Status" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/Node.js-v18+-green.svg?style=flat-square" alt="Node" />
    <img src="https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  </p>
</div>

<hr/>

ARIA is a highly customizable, real-time AI assistant that acts as a secure front-end for your OpenRouter API key. It goes beyond simple chat by offering persistent memory, extensible skills, and background task automation.

## ✨ Key Features

*   **Real-time AI Chat**: Blazing fast WebSocket-powered streaming for a "live typing" experience.
*   **Custom Skills** (in dev): Write JavaScript snippets directly in the UI. ARIA can autonomously trigger these skills based on your conversation.
*   **Automations** (in dev): Schedule cron-based tasks (e.g., Daily Summaries at 9 AM) that run securely in the background.
*   **Image and Video support** (in dev): Supports image and video generation from supported models
*   **Persistent Memory**: ARIA remembers facts, preferences, and past context using a dedicated long-term memory system.
*   **Local & Secure Data**: Everything (conversations, memories, skills) lives locally in a SQLite database.
*   **Usage Tracking**: Monitor your OpenRouter token usage and costs directly from the dashboard.
*   **Rich Media Support**: Renders Markdown, syntax-highlighted code blocks, and complex math equations via LaTeX.

---

## 🏗️ Tech Stack

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" alt="Express" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JS" />
</div>

---

## 🚀 Getting Started

You will need an [OpenRouter](https://openrouter.ai/) API Key to power the AI models.

### 🐳 Option 1: Docker (Recommended)
The easiest way to run ARIA while keeping your system clean and ensuring data persistence.

1. Clone the repository:
   ```bash
   git clone https://github.com/hackingsage/AI-Assistant.git
   cd AI-Assistant-main
   ```
2. Start the container:
   ```bash
   docker-compose up --build -d
   ```
3. Open your browser and navigate to `http://localhost:3000`.

### 💻 Option 2: Local Installation
Requires Node.js v18+.

1. Clone the repository:
   ```bash
   git clone https://github.com/hackingsage/AI-Assistant.git
   cd AI-Assistant-main
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3000`.

---

## ⚙️ Configuration & Usage

Once ARIA is running:

1. **API Key**: Click on the **Settings** icon (gear) in the bottom left corner. Enter your OpenRouter API key and click Save.
2. **Choose Model**: Select your preferred AI model (e.g., Claude 3.5 Sonnet, GPT-4o) from the dropdown in the sidebar.
3. **Chat**: Start typing! ARIA will respond instantly.
4. **Create Skills**: Navigate to the **Skills** tab to write custom JavaScript functions that ARIA can execute. *Example: A skill that fetches the current weather for a city.*
5. **Set Automations**: Go to the **Automations** tab to set up cron schedules that trigger specific skills or generalized prompts automatically.

---

## 📄 License

This project is licensed under the **MIT License**.
