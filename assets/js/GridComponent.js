/**
 * GridComponent.js 
 * Modularized Architecture (Service + Renderer + Controller)
 * * STRUCTURE:
 * 1. GridService:  Handles API, Fetch, Save, Delete, Import/Export.
 * 2. GridRenderer: Handles HTML generation (Layout, Fields, Modals).
 * 3. GridComponent: Main Controller, State Management, Event Listeners.
 */

// =================================================================================
// 1. GRID SERVICE (The Backend Connector)
// =================================================================================
class GridService {
    constructor(controller) {
        this.ctrl = controller; // Reference to main controller
    }

    getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }

    async fetch(payload) {
        try {
            const res = await fetch(this.ctrl.handlerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.getCsrfToken() },
                body: JSON.stringify({
                    module: this.ctrl.config.module,
                    table: this.ctrl.config.tableName,
                    primaryKey: this.ctrl.primaryKey,
                    ...payload
                })
            });
            return await res.json();
        } catch (e) {
            console.error("Grid API Error:", e);
            this.ctrl.showAlert(this.ctrl.txt.error);
            return null;
        }
    }

    async loadOptions() {
        const sources = this.ctrl.config.fields
            .filter(f => (f.type === 'select' || f.type === 'autocomplete') && !f.options)
            .map(f => f.source);

        if (sources.length === 0) return {};

        try {
            const url = `${this.ctrl.handlerUrl}?action=get_all_options&sources=${sources.join(',')}`;
            const res = await fetch(url, { headers: { 'X-CSRF-Token': this.getCsrfToken() } });
            return await res.json();
        } catch (e) {
            console.error("Options Load Error:", e);
            return {};
        }
    }

    async getListData(filters) {
        const payload = {
            action: 'list',
            sort: this.ctrl.currentSort,
            dir: this.ctrl.currentDir,
            filters: filters
        };
        if (this.ctrl.isPaginationEnabled) {
            payload.page = this.ctrl.currentPage;
            payload.limit = this.ctrl.pageSize;
        }
        return await this.fetch(payload);
    }

    async saveRecord(formData, id) {
        const targetTable = this.ctrl.config.editTableName || this.ctrl.config.tableName;
        return await this.fetch({
            action: 'save',
            table: targetTable,
            id: id,
            data: formData
        });
    }

    async deleteRecord(id) {
        return await this.fetch({ action: 'delete', id: id });
    }

    // --- IO (Import/Export) ---
    async exportCSV(filters) {
        const payload = {
            action: 'list',
            sort: this.ctrl.currentSort,
            dir: this.ctrl.currentDir,
            filters: filters,
            export: true
        };
        try {
            const res = await fetch(this.ctrl.handlerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.getCsrfToken() },
                body: JSON.stringify({
                    module: this.ctrl.config.module,
                    table: this.ctrl.config.tableName,
                    primaryKey: this.ctrl.primaryKey,
                    ...payload
                })
            });
            return await res.text(); // Return raw text for parsing
        } catch (e) {
            console.error("Export Error:", e);
            return null;
        }
    }

    async uploadImportFile(file) {
        const form = new FormData();
        form.append('action', 'check_import');
        form.append('module', this.ctrl.config.module);
        form.append('file', file);

        try {
            const res = await fetch(this.ctrl.handlerUrl, {
                method: 'POST',
                body: form,
                headers: { 'X-CSRF-Token': this.getCsrfToken() }
            });
            return await res.json();
        } catch (e) { return { success: false, message: e }; }
    }

    async executeImport(tempFile) {
        return await this.fetch({
            action: 'execute_import',
            tempFile: tempFile
        });
    }
}

// =================================================================================
// 2. GRID RENDERER (The View)
// =================================================================================
class GridRenderer {
    constructor(controller) {
        this.ctrl = controller;
    }

    getValueCaption(field, value) {
        if (value === null || value === undefined || value === '') return '';

        if (field.type === 'date' || field.type === 'datetime') {
            try { return new Date(value).toLocaleDateString('ro-RO'); } catch (e) { return value; }
        }
        if (field.type === 'checkbox') {
            return value == 1 ? '<i class="fas fa-check-circle" style="color:#27ae60;"></i>' : '<i class="fas fa-times-circle" style="color:#ccc;opacity:0.5;"></i>';
        }
        if (field.options && field.options[value]) return field.options[value];
        if (field.source && this.ctrl.options[field.source]) {
            const found = this.ctrl.options[field.source].find(obj => obj.id == value);
            if (found) return found.val || found.name || found.dsc || found.moneda || value;
        }
        return value;
    }

    renderLayout() {
        const c = this.ctrl;
        const scope = `window['${c.instanceName}']`;
        const txt = c.txt;

        // Button Visibility
        const addBtn = c.allowAdd ? `<button class="btn-primary" type="button" onclick="${scope}.openModal()"><i class="fas fa-plus"></i> ${txt.btnAdd}</button>` : '';
        const editBtn = c.allowEdit ? `<button class="btn-primary" type="button" onclick="${scope}.editSelected()"><i class="fas fa-edit"></i> ${txt.btnEdit}</button>` : '';
        const delBtn = c.allowDelete ? `<button class="btn-primary" type="button" onclick="${scope}.deleteSelected()"><i class="fas fa-trash-alt"></i> ${txt.btnDelete}</button>` : '';
        const expBtn = c.allowExport ? `<button class="btn-primary" onclick="${scope}.exportData()"><i class="fas fa-file-csv"></i> ${txt.btnExport}</button>` : '';
        const impBtn = c.allowImport ? `<button class="btn-primary" onclick="${scope}.triggerImport()"><i class="fas fa-file-upload"></i> ${txt.btnImport}</button>` : '';

        const customBtns = (c.config.customButtons || []).map((btn, i) =>
            `<button class="${btn.class || 'btn-primary'}" type="button" onclick="${scope}.handleCustomButton(${i})">${btn.icon ? `<i class="${btn.icon}"></i> ` : ''}${btn.caption}</button>`
        ).join('');

        document.getElementById(c.containerId).innerHTML = `
            <div id="ux-grid-container-${c.instanceName}" class="ux-grid-instance">
                <input type="file" id="file-import-${c.instanceName}" style="display:none" accept=".csv" onchange="${scope}.handleFileSelect(this)">
                
                <div class="ux-filter-zone card">
                    <div class="ux-filter-wrapper">
                        ${c.config.fields.filter(f => f.filter).map(f => this.renderField(f, 'filter')).join('')}
                        <button class="btn-primary ux-filter-btn" type="button" onclick="${scope}.loadData(null, true)"><i class="fas fa-search"></i> ${txt.btnFilter}</button>
                    </div>
                </div>

                <div class="ux-action-bar">
                    ${addBtn} ${editBtn} ${delBtn} ${customBtns}
                    <div class="ux-action-right">${impBtn} ${expBtn}</div>
                </div>

                <div class="grid-scroll-container ux-scroll-container" style="height: ${c.config.gridHeight || '400px'};">
                    <table class="log-table" id="table-${c.instanceName}">
                        <thead><tr>${this.getHeadersHTML()}</tr></thead>
                        <tbody id="grid-body-${c.instanceName}"></tbody>
                    </table>
                </div>

                ${this.getPaginationHTML()}
                ${this.getModalsHTML(scope, txt)}
            </div>
        `;
    }

    renderField(field, context) {
        const idPrefix = context === 'filter' ? `f_${this.ctrl.instanceName}_` : `e_${this.ctrl.instanceName}_`;
        const isFilter = context === 'filter';
        const isReadonly = (!isFilter && field.editable === false) ? 'disabled' : '';
        const reqMark = (!isFilter && field.mandatory) ? '<span style="color:#d63031;">*</span>' : '';
        const scope = `window['${this.ctrl.instanceName}']`;

        // Style Classes (from CSS)
        const labelClass = isFilter ? 'ux-filter-label' : 'ux-label';
        const inputClass = isFilter ? 'ux-filter-input' : 'ux-input';
        const containerClass = isFilter ? 'ux-filter-group' : 'ux-form-group';
        const label = `<label class="${labelClass}">${field.caption}${reqMark}</label>`;

        // Hidden
        if (field.type === 'hidden' || field.type === 'hidden-numeric') return `<input type="hidden" id="${idPrefix}${field.name}">`;

        // Date/Datetime
        if (field.type === 'date' || field.type === 'datetime') {
            const type = field.type === 'datetime' ? 'datetime-local' : 'date';
            if (isFilter) {
                return `<div class="form-group date-range-container">${label}
                    <div class="date-range-group">
                        <input type="${type}" id="${idPrefix}${field.name}_start" title="${this.ctrl.txt.dateFrom}">
                        <div class="date-range-separator"><i class="fas fa-arrow-right"></i></div>
                        <input type="${type}" id="${idPrefix}${field.name}_end" title="${this.ctrl.txt.dateTo}">
                    </div></div>`;
            }
            return `<div class="${containerClass}">${label}<input type="${type}" id="${idPrefix}${field.name}" ${isReadonly} class="form-control ${inputClass}"></div>`;
        }

        // Textarea
        if (field.type === 'textarea' && !isFilter) {
            return `<div class="${containerClass} full-width">${label}<textarea id="${idPrefix}${field.name}" ${isReadonly} class="form-control"></textarea></div>`;
        }

        // Checkbox
        if (field.type === 'checkbox') {
            if (isFilter) { // 3-State Filter
                return `<div class="${containerClass}">${label}
                    <select id="${idPrefix}${field.name}" class="form-control ${inputClass}">
                        <option value="">${this.ctrl.txt.all}</option>
                        <option value="1">${this.ctrl.txt.yes}</option>
                        <option value="0">${this.ctrl.txt.no}</option>
                    </select></div>`;
            }
            return `<div class="form-group ux-checkbox-group">
                <label for="${idPrefix}${field.name}" style="margin:0; cursor:pointer; font-size:0.85rem;">${field.caption}</label>    
                <input type="checkbox" id="${idPrefix}${field.name}" value="1" class="ux-checkbox-input">
            </div>`;
        }

        // Select / Autocomplete
        if (field.type === 'select') {
            // Multi-Select Filter with Search
            if (isFilter && field.multipleFilter) {
                let opts = field.options ? Object.entries(field.options).map(([k, v]) => ({ id: k, val: v }))
                    : (this.ctrl.options[field.source] || []).map(o => ({ id: o.id, val: o.val || o.name || o.dsc || o.moneda }));

                let rows = `<div class="ms-row ms-header-row"><label>
                    <input type="checkbox" class="ms-all-${this.ctrl.instanceName}-${field.name}" onchange="${scope}.toggleMultiSelectAll('${field.name}', this)">
                    <span class="ms-text">${this.ctrl.txt.all}</span></label></div>`;

                rows += opts.map(o => `<div class="ms-row"><label>
                    <input type="checkbox" value="${o.id}" class="ms-opt-${this.ctrl.instanceName}-${field.name}" onchange="${scope}.updateMultiSelectDisplay('${field.name}')"> 
                    <span class="ms-text">${o.val}</span></label></div>`).join('');

                return `<div class="${containerClass}">${label}
                    <div class="multi-select-container" id="${idPrefix}${field.name}_container">
                        <div id="f_${this.ctrl.instanceName}_${field.name}_display" class="ms-display form-control ${inputClass}" tabindex="0"
                             onkeydown="${scope}.handleMultiSelectKeydown(event, '${field.name}')"
                             onclick="this.focus(); this.nextElementSibling.classList.toggle('active'); event.stopPropagation();">
                            <span id="f_${this.ctrl.instanceName}_${field.name}_text" class="ms-display-text">${this.ctrl.txt.all}</span>
                            <i class="fas fa-chevron-down ms-icon"></i>
                        </div>
                        <div class="multi-select-dropdown" onclick="event.stopPropagation();">${rows}</div>
                    </div></div>`;
            }

            // Standard Select
            let optsHTML = isFilter ? `<option value="">${this.ctrl.txt.all}</option>` : '';
            if (field.options) optsHTML += Object.entries(field.options).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
            else {
                const src = this.ctrl.options[field.source] || [];
                optsHTML += src.map(o => `<option value="${o.id}">${o.val || o.name || o.dsc || o.moneda}</option>`).join('');
            }
            return `<div class="${containerClass}">${label}<select id="${idPrefix}${field.name}" class="form-control ${inputClass}">${optsHTML}</select></div>`;
        }

        // Default Text/Numeric
        return `<div class="${containerClass}">${label}<input type="text" id="${idPrefix}${field.name}" placeholder="..." class="form-control ${inputClass}"></div>`;
    }

    getHeadersHTML() {
        return this.ctrl.config.fields.filter(f => f.grid).map(f => {
            let sort = '', icon = '';
            if (f.sortable) {
                const active = this.ctrl.currentSort === f.name;
                sort = `onclick="window['${this.ctrl.instanceName}'].loadData('${f.name}')"`;
                icon = `<i class="fas ${active ? (this.ctrl.currentDir === 'ASC' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'} ux-sort-icon ${active ? 'active' : ''}"></i>`;
            }
            return `<th ${sort}>${f.caption}${icon}</th>`;
        }).join('');
    }

    getPaginationHTML() {
        if (!this.ctrl.isPaginationEnabled) return '';
        const s = `window['${this.ctrl.instanceName}']`;
        return `<div id="pagination-${this.ctrl.instanceName}" class="ux-pagination">
            <div class="ux-pagination-text">${this.ctrl.txt.total}: <strong id="p-total-${this.ctrl.instanceName}">0</strong> | ${this.ctrl.txt.page} <strong id="p-current-${this.ctrl.instanceName}">1</strong></div>
            <div class="ux-pagination-controls">
                <button class="btn-primary ux-page-btn" onclick="${s}.changePage(-1)" id="btn-prev-${this.ctrl.instanceName}"><i class="fas fa-chevron-left"></i></button>
                <button class="btn-primary ux-page-btn" onclick="${s}.changePage(1)" id="btn-next-${this.ctrl.instanceName}"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>`;
    }

    getModalsHTML(scope, txt) {
        return `
            <div id="modal-crud-${this.ctrl.instanceName}" class="modal-overlay">
                <div class="modal-card">
                    <h3 id="modal-title-${this.ctrl.instanceName}"></h3>
                    <form id="crud-form-${this.ctrl.instanceName}" onsubmit="event.preventDefault();" style="display:contents">
                        <div class="modal-body">
                            <input type="hidden" id="e_${this.ctrl.instanceName}_id">
                            <div class="ux-modal-grid">
                                ${this.ctrl.config.fields.filter(f => f.editable !== false && f.type !== 'hidden' && f.type !== 'hidden-numeric').map(f => this.renderField(f, 'edit')).join('')}
                                ${this.ctrl.config.fields.filter(f => f.type === 'hidden' || f.type === 'hidden-numeric').map(f => `<input type="hidden" id="e_${this.ctrl.instanceName}_${f.name}">`).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-primary btn-save" onclick="${scope}.save()">${txt.btnSave}</button>
                            <button class="btn-primary btn-cancel" onclick="${scope}.closeModal()">${txt.btnCancel}</button>
                        </div>
                    </form>
                </div>
            </div>
            <div id="modal-delete-${this.ctrl.instanceName}" class="modal-overlay">
                <div class="modal-card modal-danger">
                    <h3>${txt.deleteTitle}</h3>
                    <div style="text-align:center; padding:20px;">${txt.deleteMsg}</div>
                    <div class="modal-footer">
                        <button class="btn-primary btn-delete" onclick="${scope}.confirmDelete()">${txt.btnDelete}</button>
                        <button class="btn-primary btn-cancel" onclick="${scope}.closeDeleteModal()">${txt.btnCancel}</button>
                    </div>
                </div>
            </div>
            <div id="modal-alert-${this.ctrl.instanceName}" class="modal-overlay">
                <div class="modal-card" style="max-width:400px;">
                    <h3>${txt.alertTitle}</h3>
                    <div class="modal-body" style="text-align:center;"><p id="msg-alert-${this.ctrl.instanceName}"></p></div>
                    <div class="modal-footer" style="justify-content:center;">
                        <button class="btn-primary" onclick="${scope}.closeAlertModal()">${txt.btnOK}</button>
                    </div>
                </div>
            </div>`;
    }
}

// =================================================================================
// 3. GRID COMPONENT (Main Controller)
// =================================================================================
class GridComponent {
    constructor(config) {
        this.config = config;
        this.instanceName = config.instanceName || 'gridApp';
        this.containerId = config.containerId || 'module-content';
        this.handlerUrl = config.handlerUrl || 'modules/x_grid/grid_handler.php';
        this.primaryKey = config.primaryKey || 'id';

        // Settings & Flags
        this.allowAdd = config.allowAdd ?? true;
        this.allowEdit = config.allowEdit ?? true;
        this.allowDelete = config.allowDelete ?? true;
        this.allowExport = config.export === true;
        this.allowImport = config.import === true;
        this.isPaginationEnabled = config.pagination === true;
        this.pageSize = config.pageSize || 20;

        // State
        this.data = [];
        this.options = {}; // Loaded from DB
        this.selectedId = null;
        this.currentSort = this.primaryKey;
        this.currentDir = 'ASC';
        this.currentPage = 1;
        this.totalRecords = 0;

        // Multi-Select Helpers
        this.searchBuffers = {};
        this.searchTimeouts = {};
        this.importTempFile = null;

        // Translations
        const defaults = {
            emptyState: "Selectați o înregistrare din tabelul superior.", noData: "Nu s-au găsit date.",
            total: "Total", page: "Pagina", btnAdd: "ADAUGĂ", btnEdit: "MODIFICĂ", btnDelete: "ȘTERGE",
            btnFilter: "FILTREAZĂ", btnExport: "EXPORT", btnImport: "IMPORT", btnSave: "SALVEAZĂ", btnCancel: "ANULEAZĂ", btnOK: "OK",
            modalTitleAdd: "Adaugă Nou", modalTitleEdit: "Modifică #", deleteTitle: "CONFIRMARE", deleteMsg: "Sunteți sigur?",
            alertTitle: "NOTIFICARE", selectRow: "Selectați o linie!", importTitle: "IMPORT CSV", importCheck: "Se verifică fișierul...",
            importConfirmBtn: "CONFIRMĂ IMPORT", importSuccess: "Succes! S-au procesat", importFail: "Eroare la import:",
            importNew: "Înregistrări noi", importUpdate: "Actualizări (ID existent)", all: "-- TOATE --",
            yes: "Selectat (DA)", no: "Neselectat (NU)", selected: "selectate", dateFrom: "De la", dateTo: "Până la",
            error: "Eroare", numericError: "trebuie să fie un număr valid!", mandatoryError: "este obligatoriu!"
        };
        this.txt = { ...defaults, ...(this.config.translations || {}) };

        // Instantiate Modules
        this.service = new GridService(this);
        this.renderer = new GridRenderer(this);
    }

    async init() {
        window[this.instanceName] = this;
        this.options = await this.service.loadOptions();
        this.renderer.renderLayout();
        this.attachEventListeners();
        if (this.config.autoLoad !== false) this.loadData();
        else this.renderer.renderEmptyState();
    }

    // --- Data Handling ---
    async loadData(sortField = null, resetPage = false) {
        if (resetPage) this.currentPage = 1;
        if (sortField) {
            if (this.currentSort === sortField) this.currentDir = this.currentDir === 'ASC' ? 'DESC' : 'ASC';
            else { this.currentSort = sortField; this.currentDir = 'ASC'; }
            // Partial re-render for headers only
            document.querySelector(`#table-${this.instanceName} thead tr`).innerHTML = this.renderer.getHeadersHTML();
        }

        const filters = this.collectFilters();
        const data = await this.service.getListData(filters);

        if (data) {
            if (data.pagination) {
                this.data = data.data;
                this.totalRecords = data.total;
                this.updatePaginationUI();
            } else {
                this.data = Array.isArray(data) ? data : [];
                this.totalRecords = this.data.length;
            }
            this.renderTableBody();
        }
    }

    renderTableBody() {
        const body = document.getElementById(`grid-body-${this.instanceName}`);
        if (!body) return;
        if (!this.data.length) return body.innerHTML = `<tr><td colspan="100%" class="ux-empty-state">${this.txt.noData}</td></tr>`;

        body.innerHTML = this.data.map(row => {
            const cls = typeof this.config.rowClass === 'function' ? this.config.rowClass(row) : '';
            const sel = this.selectedId == row[this.primaryKey] ? 'selected' : '';
            const cells = this.config.fields.filter(f => f.grid).map(f => {
                const cCls = typeof f.cellClass === 'function' ? f.cellClass(row[f.name], row) : '';
                return `<td class="${cCls}">${this.renderer.getValueCaption(f, row[f.name])}</td>`;
            }).join('');
            return `<tr data-id="${row[this.primaryKey]}" onclick="window['${this.instanceName}'].selectRow('${row[this.primaryKey]}', this)" class="${sel} ${cls}">${cells}</tr>`;
        }).join('');
    }

    // --- Selection & Events ---
    selectRow(id, rowEl) {
        document.querySelectorAll(`#grid-body-${this.instanceName} tr`).forEach(tr => tr.classList.remove('selected'));
        if (rowEl) rowEl.classList.add('selected');
        this.selectedId = id;
        if (typeof this.config.onRowSelect === 'function') {
            this.config.onRowSelect(id, this.data.find(r => r[this.primaryKey] == id));
        }
    }

    changePage(dir) {
        const max = Math.ceil(this.totalRecords / this.pageSize) || 1;
        const next = this.currentPage + dir;
        if (next >= 1 && next <= max) { this.currentPage = next; this.loadData(); }
    }

    updatePaginationUI() {
        if (!this.isPaginationEnabled) return;
        const max = Math.ceil(this.totalRecords / this.pageSize) || 1;
        const pTotal = document.getElementById(`p-total-${this.instanceName}`);
        if (pTotal) {
            pTotal.innerText = this.totalRecords;
            document.getElementById(`p-current-${this.instanceName}`).innerText = `${this.currentPage} / ${max}`;
            document.getElementById(`btn-prev-${this.instanceName}`).disabled = (this.currentPage <= 1);
            document.getElementById(`btn-next-${this.instanceName}`).disabled = (this.currentPage >= max);
        }
    }

    // --- Filters ---
    collectFilters() {
        const filters = {};
        this.config.fields.filter(f => f.filter).forEach(f => {
            const id = `f_${this.instanceName}_${f.name}`;
            if (f.type === 'date' || f.type === 'datetime') {
                const s = document.getElementById(id + '_start').value;
                const e = document.getElementById(id + '_end').value;
                if (s || e) filters[f.name] = { start: s, end: e };
            } else if (f.type === 'select' && f.multipleFilter) {
                const chks = document.querySelectorAll(`.ms-opt-${this.instanceName}-${f.name}:checked`);
                const all = document.querySelector(`.ms-all-${this.instanceName}-${f.name}`);
                if (!all.checked && chks.length) filters[f.name] = Array.from(chks).map(c => c.value);
            } else {
                const val = document.getElementById(id)?.value;
                if (val !== undefined && val !== '') filters[f.name] = val;
            }
        });
        return filters;
    }

    setFilter(name, val) {
        // Logic handled visually in Renderer, updated via DOM here
        const f = this.config.fields.find(x => x.name === name);
        if (!f) return;
        const id = `f_${this.instanceName}_${name}`;

        if (f.type === 'date' || f.type === 'datetime') {
            if (val.start) document.getElementById(id + '_start').value = val.start;
            if (val.end) document.getElementById(id + '_end').value = val.end;
        } else if (f.type === 'select' && f.multipleFilter) {
            const chks = document.querySelectorAll(`.ms-opt-${this.instanceName}-${name}`);
            let hasCheck = false;
            chks.forEach(c => {
                const match = Array.isArray(val) ? val.includes(c.value) : c.value == val;
                c.checked = match;
                if (match) hasCheck = true;
            });
            document.querySelector(`.ms-all-${this.instanceName}-${name}`).checked = !hasCheck;
            this.updateMultiSelectDisplay(name);
        } else {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }
    }

    // --- CRUD Actions ---
    openModal(id = null) {
        if (id === null) { // Add New Check
            const link = this.config.fields.find(f => (f.type === 'hidden-numeric' || f.type === 'hidden') && f.filter);
            if (link && !document.getElementById(`f_${this.instanceName}_${link.name}`).value) return this.showAlert(this.txt.emptyState);
        }

        document.getElementById(`crud-form-${this.instanceName}`).reset();
        document.getElementById(`e_${this.instanceName}_id`).value = id || '';
        document.getElementById(`modal-title-${this.instanceName}`).innerText = id ? (this.txt.modalTitleEdit + id) : this.txt.modalTitleAdd;

        // Populate Form
        const row = id ? this.data.find(r => r[this.primaryKey] == id) : null;
        this.config.fields.forEach(f => {
            const el = document.getElementById(`e_${this.instanceName}_${f.name}`);
            if (!el) return;
            if (id && row) {
                if (f.type === 'checkbox') el.checked = (row[f.name] == 1);
                else if (f.type === 'datetime' && row[f.name]) el.value = row[f.name].replace(' ', 'T').substring(0, 16);
                else el.value = row[f.name] || '';
            } else if (!id && f.defaultValue !== undefined) {
                el.value = f.defaultValue;
            }
        });

        this.toggleModal(`modal-crud-${this.instanceName}`, true);
    }

    async save() {
        const data = {};
        for (const f of this.config.fields) {
            const el = document.getElementById(`e_${this.instanceName}_${f.name}`);
            if (el) {
                let val = f.type === 'checkbox' ? (el.checked ? 1 : 0) : el.value;
                if (f.mandatory && !val) return this.showAlert(`${this.txt.error}: ${f.caption} ${this.txt.mandatoryError}`);
                if (f.type === 'numeric' && val !== '') {
                    val = val.replace(',', '.');
                    if (isNaN(val)) return this.showAlert(`${this.txt.error}: ${f.caption} ${this.txt.numericError}`);
                }
                data[f.name] = val;
            }
        }

        const res = await this.service.saveRecord(data, document.getElementById(`e_${this.instanceName}_id`).value);
        if (res.success) { this.closeModal(); this.loadData(); }
        else this.showAlert(this.txt.error + ": " + res.message);
    }

    deleteSelected() {
        if (!this.selectedId) return this.showAlert(this.txt.selectRow);
        this.toggleModal(`modal-delete-${this.instanceName}`, true);
    }

    async confirmDelete() {
        const res = await this.service.deleteRecord(this.selectedId);
        if (res.success) { this.closeDeleteModal(); this.loadData(); this.selectedId = null; }
        else this.showAlert(this.txt.error + ": " + res.message);
    }

    // --- Import / Export ---
    async exportData() {
        const csv = await this.service.exportCSV(this.collectFilters());
        if (!csv) return;
        try {
            const json = JSON.parse(csv);
            const rows = json.pagination ? json.data : (Array.isArray(json) ? json : []);
            if (!rows.length) return this.showAlert(this.txt.noData);

            const fields = this.config.fields.filter(f => f.export !== false);
            const content = [
                fields.map(f => f.caption || f.name).join(','),
                ...rows.map(r => fields.map(f => `"${String(this.renderer.getValueCaption(f, r[f.name])).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' }));
            link.download = `export_${this.config.tableName}.csv`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        } catch (e) { this.showAlert(this.txt.error); }
    }

    async handleFileSelect(input) {
        if (!input.files.length) return;
        this.toggleModal(`modal-import-${this.instanceName}`, true);
        const res = await this.service.uploadImportFile(input.files[0]);
        if (res.success) {
            this.importTempFile = res.tempFile;
            document.getElementById(`import-stats-${this.instanceName}`).innerHTML = `
                <div class="ux-import-stats">
                    <div class="ux-stat-box success"><div class="ux-stat-number">${res.stats.adds}</div><div>${this.txt.importNew}</div></div>
                    <div class="ux-stat-box warning"><div class="ux-stat-number">${res.stats.updates}</div><div>${this.txt.importUpdate}</div></div>
                </div>
                <div style="text-align:center; margin-top:10px;"><button class="btn-primary" onclick="window['${this.instanceName}'].executeImport()">${this.txt.importConfirmBtn}</button></div>`;
        } else {
            this.showAlert(this.txt.importFail + " " + res.message);
            this.closeImportModal();
        }
        input.value = '';
    }

    async executeImport() {
        const res = await this.service.executeImport(this.importTempFile);
        this.closeImportModal();
        if (res.success) { this.showAlert(`${this.txt.importSuccess} ${res.count}`); this.loadData(); }
        else this.showAlert(this.txt.error + ": " + res.message);
    }

    // --- Helpers ---
    toggleModal(id, show) {
        const el = document.getElementById(id);
        if (show) { el.style.display = 'flex'; setTimeout(() => el.classList.add('active'), 10); }
        else { el.classList.remove('active'); setTimeout(() => el.style.display = 'none', 400); }
    }
    closeModal() { this.toggleModal(`modal-crud-${this.instanceName}`, false); }
    closeDeleteModal() { this.toggleModal(`modal-delete-${this.instanceName}`, false); }
    closeAlertModal() { this.toggleModal(`modal-alert-${this.instanceName}`, false); }
    closeImportModal() { this.toggleModal(`modal-import-${this.instanceName}`, false); }
    showAlert(msg) {
        document.getElementById(`msg-alert-${this.instanceName}`).innerText = msg;
        this.toggleModal(`modal-alert-${this.instanceName}`, true);
    }
    triggerImport() { document.getElementById(`file-import-${this.instanceName}`).click(); }
    editSelected() { if (!this.selectedId) return this.showAlert(this.txt.selectRow); this.openModal(this.selectedId); }
    handleCustomButton(i) {
        if (!this.selectedId) return this.showAlert(this.txt.selectRow);
        this.config.customButtons[i].onClick(this.selectedId, this.data.find(r => r[this.primaryKey] == this.selectedId));
    }

    // --- Multi-Select Logic ---
    toggleMultiSelectAll(name, cb) {
        document.querySelectorAll(`.ms-opt-${this.instanceName}-${name}`).forEach(c => c.checked = cb.checked);
        this.updateMultiSelectDisplay(name);
    }
    updateMultiSelectDisplay(name) {
        const chks = document.querySelectorAll(`.ms-opt-${this.instanceName}-${name}`);
        const display = document.getElementById(`f_${this.instanceName}_${name}_text`);
        let sel = [], all = true;
        chks.forEach(c => { if (c.checked) sel.push(c.nextElementSibling.innerText); else all = false; });
        document.querySelector(`.ms-all-${this.instanceName}-${name}`).checked = all;
        display.innerText = (all || sel.length === 0) ? this.txt.all : (sel.length === 1 ? sel[0] : `${sel.length} ${this.txt.selected}`);
    }
    handleMultiSelectKeydown(e, name) {
        if (e.key.length !== 1) return;
        this.searchBuffers[name] = (this.searchBuffers[name] || '') + e.key.toLowerCase();
        clearTimeout(this.searchTimeouts[name]);
        this.searchTimeouts[name] = setTimeout(() => this.searchBuffers[name] = '', 500);
        const rows = document.querySelectorAll(`#f_${this.instanceName}_${name}_container .ms-row`);
        for (let r of rows) {
            if (r.innerText.toLowerCase().includes(this.searchBuffers[name])) {
                r.scrollIntoView({ block: 'nearest' }); r.style.background = '#e3f2fd';
                setTimeout(() => r.style.background = '', 300); break;
            }
        }
    }

    attachEventListeners() {
        const c = document.getElementById(this.containerId);
        if (c) {
            c.querySelector('.ux-filter-zone').addEventListener('keypress', e => { if (e.key === 'Enter') this.loadData(null, true); });
            document.getElementById(`grid-body-${this.instanceName}`).addEventListener('dblclick', e => {
                const row = e.target.closest('tr');
                if (row && this.allowEdit) { this.selectRow(row.getAttribute('data-id'), row); this.editSelected(); }
            });
        }
        if (!window._gridListener) {
            document.addEventListener('click', () => document.querySelectorAll('.multi-select-dropdown').forEach(e => e.classList.remove('active')));
            window._gridListener = true;
        }
    }
}
