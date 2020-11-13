const express = require('express');
const app = express();
const session = require('express-session');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

const server = app.listen(4000, () => {
    console.log("Express server has started on port 4000")
});

app.use(cors());
app.use(express.static('public'));

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(session({
    secret: '@#@$MYSIGN#@$#$',
    resave: false,
    saveUninitialized: true
}))

const db = mongoose.connection;
db.on('error', console.error);
db.once('open', () => {
    console.log("Connected to mongodb server")
});
mongoose.connect('mongodb://localhost/sanyangsam');

const router = require('./router/main')(app, fs);