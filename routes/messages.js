import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken'; // Ensure this is imported for verifyToken

// Define the Message schema
const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  recipient: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

// Create the Message model
const Message = mongoose.model('Message', messageSchema);

const router = express.Router();

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  console.log('Authorization header:', token);
  if (!token) {
    console.error('No token provided in request headers');
    return res.status(403).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET || 'default_secret_key');
    req.userId = decoded.userId;
    console.log('Token verified for user:', req.userId);
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Search messages (optional route)
router.get('/search/:recipientId', verifyToken, async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { query } = req.query;
    const messages = await Message.find({
      $or: [
        { sender: req.userId, recipient: recipientId },
        { sender: recipientId, recipient: req.userId }
      ],
      content: { $regex: query, $options: 'i' }
    }).sort({ timestamp: 1 });
    console.log(`Found ${messages.length} messages matching search for user ${req.userId} and ${recipientId}`);
    res.json(messages);
  } catch (error) {
    console.error('Error searching messages:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get messages between two users
router.get('/:recipientId', verifyToken, async (req, res) => {
  try {
    const { recipientId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: req.userId, recipient: recipientId },
        { sender: recipientId, recipient: req.userId }
      ]
    }).sort({ timestamp: 1 });
    console.log(`Retrieved ${messages.length} messages for user ${req.userId} and ${recipientId}`);
    res.json(messages);
  } catch (error) {
    console.error('Error retrieving messages:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export { Message };
export default router;