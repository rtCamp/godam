/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { PostHogProvider } from '@posthog/react';
/**
 * Internal dependencies
 */
import store from './redux/store';
import './index.scss';
import '../analytics/index.scss';
import './components/ChartsDashboard.js';
import App from './App.js';
import posthog from '../utils/posthog';

const Index = () => {
	return (
		<PostHogProvider client={ posthog }>
			<Provider store={ store }>
				<App />
			</Provider>
		</PostHogProvider>
	);
};

const root = ReactDOM.createRoot( document.getElementById( 'root-video-dashboard' ) );
root.render( <Index /> );
