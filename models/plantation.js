const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const plantationSchema = new Schema({
    title: String,
    position: {
        lat: Number,
        lng: Number
    },
    id: String
})

module.exports = mongoose.model('plantation', plantationSchema);