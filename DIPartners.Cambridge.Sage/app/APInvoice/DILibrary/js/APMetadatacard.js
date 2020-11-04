
(function ($, undefined) {
	$.widget("mfiles.metadatacard", {

		// options.
		options: {
		},

		// _create.
		// Creates this metadatacard widget.
		_create: function () {
			var self = this;
			this.anyControlInEditMode = false;
			this.inEditMode = false;
		},

		initialize: function (controller, initParameters) {
			var self = this;
			this.controller = controller;

			$(".mf-save-button").button({ label: saveLabel }).click(function (event) {

				// Save.
				self.onSave();

				// Stop event propagation.
				event.stopPropagation();
			});
			$(".mf-save-button").attr("title", saveTooltip);

			// Create discard button.
			$(".mf-discard-button").button({ label: localizationStrings.IDS_METADATACARD_BUTTON_DISCARD }).click(function (event) {

				// If we are in comments view, try to move all controls to view mode. This ensures that the text
				// from the "New comment" field is stored to the model before actual discarding.
				if ($("#mf-comments-view").css("display") !== "none")
					self.editManager.requestEditMode(null);

				// Clear property suggestions.
				$("#mf-property-suggestions").suggestioncontrol("clearPropertySuggestions");

				// Discard metadata.
				self.discard();

				// Stop event propagation.
				event.stopPropagation();

			});
		},

		editModeStarted: function (updateTheme) {

			// Set edit mode.
			this.inEditMode = true;

			// Update save, discard, skip and saveall button states. 
			$(".mf-save-button, .mf-discard-button").toggleClass("ui-state-disabled", false);

			// Set elements to represent edit mode. Must be done before updateTheme().
			this.element.addClass("mf-editmode");
			// Update metadata card theme if requested.
			if (updateTheme)
				this.updateTheme(true);

			//resizeContent area to hide footer
			this.resizeContentArea();

			// Set the text of the discard button.
			this.setDiscardButtonText();

			// Inform the metadata model that edit mode is on.
			this.controller.editor.SetEditMode(true);
		},

		// viewModeStarted.
		viewModeStarted: function (updateTheme) {

			// Reset edit mode.
			this.inEditMode = false;

			// Update save, discard, skip and saveall button states. 
			$(".mf-save-button, .mf-skip-button, .mf-saveall-button").toggleClass("ui-state-disabled", true);
			//RSS			$( ".mf-discard-button" ).toggleClass( "ui-state-disabled", !self.controller.editor.IsPoppedOut() );
			$(".mf-discard-button").toggleClass("ui-state-disabled", true);

			// Set elements to represent view mode. Must be done before updateTheme().
			this.element.removeClass("mf-editmode");
			// Update metadata card theme.
			if (updateTheme)
				this.updateTheme(false);

			// Set the text of the discard button.
			this.setDiscardButtonText();

			//resizeContent area to hide footer
			this.resizeContentArea();

			// Inform the metadata model that view mode is on.
			this.controller.editor.SetEditMode(false);
		},

	});
})(jQuery);