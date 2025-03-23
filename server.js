import express from 'express';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import http from 'http';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/messages.js';
import { Message } from './routes/messages.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const mg = process.env.MONGO_URL 
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://message-dash-f.vercel.app','http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST']
  }
});

const corsOptions = {
  origin: ['https://message-dash-f.vercel.app','http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// MongoDB Connection with detailed logging
// mongoose.connect('mongodb://localhost:27017/messaging-app', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// })
//   .then(() => console.log('Successfully connected to MongoDB'))
//   .catch(err => console.error('MongoDB connection failed:', err.message));

mongoose.connect(`${mg}`)
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch(err => console.error('MongoDB connection failed:', err.message));

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  console.log('Received handshake auth:', socket.handshake.auth);
  const token = socket.handshake.auth.token;
  console.log('jtokenserver:',JWT_SECRET)
  if (!token) {
    console.error('No token provided in socket handshake');
    return next(new Error('Authentication error: No token'));
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    console.log('tokenn:', token)
    if (err) {
      console.error('Token verification failed:', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
    socket.userId = decoded.userId;
    console.log('Socket authenticated for user:', socket.userId);
    next();
  });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'User ID:', socket.userId);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on('message', async (msg) => {
    try {
      console.log('Received message payload:', JSON.stringify(msg, null, 2));
      if (!msg.sender || !msg.recipient || !msg.content) {
        throw new Error('Invalid message format: missing required fields');
      }
      const newMessage = new Message(msg);
      const savedMessage = await newMessage.save();
      console.log('Message successfully saved to DB:', savedMessage);
      io.to(msg.sender).emit('message', savedMessage);
      if (msg.sender !== msg.recipient) {
        io.to(msg.recipient).emit('message', savedMessage);
      }
    } catch (error) {
      console.error('Error saving message to DB:', error.stack);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, 'Reason:', reason);
  });

  // Keep-alive check
  socket.on('ping', () => {
    socket.emit('pong');
    console.log('Ping-pong with:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Server is running!');
});

server.listen(5000, () => {
  console.log('Server running on port 5000');
});