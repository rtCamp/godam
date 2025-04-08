/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
/**
 * Internal dependencies
 */
import './index.scss';

/**
 * Internal dependencies
 */
// import store from './redux/store';
import App from './App.js';

const Index = () => {
	return (
		// <Provider store={ store }>
		<App />
	// sshshshs
		// </Provider>
	);
};

const root = ReactDOM.createRoot( document.getElementById( 'root-video-dashboard' ) );
root.render( <Index /> );
