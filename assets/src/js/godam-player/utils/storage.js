/**
 * Safely reads JSON from localStorage by key.
 *
 * @param {string} key          - localStorage key to read.
 * @param {*}      defaultValue - Value to return if key is missing or parsing fails.
 * @return {*} Parsed value or defaultValue.
 */
function readLocalStorageJSON( key, defaultValue = {} ) {
	try {
		const data = localStorage.getItem( key );
		if ( ! data ) {
			return defaultValue;
		}
		return JSON.parse( data );
	} catch ( e ) {
		return defaultValue;
	}
}

/**
 * Safely writes JSON to localStorage by key.
 *
 * @param {string} key
 * @param {*}      value
 */
export function writeLocalStorageJSON( key, value ) {
	try {
		localStorage.setItem( key, JSON.stringify( value ) );
	} catch ( e ) {
		//silent fail
	}
}

/**
 * Retrieves all stored layer interactions from localStorage.
 *
 * @return {Object<string, Array<Object>>} An object where keys are instance IDs and values are arrays of interaction objects.
 */
export function getLayerInteractions() {
	return readLocalStorageJSON( 'layerInteractions', {} );
}

/**
 * Adds a new interaction entry for a given layer instance and saves it to localStorage.
 *
 * @param {string} instanceId                - Unique identifier of the layer instance.
 * @param {Object} layerData                 - The interaction data to store for the layer.
 * @param {string} layerData.layer_id        - The unique ID of the layer (e.g., hotspot ID, CTA ID).
 * @param {string} layerData.layer_type      - The type of layer (e.g., "cta", "hotspot", "form").
 * @param {string} layerData.action_type     - The type of user action (e.g., "clicked", "submitted").
 * @param {number} layerData.layer_timestamp - The video timestamp (in seconds) where the interaction occurred.
 *
 * @return {void}
 */
export function addLayerInteraction( instanceId, layerData ) {
	const interactions = getLayerInteractions();

	if ( ! interactions[ instanceId ] ) {
		interactions[ instanceId ] = [];
	}
	interactions[ instanceId ].push( layerData );
	writeLocalStorageJSON( 'layerInteractions', interactions );
}

/**
 * Updates the action type of an existing layer interaction in localStorage.
 *
 * @param {string|number} videoId    - The ID of the video associated with the interactions.
 * @param {string}        hotspotId  - The ID of the hotspot/layer to update.
 * @param {string}        actionType - The new action type to assign (e.g., "clicked", "skipped").
 * @return {void}
 */
export function updateLayerInteraction( videoId, hotspotId, actionType ) {
	const data = JSON.parse( localStorage.getItem( 'layerInteractions' ) || '{}' );
	if ( ! data[ videoId ] ) {
		data[ videoId ] = {};
	}

	// Find the interaction by layer_id
	const interactionIndex = data[ videoId ].findIndex(
		( item ) => item?.layer_id === hotspotId,
	);

	if ( interactionIndex !== -1 ) {
		// Update action_type
		data[ videoId ][ interactionIndex ].action_type = actionType;

		// Save back to localStorage
		writeLocalStorageJSON( 'layerInteractions', data );
	}
}
