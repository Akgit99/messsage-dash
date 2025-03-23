import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config(); // Load environment variables

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key'; // Use environment variable

// Signup route
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    //console.log('Signup request received:', username, password); // Debug log

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
     // console.log('Username already exists:', username);
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    //console.log('Hashed password:', hashedPassword); 

    const user = new User({ username, password: hashedPassword });
    await user.save();

    //console.log('User created successfully:', user);
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, userId: user._id });
    // console.log('User logged in and token: ', token)
    // console.log('jwtsecretauth:',JWT_SECRET)
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
