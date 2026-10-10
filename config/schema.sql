-- =====================================================================
-- WARNING: this script DROPS and recreates the inventory_management
-- database. Every product, movement and count in it is lost.
-- Development only. Never run it against live data.
-- =====================================================================
-- Salon stock ledger schema (MySQL 5.7+ compatible).
-- Stock on hand is always SUM(stock_movements.qty); there is no stock column.

DROP DATABASE IF EXISTS inventory_management;
CREATE DATABASE inventory_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_management;

CREATE TABLE staff (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  role       ENUM('owner', 'manager', 'stylist', 'other') NOT NULL DEFAULT 'stylist',
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE products (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  barcode       VARCHAR(128) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  category      ENUM('professional', 'retail') NOT NULL,
  unit_cost     DECIMAL(10, 2) NULL,              -- latest purchase cost per unit, ₹
  reorder_level INT UNSIGNED NOT NULL DEFAULT 0,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_barcode (barcode)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE stock_receipts (              -- one row per delivery scanned in
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference    VARCHAR(100) NULL,          -- supplier bill / invoice number
  supplier     VARCHAR(150) NULL,
  is_opening   TINYINT(1) NOT NULL DEFAULT 0,
  recorded_by  INT UNSIGNED NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_receipts_time (created_at)       -- receipt list is filtered by date
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE stock_counts (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  status      ENUM('open', 'closed', 'cancelled') NOT NULL DEFAULT 'open',
  note        VARCHAR(255) NULL,
  started_by  INT UNSIGNED NULL,
  started_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at   DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_counts_status (status)           -- "is a count open?" is asked on every scan screen
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Append-only ledger. Rows are NEVER updated or deleted; mistakes are fixed by a reversal row.
CREATE TABLE stock_movements (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id  INT UNSIGNED NOT NULL,
  type        ENUM('opening', 'purchase', 'used', 'sold', 'damaged', 'count_adjustment') NOT NULL,
  qty         INT NOT NULL,                 -- signed: + into stock, - out of stock
  unit_cost   DECIMAL(10, 2) NULL,          -- cost snapshot at the time of the movement
  taken_by    INT UNSIGNED NULL,            -- staff who took the item (required for used/sold/damaged)
  recorded_by INT UNSIGNED NULL,            -- logged-in operator; NULL until login exists
  receipt_id  INT UNSIGNED NULL,            -- groups a delivery's purchase rows
  count_id    INT UNSIGNED NULL,            -- set on count_adjustment rows
  reverses_id BIGINT UNSIGNED NULL,         -- set when this row undoes another row
  note        VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_movements_reverses (reverses_id),   -- a row can be reversed only once
  KEY idx_movements_product_time (product_id, created_at),
  KEY idx_movements_staff_time (taken_by, created_at),
  KEY idx_movements_type_time (type, created_at),
  CONSTRAINT fk_mov_product  FOREIGN KEY (product_id)  REFERENCES products (id)        ON DELETE RESTRICT,
  CONSTRAINT fk_mov_taken    FOREIGN KEY (taken_by)    REFERENCES staff (id)           ON DELETE RESTRICT,
  CONSTRAINT fk_mov_recorded FOREIGN KEY (recorded_by) REFERENCES staff (id)           ON DELETE RESTRICT,
  CONSTRAINT fk_mov_receipt  FOREIGN KEY (receipt_id)  REFERENCES stock_receipts (id)  ON DELETE RESTRICT,
  CONSTRAINT fk_mov_count    FOREIGN KEY (count_id)    REFERENCES stock_counts (id)    ON DELETE RESTRICT,
  CONSTRAINT fk_mov_reverses FOREIGN KEY (reverses_id) REFERENCES stock_movements (id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE stock_count_lines (
  count_id     INT UNSIGNED NOT NULL,
  product_id   INT UNSIGNED NOT NULL,
  counted_qty  INT UNSIGNED NOT NULL DEFAULT 0,
  expected_qty INT NULL,                   -- filled when the count is closed
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (count_id, product_id),
  CONSTRAINT fk_cl_count   FOREIGN KEY (count_id)   REFERENCES stock_counts (id) ON DELETE RESTRICT,
  CONSTRAINT fk_cl_product FOREIGN KEY (product_id) REFERENCES products (id)     ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
