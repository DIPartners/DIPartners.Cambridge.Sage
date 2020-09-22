( function( $, undefined ) {

	// mfiles.metadatacard
	$.widget( "mfiles.metadatacard", {

		// options.
		options: {
		},

		// _create.
		// Creates this metadatacard widget.
		_create: function() {
			utilities.log( "Metadata create starting.", { "showTimestamp" : true } );
			utilities.startTimingOpenMetadataCard();
			var self = this;

			// Counter to control refresh calls.
			this.refreshReqCount = 0;

			this.anyControlInEditMode = false;
			this.inEditMode = false;

			// This is true when any control is in progress to change to edit mode.	
			this.isBusy = false;
			
			// A property definition of conflicting control. This is set when an event to update property value is
			// received when the control is already in edit mode.
			this.conflictingControl = null;

/*RSS
			// The local model.
			// Handles properties and corresponding UI controls.
			this.localModel = new LocalModel( this );
			this.localModel.initialize();
*/
			
			// The list of property tooltips.
			this.propertyTooltips = {};
			
			// The list of property descriptions.
			this.propertyDescriptions = {};
			
			// The list of property label texts.
			this.propertyLabels = {};
			
			// The list of custom UI controls.
			this.customUIControls = {};

			// UI Control, which is in edit mode.
			this.activeControl = null;

			this.stateProperty = null;

			// The focused element.
			this.focusedElement = null;

			// Variable to indicate if focus is already set when we are scrolling the page using scrollbar.
			this.focusSetWhenScrolling = false;

			// TODO: These flags should be implemented in the model.
			this.controlAddedByUser = false;
			this.controlRemovedByUser = false;
			this.itemRemovedByUser = false;  // True, when an item in MSLU control will be removed by the user.
			this.propertyValueChangedByUser = false;  // True, when change to property value is done by user.
			
			// Flag which tells if model is ready. This will be set to true when function contentInitialized is called.
			this.contentIsReady = false;
			
			// True to postpone getting of comments to phase where function contentInitialized is called. 
			// This will be set to true if model is not yet ready when comments are requested.
			// If this is true when contentInitialized is called, comments are handled there.
			this.postponeCommentHandling = false;
			
			// True, when lookup control is switching to view mode.
			// This flag is used by editmanager and configurationamanager.
			this.switchingToViewMode = false;
			
			// Bind click event to this element with 'metadatacard' namespace.
			this.element.bind( "click.metadatacard", function( event ) {
				self.editManager.requestEditMode( null );
			} );

			// When control has completed change to edit-mode, isBusy flag is set to false.
			this.element.bind( "completed.metadatacard", function( event ) {
				self.isBusy = false;
			} );

			// If user adds a new control from property selector,
			// store the information about that.
			// When we receive event about created control from model,
			// we can set keyboard focus for this control.
			this.element.bind( "controlAdded.metadatacard", function( event ) {
				self.controlAddedByUser = true;
			} );

			// Controls created after visible controls are ready.
			this.deferredControlCreation = {
				deferredControls: [],
				timeoutId: undefined,
				executed: false,
				reschedule: false
			};

			// Metadata suggestions.
			this.metadataSuggestions = {
				index: -1,  // Index for spinner graphics.
				intervalId: -1,  // Interval id for spinner.
				running: false  // True if metadata analysis is ongoing.
			};

			this.propertyGrouping = null;

			// Initialize an array for warning texts that will be shown for text controls. For example
			// indicating that given object name was too long and has been shortened.
			this.textControlWarnings = [];

			// Register global keyboard handler to control tab keys.
			utilities.registerGlobalKeyboardHandler( this );
			
			// Write information to the metadata card log.
			utilities.log( "Metadata card created.", { "showTimestamp" : true } );
		},

		// Use the _setOption method to respond to changes to options.
		_setOption: function( key, value ) {

			// In jQuery UI 1.9 and above, use the _super method to call base widget.
			this._super( "_setOption", key, value );
		},

		// Clean up any modifications your widget has made to the DOM.
		_destroy: function() {

			// Cancel deferred control creation if it is pending.
			var deferredCreation = this.deferredControlCreation;
			if ( deferredCreation.timeoutId ) {
				clearTimeout( deferredCreation.timeoutId );
				deferredCreation.timeoutId = undefined;
			}

			// Unbind events.
			this.element.unbind( "click.metadatacard" );
			this.element.unbind( "completed.metadatacard" );
			this.element.unbind( "controlAdded.metadatacard" );
			this.element.find( "#mf-properties-view" ).tooltip( "destroy" ).off( "click.revertValue" );
		},

		// requestResize.
		requestResize: function() {

			// Trigger a window resize event.	
			clearTimeout( this.resizeTimeout );
			this.resizeTimeout = setTimeout( function() {
				$( window ).resize();
			}, 0 )

		},

		// initialize.
		initialize: function( controller, initParameters ) {
			var self = this;
			this.controller = controller;
			this.localization = controller.getLocalization();
			this.valueListTooltips = false;

			// Detect right-to-left layout.
			var rtl = ( $( "html.mf-rtl" ).length > 0 ) ? true : false;

			// Create and initialize configuration manager.
			this.configurationManager = new ConfigurationManager( this );
			this.configurationManager.initialize( initParameters.enableConfigurability );

			// Set editor for utilities class.
			utilities.setEditor( controller.editor );

			// Instantiate the edit manager.
			this.editManager = new EditManager( this );
			
			// Create container for dynamic controls.
			this._createContainerForDynamicControls( "a0", "dynamic-controls" );

			// Create container for Save as type selector.
			this._createContainerForDynamicControls( "save-as", "saveas-controls" );

			// Create container for workflow and state controls.
			this._createContainerForDynamicControls( "a1", "workflow-controls" );

/*RSS
			// Initialize static controls.
			this._initializeStaticControls( 
				this.controller.getTitle(),
				this.controller.getObjectId(),
				this.controller.getObjectVersion(),
				this.controller.getObjectType(),
				this.controller.getCheckedOut()
			);
*/
	
			// Initialize and hide the error text area.
			$( "#metadatacard-error-info" ).hide();
			$( "#metadatacard-error-info-longerror" ).hide();
			var htmlDetails = "<a href='javascript:void(0);' class='mf-link'>";
			var localizationStrings = this.localization.strings;
			htmlDetails += utilities.htmlencode( localizationStrings.IDS_METADATACARD_ERRORINFO_LINKTEXT_DETAILS );
			htmlDetails += "</a>";
			$( "#metadatacard-error-info-detailsbutton" ).html( htmlDetails ).click( function( event ) {

				// Show the details and hide the details link.
				$( "#metadatacard-error-info-longerror" ).show();
				$( this ).hide();

			} ).show();

			// Initialize texts.
			$( ".mf-comments-text" ).text( localizationStrings.IDS_METADATACARD_BUTTON_COMMENTS );
			$( ".mf-comments-button" ).attr( "title", localizationStrings.IDS_METADATACARD_BUTTON_COMMENTS );
			$( ".mf-properties-text" ).text( localizationStrings.IDS_METADATACARD_BUTTON_PROPERTIES );
			$( ".mf-properties-button" ).attr( "title", localizationStrings.IDS_METADATACARD_BUTTON_PROPERTIES );
			$( ".mf-permissions-text" ).text( localizationStrings.IDS_METADATACARD_LABEL_PERMISSIONS );
			$( ".mf-workflow-text" ).text( localizationStrings.IDS_STR_PROPERTYDEF_WORKFLOW );
			$( ".mf-state-text" ).text( localizationStrings.IDS_STR_PROPERTYDEF_STATE );
			$( ".mf-preview-button" ).attr( "title", localizationStrings.IDS_METADATACARD_BUTTON_SHOWPREVIEW );
			$( ".mf-settings-button" ).attr( "title", localizationStrings.IDS_METADATACARD_BUTTON_SETTINGSMENU );

/*RSS
			// Initialize the header bar expanded/collapsed state.
			self.applyHeaderState();

			// Initialize the minimized state.
			self.applyMinimizedState();

			$( ".mf-location-item" ).text( localizationStrings.IDS_METADATACARD_ITEM_TOGGLE_LOCATION );
			$( ".mf-popout-item" ).text( localizationStrings.IDS_METADATACARD_ITEM_POPOUT );
			$( ".mf-help-item" ).text( localizationStrings.IDS_METADATACARD_ITEM_HELP );

			// Initialize the permissions description.
			$( ".mf-permissions" ).text( this.controller.getPermissionsDescription() );
			$( ".mf-permission-button, .mf-permission-section" ).attr( "title", localizationStrings.IDS_METADATACARD_LABEL_PERMISSIONS );

			// Click handler for permissions dialog box.
			$( ".mf-permission-section, .mf-permission-button" ).click( function() {

				// Show the Permissions dialog box.
				self.permissions();
			} );

			// Create controls for comment view.
			self._createControlsForCommentView( this.controller.getCommentControl() );
*/

			// Create save button.
			var saveLabel = localizationStrings.IDS_METADATACARD_COMMAND_SAVE;
			var saveTooltip = localizationStrings.IDS_METADATACARD_BUTTON_TOOLTIP_SAVE;
/*RSS
			if( self.controller.editor.DataModel.UncreatedObject ) {
				saveLabel = localizationStrings.IDS_METADATACARD_COMMAND_CREATE;
				saveTooltip = localizationStrings.IDS_METADATACARD_BUTTON_TOOLTIP_CREATE;
			}
*/
			$( ".mf-save-button" ).button( { label: saveLabel } ).click( function( event ) {
				
				// Save.
				self.onSave();

				// Stop event propagation.
				event.stopPropagation();
			} );
			$( ".mf-save-button" ).attr( "title", saveTooltip );

			// Create discard button.
			$( ".mf-discard-button" ).button( { label: localizationStrings.IDS_METADATACARD_BUTTON_DISCARD } ).click( function( event ) {
			
				// If we are in comments view, try to move all controls to view mode. This ensures that the text
				// from the "New comment" field is stored to the model before actual discarding.
				if( $( "#mf-comments-view" ).css( "display" ) !== "none" )
					self.editManager.requestEditMode( null );
				
				// Clear property suggestions.
				$( "#mf-property-suggestions" ).suggestioncontrol( "clearPropertySuggestions" );
				
				// Discard metadata.
				self.discard();

				// Stop event propagation.
				event.stopPropagation();
				
			} );
/*RSS			
			// Create analyze button.
			$( ".mf-analyze-button" ).button( { label: localizationStrings.IDS_METADATACARD_BUTTON_ANALYZE } ).click( function( event ) {
				
				// Analyze the object and suggest metadata.
				self.analyze();

				// Stop event propagation.
				event.stopPropagation();
			} );
			$( ".mf-analyze-button" ).attr( "title", localizationStrings.IDS_METADATACARD_BUTTON_TOOLTIP_ANALYZE );
			
			// Create settings menu behavior.
			var preventMenuBlur, justOpened;
			$( "#mf-settings-menu" ).mousedown( function( event ) {
				preventMenuBlur = true;
				justOpened = false;
				event.stopPropagation();
				event.preventDefault();
			} ).mouseup( function( event ) {
				$( this ).addClass( "ui-state-hidden" );
				preventMenuBlur = false;
				if( justOpened && $( event.target ).closest( ".ui-menu-item" ) ) {
					setTimeout( function() {
						$( event.target ).click();
					}, 0 )
				} else {
					event.stopPropagation();
					event.preventDefault();
				}
			} )

			// bind to the settings menu button
			$( ".mf-settings-button" ).mousedown( function( event ) {

				$( this ).focus();

				$( "#mf-settings-menu" ).toggleClass( "ui-state-hidden" ).position( {
					my: ( rtl ? "left top" : "right top" ),
					at: ( rtl ? "left bottom+4" : "right bottom+4" ),
					of: $( this )
				} );

				justOpened = true;
				event.stopPropagation();
				event.preventDefault();

			} ).blur( function( event ) {
				if( !preventMenuBlur )
					$( "#mf-settings-menu" ).addClass( "ui-state-hidden" );
				else
					preventMenuBlur = false;
			} ).on( "mouseup click", function( event ) {
				event.stopPropagation();
				event.preventDefault();
			} );

			// Create the "header expand/collapse" button.
			$( ".mf-toggleheader-button" ).click( function( event ) {

				// Resolve the current state and go to the new state.
				var headerExpanded = self.controller.editor.GetUIData( "HeaderExpanded", true );
				headerExpanded = !headerExpanded;

				// Expand/collapse the header in right pane.
				self.element.toggleClass( "mf-header-collapsed", !headerExpanded );

				// Update the tooltip text.
				if( !headerExpanded )
					$( this ).attr( "title", self.localization.strings.IDS_METADATACARD_BUTTON_EXPAND_TITLE );
				else
					$( this ).attr( "title", self.localization.strings.IDS_METADATACARD_BUTTON_COLLAPSE_TITLE );

				// Persist the setting.
				self.controller.editor.StoreUIData( "HeaderExpanded", headerExpanded, true, true, true );

				// Resize.
				self.requestResize();

			} );

			// Create the minimize button.
			$( ".mf-toggleminimized-button" ).click( function( event ) {

				// Resolve the current state and go to the new state.
				var minimized = self.controller.editor.Minimized;
				self.minimizeMetadataCard( !minimized );

			} );

			// Create pop out button.
			$( ".mf-popout-button" ).click( function( event ) {

				// Pop metadata card out. It is allowed to pop out also in edit mode.
				self.popOut();

			} );

			// Create location toggle button.
			$( ".mf-location-button" ).click( function( event ) {

				// Toggle location if we are not in edit mode.
				if( !self.inEditMode )
					self.toggleLocation();
			} );

			// Create preview button behavior.
			$( ".mf-preview-button" ).click( function( event ) {

				// Request the previewer to display content. Do not let exceptions escape to jQuery.
				try {

					// Show or hide the preview.
					if( self.controller.editor.PreviewerVisible ) {
						self.hidePreview();
					}
					else {
						self.showPreview();
					}
				}
				catch( ex ) {

					// Show the error.
					MFiles.ReportException( ex );
				}

				// Stop event propagation.
				event.stopPropagation();

			} );

			// Create skip button.
			$( ".mf-skip-button" ).button( { label: this.localization.strings.IDS_METADATACARD_COMMAND_SKIPTHIS } ).click( function( event ) {

				// Discard metadata.
				self.skip();

				// Stop event propagation.
				event.stopPropagation();

			} );

			// Create Apply All button.
			$( ".mf-saveall-button" ).button( { label: this.localization.strings.IDS_METADATACARD_COMMAND_CREATEALL } ).click( function( event ) {

				// Try to move all controls to view mode to check that there is no invalid values before saving.
				// If there are, saving is not allowed.
				if( self.editManager.requestEditMode( null ) ) {

					// Save metadata.
					self.saveAll();
				}

				// Stop event propagation.
				event.stopPropagation();

			} );

			// Construct the Use as Defaults check box.
			var optionUseAsDefaults = self.controller.editor.GetUseAsDefaultsOption();
			$( "#mf-useasdefaults-label" ).text( optionUseAsDefaults.GetName() );
			$( "#mf-useasdefaults-checkbox" )
				.prop( "checked", optionUseAsDefaults.GetOptionValue() )
				.prop( "disabled", !optionUseAsDefaults.IsEnabled() )
				.click( function( event ) {

					// Persist the new option value.
					optionUseAsDefaults.SetOptionValue( $( this ).prop( "checked" ) );
				} );

			// Construct the Check In Immediately check box.
			var optionCheckInImmediately = self.controller.editor.GetCheckInImmediatelyOption();
			$( "#mf-checkinimmediately-label" ).text( optionCheckInImmediately.GetName() );
			$( "#mf-checkinimmediately-checkbox" )
				.prop( "checked", optionCheckInImmediately.GetOptionValue() )
				.prop( "disabled", !optionCheckInImmediately.IsEnabled() )
				.click( function( event ) {

					// Persist the new option value.
					optionCheckInImmediately.SetOptionValue( $( this ).prop( "checked" ) );
				} );

			// Construct the Open for Edit check box.
			var optionOpenForEdit = self.controller.editor.GetOpenForEditOption();
			$( "#mf-openforedit-label" ).text( optionOpenForEdit.GetName() );
			$( "#mf-openforedit-checkbox" )
				.prop( "checked", optionOpenForEdit.GetOptionValue() )
				.prop( "disabled", !optionOpenForEdit.IsEnabled() )
				.click( function( event ) {

					// Persist the new option value.
					optionOpenForEdit.SetOptionValue( $( this ).prop( "checked" ) );
				} );

			// Register checkbox events.
			self._registerCheckboxEvents( optionUseAsDefaults, "mf-useasdefaults" );
			self._registerCheckboxEvents( optionCheckInImmediately, "mf-checkinimmediately" );
			self._registerCheckboxEvents( optionOpenForEdit, "mf-openforedit" );

			// Hide checkboxes which are not needed.
			if( !self.controller.editor.DataModel.UncreatedObject )
				$( "#mf-newobject-controls" ).hide();
			else {

				if( !optionUseAsDefaults.IsVisible() ) {
					$( "#mf-useasdefaults" ).hide();
				}
				if( !optionCheckInImmediately.IsVisible() ) {
					$( "#mf-checkinimmediately" ).hide();
				}
				if( !optionOpenForEdit.IsVisible() ) {
					$( "#mf-openforedit" ).hide();
				}
			}

			// Update metadata card layout based on whether it is popped out or not.
			if( self.controller.editor.IsPoppedOut() )
				self.applyPoppedOutLayout();
			else
				self.applyDockedLayout();

			// Create button to switch to properties views.
			$( ".mf-properties-button" ).click( function( event ) {

				// Switch to properties view.
				self.switchToPropertiesView();

				// Stop event propagation.
				event.stopPropagation();
			} );

			// Create button to switch to comments views.
			$( ".mf-comments-button" ).click( function( event ) {

				// Switch to comments view.
				self.switchToCommentsView();

				// Unminimize the metadata card.
				self.minimizeMetadataCard( false );

				// Stop event propagation.
				event.stopPropagation();
			} );

			// Switch to comments view if it was active.
			if( this.controller.editor.ActiveView == "comments" ) {

				// Switch to comments view.
				this.switchToCommentsView();

				// Unminimize the metadata card.
				this.minimizeMetadataCard( false );
			}

			// Bind object operation option handlers.
			self._bindImageButtonEvents( $( ".mf-followthisobject-button" ), self.controller.editor.GetFollowThisObjectOption() );
			self._bindImageButtonEvents( $( ".mf-favoriteobject-button" ), self.controller.editor.GetFavoriteObjectOption() );
*/
			// Listen scroll events.	
			$( ".ui-scrollable" ).scroll( function() {

				// Notify active control about scolling by calling function viewScrolled (if the function exists).
				if( self.activeControl && self.activeControl.viewScrolled )
					self.activeControl.viewScrolled();
					
				// Set focus when users starts to scroll content using scrollbar.
				// This must be done only once, otherwise setting of focus tries to relocate page during scrolling.	
				if( self.focusedElement && !self.focusSetWhenScrolling ) {
					self.focusedElement.focus();
					self.focusSetWhenScrolling = true;
				}
			} ).mousedown( function() {
				self.focusSetWhenScrolling = false;
			} );

			// Listen resize events.
			$( window ).resize( function() {

				self.refreshReqCount = 0;
				self.resizeLayout();
			} );

			// control text-selectability
			this._limitTextSelection( ".mf-internal-text, .ui-allow-textselection, .mf-comments-list>li, .mf-valuefield" );

			// For testing. Create a button to open a new browser window and copy generated HTML to this window. 
			$( "#mf-export-button" ).button().click( function( event ) {

				// Export HTML after 5 secons.
				// So there is time e.g. to open some list before snapshot is taken.
				setTimeout( function() {
					self.controller.exportData();
				}, 5000 );

				// Stop event propagation.
				event.stopPropagation();
			} );
			
			// Add an event listener for keyboard shortcuts.
			$( document ).on( "keydown.accelerators", function( e ) {

				// Process keyboard shortcuts.
				if( ! e.altKey && e.ctrlKey && e.which == "S".charCodeAt( 0 ) ) {

					// CTRL+S.

					// Is save button visible?
					if( $( ".mf-save-button" ).is( ":visible" ) == true ) {
							
						// Button is visible, save.
						self.onSave();
					}
				}
			} );

			// Write information to the metadata card log.
			utilities.log( "Metadata card initialized.", { "showTimestamp" : true } );
		}, // end of initialize

		_registerCheckboxEvents: function( checkBox, checkBoxName ) {

			// Register EnabledStateChanged event for check box.
			this["enabledStateChanged-" + checkBoxName] = checkBox.Events.Register( MFiles.Event.EnabledStateChanged, function( enabled ) {
				$( "#" + checkBoxName + "-checkbox" ).prop( "disabled", !enabled );
			} );

			// Register VisibilityChanged event for check box.
			this["visibilityChanged-" + checkBoxName] = checkBox.Events.Register( MFiles.Event.VisibilityChanged, function( visible ) {
				if( visible )
					$( "#" + checkBoxName ).show();
				else
					$( "#" + checkBoxName ).hide();
			} );

			// Register OptionValueChanged event for check box.
			this["optionValueChanged-" + checkBoxName] = checkBox.Events.Register( MFiles.Event.OptionValueChanged, function( newValue ) {
				$( "#" + checkBoxName + "-checkbox" ).prop( "checked", newValue );
			} );
		},

		_bindImageButtonEvents: function( domElement, metadataCardOption ) {
			/// <summary>
			///     Registers event handlers to follow changes in the metadatacard option object and in UI.
			/// </summary>
			/// <param name="domElement" type="DOM element">
			///     The DOM element that is bound with the metadata card option.
			/// </param>
			/// <param name="metadataCardOption" type="IMetadataCardOption">
			///     The metadata card option object that acts as a model for the UI.
			/// </param>

			// Bind to the enabled state change event.
			metadataCardOption.Events.Register( MFiles.Event.EnabledStateChanged, function( enabled ) {

				// Model requested the enabled state change. Set or unset the disabled flag in DOM element correspondinly.
				domElement.prop( "disabled", !enabled );
			} );

			// Bind to the visibility changed event.
			metadataCardOption.Events.Register( MFiles.Event.VisibilityChanged, function( visible ) {

				// Model requested the visibility change. Show or hide the DOM element correspondinly.
				domElement.toggleClass( "ui-state-hidden", !visible );

			} );

			// Bind to the value change event.
			metadataCardOption.Events.Register( MFiles.Event.OptionValueChanged, function( newValue ) {

				// Model announced a new value for the option.
				if( newValue )
					domElement.removeClass( "ui-state-off" );
				else
					domElement.addClass( "ui-state-off" );
			} );

			// Bind to the name change event.
			metadataCardOption.Events.Register( MFiles.Event.NameChanged, function( newName ) {

				// Set the new name.
				domElement.text( newName );
			} );

			// Bind to the explanation change event.
			metadataCardOption.Events.Register( MFiles.Event.ExplanationChanged, function( newExplanation ) {

				// Set the new explanation.
				domElement.attr( "title", newExplanation );
			} );

			// Bind the DOM element click handler.
			domElement.click( function( event ) {

				// The DOM element was clicked. Invert the option value.
				metadataCardOption.SetOptionValue( !metadataCardOption.GetOptionValue() );
			} );

			// Set the option button initial state.
			domElement.text( metadataCardOption.GetName() );
			domElement.attr( "title", metadataCardOption.GetExplanation() );
			if( metadataCardOption.GetOptionValue() )
				domElement.removeClass( "ui-state-off" );
			else
				domElement.addClass( "ui-state-off" );


			domElement.toggleClass( "ui-state-hidden", !metadataCardOption.IsVisible() );


		},

		_unregisterCheckboxEvents: function( checkBox, checkBoxName ) {

			var enabledStateChangedHandle = this["enabledStateChanged-" + checkBoxName];
			if( enabledStateChangedHandle !== undefined ) {
				checkBox.Events.UnRegister( enabledStateChangedHandle );
			}

			var visibilityChangedHandle = this["visibilityChanged-" + checkBoxName];
			if( visibilityChangedHandle !== undefined )
				checkBox.Events.UnRegister( visibilityChangedHandle );

			var optionValueChangedHandle = this["optionValueChanged-" + checkBoxName];
			if( optionValueChangedHandle !== undefined )
				checkBox.Events.UnRegister( optionValueChangedHandle );
		},


		// switchToPropertiesView.
		switchToPropertiesView: function() {

			// Show/hide views.
			this.element.addClass( "mf-mode-properties" );
			this.element.removeClass( "mf-mode-comments" );

			// Trigger a window resize event, so all controls (multilinetext) 
			// update now that they are visible.
			this.requestResize();
		},

		// switchToCommentsView.
		switchToCommentsView: function() {

			// Show/hide views.
			this.element.removeClass( "mf-mode-properties" );
			this.element.addClass( "mf-mode-comments" );

			// Resize the comments control.
			this.requestResize();

			// Update comments.
			this.updateComments();
		},

		// Minimize of or un-minimize the metadata card.
		minimizeMetadataCard: function( minimize ) {

			// Resolve the current state.
			var minimized = this.controller.editor.Minimized;
			if( minimized !== minimize ) {

				// Tell the model to perform the change.
				// We will receive an asynchronous notification once the operation is complete.
				this.controller.editor.SetMinimized( minimize );
			}
		},

		// uninitialize.
		uninitialize: function() {

			// Unbind events.
			$( ".ui-scrollable" ).unbind( "scroll" );
			$( window ).unbind( "resize" );
			$( document ).unbind( ".textselection" );
			$( ".mf-modify" ).unbind( "click" );
			$( document ).off( "keydown.accelerators" );

			// Unregister valueChanged events.
			if( this.titleHandler !== undefined )
				this.controller.getTitle().Events.UnRegister( this.titleHandler );

			if( this.automaticValueTitleHandler !== undefined )
				this.controller.getTitle().Events.UnRegister( this.automaticValueTitleHandler );

			if( this.objectIdHandler !== undefined )
				this.controller.getObjectId().Events.UnRegister( this.objectIdHandler );

			if( this.objectVersionHandler !== undefined )
				this.controller.getObjectVersion().Events.UnRegister( this.objectVersionHandler );

			if( this.objectTypeHandler !== undefined )
				this.controller.getObjectType().Events.UnRegister( this.objectTypeHandler );

			if( this.checkedOutHandler !== undefined )
				this.controller.getCheckedOut().Events.UnRegister( this.checkedOutHandler );

			// Unregister checkbox events.
			this._unregisterCheckboxEvents( this.controller.editor.GetUseAsDefaultsOption(), "mf-useasdefaults" );
			this._unregisterCheckboxEvents( this.controller.editor.GetCheckInImmediatelyOption(), "mf-checkinimmediately" );
			this._unregisterCheckboxEvents( this.controller.editor.GetOpenForEditOption(), "mf-openforedit" );

			// Destroy controls from the comments view.
			this._destroyControlsFromCommentView();
		},

		// updateControls.
		updateControls: function() {
		
			// Inform configuration manager about controls to be created.
			this.configurationManager.onBeforeCreateControls();

			// Empty comments.
			$( ".mf-comment-area" ).commentscontrol( "emptyComments" );

			// Check if we should show empty content.
			// Empty content is shown if there is not selected objects.
			var value = this.controller.getObjectId().Value;
			if( value )
				this._showMetadataContent( false );
			else
				this._showMetadataContent( true );
			
			// Create property suggestion control.
			$( "#mf-property-suggestions" ).suggestioncontrol();

			// Update "More info" area. Never shown for new objects.
			if( !this.controller.editor.DataModel.UncreatedObject )
				this.setMoreInfo( value );

			// Create static and dynamic property controls.
			this.createUIControls( this.controller.getTitle(),
					this.controller.getObjectId(),
					this.controller.getObjectVersion(),
					this.controller.getObjectType(),
					this.controller.getCheckedOut(),
					this.controller.getProperties(),
					this.controller.getClassSelector(),
					this.controller.getSaveAsTypeSelector(),
					this.controller.getPropertySelector() );
					
			// Inform configuration manager about created controls. 
			this.configurationManager.onAfterControlsCreated();

			// Hide pin button if showing many objects or creating a new object.
			if( !this.controller.pinboardManager || this.controller.isMultipleObjects() || this.controller.dataModel.UncreatedObject ) 
				$( ".mf-pinnedobject-button" ).hide();
			else
				$( ".mf-pinnedobject-button" ).show();
			
			// Hide analyze-button and related status elements if metadata suggestions are not allowed.
			if( !this.controller.areMetadataSuggestionsAllowed() )
				$( ".mf-suggestion-bar" ).hide();
			else
				$( ".mf-suggestion-bar" ).show();
			
			// Ensure that spinner is not already running.
			if( !this.metadataSuggestions.running ) {		
			
				// If metadata analysis is running, start spinner.
				if( this.controller.isMetadataAnalysisRunning() ) {
				
					// Start spinner.
					this.startSpinner();
				}
				else if( this.controller.isMetadataAnalysisFinished() && this.controller.dataModel.UncreatedObject ) {
				
					// Metadata analysis has been started AND already finished for uncreated object, set property suggestions.
					// In practice, metadataAnalysisComplete has been already called, but setting of property suggestions was not done,
					// because UI controls were not ready.
					var propertySuggestions = this.controller.getPropertySuggestions();
					this.setPropertySuggestions( propertySuggestions );
					
					// Set analysis status.
					if( propertySuggestions && propertySuggestions.length > 0 )
						$( ".mf-analyze-status" ).text( this.localization.strings.IDS_METADATACARD_ANALYSIS_COMPLETE );
					else
						$( ".mf-analyze-status" ).text( this.localization.strings.IDS_METADATACARD_ANALYSIS_NO_SUGGESTIONS );
				}
			}
			
			// Trigger a window resize event, so all controls (multilinetext) 
			// update now that they are visible.
			this.requestResize();
		},
	
		// updateComments.
		updateComments: function() {

			// Update comments.
			var self = this;
			setTimeout( function() {
			
				// If the model is ready, show comments. Otherwise postpone handling of comments.
				if( self.contentIsReady )
					$( ".mf-comment-area" ).commentscontrol( "showComments", self.controller.getComments(), self.controller.editor );
				else
					self.postponeCommentHandling = true;
			}, 0 );
		},

		// setToNormalMode.
		setToNormalMode: function( isCancel ) {

			// Send event to change all controls back to view mode.
			$( ".mf-control" ).trigger( "stopEditing", { isCancel: isCancel } );
		},

		// _initializeStaticControls.
		_initializeStaticControls: function( title, objectId, objectVersion, objectType, checkedOut ) {

			var self = this;

			// Register valueChanged event for title.
			this.titleHandler = title.Events.Register( MFiles.Event.ValueChanged, function( oldValue, newValue ) {

				var isAutomatic = title.HasUncalculatedAutomaticValue() ? true : false;
				self._updateValue( title, ".mf-filename", false, isAutomatic, false );
			} );

			// Register AutomaticValueStatusChanged event for title.
			this.automaticValueTitleHandler = title.Events.Register( MFiles.Event.AutomaticValueStatusChanged, function() {

				var isAutomatic = title.HasUncalculatedAutomaticValue() ? true : false;
				self._updateValue( title, ".mf-filename", false, isAutomatic, false );
			} );

			// Register valueChanged event for object id.
			this.objectIdHandler = objectId.Events.Register( MFiles.Event.ValueChanged, function( oldValue, newValue ) {

				// Hide or show empty content.
				if( objectId.Value )
					self._showMetadataContent( false );
				else
					self._showMetadataContent( true );

				// Update object id if it is not hidden.
				if( self.configurationManager.isNot( "MetadataCard.Theme.ObjectIdField.IsHidden", true ) ) { 
					self._updateValue( objectId, ".mf-objectid", true, false, false );
				}
			} );

			// Register valueChanged event for object version.
			this.objectVersionHandler = objectVersion.Events.Register( MFiles.Event.ValueChanged, function( oldValue, newValue ) {
			
				// Update object version if it is not hidden.
				if( self.configurationManager.isNot( "MetadataCard.Theme.ObjectVersionField.IsHidden", true ) ) { 
					self._updateValue( objectVersion, ".mf-objectversion", true, false, false );
				}
			} );

			// Register valueChanged event for object type.
			this.objectTypeHandler = objectType.Events.Register( MFiles.Event.ValueChanged, function( oldValue, newValue ) {
				self._updateValue( objectType, ".mf-objecttype", false, false, false );
			} );

			// Register valueChanged event for checkedOut.
			this.checkedOutHandler = checkedOut.Events.Register( MFiles.Event.ValueChanged, function( oldValue, newValue ) {
				self._updateCheckedOutInfo( checkedOut, null, ".mf-checkedout" );
			} );
		},

		// _createContainerForDynamicControls.
		_createContainerForDynamicControls: function( id, dataName ) {

			var self = this;
			$( ".mf-dynamic-controls" ).each( function() {

				// Create container for dynamic property controls if it does not exist.
				var controlContainer = $( this ).find( "#" + id + ".mf-dynamic-properties" );
				if( controlContainer.length < 1 ) {

					// Create container and append it to this element.
					controlContainer = $( '<div class="mf-dynamic-properties"></div>' );
					$( this ).append( controlContainer );
				}

				// Store container for later use.
				self.element.data( dataName, controlContainer );
				return false;
			} );
		},

		// Creates static and dynamic property controls.	
		createUIControls: function( title, objectId, objectVersion, objectType, checkedOut, properties, classSelector, saveAsTypeSelector, propertySelector ) {
		
			var self = this;

			// Update icon.
			var iconUrl = this.controller.dataModel.IconURL;
			if( iconUrl != "" )
				$( ".mf-obj-icon-large" ).css( "background-image", "url(" + utilities.removeQuotes( iconUrl ) + ")" );
			else
				$( ".mf-obj-icon-large" ).css( "background-image", "url(UIControlLibrary/blank16.png)" );

			// Update object status (affects overlay icons).
			this.updateObjectStatus();

			// Update title.
			this._updateValue( title, ".mf-filename", false, false, false );
			if( title.Visible == false )
				$( ".mf-filename" ).hide();
				
			// Hide object id if requested.
			if( this.configurationManager.is( "MetadataCard.Theme.ObjectIdField.IsHidden", true ) ) { 
				$( ".mf-objectid" ).hide();
			}
			else {
			
				// Update object id and label for it.
				this._updateValue( objectId, ".mf-objectid", true, false, false );
				if( objectId.Visible == false )
					$( ".mf-objectid" ).hide();
			}

			// Hide object version if requested.
			if( this.configurationManager.is( "MetadataCard.Theme.ObjectVersionField.IsHidden", true ) ) { 
				$( ".mf-objectversion" ).hide();
			}
			else {
	
				// Update object version and label for it.
				this._updateValue( objectVersion, ".mf-objectversion", true, false, false );
				if( objectVersion.Visible == false )
					$( ".mf-objectversion" ).hide();
			}

			// Update object type. Try to use the object template description first. It describes the object type, too.
			var objectTemplateDesc = this.controller.dataModel.GetObjectTemplateDescription();
			if( objectTemplateDesc ) {
				// Use the template description as it is.
				$( ".mf-template-info" ).html( utilities.htmlencode( objectTemplateDesc ) );
			}
			else {

				// If the template description is not available, use the object type control instead.
				this._updateValue( objectType, ".mf-objecttype", false, false, false );
				if( objectType.Visible == false )
					$( ".mf-objecttype" ).hide();
			}

			// Update checked out information.
			this._updateCheckedOutInfo( checkedOut, properties, ".mf-checkedout" );

			// Update sourcefile list.
			if( this.controller.dataModel.UncreatedObject ) {

				var sourceFiles = this.controller.dataModel.GetObjectSourceFiles();
				if( sourceFiles.Count > 0 ) {

					var infoElem = $( ".mf-template-info" );
					var sourceFileList = "";
					if( sourceFiles.Count == 1 ) {
						infoElem.html( infoElem.html() + " " + utilities.htmlencode( this.localization.strings.IDS_METADATACARD_LABEL_ONE_FILE ) );
						sourceFileList += utilities.htmlencode( this.localization.strings.IDS_METADATACARD_LABEL_SOURCEFILE );
					}
					else {

						var fileCount = this.localization.strings.IDS_METADATACARD_LABEL_N_FILES;
						fileCount = fileCount.replace( "%s", "" + sourceFiles.Count );
						infoElem.html( infoElem.html() + " " + fileCount );
						sourceFileList += utilities.htmlencode( this.localization.strings.IDS_METADATACARD_LABEL_SOURCEFILES ) + "<br/>";
					}

					for( var i in sourceFiles ) {

						// HTML-encode each source file and append the line break.
						sourceFileList += utilities.htmlencode( sourceFiles[i] );
						sourceFileList += "<br/>";
					}

					var a = $( "<a href=''>" + utilities.htmlencode( this.localization.strings.IDS_METADATACARD_LABEL_SHOW_ALL ) + "</a>" ).click( function( event ) {

						var elem = $( "div.mf-obj-sourcefiles" ).toggleClass( "ui-state-hidden" );
						if( elem.hasClass( "ui-state-hidden" ) )
							a.text( utilities.htmlencode( self.localization.strings.IDS_METADATACARD_LABEL_SHOW_ALL ) );
						else
							a.text( utilities.htmlencode( self.localization.strings.IDS_METADATACARD_LABEL_HIDE ) );
						event.preventDefault();
					} );

					$( "div.mf-obj-sourcefilelink" ).append( a );
					$( "div.mf-obj-sourcefiles" ).html( '<p>' + sourceFileList + '</p>' );
				}
				else {
					$( "div.mf-obj-sourcefilelink" ).hide();
					$( "div.mf-obj-sourcefiles" ).hide();
				}
			}
			else {
				$( "div.mf-obj-sourcefilelink" ).hide();
				$( "div.mf-obj-sourcefiles" ).hide();
			}

			// Get container for dynamic controls.
			var propertyTable = null;
			var workflowTable = null;
			var controlContainer = this.element.data( "dynamic-controls" );

			// Remove all controls from the container.
			controlContainer.empty();

			// Create Save as type selector control.	
			var saveAsTypeSelectorTable = $( '<table class="mf-dynamic-table" id="mf-saveastype-selector-table"></table>' );

			// Empty the container.
			this.element.data( "saveas-controls" ).empty().append( saveAsTypeSelectorTable );
				
			// Create UI control.	
			self.createUIControl( saveAsTypeSelectorTable, saveAsTypeSelector, null, null, false, false, true, false, null );

			// NOTE: If you change the layout of propertyTable, please make the changes also to propertyGrouping.js where this table is rebuild
			// to set property controls to groups.

			// Create table where to add controls of each property.	
			propertyTable = $( '<table class="mf-dynamic-table" id="mf-property-table"></table>' );
			controlContainer.append( propertyTable );
			
			// Create alignment element above class selector to format columns correctly. This is needed for description fields.
			propertyTable.append( this.createAlignmentElement() );

			// Create and add class selector control.
			self.createUIControl( propertyTable, classSelector, null, null, false, false, false, false, null );

			// Create separator control and add it before property selector.
			var separator = $( '<div class="mf-separator" id="mf-property-selector-separator">&nbsp;</div>' );
			controlContainer.append( separator );

			// Create table where to add property selector.	
			var propertySelectorTable = $( '<table class="mf-dynamic-table" id="mf-property-selector-table"></table>' );
			controlContainer.append( propertySelectorTable );
			
			// Create and add property selector control.
			self.createUIControl( propertySelectorTable, propertySelector, null, null, false, true, false, false, null );

			// Create table where to add workflow and state controls.
			workflowTable = $( '<table class="mf-dynamic-table" id="mf-workflow-table"></table>' );

			// Empty the container.
			this.element.data( "workflow-controls" ).empty().append( workflowTable );

			// Update texts.
			$( ".mf-properties-button" ).attr( "title", this.localization.strings.IDS_METADATACARD_BUTTON_PROPERTIES );
			$( ".mf-comments-button" ).attr( "title", this.localization.strings.IDS_METADATACARD_BUTTON_COMMENTS );
			
			// Update properties.
			this.localModel.getItems( false, true, function( item ) {

				var property = item.property;
				var propertyDef = property.propertyDef;

				// Update property values.
				if( property.propertyDef == 20 ) {
					self._updateValue( property, "#mf-created-control", true, false, false );
					if( property.Visible == false )
						$( "#mf-created-control" ).hide();
				}
				else if( property.propertyDef == 21 ) {
					self._updateValue( property, "#mf-lastmodified-control", true, false, false );
					if( property.Visible == false )
						$( "#mf-lastmodified-control" ).hide();
				}
				else if( property.propertyDef == 25 ) {
					self._updateValue( property, "#mf-createdby-control", false, false, true );
					if( property.Visible == false )
						$( "#mf-createdby-control" ).hide();
				}
				else if( property.propertyDef == 23 ) {
					self._updateValue( property, "#mf-lastmodifiedby-control", false, false, true );
					if( property.Visible == false )
						$( "#mf-lastmodifiedby-control" ).hide();
				}
				
				// Add workflow and state controls to own tables.
				if( property.propertyDef == 38 || property.propertyDef == 99 ) {
				
					// Create UI control.
					self.createUIControl( workflowTable, property, null, null, false, false, true, false, null );
				}
				else if( property.propertyDef == 39 ) {
					// Store state property. Do not create a new UI control. 
					self.stateProperty = item;
				}
			} );

			// Create dynamic UI controls. No property groups in this phase.
			this.attachUIControls( propertyTable, null, null );
			
			// Timeout for delayed update.
			setTimeout( function() {

				// Update remote vault link.
				self._updateRemoteVaultLink();
				
				// Update subobjects link.
				self._updateSubobjectsLink();

				// Update comment count
				self._updateCommentCount();
			}, 0 );
		},
		
		/**
		 * Updates UI controls (without property groups).
		 */
		updateUIControls: function() {
		
			// Write information to the metadata card log.
			utilities.log( "In updateUIControls.", { "showTimestamp" : true } );
		
			// Get the property table
			var propertyTable = $( "#mf-property-table" );
			
			// Detach current UI controls.
			var currentControls = this.detachUIControls( propertyTable );
			
			// Attach UI controls in priority order.
			this.attachUIControls( propertyTable, null, currentControls );
			
			// Write information to the metadata card log.
			utilities.log( "After updateUIControls.", { "showTimestamp" : true } );

			// Show the warning texts at the end of update but only if deferred control creation
			// has already completed.
			if( this.deferredControlCreation && this.deferredControlCreation.executed )
				this.showControlWarnings();
		},
		
		/**
		 * Reselects currently selected UI control. This is used to reselect already selected UI control,
		 * which was detached and then attached back to the DOM e.g. when order of properties was changed.
		 */
		reselectActiveUIControl: function() {
		
			// Reselect currently selected UI control only if it is available.
			if( this.activeControl ) {
			
				// Reselect the UI control.
				// This must be done within timeout, otherwise it breaks the behavior of IE's text fields.
				var self = this;
				setTimeout( function() {
				
					// Ensure that the active control still exists. It may have been removed by a rule.
					if( self.activeControl ) {
						// Reselect the UI control. Catch exception as precaution because there has been
						// randomly occuring errors in focus handling (depending on vault and timings).
						try {
							self.editManager.requestEditMode( self.activeControl );
						}
						catch( ex ) {}
					}
				}, 0 );
			}
		},
		

		/**
		 * Called when a control is destroyed and removed from metadata card.
		 */
		controlDestroyed: function ( control ) {

			// Check if active control was removed.
			if( this.activeControl && control && this.activeControl.uuid == control.uuid ) {

				// Reset active control to prevent actions on it.
				this.activeControl = null;
			}
		},

		/**
		 * Informs configuration manager that user potentially changed class by Tab-key.
		 */
		classSelectedByTab: function() {
		
			// Inform configuration manager that user potentially changed class by Tab-key.
			this.configurationManager.onClassSelectedByTab();
		},
		
		/**
		 * Attaches UI controls.
		 *
		 * @param propertyTable - Table where to add UI controls. 
		 * @param propertyGrouping - The propertyGrouping object.
		 * @param currentControls - Current UI controls, that are not attached.
		 */
		attachUIControls: function( propertyTable, propertyGrouping, currentControls ) {
		
			// Add/attach new and current UI controls.
			var self = this;
			self.propertyGrouping = propertyGrouping;
			this.localModel.getItems( true, true, function( item ) {

				// Handle this item.
				var propertyDef = item.property.propertyDef;
				var property = item.property;

				if( currentControls && currentControls.hasOwnProperty( propertyDef ) ) {
				
					// Attach current control to the right pane.
					var c = currentControls[ propertyDef ];
					self.addDynamicControlToRightPane( propertyTable, property, c.element, propertyGrouping );
					c.element.propertyline( "setHidden", item.isHidden );

					// Change forced read-only status of control if needed.
					// Check if item should be forced to read-only status from item and possible group configuration.
					var isReadOnly = item.isReadOnly;
					if( propertyGrouping && propertyGrouping.hasDefinedGroups() ) {

						// There are grouping configurations. Check if property belongs to any group.
						var group = propertyGrouping.getGroup( propertyDef );
						if( group !== 0 ) {

							// Property belongs to a group.

							// Check if property should be a read-only because the group is configured as read-only.
							// NOTE: The correct configuration is located at the index "group - 1",
							// as group === 0 means "no group".
							var groupConf = propertyGrouping.groupConfiguration[ group - 1 ];
							isReadOnly = isReadOnly || groupConf[ "IsReadOnly" ];
						}
					}
					c.element.propertyline( "setForcedReadOnlyStatus", isReadOnly );

					// If the description row exists, also message and value suggestion container should.
					if ( $( "#mf-description-row-" + property.Id ).length ) {

						// Controls exist and visibility can be set right away.
						c.description.descriptionline( "setHidden", item.isHidden );
						c.message.messageline( "setHidden", item.isHidden );
						c.valueSuggestionContainer.valuesuggestioncontainer( "setHidden", item.isHidden );
					}
					else if( self.deferredControlCreation.executed ) {

						// Initial control creation already done. Contents of the card is probably changed.
						// Create description, message and value suggestion container rows synchronously.
						c.element.before( c.description );
						c.element.after( c.valueSuggestionContainer );
						c.element.after( c.message );
						
						// Change visibility of controls.
						c.description.descriptionline( "setHidden", item.isHidden );
						c.message.messageline( "setHidden", item.isHidden );
						c.valueSuggestionContainer.valuesuggestioncontainer( "setHidden", item.isHidden );
					}
					else {
						// Status will be set during deferred control creation.
						var controlsToCreate = self.deferredControlCreation.deferredControls;
						var count = controlsToCreate.length;

						// Find control spec from the list.
						for ( var index = 0; index < count; index++ ) {
							var control = controlsToCreate[ index ];
							if ( control.propertyDef == propertyDef ) {

								// Found, update value to be set.
								control.hidden = item.isHidden;
								break;
							}
						}
					}

					c.element.propertyline( "setHidden", item.isHidden );
				}
				else {
				
					// Create UI control.
					var uiControlInfo = self.getUIControlInfo( property );
					self.createUIControl( propertyTable, property, uiControlInfo.uiControlType, uiControlInfo.uiControlParameters, item.isHidden, false, false, item.isReadOnly, propertyGrouping );
				}
			} );
		},
		
		/**
		 * Detaches UI controls.
		 *
		 * @param propertyTable - Table where to add UI controls.
		 * @return currentControls - Detached UI controls.
		 */
		detachUIControls: function( propertyTable ) {
		
			// Current controls.
			var currentControls = {};
			
			// Removed controls.
			var removedControls = [];
			
			// Loop over all dynamic rows.
			var self = this;
			propertyTable.find( ".mf-dynamic-row" ).each( function() {

				// Get this element and related id.
				var element = $( this );
				var id = element.attr( "id" );
				
				// Skip class selector. This element is class selector if it has class "mf-property-100".
				if( element.hasClass( "mf-property-100" ) ) {
					return;
				}

				// Shortcut initializations.
				var foundProperty = null;
				var guid = null;

				// Check if current item still exists.
				var foundItem = self.localModel.findItemById( true, true, id );
				if( foundItem ) {

					// Assign property def and GUID.
					foundProperty = foundItem.property.propertyDef;
					guid = foundItem.property.Id;

					// Add the respective data to the current controls array.
					var parent = element.parent();
					currentControls[ foundProperty ] = {
						element: element,
						description: parent.find( "#mf-description-row-" + guid ),
						message: parent.find( "#mf-message-row-" + guid ),
						valueSuggestionContainer: parent.find( "#mf-valuesuggestion-container-row-" + guid )
					}
				}
				else {

					// The item was not found. Add it to the removed controls array.
					removedControls.push(
						{
							dynamicRow: element,
							guid: id
						} );
				}

			} );
			
			// Remove old UI controls.
			for( var i = 0; i < removedControls.length; i++ ) {

				// Access this old UI control.
				var removedItem = removedControls[ i ];

				// Access the Property Line part of the UI control.
				var element = removedItem.dynamicRow;

				// Remove the associated rows.
				var parent = element.parent();
				var candidate = parent.find( "#mf-description-row-" + removedItem.guid );
				candidate.remove();
				candidate = parent.find( "#mf-message-row-" + removedItem.guid );
				candidate.remove();
				candidate = parent.find( "#mf-valuesuggestion-container-row-" + removedItem.guid );
				candidate.remove();

				// Remove the actual Property row.
				element.remove();
			}
			
			// Detach current UI controls.
			for( var i in currentControls ) {
			
				// Get the controls.
				var element = currentControls[ i ].element;
				var description = currentControls[ i ].description;
				var message = currentControls[ i ].message;
				var valueSuggestionContainer = currentControls[ i ].valueSuggestionContainer;
				
				// Detach all.
				element.detach();
				description.detach();
				message.detach();
				valueSuggestionContainer.detach();
			}

			// Return current controls.
			return currentControls;
		},
		
		/**
		 * Returns UI control info.
		 *
		 * @param propertyDef - The property definition.
		 * @return uiControlInfo - Type and parameters of UI control for the property.
		 */
		getUIControlInfo: function( property ) {
		
			// Initialize.
			var uiControlType = null;
			var uiControlParameters = null;
			
			// Use checkbox for built-in "Is template"-property. 
			if( property.PropertyDef === 37 ) {
			
				// Use checkbox.
				uiControlType = "Checkbox";
				uiControlParameters = null;
			}
		
			// Check whether there is custom UI control (defined in the metadata card configuration) for the property.
			var controlInfo = this.getCustomUIControl( property.propertyDef );
			if( controlInfo ) {
			
				// Reset control type and parameters.
				uiControlType = null;
				uiControlParameters = null;
			
				// Custom control found. Get type and possible parameters.
				if( typeof controlInfo === "string" )
					uiControlType = controlInfo;
				else if( typeof controlInfo === "object" ) {
				
					// Get control type if available.
					if( controlInfo.hasOwnProperty( "Type" ) && typeof controlInfo.Type === "string" )
						uiControlType = controlInfo.Type;
						
					// Get control parameters if available.
					if( controlInfo.hasOwnProperty( "Parameters" ) && typeof controlInfo.Parameters === "object" )
						uiControlParameters = controlInfo.Parameters;
				}
			}
			
			// Resolve actual UI widget name.
			uiControlType = this.resolveUiControlType( uiControlType, property.Type );
				
			// We don't prevent unknown control types for compatibility reasons. It is possible that there will be new control types later.
			// To enable this, we use default control type if resolved control type is not found on the whitelist.
			if( uiControlType !== "Default" && !this.isUiControlTypeWhitelisted( uiControlType ) )
				uiControlType = "Default";
			
			// We don't support custom controls for hierarchical lists. Use default control instead. 
			if( property.Hierarchical )
				uiControlType = "Default";
			
			// If there is no custom UI control for the property, use default UI control.
			if( uiControlType === null || uiControlType === "Default" ) {
			
				// No custom UI control found. Check if there are special parameters, which affect to control type and parameters.
				var result = this.checkSpecialParameters( property );
				if( result.hasSpecialParameters ) {
				
					// Special parameters found, use modified UI control info.
					uiControlType = result.uiControlType;
					uiControlParameters = result.uiControlParameters;
				}
				else {
				
					// No special parameters. Use default UI control for the property.
					uiControlType = utilities.getDefaultUIControl( property );
				}				
			}

			// Return UI control info.	
			return {
				uiControlType : uiControlType,
				uiControlParameters: uiControlParameters
			};
		},
		
		/**
		 * Resolves and returns the actual UI widget name based on UI control type from the configuration.
		 *
		 * @param uiControlType - The UI control type from the configuration.
		 * @param dataType - The data type of the related property.
		 * @return uiWidgetName - The resolved UI widget name or 'Default' if can not be resolved.
		 */
		resolveUiControlType: function( uiControlType, dataType ) {
		
			// Map requested control types to actual UI widget names.
			// If the requested control type is not supported for the property, use default UI control.
			if( uiControlType === "Checkbox" ) {
				
				// Get UI widget name based on data type. 
				if( dataType === "multi-choice" )
					uiControlType = "mfmultiselectlookupcontrol_checkbox";
				else if( dataType === "boolean" ) {
					uiControlType = "mfbooleancontrol_checkbox";
				}
				else
					uiControlType = "Default";
			}
			else if( uiControlType === "RadioButton" ) {
			
				// Get UI widget name based on data type. 
				if( dataType === "choice" )
					uiControlType = "mflookupcontrol_radiobutton";
				else if( dataType === "boolean" )
					uiControlType = "mfbooleancontrol_radiobutton";
				else
					uiControlType = "Default";
			}
			else if ( uiControlType === "Table" ) {
				if ( dataType === "multiline-text" )
					uiControlType = "mfmultilinetextcontrol_table";
				else
					uiControlType = "Default";
			}
			return uiControlType;
		},
		
		/**
		 * Returns true if the requested UI control type is found on the whitelist.
		 *
		 * @param uiControlType - The resolved UI control type.
		 * @return found - True, if the UI control type is found on the whitelist.
		 */
		isUiControlTypeWhitelisted: function( uiControlType ) {
		
			// Define whitelist.
			var whitelist = [
				"mfmultiselectlookupcontrol_checkbox",
				"mflookupcontrol_radiobutton",
				"mfbooleancontrol_checkbox",
				"mfbooleancontrol_radiobutton",
                "mfmultilinetextcontrol_table"
			];
		
			// return true, if the resolved UI control type is found on the whitelist.
			return ( $.inArray( uiControlType, whitelist ) !== -1 );
		},
		
		/**
		 * Checks if there are special parameters, which affect to control type and parameters.
		 * If there are, returns UI control type and related parameters.
		 *
		 * @param property The property.
		 * @return UI control information.
		 */
		checkSpecialParameters: function( property ) {
		
			// Process property-specific parameters.
			// Currently only "singleLine"-parameter is supported for multiline-text properties.
			var hasSpecialParameters = false;
			var uiControlType = null;
			var uiControlParameters = {};
			if( property.Type === "multiline-text" ) {
			
				// This is multiline-text property. Check if parameter "singleLine" exists.
				var isSingleLine = this.configurationManager.getPropertyParameterValue( property.propertyDef, "singleLine" );	
				if( isSingleLine === true ) {
			
					// Parameter "singleLine" exists and is true, use normal text control instead of multiline text control.
					// In this case pass also additional parameter "singleLine" for created text control.
					// This is used to limit length of the text to 10000 characters instead of normal 100 character.
					uiControlType = "mftextcontrol";
					uiControlParameters[ "singleLine" ] = true;
					hasSpecialParameters = true;
				}
			}
			
			// Return requested information.
			return {
				hasSpecialParameters: hasSpecialParameters,
				uiControlType: uiControlType,
				uiControlParameters: uiControlParameters
			};
		},
		
		/**
		 * Updates labels of UI property controls.
	     */
		updatePropertyLabels: function() {	
		
			// Get the property table
			var propertyTable = $( "#mf-property-table" );
		
			// Preliminary check for updating.
			if( propertyTable.length ) {
				
				// Loop through all UI property controls.
				var self = this;
				propertyTable.find( ".mf-dynamic-row" ).each( function() {

					// Get property definition by element class.
					var element = $( this );
					var classes = element.attr( "class" );
					var propertyDef = null;
					var classList = classes.split( /\s+/ );
					$.each( classList, function( index, item ) {

						// Check if this class has property definition id.
						if( item.indexOf( "mf-property-" ) === 0 ) {

							// Get property definition id.
							propertyDef = item.slice( "mf-property-".length );
							return false;
						}
					} );
					
					// Try to update label if property definition was found.  
					if( propertyDef !== null ) {
					
						// Check if we have specific label text defined for this property.
						var labelClass = ".mf-property-" + propertyDef + "-label";
						var labelText = self.getPropertyText( "Label", propertyDef );
						if( labelText != null ) {
				
							// Specific label text defined, update the label with new text.
							element.find( labelClass ).text( labelText );
						}
						else {
						
							// No specific label text defined for the property.
							// Make sure that we use original label text.
							// First we must find original label text for this property.
							var currentLabel = element.find( labelClass ).text();
							self.localModel.getItems( true, true, function( item ) {
			
								// For each available property, check if this property is what we need to get original label text.
								var prop = item.property.propertyDef;
								if( prop == propertyDef ) {
								
									// Correct property found, check if its original label equals to current label.
									// If not, update the current label to original label.
									var originalLabel = item.property.Label;
									if( currentLabel !== originalLabel )
										element.find( labelClass ).text( originalLabel );
								}
							} );
						}
					}
					
				} );  // end of loop for each UI control.
			}
		},

		// _createControlsForCommentView.
		_createControlsForCommentView: function( commentControl ) {

			var self = this;

			// Create control for comment history.
			$( ".mf-comment-area" ).commentscontrol();

			// Create control for new comment.
			$( ".mf-comment-control" ).staticcontrol();
			$( ".mf-comment-control" ).staticcontrol( "createControls", commentControl, this );
		},

		// _destroyControlsFromCommentView.
		_destroyControlsFromCommentView: function() {

			// Destroy control for comment history.
			$( ".mf-comment-area" ).commentscontrol( "destroy" );

			// Destroy control for new comment.
			$( ".mf-comment-control" ).staticcontrol( "destroy" );
		},

		// _updateValue.
		_updateValue: function( model, elementClass, showLabel, isAutomatic, isLookup ) {

			var value = model.Value;
			var text = "";

			// clear element contents and assign model data
			$( elementClass ).data( "mfmodel", model ).empty();

			if( isAutomatic ) {
				text = this.localization.strings.IDS_METADATACARD_AUTOMATIC_VALUE;
			}
			else if( value !== null ) {

				if( utilities.isMultiValue( value ) )
					text = this.localization.strings.IDS_METADATACARD_CONTENT_VARIES_TEXT;
				else
					text = ( isLookup ) ? value.name : value;

				if( showLabel ) {
					var elemNameField = utilities.createDocumentElement( 'span', 'mf-namefield' );
					$( elemNameField ).appendTo( elementClass ).text( model.label );
				}
			}
			var elemNameField = utilities.createDocumentElement( 'span', 'mf-valuefield can-highlight' );
			$( elemNameField ).appendTo( elementClass ).text( text );

			// Trigger a window resize event.
			this.requestResize();
		},

		// _updateCheckedOutInfo.
		_updateCheckedOutInfo: function( checkedOut, properties, elementClass ) {

			var value = checkedOut.Value;

			// clear element contents and assign model data
			$( elementClass ).data( "mfmodel", checkedOut ).empty();

			if( value !== null ) {

				var text = utilities.isMultiValue( value ) ? this.localization.strings.IDS_METADATACARD_CONTENT_VARIES_TEXT : value;

				// Add Label
				$( utilities.createDocumentElement( 'span', 'mf-namefield' ) ).appendTo( elementClass ).text( checkedOut.Label );

				// Add & Format text & setup element for hit hilighting
				$( utilities.createDocumentElement( 'span', 'mf-valuefield can-highlight' ) ).appendTo( elementClass ).text( text );
			}

			if( checkedOut.Visible == true )
				$( elementClass ).show();
			else
				$( elementClass ).hide();

			// Trigger a window resize event.
			this.requestResize();
		},

		_showMetadataContent: function( showEmpty ) {
			/// <summary>
			///     Shows or hides the metadata card content by turning the mf-layout-empty style for the metadata card. 
			///     Hides the other content, such as the error content.
			/// </summary>
			/// <param name="show" type="Boolean">
			///     True to show the empty content. False to show actual content with values.
			/// </param>

			// Ensure that the error info is hidden.
			$( "#metadatacard-error-info" ).hide();

			// Show or hide the metadata card content.
			this.element.toggleClass( "mf-layout-empty", showEmpty );
		},

		// Called when the property has been added.
		controlAdded: function( property ) {
			
			// Check if the property control has related suggestion.
			var hasPropertySuggestions = false;
			var propertySuggestions = $( "#mf-property-suggestions" );
			if( propertySuggestions.suggestioncontrol( "hasPropertySuggestion", property.propertyDef ) ) {
			
				// Remove related property suggestion if it exists.
				propertySuggestions.suggestioncontrol( "removePropertySuggestion", property.propertyDef );
				
				// If a control was added by the user, store information about existing property suggestions.
				if( this.controlAddedByUser )
					hasPropertySuggestions = true;
			}
			
			// Inform configuration manager about new control and possible suggestions.
			this.configurationManager.onControlAdded( property, this.controlAddedByUser, hasPropertySuggestions );
			
			// Reset the flag which tells that a control was added by the user.
			this.controlAddedByUser = false;
			
			// Request resizing. This re-layouts the metadata card.
			this.requestResize();
		},

		// Called when the property has been removed.
		controlRemoved: function( property ) {

			// Inform configuration manager about removed control.
			this.configurationManager.onControlRemoved( property, this.controlRemovedByUser );

			// Remove related property from the deferred control creation array if deferred creation is not yet done.
			if ( ! this.deferredControlCreation.executed ) {
				var indexToRemove = -1;
				var controls = this.deferredControlCreation.deferredControls;
				$.each( controls, function( index, control ) {
					if( control && control.propertyDef == property.PropertyDef ) {
						indexToRemove = index;
						return false;
					}
				} );

				// Remove the control from the array if it was found.
				if ( indexToRemove != -1 ) {
					controls.splice( indexToRemove, 1 );
				}
			}

			// Reset the flag which tells that a control was removed by the user.
			this.controlRemovedByUser = false;

			// Request resizing. This re-layouts the metadata card.
			this.requestResize();
		},

		/**
		 * Called before the user removes an item from the lookup control.
		 */
		beforeItemRemovedByUser: function() {
		
			// Set flag, which tells that a control will be removed by the user.
			this.itemRemovedByUser = true;
		},
		
		/**
		 * Creates a new UI control.
		 *
		 * @param table The table element, where a new UI control is created to.
		 * @param property The property definition.
		 * @param uiControlType Type of the UI control.
		 * @param uiControlParameters Parameters for the UI control.
		 * @param isHidden True, if the UI control is hidden.
		 * @param isPropertySelector True,if the UI control is property selector.
		 * @param isSingleClick True, if the UI control is single-click control (e.g. workflow or state control)
		 * @param forcedReadOnly True, if the UI control is forced to read-only mode.
		 * @param propertyGrouping The property grouping object.
		 */
		createUIControl: function( table, property, uiControlType, uiControlParameters, isHidden, isPropertySelector, isSingleClick, forcedReadOnly, propertyGrouping ) {

			// If UI control type is not defined, use default type for this property.
			if( !uiControlType )
				uiControlType = utilities.getDefaultUIControl( property );

			// Create property line. Rest of the (initially invisible) controls are created asynchronously after everything else is created.
			var propertyDef = property.PropertyDef;

			// Assign class for the property line.
			var classAttr = "mf-dynamic-row";
			if( isPropertySelector )
				classAttr += " mf-add-property-control";
			else
				classAttr += " mf-property-" + propertyDef;

			// Create the property line element.
			var elem = utilities.createDocumentElement( 'tr', classAttr );
			elem.id = property.Id;
			var propertyLine = $( elem );

			// Create alignment element above property selector to format columns correctly. This is needed for description fields.
			if( isPropertySelector )
				table.append( this.createAlignmentElement() );

			// Add control to right pane.
			this.addDynamicControlToRightPane( table, property, propertyLine, propertyGrouping );

			// Get visibility.
			var visible = property.Visible ? true : false;

			// Create 
			var self = this;
			var creationProperties = {
				elementId : property.Id,
				label : property.label,
				propertyLine : propertyLine,
				property : property,
				propertyDef: propertyDef,
				created: false,
				visible: visible,
				hidden : isHidden,
				isPropertySelector: isPropertySelector
			};

			// Hide property selector if it is configured to be hidden.
			var hiddenPropertySelector = ( isPropertySelector && this.configurationManager.is( "MetadataCard.Theme.AddPropertyLink.IsHidden", true ) );

			// Create property line control.
			propertyLine.propertyline( { visible: visible, isHidden: ( isHidden || hiddenPropertySelector ), forcedReadOnly: forcedReadOnly } );
			propertyLine.propertyline( "createControls", property, this, uiControlType, uiControlParameters, isPropertySelector, isSingleClick );

			// Handle the deferred control creation.
			if( this.deferredControlCreation.executed )
			{
				// Content already initialized, i.e. createdControlsForPropertyline has been executed. Create the controls right away.
				this.createdControlsForPropertyline( creationProperties );
			}
			else {
				// In metadatacard initialization phase. Postpone creation of description line, message line and value suggestion container.
				this.deferredControlCreation.deferredControls.push( creationProperties );
			}

			// Set label color for property selector.
			if( isPropertySelector ) {
				this.configurationManager.get( "MetadataCard.Theme.AddPropertyLink.Color", function( color ) {
					propertyLine.find( ".mf-addproperty" ).css( "color", color );
				} );
			}

			// Set background color for workflow and workstate property lines.
			if( property.propertyDef == 38 || property.propertyDef == 99 ) {

				// Workflow or workstate property line.

				// Get background color for a footer area.
				var backgroundColor = this.configurationManager.get( "MetadataCard.Theme.Footer.BackgroundColor" );
				if( !backgroundColor )
					backgroundColor = "";

				// Get background hover color for a footer area.
				var backgroundColorHover = this.configurationManager.get( "MetadataCard.Theme.Footer.BackgroundColor:Hover" );
				if( !backgroundColorHover )
					backgroundColorHover = "";

				// Set footer background and background hover colors for workflow and workstate property lines.
				propertyLine.propertyline( "setBackgroundColor", backgroundColor, backgroundColorHover );
			}
			
			
		},
		
		/************************/
		
		// Adds dynamic control to metadatacard in right pane.
		addDynamicControlToRightPane: function( table, property, propertyLine, propertyGrouping ) {
			
			// Add a new property to the end of the table.
				
			// If property groups are defined, set properties in correct tbodies.

			var tbody = null;
			if( propertyGrouping && propertyGrouping.hasDefinedGroups() ) {
				
				// Get the correct group element for a property definition.
				var group = propertyGrouping.getGroup( property.PropertyDef );
				tbody = $( "#mf-property-group-" + group );
				tbody.append( propertyLine );
			}
			else
				table.append( propertyLine );
		},

		/**
		 * Sets first editable UI control to edit mode.
		 *
		 * @param skipClassSelector - True to skip the class selector.
		 */
		_setFirstEditableControlToEditmode: function( skipClassSelector ) {
			
			// Ignore errors silently.
			try {

				// Loop over each property.
				this.element.find( ".mf-dynamic-row" ).each( function() {

					// If the property control was found, set it to edit mode if it meets to criteria of the initial control.
					var element = $( this );
					var initialControl = false;
					if( !element.propertyline( "isReadOnly" ) ) {

						// Not read-only => could qualify as the initial control.
						if( element.propertyline( "isClassSelector" ) ) {

							// Class selector => qualifies only if empty and not skipped.
							if( element.propertyline( "isEmpty" ) && !skipClassSelector )
								initialControl = true;
						}
						else {

							// Not the class selector => qualifies if based on a property definition.
							// This check helps us avoid special controls like the Save As Type selector.
							if( element.propertyline( "isBasedOnPropertyDef" ) )
								initialControl = true;

						}  // end if

					}  // end if

					// Set to edit mode if this is the initial control.
					if( initialControl ) {

						// Write information to the metadata card log.
						utilities.log( "Call function 'setToEditMode' for the propertyline.", { "showTimestamp" : true } );

						// Set to edit mode.
						element.propertyline( "setToEditMode" );
						return false;
					}

				} );  // end each
			}
			catch( ex ) { };				
		},

		// initializingContent.
		initializingContent: function( currentStep, finalStep ) {

			utilities.setUpdatingState( true );

			// When updating starts, unregister all property events to increase performance.
			if( currentStep == 0 )
				this.controller.unregisterEvents();
		},

		// contentInitialized.
		contentInitialized: function() {
		
			// Store number of selected objects.
			this.objectCount = this.controller.getObjVers().Count;

			// Set flag which tells whether the model is ready. 
			this.contentIsReady = true;

			// If comment handling was postponed, handle comments here.
			if( this.postponeCommentHandling ) {
				$( ".mf-comment-area" ).commentscontrol( "showComments", this.controller.getComments(), this.controller.editor );
				this.postponeCommentHandling = false;
			}

			utilities.setUpdatingState( false );

			// If the metadata model has an error condition, go to the error mode. If not, update the content.
			var error = this.controller.dataModel.GetError();
			if( error ) {
				var ignore = this.controller.dataModel.IgnoreError();
				this.dataError( MFiles.GetErrorDescription( error ), MFiles.GetLongErrorDescription( error ), error, ignore );
			}
			else {

				// Update the permissions description.
				this.updatePermissionsDescription();
				
				// Set control state. No controls in edit mode. Don't update highlight yet. Don't update theme yet. 
				this.setControlState( false, false, false );

				// Update comments if comments view is visible.
				if( $( "#mf-comments-view" ).css( "display" ) !== "none" ) {

					// Update comments. 
					this.updateComments();
				}

				// Update checked out information.
				this._updateCheckedOutInfo( this.controller.getCheckedOut(), this.controller.getProperties(), ".mf-checkedout" );

				// Register events from the model.
				this.controller.registerEvents();

				// Update controls.
				this.updateControls();

				// Update hit highlighting.
				this.hitHighlightingUpdated();

				// Trigger resize event so properties get correctly ordered, and spread out amongst columns in horiz mode.
				this.requestResize();

				// Enque deferred control creation within timer callback.
				this.enqueDeferredControlCreation( 0 );
			}
		},

		/**
		 * Enques deferred control creation within timer callback.
		 */
		enqueDeferredControlCreation: function ( timeout ) {

			// Cancel if already pending.
			if( this.deferredControlCreation.timeoutId ) {
				clearTimeout( this.deferredControlCreation.timeoutId );
			}

			var self = this;
			this.deferredControlCreation.timeoutId = setTimeout( function () {

				// Ensure deferred controls object is valid.
				var deferredCreation = self.deferredControlCreation;
				var length = deferredCreation ? deferredCreation.deferredControls.length : 0;
				if( ! length )
					return;

				// Create controls (message line, description line and value suggestion container).
				for( var i = 0; i < length; i++ ) {
					var creationProperties = deferredCreation.deferredControls[ i ];
					self.createdControlsForPropertyline( creationProperties );
				}

				// Now that the deferred control creation has completed, we can put the warning
				// texts to the controls.
				self.showControlWarnings();

				// Clear data.
				deferredCreation.deferredControls = [];
				deferredCreation.timeoutId = undefined;
				deferredCreation.executed = true;
				utilities.showLog();
			}, timeout );
		},

		// filePreviewInfoUpdated.
		filePreviewInfoUpdated: function() {

			// Find out if the popup dialog exists. We can't show the preview until the Window object is accessible.
			var popupDialogExists = this.controller.dashboard.Window != null && this.controller.dashboard.Window != undefined;

			// Show preview if it's open by default
			if( popupDialogExists && this.controller.dataModel.IsFileAvailableForPreview && this.controller.editor.PreviewerVisible )
				this.showPreview();
		},

		dataError: function( shortError, longError, errorObject, hideErrors ) {
			/// <summary>
			///     Outputs the data error to the metadata card. The short error message is displayed right away, 
			///     and the detailed error message shows under details link button.
			/// </summary>
			/// <param name="shortError" type="String">
			///     The short (user-friendly) error message.
			/// </param>
			/// <param name="longError" type="String">
			///     The long error message. This is expected to include e.g. the call stack and the HRESULT codes.
			/// </param>
			/// <param name="errorObject" type="IErrorInfo">
			///     The COM error object.
			/// </param>
			/// <param name="hideErrors" type="Boolean">
			///     True to hide the error.
			/// </param>

			// Construct the short error text as a header unless error should be hidden.
			if( ! hideErrors ) {
				var htmlShortError = "<h3>";
				htmlShortError += utilities.htmlencode( shortError );
				htmlShortError += "</h3";
				$( "#metadatacard-error-info-shorterror" ).html( htmlShortError ).show();
			}

			// Set long error description initially hidden, because it will become visible when the details button is clicked.
			var htmlLongError = "<p><pre>";
			htmlLongError += hideErrors ? "" : utilities.htmlencode( longError );
			htmlLongError += "</pre></p>";
			$( "#metadatacard-error-info-longerror" ).html( htmlLongError ).hide();

			// Set the details button state.
			var detailsButton = $( "#metadatacard-error-info-detailsbutton" );
			if( hideErrors === true ) {
				detailsButton.hide();
			}
			else {
				// Ensure that the details button is displayed.
				detailsButton.show();
			}

			// Show the error info and hide the metadata card.
			this.element.toggleClass( "mf-layout-empty", true );
			$( "#metadatacard-error-info" ).show();
		},

		// setError.
		setError: function( errorText, id ) {

			// Find correct propertyline element.
			var element = null;
			element = this.element.find( ".mf-dynamic-table #" + id );
			if( element && errorText ) {
			
				// If property grouping is used, open the related property group if it is collapsed.
				var propertyGrouping = this.configurationManager.propertyGrouping;
				if( propertyGrouping )
					this.configurationManager.propertyGrouping.expand( element );
					
				// Ensure that controls are visible.
				element.prev().descriptionline( "setHidden", false );
				element.propertyline( "setHidden", false );
				element.next().messageline( "setHidden", false );
				element.next().next().valuesuggestioncontainer( "setHidden", false );
			}	

			// Set error message for corresponding messageline control,
			// which is located in next element in the table.
			element.next().messageline( "setError", errorText );
		},

		// changeViewBasedOnPropertyDef.
		changeViewBasedOnProperty: function( propertyDef ) {

			// In case of comment property, switch to comments view.
			// Otherwise switch to properties view.
			if( propertyDef == 33 )
				this.switchToCommentsView();
			else
				this.switchToPropertiesView();
		},

		// setFocusedElement.
		setFocusedElement: function( element ) {

			// Store focused element. Used to set focus back to this element
			// e.g. after scrolling by scrollbar.
			this.focusedElement = element;
			this.focusSetWhenScrolling = false;
		},

		// removeProperty.
		removeProperty: function( property, hasFocus ) {

			// This function is called when property will be removed from model due to user action,
			// for example by clicking remove-button or by Ctrl + D.
			// In this case we set flag to indicate this. So, when we receive event which actually removes the control,
			// we can move keyboard focus to next control (or previous if next item does not exist) if this flag is set.
			this.controlRemovedByUser = true;

			// Remove property from the model.
			this.controller.removeProperty( property );
		},

		// _updateRemoteVaultLink.
		_updateRemoteVaultLink: function() {

			var m = this.controller.dataModel;
			var a = m.GetRemoteVaultAction();

			if( a.IsVisible() && a.IsEnabled() ) {

				var link = a.GetName();
				$( ".mf-remotevault-text" )
					.text( link )
					.click( function() {

						// Handle click (navigate to remote vault).
						a.Activate();
					} )

			} else {

				// No link, make sure nothing is showing.
				$( ".mf-remotevault-text" ).text( "" );
			}

		},
		
		// _updateSubobjectsLink.
		_updateSubobjectsLink: function() {

			var m = this.controller.dataModel;
			var a = m.GetSubobjectsAction();

			if( a.IsVisible() && a.IsEnabled() ) {

				var link = a.GetName();
				$( ".mf-subobjects-text" )
					.text( link )
					.click( function() {

						// Handle click (open subobjects dialog).
						a.Activate();
					} )

			} else {

				// No link, make sure nothing is showing.
				$( ".mf-subobjects-text" ).text( "" );
			}

		},

		_updateCommentCount: function() {
			try {


				if( this.controller.isMultipleObjects() )

				// don't show any count if multiple objects are selected
					$( ".mf-comments-button" ).text( "" );

				else {

					// resolve comment count
					var commentCount = this.controller.getComments().length;

					// add an extra comment to the count if the current comment is specified.
					if( this.controller.dataModel.Comment.Value )
						commentCount++;

					$( ".mf-comments-button" ).text( commentCount );
				}
			}
			catch( ex ) {

				// Comment fetching failed. Simulate the data error.
				this.dataError( MFiles.GetErrorDescription( ex ), MFiles.GetLongErrorDescription( ex ) );
			}

		},

		// permissions.
		permissions: function() {

			// Clear the indicator text, if any.
			this.clearPermissionsChangedIndicator();

			// Delegate to the controller.
			this.controller.permissions();
		},

		// permissionsChanged.
		permissionsChanged: function( message ) {

			// Detect right-to-left layout.
			var rtl = ( $( "html.mf-rtl" ).length > 0 ) ? true : false;

			// Show the current permissions.
			this.updatePermissionsDescription();

			// Clear old indicator text, if any.
			this.clearPermissionsChangedIndicator();

			// Show the indicator text to the user if provided.
			if( message !== "" ) {

				// The need to mirror the balloon depends on if we are in RTL layout.
				var scaleX = ( rtl ? -1 : 1 );

				// Indicate to the user that permissions have changed (e.g., object properties were modified).

				// Right pane.
				$( '<div class="mf-info-bubble" style="-ms-transform: scaleX( ' + scaleX + ' );"><div style="-ms-transform: scaleX( ' + scaleX + ' );">' + utilities.htmlencode( message ) + '</div></div>' )
					.appendTo( "body" )
					.position( {
						my: ( rtl ? "right+30 bottom" : "left-30 bottom" ),
						at: ( rtl ? "right center" : "left center" ),
						of: ".mf-permissions"
					} ).hide().fadeIn( 600 );
				
				this.permissionBubbleTimeout = setTimeout( function() {
					$( ".mf-info-bubble" ).fadeOut( 600, function() {
						$( this ).remove()
					} );
				}, 6000 )

			}

		},

		// Clears the "permissions changed" indicator.
		clearPermissionsChangedIndicator: function() {
			clearTimeout( this.permissionBubbleTimeout )
			$( ".mf-info-bubble" ).remove()

		},

		// Updates the display of current permissions.
		updatePermissionsDescription: function() {

			// Show the current permissions.
			$( ".mf-permissions" ).text( this.controller.getPermissionsDescription() );
			$( ".mf-permission-button" ).attr( "title", this.localization.strings.IDS_METADATACARD_LABEL_PERMISSIONS_X + this.controller.getPermissionsDescription() );
		},

		// iconChanged.
		iconChanged: function( url ) {

			// Update the URL of the main icon.
			var img = $( ".mf-obj-icon-large" ).css( "background-image", "url(" + utilities.removeQuotes( url ) + ")" );
			if( url.length != "" )
				img.show();
			else
				img.hide();

			// Update overlay icons.
			this.updateObjectStatus();
		},

		setControlState: function( anyControlInEditMode, updateHighlights, updateTheme ) {
		
			this.anyControlInEditMode = anyControlInEditMode;

			// If any control is in edit mode or model has modified values or this is uncreated object,
			// set the metadata card to edit mode.
//RSS			if( anyControlInEditMode || this.controller.isModified() || this.controller.dataModel.UncreatedObject )
			if( anyControlInEditMode )
				this.editModeStarted( updateTheme );
			else
				this.viewModeStarted( updateTheme );

			if( updateHighlights ) {

				var self = this;
				// something may have returned to view mode... update highlighting
				setTimeout( function() {
					self.updateHighlights( self.controller.editor );
				}, 0 );
			}
		},
		
		/**
		 * Stores property definition of a conflicting control.
		 *
		 * @param propertyDef - The property definition.
		 */
		setConflictingControl: function( propertyDef ) {
		
			// Set property definition of the conflicting control.
			this.conflictingControl = propertyDef;
			
			// Write information to the metadata card log.
			utilities.log( "Set Conflicting control: " + propertyDef, { "showTimestamp" : true } );
		},

		modifyFlagChanged: function( isModified ) {
		
			// If any control is in edit mode or model has modified values or this is uncreated object,
			// set the metadata card to edit mode.
			if( this.anyControlInEditMode || isModified || this.controller.dataModel.UncreatedObject )
				this.editModeStarted( true );
			else
				this.viewModeStarted( true );
		},

		// editModeStarted.
		editModeStarted: function( updateTheme ) {
		
			// Set edit mode.
			this.inEditMode = true;

			// Update save, discard, skip and saveall button states. 
			$( ".mf-save-button, .mf-discard-button" ).toggleClass( "ui-state-disabled", false );
			$( ".mf-skip-button, .mf-saveall-button" ).toggleClass( "ui-state-disabled", !this.controller.editor.IsOnMultiItemSequence() );
			
			// Hide location switch button.
			$( ".mf-location-button" ).toggleClass( "ui-state-disabled", true );
			
			// Set elements to represent edit mode. Must be done before updateTheme().
			this.element.addClass( "mf-editmode" );
			// Update metadata card theme if requested.
			if( updateTheme )
				this.updateTheme( true );

			//resizeContent area to hide footer
			this.resizeContentArea();

			// Set the text of the discard button.
			this.setDiscardButtonText();

			// Inform the metadata model that edit mode is on.
			this.controller.editor.SetEditMode( true );
		},

		// viewModeStarted.
		viewModeStarted: function( updateTheme ) {
		
			// Reset edit mode.
			this.inEditMode = false;

			// Update save, discard, skip and saveall button states. 
			$( ".mf-save-button, .mf-skip-button, .mf-saveall-button" ).toggleClass( "ui-state-disabled", true );
//RSS			$( ".mf-discard-button" ).toggleClass( "ui-state-disabled", !self.controller.editor.IsPoppedOut() );
			$( ".mf-discard-button" ).toggleClass( "ui-state-disabled", true );
            			
			// Show location switch button.
			$( ".mf-location-button" ).toggleClass( "ui-state-disabled", false );
			
			// Set elements to represent view mode. Must be done before updateTheme().
			this.element.removeClass( "mf-editmode" );
			// Update metadata card theme.
			if( updateTheme )
				this.updateTheme( false );

			// Set the text of the discard button.
			this.setDiscardButtonText();

			//resizeContent area to hide footer
			this.resizeContentArea();

			// Inform the metadata model that view mode is on.
			this.controller.editor.SetEditMode( false );
		},

		// applyPoppedOutLayout.
		applyPoppedOutLayout: function() {
		
			// Mark popped out.
			this.element.removeClass( "mf-card-docked" );
			this.element.addClass( "mf-card-poppedout" );

			// Hide popout button.
			$( ".mf-popout-button, .mf-location-button" ).toggleClass( "ui-state-hidden", true );

			// Hide/Show preview toggle button
			$( ".mf-preview-button" ).toggleClass( "ui-state-hidden", !this.controller.dataModel.IsFileAvailableForPreview );

			// Find out if the popup dialog exists. We can't show the preview until the Window object is accessible.
			var popupDialogExists = this.controller.dashboard.Window != null && this.controller.dashboard.Window != undefined;

			// Show preview if it's open by default
			if( popupDialogExists && this.controller.dataModel.IsFileAvailableForPreview && this.controller.editor.PreviewerVisible )
				this.showPreview();

			// Set the text of the discard button.
			this.setDiscardButtonText();

			// Discard/close button is always visible in popped out mode.
			$( ".mf-discard-button" ).toggleClass( "ui-state-disabled", false );

			// Force vertical layout when popped out.
			this.applyVerticalLayout();
				
			// If there is no focus in any control, move focus to metadata card so that key event handling works.
			// Without this we are not able to receive keydown events from the document(or window) before user
			// sets the focus explicitly to any control.
			if( this.focusedElement === null ) {
				this.element.focus();
			}
		},

		applyDockedLayout: function() {
		
			// Mark docked.
			this.element.addClass( "mf-card-docked" );
			this.element.removeClass( "mf-card-poppedout" );

			// show popout button and  hide preview button
			$( ".mf-popout-button, .mf-location-button" ).toggleClass( "ui-state-hidden", false );

			// Hide preview button
			$( ".mf-preview-button" ).toggleClass( "ui-state-hidden", true );

			// Update layout.
			this.applyVerticalLayout();
		},

		// The minimized state of the metadata card has changed (in bottom pane only).
		minimizedStateChanged: function() {

			// Apply the new state.
			this.applyMinimizedState();
		},

		// Handles the request to change the view.
		requestActivateView: function( viewId ) {

			// Check the view id.
			if( viewId === "comments" ) {

				// Switch to comments view.
				this.switchToCommentsView();

				// Unminimize the metadata card.
				this.minimizeMetadataCard( false );

			}
			else if( viewId === "general" ) {

				// Switch to properties view.
				this.switchToPropertiesView();

				// Unminimize the metadata card.
				this.minimizeMetadataCard( false );

			}
		},

		// Applies the current minimized state to the layout.
		applyMinimizedState: function() {

			var self = this;

			// Branch by current minimized state.
			if( self.controller.editor.Minimized ) {

				// The pane is minimized.
				$( ".mf-toggleminimized-button" ).attr( "title", this.localization.strings.IDS_METADATACARD_BUTTON_RESTORE );
				self.element.toggleClass( "ui-state-collapsed", true );
				self.element.toggleClass( "mf-bottom-minimized", true );
			}
			else {

				// The pane is not minimized.
				$( ".mf-toggleminimized-button" ).attr( "title", this.localization.strings.IDS_METADATACARD_BUTTON_MINIMIZE );
				self.element.toggleClass( "ui-state-collapsed", false );
				self.element.toggleClass( "mf-bottom-minimized", false );
			}
		},

		// Applies the current header state to the layout.
		applyHeaderState: function() {
			var headerExpanded = this.controller.editor.GetUIData( "HeaderExpanded", true );
			if( headerExpanded ) {
				// The header is expanded.
				$( ".mf-toggleheader-button" ).attr( "title", this.localization.strings.IDS_METADATACARD_BUTTON_COLLAPSE_TITLE );
				this.element.toggleClass( "mf-header-collapsed", false );
			}
			else {
				// The header is collapsed.
				$( ".mf-toggleheader-button" ).attr( "title", this.localization.strings.IDS_METADATACARD_BUTTON_EXPAND_TITLE );
				this.element.toggleClass( "mf-header-collapsed", true );
			}
		},

		/**
		* Applies vertical layout.
		*/
		applyVerticalLayout: function() {
		
			this.applyHeaderState();

			this.element.find( ".mf-obj-info-bar" ).appendTo( ".mf-file-header" );

			var propertyControls = this.element.find( ".mf-dynamic-controls" );
			var mainTable = $( "#mf-property-table>tbody" );
			var addPropTable = $( "#mf-property-selector-table>tbody" );
			var wfTable = $( "#mf-workflow-table>tbody" );

			// Apply vertical layout.
			$( "body" ).addClass( "mf-layout-vertical" );

			// Move toolbar back to normal scroll container.
			this.element.find( ".mf-toolbar" ).appendTo( "#mf-properties-view .content:first" );

			// Move all properties back to their property tables.
			var self = this;
			propertyControls.find( ".mf-dynamic-row" ).each( function() {
			
				// TODO: For workflow and state controls, there should not be description field/message field...or is there????

				var table = mainTable;
				var prop = $( this );
				var msg = prop.next();
				var desc = prop.prev();

				if ( prop.is( ".mf-property-38" ) || prop.is( ".mf-property-99" ) ) {
				
					prop.show(); // Make sure it's always visible, we may have hidden it in bottom layout.
					table = wfTable;
				}
				else if( prop.is( ".mf-add-property-control" ) ) {
				
					table = addPropTable;
				}
				/* CHECK: IS THIS OK??? */
				
				else if( prop.is( ".mf-remotevault" ) ) {
					table = $( "#mf-remotevault tbody" );
					msg = null;
					desc = null;
				}

				if( !prop.parent().is( table ) ) {
				
					table.append( desc );
					table.append( prop );
					table.append( msg );
				}

			} );

			// Remove extra dynamic tables.
			propertyControls.find( "table.mf-dynamic-table.mf-dynamic-col" ).remove();

			// Remove explicit sizes set for horizontal layout.
			$( ".mf-dynamic-table" ).css( "width", "" );
			$( "td.mf-dynamic-namefield" ).css( "width", "" );
			$( "td.mf-dynamic-controlfield" ).css( "width", "" );
			$( ".mf-obj-info-bar .mf-header-left, .mf-obj-info-bar .mf-header-right, .mf-obj-info-bar .mf-header-right .mf-namefield" ).css( "width", "" );
			this.element.find( ".mf-comment-area" ).css( { top: "", height: "" } );

			// Remove collapse functionality from the header.
			this.element.find( ".mf-file-header, #mf-buttons" ).off( "click.mfBottomCollapse" );

			// Request resizing. This re-layouts the metadata card.
			this.requestResize();
		},

		resizeLayout: function() {

			var self = this;
			this.resizeContentArea();

			// update title size in vertical layout
			var max = 23, min = 13;
			var header = $( ".mf-file-header:first" );
			var title = header.find( ".mf-filename" );
			var titleLength = title.text().length;
			var width = header.width() - 140;
			var ratio = .28; // the larger the value, the smaller the font size

			// 17 characters seem to fit at 23px font size and minimum window width 250
			// above 18px font we get 2 lines, at or below 18px we get 3
			// at 13px we get 4 lines - and everything should fit there
			var size = Math.round( width / ( titleLength * ratio ) );
			size = Math.min( max, Math.max( min, size ) );

			// resize with normal word breaking
			title.css( {
				"font-size": size + "px",
				"word-break": "normal",
				"opacity": 0.0
			} );

			// Allow timeout callback below to be handled before possibly now waiting deferred control creation. Otherwise CSS zero opacity set
			// above may be active while controls are being created, there hiding title (NOTE: the title still seems to disappear for 
			// longish time).
			var reschedule = false;
			if( this.deferredControlCreation.timeoutId ) {
				clearTimeout( this.deferredControlCreation.timeoutId );
				this.deferredControlCreation.timeoutId = undefined;
				reschedule = true;
			}
			
			// TERRIBLE HACK!
			// toggle pre/pre-wrap property to force IE to render the text properly
			// without this, ie can clip characters of the ends of line despite the fact that it is wrapping
			// this is also done in multiline control - pre-wrap seems to be the problem
			title.css( "white-space", "pre" );
			setTimeout( function() {
				title.css( {
					"white-space": "pre-wrap",
					"opacity": 0.99
				} );

				// force word breaking if needed after pre-wrap has been reset
				var newWidth = header[0].scrollWidth;
				var cardWidth = $( ".mf-metadatacard" ).innerWidth();
				if( newWidth - 80 > cardWidth ) {
					title.css( "word-break", "break-all" );
				}

				if ( reschedule )
					self.enqueDeferredControlCreation( 10 );

			}, 0 );

			// Notify active control about resizing by calling function viewResized (if the function exists).
			if( this.activeControl && this.activeControl.viewResized ) {
				this.activeControl.viewResized();
			}	
			
			// Show additional links: Subobjects and Remote vault.
			$( ".mf-additional-links-bottom" ).hide();
			$( ".mf-additional-links" ).show();
			
			// update comment layout
			$( ".mf-comment-area" ).commentscontrol( "size" );

		},

		resizeContentArea: function() {

			// Figure out all heights.
			var headerExpanded = self.controller.editor.GetUIData( "HeaderExpanded", true ),
				win = $( window ).height(),
				header = ( !headerExpanded ) ? 0 : this.element.find( ".mf-file-header" ).outerHeight(),
				saveas = $( "#save-as" ).outerHeight(),
				bar = this.element.find( ".mf-header-bar" ).outerHeight(),
				footer = this.element.find( "#mf-footer" ).outerHeight(),
				content = win - header - bar - footer;
				
			// Figure out property footer's height based on its visibility.
			var propFooter = 0;
			if( $( ".mf-property-footer" ).css( "display" ) !== "none" )
				propFooter = this.element.find( ".mf-property-footer" ).outerHeight();
			
			// Set height of the content area.
			this.element.find( ".mf-content" ).outerHeight( content );
			this.element.find( ".mf-section-properties>div" ).outerHeight( content - saveas - propFooter );
		},

		hidePreview: function() {

			// hide preview pane
			$( "body" ).toggleClass( "mf-preview-visible", false );

			// change preview button hover text
			$( ".mf-preview-button" ).attr( "title", this.localization.strings.IDS_METADATACARD_BUTTON_SHOWPREVIEW );

			// allow the metadata card to have full width (clear the width property)
			$( ".mf-metadatacard" ).css( "width", "" );

			// remove resizer bar
			$( "#mf-preview-sizer" ).remove();

			// remove window resize behavior
			$( window ).off( "resize.mfpreviewer" );

			// persist state of the preview to the model
			this.controller.editor.StorePreviewerState( false, this.controller.editor.PreviewerWidth );

			// shrink window by size of the previewer
			this.controller.dashboard.Window.Width -= this.controller.editor.PreviewerWidth;
		},

		showPreview: function() {

			var self = this;

			// Detect right-to-left layout.
			var rtl = ( $( "html.mf-rtl" ).length > 0 ) ? true : false;

			$( "body" ).toggleClass( "mf-preview-visible", true );

			// update the preview button hover text
			$( ".mf-preview-button" ).attr( "title", this.localization.strings.IDS_METADATACARD_BUTTON_HIDEPREVIEW );

			// add resizer bar and it's drag (resizing) behavior
			$( '<div id="mf-preview-sizer"></div>' )
				.appendTo( "body" )
				.css( "left", rtl ? $( "body" ).outerWidth() - this.resizePreviewer( 0, true ) - 4 : this.resizePreviewer( 0, true ) )  /* We must use the left coordinate also in RTL layout because draggable uses it for positioning. */
				.draggable( {
					axis: "x",
					drag: function( event, ui ) {

						// Calculate the new card width based on the new left position of the resizer.
						var cardWidth = 0;
						if( rtl )
							cardWidth = $( "body" ).outerWidth() - ui.position.left - 4;
						else
							cardWidth = ui.position.left;

						// Perform actual resizing of the card.
						var newCardWidth = self.resizePreviewer( cardWidth );

						// Limit dragging to the allowed resizing positions.
						if( rtl )
							ui.position.left = $( "body" ).outerWidth() - newCardWidth - 4;
						else
							ui.position.left = newCardWidth;
					}

				} );

			// add window resize behavior
			$( window ).on( "resize.mfpreviewer", function() {

				// resize pane and metadata card, and upate position of the resizer bar
				$( "#mf-preview-sizer" ).css( "left", rtl ? $( "body" ).outerWidth() - self.resizePreviewer() - 4 : self.resizePreviewer() );  /* We must use the left coordinate also in RTL layout because draggable uses it for positioning. */
			} );

			// add the previewer control if it doesn't already exist
			if( !$( "#mf-previewer" ).length ) {

				// Insert the previewer object.
				$( "#mf-preview-pane" ).html( "<object id='mf-previewer' classid='clsid:" + MFiles.CLSID.PreviewerCtrl + "'> </object>" );

				// Request the previewer to display content. This must be the last step, so that the exception
				// does not interrupt the DOM update.
				this.controller.dataModel.ShowFilePreview( $( "#mf-previewer" ).get( 0 ) );
			}
		},

		resizePreviewer: function( cardWidth, restore ) {

			// It is possible that this function is called before this.controller.dashboard.Window is available.
			// Check it here to ensure we don't try to use invalid window.
			if( !this.controller.dashboard.Window ) {
				return;
			}

			// Detect right-to-left layout.
			var rtl = ( $( "html.mf-rtl" ).length > 0 ) ? true : false;

			var minCardWidth = 550;
			var minPreviewWidth = 100;
			var winWidth = this.controller.dashboard.Window.Width;
			var previewWidth = this.controller.editor.PreviewerWidth;
			var isUserExplicit = false;
			var allowWindowResize = true;
			var minWinWidth, minMaxCardWidth;
			var previousCardWidth = self.controller.editor.GetUIData( "PreviousCardWidth", -1 );

			// enforce window minimum size
			this.controller.dashboard.Window.Width

			// React to different types of resizing events
			if( restore ) {

				// PREVIEWER JUST ENABLED

				// if no preview width has been previously defined, default to 400px
				previewWidth = previewWidth || 400;
				isUserExplicit = true;

				// Let's use the previously stored width if it exists and the new width would be one previewWidth too wide.
				// This happens at least with Single Popup feature when previewer size gets restored twice. Tracker #146299.
				if( previousCardWidth != -1 && ( previousCardWidth + previewWidth == this.controller.dashboard.Window.Width ) )
					this.controller.dashboard.Window.Width = previousCardWidth;

				// try to expand window to include preview size				
				this.controller.dashboard.Window.Width += previewWidth;

				// recalculate window width (we might not have gotten as much extra as we asked for)
				winWidth = this.controller.dashboard.Window.Width;

				// take any lost width from the card (minWidth will be enforced later)
				cardWidth = winWidth - previewWidth;

			} else if( !cardWidth ) {

				// WINDOW RESIZED

				// try to use the last eplicitly set previewer width (may have been shortend due to minWidths)
				previewWidth = this.defaultPreviewWidth || previewWidthWidth;

				// Check if the total window width has erroneously included preview width twice after user resized the window.
				// This happens rarely (1-2%) with Single Popup feature. Tracker #146299.
				if( winWidth == previousCardWidth + 2*previewWidth ) {
					// Remove one previewer width. Note: Preview itself is still wrongly drawn - half to its space. However,
					// this is deemed cosmetic & rare enough bug we can live with.
					winWidth = previousCardWidth + previewWidth;
					this.controller.dashboard.Window.Width = winWidth;
				}

				// preserve Previewer width 
				cardWidth = winWidth - previewWidth;

			} else {

				// CENTER RESIZE BAR MOVED
				isUserExplicit = true;
				allowWindowResize = false;
			}

			// enforce minimum widths for card and recalculate previewer width
			cardWidth = Math.max( cardWidth, minCardWidth );

			if( !allowWindowResize )
				cardWidth = Math.min( cardWidth, winWidth - minPreviewWidth );

			previewWidth = Math.max( winWidth - cardWidth, minPreviewWidth );
			minWinWidth = cardWidth + previewWidth;

			if( allowWindowResize && winWidth < minWinWidth )
				this.controller.dashboard.Window.Width = minWinWidth;

			// store user ideal preview size
			if( isUserExplicit )
				this.defaultPreviewWidth = previewWidth;

			// adjust the preview pane's left offset
			$( "#mf-preview-pane" ).css( rtl ? "right" : "left", cardWidth + "px" );

			// specify a fixed width for the metadatacard
			$( ".mf-metadatacard" ).outerWidth( cardWidth );

			// Store the card width if it has been changed.
			if( cardWidth != previousCardWidth )
				self.controller.editor.StoreUIData( "PreviousCardWidth", cardWidth, true, true, true );

			// persist state of the preview to the model
			this.controller.editor.StorePreviewerState( true, previewWidth );

			// update the layout now that we've potentially resized the card
			this.resizeLayout();

			return cardWidth;
		},

		hitHighlightingUpdated: function() {

			// Update hit highlighting.

			/* For testing
			
			var self = this;
			var status = "";
			var hits = "";
			if( this.controller.editor.HitHighlightingActive ) {

			// Active.
			status = "Hit highlighting ACTIVE";
			hits = this.controller.editor.SearchHits;
			}
			else {

			// Not active.
			status = "Hit highlighting not active";
			}

			$( "#mf-searchhits" ).text( status );

			$( "#mf-searchhits" ).tooltip( {
			items: "#mf-searchhits",
			position: {
			my: "left bottom",
			at: "center top"
			},
			content: function() {
			return '<div class="mf-revert"><div>Search hits:</div>' + utilities.htmlencode( hits, true ) + '</div>';
			}
			} );
			*/
			var self = this;
			setTimeout( function() {

				// HACK. It seems that sometimes hit highlighting is called
				// before content updated. Fix this.
				try {
					self.updateHighlights( self.controller.editor );
				}
				catch( ex ) { };

			}, 0 )


		},

		updateHighlights: function( editor ) {

			try {

				var r;

				// determine what to highlight if highlighting is active
				if( editor.HitHighlightingActive )
					r = utilities.getHitRegExp( editor.SearchHits );
				else
					this.element.removeHighlight();


				if( r ) {

					//loop over dynamic controls
					$( ".mf-control" ).each( function() {

						// get a handle on the value text
						var text = $( this ).find( ".mf-internal-text" );

						// make sure there is no pre-existing highlighted terms
						text.removeHighlight();

						// highlight if allowed and control is not in editMode nor has it been modified or holds a mulitvalue
						if( $( this ).is( ".mf-multiselectlookup" ) && $( this ).basecontrol( "canHighlight" ) ) {

							// we need to handle each internal lookup seperately
							$( this ).find( ".mf-internal-lookup" ).each( function() {
								var data = $( this ).data( "mfilesMflookupcontrol" );
								if( data && !utilities.isMultiValue( data.lookupValue ) )
									$( this ).find( ".mf-internal-text" ).highlight( r, true );
							} );

						} else if( $( this ).basecontrol( "canHighlight" ) )
							text.highlight( r, true );

					} );

					// loop over static controls
					$( ".mf-static-control" ).each( function() {

						$( this ).removeHighlight();

						if( $( this ).is( ":ui-staticcontrol" ) && $( this ).staticcontrol( "canHighlight" ) )
							$( this ).highlight( r, true );
					} );


					// loop over other static values that for some reason aren't considered static controls
					$( ".can-highlight" ).each( function() {
						var model = $( this ).data( "mfmodel" ) || $( this ).parent().data( "mfmodel" );

						$( this ).removeHighlight();

						if( model && model.AllowHitHighlighting() && !utilities.isMultiValue( model.Value ) )
							$( this ).highlight( r, true );

					} );

				}

				// delegate comment highlighting to comments control
				$( ".mf-comment-area" ).commentscontrol( "updateHighlights", this.controller.editor );

			}
			catch( ex ) { }

		},

		queryUIModifiedState: function() {

			return this.anyControlInEditMode;
		},

		commitUIModifiedState: function() {

			this.editManager.requestEditMode( null );
		},

		updateObjectStatus: function() {
			var classPrefix = "mf-state-";
			var curState = this.controller.getOverlayIconName();
			var classNames = $.map( this.controller.objectStates, function( state ) { return classPrefix + state } );

			// remove any pre-existing state class set for the metadatacard
			this.element.removeClass( classNames.join( " " ) );

			// if there is currently a specific state, set the corresponding class on the metadatacard
			// icon overlays use this class via css
			if( curState )
				this.element.addClass( classPrefix + curState );
		},


		setDiscardButtonText: function() {

			// Decide the text of the discard button.
			var discardButtonText = this.localization.strings.IDS_METADATACARD_BUTTON_DISCARD;

			// In a separate window we will show the discard button even if there are no changes.
			// In that case, it is better to label the button as Close.
			if( this.controller.editor.IsPoppedOut() && !this.inEditMode )
				discardButtonText = this.localization.strings.IDS_METADATACARD_BUTTON_CLOSE;

			// When creating a new object, there is nothing to discard yet and it is thus
			// better to label the button as Cancel.
			if( this.controller.dataModel.UncreatedObject )
				discardButtonText = this.localization.strings.IDS_METADATACARD_COMMAND_CANCEL;

			// Set the text.
			$( ".mf-discard-button" ).button( "option", "label", discardButtonText );
		},

		// onSave. Called on a save button click or a keyboard shortcut.
		onSave: function() {
		
			// Try to move all controls to view mode to check that there is no invalid values before saving.
			// If there are, saving is not allowed.
			if( this.editManager.requestEditMode( null ) ) {

				// Save metadata.
				this.save();
			}
		},

		// save.
		save: function() {

			// Save properties. In case of popout metadatacard, this call closes also the window.
			return this.controller.save();
		},

		// discard.
		discard: function() {

			this.controller.discard();
		},
		
		/**
		 * Starts spinner animation for metadata analyzing.
		 */
		startSpinner: function() {
			
			// Get elements.
			var self = this;
			var analyzeButton = $( ".mf-analyze-button" );
			var statusText = $( ".mf-analyze-status" );
			
			// Set to running-state.
			self.metadataSuggestions.running = true;
			
			// Show metadata analyzing status.
			self.metadataSuggestions.index = 0;
			analyzeButton.addClass( "step-" + self.metadataSuggestions.index );
			analyzeButton.find( ".ui-button-text" ).text( self.localization.strings.IDS_METADATACARD_BUTTON_ANALYZING );
			statusText.html( "&nbsp;" );
			analyzeButton.addClass( "mf-analysis-ongoing" );
			
			// Apply theme. A better place would be UpdateTheme() in Metadatacard.js, but it did not work there.
			analyzeButton.addClass( "mf-analyze-button-step-theme" );
			// Set interval for spinner.
			self.metadataSuggestions.intervalId = setInterval( function() {
				
				// Switch spinner to next state.
				var index = ( self.metadataSuggestions.index % 10 );
				analyzeButton.removeClass( "step-" + index );
				self.metadataSuggestions.index++;
				index = ( self.metadataSuggestions.index % 10 );
				analyzeButton.addClass( "step-" + index );
				
			}, 100 );
		},
		
		/**
		 * Stops spinner animation for metadata analyzing.
		 */
		stopSpinner: function() {
			
			// Stop spinner and reset button state.
			clearInterval( this.metadataSuggestions.intervalId );
			var index = ( this.metadataSuggestions.index % 10 );
			var analyzeButton = $( ".mf-analyze-button" );
			analyzeButton.removeClass( "step-" + index );
			analyzeButton.removeClass( "mf-analysis-ongoing" );
			analyzeButton.find( ".ui-button-text" ).text( this.localization.strings.IDS_METADATACARD_BUTTON_ANALYZE );
			analyzeButton.removeClass( "mf-analyze-button-step-theme" );
			this.metadataSuggestions.running = false;
		},
		
		/**
		 * Starts asynchronous metadata alalyzing for the selected object.
		 */
		analyze: function() {
			
			// Ignore if analysing is ongoing.
			if( this.metadataSuggestions.running )
				return;

			// Start asynchronous analyzing.
			this.controller.analyze();
		},

		/**
		 * Called when metadata analysis is complete.
		 *
		 * @param {boolean} suggestionsAvailable True if there are suggestions available.
		 */
		metadataAnalysisComplete: function( suggestionsAvailable ) {
			
			// Ensure that all UI controls are created.
			// If not, handling of analysis result is postponed until UI controls are created
			// in function updateControls.
			if( this.contentIsReady ) {
			
				// All UI controls are created, set property suggestions.
				var propertySuggestions = this.controller.getPropertySuggestions();
				this.setPropertySuggestions( propertySuggestions );

				// Set analysis status.
				if( suggestionsAvailable )
					$( ".mf-analyze-status" ).text( this.localization.strings.IDS_METADATACARD_ANALYSIS_COMPLETE );
				else
					$( ".mf-analyze-status" ).text( this.localization.strings.IDS_METADATACARD_ANALYSIS_NO_SUGGESTIONS );

				// Stop spinner and reset button state.
				this.stopSpinner();

				// Ensure focus is reset.
				if( this.focusedElement )
					this.focusedElement.focus();
			}
		},
		
		/**
		 * Called when metadata analysis fails with suggestions error.
		 *
		 * @param {string} errorMessage The error message to show.
		 */
		suggestionsError: function( errorMessage ) {
			
			// Show info message about suggestion error.
			$( ".mf-analyze-status" ).text( errorMessage );
			
			// Stop spinner and reset button state.
			this.stopSpinner();
		},

		// popOut.
		popOut: function() {

			this.controller.popOut();
		},

		// toggle location.
		toggleLocation: function() {

			// Resolve new location.
			var newLocation = ( this.controller.editor.Location == "bottom" ) ? "right" : "bottom";
			
			// Request native code to change metadata card location.
			this.controller.editor.SetLocation( newLocation );
		},

		skip: function() {

			this.controller.skip();
		},

		saveAll: function() {

			this.controller.saveAll();
		},

		hasUnsavedChanges: function() {

			return this.inEditMode;
		},

		_limitTextSelection: function( allowSelect ) {

			// limits text selection to areas matching the passed jQuery selector 'allowSelect'
			//
			// by default all selection background should be transparent
			//     *::selection { background: transparent }
			//
			// and only be visible with the class 'activeSelectArea'
			//     .activeSelectArea::selection, .activeSelectArea *::selection { background: inherit }
			var selectArea, mouseIsDown;

			// Private function for this method to trim down a selection
			function trimSelection() {
				try {

					// get a handle on the current selection
					var sel = window.getSelection();

					// if nothing is selected skip...
					if( sel.isCollapsed )
						return;

					// if there is no valid selection area active, clear all ranges and be done 
					if( sel.isCollapsed || !selectArea.length ) {
						sel.removeAllRanges();
						return;
					}

					var selRange = sel.getRangeAt( 0 );
					var finalRange = selRange.cloneRange();
					var selectAreaRange = selRange.cloneRange();

					// get a range of the whole area where selection is allowed
					selectAreaRange.selectNodeContents( selectArea.get( 0 ) );

					// resolve how the selectedRange and the allowed selectionRange compare
					// start: indicates how the start of the currently selected range compares to the start of the allowed selection range
					// end: indicates how the end of the currently selected range compares to the end of the allowed selection range
					var l = { "before": -1, "equals": 0, "after": 1 }
					var start = selRange.compareBoundaryPoints( 0, selectAreaRange ) // 0 = START_TO_START comparison
					var end = selRange.compareBoundaryPoints( 2, selectAreaRange ) // 2 = END_TO_END comparison

					// bring selection within the bounds of the selectable area
					if( start != l["before"] && end != l["after"] ) {

						// the entire selected range is within our selectable area
						// leave it alone!
						return;

					} else if( start != l["after"] && end != l["before"] ) {

						// the selectable area is within the selected range (this can happen when double/triple clicking)
						// trim selection to the whole selectable area
						finalRange = selectAreaRange;

					} else if( start == l["before"] && end != l["after"] ) {

						// backward selection - beginning outside selectable area
						// trim beginning of selection
						finalRange.setStartBefore( selectArea.get( 0 ) );
						finalRange.setEnd( sel.anchorNode, sel.anchorOffset );

					} else if( start != l["before"] && end == l["after"] ) {

						// forward selection - endding outside selectable area
						// trim end of selection
						finalRange.setStart( sel.anchorNode, sel.anchorOffset );
						finalRange.setEndAfter( selectArea.get( 0 ) );

					}

					// update final range
					sel.removeAllRanges();
					sel.addRange( finalRange );

				} catch( e ) {

				}
			}

			$( document ).on( {

				// listen for keydown events
				"keydown.textselection": function( evt ) {

					// only apply special key handling behavior if no input element is focused
					if( !$( document.activeElement ).is( "input, textarea, select" ) ) {

						// override default Ctrl+A behavior (Select All)
						if( evt.ctrlKey && evt.which == "A".charCodeAt( 0 ) ) {

							var ase = $( ".activeSelectArea" );
							if( window.getSelection && !window.getSelection().isCollapsed && ase.length ) {

								// select everything in active select area
								window.getSelection().selectAllChildren( ase.get( 0 ) );
							}

							// prevent default behavior
							return false;

						} else if( mouseIsDown && evt.ctrlKey && ( evt.which == "C".charCodeAt( 0 ) || evt.which == "X".charCodeAt( 0 ) ) ) {

							// If we're still in a selection process and Ctrl+X or Ctrl+C is received, we need to trim the selection right away
							// this will kill the current selection process, but the clipboard contents will be correct
							//trimSelection();
						}
					}
				},

				// listen for mousedown event 
				"mousedown.textselection": function( evt ) {

					mouseIsDown = true;

					// IE 8 and less... prevent all selection except in inputs in 
					if( !window.getSelection && !$( evt.target ).closest( "input, textarea, select" ).length ) {
						$( evt.target ).attr( 'unselectable', 'on' )
						   .css( { '-moz-user-select': 'none',
						   	'-o-user-select': 'none',
						   	'-khtml-user-select': 'none',
						   	'-webkit-user-select': 'none',
						   	'-ms-user-select': 'none',
						   	'user-select': 'none'
						   } );

						evt.preventDefault();
						return;
					}


					// make sure no area is still allowed to visibly show any text selection
					$( ".activeSelectArea" ).removeClass( "activeSelectArea" );

					// find the container which was clicked and allows selection (if there is one)
					// and add the class so it's text selection will be visible
					selectArea = $( evt.target ).closest( allowSelect ).addClass( "activeSelectArea" );

				},

				// listen for mouseup
				"mouseup.textselection": function( evt ) {
					mouseIsDown = false;
					trimSelection();
				}

			} );

		},
		
		// Resets class selector to correct state. This is called explicitly when focus is moved from class selector by Tab + Shift.
		_resetClassSector: function( callback ) {
			
			// Set tabindex back to previous element, which should be class selector.
			if( utilities.elementWithoutTabIndex !== null ) {
				utilities.elementWithoutTabIndex.attr( "tabindex", "0" );
				utilities.elementWithoutTabIndex = null;
			}
					
			// Set class selector to view mode.
			var activeControl = this.activeControl;
			setTimeout( function() {
					
				// Ensure that activeControl (in practice Class Selector) really exists before trying to set it to view mode.
				if( activeControl ) {
				
					// TODO: Hide class description if it is visible.
					activeControl.element.trigger( "stopEditing", { isCancel: false, setFocusToParent: false } );
				}
					
				// Notify completion.	
				if( callback )
					callback();
				
			}, 0 );
					
			// Remove stored control from metadata card.
			this.activeControl = null;

			// Set focused element to null;
			this.focusedElement = null;
		
		},
		
		// Updates metadata card theme.
		updateTheme: function( editMode ) {
//RSS
return;			
			// Reset all changes to get the basic theme defined in css.
			$( ".mf-header-bar" ).css( "background-color", "" );
			$( ".ui-button-primary" ).css( "background-color", "" );
			$( ".mf-property-footer" ).first().css( "display", "" );
			$( ".mf-metadatacard-description" ).css( "color", "" );
			$( ".mf-metadatacard-description" ).css( "background-color", "" );
			$( ".mf-property-description" ).css( "color", "" );
			$( ".mf-property-description" ).css( "background-color", "" );
			$( ".mf-permission-icon" ).css( "background-color", "" );
			$( ".mf-permission-section" ).css( "background-color", "" );
			$( ".mf-workflow-icon" ).css( "background-color", "" );
			$( ".mf-add-property-control" ).find( ".mf-addproperty" ).css( "color", "" );
			$( ".mf-analyze-button" ).css( "background-color", "" );
			$( ".mf-analyze-button.mf-analysis-ongoing" ).css( "border-color", "" );
			$( ".mf-location-button" ).toggleClass( "ui-state-hidden", false );

			// Remove overriding style definitions. Remove is safe to call also when they do not exist.
			$( '#mf-analyze-button-style-before' ).remove();
			$( '#mf-analyze-button-style-after' ).remove();
			$( '#mf-analyze-button-step-theme-style' ).remove();
			$( '#mf-property-suggestion-value-theme-style' ).remove();
			$( '#mf-property-suggestion-style-after' ).remove();

			// Show or hide Add property link according to the setting
			var isHidden = this.configurationManager.is( "MetadataCard.Theme.AddPropertyLink.IsHidden", true );
			$( ".mf-add-property-control" ).propertyline( "setHidden", isHidden );
			// Set color for Add property link according to the setting.
			this.configurationManager.get( "MetadataCard.Theme.AddPropertyLink.Color", function( color ) {
				$( ".mf-add-property-control" ).find( ".mf-addproperty" ).css( "color", color );
			} );

			// Read the ribbon background color from the theme.
			var key = "MetadataCard.Theme.Ribbon.BackgroundColor" + ( editMode ? ":Edit" : "" );
			var ribbonBackgroundColor = this.configurationManager.get( key );
			if( !ribbonBackgroundColor )
				ribbonBackgroundColor = "";
			// Check does the theme include ribbon background color.
			if( ribbonBackgroundColor.length > 0 )
			{
				// Set the ribbon background color.
				$( ".mf-header-bar" ).css( "background-color", ribbonBackgroundColor );
			}
			else
			{
				// No ribbon background color in the theme, read it from the style.
				ribbonBackgroundColor = $( ".mf-header-bar" ).css( "background-color" );
			}
			// Set the analysis area border color to match the ribbon color.
			$( ".mf-analyze-button.mf-analysis-ongoing" ).css( "border-color", ribbonBackgroundColor );
			// Set colors of the analyze button area outside of the arrow to match the ribbon color. The button
			// arrow is implemented utilizing pseudo elements ::before and ::after and are not available in DOM
			// for usual modification. Overriding the CSS style by adding new style definitions.
			$( 'head' ).append( '<style id = mf-analyze-button-style-before>.mf-analyze-button:before{ border-color: ' + ribbonBackgroundColor + ' transparent transparent transparent !important; }</style>' );
			$( 'head' ).append( '<style id = mf-analyze-button-style-after>.mf-analyze-button:after{ border-color: transparent transparent ' + ribbonBackgroundColor + ' transparent !important; }</style>' );
			// Note: Changing background-color directly for .mf-analyze-button.step-0 etc. does not work for some
			// reason. Instead adding new style theme definition and using it in startSpinner.
			$( 'head' ).append( '<style id = mf-analyze-button-step-theme-style>.mf-analyze-button-step-theme{ background-color: ' + ribbonBackgroundColor + ' !important; }</style>' );

			// Set button color.
			this.configurationManager.get( "MetadataCard.Theme.Buttons.BackgroundColor", function( backgroundColor ) {
				$( ".ui-button-primary" ).css( "background-color", backgroundColor );
			} );
			
			// Set button hover color.
			// This is used also to reset the hover color if the configuration changes.
			var backgroundColor = this.configurationManager.get( "MetadataCard.Theme.Buttons.BackgroundColor" );
			if( !backgroundColor )
				backgroundColor = "";
			var hoverColor = this.configurationManager.get( "MetadataCard.Theme.Buttons.BackgroundColor:Hover" );
			if( !hoverColor )
				hoverColor = "";
			$( ".ui-button-primary" ).hover( 
					function() {
					
						// Set the hover color.
						$( this ).css( "background-color", hoverColor );
					},
					function() {

						// Set back the background color.
						$( this ).css( "background-color", backgroundColor );
					}
					);
			
			// Set property footer visibility.
			this.configurationManager.get( "MetadataCard.Theme.Footer.IsHidden", function( isHidden ) {
			
				if( isHidden === true ) {
					// Hide footer if it is visible.
					var footer = $( ".mf-property-footer" ).first();
					if( footer.css( "display" ) !== "none" )
						footer.css( "display", "none" );
				}
				else {
					// Show footer if it is hidden.
					var footer = $( ".mf-property-footer" ).first();
					if( footer.css( "display" ) !== "table" )
						footer.css( "display", "table" );
				}
			} );

			// Hide location button if configured so.
			this.configurationManager.get( "MetadataCard.Theme.LocationButton.IsHidden", function( isHidden ) {
				if( isHidden === true )
					$( ".mf-location-button" ).toggleClass( "ui-state-hidden", true );
				else
					$( ".mf-location-button" ).toggleClass( "ui-state-hidden", false );
			} );

			// Get background and hover background colors for footer area.
			var footerBackgroundColor = this.configurationManager.get( "MetadataCard.Theme.Footer.BackgroundColor" );
			if( !footerBackgroundColor )
				footerBackgroundColor = "";
			var footerBackgroundColorHover = this.configurationManager.get( "MetadataCard.Theme.Footer.BackgroundColor:Hover" );
			if( !footerBackgroundColorHover )
				footerBackgroundColorHover = "";

			// Set footer background colors to a permission area, which consists of permission icon and permission section.
			$( ".mf-permission-icon" ).css( "background-color", footerBackgroundColor );
			$( ".mf-permission-section" ).css( "background-color", footerBackgroundColor );

			// Set hover background color to permission section.
			$( ".mf-permission-section" ).hover(
				function() {

					// Set the hover background color.
					$( this ).css( "background-color", footerBackgroundColorHover );
				},
				function() {

					// Set back the background color.
					$( this ).css( "background-color", footerBackgroundColor );
				}
			);

			// Set footer background colors to a workflow area, which consists of workflow icon and workflow and workstate property lines.
			$( ".mf-workflow-icon" ).css( "background-color", footerBackgroundColor );
			$( ".mf-property-99" ).propertyline( "setBackgroundColor", footerBackgroundColor, footerBackgroundColorHover );
			$( ".mf-property-38" ).propertyline( "setBackgroundColor", footerBackgroundColor, footerBackgroundColorHover );

			// Set theme for metadata card description.
			$( "h1, h2, h3" ).css( "color", "inherit" );
			this.configurationManager.get( "MetadataCard.Theme.DescriptionField.Color", function( color ) {
				$( ".mf-metadatacard-description" ).css( "color", color );
			} );
			this.configurationManager.get( "MetadataCard.Theme.DescriptionField.BackgroundColor", function( backgroundColor ) {
				$( ".mf-metadatacard-description" ).css( "background-color", backgroundColor );
			} );
			
			// Set theme for property descriptions.
			this.configurationManager.get( "MetadataCard.Theme.Properties.DescriptionField.Color", function( color ) {
				$( ".mf-property-description" ).css( "color", color );
			} );
			this.configurationManager.get( "MetadataCard.Theme.Properties.DescriptionField.BackgroundColor", function( backgroundColor ) {
				$( ".mf-property-description" ).css( "background-color", backgroundColor );
			} );
			// Set the background color for the Analyze button.
			var analyzeButtonBackgroundColor = this.configurationManager.get( "MetadataCard.Theme.AnalyzeButton.BackgroundColor" );
			if( !analyzeButtonBackgroundColor )
				analyzeButtonBackgroundColor = "";
			$( ".mf-analyze-button" ).css( "background-color", analyzeButtonBackgroundColor );
			// Set the hover color for the Analyze button.
			// This is used also to reset the hover color if the configuration changes.
			var analyzeButtonHoverColor = this.configurationManager.get( "MetadataCard.Theme.AnalyzeButton.BackgroundColor:Hover" );
			if( !analyzeButtonHoverColor )
				analyzeButtonHoverColor = "";
			$( ".mf-analyze-button" ).hover(
					function() {
						// Set the hover color.
						$( this ).css( "background-color", analyzeButtonHoverColor );
					},
					function() {
						// Set back the background color.
						$( this ).css( "background-color", analyzeButtonBackgroundColor );
					}
			);
			// Set background color for the property suggestions.
			var propertySuggestionsBackgroundColor = this.configurationManager.get( "MetadataCard.Theme.PropertySuggestions.BackgroundColor" );
			if( !propertySuggestionsBackgroundColor )
				propertySuggestionsBackgroundColor = "";
			// Note: Changing background-color directly for .mf-property-suggestion-value does not work for some
			// reason. The new color is seen only after focus is moved to metadatacard. Instead adding new style
			// definitions and using them where suggestion controls are created.
			if( propertySuggestionsBackgroundColor.length > 0 )
			{
				$( 'head' ).append( '<style id = mf-property-suggestion-value-theme-style>.mf-property-suggestion-value-theme{ background-color: ' + propertySuggestionsBackgroundColor + '; }</style>' );
				$( 'head' ).append( '<style id = mf-property-suggestion-style-after>.mf-property-suggestion::after{ border-left-color: ' + propertySuggestionsBackgroundColor + '; }</style>' );
			}
		},

		// Called by lookup control, when lookup value(s) are changed.
		lookupValueChanged: function( type, oldValue, newValue, propertyDef ) {
		
			// Branch by type.
			if( type === "changed" ) {
			
				// Value of SSLU control changed.
				// Inform configuration manager about changed value. 
				this.configurationManager.onValueChanged( oldValue, newValue, propertyDef, false, true );

				// Update the state transition control if workflow has been changed.
				if( propertyDef === 38 ) {
					
					// Update state transition control after 100 ms.
					setTimeout( function() {
					
						// Update state transition control.
						$( ".mf-property-99 .mf-control.mf-dynamic-control" ).mfmultiselectlookupcontrol( "updateView" );	

					}, 100 ); 
				}
			}
			else if( type === "replaced" ) {
			
				// Value of single field in MSLU control changed.
				// Inform configuration manager about changed value.
				this.configurationManager.onValueChanged( oldValue, newValue, propertyDef, false, true );
			}
			else if( type === "added" ) {
			
				// Single value list item added to MSLU control. Inform configuration manager about added item.
				// Note that this events might be caused e.g. by auto-filling of properties.
				// It should be possible to use also this kind of events for triggering (if defined by rule condition).
				this.configurationManager.onValueChanged( oldValue, newValue, propertyDef, !this.propertyValueChangedByUser, false );
				this.propertyValueChangedByUser = false;
			}
			else if( type === "removed" ) {
			
				// Single value list item removed from MSLU control.
				// Inform configuration manager about removed item. Do this only if item was removed by the user.
				if( this.itemRemovedByUser )
					this.configurationManager.onValueChanged( oldValue, newValue, propertyDef, false, false );
				this.itemRemovedByUser = false;
			}

			// If a MSLU is active and the change could affect its filtering, close it.
			this._closeStaleActiveMSLU( type, oldValue, newValue, propertyDef );
		},

		_closeStaleActiveMSLU: function( type, oldValue, newValue, propertyDef ) {
			/// <summary>
			///   If the current control is a multiselectlookup, closes it
			///   if it is possible its suggestions are no longer valid after the update described by the parameters.
			/// </summary>
			/// <param name="type" type="'changed'|'removed'|'added'|'replaced'">
			///   The type of the update.
			/// </param>
			/// <param name="oldValue" type="property value">
			///   The value before the update.
			/// </param>
			/// <param name="newValue" type="property value">
			///   The value after the change.
			/// </param>
			/// <param name="propertyDef" type="int">
			///   The id of the property that was updated.
			/// </param>

			// Check that there is an active control.
			if( !!this.activeControl ) {

				// Try to dig a multiselectlookup from the active control.
				var multiselect = this.activeControl.element.data( "mfiles-mfmultiselectlookupcontrol" );
				if( !!multiselect ) {

					// Only react to change types that can make the filter stricter.
					var filterPotentiallyStricter = ( type === "added" || type === "changed" );

					// Do not react if the the change was just the removal of an empty row.
					var emptyRemoval = ( !oldValue || oldValue.name === "" ) && newValue === null;
					if( filterPotentiallyStricter && !emptyRemoval ) {

						// If the property that changed was not of the active control,
						// close the active MSLU to make sure its filters
						// take the new value into account. See Tracker issue #142603.
						if( this.activeControl.model && this.activeControl.model.propertyDef !== propertyDef ) {

							// Close the autocompletion list. It will be repopulated with the new filter when reopened.
							multiselect.closeAllLists();
						}
					}
				}
			}
		},
		
		// Metadacard updating is ready.
		contentUpdated: function() {
		
			// Inform configuration manager about updated content. 
			this.configurationManager.onAfterContentUpdated();
		},
		
		/**
		 * Sets property texts.
		 *
		 * @param texts - Texts.
		 */
		setPropertyTexts: function( type, texts ) {
		
			// Set texts.
			this[ "property" + type + "s" ] = texts;
		},
		
		/**
		 * Returns requested text by property definition id.
		 *
		 * @param type - Type of the requested text: "Tooltip", "Description" or "Label".
		 * @param propertyDef - The property definition id.
		 *
		 * @returns The requested text or null if not found. 
		 */
		getPropertyText: function( type, propertyDef ) {
		
			// If the requested text for the property is defined, return it.
			if( this[ "property" + type + "s" ] .hasOwnProperty( propertyDef ) )
				return this[ "property" + type + "s" ][ propertyDef ];	
				
			// Otherwise, return null.
			return null;
		},
		
		/**
		 * Sets description text and image for the metadata card.
		 *
		 * @param encodedText - The description text for the metadata card. Contains only safe HTML tags.
		 * @param imageUrl - URL for the description image.
		 * @param width - Width of the description image.
		 * @param height - Height of the description image.
		 */
		setMetadatacardDescription: function( encodedText, imageUrl, width, height ) {
		
			// Get description area. Contains both, the image and the text.
			var descriptionArea = $( ".mf-metadatacard-description" ).first();
		
			// Encode possible HTML.
			var encodedUrl = ( imageUrl ) ? utilities.removeQuotes( imageUrl ) : "";
					
			// Update description text and image if needed.
			if( ( encodedText && encodedText.length > 0 )  || ( encodedUrl && encodedUrl.length > 0 ) ) {
				
				var updated = false;
				
				// Update description text.
				if( this.updateDescriptionText( encodedText ) )
					updated = true;
				
				// Update description image.
				if( this.updateDescriptionImage( encodedUrl, width, height ) )
					updated = true;
				
				// Show description area if not shown yet.
				if( descriptionArea.css( "display" ) === "none" ) {
					descriptionArea.show();
					updated = true;
				}
				
				// Resize if needed.
				if( updated ) {
					this.requestResize();
				}
			}
			else {
			
				// Hide description area if not hidden yet.
				if( descriptionArea.css( "display" ) !== "none" ) {
				
					// Hide description area.
					descriptionArea.hide();
					
					// Resize metadata card.
					this.requestResize();
				}
			}
		},
		
		/**
		 * Updates metadata card description text if it has been changed.
		 *
		 * @param encodedText - The description text for the metadata card. Contains only safe HTML tags.
		 */
		updateDescriptionText: function( encodedText ) {
		
			// Contains information whether description text has been updated.
			var updated = false;
		
			// Get description text field.
			var descriptionField = $( "#mf-metadatacard-description" ).first();
		
			// Update description text.
			if( encodedText && encodedText.length > 0 ) {
			
				// Update description text if it has been changed.
				if( descriptionField.html() !== encodedText ) {
			
					// Update description text.
					descriptionField.html( encodedText );
					
					// Set click handlers for executable links.
					utilities.setLinkHandlers( descriptionField );
					
					// Updated.
					updated = true;
				}
				
				// Show description text if not shown yet.
				if( descriptionField.css( "display" ) === "none" ) {
				
					// Show description text.
					descriptionField.show();
					updated = true;
				}
			}
			else {
			
				// Hide description text if not hidden yet.
				if( descriptionField.css( "display" ) !== "none" ) {
				
					// Hide description text. 
					descriptionField.hide();
					updated = true;
				}
			}
			return updated;
		},
		
		/**
		 * Updates metadata card description image if it has been changed.
		 *
		 * @param encodedUrl - URL for the description image.
		 * @param width - Width of the description image.
		 * @param height - Height of the description image.
		 */
		updateDescriptionImage: function( encodedUrl, width, height ) {
		
			// Contains information whether description image has been updated.
			var updated = false;
			
			// Get description image container.
			var imageContainer = $( ".mf-description-image-container" ).first();
		
			// Update description image.
			if( encodedUrl && encodedUrl.length > 0 ) {
			
				// Get description image.
				var descriptionImage = $( "#mf-description-image" );
			
				// Update image URL if it has been changed.
				if( descriptionImage.attr( "src" ) !== encodedUrl ) {
					descriptionImage.attr( "src", encodedUrl );
					updated = true;
				}
				
				// Update image size if it has been changed.
				if( descriptionImage.css( "width" ) !== ( width + "px" ) || descriptionImage.css( "height" + "px" ) !== ( height ) ) {
				
					// Update image size.
					descriptionImage.css( "width", width + "px" );
					descriptionImage.css( "height", height + "px" );
					
					// Margin of the image container ( mf-description-image-container ) is 10 pixels.
					var containerWidth = ( width + 20 ) + "px";
					
					// Detect Right-to-Left language.
					var rtl = ( $( "html.mf-rtl" ).length > 0 ) ? true : false;
					if( rtl ) {
					
						// Update width of image area on the right.
						$( "#mf-description-image-area" ).css( "width", containerWidth );
						$( "#mf-description-text-area" ).css( "margin-right", containerWidth );
					}
					else {
					
						// Update width of image area on the left.
						$( "#mf-description-image-area" ).css( "width", containerWidth );
						$( "#mf-description-text-area" ).css( "margin-left", containerWidth );
					}
					
					// Updated.
					updated = true;
				}
				
				// Show image container if not shown yet.
				if( imageContainer.css( "display" ) === "none" ) {
				
					// Show image container.
					imageContainer.show();
					updated = true;
				}
			}
			else {
			
				// Hide image container if not hidden yet.
				if( imageContainer.css( "display" ) !== "none" ) {
				
					// Hide image container.
					imageContainer.hide();
					
					// Detect Right-to-Left language and reset image width and margins.
					var rtl = ( $( "html.mf-rtl" ).length > 0 ) ? true : false;
					if( rtl ) {
						$( "#mf-description-image-area" ).css( "width", 0 );
						$( "#mf-description-text-area" ).css( "margin-right", 0 );
					}
					else {
						$( "#mf-description-image-area" ).css( "width", 0 );
						$( "#mf-description-text-area" ).css( "margin-left", 0 );
					}
					
					updated = true;
				}			
			}
			return updated;
		},

		/**
		 * Shows more info about the object.
		 */
		setMoreInfo: function( value ) {

			// Get "More info" area. Contains both, the image and the text.
			var infoArea = $( ".mf-metadatacard-moreinfo" ).first();

			// Show nothing if no objects are selected.
			var show = ( value ) ? true : false;

			// Check if more info should be shown in the description field
			// for incomplete offline items (in advanced offline).
			if( MFiles.IsClientFeatureEnabled( "MF1_212AdvancedOffline" ) && show ) {

				// Get offline description text.
				var text = this.controller.getOfflineDescription();

				// Encode.
				var encodedText = utilities.htmlencode( text );

				// Show offline description or hide the "More info" area.
				if( encodedText && encodedText.length > 0 ) {

					// Set encoded image URL.
					var moreInfoIconUrl = "UIControlLibrary/images/more_info.png";

					// Need to resize?
					var updated = false;

					// Update text.
					if( this.updateMoreInfoText( encodedText ) )
						updated = true;

					// Update image.
					if( this.updateMoreInfoImage( moreInfoIconUrl ) )
						updated = true;

					// Show "More info" area if not shown yet.
					if( infoArea.css( "display" ) === "none" ) {
						infoArea.show();
						updated = true;
					}

					// Resize if needed.
					if( updated ) {
						this.requestResize();
					}
				}
				else {

					// Hide "More info" area if not hidden yet.
					if( infoArea.css( "display" ) !== "none" ) {

						// Hide "More info" area.
						infoArea.hide();

						// Resize metadata card.
						this.requestResize();
					}

				}  // end if (text to show)

			}  // end if (feature flag on)
			else {

				// Hide "More info" area if not hidden yet.
				if( infoArea.css( "display" ) !== "none" ) {

					// Hide "More info" area.
					infoArea.hide();

					// Resize metadata card.
					this.requestResize();
				}

			}  // end if (feature flag off)
		},

		updateMoreInfoText: function( encodedText ) {

			// Contains information whether info text has been updated.
			var updated = false;

			// Get info text field.
			var infoField = $( "#mf-moreinfo-text" );

			// Update info text if it has been changed.
			if( infoField.html() !== encodedText ) {

				// Update info text.
				infoField.html( encodedText );
				updated = true;
			}

			// Show info text if not shown yet.
			if( infoField.css( "display" ) === "none" ) {

				// Show info text.
				infoField.show();
				updated = true;
			}

			return updated;
		},

		/**
		 * Update info image.
		 */
		updateMoreInfoImage: function( imageUrl ) {

			// Contains information whether "More info" image has been updated.
			var updated = false;

			// Get info image container.
			var infoImageContainer = $( ".mf-moreinfo-image-container" ).first();

			// Get info image.
			var infoImage = $( "#mf-moreinfo-image" );

			// Update image URL if it has been changed.
			if( infoImage.attr( "src" ) !== imageUrl ) {
				infoImage.attr( "src", imageUrl );
				updated = true;
			}

			// Show image container if not shown yet.
			if( infoImageContainer.css( "display" ) === "none" ) {

				// Show image container.
				infoImageContainer.show();
				updated = true;
			}
			return updated;
		},
		
		/**
		 * Creates special element, which is added to beginning of HTML tables to set alignment of UI controls properly.
		 * This is needed for description fields.
		 */
		createAlignmentElement: function() {
		
			// Create alignment element.
			return $( '<tr class="mf-alignment-header mf-alignment"><td class="mf-dynamic-namefield"></td><td class="mf-modify"></td><td class="mf-dynamic-controlfield"></td><td class="mf-dynamic-lastfield"></td></tr>' );
		},
		
		// setValueListTooltips.
		setValueListTooltips: function( valueListTooltips ) {
		
			// Set value list tooltips.
			this.valueListTooltips = valueListTooltips;			
		},
		
		// getValueListTooltip.
		getValueListTooltip: function( valueListId, valueListItemId ) {
		
			// Check that value list tooltips are set.
			if( this.valueListTooltips ) {
			
				// Check that value list id exists in tooltip manager.			
				if( this.valueListTooltips.hasOwnProperty( valueListId ) ) {
				
					// Get value list by value list id.
					var valueList = this.valueListTooltips[ valueListId ];
					if( valueList.hasOwnProperty( valueListItemId ) ) {
						
						// Return found tooltip by value list item id.
						var item = valueList[ valueListItemId ];
						return item;
					}
				}
			}
			
			// Tooltip for value list item was not found.
			return null;
		},
		
		/**
		 * Sets custom UI controls.
		 *
		 * @param uiControls Custom UI controls.
		 */
		setCustomUIControls: function( uiControls ) {
		
			// Set custom UI controls.
			this.customUIControls = uiControls;			
		},
		
		/**
		 * Returns custom UI control by property definition or null if not found.
		 *
		 * @param propertyDef - Property definition id of the property.
		 * @return Custom UI control or null if not found.
		 */
		getCustomUIControl: function( propertyDef ) {
		
			// Returns custom UI control for the property or null if not found.
			if( this.customUIControls.hasOwnProperty( propertyDef ) )
				return this.customUIControls[ propertyDef ];
			return null;
		},
		
		/**
		 * Sets flag to indicate that change to value of text property was done by an user.
		 *
		 * @param propertyValueChangedByUser - True to inform that value is changed by user.
		 */
		setUpdatedByUser: function( propertyValueChangedByUser ) {
		
			// Set flag.
			this.propertyValueChangedByUser = propertyValueChangedByUser;
		},
		
		/**
		 * Called by text-based control, when text value is changed.
		 *
		 * @param propertyDef - The property definition.
		 */
		textValueChanged: function( propertyDef ) {
				
			// Inform configuration manager about changed text only if change is done by an user.
			if( this.propertyValueChangedByUser )
				this.configurationManager.onTextValueChanged( propertyDef );				
		},

		/**
		 * By calling this the text control can set warning texts that are shown right below
		 * the control. This should be called during the initialization or during edit-mode/normal-mode
		 * change because it still requires metadata card relayouting before the warning text
		 * comes visible.
		 *
		 * @param warningText - The warning text to be shown.
		 * @param controlID - ID of the control.
		 */
		setTextControlWarning: function( warningText, controlID ) {

			// Add the warning text to the warnings array.
			this.textControlWarnings.push( {
						controlID: controlID,
						warningText: warningText
					} );
		},

		/**
		 * Processes all the warnings that have been set for the UI controls and
		 * show them on the UI.
		 */
		showControlWarnings: function() {

			// Process all the warning texts and set them to the UI.
			for( var i = 0; i < this.textControlWarnings.length; ++i ) {

				// Show the error in the UI.
				var warningItem = this.textControlWarnings[ i ];
				this.setError( warningItem.warningText, warningItem.controlID );
			}

			// All warning texts have been processed. Empty the array.
			this.textControlWarnings = [];
		},

		/**
		 * Called for creating description, message and value suggestion container controls. These controls are not visible in initial state of metadata
		 * card and can therefore be created after content is initialized (and metadata card is first shown to the user).
		 * 
		 * @param deferredItem control properties (not M-Files properties).
		 */
		createdControlsForPropertyline: function ( deferredItem ) {
			if ( deferredItem.created ) {
				return;
			}

			// This is executed after everything else to speed up getting metadata card visible to the user.
			// The more properties in metadata card, the more this affects.

			// Apply more comprehensive error handling. In some situations the property has already been
			// decommissioned when this function gets executed. Related to Tracker #133440.
			var errorText = "";
			try {

				// First ensure that related property line still exists in DOM.
				var elem = $( "tr#" + deferredItem.elementId );
				if( elem.length > 0 ) {

					// Property line exists.

					// Ensure that property exists in the model.
					var property = deferredItem.property;
					try {

						// Test the property. If it is decommissioned, it still looks valid but referencing it
						// throws the 'The object cannot be accessed, because it has been decommissioned' exception.
						var propertyId = property.ID;
					}
					catch( ex ) {

						// Set error text.
						errorText = "Property '" + deferredItem.label + "' (ID: " + deferredItem.propertyDef +
									") not found from the model.\n";

						// Try to obtain the property again from the model.
						property = undefined;
						var properties = this.controller.getProperties();
						$.each( properties, function( index, candidate ) {
							if( candidate.propertyDef == deferredItem.propertyDef ) {

								// The property was found. Clear error and exit the loop.
								property = candidate;
								errorText = "";
								return false;
							}
						} );
					}

					// Check if we have a valid property object.
					if( property ) {

						// Property in the model exists. Create controls.

						// Description line.
						var rawElem = utilities.createDocumentElement( 'tr', 'mf-description-row', 'mf-description-row-' + property.ID );
						var descriptionLine = $( rawElem );
						descriptionLine.descriptionline( { visible: deferredItem.visible, isHidden: deferredItem.hidden } );
						descriptionLine.descriptionline( "initialize", property, this );

						// Message line.
						rawElem = utilities.createDocumentElement( 'tr', 'mf-message-row', 'mf-message-row-' + property.ID );
						var messageLine = $( rawElem );
						messageLine.messageline( { visible: deferredItem.visible, isHidden: deferredItem.hidden, propertydef: property.propertyDef } );
						messageLine.messageline( "initialize", property, this, deferredItem.isPropertySelector );

						// Value suggestion container.
						var propertyLine = deferredItem.propertyLine;
						rawElem = utilities.createDocumentElement( 'tr', 'mf-valuesuggestion-container-row', 'mf-valuesuggestion-container-row-' + property.ID );
						var valueSuggestionContainer = $( rawElem );
						valueSuggestionContainer.valuesuggestioncontainer( { visible: deferredItem.visible, isHidden: deferredItem.hidden } );
						valueSuggestionContainer.valuesuggestioncontainer( "createControls", property, propertyLine, this );

						// Add controls around the property line.
						propertyLine.before( descriptionLine );
						propertyLine.after( valueSuggestionContainer );
						propertyLine.after( messageLine );
					}
					else {

						// If controls could not be added above, trying to edit the property likely yields error
						// "cannot call methods on messageline prior to initialization; attempted to call method 'setError'"
						// and discarding changes in metadata card is all the user can do.
					}
				}
			}
			catch( ex ) {

				// Some other error.
				if( errorText.length == 0 ) {
					errorText = "Exception: " + ex.message;
				}
			}

			// Write error to log.
			if( errorText.length > 0 ) {
				utilities.log( errorText, { "showTimestamp" : true, "render" : true } );
			}

			// Set even if error occurred.
			deferredItem.created = true;
		},
		
		/**
		 * Checks if requested property control is visible and editable
		 * (not hidden or set to read-only mode by metadata card configuration).
		 *
		 * @param propertyDef - Property definition id of the property.
		 * @return True if requested property control is visible and editable
		 */
		isPropertyAllowed: function( propertyDef ) {
		
			// Check if requested property control is visible and editable.
			if( this.localModel.isHidden( propertyDef ) ||
				this.localModel.isReadOnly( propertyDef ) )
				return false;
		
			// Not hidden or read-only, return true.	
			return true;
		},
		
		/**
		 * Sets property suggestions.
		 *
		 * @param propertySuggestions - Property suggestions.
		 */
		setPropertySuggestions: function( propertySuggestions ) {
		
			// Clear property suggestions.
			$( "#mf-property-suggestions" ).suggestioncontrol( "clearPropertySuggestions" );
			
			// Ceate new property suggestions.
			if( propertySuggestions && propertySuggestions.length > 0 ) {
						
				// Create property suggestion control for each suggestion.			
				for( var i = 0; i < propertySuggestions.length; i++ ) {
							
					// Ensure that corresponding property control is visible and editable
					// (not hidden or set to read-only mode by metadata card configuration).
					var suggestion = propertySuggestions[ i ];
					var allowed = this.isPropertyAllowed( suggestion.ID );
						
					// Create property suggestion control if allowed.
					if( allowed ) {
							
						// Create property suggestion control.
						$( "#mf-property-suggestions" ).suggestioncontrol( "addPropertySuggestion",
								suggestion.ID, suggestion.Name, this.controller.dataModel );
					}
				}	
			}
		}
		
	} ); // End of widget 'metadatacard'.

} )( jQuery );