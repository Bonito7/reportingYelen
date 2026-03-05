const mongoose = require('mongoose');

const HRBaseSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    data: { type: Array, required: true },
    displayFields: [{
        key: String,
        label: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('HRBase', HRBaseSchema);
