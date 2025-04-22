CREATE DATABASE IF NOT EXISTS support_db;
USE support_db;

CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  product_name VARCHAR(255),
  order_date DATE
);

INSERT INTO orders (customer_id, product_name, order_date)
VALUES 
  (1, '무선 마우스', '2025-01-10'),
  (1, '노트북 거치대', '2025-02-03'),
  (2, '블루투스 이어폰', '2025-02-15');

CREATE TABLE IF NOT EXISTS tickets (
  ticket_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64),
  user_name VARCHAR(100),
  user_phone VARCHAR(20),
  question TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  assigned_to VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE
);
