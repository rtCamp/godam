/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

const LayerControls = ( { children } ) => {
	const [ portalTarget, setPortalTarget ] = useState( null );

	// This method is used to check if the portal target is available, to avoid page crash.
	useEffect( () => {
		const checkForPortalTarget = () => {
			const target = document.getElementById( 'easydam-layer-placeholder' );
			if ( target ) {
				setPortalTarget( target );
			} else {
				// Retry after a short delay if element not found
				setTimeout( checkForPortalTarget, 50 );
			}
		};

		checkForPortalTarget();

		// Cleanup function
		return () => setPortalTarget( null );
	}, [] );

	// If portal target is not available, render children normally
	if ( ! portalTarget ) {
		return (
			// The content stays hidden until the proper portal target is available.
			<div className="layer-controls-fallback">
				{ children }
			</div>
		);
	}

	return ReactDOM.createPortal(
		<>
			{ children }
		</>,
		portalTarget,
	);
};

export default LayerControls;
