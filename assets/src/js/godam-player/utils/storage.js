export function getLayerInteractions() {
	const data = localStorage.getItem( 'layerInteractions' );
	return data ? JSON.parse( data ) : {};
}

export function addLayerInteraction( instanceId, layerData ) {
	const interactions = getLayerInteractions();

	if ( ! interactions[ instanceId ] ) {
		interactions[ instanceId ] = [];
	}
	interactions[ instanceId ].push( layerData );
	localStorage.setItem( 'layerInteractions', JSON.stringify( interactions ) );
}

export function updateLayerInteraction( videoId, hotspotId, actionType ) {
	const data = JSON.parse( localStorage.getItem( 'layerInteractions' ) || '{}' );
	if ( ! data[ videoId ] ) {
		data[ videoId ] = {};
	}

	// Find the interaction by layer_id
	const interactionIndex = data[ videoId ].findIndex(
		( item ) => item.layer_id === hotspotId,
	);

	if ( interactionIndex !== -1 ) {
		// Update action_type
		data[ videoId ][ interactionIndex ].action_type = actionType;

		// Save back to localStorage
		localStorage.setItem( 'layerInteractions', JSON.stringify( data ) );
	}
}
