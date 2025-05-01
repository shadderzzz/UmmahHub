# Create database script for UmmahHub

# Create the database
CREATE DATABASE IF NOT EXISTS main;
USE main;

# Create the users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100) UNIQUE,
    hashedPassword VARCHAR(255),
    PRIMARY KEY (id)
);

# Create the Q&A Forum table
CREATE TABLE IF NOT EXISTS qaForum (
    id INT AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    author_id INT NOT NULL, -- Foreign key to users table
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    user_id INT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES qaForum(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

# Create the app user
CREATE USER IF NOT EXISTS 'user'@'localhost' IDENTIFIED BY 'qwertyuiop'; 
GRANT ALL PRIVILEGES ON main.* TO 'user'@'localhost';
