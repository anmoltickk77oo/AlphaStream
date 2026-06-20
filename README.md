# AlphaStream

AlphaStream is a Real-Time Financial WebSocket Ingestion Engine built with a full-stack JavaScript architecture.

## Overview

The project connects to raw financial WebSocket streams (e.g., Binance for BTC/USDT) and seamlessly delivers high-frequency trade data to a modern React dashboard. It intelligently manages high-volume data by using a dual-path pipeline:
1.  **Fast Path:** Broadcasts live, unthrottled price updates directly to connected web clients via `Socket.IO`.
2.  **Slow Path:** Throttles database insertions to maintain a historical ledger in PostgreSQL, preventing database overload while preserving essential history.

## Tech Stack

### Frontend (Client)
*   **React + Vite:** For a lightning-fast modern development environment and optimized production builds.
*   **Recharts:** For rendering dynamic, responsive historical price charts.
*   **Socket.IO-Client:** To receive sub-second market data ticks from the backend.
*   **Custom Hooks (`useMarketData`):** Seamlessly merges historical DB records with the live WebSocket stream.

### Backend (Server)
*   **Node.js + Express:** A robust REST API serving historical snapshot data.
*   **Socket.IO:** A WebSocket server for pushing live updates to the frontend terminal.
*   **PostgreSQL (`pg`):** The persistent ledger database for historical snapshots.
*   **ws:** To maintain the raw connection to the exchange (e.g., Binance).

## Getting Started

### Prerequisites
*   Node.js (v18+)
*   PostgreSQL running locally or accessible via URL.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/AlphaStream.git
    cd AlphaStream
    ```

2.  **Install Server Dependencies:**
    ```bash
    cd server
    npm install
    ```

3.  **Install Client Dependencies:**
    ```bash
    cd ../client
    npm install
    ```

4.  **Environment Setup:**
    *   Create a `.env` file in the `server` directory and add your `DATABASE_URL` and `PORT`.

5.  **Run the Application:**
    *   Start the server: `npm run dev` (inside `server/`)
    *   Start the frontend: `npm run dev` (inside `client/`)
