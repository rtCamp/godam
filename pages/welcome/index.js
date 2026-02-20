/**
 * Welcome page entry point.
 *
 * Mounts the welcome walkthrough Guide component for first-time users.
 *
 * @package
 */

/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';

/**
 * Internal dependencies
 */
import './welcome.scss';
import App from './App';

const rootElement = document.getElementById( 'root-godam-welcome' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );
	root.render( <App /> );
}
