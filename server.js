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

// In-memory data storage
const posts = []; // This will hold all posts

// Endpoint to fetch all posts
app.get('/api/getPosts', (req, res) => {
    res.json(posts);
});

// Endpoint to create a new post
app.post('/api/createPost', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const { title, content } = req.body;

    if (title.length === 0 || title.length > 100 || content.length === 0 || content.length > 1000) {
        return res.status(400).json({ error: 'Invalid title or content length' });
    }

    const newPost = {
        id: posts.length + 1,
        title,
        content,
        datePosted: new Date().toISOString(),
        pinned: false,
        user: {
            username: req.session.user.username,
            id: req.session.user.id,
            avatar: req.session.user.avatar
        },
        replies: []
    };

    posts.push(newPost);

    res.json({ success: true, post: newPost });
});

// Endpoint to fetch a specific post by id
app.get('/api/getPost', (req, res) => {
    const postId = parseInt(req.query.id);

    const post = posts.find(p => p.id === postId);

    if (!post) {
        return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
});

// Endpoint to add a reply to a post
app.post('/api/addReply', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const { postId, content } = req.body;
    const post = posts.find(p => p.id === postId);

    if (!post) {
        return res.status(404).json({ error: 'Post not found' });
    }

    if (content.length === 0 || content.length > 1000) {
        return res.status(400).json({ error: 'Invalid content length' });
    }

    const newReply = {
        id: post.replies.length + 1,
        content,
        datePosted: new Date().toISOString(),
        user: {
            username: req.session.user.username,
            id: req.session.user.id,
            avatar: req.session.user.avatar
        }
    };

    post.replies.push(newReply);

    res.json({ success: true, reply: newReply });
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
