/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { PostHogProvider } from '@posthog/react';
/**
 * Internal dependencies
 */
import './index.scss';
import App from './App';
import posthog from '../utils/posthog';

const Index = () => {
	return (
		<PostHogProvider client={ posthog }>
			<App />
		</PostHogProvider>
	);
};

const rootElement = document.getElementById( 'root-whats-new' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );
	root.render( <Index /> );
}
