///////// EditManager
function EditManager( metadatacard ) {

	var self = this;
	this.metadatacard = metadatacard;
	
	// Register keyboard focus event for focus-switchers.
	// First focus-switcher is located immediately before class selector and last focus-switcher immediately after all other controls.
	// Because normal focus rotation inside browser control does not work correctly we must manipulate focus rotation here.
	// Note: In bottom pane layout buttons are located between first focus-switcher and actual controls. For that reason we need
	// focus handling also in discard button in case of bottom pane layout. When discard button gets focus in bottom pane layout (by Tab + Shift),
	// previous control, which was Class selector, must be set to view mode manually.
	$( ".focus-switcher" ).focus( function() {

		// First focus switcher.
		if( $( this ).hasClass( "first-focus-switcher" ) ) {
		
			// Handle the situation when first focus switcher gets keyboard focus from class selector (caused by pressing Tab + Shift).
			if( utilities.tabDirection === "backwards" ) {

				// Set class selector to correct state here.
				// This can not be done immediately (because it is asynchronous operation), so we set metadata card to busy state during class selector state change.
				// When class selector is in correct state, move focus to last focus switcher and remove busy flag.
				// When metadata card is in busy state, asynchronous tab keyboard events are not handled.
				self.metadatacard.isBusy = true;				
				self.metadatacard._resetClassSector( function() {
				
					// Operation completed, reset busy flag and move focus to last focus switcher.
					self.metadatacard.isBusy = false;
					$( ".focus-switcher.last-focus-switcher" ).focus();
				} );
	
			}
		
		}
		// Last focus switcher.
		else if( $( this ).hasClass( "last-focus-switcher" ) ) {
		
			// Handle the situation when last focus switcher gets keyboard focus from discard button (caused by pressing Tab).
			if( utilities.tabDirection === "forwards" ) {
				
				// Move focus to first focus switcher.
				$( ".focus-switcher.first-focus-switcher" ).focus();
			}
		}
	} );
	
	// requestEditMode.
	// Function to control moving between edit- and view mode.
	this.requestEditMode = function( control, rowToFocus, callback ) {
	
		// skip edit mode change, if there is an active text selection
		// to ensure nothing is skipped, clear text selections before calling requestEditMode
		if( document.getSelection().rangeCount && !document.getSelection().isCollapsed ) {
			return false;
		}

		var failed = false;

		// When someone requests edit mode, we will try set current controls to view-mode and store their values to model,
		// but dont't cancel the current editing without setting values. If validation of value fails, current control keeps focus.
		var isCancel = false;
		var setFocusToParent = true;	

		// Note: This variable is used only by MSLU control and only if rowToFocus is not defined.
		// If it is true, focus is set to latest lookup item in MSLU (we are moving backwards with Shift + Tab key).
		// If it is false, focus is set to first item (we are moving forwards with Shift + Tab key or not moving at all).
		// If rowToFocus is defined, it tells exactly which row should be focused (row index is calculated based on mouse event in lookupcontrolcontainer). 		
		var focusToLatest = ( utilities.tabDirection === "backwards" ) ? true : false;

		// Check if any controls are in edit mode.
		var controlsInEditMode = [];
		try {
		
			$( ".mf-control" ).each( function() {

				// Store controls which are in edit mode to array.			
				if( $( this ).basecontrol( "inEditMode" ) ) {

					// Store to array.
					controlsInEditMode.push( $( this ) );

					// This breaks each-loop.
					return false;
				}
			} ); // each-loop
		}
		catch( ex ) {
		
			// Catch exception.
			// It might be possible that requestEditMode is called when jQUery UI controls are not yet instantiated in mf-control elements.
		}

		// TODO: Fix this comment ==> If there are any controls in edit mode, we store reference to control which requested activation.
		// It will be activated right away when other controls change back to view mode. And other controls change back to 
		// view mode when we send stopEditing event to them.
		// If there are not any controls in edit mode, set requested control to edit mode now.		
		if( controlsInEditMode.length > 0 ) {

			if( controlsInEditMode.length > 1 )
				throw "Error: Number of controls in edit mode more than 1. [" + controlsInEditMode + "]";

			// There was a control in edit mode.

			var controlInEditMode = controlsInEditMode.pop();
			if( self.updateModelFromUIControl( controlInEditMode ) ) {

				// Edit mode was requested, set requested control to edit mode.		
				if( control && !control.options.readonly ) {
				
					// Inform metadata card that a control is going to switch to view mode.
					metadatacard.switchingToViewMode = true;
					
					// Store control to metadata card.
					metadatacard.activeControl = control;
					
					// Send event to change old control back to view mode.
					controlInEditMode.trigger( "stopEditing", { isCancel: isCancel, setFocusToParent: false } );
					controlInEditMode.closest( "tr" ).removeClass( "mf-accept-viewmode" );
					
					// Inform metadata card that the control has been switched to view mode.
					metadatacard.switchingToViewMode = false;
					
					// Unselect previously selected description control.
					utilities.selectDescriptionControl( controlInEditMode, false );

					// Ignore errors silently.
					try {

						// Set requested control to edit mode.
						control.element.basecontrol( "setToEditMode_Base", rowToFocus, focusToLatest, function() {

							// Add the class.
							control.element.closest( "tr" ).addClass( "mf-accept-viewmode" );

							// Select corresponding description control.
							utilities.selectDescriptionControl( control.element, true );

							// Set metadata card to edit mode.
							metadatacard.setControlState( true, true, true );

							// Call back if necessary.
							if( callback )
								callback();
						} );
					}
					catch( ex ) {
					}
				}
				else {

					// View mode was requested.
					
					// Inform metadata card that a control is going to switch to view mode.
					metadatacard.switchingToViewMode = true;

					// Send event to change old control back to view mode.
					// Last parameter tells to control that is should set the keyboard focus for the container control (property line control)
					// when control itself has moved to view mode.
					controlInEditMode.trigger( "stopEditing", { isCancel: isCancel, setFocusToParent: setFocusToParent } );
					controlInEditMode.closest( "tr" ).removeClass( "mf-accept-viewmode" );
					
					// Inform metadata card that the control has been switched to view mode.
					metadatacard.switchingToViewMode = false;
					
					// Unselect previously selected description control.
					utilities.selectDescriptionControl( controlInEditMode, false );

					// FIXME: Check if this comment is still valid: Note: The code above in else-branch is called also when focus moves to Save button.
					// This is needed to set other controls to view mode when first non-dynamic control gets focus.
					// Actually this is needed for property selector control, which is latest dynamic control
					// and needs some way to be set to view mode when focus moves from dynamic controls to static controls.
					// Note that in case of Save-button, we are NOT moving focus to parent of previous control, which is property selector.

					// Remove stored control from metadata card.
					metadatacard.activeControl = null;

					// Set focused element to null;
					metadatacard.focusedElement = null;

					// Try to set metadata card to view mode. If model has modified values, the card stays in edit mode.
					metadatacard.setControlState( false, true, true );
				}

			}
			else failed = true;

		} else {

			// There was no controls in edit mode.

			// Edit mode was requested, set requested control to edit mode.
			if( control && !control.options.readonly ) {

				// Store control to metadata card. TODO: Add comment.
				metadatacard.activeControl = control;

				// Ignore errors silently.
				try {

					// Set requested control to edit mode.
					control.element.basecontrol( "setToEditMode_Base", rowToFocus, focusToLatest, function() {

						// Add class.
						control.element.closest( "tr" ).addClass( "mf-accept-viewmode" );

						// Select corresponding description control.
						utilities.selectDescriptionControl( control.element, true );

						// Set metadata card to edit mode.
						metadatacard.setControlState( true, true, true );

						// Call back if necessary.
						if( callback )
							callback();
					} );
				}
				catch( ex ) {
				}
			}
			else {

				// View mode was requested.

				// Remove stored control from metadata card.
				metadatacard.activeControl = null;

				// Set focused element to null;
				metadatacard.focusedElement = null;

				// Try to set metadata card to view mode. If model has modified values, the card stays in edit mode.
				metadatacard.setControlState( false, true, true );
			}
		}

		// If we are switching to view mode, ensure here that date picker is destroyed completely. 
		if( !control ) {

			// Hack to remove all HTML elements generated by date picker.
			try {
				$( "#ui-datepicker-div" ).remove();
			} catch( ex ) { }
		}
		return !failed;
	};
	
	// updateModelFromUIControl.
	this.updateModelFromUIControl = function( control ) {
	
		// Inform metadata card that value is changed by user.
		self.metadatacard.setUpdatedByUser( true );
	
		// Update data to model from UI Control.
		var failed = false;
		var errorText = null;
		try {
			// Try to update model. If updating fails in UI, set error text here.
			if ( !control.basecontrol( "updateModel" ) ) {
				failed = true;
				
				// TODO: More specific error descriptions are needed.
				errorText = "Failed";
			}
			
		} catch( ex ) {
		
			// Exception occured in native code. Get error description.
			failed = true;
			errorText = MFiles.GetErrorDescription( ex );
		}
		
		// Inform metadata card that value is no longer changed by user.
		self.metadatacard.setUpdatedByUser( false );
		
		// If updating of model failed, show error message.	
		if ( failed ) {
			
			// Show error message.
			if( self.metadatacard.setError )
				self.metadatacard.setError( errorText, control.basecontrol( "getId" ) );
		
			// Return focus back to control.
			control.basecontrol( "captureFocus_Base", true, true );
			
			// Change the view if needed.
			var propertyDef = control.basecontrol( "option", "propertyDef" );
			self.metadatacard.changeViewBasedOnProperty( propertyDef );
		}
		else {
			
			// Clear error message.
			if( self.metadatacard.setError )
				self.metadatacard.setError( null, control.basecontrol( "getId" ) );
		}
		return !failed;
	};
};
