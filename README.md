# GridComponent.js Documentation

**GridComponent.js** is a lightweight, meta-data driven CRUD system built with Vanilla JavaScript and PHP. It renders dynamic data grids, handles server-side operations, and supports advanced features like multi-select filtering, master-detail views, and CSV import/export without requiring a heavy frontend framework.

---

## 1. Table of Contents
- [Installation](#2-installation)
- [Database Setup (Demo)](#3-database-setup-demo)
- [Backend Configuration](#4-backend-configuration-grid_defphp)
- [Frontend Implementation](#5-frontend-implementation)
- [Master-Detail Example](#6-master-detail-implementation)
- [Managing Options & Features](#7-managing-options--features)
- [Configuration Reference](#8-configuration-reference)

---

## 2. Installation

1.  **Copy Files**:
    -   `GridComponent.js` → Your JS folder (e.g., `assets/js/`).
    -   `grid_handler.php` → Your backend modules folder (e.g., `modules/x_grid/`).
    -   `grid_def.php` → Same folder as the handler.
    -   `style.css` (or `ux-grid.css`) → Your CSS folder.

2.  **Include Assets**:
    Add the following to your HTML/PHP view:
    ```html
    <link rel="stylesheet" href="assets/css/style.css">
    <meta name="csrf-token" content="<?php echo $_SESSION['csrf_token'] ?? ''; ?>">
    <script src="assets/js/GridComponent.js"></script>
    ```

---

## 3. Database Setup (Demo)

Run this SQL to create the tables required for the examples below. This demonstrates text, numeric, date, checkboxes, and lookup relationships.

```sql
-- 1. Master Table (Invoices)
CREATE TABLE `demo_invoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `invoice_no` varchar(50) NOT NULL,
  `customer_name` varchar(100) NOT NULL,
  `invoice_date` date DEFAULT NULL,
  `total_amount` decimal(10,2) DEFAULT 0.00,
  `is_paid` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`)
);

-- 2. Detail Table (Invoice Items)
CREATE TABLE `demo_invoice_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `invoice_id` int(11) NOT NULL, -- Foreign Key
  `product_name` varchar(100) NOT NULL,
  `qty` int(11) DEFAULT 1,
  `price` decimal(10,2) DEFAULT 0.00,
  PRIMARY KEY (`id`)
);

-- 3. Lookup Data
INSERT INTO `demo_invoices` (`invoice_no`, `customer_name`, `invoice_date`, `total_amount`, `is_paid`) VALUES 
('INV-1001', 'Acme Corp', '2023-10-01', 1500.00, 1),
('INV-1002', 'Global Tech', '2023-10-05', 250.50, 0);
