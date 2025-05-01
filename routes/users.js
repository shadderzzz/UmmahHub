// Create a new router
const express = require("express");
const bcrypt = require('bcrypt'); // Added bcrypt for password hashing
const mysql = require('mysql2'); // Import mysql2 for database interaction
const saltRounds = 10; // Salt rounds for bcrypt hashing
const router = express.Router(); // Create a new router
const { check, validationResult } = require('express-validator'); // Import express-validator for validation
const expressSanitizer = require('express-sanitizer'); // Import express-sanitizer for input sanitation

// Use express-sanitizer middleware
router.use(expressSanitizer());

// Middleware to redirect if the user is not logged in
const redirectLogin = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('./login'); // Redirect to the login page
    } else {
        next(); // Move to the next middleware function
    }
};

// Render the registration form
router.get('/register', function (req, res, next) {
    res.render('register.ejs');
});

// Handle the registration form submission with validation and sanitization
router.post('/registered', [
    check('email').isEmail().withMessage('Please provide a valid email address'),
    check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
], function (req, res, next) {
    const errors = validationResult(req);

    // Sanitize the user input
    req.body.first = req.sanitize(req.body.first);
    req.body.last = req.sanitize(req.body.last);
    req.body.email = req.sanitize(req.body.email);
    req.body.username = req.sanitize(req.body.username);

    if (!errors.isEmpty()) {
        return res.render('register.ejs', {
            errorMessage: errors.array().map(error => error.msg).join(', '),
            first: req.body.first,
            last: req.body.last,
            email: req.body.email,
            username: req.body.username
        });
    }

    const plainPassword = req.body.password;
    const username = req.body.username;
    const firstName = req.body.first;
    const lastName = req.body.last;
    const email = req.body.email;

    // Check if the username or email already exists
    const checkUserSql = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.query(checkUserSql, [username, email], function (err, results) {
        if (err) {
            return next(err);
        }
        if (results.length > 0) {
            const existingUser = results[0];
            let errorMessage = '';
            if (existingUser.username === username) {
                errorMessage = 'Username is already taken. Please choose another.';
            }
            if (existingUser.email === email) {
                errorMessage = errorMessage ? errorMessage + ' Email is already in use.' : 'Email is already in use.';
            }
            return res.render('register.ejs', {
                errorMessage: errorMessage,
                first: firstName,
                last: lastName,
                email: email,
                username: username
            });
        }

        // Hash the password and insert the user if username and email are unique
        bcrypt.hash(plainPassword, saltRounds, function (err, hashedPassword) {
            if (err) {
                return next(err);
            }

            const sql = 'INSERT INTO users (username, first_name, last_name, email, hashedPassword) VALUES (?, ?, ?, ?, ?)';
            db.query(sql, [username, firstName, lastName, email, hashedPassword], function (err, result) {
                if (err) {
                    return next(err);
                }
                res.redirect('/users/login');
            });
        });
    });
});

// Render the login form
router.get('/login', function (req, res, next) {
    res.render('login.ejs');
});

// Handle login form submission
router.post('/login', function (req, res, next) {
    req.body.username = req.sanitize(req.body.username);
    req.body.password = req.sanitize(req.body.password);

    const username = req.body.username;
    const plainPassword = req.body.password;

    const sql = 'SELECT * FROM users WHERE username = ?';
    db.query(sql, [username], function (err, results) {
        if (err) {
            return next(err);
        }

        if (results.length === 0) {
            return res.render('login.ejs', { errorMessage: 'User not found.' });
        }

        const user = results[0];

        bcrypt.compare(plainPassword, user.hashedPassword, function (err, isMatch) {
            if (err) {
                return next(err);
            }

            if (!isMatch) {
                return res.render('login.ejs', { errorMessage: 'Invalid password.' });
            }

            req.session.userId = username;
            res.redirect('/menu');
        });
    });
});

// Route to logout the user and destroy the session
router.get('/logout', redirectLogin, (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/'); // Redirect to home in case of an error
        }
        res.redirect('/'); // Redirect to the home page after logout
    });
});


// Export the router object so index.js can access it
module.exports = router;
