require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const session = require('express-session');

const app = express();

// Body Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

console.log('Client ID:', process.env.CLIENT_ID);
console.log('Client Secret:', process.env.CLIENT_SECRET);

// Endpoint to handle the OAuth2 callback
app.get('/auth/discord/callback', async (req, res) => {
    console.log('Received request at /auth/discord/callback');
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('No code provided');
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                scope: 'identify'
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // Fetch user info
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const userData = userResponse.data;

        // Store user data in session
        req.session.user = userData;

        // Redirect to trading.html
        res.redirect('/trading.html');

    } catch (error) {
        console.error('Error exchanging code for token:', error.response ? error.response.data : error);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint to get the current logged-in user's data
app.get('/auth/discord/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).send({ error: 'User not logged in' });
    }
});

// Serve static files from the 'docs' directory
app.use(express.static(path.join(__dirname, 'docs')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// pm2 start server.js to start the server
// pm2 delete server.js to stop the server
// pm2 list to see the server status
// pm2 logs server.js to see the server logs
// pm2 monit to see the server metrics
// pm2 save to save the server state (recommended after stopping the server)
// pm2 startup to start the server on system startup (requires sudo)
// pm2 delete all to delete all pm2 processes
