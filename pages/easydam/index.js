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

const rootElement = document.getElementById( 'root-easydam' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );
	root.render( <Index /> );
}
