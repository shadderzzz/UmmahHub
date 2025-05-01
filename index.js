// Import express and ejs
var express = require('express');
var ejs = require('ejs');

// Import mysql module
var mysql = require('mysql2');

// Import express-session module
var session = require('express-session');

// Import express-validator module
var validator = require ('express-validator');

//Import express-sanitizer module
const expressSanitizer = require('express-sanitizer');

// Create the express application object
const app = express();
const port = 8000;

// Import request module
const request = require('request')

// Create an input sanitizer
app.use(expressSanitizer());

// Tell Express that we want to use EJS as the templating engine
app.set('view engine', 'ejs');

// Set up the body parser
app.use(express.urlencoded({ extended: true }));

// Set up public folder (for css and static js)
app.use(express.static(__dirname + '/public'));

// Create a session
app.use(session({
    secret: 'somerandomstuff',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000
    }
}));

// Define the database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'user',
    password: 'qwertyuiop',
    database: 'main'
});

// Connect to the database
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});
global.db = db;


// Load the route handlers
const mainRoutes = require("./routes/main");
app.use('/', mainRoutes);

// Load the route handlers for /users
const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

// Middleware to check login globally for protected routes
const ensureLoggedIn = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/users/login'); // Redirect to login if not logged in
    }
    next();
};

app.get('/calendar', (req, res) => {
    res.render('calendar'); // This will render the 'calendar.ejs' file
});

app.get('/prayerTimes', (req, res) => {
    res.render('prayerTimes'); // This will render 'prayerTimes.ejs'
});


// Apply middleware to all routes that need protection
app.use('/qaForum', ensureLoggedIn);


// Start the web app listening
app.listen(port, () => console.log(`Node app listening on port ${port}!`));