/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

/**
 * Internal dependencies
 */
import store from './redux/store';
import App from './App';
import './index.scss';

const Index = () => {
	return (
		<Provider store={ store }>
			<App />
		</Provider>
	);
};

document.addEventListener( 'DOMContentLoaded', initializeMediaLibrary );
document.addEventListener( 'media-frame-opened', initializeMediaLibrary );

function initializeMediaLibrary() {
	const rootElement = document.getElementById( 'rt-transcoder-media-library-root' );

	if ( rootElement ) {
		// Check if React is already mounted to avoid reinitializing
		if ( ! rootElement._reactRoot ) {
			const root = ReactDOM.createRoot( rootElement );
			rootElement._reactRoot = root; // Store the root in a custom property
			root.render( <Index /> );
		}
	}
}

