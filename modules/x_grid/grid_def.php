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
