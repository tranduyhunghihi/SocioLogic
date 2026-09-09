/**
 * SOCIO LOGIC - NODE.JS EXPRESS + MONGODB BACKEND SERVER
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_PIN = process.env.ADMIN_PIN || 'sociologic2026';

// Middlewares - Full Unrestricted CORS for local file:// and web origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Mongoose MongoDB Schema
const wishSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    author: { type: String, required: true },
    imageData: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    rotation: { type: Number, default: 0 },
    zIndex: { type: Number, default: 1 },
    bgColor: { type: String, default: '#FFFFFF' },
    timestamp: { type: Number, default: Date.now }
}, { timestamps: true });

const Wish = mongoose.model('Wish', wishSchema);

// Mongoose Parent Registration Schema
const registrationSchema = new mongoose.Schema({
    parentName: { type: String, required: true },
    phone: { type: String, required: true },
    timestamp: { type: Number, default: Date.now }
}, { timestamps: true });

const ParentRegistration = mongoose.model('ParentRegistration', registrationSchema);

// MongoDB Database Connection
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('🍃 Connected to MongoDB Database Successfully!'))
        .catch(err => console.warn('⚠️ MongoDB Connection Notice:', err.message));
} else {
    console.error('⚠️ MONGODB_URI không được tìm thấy trong file .env!');
}

// API ROUTES

// 1. Health Check & Environment Config
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SocioLogic MongoDB Server is Running!' });
});

// 1b. Verify Admin PIN dynamically against process.env.ADMIN_PIN
app.post('/api/admin/verify-pin', (req, res) => {
    const { pin } = req.body;
    const envPin = process.env.ADMIN_PIN || 'sociologic2026';
    if (pin === envPin) {
        res.json({ success: true, authed: true });
    } else {
        res.status(401).json({ success: false, error: 'Mã PIN quản trị viên không đúng!' });
    }
});

// 1c. POST /api/parent-registrations - Save parent birthday party registration
app.post('/api/parent-registrations', async (req, res) => {
    try {
        const { parentName, phone } = req.body;
        if (!parentName || !phone) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ Họ tên và Số điện thoại!' });
        }
        const newReg = new ParentRegistration({ parentName, phone, timestamp: Date.now() });
        await newReg.save();
        console.log(`🎉 New parent registration saved: ${parentName} (${phone})`);
        res.status(201).json({ success: true, registration: newReg });
    } catch (err) {
        console.error('Error saving parent registration:', err);
        res.status(500).json({ error: 'Lỗi lưu thông tin đăng ký' });
    }
});

// 1d. GET /api/parent-registrations - Fetch all registrations for Admin moderation
app.get('/api/parent-registrations', async (req, res) => {
    try {
        const list = await ParentRegistration.find().sort({ timestamp: -1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

// 2. GET /api/wishes - Fetch all wishes from MongoDB (With Edge CDN Cache Header)
app.get('/api/wishes', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=60, stale-while-revalidate=300');
        const wishes = await Wish.find().sort({ timestamp: 1 });
        res.json(wishes);
    } catch (err) {
        console.error('Error fetching wishes from MongoDB:', err);
        res.status(500).json({ error: 'Failed to fetch wishes' });
    }
});

// 3. POST /api/wishes - Save a new wish to MongoDB
app.post('/api/wishes', async (req, res) => {
    try {
        const { id, author, imageData, x, y, rotation, zIndex, bgColor, timestamp } = req.body;
        if (!id || !imageData) {
            return res.status(400).json({ error: 'Missing required wish fields' });
        }

        const newWish = new Wish({
            id,
            author: author || 'Người chúc ẩn danh',
            imageData,
            x: x || 50,
            y: y || 50,
            rotation: rotation || 0,
            zIndex: zIndex || 1,
            bgColor: bgColor || '#FFFFFF',
            timestamp: timestamp || Date.now()
        });

        await newWish.save();
        console.log(`✅ New wish saved to MongoDB: ${newWish.author} (${newWish.id})`);
        res.status(201).json(newWish);
    } catch (err) {
        console.error('Error saving wish to MongoDB:', err);
        res.status(500).json({ error: 'Failed to save wish' });
    }
});

// 4. PUT /api/wishes/:id/position - Update dragged card coordinates in MongoDB
app.put('/api/wishes/:id/position', async (req, res) => {
    try {
        const { id } = req.params;
        const { x, y, zIndex } = req.body;

        const updated = await Wish.findOneAndUpdate(
            { id },
            { $set: { x, y, zIndex } },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'Wish not found' });
        }

        res.json({ success: true, wish: updated });
    } catch (err) {
        console.error('Error updating wish position in MongoDB:', err);
        res.status(500).json({ error: 'Failed to update wish position' });
    }
});

// 5. DELETE /api/wishes/:id - Delete a wish by ID from MongoDB
app.delete('/api/wishes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedWish = await Wish.findOneAndDelete({ id });
        
        if (!deletedWish) {
            return res.status(404).json({ error: 'Wish not found' });
        }

        console.log(`🗑️ Deleted wish from MongoDB: ${id}`);
        res.json({ message: 'Wish deleted successfully', id });
    } catch (err) {
        console.error('Error deleting wish from MongoDB:', err);
        res.status(500).json({ error: 'Failed to delete wish' });
    }
});

// 6. DELETE /api/wishes - Delete ALL wishes from MongoDB
app.delete('/api/wishes', async (req, res) => {
    try {
        await Wish.deleteMany({});
        console.log('🧹 Cleared all wishes from MongoDB');
        res.json({ message: 'All wishes cleared successfully' });
    } catch (err) {
        console.error('Error clearing wishes from MongoDB:', err);
        res.status(500).json({ error: 'Failed to clear wishes' });
    }
});

// Start Server with EADDRINUSE safety
const server = app.listen(PORT, () => {
    console.log(`🚀 SocioLogic MongoDB Server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${PORT} đang được sử dụng. Đang tự động chuyển sang Port ${Number(PORT) + 1}...`);
        app.listen(Number(PORT) + 1, () => {
            console.log(`🚀 SocioLogic MongoDB Server running at http://localhost:${Number(PORT) + 1}`);
        });
    } else {
        console.error('Server error:', err);
    }
});

// Keep-Alive Self Ping every 10 minutes to prevent Render free instance from sleeping
setInterval(() => {
    const serverUrl = process.env.RENDER_EXTERNAL_URL || ('http://localhost:' + PORT);
    fetch(`${serverUrl}/api/health`).catch(() => {});
}, 10 * 60 * 1000);
