"use strict";

// Configuration manager.
//
// Handles configurability of the metadata card.
function ConfigurationManager( metadatacard ) {
	
	// Initialize variables.
	var self = this;  // This object.
	this.metadatacard = metadatacard;  // The metadata card.
	this.propertyGrouping = null;  // The object to handle property groups.
	this.currentClassId = null;  // Current class id.
	this.dpInProgress = false;  // Tells that changes to the property view are caused by rebuilding of dynamic properties.
	this.rebuildProperties = false;  // Tells that rebuilding of the property view is requested.
	this.configurabilityEnabled = false;  // If true, configuration rules affect the behavior and appearance of the metadata card.
	this.classSelectedByTab = false;  // Indicates that TAB key was pressed in class selector when dropdown list was open. This potentially changes class.
	this.selectFirstEmptyControl = false;  // True to select first empty control to edit mode when metadatacard has been updated.
	this.skipSetValuesAfterRebuild = false;  // True to skip set values after rebuilding of dynamic properties.
	
	this.vaultLanguage = null;  // Language code of the vault language.
	this.clientLanguage = null;  // Language code of the client language.
	this.objVers = null;  // Object versions.
	this.aliases = {
		ObjectTypeAliases: {},
		PropertyDefinitionAliases: {},
		ClassAliases: {},
		WorkflowAliases: {},
		StateAliases: {},
		StateTransitionAliases: {}
	};  // Aliases.
	this.valueListsItemsGuids = {};  // Cache for Value List Item id by guid.
	this.propertyParameters = {};  // Property parameters.
	this.iterationCounter = 0;  // Iteration counter for rule evaluations.
	
	// Variables for configuration storage.
	this.configurationVersion = "1.0";  // Version information of the configuration.
	this.configurationNamespace = "M-Files.Core.MetadataCard.Configuration.RuleSets";  // Namespace to store configuration.
	this.primaryRuleSet = "primary";  // Name of the primary rule set.
	this.cachedRules = null;  // Cached rules.
	
	// Create configuration helper.
	this.configurationHelper = new ConfigurationHelper();
	
	// Collection of currently passed rules.
	this.currentRules = {};
	
	// Array of keys of currently passed rules as a string.
	this.passedKeysAsString = "";
	
	// Functions, which are called by metadata card when something has been changed.
	
	/**
	 * Called before UI controls are created.
	 */
	this.onBeforeCreateControls = function() {
	
		// Skip setting of new "set values" for existing objects.
		var skipSetValues = false;
		if( !this.metadatacard.controller.editor.DataModel.UncreatedObject )
			skipSetValues = true;
		
		// Resolve current configuration based on selected objects and filter rules.
		// Store also class id.
		this.setConfiguration( skipSetValues, true, null );
		
		// TODO: Loop all custom UI controls from passed rules and check if these properties should exist in the metadata card.
		// If they should exist, load JavaScript for custom UI controls dynamically here before controls are created. 
		
		/*
		// Load custom UI controls.
		utilities.loadScripts( [
			"CustomUIControls/lookupcontrol.js",
			"CustomUIControls/lookupcontrolcontainer.js",
			"CustomUIControls/booleancontrol.js",
			"CustomUIControls/datecontrol.js",
			"CustomUIControls/numbercontrol.js",
			"CustomUIControls/textcontrol.js",
			"CustomUIControls/multilinetextcontrol.js",
			"CustomUIControls/timecontrol.js",
			"CustomUIControls/timestampcontrol.js"
		] );
		*/		
		
		// Update theme.
		this.metadatacard.updateTheme( this.metadatacard.hasUnsavedChanges() );
	}
	
	/**
	 * Called after UI controls are created.
	 */
	this.onAfterControlsCreated = function() {
	
		// Write information to the metadata card log.
		utilities.log( "In onAfterControlsCreated.", { "showTimestamp" : true } );
		
		// Add the property grouping if there are defined groups.
		if( this.propertyGrouping.hasDefinedGroups() )
			this.propertyGrouping.addGrouping();
			
		// Rebuild dynamic properties.
		this.rebuildDynamicProperties( 0, false, -1 );
		
		// If rebuilding was started and this is existing object, set variable to indicate that
		// setting of "set values" should be skipped also after rebuild.
		if( this.dpInProgress && !this.metadatacard.controller.editor.DataModel.UncreatedObject )
			this.skipSetValuesAfterRebuild = true;
		
		// Check if we are creating a new object.
		if( this.metadatacard.controller.editor.DataModel.UncreatedObject ) {

			// All controls are already created.
			// If we are not waiting for changes to property values (done by dynamic properties),
			// we can set the first editable control to edit mode.  
			if( !this.dpInProgress ) {
			
				// Set the first editable control to edit mode.
				setTimeout( function() {
				
					// Write information to the metadata card log.
					utilities.log( "In onAfterControlsCreated. Set first editable control to the edit mode.", { "showTimestamp" : true } );
		
					// Set first editable control to the edit mode.
					self.metadatacard._setFirstEditableControlToEditmode( false );
					
				}, 0 );
			}
			else {
			
				// Write information to the metadata card log.
				utilities.log( "In onAfterControlsCreated. Set variable 'selectFirstEmptyControl' to true.", { "showTimestamp" : true } );

				// We are still waiting for changes to property values (by dynamic properties).
				// Set flag to indicate that we must set first empty control to edit mode when
				// metadata card updating has been done.
				this.selectFirstEmptyControl = true;
			}
		}
		
		// Write information to the metadata card log.
		utilities.log( "After onAfterControlsCreated.", { "showTimestamp" : true } );

		// We consider that now metadata-card has been opened from user's point of view.
		// Make note of time and send to MFAnalytics.
		var durationOfOpening = utilities.endAndGetTimingOpenMetadataCard();
		MFiles.MFAnalyticsTimedEvent( 'MFA_EVENT_CATEGORY_METADATA_EDITOR','OPENED', durationOfOpening, '' );
	}

	/**
	 * Called after metadata card content has been updated.
	 *		- rebuilding of dynamic properties also triggers this event
	 *		- called also when class has been changed by the user
	 */
	this.onAfterContentUpdated = function() {
	
		// Write information to the metadata card log.
		utilities.log( "In onAfterContentUpdated. dpInProgress = " + this.dpInProgress, { "showTimestamp" : true } );
		
		// Check whether this event was generated by dynamic properties functionality.
		if( this.dpInProgress ) {
	
			// By default, set "dynamic properties"-flag to false so that we can handle next "content updated"-event normally.
			this.dpInProgress = false;
			
			// If skipping of "set values" was requested, do it when property view is rebuilt.
			var skipSetValues = this.skipSetValuesAfterRebuild;
			this.skipSetValuesAfterRebuild = false;
			
			// Rebuild property view ALWAYS in this phase, because we have now new dynamic properties.
			this.rebuildPropertyView( skipSetValues, true, null );
			
			// Rebuild dynamic properties.
			// Forward iteration counter for metadata model to limit iterations if there are circular references. 
			var started = this.rebuildDynamicProperties( this.iterationCounter, false, -1 );
			if( started )
				this.iterationCounter++;
			else
				this.iterationCounter = 0;
		
			// If rebuilding was started, this is existing object and skipping of "set values" was requested,
			// set variable to indicate that setting of "set values" should be skipped also after rebuild.
			if( this.dpInProgress && !this.metadatacard.controller.editor.DataModel.UncreatedObject && skipSetValues )
				this.skipSetValuesAfterRebuild = true;
			
			// Try to select UI control only if rebuilding is not started.
			if( !this.dpInProgress ) {
			
				// Set the first editable control to edit mode here only if requested.
				if( this.selectFirstEmptyControl ) {
				
					// Write information to the metadata card log.
					utilities.log( "Set timer to set first editable control to the edit mode.", { "showTimestamp" : true } );
		
					// Set timer to set first editable control to the edit mode.
					setTimeout( function() {
						
						// Write information to the metadata card log.
						utilities.log( "Set first editable control to edit mode.", { "showTimestamp" : true } );
			
						// Set first editable control to the edit mode.
						self.metadatacard._setFirstEditableControlToEditmode( false );
						
					}, 0 );
				}
				
				// Reset the flag.
				this.selectFirstEmptyControl = false;
			}
		}
		else {

			// Get current class id.
			var classId = this.metadatacard.controller.getClassId();
			
			// If user hasn't selected any class when creating new object, handle it here.
			if( !classId ) {

				// Proceed only if deselecting a class in the class selector is allowed.
				if( self.metadatacard.controller.editor.DataModel != undefined &&
					self.metadatacard.controller.editor.DataModel.IsDeselectClassAllowed === false )
					return;

				// Rebuild property view always when class has been changed, because almost always there is some changes in properties when class changes,
				// even when configuration won't change.
				this.rebuildPropertyView( false, true, null );

				// Rebuild dynamic properties. Inform model that this is called when class has changed.
				this.rebuildDynamicProperties( 0, true, -1 );

				// Reset the flag.
				this.rebuildProperties = false;
			}
			else {

				// User has selected multiple objects with different classes.
				if( classId.IsMultiValue )
					return;

				// Check if class has been changed.
				if( classId.Item != this.currentClassId ) {

					// Rebuild property view always when class has been changed, because almost always there is some changes in properties when class changes,
					// even when configuration won't change.
					this.rebuildPropertyView( false, true, null );

					// Rebuild dynamic properties. Inform model that this is called when class has changed.
					this.rebuildDynamicProperties( 0, true, -1 );
				}
				else if( this.rebuildProperties ) {

					// Write information to the metadata card log.
					utilities.log( "Rebuilding of property view requested.", { "showTimestamp": true } );

					// There was added, removed or changed properties after latest "Content updated" event. Rebuild the property view.
					this.rebuildPropertyView( false, true, null );
				}
			}
		}
		// Reset the flag.
		this.rebuildProperties = false;
		
		// Check if there was conflicting control (a control which was in edit mode when event to update it's value was received from the model).
		if( this.metadatacard.conflictingControl !== null ) {
		
			// There was conflicting control. Update its value afterwards.
			var conflictingControl = this.metadatacard.conflictingControl;
			this.metadatacard.setConflictingControl( null ); 
			setTimeout( function() {
			
				// Write information to the metadata card log.
				utilities.log( "Update property value of conflicting control: " + conflictingControl, { "showTimestamp" : true } );
				
				// Get corresponding UI control. 
				var propertyTable = $( "#mf-property-table" );
				if( propertyTable.length ) {
					var propertyLine = propertyTable.find( ".mf-dynamic-row.mf-property-" + conflictingControl ).first();
					
					// Try to update the property value. If this fails, an error is silently ignored.
					try {
						propertyLine.propertyline( "updateValue" );
					}
					catch( ex ) {
					
						// Write information about exception to the metadata card log.
						utilities.log( "Exception in updateValue: " + ex, { "showTimestamp" : true } );
					}
				}
				
			}, 100 );
	
		}
		
		// Write information to the metadata card log.
		utilities.log( "After onAfterContentUpdated.", { "showTimestamp" : true } );
	}
	
	/**
	 * Called when a new property has been added to the metadata card.
	 *
	 * @param property - The added property.
	 * @param addedByUser - True, if this property was added by the user.
	 * @param hasValueSuggestions - True, if this property has value suggestions.
	 */
	this.onControlAdded = function( property, addedByUser, hasValueSuggestions ) {

		// If the control was added by the user, update configurable parts of the metadata card based on this property.
		if( addedByUser ) {
		
			// Rebuild property view. This is needed always to refresh the view when a new control is added by the user.
			this.rebuildPropertyView( false, true, null );
			
			// Select the new control automatically. Inform about existing value suggestions.
			this.selectControl( property, hasValueSuggestions );
			
			// Rebuild dynamic properties. Inform model about added property definition.
			this.rebuildDynamicProperties( 0, false, property.propertyDef );
		}
		else {
		
			// It is possible that in some slow situations (e.g. with virtual machine) we will receive several "Content updated" events.
			// In this case it is possible, that all properties are not yet ready when first "Content updated" event is received.
			// So, we must prepare for changes after first event and if we detect changes to properties, we must re-build property view
			// with next "Content updated" event.
		
			// The event about added control triggers rebuilding of the property view. 
			this.rebuildProperties = true;
		}
	}
	
	/**
	 * Called when the property has been removed from the metadata card.
	 *
	 * @param property - The removed property.
	 * @param removedByUser - True, if this property was removed by the user.
	 */
	this.onControlRemoved = function( property, removedByUser ) {
	
		// If the control was removed by the user, update configurable parts of the metadata card based on this property.
		if( removedByUser ) {
		
			// Rebuild property view. This is needed always to refresh the view when a control is removed by the user.
			this.rebuildPropertyView( false, true, null );
			
			// Rebuild dynamic properties.
			this.rebuildDynamicProperties( 0, false, -1 );
		}
		else {
		
			// It is possible that in some slow situations (e.g. with virtual machine) we will receive several "Content updated" events.
			// In this case it is possible, that all properties are not yet ready when first "Content updated" event is received.
			// So, we must prepare for changes after first event and if we detect changes to properties, we must re-build property view
			// with next "Content updated" event.
		
			// The event about removed control triggers rebuilding of the property view. 
			this.rebuildProperties = true;
		}
	}
	
	/**
	 * Called when a lookup control value has been changed.
	 *
	 * @param oldValue - The old value of the property.
	 * @param newValue - The new value of the property.
	 * @param propertyDef - The property definition ID.
	 * @param considerIndirectChanges - If true, this event might be caused by indirect changes, e.g. auto-filling of properties.
	 *        In this case we should check whether the rule condition allows triggering based on indirect changes. 
	 * @param useForEventRules - True to evaluate event-based rules.	 
	 */
	this.onValueChanged = function( oldValue, newValue, propertyDef, considerIndirectChanges, useForEventRules ) {
	
		// Delegate.
		this.updateBasedOnProperty( oldValue, newValue, propertyDef, considerIndirectChanges, true, useForEventRules );
	}

	/**
	 * Called when value of text-based control has been changed.
	 *
	 * @param propertyDef - The property definition ID. 
	 */
	this.onTextValueChanged = function( propertyDef ) {
	
		// Delegate.
		this.updateBasedOnProperty( null, null, propertyDef, false, false, true );
	}
	
	/**
	 * Called when a tab key is pressed in class selector and dropdown list is open.
	 */
	this.onClassSelectedByTab = function() {
	
 		// Store information that potential class change is caused by tab key.
		this.classSelectedByTab = true;
	},
	
	/**
	 * Called when a tab key is pressed in UI control.
	 *
	 * @param event The key event from jQuery.
	 * @param propertyDef The property definition id.
	 */
	this.onTabPressed = function( event, propertyDef ) {
	
		// If TAB key was pressed when class selector had focus, special handling is needed for selecting/focusing of next control.
		if( propertyDef === 100 && !event.shiftKey ) {
	
			// Prevent default action. This is needed to prevent conflicting operations: ongoing rendering of UI controls and 
			// setting of focus to these controls (which is done automatically by browser).
			// In practice this prevents browser's built-in event, which tries to move the focus automatically to next focusable control,
			// which then breaks the focus behavior. 
			event.preventDefault();
			
			// Check if there will be potential class change caused by tab key.
			if( !this.classSelectedByTab ) {

				// No potential class change. 
				// Move selection from class selector to next editable (not read-only) UI control programmatically.
				this.metadatacard._setFirstEditableControlToEditmode( true );
			}
		}
		this.classSelectedByTab = false;
	}
	
	/**
	 * Updates metadata card based on change in the property value.
	 *
	 * @param oldValue - The old value of the property.
	 * @param newValue - The new value of the property.
	 * @param propertyDef - The property definition ID.
	 * @param considerIndirectChanges - If true, this event might be caused by indirect changes, e.g. auto-filling of properties.
	 *        In this case we should check whether the rule condition allows triggering based on indirect changes.
	 * @param useForNormalRules - True to evaluate normal rules.
	 * @param useForEventRules - True to evaluate event-based rules.
	 */
	this.updateBasedOnProperty = function( oldValue, newValue, propertyDef, considerIndirectChanges, useForNormalRules, useForEventRules ) {
	
		// Skip all events about changes in metadata when rebuilding of metadata model is ongoing.
		// This should prevent some conflicts in asynchronous operations of UI controls.
		// This is also needed to prevent infinite loops when there are circular references between rules.
		if( this.dpInProgress )
			return;
	
		// Skip class selector, because changing of class is not handled here.
		// Changing of class is detected and handled when content updated event is received.
		if( propertyDef === 100 )
			return;

		// Process normal rules only if requested.		
		if( useForNormalRules ) {	
			
			// Check if passed rules are changed.
			var changed = this.passedRulesChanged( propertyDef, considerIndirectChanges );
			if( changed ) {
			
				// Rebuild property view.
				// Class id (which is used to detect whether a class has been changed) MUST NOT be stored in this phase. Otherwise,
				// comparing of current and previous class in onAfterContentUpdated won't detect that class has been changed.
				this.rebuildPropertyView( false, false, null );

				// We must reselect the already selected UI control (which in this case is also trigger property) after rebuilding.
				// This is needed because rebuilding of property view detaches/attaches also the currently selected
				// UI control and this breaks e.g. focus handling of IE's input fields.
				// NOTE: We must not reselect the control if it is switching to view mode.
				// If we try to reselect control in this situation, it causes change to property
				// value, which triggers another event about changed value and this leads to
				// infinity recursion/unstable situation.
				if( !this.metadatacard.switchingToViewMode )
					this.metadatacard.reselectActiveUIControl();
				
				// Rebuild dynamic properties.
				this.rebuildDynamicProperties( 0, false, -1 );
			}
		}
		
		// Check if we should evaluate rules to trigger fetching of metadata suggestion.
		if( useForEventRules ) {
		
			// TODO: Optimize getting of objectData if possible.
		
			// TODO: Handle situation, where change to property value causes model rebuilding!!!
		
			// Get metadata of selected objects.
			var objectData = this.metadatacard.controller.getObjectData();

			// Check if there is matching rule for OnPropertyValueChanged event.
			var event = "OnPropertyValueChanged";
			var result = this.resolveEventBehavior( objectData, event, propertyDef );
			if( result.eventRulePassed === true ) {

				// Start fetching of metadata suggestions. Use parameters from the rule.
				this.fetchMetadataSuggestions( result.behavior, event, false );
			}
		}
	}
	
	/**
	 * Sets configuration.
	 *
	 * @param skipSetValues - True to skip set values.
	 * @param storeClassId - True to store class id. It is used for comparison when we check whether a class has been changed.
	 * @param event - Explains why fetching of metadata suggestions has been requested.
	 */
	this.setConfiguration = function( skipSetValues, storeClassId, event ) {
	
		// Get object versions.
		this.objVers = this.metadatacard.controller.getObjVers();
		
		// Current rules.
		var currentRules = [];
	
		// Get current behavior object based on current rules.
		// In practice the returned behavior object is combination of behaviors of all passed rules.
		// Get also list of current rules.
		var behavior = this.resolveCurrentBehavior( currentRules );
		
		// Convert aliases to property definition ids in the behavior object.
		behavior = this.parseAliasesFromBehavior( behavior );

		// Convert aliases and guids to value list ids in the behavior object.
		behavior = this.parseValueListAliasesAndGuidsFromBehavior( behavior );

		// Set behavior for configuration helper.
		this.configurationHelper.setConfiguration( behavior );
		
		// Set value list tooltips.
		this.setValueListTooltips( behavior );
		
		// Set property priorities.
		this.setPropertyPriorities( behavior );
		
		// Set hidden properties.
		this.setHiddenProperties( behavior );
		
		// Set read-only properties.
		this.setReadOnlyProperties( behavior );
		
		// Set property groups.
		this.setPropertyGroups( behavior );
		
		// Set current properties.
		var properties = this.metadatacard.controller.getProperties();
		this.metadatacard.localModel.setProperties( properties );
		
		// Set property appearance.
		this.setPropertyAppearance( behavior );
		
		// Set custom UI controls for properties.
		this.setCustomUIControls( behavior );
		
		// Set property parameters.
		this.setPropertyParameters( behavior );
		
		// Set description for the metadata card.
		this.setMetadatacardDescription( behavior );
		
		// Set dynamic properties: additional/required properties and default values.
		this.setDynamicProperties( behavior, currentRules, skipSetValues );
		
		// Store current class id.
		if( storeClassId )
			this.storeClassId();
	}
	
	/**
	 * Stores current class id. It is used for comparison when we check whether a class has been changed.
	 */
	this.storeClassId = function() {
	
		// Get current class id.
		var classId = this.metadatacard.controller.getClassId();

		// If user hasn't selected any class when creating new object, handle it here.
		if( !classId ) {

			// Set current class id to null.
			this.currentClassId = null;
			return;
		}

		// User has selected multiple objects with different classes.
		if( classId.IsMultiValue ) {

			// Not supported, set current class id to null.
			this.currentClassId = null;
			return;
		}

		// Set current class id. This is used for comparison when we check whether a class has been changed.
		this.currentClassId = classId.Item;
	}
	
	/**
	 * Rebuilds the dynamic view of the UI property controls.
	 *
	 * @param skipSetValues - True to skip set values.
	 * @param storeClassId - True to store class id. It is used for comparison when we check whether a class has been changed.
	 * @param event - Explains why fetching of metadata suggestions has been requested.
	 */
	this.rebuildPropertyView = function( skipSetValues, storeClassId, event ) {
		
		// Write information to the metadata card log.
		utilities.log( "In rebuildPropertyView.", { "showTimestamp" : true } );
	
		// Resolve current configuration based on selected objects and filter rules. Store also class id if requested.
		this.setConfiguration( skipSetValues, storeClassId, event );
	
		// Preliminary checks for rebuild (get out fast).
		if( $( "#mf-property-table" ).length ) {
		
			// Remove possible existing groups.
			if( this.propertyGrouping.propertyGroupingInUse() )
				this.propertyGrouping.removeGrouping();
		
			// Rebuild the property grouping if there are defined groups.
			if( this.propertyGrouping.hasDefinedGroups() ) {
			
				// Add grouping.
				this.propertyGrouping.addGrouping();
			}
			else {

				// No defined property groups.

				// Update UI controls (without property groups).
				this.metadatacard.updateUIControls();
			}
			
			// Update property labels.
			this.metadatacard.updatePropertyLabels();
		}
	}
	
	/**
	 * Selects UI property control when property view has been updated.
	 *
	 * @param property The property to select.
	 * @param hasValueSuggestions - True, if this property has value suggestions.
	 */
	this.selectControl = function( property, hasValueSuggestions ) {

		// Set focus to correct control after update.
		var self = this;
		setTimeout( function() {

			if( property.ReadOnly ) {

				self.metadatacard.element.find( ".mf-add-property-control:first" ).click();
			}
			else {

				// Set the added control to edit mode.
				var id = property.Id;
				var propertyLine = $( "tr#" + id + ".mf-dynamic-row" );

				// Ignore errors silently.
				try {

					// Set to edit mode.
					propertyLine.propertyline( "setToEditMode", hasValueSuggestions );
				}
				catch( ex ) {
				}
			}

		}, 100 );
	}

	/**
	 * Rebuilds the dynamic properties in the metadata card.
	 *
	 * @param iterationCounter The iteration counter. Used to limit iterations if there are circular references.
	 * @param classChanged True when called after class change.
	 * @param addedProperty Added property definition or -1 if no property is added.
	 * @return started True if processing of dynamic properties was started.
	 */
	this.rebuildDynamicProperties = function( iterationCounter, classChanged, addedProperty ) {
		
		// Rebuild dynamic properties in the native model.
		// This triggers potentially a new call to onAfterContentUpdated, which is received with dpInProgress true.
		
		// Write to log.
		utilities.log( "Calling model rebuild, iterationCounter = " + iterationCounter, { "showTimestamp" : true } );
		
		// Call model to start rebuilding.
		var started = this.metadatacard.controller.editor.Datamodel.Rebuild( iterationCounter, classChanged, addedProperty );
		
		// Write to log.
		utilities.log( "After model rebuild, started = " + started, { "showTimestamp" : true } );

		// Set flag to tell that processing of dynamic properties is ongoing.
		if( started )
			this.dpInProgress = true;
			
		// Return information whether processing of dynamic properties was started.
		return started;
	}
	
	/**
	 * Sets property priorities.
	 *
	 * @param configuration The configuration object. 
	 */
	this.setPropertyPriorities = function( configuration ) {
	
		// Set normal property priorities.
		var propertyPriorities = this.getPropertyConfiguration( "Priority", configuration, false );
		if( propertyPriorities )
			this.metadatacard.localModel.setPropertyPriorities( propertyPriorities );
		else
			this.metadatacard.localModel.setPropertyPriorities( null );
		
		// Set after-rules for specifying that the property control should be located after specified property.		
		var afterRules = this.getPropertyConfiguration( "After", configuration, false );
		if( afterRules ) {
		
			// Validate and convert aliases from the rules.
			var processedRules = {};
			for( var i in afterRules ) {
				
				// Check type of the parameter.
				var rule = afterRules[ i ];
				if( typeof rule === "number" )
					processedRules[ i ] = [ rule ];
				else if( typeof rule === "string" ) {
				
					// Get property definition id from the string.
					this.getIdFromParameter( rule, "PropertyDefinition", -1, function( id ) {
						processedRules[ i ] = [ id ];
					} );
				}
				else if( Object.prototype.toString.call( rule ) === '[object Array]' ) {
    
					// Parameter is array. Parse each item.
					var result = [];
					for( var j = 0; j < rule.length; j++ ) {
						var item = rule[ j ];
						
						// Parse this item.
						if( typeof item === "number" )
							result.push( item );
						else if( typeof item === "string" ) {
						
							// Get property definition id from the string.
							this.getIdFromParameter( item, "PropertyDefinition", -1, function( id ) {
								result.push( id );
							} );
						}
					}
					processedRules[ i ] = result;
				}
			}
			this.metadatacard.localModel.setAfterRules( processedRules );
		}
		else
			this.metadatacard.localModel.setAfterRules( null );
	}
	
	/**
	 * Sets hidden properties.
	 *
	 * @param configuration - The configuration object. 
	 */
	this.setHiddenProperties = function( configuration ) {
	
		// Set hidden properties.	
		var hiddenProperties = this.getPropertyConfiguration( "IsHidden", configuration, false );
		if( hiddenProperties )
			this.metadatacard.localModel.setHiddenProperties( hiddenProperties );
		else
			this.metadatacard.localModel.setHiddenProperties( null );
	}
	
	/**
	 * Sets read-only properties.
	 *
	 * @param configuration - The configuration object. 
	 */
	this.setReadOnlyProperties = function( configuration ) {
	
		// Set read-only properties.	
		var readOnlyProperties = this.getPropertyConfiguration( "IsReadOnly", configuration, false );
		if( readOnlyProperties )
			this.metadatacard.localModel.setReadOnlyProperties( readOnlyProperties );
		else
			this.metadatacard.localModel.setReadOnlyProperties( null );
	}
	
	/**
	 * Sets property groups.
	 *
	 * @param configuration - The configuration object. 
	 */
	this.setPropertyGroups = function( configuration ) {
	
		// Set property groups.
		var groupConfiguration = configuration[ "Groups" ];
		if( groupConfiguration ) {
		
			// Get all properties that belong to any group.
			var properties = this.getPropertyConfiguration( "Group", configuration, false );
			
			// Get all properties with special priorities.
			var priorities = this.getPropertyConfiguration( "Priority", configuration, false );
			
			// Arrange properties to priority order.
			// This is needed to ensure that related UI controls are added in correct order to group when property view is rebuilt. 
			var sortedPropertyList = [];
			for( var propertyDef in properties ) {
			
				// Get priority for the property.
				var priority = 1000;
				if( priorities.hasOwnProperty( propertyDef ) )
					priority = priorities[ propertyDef ];
			
				// Create item.
				var item = {
					propertyDef: propertyDef,
					groupId: properties[ propertyDef ],
					priority: priority
				}
			
				// Search an item with higher priority and insert new item before it.
				var found = false;
				for( var i = 0; i < sortedPropertyList.length; i++ ) {
				
					// Get item and compare its priority.
					var currentItem = sortedPropertyList[ i ];
					if( currentItem.priority > priority ) {
				
						// An item with higher priority found.
						// Insert a new item before the item with higher priority.
						sortedPropertyList.splice( i, 0, item );
						found = true;
						break;
					}
				}
				// If item with higher priority was not found, add the item to the end of the sorted list.
				if( !found )
					sortedPropertyList.push( item );
			}
			
			// Loop through all arranged properties (that belong to any group) and arrange them under own groups.
			var groups = {};
			for( var i = 0; i < sortedPropertyList.length; i++ ) {
				
				// Get current property.
				var item = sortedPropertyList[ i ];
					
				// If group doesn't exist, create it.
				if( !groups[ item.groupId ] )			
					groups[ item.groupId ] = [];
			
				// Add the property to the group.
				groups[ item.groupId ].push( item.propertyDef );
			}
		
			// Validate and process the group data.
			var groupData = this.validateAndProcessGroupData( groupConfiguration, groups );
			
			// TODO: Check that all used groups are defined in the configuration. 
			
			// Set groups.
			this.propertyGrouping.setConfiguration( groupData );
		}
		else
			this.propertyGrouping.setConfiguration( null );
	}
	
	/**
	 * Validates and processes the group data.
	 *
	 * @param groupConfiguration The group configuration.
	 * @param groups Current groups. Each group contains MF properties belonging to the group. 
	 * @return Processed groups.
	 */
	this.validateAndProcessGroupData = function( groupConfiguration, groups ) {
	
		// Loop through all groups in the configuration and add corresponding properties.
		// Save groups (with properties) to separate array in priority order.
		var result = [];
		for( var i in groupConfiguration ) {
		
			var group = groupConfiguration[ i ];
			group.properties = groups[ i ];
			
			// Set property definitions.
			if( groups.hasOwnProperty( i ) )
				group.properties = groups[ i ];
			else
				group.properties = [];

			// Validate the configuration and set default values for missing parts of the group data.
			
			// Title.
			if( group.hasOwnProperty( "Title" ) ) {
			
				// Parse title content.	Don't allow HTML tags.
				group.title = this.parseContentString( group[ "Title" ], true, false );	
			}

			// Tooltip.
			if( group.hasOwnProperty( "Tooltip" ) ) {
			
				// Parse tooltip content.
				// Note: tooltips are not encoded, because HTML content is shown as is with tooltips.				
				group.tooltip = this.parseContentString( group[ "Tooltip" ], false, true );
			}
			
			// Is collapsible.
			if( !group.hasOwnProperty( "IsCollapsible" ) )
				group[ "IsCollapsible" ] = true;
			else if( group[ "IsCollapsible" ] !== true && group[ "IsCollapsible" ] !== false )
				alert( "IsCollapsible: Invalid value" );
			
			// Collapsed by default.
			if( !group.hasOwnProperty( "IsCollapsedByDefault" ) )
				group[ "IsCollapsedByDefault" ] = false;
			else if( group[ "IsCollapsedByDefault" ] !== true && group[ "IsCollapsedByDefault" ] !== false )
				alert( "IsCollapsedByDefault: Invalid value" );	
				
			// Has header.
			if( !group.hasOwnProperty( "HasHeader" ) )
				group[ "HasHeader" ] = true;
			else if( group[ "HasHeader" ] !== true && group[ "HasHeader" ] !== false )
				alert( "HasHeader: Invalid value" );
			
			// Is default.
			if( !group.hasOwnProperty( "IsDefault" ) )
				group[ "IsDefault" ] = false;
			else if( group[ "IsDefault" ] !== true && group[ "IsDefault" ] !== false )
				alert( "IsDefault: Invalid value" );
			
			// Is hidden.
			if( !group.hasOwnProperty( "IsHidden" ) )
				group[ "IsHidden" ] = false;
			else if( group[ "IsHidden" ] !== true && group[ "IsHidden" ] !== false )
				alert( "IsHidden: Invalid value" );
			
			// Use default priority for the group or read specified priority from the configuration.
			var groupPriority = 1000;
			if( group.hasOwnProperty( "Priority" ) ) {
				groupPriority = group[ "Priority" ];
			}
			
			// Is the whole group read-only.
			if( !group.hasOwnProperty( "IsReadOnly" ) )
				group[ "IsReadOnly" ] = false;
			else if( group[ "IsReadOnly" ] !== true && group[ "IsReadOnly" ] !== false )
				alert( "IsReadOnly: Invalid value" );

			// Add groups to array in priority order.
			// First group in the array has lowest priority.
	
			// Search a group with higher priority and insert new group before it.
			var found = false;
			for( var j = 0; j < result.length; j++ ) {
			
				// Get group and compare its priority.
				var currentGroup = result[ j ];
				var currentGroupPriority = 1000;
				if( currentGroup.hasOwnProperty( "Priority" ) ) {
					currentGroupPriority = currentGroup[ "Priority" ];
				}
				if( currentGroupPriority > groupPriority ) {
				
					// A group with higher priority found.
					// Insert a new group before the group with higher priority.
					result.splice( j, 0, group );
					found = true;
					break;
				}
			}
			
			// If group with higher priority was not found, add the new group to the end of the sorted list.
			if( !found )
				result.push( group );
		}
		return result;
	}
	
	/**
	 * Sets dynamic properties.
	 *
	 * @param configuration - The configuration object.
	 * @param passedRules - Array of currently passed rules.
	 * @param skipSetValues - True to skip set values. 
	 */
	this.setDynamicProperties = function( configuration, passedRules, skipSetValues ) {
		
		// Copy additional properties to the array.
		var additionalPropDefs = [];
		var additionalProperties = this.getPropertyConfiguration( "IsAdditional", configuration, false );
		for( var i in additionalProperties ) {

			// If the value of isAdditional is true, copy it to the array.
			if( additionalProperties[ i ] === true ) {
			
				// Copy propertyDef to the array.
				var propertyDef = parseInt( i + "", 10 );
				additionalPropDefs.push( propertyDef );
			}
		}
		// Set additional properties.
		metadatacard.controller.editor.DataModel.SetAdditionalPropertyDefs( additionalPropDefs );
		
		// Write to log.
		//utilities.log( "Additional property definitions = " + JSON.stringify( additionalPropDefs ) , true );
		
		// Copy required properties to the array.
		var requiredPropDefs = [];
		var requiredProperties = this.getPropertyConfiguration( "IsRequired", configuration, false );
		for( var i in requiredProperties ) {

			// If the value of isRequired is true, copy it to the array.
			if( requiredProperties[ i ] === true ) {
			
				// Copy propertyDef to the array.
				var propertyDef = parseInt( i + "", 10 );
				requiredPropDefs.push( propertyDef );
			}
		}
		// Set required properties.
		metadatacard.controller.editor.Datamodel.SetRequiredPropertyDefs( requiredPropDefs );
		
		// Write to log.
		//utilities.log( "Required property definitions = " + JSON.stringify( requiredPropDefs ) , true );
		
		// Copy unevaluated values to the array.
		var unevaluatedValues = [];
		for( var i = 0; i < passedRules.length; i++ ) {
			
			// Handle this rule.
			var rule = passedRules[ i ];
			
			// Get rule behavior.
			var behavior = rule.behavior;
			var setValues = this.getPropertyConfiguration( "SetValue", behavior, false );
			for( var j in setValues ) {
			
				// Parse set value and additional parameters from the data.
				var item = setValues[ j ];
				
				// Get property definition.
				var propertyDef = this.getIdFromParameter( j, "PropertyDefinition", -1 );
				if( propertyDef !== undefined ) {
				
					// Initialize parameters.
					var parameters = {};
					parameters.propertyDef = propertyDef;
					parameters.overwrite = false;
					parameters.isNull = false;
					parameters.defaultValue = null;
					parameters.isNewValue = rule.isNewRule;
					
					// Special parameters for date and time.
					parameters.useCurrentTime = false;
					parameters.delta = 0;
					
					// Parse set value.
					var result = this.parseSetValue( item, parameters, true );
					unevaluatedValues.push( JSON.stringify( result ) );
				}
			}
		}
		// Set new unevaluated values.
		if( !skipSetValues )
			this.metadatacard.controller.editor.Datamodel.SetUnevaluatedPropertyValues( unevaluatedValues );
		
		// Copy custom placeholders to the array.
		var customPlaceholders = [];
		for( var i = 0; i < passedRules.length; i++ ) {

			// Handle this rule.
			var rule = passedRules[ i ];
			if( rule.isNewRule )
			{
				// Get rule behavior.
				var behavior = rule.behavior;

				// Loop all placeholders.
				var placeholders = behavior[ "CustomPlaceholders" ];
				for( var j in placeholders ) {
					var searchCondition = placeholders[ j ][ "SearchCondition" ];

					// Handle this placeholder.
					var placeholder = {};
					placeholder.placeholder = j;

					// Get object type from search condition.
					placeholder.objectType = searchCondition[ "ObjectType" ];
					
					// Get properties and their values from search condition.
					var properties = searchCondition[ "Properties" ];
					for( var k in properties ) {
					
						// TODO: Fix this. Now we get only one (latest) property/value condition. 
						var property = properties[ k ];
						placeholder.propertyDef = k;
						placeholder.propertyValue = property;
					}
					customPlaceholders.push( JSON.stringify( placeholder ) );
				}
			}
		}
		// Set new custom placeholders only if there are any. TODO: Change model so that it can handle overlapping placeholders.
		if( customPlaceholders.length > 0 )
			this.metadatacard.controller.editor.Datamodel.SetCustomPlaceholders( customPlaceholders );
	}
	
	/**
	 * Sets property appearance: tooltip, description and label texts.
	 *
	 * @param configuration - The configuration object.
	 */
	this.setPropertyAppearance = function( configuration ) {
	
		// Loop all items.
		var items = [ "Tooltip", "Description", "Label" ];
		for( var i = 0; i < items.length; i++ ) {
			
			// Process each item and set corresponding text.
			var item = items[ i ];
			var conf = this.getPropertyConfiguration( item, configuration, true );
			if( conf )
				this.metadatacard.setPropertyTexts( item, conf );
			else
				this.metadatacard.setPropertyTexts( item, null );
		}
	}
	
	/**
	 * Sets custom UI controls for properties.
	 *
	 * @param configuration - The configuration object.
	 */
	this.setCustomUIControls = function( configuration ) {

		// Set custom UI controls.
		var uiControls = this.getPropertyConfiguration( "Control", configuration, false );
		this.metadatacard.setCustomUIControls( uiControls );
	}	
	
	/**
	 * Sets property parameters.
	 *
	 * @param configuration - The configuration object.
	 */
	this.setPropertyParameters = function( configuration ) {
	
		// Reset current property parameters.
		this.propertyParameters = {};
	
		// Loop all allowed parameter names.
		var parameterNames = [ "singleLine", "AutoEmptyLine" ];
		for( var i = 0; i < parameterNames.length; i++ ) {
		
			// Process each parameter name.
			var parameterName = parameterNames[ i ];
			var parameters = this.getPropertyParameterConfiguration( parameterName, configuration );
			this.propertyParameters[ parameterName ] = parameters;
		}
	}
	
	/**
	 * Returns value of the requested property parameter or undefined if not found.
	 *
	 * @param propertyDef - Property definition id of the requested property.
	 * @param parameterName - Name of the requested property parameter.
	 * @return A Value of the requested property parameter.
	 */
	this.getPropertyParameterValue = function( propertyDef, parameterName ) {
	
		// If requested parameter doesn't exist, return undefined.
		if( !this.propertyParameters.hasOwnProperty( parameterName ) )
			return undefined;
			
		// If parameter value for requested property definition doesn't exist, return undefined. 	
		var propertyParameter = this.propertyParameters[ parameterName ];
		if( !propertyParameter || !propertyParameter.hasOwnProperty( propertyDef ) )
			return undefined;
			
		// Return value of the requested parameter.	
		return propertyParameter[ propertyDef ];
	}
	
	/**
	 * Sets description for the metadata card.
	 *
	 * @param configuration - The configuration object. 
	 */
	this.setMetadatacardDescription = function( configuration ) {
	
		// Get description data.
		var description = this.getMetadataCardConfiguration( "Description", configuration );
		
		// Parse description text from the data.
		var encodedText = this.parseContentString( description, true, true );
		
		// Get image parameters.
		var imageUrl = ( description && description[ "Image" ] && description[ "Image" ][ "Url" ] ) ? description[ "Image" ][ "Url" ] : null;
		var width = ( description && description[ "Image" ] && description[ "Image" ][ "Width" ] ) ? description[ "Image" ][ "Width" ] : 100;
		var height = ( description && description[ "Image" ] && description[ "Image" ][ "Height" ] ) ? description[ "Image" ][ "Height" ] : 100;
		
		// Set description text and image for the metadata card.
		this.metadatacard.setMetadatacardDescription( encodedText, imageUrl, width, height );
	}
	
	/**
	 * Sets tooltips for the value list items.
	 *
	 * @param configuration - The configuration object. 
	 */
	this.setValueListTooltips = function( configuration ) {
	
		// Get value list tooltips and delegate.
		var valueListTooltips = this.getValueListConfiguration( "Tooltip", configuration );
		this.metadatacard.setValueListTooltips( valueListTooltips );
	}
	
	/**
	 * Method to search requested value based on key.
	 * If the requested key is found, callback function is called with value of the found key.
	 * If no callback function is given, function returns the value of found property or null.
	 *
	 * @param propertyName - The JS property name. Nested properties/objects are divided by dot. For example: "MetadataCard.Theme.PropertySelector.Visibility".
	 * @param callback - The callback function to call.
	 *
	 * @return Value of found property or null.
	 */
	this.get = function( key, callback ) {
		
		// Delegate.
		return this.configurationHelper.get( key, callback );
	}
	
	/**
	 * Method to search requested JS property from current configuration object and compare it.
	 * If the requested property exists and its value is equal to the second parameter,
	 * function returns true, otherwise false.
	 *
	 * @param propertyName - The JS property name. Nested properties/objects are divided by dot. For example: "MetadataCard.Theme.PropertySelector.Visibility".
	 * @param value - The value to compare.
	 *
	 * @return True, if value of requested property matches to value to compare.
	 */
	this.is = function( propertyName, value ) {
		
		// Delegate.
		return this.configurationHelper.is( propertyName, value );
	}
	
	/**
	 * Method to search requested JS property from current configuration object and compare it.
	 * If the requested property exists and its value is NOT equal to the second parameter,
	 * function returns true, otherwise false.
	 *
	 * @param propertyName - The JS property name. Nested properties/objects are divided by dot. For example: "MetadataCard.Theme.PropertySelector.visibility".
	 * @param value - The value to compare.
	 *
	 * @return True, if value of requested property DOES NOT match to value to compare.
	 */
	this.isNot = function( propertyName, value ) {
	
		// Delegate.
		return this.configurationHelper.isNot( propertyName, value );
	}

	/**
	 * Returns rules to define metadata card configurability.
	 *
	 * @return rules - The rules to define metadata card configurability.
	 */
	this.getRules = function() {
	
		// Return cached rules if available.	
		if( this.cachedRules )
			return this.cachedRules;
		else {
		
			// Check that configurability is enabled.
			if( this.configurabilityEnabled ) {
			
				// Configurability enabled. Get configuration rules from the server.
				// Note: Named value storage cache is used. So, it is possible to get named values from this namespace also in offline mode.
				var rules = {};
				var vault = this.metadatacard.controller.getVault();
				var namedValues = vault.NamedValueStorageOperations.GetNamedValues( MFiles.MFNamedValueType.ConfigurationValue, this.configurationNamespace );
				if( namedValues ) {
					
					// Loop through all found rule sets and use them. If none was found, use empty rules.
					var names = namedValues.Names;
					var count = names.length;
					for( var i = 0; i < count; i++ ) {
					
						// TODO: This gets only primary ruleset. Change implementation so that all rule sets are merged. 
						var name = names[ i ];
						if( name === this.primaryRuleSet ) {
						
							var data = namedValues.Value( name );
							if( data && data.length > 0 ) {
							
								// Parse stringified data.
								var ruleSet = JSON.parse( data );
								
								// If version is correct, get rules.
								if( ruleSet.version === this.configurationVersion )
									rules = ruleSet.rules;
							}
						}
					}
				}
				
				// Sort rules by priority.
				var sortedRules = this.sortRulesByPriority( rules );
				
				// Set cached rules and return them.
				this.cachedRules = sortedRules;
				return sortedRules;
					
			}  // Configurability enabled.
			
			// Configurability not enabled. Return empty rules.
			return [];
		}
	}
	
	/**
	 * Returns property configuration based on requested definition.
	 *
	 * @param definition The behavior definition, e.g. "tooltip".
	 * @param configuration The configuration object.
	 * @param returnStringified If true, returns the value as string. Otherwise as javaScript object.
	 * @return The property configuration.
	 */
	this.getPropertyConfiguration = function( definition, configuration, returnStringified ) {
	
		// Get configuration for properties.
		var propertyConfiguration = configuration[ "Properties" ];
		var result = {};
		for( var i in propertyConfiguration ) {
		
			var conf = propertyConfiguration[ i ];
			if( conf.hasOwnProperty( definition ) ) {
			
				// Get data.
				var data = conf[ definition ];
					
				// Parse content if it represents string.
				if( returnStringified )	{
				
					// Parse content.
					// Note: tooltips are not encoded, because HTML content is shown as is with tooltips.				
					var encode = ( definition !== "Tooltip" ) ? true : false;					
					data = this.parseContentString( data, encode, true );
				}
				
				// Return data.
				result[ i ] = data;
			}
		}
		return result;
	}
	
	/**
	 * Returns property parameter configuration based on requested definition.
	 *
	 * @param definition The definition of property parameter, e.g. "singleLine".
	 * @param configuration The configuration object.
	 * @return The property configuration.
	 */
	this.getPropertyParameterConfiguration = function( definition, configuration ) {
	
		// Get configuration for properties.
		var propertyConfiguration = configuration[ "Properties" ];
		var result = {};
		for( var i in propertyConfiguration ) {
		
			// If this property has requested parameter, copy it to result array. 
			var conf = propertyConfiguration[ i ];
			if( conf.hasOwnProperty( definition ) )
				result[ i ] = conf[ definition ];
			else {
				// Not found. If the string starts with lowercase letter, convert it to uppercase and search again.
				var first = definition.charAt( 0 );
				if( first === first.toLowerCase() && first !== first.toUpperCase() )
				{
					// Convert first char to uppercase and do search again.
					var capitalizedDefinition = first.toUpperCase() + definition.slice( 1 );
					if( conf.hasOwnProperty( capitalizedDefinition ) )
						result[ i ] = conf[ capitalizedDefinition ];
				}
			}
		}
		return result;
	}
	
	 /**
	 * Returns metadata card configuration based on requested definition.
	 *
	 * @param definition The behavior definition, e.g. "description".
	 * @param configuration The configuration object.
	 * @return The metadata card configuration.
	 */
	this.getMetadataCardConfiguration = function( definition, configuration ) {
	
		var conf = configuration[ "MetadataCard" ];
		if( conf ) {
			if( conf.hasOwnProperty( definition ) )
				return conf[ definition ];
		}
		return null
	}
	
	/**
	 * Returns value list configuration based on requested definition.
	 *
	 * @param definition The behavior definition, e.g. "tooltip".
	 * @param configuration The configuration object.
	 * @return The value list configuration.
	 */
	this.getValueListConfiguration = function( definition, configuration ) {
	
		// Get value lists and loop through them.
		var valueLists = configuration[ "ValueLists" ];
		var result = {};
		for( var i in valueLists ) {
		
			// Get this value list and loop through its value list items.
			var valueList = valueLists[ i ][ "Items" ];
			for( var j in valueList ) {
			
				// Get this value list item and check if it has requested definition. 
				var valueListItem = valueList[ j ];
				if( valueListItem.hasOwnProperty( definition ) ) {
				
					// Parse and copy requested definition to the result. 
					var data = valueListItem[ definition ];
					data = this.parseContentString( data, true, true );
					if( !result.hasOwnProperty( i ) )
						result[ i ] = {};
					result[ i ][ j ] = data;
				}
			}
		}
		return result;
	}
	
	/**
	 * Resolves current behavior based on metadata of selected objects.
	 * Fills arrays of passed and new rules.
	 *
	 * @param passedRules - Receives array of currently passed rules.
	 * @return behavior - The current behavior based on passed rules.
	 * 	In practice the returned behavior is combination of behaviors of all passed rules.	 
	 */
	this.resolveCurrentBehavior = function( passedRules ) {
	
		// Get metadata of selected objects.
		var objectData = this.metadatacard.controller.getObjectData();
		var behavior = {};
		
		try {
			// Get all rules.
			var sortedRules = this.getRules();
			
			// Evaluate rules based on metadata of selected objects.
			this.evaluateRules( objectData, sortedRules, behavior, passedRules, null, false, false, null, null );
			
			// Loop through passed rules and check which of them are new (which were not effective earlier).
			for( var i = 0; i < passedRules.length; i++ ) {
				
				// Check this rule and set flag to true if this is a new rule.
				var rule = passedRules[ i ];
				if( !this.currentRules.hasOwnProperty( rule.key ) )
					passedRules[ i ].isNewRule = true;
				else
					passedRules[ i ].isNewRule = false;
			}
			
			// Update currently passed rules.
			var passedKeys = [];
			this.currentRules = {};
			for( var i = 0; i < passedRules.length; i++ ) {
				
				// Add this rule.
				var key = passedRules[ i ].key;
				this.currentRules[ key ] = true;
				passedKeys.push( key );
			}

			// Update also keys of passed rules as a string.
			this.passedKeysAsString = JSON.stringify( passedKeys );
		}
		catch( ex ) {
		
			alert( "Exception in resolveCurrentBehavior: " + ex );
		}
		
		// Return behavior which contains behaviors of all passed rules.
		return behavior;
	}
	
	/**
	 * Resolves behavior based on metadata of selected objects and trigger event.
	 *
	 * @param objectData - The metadata from selected object.
	 * @param event - The trigger event or null.
	 * @param propertyDef - The property definition ID of changed property or null.
	 * @return behavior - The behavior based on event rules.
	 * 	In practice the returned behavior is combination of behaviors of all passed rules.	 
	 */
	this.resolveEventBehavior = function( objectData, event, propertyDef ) {
	
		// Initialize.
		var result = {};
		result.behavior = {};
		
		try {
			// Get all rules.
			var sortedRules = this.getRules();
			
			// Evaluate rules based on metadata of selected objects.
			this.evaluateRules( objectData, sortedRules, result.behavior, null, propertyDef, false, true, event, result );
		}
		catch( ex ) {
		
			alert( "Exception in resolveEventBehavior: " + ex );
		}
		
		// Return behavior which contains behaviors of all passed rules.
		return result;
	}
	
	/**
	 * Returns true, if passed rules are changed.
	 *
	 * @param changedPropertyDef - The property definition ID of changed property.
	 * @param considerIndirectChanges - If true, this event might be caused by indirect changes, e.g. auto-filling of properties.
	 *        In this case we should check whether the rule condition allows triggering based on indirect changes.
	 * @return changed - True, if passed rules are changed.
	 */
	this.passedRulesChanged = function( changedPropertyDef, considerIndirectChanges ) {
	
		// Get metadata of selected objects.
		var objectData = this.metadatacard.controller.getObjectData();
		var changed = false;
		try {
		
			// Get all rules.
			var passedRules = [];
			var sortedRules = this.getRules();
			
			// Evaluate rules based on metadata of selected objects.
			var behavior = {};
			this.evaluateRules( objectData, sortedRules, behavior, passedRules, changedPropertyDef, considerIndirectChanges, false, null, null );
			var passedKeys = [];
			for( var i = 0; i < passedRules.length; i++ ) {
				
				// Add this rule.
				var key = passedRules[ i ].key;
				passedKeys.push( key );
			}
			
			// Compare keys of passed rules to previous keys to know if rules are changed.
			var passedKeysAsString = JSON.stringify( passedKeys );
			if( passedKeysAsString !== this.passedKeysAsString ) {
			
				// Rules are changed.
				changed = true;
				this.passedKeysAsString = passedKeysAsString;
			}
		}
		catch( ex ) {
		
			alert( "Exception in passedRulesChanged: " + ex );
		}
		return changed;
	}
	
	/**
	 * Evaluates all rules recursively and fills given behaviors object by behaviors of passed rules.
	 * Fills array of passed rules.
	 *
	 * @param objectData Metadata of selected objects.
	 * @param sortedRules Rules to evaluate.
	 * @param behaviors The behaviors object to fill.
	 * @param passedRules - Receives array of currently passed rules if not null.
	 * @param changedPropertyDef - The property definition ID of changed property.
	 * @param considerIndirectChanges - If true, this event might be caused by indirect changes, e.g. auto-filling of properties.
	 *        In this case we should check whether the rule condition allows triggering based on indirect changes.
	 * @param processEventRules - True to process event rules, false to reject them.
	 * @param event - Explains why fetching of metadata suggestions has been requested.
	 * @param result - Receives additional information about evaluation.
	 */
	this.evaluateRules = function( objectData, sortedRules, behaviors, passedRules, changedPropertyDef, considerIndirectChanges, processEventRules, event, result ) {
		
		// Process all rules.
		for( var i = 0; i < sortedRules.length; i++ ) {
		
			// Process this rule.
			var rule = sortedRules[ i ];
			var key = rule.key;
			var filter = null;
			try {
			
				// Get filter condition of this rule. Filter condition is in stringified format. 
				filter = JSON.parse( rule.filter );
			}
			catch( ex ) {
				alert( "JSON.parse failed for filter: " + rule.filter );
			}
			
			// Evaluate this filter condition.
			var passed = this.evaluateRule( objectData, filter, changedPropertyDef, considerIndirectChanges, processEventRules, event, result );
			if( passed ) {
						
				// Filter condition passed, get corresponding behavior, which is also in stringified format.
				var behavior = null;
				try {
					behavior = JSON.parse( rule.behavior );
				}
				catch( ex ) {
					alert( "JSON.parse failed for behavior: " + rule.behavior );
				}
				
				// Ensure that parameter is valid array.
				if( passedRules && $.isArray( passedRules ) ) {
				
					// Add rule to list of passed rules.
					passedRules.push( {
						key: key,
						behavior: $.extend( true, {}, behavior ) // Make a deep clone of behavior object.
					} );
				}
				
				// Apply new behavior to existing behaviors.
				this.applyBehavior( behaviors, behavior );
				
				// Check if we have possible child rules.
				if( rule.hasOwnProperty( "sortedRules" ) ) {
					
					// Evaluate child rules recursively.
					this.evaluateRules( objectData, rule.sortedRules, behaviors, passedRules, changedPropertyDef, considerIndirectChanges, processEventRules, event, result );
				}
			}
		}
	}
	
	/**
	 * Evaluates single rule.
	 *
	 * @param objectData Metadata of selected objects.
	 * @param filter Filter condition to evaluate.
	 * @param changedPropertyDef - The property definition ID of changed property.
	 * @param considerIndirectChanges - If true, this event might be caused by indirect changes, e.g. auto-filling of properties.
	 *        In this case we should check whether the rule condition allows triggering based on indirect changes.
	 * @param processEventRules - True to process event rules, false to reject them.
	 * @param event - Explains why fetching of metadata suggestions has been requested.
	 * @param result - Receives additional information about evaluation.
	 */
	this.evaluateRule = function( objectData, filter, changedPropertyDef, considerIndirectChanges, processEventRules, event, result ) {
	
		try {
		
			// Check event.
			if( filter.hasOwnProperty( "Event" ) ) {
			
				// Check if we should skip evaluating of event rules.
				if( !processEventRules )
					return false;

				// Return false if marching event rule is not found.
				if( !this.findEventFromCondition( filter, event, changedPropertyDef ) )
					return false;
				
				// Set result.
				if( result && typeof result === "object" )	
					result.eventRulePassed = true;
			}
		
			// Check object type id.
			if( filter.hasOwnProperty( "ObjectType" ) ) {

				// Get object type operator.
				var objectTypeOperator = "";
				if( filter.hasOwnProperty( "ObjectTypeOperator" ) )
					objectTypeOperator = filter[ "ObjectTypeOperator" ];

				// Get object type id. Multiple object types are not supported. 
				var objectTypeId = objectData.objectTypeId;
				if( objectTypeId.IsMultiValue )
					return false;

				// Check object type id.
				var equal = this.isEqual( filter, objectTypeId, "ObjectType" );
				if( equal && objectTypeOperator === "isNoneOf" )
					return false;  // Equal object type found but "isNoneOf" operator used.
				else if( !equal && objectTypeOperator !== "isNoneOf" )
					return false;  // No equal object type found but "isAnyOf" or empty operator used.
			}
			
			// Check class id.
			if( filter.hasOwnProperty( "Class" ) ) {

				// Get class operator.
				var classOperator = "";
				if( filter.hasOwnProperty( "ClassOperator" ) )
					classOperator = filter[ "ClassOperator" ];

				// Get class id.
				var classId = objectData.classId;

				// Multiple classes are not supported.
				if( classId && classId.IsMultiValue ) {
					return false;
				}				
				
				// If user hasn't selected any class when creating new object, we must compare to null.
				var valueToCompare = null;
				if( classId )
					valueToCompare = classId.Item;
			
				// Check class id.
				var equal = this.isEqual( filter, valueToCompare, "Class" );
				if( equal && classOperator === "isNoneOf" )
					return false;  // Equal class found but "isNoneOf" operator used.
				else if( !equal  && classOperator !== "isNoneOf" )
					return false;  // No equal class found but "isAnyOf" or empty operator used.
			}
		
			// Check if property conditions in the filter rule are passed. Only lookup controls are checked.
			if( filter.hasOwnProperty( "Properties" ) ) {
			
				// Loop through all property conditions.
				var propertyConditions = filter[ "Properties" ];
				for( var propertyDef in propertyConditions ) {
				
					// Check property definition id.
					if( typeof propertyDef === "string" ) {
						
						// Try to get property definition id from the string.
						var id = this.getIdFromParameter( propertyDef, "PropertyDefinition", -1 );
						if( id === undefined )
							return false;
								
						// Get this property condition.
						var propertyCondition = propertyConditions[ propertyDef ];
						
						// If evaluation was triggered based on change to property value, check if we have condition for this property.
						if( changedPropertyDef !== null && changedPropertyDef === id ) {
						
							// If this event might be caused by indirect changes, e.g. auto-filling of properties, we must ensure that
							// triggering by indirect changes is allowed.
							if( considerIndirectChanges ) {
							
								// Check whether triggering by indirect changes is allowed.
								var indirectTriggerAllowed = false;
								if( propertyCondition && typeof propertyCondition === "object" && propertyCondition[ "AllowIndirect" ] === true )
									indirectTriggerAllowed = true;
							
								// If triggering by indirect changes is NOT allowed, return here.
								if( !indirectTriggerAllowed )
									return false;
							}
						}
						
						// Evaluate the property condition.
						var passed = this.evaluatePropertyCondition( objectData.properties, propertyCondition, id );
						if( !passed )
							return false;
					}
					else
						return false;
				}
			}	

		} catch( ex ) {
	
			alert( "FAIL: " + JSON.stringify( ex ) );
		}
		return true;
	}
	
	/**
	 * Applies new behavior to existing behaviors.
	 *
	 * @param existingBehaviors The existing behaviors.
	 * @param behaviorToApply The behavior to apply.
	 */
	this.applyBehavior = function( existingBehaviors, behaviorToApply ) {
		
		// Apply behavior of "Properties" category.
		this.applyBehaviorCategory( "Properties", existingBehaviors, behaviorToApply, true );
	
		// Apply behavior of "Groups" category.
		this.applyBehaviorCategory( "Groups", existingBehaviors, behaviorToApply, true );

		// Apply behavior of "ValueLists" category.
		this.applyBehaviorCategory( "ValueLists", existingBehaviors, behaviorToApply, true );

		// Apply behavior of "MetadataCard" category.
		this.applyBehaviorCategory( "MetadataCard", existingBehaviors, behaviorToApply, false );
		
		// Apply behavior of "CustomPlaceholders" category.
		this.applyBehaviorCategory( "CustomPlaceholders", existingBehaviors, behaviorToApply, false );
	}
	
	/**
	 * Applies behavior category.
	 *
	 * @param behaviorCategory - The behavior category, e.g. "Properties" or "Groups".
	 * @param behaviors - Existing behavior object where new behavior is applied to.
	 * @param behaviorToApply - The behavior object to apply.
	 * @param copyOnlyNewFields - True to copy new fields to existing category, false to replace the whole category.
	 */
	this.applyBehaviorCategory = function( behaviorCategory, behaviors, behaviorToApply, copyOnlyNewFields ) {
	
		// If we don't have requested behavior category, copy it as is.
		if( !behaviors.hasOwnProperty( behaviorCategory ) ) {
		
			// Copy the requested behavior category.
			if( behaviorToApply.hasOwnProperty( behaviorCategory ) )
				behaviors[ behaviorCategory ] = behaviorToApply[ behaviorCategory ];
			else
				behaviors[ behaviorCategory ] = {};
		}
		else if( behaviorToApply.hasOwnProperty( behaviorCategory ) ) {
		
			// We have the requested behavior category. Apply all new items if requested category exists in behavior to apply.
			for( var itemId in behaviorToApply[ behaviorCategory ] ) {
				
				// Get item.
				var item = behaviorToApply[ behaviorCategory ][ itemId ];

				// If we don't have this item, copy it as is.
				if( !behaviors[ behaviorCategory ].hasOwnProperty( itemId ) ) {
				
					// Copy the item.
					behaviors[ behaviorCategory ][ itemId ] = item;
				}
				else {
									
					// We already have this item.

					// Copy only new fields if requested.
					if( copyOnlyNewFields ) {
					
						// Copy new fields.
						for( var fieldId in item )
							behaviors[ behaviorCategory ][ itemId ][ fieldId ] = item[ fieldId ];

					} else {

						// Ensure there is a value.
						if( item !== undefined && item !== null ) {

							// Now validate the type of the value.
							if( typeof( item ) !== "object" ) {

								// The type is not an object, so we need to place it into an object in order to use it in the $.extend call.
								var extendedData = {};
								extendedData[ itemId ] = item;

								// Now validate the type of the value we are to extend.
								if( typeof( behaviors[ behaviorCategory ][ itemId ] ) !== "object" ) {

									// This is not an object, as such it cannot be extended... So we extend its parent container.
									$.extend( true, behaviors[ behaviorCategory ], extendedData );

								} else {

									// Safe the extend this object.
									$.extend( true, behaviors[ behaviorCategory ][ itemId ], extendedData );
								}

							} else {

								// The "item" is an object.

								// Now validate the type of the value we are to extend.
								if( typeof( behaviors[ behaviorCategory ][ itemId ] ) !== "object" ) {

									// This is not an object, as such it cannot be extended... So we extend its parent container object.
									$.extend( true, behaviors[ behaviorCategory ], item );

								} else {

									// Safe the extend this object.
									$.extend( true, behaviors[ behaviorCategory ][ itemId ], item );
								}
							}

						}
					}
				}
			}
		}
	}
		
	/**
	 * Returns true, if the given SSLU property exists for all selected objects.
	 *
	 * @param property The property to search.
	 * @returns True, if the given SSLU property exists for all selected objects.
	 */
	this.SSLUExistsForAllObjects = function( property ) {
	
		// The SSLU property exists for all selected objects if:
		//	- the property value is empty for all selected object OR
		//	- the property value is same for all selected object OR
		//  - the property has any value for all selected objects	
		var value = property.value;
		if( !value ) {
		
			// SSLU Property exists but is empty for all selected objects.
			return true;
		}
		else {
		
			// Value is not empty.
		
			// Check if we have a single value.
			if( value.item ) {
			
				// The property value is same for all selected object.
				return true;
			}
			else if( value.IsMultiValue ) {
			
				// There are several selected objects and as many valueParts as objects with requested property (with any value, including empty value).
				// If there are as many valueParts as selected objects, we know that all selected objects have the requested property.
				
				// Get number of valueParts.
				var valuePartCount = 0;
				var valueParts = value.ValueParts;
				for( var i in valueParts )
					valuePartCount++;
				
				// Return true if the property exists for all selected objects.
				return( valuePartCount === this.objVers.Count );
			}
			else {
			
				// This is called when we set SSLU to empty. TODO: implement handling for this.
				return false;
			}	
		}
		return false;
	}
		
	/**
	 * Initializes the configuration manager.
	 *
	 * @param enableConfigurability True to enable configurability.
	 */
	this.initialize = function( enableConfigurability ) {
	
		// Initialize property grouping.
		this.propertyGrouping = new PropertyGrouping( this.metadatacard );
		
		// Enable configurability if requested.
		this.configurabilityEnabled = enableConfigurability;
	}
	
	/**
	 * Returns the language of the vault.
	 *
	 * @return The language code of the vault.
	 */
	this.getVaultLanguage = function() {
	
		// If vault language is already available, return it.
		if( this.vaultLanguage )
			return this.vaultLanguage;
	
		// Get language from the vault.
		var vault = this.metadatacard.controller.getVault();
		this.vaultLanguage = vault.UserSettingOperations.GetVaultLanguageCode();

		// Return vault language.
		return this.vaultLanguage;
	}
	
	/**
	 * Returns the language of the client.
	 *
	 * @return The language code of the client.
	 */
	this.getClientLanguage = function() {
	
		// If client language is already available, return it.
		if( this.clientLanguage )
			return this.clientLanguage;
			
		// Get language from the client.	
		var client = new MFiles.MFilesClientApplication();
		this.clientLanguage = client.GetClientLanguage();
		
		// Return client language.
		return this.clientLanguage;
	}
	
	/**
	 * Tries to search and return localized string based on current language.
	 *
	 * @param data The data where to search localized strings from.
	 * @param isContentObject True, if the data parameter is already content object. False if the data parameter is object, which contains content-object.
	 * @return The localized string. 
	 */
	this.getLocalizedString = function( data, isContentObject ) {
	
		// Check whether the data contains localized strings.
		if( data && typeof data === "object" ) {
		
			// If data parameter is already content object, skip this check.
			if( !isContentObject ) {
		
				// Check if we have content-property and use it if available.
				// Otherwise, return empty string.
				if( data.hasOwnProperty( "Content" ) )
					data = data[ "Content" ];
				else
					return "";
			}
			
			// Ensure that we have localization object.
			if( data && typeof data === "object" ) {
			
				// Get current vault language and check if we have localized string for it. 
				var language = this.getVaultLanguage();	
				if( language && language.length > 0 && data.hasOwnProperty( language ) ) {
				
					// Localized string exists. Use it.
					data = data[ language ];
				}
				else {
				
					// No localized string found for the vault language.
					// Try to find by client language.
					language = this.getClientLanguage();
					if( data.hasOwnProperty( language ) ) {
				
						// Localized string exists. Use it.
						data = data[ language ];
					}
					else {
					
						// No localized string found for the client language.
						// Try to get first localized string. 
						var keys = Object.keys( data );
						if( keys.length > 0 )
							data = data[ keys[ 0 ] ];
						else {
							// Not any localized string found, use empty string.
							data = "";
						}
					}
				}
			}
		}		
		return data;
	}
	
	/**
	 * Parses content string from the configuration. In practice:
	 *		- gets localized version of the string if available
	 *		- Sanitizes possible HTML, which is not allowed
	 *		- processes allowed HTML tags so that they are rendered correctly
	 *
	 * @param data The configuration data.
	 * @param encode True to encode possible HTML.
	 * @param allowHtml True to allow certain HTML tags.
	 * @return data Part of the configuration data to handle.
	 */
	this.parseContentString = function( data, encode, allowHtml ) {
	
		var startTag = "&lt;";  // Less-than sign.
		var endTag = "&gt;";  // Greater-than sign.
	
		// Get localized string. We have object, which contains content-object as a property.
		data = this.getLocalizedString( data, false );
		
		// Sanitize possible HTML.
		if( encode )
			data = ( data ) ? utilities.htmlencode( data ) : null;
		
		// If data is found, process special tags. TODO: For tooltips, don't process...
		var result = null;
		if( data ) {
			
			// Search until all special tags are processed.
			var searching = true;
			while( allowHtml && searching ) {
				searching = false;
			
				// Search start tag.
				var current = data;
				var startIndex = current.indexOf( startTag );
				if ( startIndex !== -1 ) {
				
					// Start tag was found. Search end tag.
					var endIndex = current.indexOf( endTag );
					if( endIndex !== -1 && endIndex > startIndex ) {
						
						// End tag was found. Process HTML between found tags.
						var content = current.slice( startIndex + startTag.length, endIndex );
						var processedString = this.processHTMLTag( content );
						
						// Replace original text between tags by processes text.
						data = data.slice( 0, startIndex ) + processedString + data.slice( endIndex + endTag.length, data.length );
						searching = true;
					}					
				}
			}
			result = data;
		}
		return result;
	}
	
	/**
	 * Parses "set value" from the configuration.
	 *
	 * @param item The set value from the configuration.
	 * @param parameters Original set of parameters, that will be filled by this function.
	 * @return The set value as JSON string for the metadata model.
	 */
	this.parseSetValue = function( item, parameters, firstLevel ) {
	
		// Handle null and undefined values.
		if( item === null || item === undefined )
			parameters.isNull = true;
			
		// Handle arrays.
		else if( $.isArray( item ) ) {
		
			// The value is array. We assume that it contains value list items.
			parameters.defaultValue = self.parseValueListItems( parameters.propertyDef, item );
		}
		// Handle objects.
		else if( typeof item === "object" ) {
		
			// The value is object. Branch by level. 
			if( firstLevel ) {
			
				// Handle additional parameters, which are located in first level.
				
				// Read value of Overwrite parameter.
				if( item.hasOwnProperty( "Overwrite" ) && typeof item[ "Overwrite" ] === "boolean" && item[ "Overwrite" ] === true )
					parameters.overwrite = true;
				
				// Read value of IsForced parameter. We still support this earlier name of Overwrite parameter.
				if( item.hasOwnProperty( "IsForced" ) && typeof item[ "IsForced" ] === "boolean" && item[ "IsForced" ] === true )
					parameters.overwrite = true;

				// Handle date- and time-specific parameters, which are located in first level.			
				if( item.hasOwnProperty( "UseCurrentTime" ) && typeof item[ "UseCurrentTime" ] === "boolean" )
					parameters.useCurrentTime = true;
				if( item.hasOwnProperty( "UseCurrentDate" ) && typeof item[ "UseCurrentDate" ] === "boolean" )
					parameters.useCurrentTime = true;
				if( item.hasOwnProperty( "Delta" ) && typeof item[ "Delta" ] === "number" )
					parameters.delta = item[ "Delta" ];
					
				// Handle content-property recursively if available.
				if( item.hasOwnProperty( "Content" ) ) {
				
					// Handle actual value in Content-property by calling this function recursively. Note that we are no longer in the first level. 
					parameters = self.parseSetValue( item[ "Content" ], parameters, false );
				}
			}
			else {
			
				// We are no longer in the first level. Handle content object, which should have localized strings. 
				parameters.defaultValue = self.getLocalizedString( item, true );
			}
		}
		else if( typeof item === "string" ) {
		
			// Process the string value.
			parameters.defaultValue = self.parseSetValue_string( parameters.propertyDef, item );
		}
		else if( typeof item === "boolean" ) {
			
			// Process the boolean value.
			parameters.defaultValue = self.parseSetValue_boolean( parameters.propertyDef, item );
		}
		else if( typeof item === "number" ) {
		
			// Process the number value.
			parameters.defaultValue = self.parseSetValue_number( parameters.propertyDef, item );
		}
		
		// If value was not found, force it to null. 
		if( parameters.defaultValue === null )
			parameters.isNull = true;
			
		// Handle empty string as a null value.
		if( typeof parameters.defaultValue === "string" && parameters.defaultValue.length === 0 )
			parameters.isNull = true;
		
		// Return parameters.
		return parameters;
	}
	
	/**
	 * Parses "set value" which is defined as string. 
	 */
	this.parseSetValue_string = function( propertyDef, setValue ) {
	
		// Convert non-numeric identifiers (GUIDs and external IDs) to value list item ids.
		var returnValue = "";
		if( !self.isNumericString( setValue ) && ( self.isGUID( setValue ) || self.isExternalId( setValue ) ) ) {

			// Is this a GUID?
			if( self.isGUID( setValue ) ) {

				// Get value list value id by GUID and convert to string.
				var id = self.getValueListValueIdByGUID( propertyDef, setValue );
			}

			// Is this an external ID?
			else if( self.isExternalId( setValue ) ) {

				// Get value list value id by external ID and convert to string.
				var id = self.getValueListValueIdByExternalId( propertyDef, setValue );
			}

			if( id !== undefined )
				returnValue = id + "";
			else
				returnValue = "";

		}
		else if( self.isDateISO8601( setValue ) ) {

			// The string represents a date in YYYY-MM-DD (ISO 8601) format.
			// Convert to representation supported (YYYY MM DD) by replacing the dashes with spaces.
			returnValue = setValue.replace( /-/g, " " );
		}
		else if( self.isTime( setValue ) ) {

			// The string represents time in HH:MM:SS format.
			// Convert to representation supported (HH MM SS) by replacing the colons with spaces.
			returnValue = setValue.replace( /:/g, " " );
		}
		else
			returnValue = setValue;

		return returnValue;
	}
	
	/**
	 * Parses "set value" which is defined as boolean. 
	 */
	this.parseSetValue_boolean = function( propertyDef, setValue ) {
	
		// Ensure that boolean types are converted to string.
		return ( setValue === true ) ? "1" : "0";
	}
	
	/**
	 * Parses "set value" which is defined as number. 
	 */
	this.parseSetValue_number = function( propertyDef, setValue ) {
	
		// Ensure that number types are converted to string.
		return setValue + "";
	}
	
	/**
	 * Parses value list items from the given string array.
	 *
	 * @param propertyDef The property definition id.
	 * @param item The string array to parse.
	 * @return The string which contains resolved value list item ids separated by space.
	 */
	this.parseValueListItems = function( propertyDef, item ) {
	
		var setValue = "";
		for( var i = 0; i < item.length; i++ ) {
			var j = item[ i ];
				
			// Convert GUIDs to value list item ids.
			if( j !== null && typeof j === "string" ) {
				if( !self.isNumericString( j ) ) {
				
					// Get value list value id and convert to string.
					if( self.isGUID( j ) )
						var id = self.getValueListValueIdByGUID( propertyDef, j );
					else if( self.isExternalId( j ) )
						var id = self.getValueListValueIdByExternalId( propertyDef, j );

					if( id !== undefined )
						j = id + "";
					else
						j = "";
				}
			}
			setValue += j;
			if( i < item.length - 1 )
				setValue += " ";
		}
		return setValue;
	}
	
	/**
	 * Processes content of single HTML tag.
	 *
	 * @param tagContent The content of HTML tag (without '<' and '>' characters).
	 * @return result The processed string.
	 */
	this.processHTMLTag = function( tagContent ) {
	
		// List of allowed tags.
		var allowedTags = [
			{ tag: "b", result: "<b>" },
			{ tag: "/b", result: "</b>" },
			{ tag: "h1", result: "<h1>" },
			{ tag: "/h1", result: "</h1>" },
			{ tag: "h2", result: "<h2>" },
			{ tag: "/h2", result: "</h2>" },
			{ tag: "h3", result: "<h3>" },
			{ tag: "/h3", result: "</h3>" },
			{ tag: "br", result: "<br>" },
			{ tag: "/a", result: "</a>" }
		];
		
		// Search and accept allowed HTML tags.
		var result = null;
		for( var i = 0; i < allowedTags.length; i++ ) {

			// Get this tag.
			var item = allowedTags[ i ];
			var tag = item.tag;
			if( tag ) {
				var encodedTag = utilities.htmlencode( tag );
				
				// If the tag is allowed, use it.
				if( tagContent === encodedTag ) {
					result = item.result;
					break;
				}
			}
		}
		
		// No allowed tags found. Handle executable links.
		if( !result ) {
		
			// Handling for executable links.
			var startTag = "a href='";
			var endTag = "'";			
			var encodedStartTag = utilities.htmlencode( startTag );
			var encodedEndTag = utilities.htmlencode( endTag );
			
			// Check if the string starts with a start tag.
			if( tagContent.indexOf( encodedStartTag ) === 0 ) {
			
				// Check if the string ends with a end tag.
				var subStringWithoutStartTag = tagContent.slice( encodedStartTag.length );
				if( subStringWithoutStartTag.indexOf( encodedEndTag ) === ( subStringWithoutStartTag.length - encodedEndTag.length ) ) {
				
					// Ensure that we have at least 1 character for the URL.
					var length = tagContent.length - encodedEndTag.length - encodedStartTag.length;
					if( length > 0 ) {
				
						// Get URL from the string.
						var url = tagContent.slice( encodedStartTag.length, tagContent.length - encodedEndTag.length );
						
						// Ensure that we use safe protocol.
						if( url.indexOf( "http:" ) === 0 ||
							url.indexOf( "https:" ) === 0 ||							
							url.indexOf( "mailto:" ) === 0 ||
							url.indexOf( "m-files:" ) === 0 ) {
							
							// Create safe link.
							result = "<a href='about:blank' target='_blank' class='mf-executable-url' data-target='" + url + "'>";
						}
					}
				}
			}
		}
		
		// Not allowed tag or link. Use encoded content.
		if( !result )
			result = "{" + tagContent + "}";
		
		// Return processed string.
		return result;
	}
	
	/**
	 * Resolves metadata structure item id by alias.
	 *
	 * @param alias The alias for the requested metadata structure item.
	 * @param type The type of the requested metadata structure item.
	 * @return The resolved id.
	 */
	this.getIdByAlias = function( alias, type ) {

		// Get cached value if available.
		var aliasType = type + "Aliases";
		if( this.aliases[ aliasType ].hasOwnProperty( alias ) ) {
		
			// Cached value found, return it.
			return this.aliases[ aliasType ][ alias ];
		}
	
		// Get metadata structure item id by alias.
		var vault = this.metadatacard.controller.getVault();
		
		// MFMetadataStructureItem Enumeration.
		// ObjectType can imply either a real object type or a value list.
		var structureItem = -1;
		if ( type === "ObjectType" )
			structureItem = 1;
		else if ( type === "PropertyDefinition" )
			structureItem = 2;
		else if ( type === "Class" )
			structureItem = 3;
		else if ( type === "Workflow" )
			structureItem = 4;
		else if ( type === "State" )
			structureItem = 5;	
		else if ( type === "StateTransition" )
			structureItem = 16;
		var value = vault.GetMetadataStructureItemIdByAlias( structureItem, alias );
		
		// If value was found, return it.
		if( value !== -1 ) {
			this.aliases[ aliasType ][ alias ] = value;
			return value;	
		}
		return undefined;
	}
	
	/**
	 * Resolves value list value id by GUID. Returns undefined if the item is not found.
	 *
	 * @param propertyDefId The property definition id.
	 * @param guid The GUID for requested value list value.
	 * @param callback The callback function, which is called with resolved id.
	 * @return The resolved id, or undefined if the item was not found.
	 */
	this.getValueListValueIdByGUID = function( propertyDefId, guid ) {

		// Delegate.
		var id = this.metadatacard.controller.editor.DataModel.GetValueListItemIdByGUID( propertyDefId, guid );

		// Return found value.
		if( id !== -1 )
			return id;

		return undefined;
	}

	/**
	 * Resolves value list value id by external ID. Returns undefined if the item is not found.
	 *
	 * @param propertyDefId The property definition id.
	 * @param extId The external ID for requested value list value with prefix "ext-".
	 * @param callback The callback function, which is called with resolved id.
	 * @return The resolved id, or undefined if the item was not found.
	 */
	this.getValueListValueIdByExternalId = function( propertyDefId, extId ) {

		// Confirm that the string is long enough.
		if( extId.length > 4 ) {

			// Get the ID part (everything after the external ID identifier)
			var idPart = extId.substr(4);

			// Delegate.
			var id = this.metadatacard.controller.editor.DataModel.GetValueListItemIdByExternalId( propertyDefId, idPart );

			// Return found value.
			if( id !== -1 )
				return id;

		}

		return undefined;
	}
	
	/**
	 * Resolves value list item id from value list by GUID. Returns undefined if the item is not found.
	 *
	 * @param valueListId The value list id.
	 * @param guid The GUID for requested value list item.
	 * @return The resolved id, or undefined if the item was not found.
	 */
	this.getValueListItemIdFromValueListByGuid = function( valueListId, guid )
	{
		// Create empty list if list id is not found yet.
		if( !this.valueListsItemsGuids.hasOwnProperty( valueListId ) )
			this.valueListsItemsGuids[ valueListId ] = {};
			
		// Create full guid for easy comparison against guid returned from API.
		// Metadatacard Configuration contains guids without brackets {}
		fullGuid = "{" + guid + "}";
		
		// If cached value found, return it.
		if( this.valueListsItemsGuids[ valueListId ].hasOwnProperty( fullGuid ) )		
			return this.valueListsItemsGuids[ valueListId ][ fullGuid ];		
		
		// Get value list items by value list id.
		var vault = this.metadatacard.controller.getVault();
		var items = vault.ValueListItemOperations.GetValueListItems( valueListId );

		// Create cache of returned value list item ids by value list id and guid.
		for( var i in items ) {
			this.valueListsItemsGuids[ valueListId ][ items[ i ].ItemGUID ] = items[ i ].ID;
		}
		
		// If guid is found, return value list item id by guid.
		if( this.valueListsItemsGuids[ valueListId ].hasOwnProperty( fullGuid ) ) {	
			return this.valueListsItemsGuids[ valueListId ][ fullGuid ];
		}
		
		// No guid found from given value list.
		return undefined;
	}
	
	/**
	 * Converts property behavior identified by aliases so that it is identified by property definition ids.
	 *
	 * @param behavior The behavior where properties are identified by aliases (or property definition ids).
	 * @return behavior The behavior where properties are identified only by property definition ids.
	 */
	this.parseAliasesFromBehavior = function( behavior ) {

		// Convert only in "Properties"-category.
		var aliases = {};
		if( behavior && behavior.hasOwnProperty( "Properties" ) ) {
	
			// Search aliases from the properties-list.
			for( var i in behavior[ "Properties" ] ) {
			
				// Convert only non-numeric strings.
				if( typeof i === "string" && !this.isNumericString( i ) ) {
				
					// Convert this alias to property definition id.
					var id = this.getIdByAlias( i, "PropertyDefinition" );
					
					// Store information about conversion.
					// Store also information whether the alias was valid or not.
					aliases[ i ] = {
						propertyDef: id,
						behavior: behavior[ "Properties" ][ i ],
						isValid: ( id !== undefined ) ? true : false
					};
				}
			}
			
			// Remove all property behaviors identified by aliases (valid or not valid aliases).
			// Insert only property behaviors which are identified by valid aliases, but so that they are now identified by related property definition ids.
			for( var i in aliases ) {
				delete behavior[ "Properties" ][ i ];
				if( aliases[ i ].isValid )
					behavior[ "Properties" ][ aliases[ i ].propertyDef ] = aliases[ i ].behavior;
			}
		}
		return behavior;
	}
	
	/**
	 * Converts value list and items behavior identified by aliases/guid so that it is identified by ids.
	 *
	 * @param behavior The behavior where value lists and items are identified by aliases or guid.
	 * @return behavior The behavior where value lists and items are identified only by value list ids.
	 */
	this.parseValueListAliasesAndGuidsFromBehavior = function( behavior ) {

		// Convert aliases and guid only in "ValueLists"-category.
		if( behavior && behavior.hasOwnProperty( "ValueLists" ) ) {
	
			// Iterate Value Lists from behavior.
			var valueLists = behavior[ "ValueLists" ];
			var resolvedLists = {};
			for( var i in valueLists ) {
				
				// Init Value List ID to not found.
				var valueListID = undefined;
				
				// Resolve Value List ID from alias.
				// MFMetadataStructureItem Enumeration, ObjectType can imply either a real object type or a value list.
				if( typeof i === "string" && !this.isNumericString( i ) )
					valueListID = this.getIdByAlias( i, "ObjectType" );				
				else
					valueListID = i;
				
				// Verify that possible alias was found.
				if( valueListID !== undefined ) {
					
					// Conversion to string for later comparison. Value is integer when alias is resolved to id.
					valueListID = valueListID.toString();
					
					// Iterate Value Lists Items from Value List behavior.
					var valueListItems = behavior[ "ValueLists" ][ i ][ "Items" ];
					var resolvedItems = {};
					for( var j in valueListItems ) {

						// Check whether this value list item is identified by guid.
						if( typeof j === "string" && !this.isNumericString( j ) ) {
							
							// Init itemId to not found.
							var itemId = undefined;

							// Convert this value list item guid to id.
							// Some value list items can have alias, other value list items can only be refered by GUID
							if( this.isGUID( j ) )
								itemId = this.getValueListItemIdFromValueListByGuid( valueListID, j );
							else if( valueListID === "1" )
								itemId = this.getIdByAlias( j, "Class" );	
							else if( valueListID === "7" )
								itemId = this.getIdByAlias( j, "Workflow" );
							else if( valueListID === "8" )
								itemId = this.getIdByAlias( j, "State" );
							else if( valueListID === "17" )
								itemId = this.getIdByAlias( j, "StateTransition" );								
							
							// Store information about item guid conversion.
							// Store also information whether the alias or guid was valid or not.
							resolvedItems[ j ] = {
								itemId: itemId,
								behavior: valueListItems[ j ],
								isValid: ( itemId !== undefined ) ? true : false
							};
						
						}  // end if
						
					}  // end for
					
					// Remove all value list item behaviors identified by aliases or guid (valid or not valid aliases).
					// Insert only value list item behaviors which are identified by valid guid,
					// but so that they are now identified by value list item ids.
					for( var j in resolvedItems ) {
						delete valueListItems[ j ];
						if( resolvedItems[ j ].isValid )
							valueListItems[ resolvedItems[ j ].itemId ] = resolvedItems[ j ].behavior;
					
					}  // end for
				
				}  // end if
				
				// Store information about value list alias conversion.
				// Store also information whether the alias was valid or not.
				resolvedLists[ i ] = {
					listId: valueListID,
					behavior: valueLists[ i ],
					isValid: ( valueListID !== undefined ) ? true : false
				};
				
			}  // end for

			// Remove all value list behaviors identified by aliases (valid or not valid aliases).
			// Insert only value list behaviors which are identified by valid aliases,
			// but so that they are now identified by value list item ids.
			for( var j in resolvedLists ) {
				delete valueLists[ j ];
				if( resolvedLists[ j ].isValid )
					valueLists[ resolvedLists[ j ].listId ] = resolvedLists[ j ].behavior;

			}  // end for
		
		}  // end if
		
		// Return behavior that contains only ids.
		return behavior;
	}
	
	/**
	 * Returns type of property condition value.
	 *
	 * @param The property condition value.
	 * @return The type of property condition value.
	 */
	this.getConditionValueType = function( value ) {
	
		// Branch by value type.
		if( value === null )
			return "null";
		else if( typeof value === "number" )
			return "number"
		else if( typeof value === "boolean" )
			return "boolean"
		else if( typeof value === "string" ) {
			
			// Type is string. Check whether the string represents numeric value.
			if( this.isNumericString( value ) )
				return "numeric-string";
			return "string";	
		}
		else if( Object.prototype.toString.call( value ) === "[object Array]" ) {
		
			// Type is array. Check each item in the array.
			var isValid = true;
			for( var i = 0; i < value.length; i++ ) {
		
				// Check this item.
				var item = value[ i ];
				if( typeof item === "number" ) {
					
					// Type is already number, which is OK.
				}
				else if( typeof item === "string" ) {
					
					// Type is string. Check whether the string represents numeric value.
					// Arrays with strings, numeric-strings and/or numbers are all string-arrays.
					if( !this.isNumericString( item ) )
						return "string-array";
				}
				else {
					isValid = false;
					break;
				}
			}
			// If check was successful, the string represents numeric value.
			if( isValid )
				return "number-array";
		}
		
		// Unknown value type.
		return "unknown";
	}
	
	 /**
	 * Returns true, if the requested value matches the value in given rule condition.
	 *
	 * @param filter The rule condition, which includes the first value to compare.
	 * @param valueToCompare The second value to compare.
	 * @param name Name of the first value in the rule condition.  
	 * @return True, if the requested value matches the value in given rule condition.
	 */
	this.isEqual = function( filter, valueToCompare, name ) {
	
		// Ensure that the value is integer.
		if( valueToCompare !== null && typeof valueToCompare === "string" )
			valueToCompare = parseInt( valueToCompare + "", 10 );
						
		// Compare null values.
		if( filter[ name ] === null ) {
			if ( valueToCompare === null )
				return true;
			else		
				return false;
		}
	
		// Branch by parameter type.	
		if( typeof filter[ name ] === "number" ) {
		
			// The parameter type is number. Compare as is.
			if( filter[ name ] !== valueToCompare )
				return false;
		}
		else if( typeof filter[ name ] === "string" ) {

			// Check object type or class id.
			var id = this.getIdFromParameter( filter[ name ], name, -1 );
			if( id !== valueToCompare )
				return false;
		}
		else if( Object.prototype.toString.call( filter[ name ] ) === '[object Array]' ) {
    
			// The parameter type is array. Check each item.
			var found = false;
			for( var i = 0; i < filter[ name ].length; i++ ) {
			
				// Parse this item.
				var item = filter[ name ][ i ];
				if( typeof item === "number" ) {
				
					// The item type is number. Compare as is.
					if( item === valueToCompare ) {
						found = true;
						break;
					}	
				}
				else if( typeof item === "string" ) {
						
					// Get object type id or class id from the string.
					var id = this.getIdFromParameter( item, name, -1 );
					if( id === valueToCompare ) {
						found = true;
						break;
					}
				}
			}
			return found;
		}
		else
			return false;
		return true;
	}
	
	/**
	 * Evaluates the property condition.
	 *
	 * @param properties All properties.
	 * @param propertyCondition The property condition to evaluate.
	 * @param id The property definition id. 
	 * @return The result of the evaluation, true or false.
	 */
	this.evaluatePropertyCondition = function( properties, propertyCondition, id ) {
	
		// Get related property definition based on id.
		var property = null;
		for( var i in properties ) {
		
			// Get this property.
			var currentProperty = properties[ i ];
			
			// Check if the property is found.
			if( currentProperty.PropertyDef === id ) {
				property = currentProperty;
				break;
			}
		}
		// Property doesn't exist.
		if( !property )
			return false;
	
		// Allowed conditions.
		var allowedPropertyConditions = {
			
			"choice": {
				// SSLU
				"defaultOperator": "hasAny",
				"operators": {
					"is": {
						"number": {
							"funct": "SSLU_is"
						},
						"string": {
							"funct": "SSLU_is"
						},
						"numeric-string": {
							"funct": "SSLU_is"
						},
						"null": {
							"funct": "SSLU_is"
						}
					},
					"isNot": {
						"number": {
							"funct": "SSLU_isNot"
						},
						"string": {
							"funct": "SSLU_isNot"
						},
						"numeric-string": {
							"funct": "SSLU_isNot"
						},
						"null": {
							"funct": "SSLU_isNot"
						}
					},
					"hasAny": {
						"number": {
							"funct": "SSLU_hasAnyItem"
						},
						"string": {
							"funct": "SSLU_hasAnyItem"
						},
						"numeric-string": {
							"funct": "SSLU_hasAnyItem"
						},
						"number-array": {
							"funct": "SSLU_hasAnyItem"
						},
						"string-array": {
							"funct": "SSLU_hasAnyItem"
						},
						"null": {
							"funct": "SSLU_is"
						}
					}
				}
			},
			"multi-choice": {
				// MSLU
				"defaultOperator": "hasAny",
				"operators": {
					"hasAny": {
						"number": {
							"funct": "MSLU_hasAnyItem"
						},
						"string": {
							"funct": "MSLU_hasAnyItem"
						},
						"numeric-string": {
							"funct": "MSLU_hasAnyItem"
						},
						"number-array": {
							"funct": "MSLU_hasAnyItem"
						},
						"string-array": {
							"funct": "MSLU_hasAnyItem"
						}
					},
					"hasAll": {
						"number": {
							"funct": "MSLU_hasAllItems"
						},
						"string": {
							"funct": "MSLU_hasAllItems"
						},
						"numeric-string": {
							"funct": "MSLU_hasAllItems"
						},
						"number-array": {
							"funct": "MSLU_hasAllItems"
						},
						"string-array": {
							"funct": "MSLU_hasAllItems"
						}
					},
					"is": {
						"number": {
							"funct": "MSLU_hasAllItems"
						},
						"string": {
							"funct": "MSLU_hasAllItems"
						},
						"numeric-string": {
							"funct": "MSLU_hasAllItems"
						},
						"number-array": {
							"funct": "MSLU_hasAllItems"
						},
						"string-array": {
							"funct": "MSLU_hasAllItems"
						},
						"null": {
							"funct": "MSLU_isNull"
						}
					},
					"isNot": {
						"number": {
							"funct": "MSLU_hasNotAnyItem"
						},
						"string": {
							"funct": "MSLU_hasNotAnyItem"
						},
						"numeric-string": {
							"funct": "MSLU_hasNotAnyItem"
						},
						"number-array": {
							"funct": "MSLU_hasNotAnyItem"
						},
						"string-array": {
							"funct": "MSLU_hasNotAnyItem"
						},
						"null": {
							"funct": "MSLU_isNotNull"
						}
					}
				}
			},
			"boolean": {
				// Boolean
				"defaultOperator": "is",
				"operators": {
					"is": {
						"boolean": {
							"funct": "Boolean_is"
						},
						"null": {
							"funct": "Boolean_is"
						}
					},
					"isNot": {
						"boolean": {
							"funct": "Boolean_isNot"
						},
						"null": {
							"funct": "Boolean_isNot"
						}
					}
				}
			}
		}
	
		// Validate property type in the condition.
		if( !allowedPropertyConditions.hasOwnProperty( property.Type ) ) {
			alert( "ERROR: Property type: " + property.Type + " is not supported in property condition." );
			return false;
		}
		// Validate operation type in the condition.
		var allowedCondition = allowedPropertyConditions[ property.Type ];
		
		// Branch by property condition format: simple or complex.
		var isArray = ( Object.prototype.toString.call( propertyCondition ) === "[object Array]" );
		if( propertyCondition !== null && typeof propertyCondition === "object" && !isArray ) {
		
			// The property condition is an object: Complex format in use. 
		}
		else {
		
			// The property condition is not an object, simple format in use ==> Convert to complex format.
			var propertyCondition = {
				"Operator": allowedCondition.defaultOperator,
				"Value": propertyCondition
			}
		}
			
		// If operator is not defined, use default operator.
		if( !propertyCondition.hasOwnProperty( "Operator" ) )
			propertyCondition[ "Operator" ] = allowedCondition.defaultOperator;
		
		// Validate operator.
		var operators = allowedCondition.operators;
		if( !operators.hasOwnProperty( propertyCondition[ "Operator" ] ) ) {
			alert( "ERROR: Operator '" + propertyCondition[ "Operator" ] + "' not supported in property condition with type '" + property.Type + "'." );
			return false;
		}
		var operator = operators[ propertyCondition[ "Operator" ] ];
			
		// Get value from the condition and resolve its type.
		var value = propertyCondition.hasOwnProperty( "Value" ) ? propertyCondition[ "Value" ] : null;
		var valueType = this.getConditionValueType( value );
		if( valueType === "unknown" ) {
			alert( "ERROR: Unknown value type in property condition." );
			return false;
		}
		
		// Ensure that value type is allowed for the operator.
		if( !operator.hasOwnProperty( valueType ) ) {
			alert( "ERROR: Value type " + valueType + " not supported with operator '" + propertyCondition[ "Operator" ] + "' in property conditions." );
			return false;
		}
		
		// Get value type object and use related function to evaluate condition.
		var valueTypeObject = operator[ valueType ];
		
		// Get comparison function to call.
		var funct = this[ valueTypeObject.funct ];
		if( !funct ) {
			alert( "Internal error: No comparison function." );
			return false;
		}
			
		// Adjust parameters for comparison function.
		value = this.adjustConditionParameters( valueType, value ); 
		
		// Call comparison function.
		var passed = funct( property, value );
		if( !passed )
			return false;
		return true;
	}
	
	/**
	 * Adjusts condition parameters.
	 *
	 * @param valueType The type of the given value.
	 * @param value The given value. 
	 * @return The adjusted value.
	 */
	this.adjustConditionParameters = function( valueType, value ) {
	
		// Convert strings to numbers when possible with simple types and string arrays.
		if( valueType === "numeric-string" ) {
			value = this.getNumberFromString( value );
		}
		else if( valueType === "number-array" ) {
			
			for( var i = 0; i < value.length; i++ ) {
				var item = value[ i ];
				if ( typeof item === "string" ) {
					item = this.getNumberFromString( item );
					value[ i ] = item;
				}
			}
		}
		return value;
	}
	
	/**
	 * Returns true, if each selected object has the requested value within this SSLU.
	 *
	 * @param property The property.
	 * @param valueToCompare The requested value.
	 * @return True, if each selected object has the requested value within this SSLU. 
	 */
	this.SSLU_is = function( property, valueToCompare ) {
	
		// Check null value and parameter type.
		if( valueToCompare === null ) {
		
			// We compare value to null. Return true if value is empty.
			var value = property.Value;
			if( value === null )
				return true;
		}
		else if( typeof valueToCompare === "string" ) {
		
			// We compare value to string. Check if the string is empty. 
			if( valueToCompare.length === 0 )
			{
				// We compare to empty string. Return true if value is empty.
				var value = property.Value;
				if( value === null )
					return true;
			}

			// Branch by property definition id. Special handling is needed for workflow and state aliases.
			// If property is not workflow or state, we assume that value is number or GUID for the value list item.
			var valueType = null;
			if( property.propertyDef === 38 )		
				valueType = "Workflow";
			else if( property.propertyDef === 39 )
				valueType = "State";
			else
				valueType = "ValueListItem";
			
			// Convert string to related item id.
			var id = self.getIdFromParameter( valueToCompare, valueType, property.propertyDef );
			if( id === undefined ) {
				return false;
			}
			valueToCompare = id;	
		}
		else if ( typeof valueToCompare !== "number" ) {
			alert( "ERROR: SSLU_is: parameter not valid" );
			return false;
		}
		
		// Only SSLU property type is allowed.
		if( property.Type === "choice" ) {
		
			// Compare value.
			var value = property.Value;
			if( value !== null ) {
			
				// The property value is not null. Compare to requested value.
				if( value.Item && value.Item === valueToCompare ) {
					return true;
				}
			}
		}
		else
			alert( "Only SSLU property type is allowed" );
		return false;
	}
	
	/**
	 * Returns true, if any of the selected objects don't have the requested value within this SSLU.
	 *
	 * @param property The property. 
	 * @param valueToCompare The requested value.
	 * @return True, if any of the selected objects don't have the requested value within this SSLU.
	 */
	this.SSLU_isNot = function( property, valueToCompare ) {
	
		// Delegate and return inverted result.
		return !self.SSLU_is( property, valueToCompare );
	}

	/**
	 * Returns true, if each selected object has the requested value.
	 *
	 * @param property The property.
	 * @param valueToCompare The requested value.
	 * @return True, if each selected object has the requested value. 
	 */
	this.Boolean_is = function( property, valueToCompare ) {
	
		// Check null value and parameter type.
		if( valueToCompare === null ) {
		
			// We compare value to null. Return true if value is empty.
			var value = property.Value;
			if( value === null )
				return true;
		}
		else if( typeof valueToCompare === "boolean" ) {
		
			// Compare value. Return true if values are equal.
			var value = property.Value;
			if( value === valueToCompare )
				return true;
		}
		return false;
	}
	
	/**
	 * Returns true, if any of the selected objects doesn't have the requested value.
	 *
	 * @param property The property. 
	 * @param valueToCompare The requested value.
	 * @return True, if any of the selected objects doesn't have the requested value.
	 */
	this.Boolean_isNot = function( property, valueToCompare ) {
	
		// Delegate and return inverted result.
		return !self.Boolean_is( property, valueToCompare );
	}

	/**
	 * Returns true, if each selected object has the requested item within this SSLU.
	 *
	 * @param property The property. 
	 * @param valueToCompare The property condition value (collection of items).
	 * @return True, if each selected object has the requested item within this SSLU. 
	 */
	this.SSLU_hasAnyItem = function( property, valueToCompare ) {
	
		// Preprocess the property condition.
		valueToCompare = self.preProcessCondition( property, valueToCompare );
		if( valueToCompare !== undefined ) {
			
			// Get this item.
			var value = property.Value;
			if( value && value.Item ) {
				
				// All selected objects have this item, check whether it is requested item.
				if( self.conditionHasItem( valueToCompare, value.Item ) )
					return true;
			}
			
			// There was not any common item for all selected objects within this SSLU. 
			// We need to check item with multiple values.	
			var checkedObjects = 0;
			if( utilities.isMultiValue( value ) ) {
				
				// For multivalues we need to check all ValueParts (=individual objects).
				for ( var j in value.ValueParts ) {
					
					// Count checked objects.
					checkedObjects++;
	
					// Check this valuePart (=selected object).
					var isValid = false;
					var valuePart = value.ValueParts[ j ];	
					if ( valuePart ) {
						
						// Check all items related to this selected objects.
						for ( var k in valuePart ) {
								
							// If any of items (of this object) is found from the condition, this object is OK and we can move to check next object. 
							if( self.conditionHasItem( valueToCompare, valuePart[ k ].item ) ) {
								isValid = true;
								break;
							}
						}
					}
						
					// Not any items in the condition was found from the SSLU of this object. So, "has any"-condition can't be passed.
					if( !isValid )
						return false;
				}
			}
			
			// If we checked all selected objects successfully, it means that each selected object has the requested item within this SSLU.  
			if( checkedObjects === self.objVers.Count )
				return true;
			else
				return false;
		}
		
		// Property condition was not valid, return false.
		return false;
	}
	
	/**
	 * Returns true, if each selected object has at least one requested item within this MSLU.
	 *
	 * @param property The property. 
	 * @param valueToCompare The property condition value (collection of items).
	 * @return True, if each selected object has at least one requested item within this MSLU. 
	 */
	this.MSLU_hasAnyItem = function( property, valueToCompare ) {
	
		// Preprocess the property condition.
		valueToCompare = self.preProcessCondition( property, valueToCompare );
		if( valueToCompare !== undefined ) {
		
			// Loop through all items.
			var value = property.Value;
			var itemCount = value.Count;
			for( var i = 0; i < itemCount; i++ ) {
				
				// Get this item.
				var v = value[ i ];
				if( v && v.Item ) {
				
					// All selected objects have this item, check whether it is requested item.
					if( self.conditionHasItem( valueToCompare, v.Item ) )
						return true;
				}
			}
			
			// There was not any common item for all selected objects within this MSLU. 
			// We need to check items with multiple values.
			
			// Loop through all items.
			var checkedObjects = 0;
			for( var i = 0; i < itemCount; i++ ) {
				
				// Get this item.		
				var v = value[ i ];
				if( utilities.isMultiValue( v ) ) {
				
					// For multivalues we need to check all ValueParts (=individual objects).
					for ( var j in v.ValueParts ) {
					
						// Count checked objects.
						checkedObjects++;
	
						// Check this valuePart (=selected object).
						var isValid = false;
						var valuePart = v.ValueParts[ j ];	
						if ( valuePart ) {
						
							// Check all items related to this selected objects.
							for ( var k in valuePart ) {
								
								// If any of items (of this object) is found from the condition, this object is OK and we can move to check next object. 
								if( self.conditionHasItem( valueToCompare, valuePart[ k ].item ) ) {
									isValid = true;
									break;
								}
							}
						}
						
						// Not any items in the condition was found from the MSLU of this object. So, "has any"-condition can't be passed.
						if( !isValid )
							return false;
					}
				}
			}
			
			// If we checked all selected objects successfully, it means that each selected object has at least one requested item within this MSLU.  
			if( checkedObjects === self.objVers.Count )
				return true;
			else
				return false;
		}
		
		// Property condition was not valid, return false.
		return false;
	}

    /**
	 * Returns true, if each selected object has none of the value items within this MSLU.
	 *
	 * @param property The property. 
	 * @param valueToCompare The property condition value (collection of items).
	 * @return True, if each selected object has none of the value items within this MSLU. 
	 */
	this.MSLU_hasNotAnyItem = function( property, valueToCompare ) {
	
		// Delegate and return inverted result.
		return !self.MSLU_hasAnyItem( property, valueToCompare );
	}

	/**
	 * Returns true, if requested MSLU property is empty for each selected object.
	 *
	 * @param property The property.
	 * @param valueToCompare The requested value. In practice this is null.
	 * @return True, if requested MSLU property is empty for each selected object. 
	 */
	this.MSLU_isNull = function( property, valueToCompare ) {
	
		// Check whether value is null only if we compare to null.
		if( valueToCompare === null ) {
	
			// Ensure that property object is valid.
			if( property && typeof property === "object" ) {
		
				// Compare value to null. Return true if the value is null.
				var value = property.Value;
				if( value === null )
					return true;
				
				// Ensure that value object is valid.	
				if( value && typeof value === "object" ) {
				
					// Compare value to empty list. Return true if the list is empty.
					if( value.Count === 0 )
						return true;
				}
			}	
		}
		return false;
	}
	
	/**
	 * Returns true, if requested MSLU property is not empty for any selected object.
	 *
	 * @param property The property.
	 * @param valueToCompare The requested value. In practice this is null.
	 * @return True, if requested MSLU property is not empty for any selected object. 
	 */
	this.MSLU_isNotNull = function( property, valueToCompare ) {
	
		// Delegate and return inverted result.
		return !self.MSLU_isNull( property, valueToCompare );
	}
	
	/**
	 * Returns true, if all selected objects have all the requested items within this MSLU.
	 *
	 * @param property The property. 
	 * @param valueToCompare The property condition value (collection of items).
	 * @return True, if all selected objects have all the requested items within this MSLU. 
	 */
	this.MSLU_hasAllItems = function( property, valueToCompare ) {
	
		// Preprocess the property condition.
		valueToCompare = self.preProcessCondition( property, valueToCompare );
		if( valueToCompare !== undefined ) {
		
			// Return true, if all of the requested value list items are found.
			var length = valueToCompare.length;
			for( var i = 0; i < length; i++ ) {
				var item = valueToCompare[ i ];
				if( !self.AllLookupsHaveItem( property, item ) )
					return false;
			}
			return true;	
		}
		
		// Property condition was not valid, return false.
		return false;
	}
	
	/**
	 * Returns true, if all selected objects have the requested item within this MSLU.
	 *
	 * @param property The property. 
	 * @param item The requested item.
	 * @return True, if all selected objects have the requested item within this MSLU. 
	 */
	this.AllLookupsHaveItem = function( property, item ) {
	
		// Loop through all items.	
		var value = property.Value;
		var itemCount = value.Count;
		for( var i = 0; i < itemCount; i++ ) {
				
			// Get this item.		
			var v = value[ i ];
			if( v && v.Item ) {
								
				// Check if this item matches.
				if( v.Item === item )
					return true;					
			}
		}
		return false;
	}
	
	/**
	 * Returns true, if the given property condition has requested item.
	 *
	 * @param conditionItems The property condition value (collection of items).
	 * @param item The requested item.
	 * @return True, if the given property condition has requested item.
	 */
	this.conditionHasItem = function( conditionItems, item ) {
	
		// Search requested item from the collection and return true if it is found.
		var length = conditionItems.length;
		for( var i = 0; i < length; i++ ) {
			var currentItem = conditionItems[ i ];
			if( currentItem === item )
				return true;
		}
		// Not found, return false.
		return false;
	}
	
	/**
	 * Returns true, if given value is numeric string.
	 */
	this.isNumericString = function( value ) {
	
		// Check whether the string is numeric.
		if( typeof value === "string" ) {
		
			var isnum = /^\d+$/.test( value );
			return isnum;
		}
		return false;
	}
	
	/**
	 * Converts string to number. This assumes, that value is numeric string.
	 */
	this.getNumberFromString = function( value ) {
		
		// Try to parse integer from the string.
		var number = parseInt( value, 10 );
		if( isNaN( number ) ) {
			return null;
		}
		return number;
	}
	
	/**
	 * Converts string to corresponding id.
	 */
	this.getIdFromParameter = function( parameter, parameterType, propertyDef, callback ) {
	
		// Parse property definition id from the string.
		if( this.isNumericString( parameter ) ) {
			var id = this.getNumberFromString( parameter );
			if( id !== null && callback )
				callback( id );
			return id;
		}				
		else {
		
			// Branch by parameter type.
			var id = undefined;
			if( parameterType === "ValueListItem" ) {
			
				// Value list item is identified by GUID or external ID. Try to resolve it.
				if( this.isGUID( parameter ))
					id = this.getValueListValueIdByGUID( propertyDef, parameter );
				else if( this.isExternalId( parameter) )
					id = this.getValueListValueIdByExternalId( propertyDef, parameter );
			
			} else if( parameterType === "Workflow" || parameterType === "State" ) {
			
				// Workflow or State can be identified by a GUID or by an alias.
				if( this.isGUID( parameter ) ) {

					// Try to get the id by GUID.
					id = this.getValueListValueIdByGUID( propertyDef, parameter );
					
				} else {

					// Try to get id by alias.
					id = this.getIdByAlias( parameter, parameterType );
				}
			
			} else {

				// Try to get id by alias.
				id = this.getIdByAlias( parameter, parameterType );
			}
		
			// Callback, if id was found.
			if( id !== undefined && callback )
				callback( id );				
			return id;				
		}
	}
	
	/**
	 * Returns true, if the string represents a GUID.
	 *
	 * @param value The value to check.
	 * @return True, if the string represents a GUID.
	 */
	this.isGUID = function( value ) {
	
		// Check only if this is string with correct length.
		if( value !== null && typeof value === "string" && value.length === 36 ) {
		
			// Check whether this string represents valid GUID. 
			var isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test( value );
			return isGuid;
		}
		return false;
	}
	
	/**
	 * Returns true, if the string represents an extenal id ("ext-<id>").
	 *
	 * @param value The value to check.
	 * @return True, if the string represents an external ID.
	 */
	this.isExternalId = function (value) {

		// External IDs are non-null strings with prefix "ext-".
		if( value != null && typeof value === "string" && value.length > 4 ) {
			return( value.substring(0,4) == 'ext-' );
		}

		return false;
	}

	/**
	 * Returns true, if the string represents a date in format YYYY-MM-DD (ISO 8601).
	 *
	 * @param value The value to check.
	 * @return True, if the string represents a date.
	 */
	this.isDateISO8601 = function( value ) {
	
		// Check only if this is a string.
		if( value !== null && typeof value === "string" ) {
		
			// Check whether this string represents date in format YYYY-MM-DD (ISO 8601).
			// Exact validation is not needed, just check the format.
			var isDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/i.test( value );
			return isDate;
		}
		return false;
	}

	/**
	 * Returns true, if the string represents time in format HH:MM:SS.
	 *
	 * @param value The value to check.
	 * @return True, if the string represents time.
	 */
	this.isTime = function( value ) {

		// Check only if this is a string.
		if( value !== null && typeof value === "string" ) {

			// Check whether this string represents time in format HH:MM:SS.
			// Exact validation is not needed, just check the format.
			isTime = /^[0-9]{2}:[0-9]{2}:[0-9]{2}$/i.test( value );
			return isTime;
		}
		return false;
	}

	/**
	 * Preprocesses the property condition.
	 *
	 * @param property The property.
	 * @param valueToCompare The property condition value (collection of items).
	 * @return The preprocessed property condition value or undefined if condition is not valid.
	 */
	this.preProcessCondition = function( property, valueToCompare ) {
	
		// Check value type.
		var valueType = self.getConditionValueType( valueToCompare );
		if( valueType !== "string" && valueType !== "number-array" && valueType !== "number" && valueType !== "string-array" ) {
		
			alert( "Wrong value type in property condition:" + valueType + ", property definition: " + property.propertyDef );
			return undefined;
		}
		if( valueType === "string" ) {
		
			// Branch by property definition id. Special handling is needed for workflow and state aliases.
			// If property is not workflow or state, we assume that value is number or GUID for the value list item.
			var parameterType = null;
			if( property.propertyDef === 38 )		
				parameterType = "Workflow";
			else if( property.propertyDef === 39 )
				parameterType = "State";
			else
				parameterType = "ValueListItem";
		
			// Value type is string. We assume that it is value list item id or GUID for it.
			var id = self.getIdFromParameter( valueToCompare, parameterType, property.propertyDef );
			if( id === undefined ) {
				return undefined;
			}
			valueToCompare = [ id ];
		}
		else if( valueType === "number" ) {
		
			// Value type is number. Use it as is.
			valueToCompare = [ valueToCompare ];
		}
		else if( valueType === "number-array" ) {
		
			// Value type is already array.
		}
		else if( valueType === "string-array" ) {
		
			// Branch by property definition id. Special handling is needed for workflow and state aliases.
			// If property is not workflow or state, we assume that value is number or GUID for the value list item.
			var parameterType = null;
			if( property.propertyDef === 38 )		
				parameterType = "Workflow";
			else if( property.propertyDef === 39 )
				parameterType = "State";
			else
				parameterType = "ValueListItem";

			// Value type is string-array. It may contain strings and numbers. We assume that each string is value list item id or GUID for it.
			for( var i = 0; i < valueToCompare.length; i++ ) {
				if( typeof valueToCompare[ i ] === "string" ) {
				
					// Find the ID for this string.
					var id = self.getIdFromParameter( valueToCompare[ i ], parameterType, property.propertyDef );
					valueToCompare[ i ] = id;
				}
			}
		}
		return valueToCompare;
	}
	
	/**
	 * Copy rules to the array and sort them by priority.
	 *
	 * @param rules The object which contains rules.
	 * @return The sorted array of rules.
	 */
	this.sortRulesByPriority = function( rules ) {

		// Process all rules.
		var sortedRules = [];
		for( var key in rules ) {

			// Process this rule.
			var rule = rules[ key ];

			// Sort possible child rules recursively.
			if( rule.hasOwnProperty( "rules" ) ) {
				
				// Sort child rules.
				rule.sortedRules = this.sortRulesByPriority( rule.rules );
				delete rule.rules;
			}
			// Store key, which is needed to identify this rule later.
			rule.key = key;
			
			// Add rule to the array.
			sortedRules.push( rule );
		}
		
		// Sort rules by priority in the array.
		sortedRules.sort( function( a, b ) {
		
			// Compare priorities.
			if( a.priority < b.priority )
				return -1;
			else if( a.priority > b.priority )
				return 1;
			else
				return 0;
		} );
		return sortedRules;
	}
	
	/** 
	 * Starts fetching of metadata suggestions if needed.
	 *
	 * @param configuration - The configuration object.
	 * @param event - Explains why fetching of metadata suggestions has been requested. Supported values: "OnDefaultMetadataFetch", "OnPromote", "OnPropertyValueChanged".
	 * @param useDefaultParameters - True to use default parameters instead of parameters from configuration rule.
	 */
	this.fetchMetadataSuggestions = function( configuration, event, useDefaultParameters ) {
		
		// Check if we should use default parameters.
		if( useDefaultParameters ) {
		
			// Call model to fetch metadata suggestions with default parameters.
			this.metadatacard.controller.editor.Datamodel.FetchMetadataSuggestions( true, true, [], "" );
		}
		else {
		
			// Search for FetchMetadataSuggestions-action.
			var parameters = this.getMetadataCardConfiguration( "FetchMetadataSuggestions", configuration );
			if( parameters && typeof parameters === "object" ) {
			
				// FetchMetadataSuggestions-action found, read parameters from the action.
				var useFileContent = ( parameters.hasOwnProperty( "UseFileContent" ) && typeof parameters[ "UseFileContent" ] === "boolean" ) ? parameters[ "UseFileContent" ] : false;
				var useMetadata = ( parameters.hasOwnProperty( "UseMetadata" ) && typeof parameters[ "UseMetadata" ] === "boolean" ) ? parameters[ "UseMetadata" ] : false;
				
				// Read providers if available.
				var providerList = [];
				if( parameters.hasOwnProperty( "Providers" ) ) {
				
					// Read providers.
					var providers = parameters[ "Providers" ];
					if( providers && typeof providers === "string" ) {
					
						// Add found provider to the list.
						providerList.push( providers )
					}
					else if( $.isArray( providers ) ) {

						// Add found providers to the list.	
						for( var i in providers ) {			
							if( typeof providers[ i ] === "string" )
								providerList.push( providers[ i ] );			
						}
					}
				}
				
				// Read custom data.
				var customData = ( parameters.hasOwnProperty( "CustomData" ) && typeof parameters[ "CustomData" ] === "string" ) ? parameters[ "CustomData" ] : "";
				
				// Call model to fetch metadata suggestions.
				this.metadatacard.controller.editor.Datamodel.FetchMetadataSuggestions( useFileContent, useMetadata, providerList, customData );
			}
		}
	}
	
	/** 
	 * Returns true if filter condition has matching event rule.
	 *
	 * @param filter - The filter condition.
	 * @param event - Explains why fetching of metadata suggestions has been requested.
	 * @param changedPropertyDef - The changed property definition.
	 */
	this.findEventFromCondition = function( filter, event, changedPropertyDef ) {
		
		// Ensure that we have valid filter condition.
		var conditionFound = false;
		if( filter && typeof filter === "object" ) {
		
			// Check if current filter condition has an event defined and it matches to triggered event.
			if( filter.hasOwnProperty( "Event" ) ) {
			
				// Condition has an event defined. Check if it matches.
				var eventName = null;
				var propertyDefs = [];
				var usePropertyDef = false;
				var events = filter[ "Event" ];
				if( typeof events === "string" ) {
				
					// Event is defined as a string. Use it as is.
					eventName = events;
				}
				else if( events && typeof events === "object" ) {
					
					// Event is defined as an object. Get event name and other parameters from the object. 
					
					// Get event name.
					if( events.hasOwnProperty( "Event" ) ) {
						
						// Ensure that event name is defined as a string.
						var eventField = events[ "Event" ];
						if( typeof eventField === "string" ) {
				
							// Get event name.
							eventName = eventField;
						}
					}
					
					// Get property definition if available.
					if( events.hasOwnProperty( "PropertyDef" ) ) {

						// Get property definition.
						usePropertyDef = true;
						var propertyDefField = events[ "PropertyDef" ];
						
						// Branch by field type.
						if( typeof propertyDefField === "number" ) {
				
							// Property definition defined as a number. Use it as is.
							propertyDefs.push( propertyDefField );
						}
						else if( typeof propertyDefField === "string" ) {
				
							// Property definition defined as a string.
							if( this.isNumericString( propertyDefField ) ) {
								
								// Property definition string contains a number, use it as is.
								var id = this.getNumberFromString( propertyDefField );
								if( id !== null )
									propertyDefs.push( id );
							}
							else {
								
								// Property definition string should be alias, try to convert it to number.
								var id = this.getIdByAlias( propertyDefField, "PropertyDefinition" );
								if( id != undefined )
									propertyDefs.push( id );
							}
						}
						else if( propertyDefField && $.isArray( propertyDefField ) ) {
						
							// Property definition has array of values. Handle the separately.
							for( var i = 0; i < propertyDefField.length; i++ ) {
			
								// Handle each property definition in the array.
								var propertyDef = propertyDefField[ i ];
								
								// Branch by field type.
								if( typeof propertyDef === "number" ) {
						
									// Item defined as a number. Use it as is.
									propertyDefs.push( propertyDef );
								}
								else if( typeof propertyDef === "string" ) {
						
									// Property definition defined as a string.
									if( this.isNumericString( propertyDef ) ) {
										
										// Property definition string contains a number, use it as is.
										var id = this.getNumberFromString( propertyDef );
										if( id !== null )
											propertyDefs.push( id );
									}
									else {
										
										// Property definition string should be alias, try to convert it to number.
										var id = this.getIdByAlias( propertyDef, "PropertyDefinition" );
										if( id != undefined )
											propertyDefs.push( id );
									}
								}
							}
						}
					}
				}
				
				// Check if requested event was found.
				if( eventName === event ) {
				
					// Requested event was found. Check if we should compare property definitions.
					if( usePropertyDef ) {
					
						// Compare changed property definition to property definition(s) in the event.
						if( $.inArray( changedPropertyDef, propertyDefs ) !== -1 )
							conditionFound = true;
					}
					else {
					
						// No property definition to compare. The condition matches for all properties.
						conditionFound = true;
					}
				}
			}
		}
		return conditionFound;
	}
};
