/**
 * External dependencies
 */
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const LayerControls = ( { children } ) => {
	const [ portalTarget, setPortalTarget ] = useState( null );

	useEffect( () => {
		const MAX_RETRIES = 100; // 5 seconds total (100 * 50ms)
		let retryCount = 0;
		let timeoutId = null;
		let isMounted = true;

		const checkForPortalTarget = () => {
			const target = document.getElementById( 'easydam-layer-placeholder' );
			if ( target && isMounted ) {
				setPortalTarget( target );
			} else if ( isMounted && retryCount < MAX_RETRIES ) {
				retryCount++;
				timeoutId = setTimeout( checkForPortalTarget, 50 );
			}
		};

		checkForPortalTarget();

		// Cleanup function
		return () => {
			isMounted = false;
			if ( timeoutId ) {
				clearTimeout( timeoutId );
			}
			setPortalTarget( null );
		};
	}, [] );

	// Render hidden fallback if portal target is not available
	if ( ! portalTarget ) {
		return <div className="layer-controls-fallback" />;
	}

	return ReactDOM.createPortal(
		<>
			{ children }
		</>,
		portalTarget,
	);
};

export default LayerControls;
