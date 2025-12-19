/**
 * Selection Monitor
 * 
 * Monitors selection changes in Qlik Sense app and captures selection details
 * 
 * @module lib/selection-monitor
 */

define([], function() {
    'use strict';
    
    /**
     * Creates a new SelectionMonitor instance
     * 
     * @class
     * @param {object} app - Qlik app instance
     * @param {object} config - Configuration object
     * @param {object} eventBuffer - EventBuffer instance
     */
    function SelectionMonitor(app, config, eventBuffer) {
        this.app = app;
        this.config = config;
        this.eventBuffer = eventBuffer;
        this.lastSignature = '';
        this.selectionObject = null;
    }
    
    /**
     * Start monitoring selections
     */
    SelectionMonitor.prototype.start = function() {
        var self = this;
        
        // Get the selection object and monitor it
        this.app.getList('SelectionObject', function(reply) {
            self.selectionObject = reply;
            self.handleSelectionChange(reply);
        });
    };
    
    /**
     * Stop monitoring selections
     */
    SelectionMonitor.prototype.stop = function() {
        // Cleanup if needed
        this.selectionObject = null;
    };
    
    /**
     * Handle selection change event
     * 
     * @param {object} reply - Selection object reply from Qlik
     */
    SelectionMonitor.prototype.handleSelectionChange = function(reply) {
        var self = this;
        var selections = reply.qSelectionObject.qSelections || [];
        var signature = this.createSignature(selections);
        
        // Only process if selections actually changed
        if (signature === this.lastSignature) {
            return;
        }
        
        this.lastSignature = signature;
        
        // Create base event
        var event = {
            type: selections.length === 0 ? 'SELECTION_CLEARED' : 'SELECTION_CHANGED',
            timestamp: new Date().toISOString(),
            data: {
                selections: [],
                signature: signature
            }
        };
        
        // If no selections, send immediately
        if (selections.length === 0) {
            this.eventBuffer.add(event);
            return;
        }
        
        // Process each selection
        var promises = selections.map(function(sel) {
            return self.processSelection(sel);
        });
        
        // Wait for all selections to be processed
        Promise.all(promises).then(function(results) {
            event.data.selections = results;
            self.eventBuffer.add(event);
        }).catch(function(error) {
            console.error('Butler SOS: Error processing selections:', error);
            // Send event without values
            event.data.selections = selections.map(function(sel) {
                return {
                    field: sel.qField,
                    stateName: sel.qStateName || '$',
                    selectedCount: sel.qSelectedCount,
                    totalCount: sel.qTotal
                };
            });
            self.eventBuffer.add(event);
        });
    };
    
    /**
     * Process a single selection
     * 
     * @param {object} sel - Selection object from Qlik
     * @returns {Promise<object>} Promise resolving to selection data
     */
    SelectionMonitor.prototype.processSelection = function(sel) {
        var selectionData = {
            field: sel.qField,
            stateName: sel.qStateName || '$',
            selectedCount: sel.qSelectedCount,
            totalCount: sel.qTotal
        };
        
        // Capture values if enabled and there are selections
        if (this.config.captureValues && sel.qSelectedCount > 0 && sel.qSelectedCount <= this.config.maxValuesPerField) {
            return this.getSelectedValues(sel).then(function(values) {
                selectionData.values = values;
                return selectionData;
            }).catch(function() {
                // If value capture fails, return without values
                return selectionData;
            });
        }
        
        return Promise.resolve(selectionData);
    };
    
    /**
     * Get selected values for a field
     * 
     * @param {object} sel - Selection object
     * @returns {Promise<Array<string>>} Promise resolving to array of selected values
     */
    SelectionMonitor.prototype.getSelectedValues = function(sel) {
        var self = this;
        var maxValues = Math.min(sel.qSelectedCount, this.config.maxValuesPerField);
        
        return this.app.createList({
            qStateName: sel.qStateName || '$',
            qDef: {
                qFieldDefs: [sel.qField]
            },
            qInitialDataFetch: [{
                qTop: 0,
                qLeft: 0,
                qWidth: 1,
                qHeight: maxValues
            }]
        }).then(function(model) {
            return model.getLayout().then(function(layout) {
                var values = [];
                
                if (layout.qListObject && layout.qListObject.qDataPages && layout.qListObject.qDataPages[0]) {
                    var matrix = layout.qListObject.qDataPages[0].qMatrix;
                    
                    values = matrix
                        .filter(function(row) {
                            return row[0].qState === 'S'; // Selected state
                        })
                        .map(function(row) {
                            return row[0].qText;
                        });
                }
                
                // Cleanup
                model.close();
                
                return values;
            });
        });
    };
    
    /**
     * Create signature string for selection state
     * Used to detect if selections actually changed
     * 
     * @param {Array} selections - Array of selection objects
     * @returns {string} Signature string
     */
    SelectionMonitor.prototype.createSignature = function(selections) {
        if (!selections || selections.length === 0) {
            return '';
        }
        
        return selections.map(function(s) {
            return s.qField + ':' + (s.qStateName || '$') + ':' + s.qSelectedCount;
        }).sort().join(';');
    };
    
    return SelectionMonitor;
});
