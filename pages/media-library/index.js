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

const Index = () => {
	return (
		<Provider store={ store }>
			<App />
		</Provider>
	);
};

document.addEventListener( 'DOMContentLoaded', () => {
	const rootElement = document.getElementById( 'rt-transcoder-media-library-root' );

	if ( rootElement ) {
		const root = ReactDOM.createRoot( rootElement );
		root.render( <Index /> );
	}
} );
