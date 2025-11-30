# Liva

**Liva** is a self-hosted, real-time collaborative whiteboard and note-taking application. It combines the intuitive drawing experience of [Excalidraw](https://excalidraw.com/) with a powerful, serverless backend built on Cloudflare Workers and Durable Objects.

![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-development-orange)
![Stack](https://img.shields.io/badge/stack-Cloudflare%20Workers%20%7C%20React%20%7C%20Durable%20Objects-F38020)

## 🚀 Motivation

We built Liva to bridge the gap between local-first drawing tools and real-time collaborative platforms, without the complexity of managing traditional WebSocket servers or databases.

Existing solutions often fall into two buckets:
1.  **SaaS Silos:** Great collaboration but closed source, expensive, and you don't own your data.
2.  **Local Tools:** Great privacy and speed but lack seamless multi-device sync and collaboration.

Liva provides the best of both worlds:
*   **Ownership:** Self-hostable on your own Cloudflare account.
*   **Simplicity:** Serverless architecture means zero infrastructure maintenance.
*   **Performance:** Edge-native design ensures low latency regardless of user location.

## ✨ Features

*   **🎨 Excalidraw Integration:** Full whiteboard capabilities with hand-drawn style diagrams.
*   **⚡ Real-time Collaboration:** Instant updates across multiple devices using WebSockets. See changes as they happen.
*   **🔒 Secure Authentication:** Integrated Google OAuth via `better-auth`.
*   **☁️ Hybrid Storage:**
    *   **Local Boards:** Private, browser-only boards for quick sketches.
    *   **Remote Boards:** Synced boards stored in the cloud for collaboration.
*   **📝 Version History:** (Internal) Durable Objects maintain state versions, allowing for robust sync and potential rollback capabilities.
*   **🏠 Home Board:** A personal dashboard to organize your thoughts and navigation.

## 🏗️ Architecture

Liva leverages the full power of the Cloudflare Developer Platform to deliver a high-performance, scalable, and cost-effective solution.

### The Stack

*   **Frontend:** React (Vite), TailwindCSS, Radix UI, Excalidraw.
*   **Backend:** Cloudflare Workers (Edge compute).
*   **Database:** Cloudflare D1 (SQLite) for user data and metadata.
*   **State & Sync:** Cloudflare Durable Objects.
*   **API:** tRPC for type-safe client-server communication.

### How it Works

1.  **Stateful Serverless (Durable Objects):**
    Instead of a traditional database + WebSocket server setup, Liva uses **Durable Objects**. Each "Note" or "Board" is assigned a unique Durable Object actor.
    *   This actor holds the *state* of the board in memory.
    *   It handles **WebSocket connections** directly, broadcasting changes to all connected clients instantly.
    *   It persists data to the object's transactional storage, ensuring consistency.

2.  **Edge Routing:**
    Cloudflare Workers route requests to the appropriate Durable Object based on the Board ID. This ensures that all users viewing "Board A" are connected to the exact same coordination point, anywhere in the world.

3.  **Data Persistence:**
    *   **User Profiles & Auth:** Stored in D1 (SQLite at the Edge).
    *   **Board Content:** Stored within Durable Objects for fast read/write and consistency.

### Why This Matters
*   **No Cold Starts:** Durable Objects stay hot while active.
*   **No Race Conditions:** Single-threaded execution per board guarantees data integrity during simultaneous edits.
*   **Infinite Scalability:** Each board is its own "mini-server". 1 million boards = 1 million distributed objects.

## 📚 Documentation

For more detailed technical information, check out the following guides included in the repository:

*   **[WebSocket Guide](WEBSOCKET_GUIDE.md):** Deep dive into the real-time sync implementation.
*   **[Durable Objects Guide](DURABLE_OBJECTS_GUIDE.md):** How we use Cloudflare's actor model.
*   **[SQLite Implementation](SQLITE_IMPLEMENTATION.md):** Database schema and usage.

## 🛠️ Getting Started

### Prerequisites
*   Node.js (v18+ recommended)
*   NPM or Yarn
*   A Cloudflare account

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/liva.git
    cd liva
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.dev.vars` file for local development secrets (or rely on `wrangler.jsonc` defaults for non-sensitive vars).
    ```ini
    # .dev.vars
    BETTER_AUTH_SECRET="your_generated_secret"
    GOOGLE_CLIENT_ID="your_google_client_id"
    GOOGLE_CLIENT_SECRET="your_google_client_secret"
    ```

4.  **Run Local Development**
    This starts both the Vite frontend and the Wrangler worker proxy.
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` (or the port shown in terminal).

### Deployment

Liva is designed to be deployed to Cloudflare Workers.

1.  **Login to Cloudflare**
    ```bash
    npx wrangler login
    ```

2.  **Create D1 Database**
    ```bash
    npx wrangler d1 create liva-db
    # Update the database_id in wrangler.jsonc with the output
    ```

3.  **Run Migrations**
    ```bash
    npx wrangler d1 migrations execute liva-db --remote
    ```

4.  **Deploy**
    ```bash
    npm run deploy
    ```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) (coming soon) for details on our code of conduct, and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

