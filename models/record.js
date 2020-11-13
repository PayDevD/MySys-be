const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const recordSchema = new Schema({
    content: String,
    date: Date,
    plantation_id: String,
    txHash: String,
    type: String
})

module.exports = mongoose.model('record', recordSchema);