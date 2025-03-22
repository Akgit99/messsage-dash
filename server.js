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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST']
  }
});

const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch(err => console.error('MongoDB connection failed:', err.message));

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.error('No token provided in socket handshake');
    return next(new Error('Authentication error: No token'));
  }
  jwt.verify(token, 'secret_key', (err, decoded) => {
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
      console.log('Received message:', msg);
      
      // Validate message data
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
      console.error('Error saving message to DB:', error.message);
    }
  });

  socket.on('typing', (data) => {
    socket.to(data.recipient).emit('typing', { userId: data.userId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Server is running!');
});

server.listen(5000, () => {
  console.log('Server running on port 5000');
});