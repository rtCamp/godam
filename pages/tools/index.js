/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { PostHogProvider } from '@posthog/react';

/**
 * Internal dependencies
 */
import App from './App';
import posthog from '../utils/posthog';

import './index.scss';

const Index = () => {
	return (
		<PostHogProvider client={ posthog }>
			<App />
		</PostHogProvider>
	);
};

const rootElement = document.getElementById( 'root-godam-tools' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );
	root.render( <Index /> );
}
