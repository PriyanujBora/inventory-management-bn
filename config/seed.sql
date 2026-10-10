-- Optional demo data so every screen has something to show. Run after schema.sql:
--   mysql -u root -p < config/seed.sql
-- Timeline (relative to when you run it): opening stock 8 days ago, a delivery 5 days ago,
-- daily usage and sales, one undone scan, a stock count yesterday that found 3 units of
-- Majirel and 1 Absolut Repair Shampoo missing (and 1 Koleston surplus), then a few
-- movements today. Final stock: 3 products at or below their reorder level.

USE inventory_management;

-- The app stores UTC; make CURRENT_TIMESTAMP defaults UTC as well, whatever the server's zone.
SET time_zone = '+00:00';
SET @now = UTC_TIMESTAMP();

INSERT INTO staff (id, name, role) VALUES
  (1, 'Anita Sharma', 'owner'),
  (2, 'Rahul Verma', 'manager'),
  (3, 'Riya', 'stylist'),
  (4, 'Priya', 'stylist'),
  (5, 'Sana', 'stylist');

INSERT INTO products (id, barcode, name, category, unit_cost, reorder_level) VALUES
  (1,  '8901030865278', 'L''Oréal Majirel 6.0 Dark Blonde 50 ml',      'professional',  520.00, 6),
  (2,  '8901030865285', 'L''Oréal Oxydant Developer 6% 1 L',           'professional',  650.00, 3),
  (3,  '4064666211234', 'Wella Koleston Perfect 7/0 60 ml',            'professional',  480.00, 5),
  (4,  '4045787100015', 'Schwarzkopf BC Bonacure Shampoo 1 L',         'professional', 1150.00, 2),
  (5,  '8906012345678', 'Rica Liposoluble Wax 800 ml',                 'professional',  690.00, 3),
  (6,  '3474636712345', 'L''Oréal Serie Expert Absolut Repair Shampoo 300 ml', 'retail',  950.00, 4),
  (7,  '3474636712352', 'L''Oréal Serie Expert Absolut Repair Mask 250 ml',    'retail', 1250.00, 3),
  (8,  '8904245700011', 'Matrix Opti.Care Smooth Straight Shampoo 350 ml',     'retail',  525.00, 4),
  (9,  '4045787200012', 'Schwarzkopf OSiS+ Session Hairspray 300 ml',          'retail', 1100.00, 2),
  (10, '3474636977003', 'Kérastase Elixir Ultime Oil 100 ml',                  'retail', 3900.00, 2);

-- Go-live: stock already on the shelves
INSERT INTO stock_receipts (id, reference, supplier, is_opening, created_at) VALUES
  (1, NULL, NULL, 1, @now - INTERVAL 8 DAY);

INSERT INTO stock_movements (id, product_id, type, qty, unit_cost, receipt_id, created_at) VALUES
  (1,  1,  'opening', 12,  520.00, 1, @now - INTERVAL 8 DAY),
  (2,  2,  'opening',  6,  650.00, 1, @now - INTERVAL 8 DAY),
  (3,  3,  'opening', 10,  480.00, 1, @now - INTERVAL 8 DAY),
  (4,  4,  'opening',  4, 1150.00, 1, @now - INTERVAL 8 DAY),
  (5,  5,  'opening',  5,  690.00, 1, @now - INTERVAL 8 DAY),
  (6,  6,  'opening',  8,  950.00, 1, @now - INTERVAL 8 DAY),
  (7,  7,  'opening',  6, 1250.00, 1, @now - INTERVAL 8 DAY),
  (8,  8,  'opening', 10,  525.00, 1, @now - INTERVAL 8 DAY),
  (9,  9,  'opening',  4, 1100.00, 1, @now - INTERVAL 8 DAY),
  (10, 10, 'opening',  3, 3900.00, 1, @now - INTERVAL 8 DAY);

-- A delivery
INSERT INTO stock_receipts (id, reference, supplier, is_opening, created_at) VALUES
  (2, 'GD/2041', 'Glamour Distributors', 0, @now - INTERVAL 5 DAY);

INSERT INTO stock_movements (id, product_id, type, qty, unit_cost, receipt_id, created_at) VALUES
  (11, 1, 'purchase', 10, 520.00, 2, @now - INTERVAL 5 DAY),
  (12, 2, 'purchase',  4, 650.00, 2, @now - INTERVAL 5 DAY),
  (13, 6, 'purchase',  6, 950.00, 2, @now - INTERVAL 5 DAY);

-- Day-to-day: used in services, sold, damaged (taken_by = staff id)
INSERT INTO stock_movements (id, product_id, type, qty, unit_cost, taken_by, note, created_at) VALUES
  (14, 1, 'used',    -1,  520.00, 3, NULL, @now - INTERVAL 7 DAY),
  (15, 1, 'used',    -1,  520.00, 3, NULL, @now - INTERVAL 6 DAY),
  (16, 1, 'used',    -1,  520.00, 4, NULL, @now - INTERVAL 6 DAY + INTERVAL 2 HOUR),
  (17, 1, 'used',    -1,  520.00, 4, NULL, @now - INTERVAL 4 DAY),
  (18, 1, 'used',    -1,  520.00, 4, NULL, @now - INTERVAL 3 DAY),
  (19, 1, 'used',    -1,  520.00, 5, NULL, @now - INTERVAL 2 DAY),
  (20, 2, 'used',    -1,  650.00, 3, NULL, @now - INTERVAL 6 DAY + INTERVAL 3 HOUR),
  (21, 2, 'used',    -1,  650.00, 4, NULL, @now - INTERVAL 3 DAY + INTERVAL 1 HOUR),
  (22, 3, 'used',    -1,  480.00, 5, NULL, @now - INTERVAL 5 DAY + INTERVAL 4 HOUR),
  (23, 3, 'used',    -1,  480.00, 5, NULL, @now - INTERVAL 2 DAY + INTERVAL 2 HOUR),
  (24, 4, 'used',    -1, 1150.00, 4, NULL, @now - INTERVAL 4 DAY + INTERVAL 2 HOUR),
  (25, 5, 'used',    -1,  690.00, 3, NULL, @now - INTERVAL 7 DAY + INTERVAL 3 HOUR),
  (26, 5, 'used',    -1,  690.00, 5, NULL, @now - INTERVAL 3 DAY + INTERVAL 3 HOUR),
  (27, 6, 'sold',    -1,  950.00, 3, NULL, @now - INTERVAL 6 DAY + INTERVAL 5 HOUR),
  (28, 6, 'sold',    -1,  950.00, 3, NULL, @now - INTERVAL 4 DAY + INTERVAL 5 HOUR),
  (29, 6, 'sold',    -1,  950.00, 2, NULL, @now - INTERVAL 3 DAY + INTERVAL 5 HOUR),
  (30, 7, 'sold',    -1, 1250.00, 4, NULL, @now - INTERVAL 5 DAY + INTERVAL 6 HOUR),
  (31, 8, 'sold',    -2,  525.00, 5, NULL, @now - INTERVAL 4 DAY + INTERVAL 6 HOUR),
  (32, 10, 'sold',   -1, 3900.00, 3, NULL, @now - INTERVAL 3 DAY + INTERVAL 6 HOUR),
  (33, 9, 'damaged', -1, 1100.00, 2, 'Nozzle broken', @now - INTERVAL 5 DAY + INTERVAL 7 HOUR),
  (34, 8, 'sold',    -1,  525.00, 3, NULL, @now - INTERVAL 2 DAY + INTERVAL 5 HOUR);

-- Scanned by mistake and undone straight away
INSERT INTO stock_movements (id, product_id, type, qty, unit_cost, taken_by, reverses_id, note, created_at) VALUES
  (35, 8, 'sold', 1, 525.00, 3, 34, 'Undone at scan time', @now - INTERVAL 2 DAY + INTERVAL 5 HOUR);

-- Yesterday's stock count: Majirel 3 short, Absolut Repair Shampoo 1 short, Koleston 1 over
INSERT INTO stock_counts (id, status, note, started_at, closed_at) VALUES
  (1, 'closed', 'Weekly count', @now - INTERVAL 1 DAY - INTERVAL 1 HOUR, @now - INTERVAL 1 DAY);

INSERT INTO stock_count_lines (count_id, product_id, counted_qty, expected_qty, updated_at) VALUES
  (1, 1, 13, 16, @now - INTERVAL 1 DAY),
  (1, 2,  8,  8, @now - INTERVAL 1 DAY),
  (1, 3,  9,  8, @now - INTERVAL 1 DAY),
  (1, 4,  3,  3, @now - INTERVAL 1 DAY),
  (1, 5,  3,  3, @now - INTERVAL 1 DAY),
  (1, 6, 10, 11, @now - INTERVAL 1 DAY),
  (1, 7,  5,  5, @now - INTERVAL 1 DAY),
  (1, 8,  8,  8, @now - INTERVAL 1 DAY),
  (1, 9,  3,  3, @now - INTERVAL 1 DAY),
  (1, 10, 2,  2, @now - INTERVAL 1 DAY);

INSERT INTO stock_movements (id, product_id, type, qty, unit_cost, count_id, created_at) VALUES
  (36, 1, 'count_adjustment', -3, 520.00, 1, @now - INTERVAL 1 DAY),
  (37, 3, 'count_adjustment',  1, 480.00, 1, @now - INTERVAL 1 DAY),
  (38, 6, 'count_adjustment', -1, 950.00, 1, @now - INTERVAL 1 DAY);

-- Today
INSERT INTO stock_movements (id, product_id, type, qty, unit_cost, taken_by, created_at) VALUES
  (39, 1,  'used', -1,  520.00, 3, @now - INTERVAL 5 HOUR),
  (40, 4,  'used', -2, 1150.00, 4, @now - INTERVAL 4 HOUR),
  (41, 10, 'sold', -1, 3900.00, 5, @now - INTERVAL 3 HOUR);
