const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
    content: String,
    datePosted: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    datePosted: { type: Date, default: Date.now },
    pinned: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    replies: [replySchema],
});

module.exports = mongoose.model('Post', postSchema);
