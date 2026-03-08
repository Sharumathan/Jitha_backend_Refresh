const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const TARGET_URL = 'https://emotional-tts-uwn1.onrender.com/';
const PING_INTERVAL = 60000; // 60 seconds (1 minute)

// Helper function to get current time in Sri Lankan Time
const getSLTString = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleString('en-US', { timeZone: 'Asia/Colombo' });
};

// State to store the last ping results
let lastLoadTime = null;
let lastStatus = 'Waiting for first ping...';
let lastError = null;

// The function that pings the target URL
const pingUrl = async () => {
    try {
        // Render sometimes shows a "Free Instance down" warning page that requires a click.
        // Usually, these pages are served with HTML instead of the expected JSON.
        // We can bypass this by either setting a custom header or just checking the response type.
        const response = await axios.get(TARGET_URL, {
            headers: {
                // Mimic a standard browser or API client to avoid being flagged as a simple bot
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            // Don't throw errors for 4xx/5xx responses so we can inspect them
            validateStatus: function (status) {
                return true;
            }
        });

        lastLoadTime = new Date();

        // Render might return a 200 OK but with an HTML page instead of our JSON app response
        const isHtml = typeof response.data === 'string' && response.data.toLowerCase().includes('<html');

        if (response.status >= 200 && response.status < 300) {
            if (isHtml) {
                lastStatus = `Waking up... (Render Warning Page)`;
                lastError = "Instance was asleep. Detected Render's 'click to visit' page. Pinged to wake it up.";
                console.log(`[${lastLoadTime.toISOString()}] Detected Render warning page. Instance is waking up.`);
            } else {
                lastStatus = `Success (${response.status})`;
                lastError = null;
                console.log(`[${lastLoadTime.toISOString()}] Ping successful. App is awake.`);
            }
        } else {
            lastStatus = `Failed (${response.status})`;
            lastError = `HTTP Status: ${response.status}. Data: ${typeof response.data === 'string' ? response.data.substring(0, 100) : 'Check logs'}`;
            console.warn(`[${lastLoadTime.toISOString()}] Non-200 status:`, response.status);
        }

    } catch (error) {
        lastLoadTime = new Date();
        lastStatus = 'Failed to load';
        lastError = error.message;
        console.error(`[${lastLoadTime.toISOString()}] Ping failed:`, error.message);
    }
};

// Start the periodic pinger
setInterval(pingUrl, PING_INTERVAL);
// Initial ping immediately on startup
pingUrl();

// Route to render the beautiful UI
app.get('/', (req, res) => {
    // Generate an HTML page with styled CSS and the current status
    // The page auto-refreshes every 5 seconds to show the newest status
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TTS Pinger Status</title>
    <!-- Auto-refresh page every 5 seconds so user always sees the latest status -->
    <meta http-equiv="refresh" content="5">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
        
        :root {
            --bg-gradient-start: #0f172a;
            --bg-gradient-end: #1e293b;
            --card-bg: rgba(255, 255, 255, 0.05);
            --card-border: rgba(255, 255, 255, 0.1);
            --text-primary: #f8fafc;
            --text-secondary: #cbd5e1;
            --accent-success: #10b981;
            --accent-error: #ef4444;
            --accent-pending: #f59e0b;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
            line-height: 1.6;
        }

        .container {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 24px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.8s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        h1 {
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 8px;
            font-size: 2rem;
            background: linear-gradient(to right, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        p.subtitle {
            color: var(--text-secondary);
            margin-bottom: 32px;
            font-weight: 300;
        }

        .status-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
        }

        .status-card {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 16px;
            padding: 20px;
            border-left: 4px solid var(--accent-pending);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .status-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }

        .status-card.success { border-left-color: var(--accent-success); }
        .status-card.error { border-left-color: var(--accent-error); }

        .label {
            font-size: 0.875rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
            font-weight: 600;
        }

        .value {
            font-size: 1.25rem;
            font-weight: 600;
            word-break: break-all;
        }

        .error-message {
            color: #ef4444; /* Force red text for contrast */
            font-size: 1rem;
            margin-top: 8px;
            font-family: monospace;
            background: rgba(239, 68, 68, 0.1);
            padding: 10px;
            border-radius: 8px;
            word-wrap: break-word;
        }

        .footer {
            margin-top: 32px;
            text-align: center;
            font-size: 0.875rem;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .ping-indicator {
            width: 8px;
            height: 8px;
            background-color: var(--accent-success);
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        .ping-indicator.error {
            background-color: var(--accent-error);
            animation: pulse-error 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        
        @keyframes pulse-error {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        @media (min-width: 640px) {
            .status-grid {
                grid-template-columns: 1fr 1fr;
            }
            .status-card.full-width {
                grid-column: 1 / -1;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Emotional TTS Pinger</h1>
        <p class="subtitle">Monitoring <code>https://emotional-tts-uwn1.onrender.com/</code> every 1 minute.</p>
        
        <div class="status-grid">
            <div class="status-card full-width ${lastError ? 'error' : (lastStatus.includes('Success') ? 'success' : '')}">
                <div class="label">Current Status</div>
                <div class="value">${lastStatus}</div>
                ${lastError ? `<div class="error-message">${lastError}</div>` : ''}
            </div>
            
            <div class="status-card">
                <div class="label">Last Attempt (SLT)</div>
                <div class="value">${getSLTString(lastLoadTime)}</div>
            </div>
        </div>
        
        <div class="footer">
            <div class="ping-indicator ${lastError ? 'error' : ''}"></div>
            Pinging active every 1 minute • Automatically refreshing
        </div>
    </div>
</body>
</html>
    `;

    res.send(html);
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
