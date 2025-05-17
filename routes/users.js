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
    res.render('register.ejs', { 
        errorMessage: null,
        first: '',
        last: '',
        email: '',
        username: ''
    }); // Ensure errorMessage is always defined
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
        // If validation fails, re-render the register page with error messages and form values
        return res.render('register.ejs', {
            errorMessage: errors.array().map(error => error.msg).join(', '),
            first: req.body.first,
            last: req.body.last,
            email: req.body.email,
            username: req.body.username
        });
    }

    // Continue with the registration logic if validation passes
    const plainPassword = req.body.password;
    const username = req.body.username;
    const firstName = req.body.first;
    const lastName = req.body.last;
    const email = req.body.email;

    bcrypt.hash(plainPassword, saltRounds, function (err, hashedPassword) {
        if (err) {
            return next(err); // Handle error
        }

        const sql = 'INSERT INTO users (username, first_name, last_name, email, hashedPassword) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [username, firstName, lastName, email, hashedPassword], function (err, result) {
            if (err) {
                // Check if it's a duplicate entry error
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.render('register.ejs', {
                        errorMessage: 'Username or email already exists',
                        first: firstName,
                        last: lastName,
                        email: email,
                        username: username
                    });
                }
                return next(err); // Handle other errors
            }

            // Store success message in session and redirect to login
            req.session.successMessage = 'Registration successful! Please login with your credentials.';
            res.redirect('/users/login');
        });
    });
});

// Render the login form
router.get('/login', function (req, res, next) {
    // Get success message from session if it exists
    const successMessage = req.session.successMessage;
    // Clear the success message from session
    delete req.session.successMessage;
    
    res.render('login.ejs', {
        errorMessage: null,
        successMessage: successMessage
    });
});

// Handle login form submission
router.post('/login', function (req, res, next) {
    // Sanitize user input
    req.body.username = req.sanitize(req.body.username);
    req.body.password = req.sanitize(req.body.password);

    const username = req.body.username;
    const plainPassword = req.body.password;

    // Query the database to find the user
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.query(sql, [username], function (err, results) {
        if (err) {
            return next(err); // Handle error
        }

        // If user not found
        if (results.length === 0) {
            return res.render('login.ejs', { 
                errorMessage: 'User not found.',
                successMessage: null
            }); // Handle error for invalid user
        }

        const user = results[0]; // Assuming the username is unique

        // Compare the provided password with the hashed password in the database
        bcrypt.compare(plainPassword, user.hashedPassword, function (err, isMatch) {
            if (err) {
                return next(err); // Handle error
            }

            if (!isMatch) {
                return res.render('login.ejs', { 
                    errorMessage: 'Invalid password.',
                    successMessage: null
                }); // Handle invalid password
            }

            // Save user session here, when login is successful
            req.session.userId = username;

            // Login successful - redirect to the user list page or any other protected route
            res.redirect('/'); // Redirect to the index page after successful login
        });
    });
});

// Route to logout the user and destroy the session instantly
router.get('/logout', redirectLogin, (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/'); // Redirect to home if error occurs
        }
        res.redirect('/'); // Instantly log out and redirect to homepage
    });
});

router.get('/settings', redirectLogin, (req, res) => {
    const sql = 'SELECT username, location FROM users WHERE username = ?';
    db.query(sql, [req.session.userId], (err, results) => {
        if (err) return res.status(500).send('Database error');
        if (results.length === 0) return res.redirect('/users/login');

        const user = results[0];
        const success = req.session.success;
        delete req.session.success;

        res.render('settings.ejs', { user, success, error: null });
    });
});

router.post('/settings', redirectLogin, (req, res) => {
    const newUsername = req.sanitize(req.body.username);
    const location = req.sanitize(req.body.location);

    const sql = 'UPDATE users SET username = ?, location = ? WHERE username = ?';
    db.query(sql, [newUsername, location, req.session.userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.render('settings.ejs', {
                user: { username: req.session.userId, location },
                error: "Username might already be taken.",
                success: null
            });
        }

        req.session.userId = newUsername; // Update session
        req.session.success = 'Your settings have been updated successfully.';
        res.redirect('/users/settings');
    });
});

router.post('/delete', redirectLogin, (req, res) => {
    const userId = req.session.userId;

    const getUserSql = 'SELECT id FROM users WHERE username = ?';
    db.query(getUserSql, [userId], (err, results) => {
        if (err || results.length === 0) {
            console.error(err);
            return res.status(500).send('Error fetching user');
        }

        const internalUserId = results[0].id;

        const deleteSql = 'DELETE FROM users WHERE id = ?';
        db.query(deleteSql, [internalUserId], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error deleting user');
            }

            req.session.destroy(err => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Error ending session');
                }

                res.redirect('/');
            });
        });
    });
});




// Export the router object so index.js can access it
module.exports = router;