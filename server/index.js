require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const HRBase = require('./models/HRBase');
const VisitData = require('./models/VisitData');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads for Excel data

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes

// Get all HR Bases
app.get('/api/hr-bases', async (req, res) => {
    try {
        const bases = await HRBase.find().sort({ createdAt: -1 });
        res.json(bases);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save or Update all HR Bases (Sync)
app.post('/api/hr-bases/sync', async (req, res) => {
    try {
        const { bases } = req.body;
        // Simple strategy: clear and replace for full sync from frontend state
        // For more advanced use, we could do individual upserts
        await HRBase.deleteMany({});
        if (bases && bases.length > 0) {
            await HRBase.insertMany(bases);
        }
        res.json({ message: 'Sync successful' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// App State (Visit Data, etc)
app.get('/api/state/:key', async (req, res) => {
    try {
        const data = await VisitData.findOne({ key: req.params.key });
        res.json(data ? data.value : null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/state/:key', async (req, res) => {
    try {
        const { value } = req.body;
        await VisitData.findOneAndUpdate(
            { key: req.params.key },
            { value },
            { upsert: true, new: true }
        );
        res.json({ message: 'State updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/state/:key', async (req, res) => {
    try {
        await VisitData.deleteOne({ key: req.params.key });
        res.json({ message: 'State cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
