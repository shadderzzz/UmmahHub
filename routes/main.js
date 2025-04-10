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
router.use('/duaForum', ensureLoggedIn);

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

// Category selection page
router.get('/qaForum', (req, res) => {
    res.render('forum'); // Render the category selection page
});

// Q&A forum for a specific category
router.get('/qaForum/:category', (req, res) => {
    const category = req.params.category;
    let sql = "";
    let sqlAnswers = "";
    
    if (category === "afterlife") {
        sql = `
            SELECT afterlife_questions.id, afterlife_questions.title, afterlife_questions.body, afterlife_questions.created_at, users.username AS author
            FROM afterlife_questions
            JOIN users ON afterlife_questions.author_id = users.id
            ORDER BY afterlife_questions.created_at DESC
        `;

        sqlAnswers = `
            SELECT afterlife_answers.answer, afterlife_answers.created_at, users.username AS answer_author, afterlife_answers.question_id
            FROM afterlife_answers
            JOIN users ON afterlife_answers.user_id = users.id
            WHERE afterlife_answers.question_id IN (
                SELECT id FROM afterlife_questions
            )
            ORDER BY afterlife_answers.created_at DESC
        `;
    } else if (category === "this-life") {
        sql = `
            SELECT this_life_questions.id, this_life_questions.title, this_life_questions.body, this_life_questions.created_at, users.username AS author
            FROM this_life_questions
            JOIN users ON this_life_questions.author_id = users.id
            ORDER BY this_life_questions.created_at DESC
        `;

        sqlAnswers = `
            SELECT this_life_answers.answer, this_life_answers.created_at, users.username AS answer_author, this_life_answers.question_id
            FROM this_life_answers
            JOIN users ON this_life_answers.user_id = users.id
            WHERE this_life_answers.question_id IN (
                SELECT id FROM this_life_questions
            )
            ORDER BY this_life_answers.created_at DESC
        `;
    } else {
        return res.status(404).send("Category not found");
    }

    db.query(sql, (err, questions) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching questions');
        }

        db.query(sqlAnswers, (err, answers) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching answers');
            }

            const answersGrouped = questions.reduce((acc, question) => {
                acc[question.id] = answers.filter(answer => answer.question_id === question.id);
                question.responseCount = acc[question.id].length;
                return acc;
            }, {});

            res.render('qaForum', {
                questions: questions,
                answers: answersGrouped,
                username: req.session.userId,
                category: category
            });
        });
    });
});

// Route to view a specific question in a category
router.get('/qaForum/:category/:id', (req, res) => {
    const { category, id: questionId } = req.params;
    let sqlQuestion = "";
    let sqlAnswers = "";

    if (category === "afterlife") {
        sqlQuestion = `
            SELECT afterlife_questions.id, afterlife_questions.title, afterlife_questions.body, afterlife_questions.created_at, users.username AS author
            FROM afterlife_questions
            JOIN users ON afterlife_questions.author_id = users.id
            WHERE afterlife_questions.id = ?
        `;

        sqlAnswers = `
            SELECT afterlife_answers.answer, afterlife_answers.created_at, users.username AS answer_author
            FROM afterlife_answers
            JOIN users ON afterlife_answers.user_id = users.id
            WHERE afterlife_answers.question_id = ?
            ORDER BY afterlife_answers.created_at DESC
        `;
    } else if (category === "this-life") {
        sqlQuestion = `
            SELECT this_life_questions.id, this_life_questions.title, this_life_questions.body, this_life_questions.created_at, users.username AS author
            FROM this_life_questions
            JOIN users ON this_life_questions.author_id = users.id
            WHERE this_life_questions.id = ?
        `;

        sqlAnswers = `
            SELECT this_life_answers.answer, this_life_answers.created_at, users.username AS answer_author
            FROM this_life_answers
            JOIN users ON this_life_answers.user_id = users.id
            WHERE this_life_answers.question_id = ?
            ORDER BY this_life_answers.created_at DESC
        `;
    } else {
        return res.status(404).send("Category not found");
    }

    db.query(sqlQuestion, [questionId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching question');
        }

        if (results.length === 0) {
            return res.status(404).send('Question not found');
        }

        const question = results[0];

        db.query(sqlAnswers, [questionId], (err, answers) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching answers');
            }

            res.render('answerQuestion', { 
                question: question,
                answers: answers,
                username: req.session.userId,
                category: category
            });
        });
    });
});

// Route to post an answer to a question
router.post('/qaForum/:category/:id/answer', (req, res) => {
    const { category, id: questionId } = req.params;
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
        let sqlInsertAnswer = "";

        if (category === "afterlife") {
            sqlInsertAnswer = 'INSERT INTO afterlife_answers (question_id, user_id, answer) VALUES (?, ?, ?)';
        } else if (category === "this-life") {
            sqlInsertAnswer = 'INSERT INTO this_life_answers (question_id, user_id, answer) VALUES (?, ?, ?)';
        } else {
            return res.status(400).send('Invalid category');
        }

        // Now insert the answer with the correct user_id (which is the user id)
        db.query(sqlInsertAnswer, [questionId, userId, answer], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error posting answer');
            }
            res.redirect(req.get('referer')); // Redirect back to the previous page after submitting an answer
        });
    });
});

// Route to post a question in a category
router.post('/qaForum/:category/post', (req, res) => {
    const category = req.params.category;
    const { title, body } = req.body;
    const username = req.session.userId;

    if (!username) {
        return res.redirect('/users/login');
    }

    const sqlUser = 'SELECT id FROM users WHERE username = ?';
    db.query(sqlUser, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching user ID');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found');
        }

        const userId = results[0].id;
        let sqlInsert = "";

        if (category === "afterlife") {
            sqlInsert = 'INSERT INTO afterlife_questions (title, body, author_id) VALUES (?, ?, ?)';
        } else if (category === "this-life") {
            sqlInsert = 'INSERT INTO this_life_questions (title, body, author_id) VALUES (?, ?, ?)';
        } else {
            return res.status(400).send('Invalid category');
        }

        db.query(sqlInsert, [title, body, userId], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error posting question');
            }
            res.redirect(`/qaForum/${category}`);
        });
    });
});

// Route to view all answers for a specific question
router.get('/qaForum/:category/:id/answers', (req, res) => {
    const { category, id: questionId } = req.params;
    let sqlQuestion = "";
    let sqlAnswers = "";

    if (category === "afterlife") {
        sqlQuestion = `
            SELECT afterlife_questions.id, afterlife_questions.title, afterlife_questions.body, afterlife_questions.created_at, users.username AS author
            FROM afterlife_questions
            JOIN users ON afterlife_questions.author_id = users.id
            WHERE afterlife_questions.id = ?
        `;

        sqlAnswers = `
            SELECT afterlife_answers.answer, afterlife_answers.created_at, users.username AS answer_author
            FROM afterlife_answers
            JOIN users ON afterlife_answers.user_id = users.id
            WHERE afterlife_answers.question_id = ?
            ORDER BY afterlife_answers.created_at DESC
        `;
    } else if (category === "this-life") {
        sqlQuestion = `
            SELECT this_life_questions.id, this_life_questions.title, this_life_questions.body, this_life_questions.created_at, users.username AS author
            FROM this_life_questions
            JOIN users ON this_life_questions.author_id = users.id
            WHERE this_life_questions.id = ?
        `;

        sqlAnswers = `
            SELECT this_life_answers.answer, this_life_answers.created_at, users.username AS answer_author
            FROM this_life_answers
            JOIN users ON this_life_answers.user_id = users.id
            WHERE this_life_answers.question_id = ?
            ORDER BY this_life_answers.created_at DESC
        `;
    } else {
        return res.status(404).send("Category not found");
    }

    db.query(sqlQuestion, [questionId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching question');
        }

        if (results.length === 0) {
            return res.status(404).send('Question not found');
        }

        const question = results[0];

        db.query(sqlAnswers, [questionId], (err, answers) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching answers');
            }

            res.render('viewAnswers', { 
                question: question,
                answers: answers,
                userId: req.session.userId,
                category: category // ✅ Ensure category is passed to EJS
            });
        });
    });
});


// Display Dua Forum with Seen and Unseen Categories
router.get('/duaForum', (req, res) => {
    const username = req.session.userId;
    if (!username) return res.redirect('/users/login');

    const sqlUser = "SELECT id FROM users WHERE username = ?";
    db.query(sqlUser, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error retrieving user ID");
        }

        if (results.length === 0) return res.status(404).send("User not found");

        const userId = results[0].id;

        // Fetch all Duas and check if they have been seen
        const sqlDuas = `
            SELECT 
                dua_requests.id, 
                dua_requests.dua_text, 
                users.username, 
                IF(dua_seen.seen IS NULL, 0, 1) AS seen 
            FROM dua_requests 
            JOIN users ON dua_requests.user_id = users.id 
            LEFT JOIN dua_seen ON dua_requests.id = dua_seen.dua_id AND dua_seen.user_id = ?
            ORDER BY dua_requests.created_at DESC
        `;

        db.query(sqlDuas, [userId], (err, duas) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error retrieving Duas");
            }

            const unseenDuas = duas.filter(dua => dua.seen === 0);
            const seenDuas = duas.filter(dua => dua.seen === 1);

            res.render('duaForum', {
                unseenDuas,
                seenDuas,
                session: req.session // ✅ Pass session to the template
            });
        });
    });
});


router.post('/duaForum/add', (req, res) => {
    const { dua_text } = req.body;
    const username = req.session.userId; // This contains the username

    if (!username) return res.redirect('/users/login');

    // Get the user's numeric ID from the database
    const sqlUser = "SELECT id FROM users WHERE username = ?";
    db.query(sqlUser, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error retrieving user ID");
        }

        if (results.length === 0) {
            return res.status(404).send("User not found");
        }

        const userId = results[0].id; // Extract the numeric user ID

        // Now insert the Dua with the correct user_id
        const sqlInsertDua = "INSERT INTO dua_requests (user_id, dua_text) VALUES (?, ?)";
        db.query(sqlInsertDua, [userId, dua_text], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error adding Dua");
            }
            res.redirect('/duaForum');
        });
    });
});


// Mark a Dua as seen
router.post('/duaForum/seen/:id', (req, res) => {
    const duaId = req.params.id;
    const username = req.session.userId;

    if (!username) return res.redirect('/users/login');

    const sqlUser = "SELECT id FROM users WHERE username = ?";
    db.query(sqlUser, [username], (err, results) => {
        if (err) return res.status(500).send("Error retrieving user ID");
        if (results.length === 0) return res.status(404).send("User not found");

        const userId = results[0].id;

        // Toggle "seen" status
        const sqlToggleSeen = `
            INSERT INTO dua_seen (user_id, dua_id, seen) 
            VALUES (?, ?, TRUE) 
            ON DUPLICATE KEY UPDATE seen = NOT seen;
        `;

        db.query(sqlToggleSeen, [userId, duaId], (err, result) => {
            if (err) return res.status(500).send("Error updating seen status");
            res.redirect('/duaForum');
        });
    });
});

// Delete a Dua (Only by the Original Poster)
router.post('/duaForum/delete/:id', (req, res) => {
    const duaId = req.params.id;
    const username = req.session.userId;

    if (!username) return res.redirect('/users/login');

    // Get the user's ID from the database
    const sqlUser = "SELECT id FROM users WHERE username = ?";
    db.query(sqlUser, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error retrieving user ID");
        }

        if (results.length === 0) {
            return res.status(404).send("User not found");
        }

        const userId = results[0].id;

        // Ensure the logged-in user is the author of the Dua
        const sqlDeleteDua = "DELETE FROM dua_requests WHERE id = ? AND user_id = ?";
        db.query(sqlDeleteDua, [duaId, userId], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error deleting Dua");
            }

            if (result.affectedRows === 0) {
                return res.status(403).send("You are not authorized to delete this Dua.");
            }

            res.redirect('/duaForum');
        });
    });
});




// Export the router object
module.exports = router;
