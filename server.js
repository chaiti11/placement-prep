const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// DATABASE SETUP
const db = new sqlite3.Database(path.join(__dirname, 'placement_prep.db'), (err) => {
  if (err) console.error('DB Error:', err.message);
  else console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    college TEXT,
    branch TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    test_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Server is working!' });
});

// SIGNUP
app.post('/api/signup', (req, res) => {
  const { name, email, password, college, branch } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }
  db.run(
    `INSERT INTO users (name, email, password, college, branch) VALUES (?, ?, ?, ?, ?)`,
    [name, email, password, college || '', branch || ''],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ success: false, message: 'Email already registered.' });
        }
        return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
      }
      console.log('New user signed up:', name, email);
      res.json({ success: true, message: 'Account created!', userId: this.lastID, name });
    }
  );
});

// LOGIN
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error.' });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    console.log('User logged in:', user.name);
    res.json({ success: true, message: 'Login successful!', userId: user.id, name: user.name });
  });
});

// SAVE RESULT
app.post('/api/results', (req, res) => {
  const { userId, testType, score, total } = req.body;
  if (!userId || !testType || score === undefined || !total) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  db.run(
    `INSERT INTO test_results (user_id, test_type, score, total) VALUES (?, ?, ?, ?)`,
    [userId, testType, score, total],
    function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Could not save result.' });
      res.json({ success: true, message: 'Result saved!', resultId: this.lastID });
    }
  );
});

// GET RESULTS
app.get('/api/results/:userId', (req, res) => {
  db.all(`SELECT * FROM test_results WHERE user_id = ? ORDER BY taken_at DESC`, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error.' });
    res.json({ success: true, results: rows });
  });
});

// GET STATS
app.get('/api/stats/:userId', (req, res) => {
  db.all(`SELECT test_type, score, total, taken_at FROM test_results WHERE user_id = ? ORDER BY taken_at DESC`, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error.' });
    const totalTests = rows.length;
    const avgScore = totalTests > 0 ? Math.round(rows.reduce((sum, r) => sum + (r.score / r.total) * 100, 0) / totalTests) : 0;
    const lastScore = rows.length > 0 ? Math.round((rows[0].score / rows[0].total) * 100) : 0;
    res.json({ success: true, totalTests, avgScore, lastScore, recentResults: rows.slice(0, 5) });
  });
});

app.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
  console.log('Open your app at: http://localhost:' + PORT + '/loginpage.html');
});