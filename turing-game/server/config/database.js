const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'turing_game',
  password: 'debirunrun',
  port: process.env.DB_PORT || 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
}; 