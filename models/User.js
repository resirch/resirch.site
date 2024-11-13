const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true },
    username: String,
    avatar: String,
    isAdmin: { type: Boolean, default: false },
});

module.exports = mongoose.model('User', userSchema);
