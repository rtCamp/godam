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
		document.getElementById( 'godam-layer-placeholder' ),
	);
};

export default LayerControls;
