require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const HRBase = require('./models/HRBase');
const VisitData = require('./models/VisitData');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '100mb' })); // Increased limit to 100mb

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
    console.log(`📡 Requete de sync reçue : ${req.body.bases?.length || 0} bases`);
    try {
        const { bases } = req.body;
        if (!bases) {
            console.error('❌ Erreur : Pas de données (bases) dans le corps de la requête');
            return res.status(400).json({ error: 'No bases provided in request body' });
        }

        await HRBase.deleteMany({});
        if (bases.length > 0) {
            await HRBase.insertMany(bases);
            console.log('✅ Bases synchronisées avec succès');
        } else {
            console.log('ℹ️ Aucune base à synchroniser (liste vide)');
        }
        res.json({ message: 'Sync successful' });
    } catch (err) {
        console.error('❌ Erreur de synchronisation:', err);
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
