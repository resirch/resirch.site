require('dotenv').config();

const express = require('express');
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
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/forum-database');
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

const app = express();

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Set the directory where your EJS templates will be located
app.set('views', path.join(__dirname, 'views'));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/forum-database',
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

// Define your API routes here
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

// Endpoint to get all posts
app.get('/api/getPosts', async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user', 'username avatar discordId')
            .lean();

        res.json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to get a single post by ID
app.get('/api/getPost', async (req, res) => {
    const postId = req.query.id;

    try {
        const post = await Post.findById(postId)
            .populate('user', 'username avatar discordId')
            .populate('replies.user', 'username avatar discordId')
            .lean();

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json(post);
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

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

app.delete('/api/deletePost/:postId', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const { postId } = req.params;

    try {
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if the user is the author or an admin
        if (post.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        await post.deleteOne();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/createReply/:postId', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const { postId } = req.params;
    const { content } = req.body;

    if (!content || content.length === 0 || content.length > 1000) {
        return res.status(400).json({ error: 'Invalid content length' });
    }

    if (filter.isProfane(content)) {
        return res.status(400).json({ error: 'Content contains inappropriate language' });
    }

    try {
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        post.replies.push({
            content,
            user: req.user._id,
        });

        await post.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error adding reply:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/deleteReply/:postId/:replyId', async (req, res) => {
    console.log(`Received DELETE request for deleteReply with postId: ${req.params.postId}, replyId: ${req.params.replyId}`);
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const { postId, replyId } = req.params;

    try {
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const reply = post.replies.id(replyId);

        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Check if the user is the author or an admin
        if (reply.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        reply.deleteOne();
        await post.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting reply:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Keep the general static files serving for other assets
app.use(express.static(path.join(__dirname, 'docs')));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Endpoint for Discord OAuth callback
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('No code provided');
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
        }).toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const accessToken = tokenResponse.data.access_token;

        // Fetch user data
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const discordUser = userResponse.data;

        // Upsert user in database
        let user = await User.findOneAndUpdate(
            { discordId: discordUser.id },
            {
                username: discordUser.username,
                avatar: discordUser.avatar,
                isAdmin: discordUser.id === '928087297902129182'
            },
            { upsert: true, new: true }
        );

        // Save user ID in session
        req.session.userId = user._id;

        // Redirect back to the forum page
        res.redirect('/forum');
    } catch (error) {
        if (error.response) {
            console.error('Error data:', error.response.data);
            console.error('Error status:', error.response.status);
            console.error('Error headers:', error.response.headers);
        } else {
            console.error('Error message:', error.message);
        }
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint to log out the user
app.post('/auth/discord/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ success: true });
    });
});

// Route for the home page
app.get('/', (req, res) => {
    res.render('index');
});

// Route for the projects page
app.get('/projects', (req, res) => {
    res.render('projects');
});

// Route for the forum page
app.get('/forum', (req, res) => {
    res.render('forum');
});

app.get('/blacksmithing', (req, res) => {
    res.render('blacksmithing');
});

// Add routes for other pages similarly

app.use(express.static(path.join(__dirname, 'public')));
