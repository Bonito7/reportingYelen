require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const XLSX = require('xlsx');
const HRBase = require('./models/HRBase');
const VisitData = require('./models/VisitData');
const crypto = require('crypto');
const { processAnalysis, mapHRData } = require('./utils/processor');

const app = express();
const PORT = process.env.PORT || 5001;

// Multer config
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '100mb' }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        const dbName = mongoose.connection.name;
        console.log(`✅ Connected to MongoDB Atlas - Database: ${dbName}`);
    })
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes

// ADMIN: Clear All Data
app.delete('/api/admin/clear-all', async (req, res) => {
    console.log('⚠️ Requete de suppression totale reçue');

    if (mongoose.connection.readyState !== 1) {
        console.error('❌ Erreur: Base de données non connectée');
        return res.status(500).json({ error: 'La base de données n\'est pas connectée actuellement.' });
    }

    try {
        const hrResult = await HRBase.deleteMany({});
        const visitResult = await VisitData.deleteMany({});
        console.log(`🗑️ Suppression terminée. HR: ${hrResult.deletedCount}, States: ${visitResult.deletedCount}`);
        res.json({
            message: 'All data cleared successfully',
            details: { hr: hrResult.deletedCount, states: visitResult.deletedCount }
        });
    } catch (err) {
        console.error('❌ Erreur lors de la suppression totale:', err);
        res.status(500).json({ error: `Erreur serveur lors de la suppression: ${err.message}` });
    }
});

// Process Visites (Server Side Analysis)
app.post('/api/process-visites', upload.single('file'), async (req, res) => {
    console.log('📡 Requete d\'analyse reçue');
    try {
        const { hrBaseId, strictMode } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!hrBaseId) {
            return res.status(400).json({ error: 'HR Base ID is required' });
        }

        // 1. Fetch HR Base
        const base = await HRBase.findById(hrBaseId);
        if (!base) {
            return res.status(404).json({ error: 'HR Base not found' });
        }

        console.log(`📦 Traitement pour la base: ${base.name} (${base.data.length} membres)`);

        // 2. Parse Excel
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Optimisation parse
        const dailyVisits = XLSX.utils.sheet_to_json(worksheet, {
            defval: '',
            raw: false,
            dateNF: 'dd/mm/yyyy'
        });

        console.log(`📑 Fichier Excel parsé: ${dailyVisits.length} lignes`);

        // 3. Process Analysis
        const result = processAnalysis(base.data, dailyVisits, strictMode === 'true' || strictMode === true);

        console.log('✅ Analyse terminée avec succès');
        res.json(result);
    } catch (err) {
        console.error('❌ Erreur lors du traitement:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all HR Bases (Metadata Only)
app.get('/api/hr-bases', async (req, res) => {
    try {
        const bases = await HRBase.find().select('-data').sort({ createdAt: -1 });
        res.json(bases);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Sample Rows for Preview
app.get('/api/hr-bases/:id/sample', async (req, res) => {
    try {
        const base = await HRBase.findById(req.params.id);
        if (!base) return res.status(404).json({ error: 'Base not found' });
        res.json(base.data.slice(0, 10));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload HR Base
app.post('/api/hr-bases/upload', upload.single('file'), async (req, res) => {
    console.log('📡 Requete d\'upload HR reçue');
    try {
        const { name } = req.body;
        const file = req.file;

        if (!file || !name) {
            return res.status(400).json({ error: 'File and name are required' });
        }

        // 1. Parse Excel
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        if (rawData.length === 0) {
            return res.status(400).json({ error: 'Le fichier Excel est vide' });
        }

        // 2. Identify fields
        const keys = Object.keys(rawData[0]);
        const displayFields = keys.slice(0, 6).map(k => ({ key: k, label: k }));

        // 3. Map Data
        const mappedData = mapHRData(rawData, keys);

        // 4. Create Base
        const newBase = new HRBase({
            id: crypto.randomUUID(),
            name: name,
            data: mappedData,
            displayFields: displayFields
        });

        await newBase.save();

        console.log(`✅ Base RH "${name}" créée avec ${mappedData.length} membres`);
        res.json({ message: 'Upload successful', baseId: newBase.id });
    } catch (err) {
        console.error('❌ Erreur lors de l\'upload HR:', err);
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
