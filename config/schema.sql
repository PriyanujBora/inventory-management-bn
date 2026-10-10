-- Inventory management schema (MySQL 5.7+ compatible). Safe to re-run.

CREATE DATABASE IF NOT EXISTS inventory_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inventory_management;

-- One row per barcode. `status` flips between 'in' and 'out' on every scan.
CREATE TABLE IF NOT EXISTS products (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  barcode     VARCHAR(128) NOT NULL,
  name        VARCHAR(255) NULL,
  type        ENUM('consumable', 'sellable') NOT NULL,
  status      ENUM('in', 'out') NOT NULL DEFAULT 'in',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_barcode (barcode),
  KEY idx_products_type_status (type, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Every scan, in the order it happened.
CREATE TABLE IF NOT EXISTS scan_logs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id  INT UNSIGNED NOT NULL,
  direction   ENUM('in', 'out') NOT NULL,
  scanned_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_scan_logs_product (product_id),
  CONSTRAINT fk_scan_logs_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
