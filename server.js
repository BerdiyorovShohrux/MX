const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;




// MongoDB ulanish
mongoose.connect('mongodb+srv://shohrux:SHOHRUX1103@cluster0.ru17wos.mongodb.net/chatdb?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('MongoDB Atlas bilan ulanish muvaffaqiyatli!'))
    .catch(err => console.error('MongoDB ulanishda xato:', err));

const sessionMiddleware = session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
});

app.use(sessionMiddleware);
app.use(express.json()); // JSON so‘rovlarini qabul qilish uchun
app.use(express.static(path.join(__dirname, 'public')));

// Login endpointi
app.post('/login', (req, res) => {
    const { username } = req.body;
    if (username) {
        req.session.username = username;
        res.status(200).json({ message: 'Login muvaffaqiyatli' });
    } else {
        res.status(400).json({ error: 'Foydalanuvchi nomi kiritilmadi' });
    }
});

app.get('/session', (req, res) => {
    if (req.session.username) {
        res.json({ username: req.session.username });
    } else {
        res.status(401).json({ error: 'Sessiya topilmadi' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

io.on('connection', async (socket) => {
    const req = socket.request;
    if (!req.session.username) {
        socket.emit('no session', 'Sessiya topilmadi, qayta login qiling.');
        return;
    }

    const username = req.session.username;

    const history = await Message.find().sort({ createdAt: 1 }).limit(100);
    const messages = history.map(msg => `${msg.username}: ${msg.message}`);
    socket.emit('chat history', messages);

    socket.broadcast.emit('user joined', `${username} chatga qo‘shildi.`);

    socket.on('chat message', async (msg) => {
        const fullMsg = `${username}: ${msg}`;
        const newMessage = new Message({ username, message: msg });
        await newMessage.save();
        io.emit('chat message', fullMsg);
    });

    socket.on('disconnect', () => {
        io.emit('user left', `${username} chatdan chiqdi.`);
    });
});

server.listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishlayapti`);
});