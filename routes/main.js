// Create a new router
const express = require("express");
const router = express.Router();
const request = require('request');

// Middleware to check login globally for protected routes
const ensureLoggedIn = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/users/login'); // Redirect to login if user is not logged in
    }
    next(); // If the user is logged in, proceed to the next middleware or route handler
};

// Apply the ensureLoggedIn middleware to the routes that need protection
router.use('/menu', ensureLoggedIn);
router.use('/qaForum', ensureLoggedIn);

// Handle the root route
router.get('/', (req, res) => {
    res.render('index.ejs');
});

// Menu route
router.get('/menu', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/users/login'); // Redirect to login if user is not logged in
    }
    res.render('menu', { user: req.session.userId });
});

// Add the Q&A Forum route
router.get('/qaForum', (req, res) => {
    const sql = `
        SELECT qaForum.id, qaForum.title, qaForum.body, qaForum.created_at, users.username AS author
        FROM qaForum
        JOIN users ON qaForum.author_id = users.id
        ORDER BY qaForum.created_at DESC
    `;

    db.query(sql, (err, questions) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching questions');
        }

        // Fetch responses (answers) for each question
        const sqlAnswers = `
            SELECT answers.answer, answers.created_at, users.username AS answer_author, answers.question_id
            FROM answers
            JOIN users ON answers.user_id = users.id
            WHERE answers.question_id IN (${questions.map(q => q.id).join(', ')})
            ORDER BY answers.created_at DESC
        `;

        db.query(sqlAnswers, (err, answers) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching answers');
            }

            // Group answers by question_id and calculate the response count (number of answers)
            const answersGrouped = questions.reduce((acc, question) => {
                acc[question.id] = answers.filter(answer => answer.question_id === question.id);
                question.responseCount = acc[question.id].length; // Count of responses (answers)
                return acc;
            }, {});

            const username = req.session.userId; // Get the username from the session

            // Pass both the questions, answers, and response count to the view
            res.render('qaForum', { 
                questions: questions, 
                answers: answersGrouped,
                username: username 
            });
        });
    });
});

// Route to view a specific question and post an answer
router.get('/qaForum/:id', (req, res) => {
    const questionId = req.params.id;

    // Fetch the specific question details
    const sqlQuestion = `
        SELECT qaForum.id, qaForum.title, qaForum.body, qaForum.created_at, users.username AS author
        FROM qaForum
        JOIN users ON qaForum.author_id = users.id
        WHERE qaForum.id = ?
    `;

    db.query(sqlQuestion, [questionId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching question');
        }

        if (results.length === 0) {
            return res.status(404).send('Question not found');
        }

        const question = results[0]; // The specific question

        // Fetch the answers (responses) for this question
        const sqlAnswers = `
            SELECT answers.answer, answers.created_at, users.username AS answer_author
            FROM answers
            JOIN users ON answers.user_id = users.id
            WHERE answers.question_id = ?
            ORDER BY answers.created_at DESC
        `;

        db.query(sqlAnswers, [questionId], (err, answers) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching answers');
            }

            // Render the question and the answers (responses) for posting
            res.render('answerQuestion', { 
                question: question,
                answers: answers, // Pass the answers (responses) to the view
                username: req.session.userId 
            });
        });
    });
});

// Route to post an answer to a question
router.post('/qaForum/:id/answer', (req, res) => {
    const questionId = req.params.id;
    const { answer } = req.body;
    const username = req.session.userId; // Get the logged-in user's username from the session

    if (!username) {
        return res.redirect('/users/login'); // Redirect to login if not logged in
    }

    // Query the database to get the user id based on the username
    const sqlUser = 'SELECT id FROM users WHERE username = ?';
    db.query(sqlUser, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching user ID');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found');
        }

        const userId = results[0].id; // Get the user ID from the query result

        // Now insert the answer with the correct user_id (which is the user id)
        const sqlInsertAnswer = 'INSERT INTO answers (question_id, user_id, answer) VALUES (?, ?, ?)';
        db.query(sqlInsertAnswer, [questionId, userId, answer], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error posting answer');
            }
            res.redirect(`/qaForum/${questionId}`); // Redirect back to the specific question page after posting an answer
        });
    });
});

// Route to post a new question
router.post('/qaForum/post', (req, res) => {
    const { title, body } = req.body;
    const username = req.session.userId; // Get the logged-in username

    if (!username) {
        return res.redirect('/users/login'); // Redirect to login if not logged in
    }

    // Query to get the user ID based on the username
    const sqlUser = 'SELECT id FROM users WHERE username = ?';
    db.query(sqlUser, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching user ID');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found');
        }

        const userId = results[0].id; // Get the user ID from the query result

        // Insert the new question into the database
        const sqlInsertQuestion = 'INSERT INTO qaForum (title, body, author_id) VALUES (?, ?, ?)';
        db.query(sqlInsertQuestion, [title, body, userId], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error posting question');
            }
            res.redirect('/qaForum'); // Redirect back to the forum page after posting the question
        });
    });
});

module.exports = router;
