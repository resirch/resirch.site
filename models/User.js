const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true },
    username: String,
    avatar: String,
    isAdmin: { type: Boolean, default: false },
});

// Middleware to ensure a specific user is always admin
userSchema.pre('save', function(next) {
    if (this.discordId === '928087297902129182') {
        this.isAdmin = true;
    }
    next();
});

userSchema.pre('findOneAndUpdate', function(next) {
    if (this.getQuery().discordId === '928087297902129182') {
        this.getUpdate().isAdmin = true;
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
