# Postman API Client Clone

A premium, feature-rich API testing environment featuring a beautiful dark-mode interface, request history tracking, collections management, and a CORS-bypassing Node.js proxy server.

## Features

- 🛠️ **CORS-Bypassing Proxy**: Requests are forwarded through a local Node.js proxy server, letting you test any external API without hitting CORS restrictions.
- 🗂️ **Collections**: Organize and save requests into custom collections. Persisted locally in a file-based JSON database.
- 📜 **Request History**: Automatic tracking of all executed requests for rapid re-testing.
- 🔄 **URL Query Parameter Sync**: Real-time two-way sync between the URL address bar and the query parameter editor table.
- 🎛️ **Headers & Body Editors**: Full support for request headers, raw text/JSON bodies, and form-data key-value parameters.
- 📑 **Multi-Tab Interface**: Work on multiple requests concurrently with tab management.
- 🎨 **Rich Dark UI & Custom JSON Highlighting**: Modern developer-centric styling featuring responsive panels and custom syntax-highlighted JSON rendering.

## Tech Stack

- **Frontend**: React (Vite), Lucide Icons, Custom CSS
- **Backend/Proxy**: Node.js, Express, Axios, MongoDB

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) installed (v18+ recommended)
- MongoDB running locally, or a MongoDB Atlas connection string

### Quick Start

1. Install dependencies across the project:
   ```bash
   npm run install-all
   ```

2. Copy `server/.env.example` to `server/.env` and configure the MongoDB connection:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB=postman_clone
   PORT=5000
   ```

3. Start both the client and the proxy server concurrently:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   - Client: `http://localhost:5173`
   - Proxy Backend: `http://localhost:5000`

## File Structure

```text
├── client/                 # React frontend client
│   ├── src/
│   │   ├── App.jsx         # App component (tabs, logic, proxy fetcher)
│   │   ├── index.css       # Complete dark-mode design system & layouts
│   │   └── main.jsx        # App entry point
│   ├── index.html          # HTML entry with Inter & JetBrains Mono fonts
│   └── package.json
│
├── server/                 # Express proxy & storage backend
│   ├── server.js           # Server routes & Axios proxy configuration
│   └── package.json
│
├── package.json            # Root configuration (concurrent runs)
└── README.md
```
