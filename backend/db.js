// db.js
const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool using environment variables
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test the connection when the module loads
pool.connect((err, client, release) => {
    if (err) {
        release && release(); 
        // This is the most common failure point (wrong password/user)
        return console.error('FATAL: Database connection failed. Check .env credentials and ensure PostgreSQL is running.', err.stack);
    }
    console.log('Successfully connected to PostgreSQL!');
    release(); 
});

// Export the query function for easy database interaction
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool
};

// Create required tables if they don't exist. Call this on server startup.
async function createTables() {
  // SQL to create users table
  const createUsers = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // SQL to create clipboard_data table
  const createClipboard = `
    CREATE TABLE IF NOT EXISTS clipboard_data (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      encrypted_data TEXT NOT NULL,
      ttl_seconds INTEGER DEFAULT 3600,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    // Use the pool to run the queries sequentially
    await pool.query(createUsers);
    await pool.query(createClipboard);
    console.log('Database tables are ready.');
  } catch (err) {
    console.error('Error creating tables:', err);
    throw err; // rethrow so callers can react
  }
}

// Export helper to create tables
module.exports.createTables = createTables;