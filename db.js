const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'campaigns.db'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT DEFAULT 'pending',
        subject TEXT,
        html TEXT,
        from_name TEXT,
        from_email TEXT,
        attachments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        email TEXT,
        name TEXT,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
    )`);
});

module.exports = db;
