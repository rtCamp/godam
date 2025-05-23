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
import './index.scss';
import '../analytics/index.scss';
import './components/ChartsDashboard.js';
import App from './App.js';

const Index = () => {
	return (
		<Provider store={ store }>
			<App />
		</Provider>
	);
};

const root = ReactDOM.createRoot( document.getElementById( 'root-video-dashboard' ) );
root.render( <Index /> );
