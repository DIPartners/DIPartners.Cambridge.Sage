"use strict";

// Configuration helper
//
// Helper object to make it easier to search requested key-value pairs from the current configuration object.
function ConfigurationHelper() {
	
	// Current configuration.
	this.configuration = null;
	
	/**
	 * Sets configuration object.
	 *
	 * @param configuration - The configuration object.
	 */
	this.setConfiguration = function( configuration ) {

		// Set current configuration.
		this.configuration = configuration;
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
	this.get = function( propertyName, callback ) {
	
		// Return value.
		var result = null;
		
		// Split property name to array.
		var array = propertyName.split( "." );
		
		if( this.configuration ) {
		
			// Loop each part of the property name and search the requested property from the configuration hierarchy.
			var current = this.configuration;
			for( var i = 0; i < array.length; i++ ) {
			
				var item = array[ i ];
				if ( current.hasOwnProperty( item ) ) {
					current = current[ item ];
					
					// If latest part of the property name was found, inform caller about found property or store the result.
					if( i == array.length - 1 ) {
					
						if( callback )
							callback( current );
						else
							result = current;
					}
				}
				else
					break;
			}
		}
		return result;
	};
	
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
	
		// Search requested property.
		// If the property was found, compare whether the value of found property is equal to the requested value.
		var foundValue = this.get( propertyName, null );
		return ( foundValue && ( foundValue === value ) );
	};
	
	/**
	 * Method to search requested JS property from current configuration object and compare it.
	 * If the requested property exists and its value is NOT equal to the second parameter,
	 * function returns true, otherwise false.
	 *
	 * @param propertyName - The JS property name. Nested properties/objects are divided by dot. For example: "MetadataCard.Theme.PropertySelector.Visibility".
	 * @param value - The value to compare.
	 *
	 * @return True, if value of requested property DOES NOT match to value to compare.
	 */
	this.isNot = function( propertyName, value ) {
		return !this.is( propertyName, value );
	}
};
