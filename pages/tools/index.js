/**
 * External dependencies
 */
import ReactDOM from 'react-dom';

/**
 * Internal dependencies
 */
import App from './App';

import './index.scss';

const Index = () => {
	return (
		<App />
	);
};

const rootElement = document.getElementById( 'root-godam-tools' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );
	root.render( <Index /> );
}
