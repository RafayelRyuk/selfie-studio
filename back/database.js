const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./reservations.db");

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    user_id TEXT NOT NULL
  )
`);

module.exports = db;
