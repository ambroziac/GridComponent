// grid_def.php

// MASTER MODULE
$modules['invoices'] = [
    'tableName' => 'demo_invoices',
    'primaryKey' => 'id',
    'fields' => [
        ['name' => 'id', 'type' => 'hidden', 'grid' => true],
        ['name' => 'invoice_no', 'caption' => 'Invoice #', 'type' => 'text', 'grid' => true, 'filter' => true, 'mandatory' => true],
        ['name' => 'customer_name', 'caption' => 'Customer', 'type' => 'text', 'grid' => true, 'filter' => true],
        ['name' => 'invoice_date', 'caption' => 'Date', 'type' => 'date', 'grid' => true, 'filter' => true], // Auto Date-Range
        ['name' => 'is_paid', 'caption' => 'Paid?', 'type' => 'checkbox', 'grid' => true, 'filter' => true]   // Auto 3-State Filter
    ]
];

// DETAIL MODULE
$modules['invoice_items'] = [
    'tableName' => 'demo_invoice_items',
    'primaryKey' => 'id',
    'fields' => [
        ['name' => 'id', 'type' => 'hidden', 'grid' => true],
        
        // Foreign Key (Hidden in Grid, used for linking)
        ['name' => 'invoice_id', 'type' => 'hidden-numeric', 'grid' => false, 'filter' => true],
        
        ['name' => 'product_name', 'caption' => 'Product', 'type' => 'text', 'grid' => true, 'editable' => true],
        ['name' => 'qty', 'caption' => 'Qty', 'type' => 'numeric', 'grid' => true, 'editable' => true],
        ['name' => 'price', 'caption' => 'Price', 'type' => 'numeric', 'grid' => true, 'editable' => true]
    ]
];
