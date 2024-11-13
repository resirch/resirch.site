require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const Filter = require('bad-words');
const filter = new Filter();

// Import your models
const User = require('./models/User');
const Post = require('./models/Post');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/trading-database');
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

const app = express();

// Body Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost/your_database_name',
        collectionName: 'sessions'
    }),
    cookie: { maxAge: 2 * 7 * 24 * 60 * 60 * 1000 } // Expires in 2 weeks
}));

// Middleware to fetch user from session
app.use(async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId);
            if (user) {
                req.user = user;
            }
        } catch (error) {
            console.error('Error fetching user from session:', error);
        }
    }
    next();
});

// Define your API routes here BEFORE the static middleware

// Endpoint to get the currently logged-in user
app.get('/auth/discord/user', (req, res) => {
    if (req.user) {
        res.json({
            username: req.user.username,
            id: req.user.discordId,
            avatar: req.user.avatar,
            isAdmin: req.user.isAdmin,
        });
    } else {
        res.status(401).json({ error: 'User not authenticated' });
    }
});

// Endpoint to fetch all posts
app.get('/api/getPosts', async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user', 'username avatar discordId')
            .populate('replies.user', 'username avatar discordId')
            .lean();

        res.json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to create a new post
app.post('/api/createPost', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const { title, content } = req.body;

    if (title.length === 0 || title.length > 100 || content.length === 0 || content.length > 1000) {
        return res.status(400).json({ error: 'Invalid title or content length' });
    }

    if (filter.isProfane(title) || filter.isProfane(content)) {
        return res.status(400).json({ error: 'Content contains inappropriate language' });
    }

    // Create a new post using the Mongoose model
    const newPost = new Post({
        title,
        content,
        user: req.user._id,
    });

    try {
        await newPost.save();
        res.json({ success: true, post: newPost });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Other API routes (e.g., /api/addReply, /api/deletePost, /api/deleteReply) should be defined here as well

// Now, serve static files from the 'docs' directory
app.use(express.static(path.join(__dirname, 'docs')));

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 80; // Use the appropriate port
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
