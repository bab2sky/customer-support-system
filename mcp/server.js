require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');

const app = express();
const API_KEY = fs.readFileSync(process.env.API_KEY_FILE, 'utf8').trim();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.header('x-api-key') !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Orders endpoint
app.get('/api/orders', (req, res) => {
  const customerId = req.query.customer_id;
  if (!customerId) return res.status(400).json({ error: 'customer_id required' });
  pool.query(
    'SELECT order_id, product_name, order_date FROM orders WHERE customer_id = ?',
    [customerId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ orders: results });
    }
  );
});

// Tickets endpoints
app.get('/api/tickets', (req, res) => {
  pool.query(
    'SELECT ticket_id, user_id, user_name, user_phone, question, status, assigned_to, created_at FROM tickets',
    (err, results) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ tickets: results });
    }
  );
});
app.put('/api/tickets/:id', (req, res) => {
  const { status, assigned_to } = req.body;
  pool.query(
    'UPDATE tickets SET status = ?, assigned_to = ? WHERE ticket_id = ?',
    [status, assigned_to, req.params.id],
    err => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ message: 'Ticket updated' });
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP server running on port ${PORT}`));
