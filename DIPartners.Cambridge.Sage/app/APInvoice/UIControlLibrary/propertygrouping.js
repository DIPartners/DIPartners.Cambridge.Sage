"use strict";

// Property Grouping
//
// Handles property groups and properties in these groups.
// Property groups can be collapsed and expanded to hide/show the properties under them.
function PropertyGrouping( metadatacard ) {

	var self = this;
	
	// The groups to be shown on the card.
	this.groupConfiguration = null;
		
	// Parent object.
	this.metadatacard = metadatacard;
	
	// TODO: Fix comments.
	
	/**
	 * Gets the correct group for a property definition.
	 */
	this.getGroup = function( propertyDef ) {
	
		// Default group is 0 if there is no other default groups.
		var defaultGroup = 0;
			
		// Loop the group configuration.
		var groups = this.groupConfiguration;
		if( groups ) {
			for( var i = 0; i < groups.length; ++i ) {
		
				// Check if this group has requested property.
				var group = groups[ i ];
				var properties = group.properties;
				if( properties ) {
					for( var j = 0; j < properties.length; ++j ) {
					
						// If the property was found, return this group.
						if( properties[ j ] == propertyDef ) {
							return ( i + 1 );
						}
					}
				}
				
				// Check if this was default group. We return default group if the property
				// don't belong to any other group.
				if( group[ "IsDefault" ] === true )
					defaultGroup = i + 1;
			}
		}
		
		// Specific group for the property was not found, return default group.
		return defaultGroup;
	};
	
	/**
	 * Sets a new group for the target property.
	 */
	this.setGroup = function( targetPropertyDef, newGroup ) {
		
		// Get groups.
		var groups = this.groupConfiguration;
		
		// Remove property from the old group. If group is 0, it actually doesn't exist.
		var oldGroup = this.getGroup( targetPropertyDef );
		if( oldGroup > 0 ) {
		
			// Remove property from the old group.
			if( groups ) {
				var group = groups[ oldGroup - 1 ];
				var properties = group.properties;
				if( properties ) {
					
					// Loop through properties in the group.
					for( var i = 0; i < properties.length; i++ ) {
						
						// If the property is found, remove it.
						if( properties[ i ] == targetPropertyDef ) {
							
							// Remove the property.
							properties.splice( i, 1 );
							break;
						}
					}
				}
			}
		}
		
		// Add property to the new group. If group is 0, it actually doesn't exist.
		if( newGroup > 0 ) {
		
			// Add property to the new group.
			if( groups ) {
				var group = groups[ newGroup - 1 ];
				group.properties.push( targetPropertyDef );
			}
		}
	}

	/**
	 * Is the property grouping currently in use?
	 */
	this.propertyGroupingInUse = function () {

		// We use the existence of .mf-dynamic-tbody to check if the property grouping is currently in use. 
		return ( $( ".mf-dynamic-tbody" ).length  > 0 )
	};
	
	/**
	 * Has defined groups?
	 */
	this.hasDefinedGroups = function() {
	
		// We have defined groups if configuration exists and has more than one group.	
		return ( this.groupConfiguration && this.groupConfiguration.length > 0 ) ? true : false;
	};
	
	/**
	 * Sets a new configuration.
	 */
	this.setConfiguration = function( configuration ) {
		
		// Set the new configuration.
		this.groupConfiguration = configuration;
	};
	
	/**
	 * Adds a property grouping for the current class.
	 */
	this.addGrouping = function () {
		var self = this;
		var groups = this.groupConfiguration;
		if( !groups )
			alert( "INTERNAL ERROR: addGrouping, no group configuration" );
		
		// Add property groups to mf-property-table.
		// Builds a new table and replaces original with it.

		// Create a new table for properties
		var createFunc = utilities.createDocumentElement;
		var newPropertyTable = $( createFunc( 'table', "mf-dynamic-table", "mf-property-table-new" ) );
		var oldPropertyTable = $( "#mf-property-table" );

		// Append the new table to the control container
		var controlContainer = this.metadatacard.element.data( "dynamic-controls" );
		controlContainer.append( newPropertyTable );

		// Get the separator control and add it before property selector table.
		var separator = $( "#mf-property-selector-separator" );
		separator.detach();
		controlContainer.append( separator );

		// Property selector is in its own table, so get it as well.
		var propertySelectorTable = $( "#mf-property-selector-table" );
		propertySelectorTable.detach();
		controlContainer.append( propertySelectorTable );
		
		// Get class selector elements.
		var classSelector = $("#a0").find("tr.mf-property-100");
		var classRowId = classSelector.attr( 'id' );
		var parent = classSelector.parent();
		var classSelectorMessage = parent.find( "#mf-message-row-" + classRowId );
		var classSelectorDescription = parent.find( "#mf-description-row-" + classRowId );
		var classSelectorValueSuggestionArea = parent.find("#mf-valuesuggestion-container-" + classRowId );
		
		// Detach class selector elements. Messgae, description and value suggestion containers may not exist yet => detach is no-op.
		classSelector.detach();
		classSelectorMessage.detach();
		classSelectorDescription.detach();
		classSelectorValueSuggestionArea.detach();
		
		// Create alignment element above class selector to format columns correctly. This is needed for description fields.
		newPropertyTable.append( this.metadatacard.createAlignmentElement() );

		// Attach class selector elements to new property table.
		newPropertyTable.append( classSelectorDescription );
		newPropertyTable.append( classSelector );
		newPropertyTable.append( classSelectorMessage );
		newPropertyTable.append( classSelectorValueSuggestionArea );

		// Create first group. First group is an invisible, common group which holds all the properties which do not belong in any other group.
		var elemTableBody = createFunc( 'tbody', "mf-dynamic-tbody mf-propertygroup-common", "mf-property-group-0" );
		var elemTableRow = createFunc( 'tr', "mf-propertygroup-title", "propertygroup-title-0" );
		var elemTableHeader =  document.createElement( 'th' );
		elemTableHeader.setAttribute( 'colspan', '4' );
		elemTableRow.appendChild( elemTableHeader );
		elemTableBody.appendChild( elemTableRow );
		var tbody = $( elemTableBody );

		// Append common group.
		newPropertyTable.append( tbody );
		
		// Get colors from the theme.
		var color = this.metadatacard.configurationManager.get( "MetadataCard.Theme.Groups.Header.Color" );
		var backgroundColor = this.metadatacard.configurationManager.get( "MetadataCard.Theme.Groups.Header.BackgroundColor" );
		
		// Ensure the existence of the tbodies according to groups.
		var groupingLength = groups.length;
		for( var i = 1; i <= groupingLength; ++i ) {

			// Get the group.
			var group = groups[ i - 1 ];

			// Create IDs for tbody and title.
			var tbodyId = "mf-property-group-" + i;
			var titleId = "propertygroup-title-" + i;

			// Create tbody element
			elemTableBody = createFunc( 'tbody', "mf-dynamic-tbody", tbodyId );

			// Check if the group has tooltip.
			if( group.hasOwnProperty( "tooltip" ) ) {

				// Set tooltip text. Note: there is no need to use utilities.encodehtml() to sanitize tooltip text, because title-attribute shows html as text.
				elemTableBody.setAttribute( "title", group.tooltip );
			}

			// Create child elements of the property grouping body.
			elemTableRow = createFunc( 'tr', "mf-propertygroup-title", titleId );
			elemTableHeader =  document.createElement( 'th' );
			elemTableHeader.setAttribute( 'colspan', '4' );

			// Set the title if it's defined.
			// The "title" is HTML encoded, so getting the HTML contents by using html() method.
			if( group.hasOwnProperty( "title" ) && group.title !== null ) {
					$( elemTableHeader ).html( group.title );
			}
			var groupTitle = $( elemTableRow );
			elemTableRow.appendChild( elemTableHeader );
			elemTableBody.appendChild( elemTableRow );
			var tbody = $( elemTableBody );

			// Other property groups, which may or may not collapse.

			// Create separator control and add it before property selector table.
			// HACK: This is just imitating a CSS border-top, but it seemed impossible to do this with CSS, since mf-dynamic-namefield has been set to relative position so that its child, mandatory
			//       field indicator (*), can be positioned to correct place. This had a side effect, that mf-dynamic-namefield grows so that it fills the space between th element and itself.
			elemTableBody =  document.createElement( 'tbody' );
			elemTableRow = createFunc( 'tr', "mf-propertygroup-separator", titleId + '-separator-top' );
			var separatorTop = $( elemTableRow ); // shortcut
			var elemTableData = document.createElement( 'td' );
			elemTableData.setAttribute( 'colspan', '4' );
			elemTableRow.appendChild( elemTableData );
			elemTableBody.appendChild( elemTableRow );
			var separatorTop = $( elemTableBody );

			// Initialize additional classes for the table body.
			var tbodyAdditionalClasses = "";

			// Check if the group has header.
			if( group[ "HasHeader" ] === false ) {
				tbodyAdditionalClasses += "mf-propertygroup-no-header";
			}

			// append separator and group.
			newPropertyTable.append( [ separatorTop, tbody ] );

			// Set group theme.
			if( color !== null)
				groupTitle.css( "color", color );
			if( backgroundColor !== null )
				groupTitle.css( "background-color", backgroundColor );
			
			// Create separator control and add it after property selector table header.
			// HACK: Same as with separator-top.
			elemTableRow = createFunc( 'tr', "mf-propertygroup-separator", titleId + '-separator-bottom' );
			var separatorBottom = $( elemTableRow );
			elemTableData = document.createElement( 'td' );
			elemTableData.setAttribute( 'colspan', '4' );
			elemTableRow.appendChild( elemTableData );
			tbody.append( elemTableRow );

			// Check if the group is hidden.
			if( group[ "IsHidden" ] === true ) {

				// Hide the group.
				separatorTop.hide();
				tbody.hide();
				$( elemTableRow ).hide();
			}

			// Add the expand / collapse events if this group is defined as collapsible.
			if( group[ "IsCollapsible" ] === true ) {

				// Add class for collapsible.
				tbodyAdditionalClasses += " mf-propertygroup-collapsible";

				// Init groups which are collapsed by default.
				if( group[ "IsCollapsedByDefault" ] === true )	
					tbodyAdditionalClasses += " mf-propertygroup-collapsed";

				// Expand / collapse for property group.
				$( "#" + titleId ).click( function() {
					self.groupClicked( this )
				} );
					
				// Expand / collapse for separator top (so that the separator becomes clickable and mouse icon is displayed correctly).
				$( "#" + titleId + "-separator-top" ).click( function( event ) {
					var collapsibleHeaderId = this.id.replace( "-separator-top", "" );
					$( "#" + collapsibleHeaderId ).click();
				} );

				// Expand / collapse for separator bottom (so that the separator becomes clickable and mouse icon is displayed correctly). 
				$( "#" + titleId + "-separator-bottom" ).click( function( event ) {
					var collapsibleHeaderId = this.id.replace( "-separator-bottom", "" );
					$( "#" + collapsibleHeaderId ).click();
				} );

			} /* group.isCollapsible */

			// Add additional classes for the body.
			tbody.addClass( tbodyAdditionalClasses );

		} /* For */
		
		// Detach UI controls.
		var currentControls = this.metadatacard.detachUIControls( oldPropertyTable );
		
		// Attach UI controls to groups.
		this.metadatacard.attachUIControls( newPropertyTable, this, currentControls );
			
		// Can't hide items which are collapsed by default, before they are in place. So hide them in here.
		$( ".mf-propertygroup-collapsed" ).children( ".mf-dynamic-row" ).hide();

		// Update collapsibility status of groups based on whether there are items under them.
		this.updateCollapsibility( groups );
		
		// Remove the old table.
		oldPropertyTable.remove();

		// Rename the table.
		newPropertyTable.attr( "id", "mf-property-table" );
	};

	/**
	 * Removes the property grouping layout.
	 */
	this.removeGrouping = function() {

		// Get the property table
		var propertyTable = $( "#mf-property-table" );

		// Store class selector.
		// TODO: Ensure that classes are OK...
		var classSelector = $( "#a0").find("tr.mf-property-100" );
		var classRowId = classSelector.attr( 'id' );
		var parent = classSelector.parent();
		var classSelectorMessage = parent.find( "#mf-message-row-" + classRowId );
		var classSelectorDescription = parent.find( "#mf-description-row-" + classRowId );
		var classSelectorValueSuggestionArea = parent.find( "#mf-valuesuggestion-container-" + classRowId );
		
		// Detach class selector.
		classSelector.detach();
		classSelectorMessage.detach();
		classSelectorDescription.detach();
		classSelectorValueSuggestionArea.detach();
		
		// Detach UI controls.
		var currentControls = this.metadatacard.detachUIControls( propertyTable ); 
		
		// Empty the whole property table to get rid of the layout.
		propertyTable.empty();
		
		// Create alignment element above class selector to format columns correctly. This is needed for description fields.	
		propertyTable.append( this.metadatacard.createAlignmentElement() );

		// Restore class selector.
		propertyTable.append( classSelectorDescription );
		propertyTable.append( classSelector );
		propertyTable.append( classSelectorMessage );
		propertyTable.append(classSelectorValueSuggestionArea);
	
		// Restore UI controls.
		this.metadatacard.attachUIControls( propertyTable, null, currentControls ); 		
	};
	
	/**
	 * Called when property group is clicked.
	 */
	this.groupClicked = function( obj ) {

		// Get current group.
		var currentGroup = $( "#" + obj.id ).parent();				
						
		// Check the current class to see if we want to expand or collapse the controls.
		var collapse = ( currentGroup.attr( "class" ).indexOf( "mf-propertygroup-collapsed" ) === -1 );
		
		// If clicked group has no header, it is not allowed to collapse/expand the group.
		// Without this line, user is able to accidentally collapse group by clicking to thin invisible area below hidden header. 
		if( currentGroup.hasClass( "mf-propertygroup-no-header" ) )
			return;
		
		// Hide or show the siblings according to the command type.
		if( collapse ) {
			
			// First, make sure there are no fields in edit mode.  If edit mode is switched after the 
			// grouping is collapsed its size calculations will be incorrect.  This is because the hide() 
			// method sets the "display: none" style, which means that any descendants will not have 
			// measurable dimensions.
			self.metadatacard.editManager.requestEditMode( null );

			// Hide the siblings.
			$( "#" + obj.id ).siblings( ".mf-description-row" ).hide();
			$( "#" + obj.id ).siblings( ".mf-dynamic-row" ).hide();
			$( "#" + obj.id ).siblings( ".mf-message-row" ).hide();
			$( "#" + obj.id ).siblings( ".mf-valuesuggestion-container-row" ).valuesuggestioncontainer( "setHidden", true );
		}
		else {
			// Loop through all property lines.
			$( "#" + obj.id ).siblings( ".mf-dynamic-row" ).each( function() {
			
				// Show property only if it should be visible.
				var propertyLine = $( this );
				if( propertyLine.propertyline( "isVisible" ) ) {
					
					// Show the property line.
					propertyLine.show();
					
					// Try to show the value suggestion area, as well.
					propertyLine.siblings( ".mf-valuesuggestion-container-row" ).valuesuggestioncontainer( "setHidden", false );

					// Enable the more button and its associated control, so that it can be expanded if necessary.
					propertyLine.find( ".mf-height-control" ).show();
					propertyLine.find( ".mf-more-button" ).show();
				}
					
				// Note: there is no need to show message- or description line.
				// They are no longer visible because control leaves the focus when user clicks group header.
			} );
			
		}

		// Change the collapse status of the group.
		currentGroup.toggleClass( "mf-propertygroup-collapsed" );
	};

	/**
	 * Checks if we should change the collapsibility status of the property group. This becomes necessary when there are no
	 * items under property group and some or added, or if there are items under property group, but they are removed.
	 */
	this.updateCollapsibility = function ( groups ) {
	
		// Preliminary checks for update (get out fast).
		if( ( $( "#mf-property-table" ).length ) ) {
		
			// Loop the configuration.
			for( var i = 0; i <= groups.length; ++i ) {

				// Dig up the collabsibility for each element and if they are marked as collapsible evaluate if they should keep the
				// status at this point (empty groups are not collapsible).
				if( i > 0 && groups[ i-1 ][ "IsCollapsible" ] === true ) { 

					// Extract title and collapsibility from parent tbody.
					var titleId = "propertygroup-title-" + i;
					var title = $( "#" + titleId );
					var collapsible = title.parent().hasClass( "mf-propertygroup-collapsible" );

					if( collapsible && title.siblings( ".mf-dynamic-row" ).length === 0 ) {

						// Title is collapsible, but there are currently no items under it. Remove collapsible.
						title.parent().removeClass( "mf-propertygroup-collapsible" );
						title.off( "click" );
					}
					else if( !collapsible && title.siblings( ".mf-dynamic-row" ).length ) {

						// Title is not collapsible, but there are currently items under it. Add collapsible.
						title.parent().addClass( "mf-propertygroup-collapsible" );
						title.click( function() {
							self.groupClicked( this ) 
						} );
					}
				}
			}
		}
	};

	/**
	 * Expands the property group which holds the property line. This is used to expand the group in case there is an error to be shown.
	 */
	this.expand = function( propertyLine ) {

		// Expand if there is a configuration, parent is collapsible and is currently collapsed.
		if( propertyLine.parent().hasClass( "mf-propertygroup-collapsible mf-propertygroup-collapsed" )  ) {
		
			// TODO: Show only visible rows!
			
			// Always show dynamic rows.
			propertyLine.parent().children( ".mf-dynamic-row" ).show();
					 
			// Show property comment lines which have textual content (error messages).
			propertyLine.parent().children( ".mf-message-row" ).each( function() {
				if( $( this ).text() )
				   $( this ).show();
			});
			
			// TODO: How about description field????

			// Parent is no longer collapsed.
			propertyLine.parent().removeClass( "mf-propertygroup-collapsed" );
		}
	};

};