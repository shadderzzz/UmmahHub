// Import necessary modules
var express = require('express');
var ejs = require('ejs');
var mysql = require('mysql2');
var session = require('express-session');
const expressSanitizer = require('express-sanitizer');
const request = require('request');
const path = require('path');

// Create the express application object
const app = express();
const port = 8000; // Define port manually

// Middleware for sanitization and parsing
app.use(express.json()); // Handle JSON data
app.use(express.urlencoded({ extended: true })); // Handle form submissions
app.use(expressSanitizer());

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Set up static folder (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Configure express-session
app.use(session({
    secret: 'somerandomstuff', // Hardcoded session secret
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // Prevent client-side access to cookies
        secure: false,  // Set to true if using HTTPS
        maxAge: 600000  // Session expiry time (10 minutes)
    }
}));

// Define database connection (Hardcoded credentials)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'user',
    password: 'qwertyuiop',
    database: 'main'
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
    } else {
        console.log('Connected to database');
    }
});
global.db = db;

// Middleware to make userId available in all EJS views
app.use((req, res, next) => {
    res.locals.userId = req.session.userId || null; // If user is not logged in, set to null
    next();
});

// Middleware to check login globally for protected routes
const ensureLoggedIn = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/users/login'); // Redirect to login if not logged in
    }
    next();
};

// Load the route handlers
const mainRoutes = require("./routes/main");
app.use('/', mainRoutes);

const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

app.get('/prayerTimes', (req, res) => {
    res.render('prayerTimes', { userId: req.session.userId }); // Pass userId if using sessions
});

app.get('/specialIslamicDays', (req, res) => {
    res.render('specialIslamicDays', { userId: req.session.userId }); // Pass userId if using authentication
});

app.get('/zakat', (req, res) => {
    res.render('zakat', { userId: req.session.userId }); // Pass userId if using authentication
});

app.get('/chatbot', (req, res) => {
    res.render('chatbot', { userId: req.session.userId });
});


// Home Route
app.get('/', (req, res) => {
    res.render('index');
});

// Start the web app listening
app.listen(port, () => console.log(`Node app listening on http://localhost:${port}!`));
