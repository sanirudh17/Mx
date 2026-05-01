# Mx - The Ultimate Terminal Multiplexer & AI Agent Workspace for Windows 🚀

**Mx** is a next-generation Windows desktop application designed to revolutionize your coding workflow. If you've been searching for a powerful **Tmux alternative for Windows**, or a modernized version of popular macOS terminal multiplexers (like Cmux, iTerm2, or Warp), Mx is exactly what you need. 

Built specifically to seamlessly integrate with local AI coding agents like **Claude Code, OpenCode, Gemini CLI, Pi, and Codex**, Mx provides a unified, persistent workspace to manage all your tasks, terminal sessions, and AI assistants in one elegant, glassmorphic UI.

---

## 🌟 Why Mx? (SEO & Discoverability)
Developers constantly search for the best **terminal multiplexer for Windows**, a **Tmux GUI**, or the **best way to run AI coding agents locally**. Mx answers all of these needs. It goes beyond simple pane splitting by introducing intelligent stream scanning, automated AI agent tracking, and persistent sessions. 

Whether you are a power user heavily relying on terminal workflows or an AI-assisted developer looking for a **Claude Code GUI** or **OpenCode manager**, Mx brings it all together natively on Windows.

---

## ✨ Key Features

### 🔀 Advanced Terminal Multiplexing
*   **Split Panes:** Effortlessly split your terminal horizontally and vertically. Manage dozens of running processes without losing track.
*   **Session Persistence:** Close the app, reboot your PC, and launch Mx again—all your workspaces, split panes, and active directories are saved and restored automatically.
*   **Built-in Command Palette:** Hit `Ctrl+P` (or `Cmd+P`) to quickly navigate between workspaces, launch new agents, or execute custom commands with zero friction.

### 🤖 First-Class AI Coding Agent Integration
*   **Intelligent Stream Scanning:** Mx continuously monitors your terminal output using advanced PTY buffer analysis. It knows exactly when your AI agents (like Gemini, OpenCode, or Claude) are processing, when they need input, and when they finish.
*   **Native Windows Notifications:** Run a heavy 5-minute build or code generation task, minimize the app, and get a native Windows notification the exact moment your AI agent finishes its task or needs your approval.
*   **Slash Command Isolation:** Safe, spam-free detection. Built-in mechanisms to completely mute notifications during internal agent `/sessions` or `/agents` interactions.

### 🎨 Stunning, Modern UI
*   **Glassmorphic Design:** A beautifully crafted interface using standard-setting aesthetics (TailwindCSS, React).
*   **Smooth Animations:** Fluid transitions, responsive layouts, and zero-latency input rendering.
*   **Typographically Tuned:** Powered by Geist and GeistMono fonts for crystal-clear readability during long coding sessions.

### ⚡ Under the Hood (Tech Stack)
*   **Electron & Vite:** Blazing fast startup times and robust desktop integration.
*   **Xterm.js & Node-PTY:** Industry-standard terminal emulation, ensuring 100% compatibility with your shell (PowerShell, CMD, Bash, Zsh).
*   **Zustand & React 19:** State-of-the-art frontend stack for instant state updates across dozens of active terminals.

---

## 🚀 Getting Started

### Prerequisites
*   Windows 10 or 11
*   Node.js (v18 or higher)
*   Git

### Installation
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sanirudh17/Mx.git
    cd Mx
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run in development mode:**
    ```bash
    npm run dev
    ```
4.  **Build the application (Portable or Setup .exe):**
    ```bash
    npm run build
    ```
    *The generated `.exe` files will be placed in the `dist` directory.*

---

## 🛠️ Usage
*   **Launch an Agent:** Open the Command Palette (`Ctrl+P`) and type `opencode`, `claude`, or select from your saved presets.
*   **Manage Workspaces:** Use the sidebar to create dedicated workspaces for different projects.
*   **Background Tasks:** Start a long-running agent command, switch to your browser, and wait for Mx to notify you upon completion.

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/sanirudh17/Mx/issues) if you want to contribute.

## 📝 License
This project is open-source and available under the [MIT License](LICENSE).
