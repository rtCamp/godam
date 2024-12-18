/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';

const LayerControls = ( { children } ) => {
	return ReactDOM.createPortal(
		<>
			{ children }
		</>,
		document.getElementById( 'easydam-layer-placeholder' ),
	);
};

export default LayerControls;
