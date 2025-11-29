const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbPath = path.join(__dirname, "reservations.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err);
  } else {
    console.log("Database connected:", dbPath);
  }
});

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
`, (err) => {
  if (err) {
    console.error("Error creating table:", err);
  } else {
    console.log("Reservations table ready");
  }
});

module.exports = db;
