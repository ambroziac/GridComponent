<?php

header('Content-Type: application/json');

// 1. Load Configuration from External File
$configFile = __DIR__ . '/grid_def.php';
if (!file_exists($configFile)) {
    die(json_encode(['success' => false, 'message' => 'Configuration file grid_def.php not found']));
}
$config_def = require $configFile;
$modules = $config_def['modules'] ?? [];
$lookups = $config_def['lookups'] ?? [];

// 2. Input Handling
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$request = array_merge($_GET, $_POST, $input);
$action = $request['action'] ?? '';

$conn = new mysqli($dbhost, $dbuser, $dbpassword, $database);
if ($conn->connect_error) {
    die(json_encode(['success' => false, 'message' => 'DB Connection Failed']));
}

// --- ACTION HANDLERS ---

// --- GET CONFIGURATION ---
if ($action === 'get_config') {
    $moduleKey = $request['module'] ?? '';

    if (isset($modules[$moduleKey])) {
        $config = $modules[$moduleKey];

        // ---> CRITICAL FIX: Inject the module name into the config object <---
        // This ensures GridComponent.js always knows which module it is handling
        $config['module'] = $moduleKey;

        echo json_encode(['success' => true, 'config' => $config]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Module not found']);
    }
    exit;
}

if ($action === 'get_all_options') {
    $sourcesStr = $request['sources'] ?? '';
    $sources = explode(',', $sourcesStr);
    $response = [];

    foreach ($sources as $source) {
        $source = trim($source);
        if (!empty($source)) {
            $response[$source] = fetchOptionsFromDb($conn, $source, $lookups);
        }
    }
    echo json_encode($response);
    exit;
}

// --- LIST / GET DATA ---
if ($action === 'list') {
    $moduleKey = $request['module'] ?? '';
    $table = $request['table'] ?? '';
    $sort = $request['sort'] ?? '';
    $dir = $request['dir'] ?? 'ASC';
    $filters = $request['filters'] ?? [];
    $pk = $request['primaryKey'] ?? 'id';

    // Check if we are exporting (ignore pagination if true)
    $isExport = isset($request['export']) && $request['export'] === true;

    $page = isset($request['page']) ? (int) $request['page'] : null;
    $limit = isset($request['limit']) ? (int) $request['limit'] : null;

    if ($isExport) {
        $page = null;
        $limit = null;
    }

    if (!isset($modules[$moduleKey])) {
        die(json_encode(['success' => false, 'message' => 'Invalid Module']));
    }

    $config = $modules[$moduleKey];
    $validFields = array_column($config['fields'], 'name');

    // Build Dynamic WHERE Clause
    $whereClauses = [];

    foreach ($filters as $col => $val) {
        // Security check: Ensure column exists in config
        if (!in_array($col, $validFields))
            continue;

        $safeCol = "`" . $conn->real_escape_string($col) . "`";

        // 1. HANDLE DATE PERIODS (Object with start/end)
        if (is_array($val) && (isset($val['start']) || isset($val['end']))) {
            if (!empty($val['start'])) {
                $start = $conn->real_escape_string($val['start']);
                $whereClauses[] = "$safeCol >= '$start'";
            }
            if (!empty($val['end'])) {
                $end = $conn->real_escape_string($val['end']);
                // If it's a standard short date (YYYY-MM-DD), include the whole day
                if (strlen($end) === 10) {
                    $end .= " 23:59:59";
                }
                $whereClauses[] = "$safeCol <= '$end'";
            }
        }
        // 2. HANDLE MULTI-SELECT (Array of values)
        else if (is_array($val)) {
            if (count($val) > 0) {
                // Escape each value and join for IN clause
                $escapedVals = array_map([$conn, 'real_escape_string'], $val);
                $inList = "'" . implode("', '", $escapedVals) . "'";
                $whereClauses[] = "$safeCol IN ($inList)";
            }
        }
        // 3. HANDLE STANDARD SINGLE VALUES
        else {
            $safeVal = $conn->real_escape_string($val);

            // Find field definition to determine best SQL operator
            $fieldDef = array_filter($config['fields'], fn($f) => $f['name'] === $col);
            $fieldDef = reset($fieldDef);

            // Use Exact Match for strict types, and LIKE for open text/textarea
            if ($fieldDef && in_array($fieldDef['type'], ['hidden', 'hidden-numeric', 'numeric', 'select', 'checkbox', 'date', 'datetime'])) {
                $whereClauses[] = "$safeCol = '$safeVal'";
            } else {
                $whereClauses[] = "$safeCol LIKE '%$safeVal%'";
            }
        }
    }

    $whereSQL = count($whereClauses) > 0 ? "WHERE " . implode(' AND ', $whereClauses) : "";

    // Build ORDER BY Clause
    $orderSQL = "";
    if ($sort && in_array($sort, $validFields)) {
        $safeSort = "`" . $conn->real_escape_string($sort) . "`";
        $safeDir = strtoupper($dir) === 'DESC' ? 'DESC' : 'ASC';
        $orderSQL = "ORDER BY $safeSort $safeDir";
    }

    // Execute Query (Paginated vs Non-Paginated)
    if ($page && $limit && !$isExport) {
        // Get Total Record Count
        $countSql = "SELECT COUNT(*) as total FROM `" . $conn->real_escape_string($table) . "` $whereSQL";
        $countRes = $conn->query($countSql);
        $totalRows = $countRes ? $countRes->fetch_assoc()['total'] : 0;

        // Apply Limits
        $offset = ($page - 1) * $limit;
        $limitSQL = "LIMIT " . (int) $limit . " OFFSET " . (int) $offset;

        $sql = "SELECT * FROM `" . $conn->real_escape_string($table) . "` $whereSQL $orderSQL $limitSQL";
        $res = $conn->query($sql);

        $data = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $data[] = $row;
            }
        }

        echo json_encode([
            'pagination' => true,
            'data' => $data,
            'total' => $totalRows
        ]);
    } else {
        // No Pagination (or Exporting)
        $sql = "SELECT * FROM `" . $conn->real_escape_string($table) . "` $whereSQL $orderSQL";
        $res = $conn->query($sql);

        $data = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $data[] = $row;
            }
        }

        // Return flat array for Export or Standard list
        echo json_encode($data);
    }
    exit;
}

if ($action === 'delete') {
    $moduleKey = $request['module'] ?? '';
    $config = $modules[$moduleKey] ?? null;

    // Determine Primary Key (Default: 'id')
    $pk = $config['primaryKey'] ?? 'id';
    $safePk = $conn->real_escape_string($pk);

    $rawTable = ($config && isset($config['editTableName'])) ? $config['editTableName'] : $request['table'];
    $table = $conn->real_escape_string($rawTable);

    // We treat the ID value as a string/int safely
    $idVal = $conn->real_escape_string($request['id']);

    // Use dynamic PK in WHERE clause
    if ($conn->query("UPDATE $table SET del=1 WHERE `$safePk` = '$idVal'")) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $conn->error]);
    }
    exit;
}

// --- SAVE (INSERT/UPDATE) ---
if ($action === 'save') {
    $moduleKey = $request['module'] ?? '';
    $table = $request['table'] ?? '';
    $id = $request['id'] ?? '';
    $data = $request['data'] ?? [];
    $pk = $request['primaryKey'] ?? 'id';

    if (!isset($modules[$moduleKey]))
        die(json_encode(['success' => false, 'message' => 'Invalid Module']));

    $config = $modules[$moduleKey];
    $fieldsConfig = $config['fields'] ?? [];

    // --- NEW: BACKEND VALIDATION ---
    foreach ($fieldsConfig as $f) {
        $fName = $f['name'];
        $fCaption = $f['caption'] ?? $fName;
        $isMandatory = isset($f['mandatory']) && $f['mandatory'] === true;
        $isNumeric = isset($f['type']) && $f['type'] === 'numeric';

        // If the field was submitted in the request
        if (array_key_exists($fName, $data)) {
            $val = trim((string) $data[$fName]);

            // 1. Mandatory Check
            if ($isMandatory && $val === '') {
                die(json_encode(['success' => false, 'message' => "Câmpul '{$fCaption}' este obligatoriu!"]));
            }
            // 2. Numeric Check (only if not empty)
            if ($isNumeric && $val !== '' && !is_numeric($val)) {
                die(json_encode(['success' => false, 'message' => "Câmpul '{$fCaption}' trebuie să fie un număr valid!"]));
            }
        } else {
            // If inserting a new record, missing a mandatory field entirely is an error
            if ($isMandatory && empty($id)) {
                die(json_encode(['success' => false, 'message' => "Câmpul '{$fCaption}' este obligatoriu!"]));
            }
        }
    }
    // -------------------------------

    $set = [];
    foreach ($data as $k => $v) {
        $set[] = "`" . $conn->real_escape_string($k) . "` = '" . $conn->real_escape_string($v) . "'";
    }

    if ($id) {
        $sql = "UPDATE `" . $conn->real_escape_string($table) . "` SET " . implode(', ', $set) . " WHERE `$pk` = '" . $conn->real_escape_string($id) . "'";
    } else {
        $cols = array_keys($data);
        $vals = array_values($data);
        $colsStr = implode('`, `', array_map([$conn, 'real_escape_string'], $cols));
        $valsStr = implode("', '", array_map([$conn, 'real_escape_string'], $vals));
        $sql = "INSERT INTO `" . $conn->real_escape_string($table) . "` (`$colsStr`) VALUES ('$valsStr')";
    }

    if ($conn->query($sql)) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $conn->error]);
    }
    exit;
}

// --- IMPORT: STAGE 1 (CHECK) ---
if ($action === 'check_import') {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        die(json_encode(['success' => false, 'message' => 'Upload failed']));
    }

    $moduleKey = $_POST['module'] ?? '';
    if (!isset($modules[$moduleKey]))
        die(json_encode(['success' => false, 'message' => 'Invalid Module']));

    $config = $modules[$moduleKey];
    $pk = $config['primaryKey'] ?? 'id';

    // Get valid field names from config
    $validFields = array_column($config['fields'], 'name');

    $tempPath = sys_get_temp_dir() . '/import_' . uniqid() . '.csv';
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $tempPath)) {
        die(json_encode(['success' => false, 'message' => 'Could not save temp file']));
    }

    $handle = fopen($tempPath, 'r');
    $headers = fgetcsv($handle);

    if (!$headers) {
        unlink($tempPath);
        die(json_encode(['success' => false, 'message' => 'Empty CSV']));
    }

    // --- FIX: REMOVE BOM (Byte Order Mark) FROM FIRST HEADER ---
    // This fixes the issue where "id" is read as "ï»¿id"
    if (isset($headers[0])) {
        $bom = pack('H*', 'EFBBBF');
        $headers[0] = preg_replace("/^$bom/", '', $headers[0]);
    }
    // -----------------------------------------------------------

    // Map CSV headers to valid fields
    $map = [];
    foreach ($headers as $i => $h) {
        $h = trim($h); // Remove whitespace
        // Case-insensitive check
        foreach ($validFields as $vf) {
            if (strcasecmp($h, $vf) === 0) {
                $map[$i] = $vf; // Store the correct config field name
                break;
            }
        }
    }

    if (empty($map)) {
        unlink($tempPath);
        die(json_encode(['success' => false, 'message' => 'No matching columns found. Check CSV headers.']));
    }

    $stats = ['adds' => 0, 'updates' => 0];
    $pkIndex = array_search($pk, $map);
    // $debugString = $pk . '> ' . implode(", ", $headers);/
    while (($row = fgetcsv($handle)) !== false) {
        // Extract ID. If pkIndex found, get value, otherwise empty.
        // $debugString .= $pkIndex . ' ';
        $idVal = ($pkIndex !== false && isset($row[$pkIndex])) ? trim($row[$pkIndex]) : '';

        // UPDATE if ID exists and is NOT '0'

        if ($idVal !== '' && $idVal != '0') {
            $stats['updates']++;
        } else {
            $stats['adds']++;
        }
    }
    fclose($handle);

    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'tempFile' => basename($tempPath)
    ]);
    exit;
}

// --- IMPORT: STAGE 2 (EXECUTE) ---
if ($action === 'execute_import') {
    $tempFile = $request['tempFile'] ?? '';
    $moduleKey = $request['module'] ?? '';
    $tempPath = sys_get_temp_dir() . '/' . basename($tempFile);

    if (!file_exists($tempPath))
        die(json_encode(['success' => false, 'message' => 'File expired. Please upload again.']));

    $config = $modules[$moduleKey];
    $table = $conn->real_escape_string($config['tableName']);
    $pk = $config['primaryKey'] ?? 'id';
    $validFields = array_column($config['fields'], 'name');

    $handle = fopen($tempPath, 'r');
    $headers = fgetcsv($handle);

    // --- FIX: REMOVE BOM ---
    if (isset($headers[0])) {
        $bom = pack('H*', 'EFBBBF');
        $headers[0] = preg_replace("/^$bom/", '', $headers[0]);
    }

    // Remap headers
    $map = [];
    foreach ($headers as $i => $h) {
        $h = trim($h);
        foreach ($validFields as $vf) {
            if (strcasecmp($h, $vf) === 0) {
                $map[$i] = $vf;
                break;
            }
        }
    }

    $successCount = 0;

    while (($row = fgetcsv($handle)) !== false) {
        $data = [];
        $idVal = null;

        foreach ($map as $index => $field) {
            $val = isset($row[$index]) ? trim($row[$index]) : '';

            if ($field === $pk) {
                // Determine if this is an ID for update
                if ($val !== '' && $val != '0') {
                    $idVal = $val;
                }
            } else {
                $data[$field] = $val;
            }
        }

        if (empty($data))
            continue;

        if ($idVal) {
            // --- UPDATE ---
            $set = [];
            foreach ($data as $col => $val) {
                $set[] = "`$col` = '" . $conn->real_escape_string($val) . "'";
            }
            $sql = "UPDATE $table SET " . implode(', ', $set) . " WHERE `$pk` = '" . $conn->real_escape_string($idVal) . "'";
        } else {
            // --- INSERT ---
            $cols = implode('`, `', array_keys($data));
            $vals = implode("', '", array_map([$conn, 'real_escape_string'], array_values($data)));
            $sql = "INSERT INTO $table (`$cols`) VALUES ('$vals')";
        }

        if ($conn->query($sql))
            $successCount++;
    }

    fclose($handle);
    unlink($tempPath);

    echo json_encode(['success' => true, 'count' => $successCount]);
    exit;
}
/**
 * Helper function to fetch dropdown options based on the map in grid_def.php
 */
function fetchOptionsFromDb($conn, $source, $map)
{
    if (!isset($map[$source]))
        return [];

    $tbl = $map[$source];
    $tableName = $tbl[0];
    $idCol = $tbl[1];
    $valCol = $tbl[2];
    $extraWhere = isset($tbl[3]) ? "AND {$tbl[3]}" : "";

    $sql = "SELECT $idCol as id, $valCol as val 
            FROM $tableName 
            WHERE del = 0 $extraWhere 
            ORDER BY $valCol ASC";

    $res = $conn->query($sql);
    return $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
}
?>
