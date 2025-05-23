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
    res.render('forum', { username: req.session.userId }); // Render the category selection page
});

// Q&A forum for a specific category
router.get('/qaForum/:category', (req, res) => {
    const category = req.params.category;
    
    // Check if the category is valid
    if (category !== "afterlife" && category !== "this-life") {
        return res.status(404).send("Category not found");
    }

    let sql = "";
    
    if (category === "afterlife") {
        sql = `
            SELECT afterlife_questions.id, afterlife_questions.title, afterlife_questions.body, afterlife_questions.created_at, users.username AS author
            FROM afterlife_questions
            JOIN users ON afterlife_questions.author_id = users.id
            ORDER BY afterlife_questions.created_at DESC
        `;
    } else if (category === "this-life") {
        sql = `
            SELECT this_life_questions.id, this_life_questions.title, this_life_questions.body, this_life_questions.created_at, users.username AS author
            FROM this_life_questions
            JOIN users ON this_life_questions.author_id = users.id
            ORDER BY this_life_questions.created_at DESC
        `;
    }

    db.query(sql, (err, questions) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error fetching questions');
        }

        res.render('qaForum', {
            questions: questions,
            username: req.session.userId,
            category: category
        });
    });
});

// Q&A forum for a specific category
router.get('/qaForum/:category/:id', (req, res) => {
    const { category, id: questionId } = req.params;
    let sqlQuestion = "";

    if (category === "afterlife") {
        sqlQuestion = `
            SELECT afterlife_questions.id, afterlife_questions.title, afterlife_questions.body, afterlife_questions.created_at, users.username AS author
            FROM afterlife_questions
            JOIN users ON afterlife_questions.author_id = users.id
            WHERE afterlife_questions.id = ?
        `;
    } else if (category === "this-life") {
        sqlQuestion = `
            SELECT this_life_questions.id, this_life_questions.title, this_life_questions.body, this_life_questions.created_at, users.username AS author
            FROM this_life_questions
            JOIN users ON this_life_questions.author_id = users.id
            WHERE this_life_questions.id = ?
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

        res.render('answerQuestion', { 
            question: question,
            username: req.session.userId,
            category: category
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
            SELECT afterlife_answers.id, afterlife_answers.answer, afterlife_answers.created_at, users.username AS answer_author
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
            SELECT this_life_answers.id, this_life_answers.answer, this_life_answers.created_at, users.username AS answer_author
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
                category: category // Ensure category is passed to EJS
            });
        });
    });
});

// Route to delete a question
router.delete('/qaForum/:category/:id', (req, res) => {
    const { category, id: questionId } = req.params;
    const username = req.session.userId;

    if (!username) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    // First get the question to check ownership
    let sqlCheck = "";
    if (category === "afterlife") {
        sqlCheck = `
            SELECT q.*, u.username 
            FROM afterlife_questions q
            JOIN users u ON q.author_id = u.id
            WHERE q.id = ?
        `;
    } else if (category === "this-life") {
        sqlCheck = `
            SELECT q.*, u.username 
            FROM this_life_questions q
            JOIN users u ON q.author_id = u.id
            WHERE q.id = ?
        `;
    } else {
        return res.status(400).json({ error: 'Invalid category' });
    }

    db.query(sqlCheck, [questionId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Question not found' });
        }

        const question = results[0];
        if (question.username !== username) {
            return res.status(403).json({ error: 'Not authorized to delete this question' });
        }

        // If authorized, proceed with deletion
        // First delete all associated answers
        let sqlDeleteAnswers = "";
        if (category === "afterlife") {
            sqlDeleteAnswers = 'DELETE FROM afterlife_answers WHERE question_id = ?';
        } else {
            sqlDeleteAnswers = 'DELETE FROM this_life_answers WHERE question_id = ?';
        }

        // Delete answers first, then delete the question
        db.query(sqlDeleteAnswers, [questionId], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error deleting answers' });
            }

            // Now delete the question
            let sqlDeleteQuestion = "";
            if (category === "afterlife") {
                sqlDeleteQuestion = 'DELETE FROM afterlife_questions WHERE id = ?';
            } else {
                sqlDeleteQuestion = 'DELETE FROM this_life_questions WHERE id = ?';
            }

            db.query(sqlDeleteQuestion, [questionId], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Error deleting question' });
                }
                res.json({ message: 'Question and all associated answers deleted successfully' });
            });
        });
    });
});

// Route to delete an answer
router.delete('/qaForum/:category/:questionId/answer/:answerId', (req, res) => {
    const { category, questionId, answerId } = req.params;
    const username = req.session.userId;

    console.log('Delete answer request:', { category, questionId, answerId, username });

    if (!username) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    // First get the answer to check ownership
    let sqlCheck = "";
    if (category === "afterlife") {
        sqlCheck = `
            SELECT a.*, u.username 
            FROM afterlife_answers a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = ? AND a.question_id = ?
        `;
    } else if (category === "this-life") {
        sqlCheck = `
            SELECT a.*, u.username 
            FROM this_life_answers a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = ? AND a.question_id = ?
        `;
    } else {
        return res.status(400).json({ error: 'Invalid category' });
    }

    console.log('SQL Check Query:', sqlCheck);
    console.log('Parameters:', [answerId, questionId]);

    db.query(sqlCheck, [answerId, questionId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        console.log('Query results:', results);

        if (results.length === 0) {
            return res.status(404).json({ error: 'Answer not found' });
        }

        const answer = results[0];
        console.log('Answer found:', answer);
        console.log('Username comparison:', { answerUsername: answer.username, currentUsername: username });

        if (answer.username !== username) {
            return res.status(403).json({ error: 'Not authorized to delete this answer' });
        }

        // If authorized, proceed with deletion
        let sqlDelete = "";
        if (category === "afterlife") {
            sqlDelete = 'DELETE FROM afterlife_answers WHERE id = ? AND question_id = ?';
        } else {
            sqlDelete = 'DELETE FROM this_life_answers WHERE id = ? AND question_id = ?';
        }

        console.log('SQL Delete Query:', sqlDelete);

        db.query(sqlDelete, [answerId, questionId], (err, result) => {
            if (err) {
                console.error('Delete error:', err);
                return res.status(500).json({ error: 'Error deleting answer' });
            }
            console.log('Delete result:', result);
            res.json({ message: 'Answer deleted successfully' });
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
                dua_requests.created_at,
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
