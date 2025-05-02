/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';
/**
 * Internal dependencies
 */
import './index.scss';
import App from './App';

const Index = () => {
	return <App />;
};

const rootElement = document.getElementById( 'root-video-help' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );
	root.render( <Index /> );
}
