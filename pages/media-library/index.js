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
	if ( window.elementor ) {
		const visibleContainers = Array.from( document.querySelectorAll( '.supports-drag-drop' ) )
			.filter( ( container ) => getComputedStyle( container ).display !== 'none' );

		const activeContainer = visibleContainers.at( -1 ); // Most recent visible container

		if ( activeContainer ) {
			const rootElement = activeContainer.querySelector( '#rt-transcoder-media-library-root' );

			if ( rootElement ) {
			// Check if React is already mounted to avoid reinitializing
				if ( ! rootElement._reactRoot ) {
					const root = ReactDOM.createRoot( rootElement );
					rootElement._reactRoot = root; // Store the root in a custom property
					root.render( <Index /> );
				}
			}
		}

		return;
	}

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
