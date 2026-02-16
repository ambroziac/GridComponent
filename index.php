<?php
// Start session to generate CSRF token
session_start();

// Generate a token if one doesn't exist
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GridComponent Master-Detail Demo</title>

    <link rel="stylesheet" href="assets/css/style.css">

    <meta name="csrf-token" content="<?php echo $_SESSION['csrf_token']; ?>">

    <script src="assets/js/GridComponent.js"></script>

    <style>
        body { padding: 20px; font-family: sans-serif; background: #f4f6f8; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 8px; }
        h1 { margin-top: 0; color: #2c3e50; }
        h3 { margin-top: 20px; color: #34495e; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    </style>
</head>
<body>

<div class="container">
    <h1>Invoice Management System</h1>
    
    <div id="div_invoices_grid" style="min-height: 350px;"></div>

    <h3>Invoice Items</h3>
    <div id="div_items_grid" style="min-height: 300px;"></div>
</div>

<script>
    document.addEventListener('DOMContentLoaded', async () => {

        // --- 1. CONFIGURE MASTER GRID (Invoices) ---
        const invoiceConfig = {
            instanceName: 'gridInvoices',
            containerId:  'div_invoices_grid',
            module:       'invoices', // Must match key in grid_def.php
            gridHeight:   '350px',
            primaryKey:   'id',
            
            // Options
            allowAdd:    true,
            allowEdit:   true,
            allowDelete: true,
            export:      true,
            
            // Translations (Optional Override)
            translations: {
                emptyState: "No invoices found."
            },

            // EVENT: When user clicks an Invoice row
            onRowSelect: (id, rowData) => {
                console.log("Invoice Selected:", id, rowData);
                loadInvoiceItems(id);
            }
        };

        // --- 2. CONFIGURE DETAIL GRID (Items) ---
        const itemsConfig = {
            instanceName: 'gridItems',
            containerId:  'div_items_grid',
            module:       'invoice_items', // Must match key in grid_def.php
            gridHeight:   '300px',
            primaryKey:   'id',

            // Don't load data until a parent is selected
            autoLoad:     false, 
            
            // Disable Import for detail grid
            import:       false, 
            
            translations: {
                emptyState: "Select an invoice above to view items.",
                btnAdd:     "Add Item"
            }
        };

        // --- 3. INSTANTIATE & INITIALIZE ---
        window.gridInvoices = new GridComponent(invoiceConfig);
        window.gridItems    = new GridComponent(itemsConfig);

        await window.gridInvoices.init();
        await window.gridItems.init();

        // --- 4. LINKING LOGIC ---
        function loadInvoiceItems(invoiceId) {
            // A. Filter the Items grid by the Invoice ID foreign key
            window.gridItems.setFilter('invoice_id', invoiceId);

            // B. Set the default value for new items
            // This ensures when you click "Add Item", it knows which Invoice it belongs to
            const foreignKeyField = window.gridItems.config.fields.find(f => f.name === 'invoice_id');
            if (foreignKeyField) {
                foreignKeyField.defaultValue = invoiceId;
            }

            // C. Refresh the detail grid
            window.gridItems.loadData();
        }

    });
</script>

</body>
</html>
