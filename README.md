

# GridComponent Documentation

A Reusable, Meta-Data Driven CRUD System for Vanilla JS & PHP

*   [1\. Installation](#installation)
*   [2\. Database Setup](#database)
*   [3\. Backend Config](#backend)
*   [4\. Frontend Usage](#frontend)
*   [5\. Master-Detail](#master-detail)
*   [6\. Managing Options](#options)
*   [7\. Reference](#reference)

## 1\. Overview

**GridComponent.js** is a modular vanilla JavaScript system designed to render dynamic data grids based entirely on JSON configuration. It abstracts the complexity of CRUD operations, communicating seamlessly with a PHP backend.

\[Image of web application architecture diagram\]

### Key Features

*   **Dynamic Rendering:** Builds tables and forms automatically based on meta-data.
*   **Advanced Filtering:** Includes Date Range grouping, Multi-Select dropdowns with search, and 3-State Checkboxes.
*   **Internationalization (I18n):** Built-in multi-language support.
*   **Export/Import:** Native CSV export and bulk import capabilities.
*   **Modals:** Integrated Add, Edit, and Delete popups.

## 1\. Installation

### Step A: File Structure

Place the files in your project directory (suggested structure):

```
/project-root
├── assets/
│   ├── css/
│   │   └── style.css          <-- Add the Grid CSS here
│   └── js/
│       └── GridComponent.js   <-- The main JS class
├── modules/
│   └── x_grid/
│       ├── grid_handler.php   <-- Handles AJAX requests
│       └── grid_def.php       <-- Module definitions
└── index.php
```

### Step B: Include Assets

Add the following to your HTML/PHP header:

```html
<!-- Grid Styles -->
<link rel="stylesheet" href="assets/css/style.css">

<!-- Security Token (Required) -->
<meta name="csrf-token" content="<?php echo $_SESSION['csrf_token'] ?? ''; ?>">

<!-- Grid Logic -->
<script src="assets/js/GridComponent.js"></script>
```

## 2\. Database Setup (Demo)

To demonstrate all field types (Text, Numeric, Date, Lookups, Checkboxes), use the following SQL schema.

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
```

## 3\. Backend Configuration

Define the module structure in your `grid_def.php` file. This maps database columns to Grid fields.

```php
<?php
// grid_def.php

// 1. MASTER MODULE: INVOICES
$modules['invoices'] = [
    'tableName' => 'demo_invoices',
    'primaryKey' => 'id',
    'fields' => [
        // Hidden ID Field
        ['name' => 'id', 'type' => 'hidden', 'grid' => true],
        
        // Text Input (Mandatory, Sortable, Filterable)
        ['name' => 'invoice_no', 'caption' => 'Invoice #', 'type' => 'text', 'grid' => true, 'filter' => true, 'mandatory' => true],
        
        // Text Input
        ['name' => 'customer_name', 'caption' => 'Customer', 'type' => 'text', 'grid' => true, 'filter' => true],
        
        // Date Input (Automatically creates Date Range filter)
        ['name' => 'invoice_date', 'caption' => 'Date', 'type' => 'date', 'grid' => true, 'filter' => true],
        
        // Checkbox (Automatically creates All/Yes/No filter)
        ['name' => 'is_paid', 'caption' => 'Paid?', 'type' => 'checkbox', 'grid' => true, 'filter' => true]
    ]
];

// 2. DETAIL MODULE: INVOICE ITEMS
$modules['invoice_items'] = [
    'tableName' => 'demo_invoice_items',
    'primaryKey' => 'id',
    'fields' => [
        ['name' => 'id', 'type' => 'hidden', 'grid' => true],
        
        // Foreign Key Linking (Hidden in Grid)
        ['name' => 'invoice_id', 'type' => 'hidden-numeric', 'grid' => false, 'filter' => true],
        
        ['name' => 'product_name', 'caption' => 'Product', 'type' => 'text', 'grid' => true, 'editable' => true],
        ['name' => 'qty', 'caption' => 'Qty', 'type' => 'numeric', 'grid' => true, 'editable' => true],
        ['name' => 'price', 'caption' => 'Price', 'type' => 'numeric', 'grid' => true, 'editable' => true]
    ]
];
?>
```

## 4\. Frontend Implementation

### Basic Usage

Initialize a simple grid inside a specific div.

```html
<div id="div_grid_view" style="height: 500px;"></div>

<script>
    document.addEventListener('DOMContentLoaded', async () => {
        const config = {
            instanceName: 'mainGrid',     // Unique JS variable name
            containerId:  'div_grid_view',// Target HTML Div ID
            module:       'invoices',     // Must match key in grid_def.php
            gridHeight:   '450px'
        };

        const grid = new GridComponent(config);
        await grid.init();
    });
</script>
```

## 5\. Master-Detail Implementation

Link two grids so clicking a row in "Header" loads data in "Lines".

```html
<div id="div_header" style="height: 300px; border-bottom: 1px solid #ccc;"></div>
<h3>Invoice Lines</h3>
<div id="div_lines" style="height: 300px;"></div>

<script>
    document.addEventListener('DOMContentLoaded', async () => {

        // --- 1. CONFIG MASTER (Invoices) ---
        const configHeader = {
            instanceName: 'gridHeader',
            containerId:  'div_header',
            module:       'invoices',
            
            // EVENT: Link Logic
            onRowSelect: (id, rowData) => {
                console.log("Invoice Selected:", id);
                loadDetailGrid(id);
            }
        };

        // --- 2. CONFIG DETAIL (Items) ---
        const configLines = {
            instanceName: 'gridLines',
            containerId:  'div_lines',
            module:       'invoice_items',
            autoLoad:     false // Important: Start empty
        };

        // Instantiate
        window.gridHeader = new GridComponent(configHeader);
        window.gridLines  = new GridComponent(configLines);

        await window.gridHeader.init();
        await window.gridLines.init();

        // --- 3. LINKING FUNCTION ---
        function loadDetailGrid(parentId) {
            // A. Filter detail grid by Foreign Key
            window.gridLines.setFilter('invoice_id', parentId);

            // B. Set default value for "Add New" button in detail grid
            const linkField = window.gridLines.config.fields.find(f => f.name === 'invoice_id');
            if (linkField) {
                linkField.defaultValue = parentId;
            }

            // C. Load Data
            window.gridLines.loadData();
        }
    });
</script>
```

## 6\. Managing Options & Features

You can control buttons, text, and behavior via the config object in JavaScript.

### A. Controlling Buttons

Disable specific CRUD actions.

```javascript
const config = {
    // ...
    allowAdd:    false, // Hides "Add" button
    allowEdit:   false, // Hides "Edit" button (and disables double-click)
    allowDelete: true,  // Shows "Delete" button
    export:      true,  // Shows Export CSV
    import:      false  // Hides Import CSV
};
```

### B. Multi-Language Support (I18n)

Pass a `translations` object to override default text.

```javascript
const config = {
    // ...
    translations: {
        btnAdd:       "New Record",
        btnEdit:      "Modify",
        btnDelete:    "Remove",
        emptyState:   "Please select a record above.",
        deleteMsg:    "Are you sure you want to delete this item?",
        all:          "-- All Records --"
    }
};
```

### C. Custom Buttons

Add your own action buttons to the toolbar.

```javascript
const config = {
    // ...
    customButtons: [
        {
            caption: "Print",
            icon:    "fas fa-print", // FontAwesome class
            class:   "btn-secondary",
            onClick: (id, rowData) => {
                if(!id) return alert("Select a row first!");
                window.open('print.php?id=' + id);
            }
        }
    ]
};
```

## 7\. Configuration Reference

### General Options (JavaScript)

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| module | String | Required | The key defined in PHP $modules. |
| containerId | String | Required | ID of the HTML div to render into. |
| handlerUrl | String | .../grid_handler.php | Path to the backend handler. |
| gridHeight | String | '400px' | CSS height of the scrollable area. |
| autoLoad | Boolean | true | If false, grid starts empty until .loadData() is called. |

### Field Options (in `grid_def.php`)

| Option | Description |
| --- | --- |
| type | text, numeric, date, datetime, checkbox, select, textarea, hidden. |
| mandatory | true/false. Adds * and blocks save if empty. |
| filter | true/false. Shows input in the filter bar. |
| multipleFilter | true (Only for type select). Turns filter into a Multi-Select Dropdown. |
| source | Name of the data source for Selects (e.g., table name). |
| grid | true/false. Visible in the table columns. |
| editable | false makes it Read-Only in the Edit Modal. |

### API Methods

*   `grid.loadData()`: Refreshes the grid data.
*   `grid.setFilter(col, val)`: Sets a filter value programmatically.
*   `grid.openModal(id)`: Opens the Add (no ID) or Edit (with ID) modal.
*   `grid.exportData()`: Triggers CSV export.
