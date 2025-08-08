/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Header from './Header';

const Error = ( { hasError } ) => {
	return (
		<div className="godam-whats-new-container">
			<Header />

			<div className="no-data-container">
				<div className="no-data-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" viewBox="0 0 16 16">
						<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
						<path d="M8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
					</svg>
				</div>
				<h2>{ __( 'No Updates Available' ) }</h2>
				<p>
					{ hasError
						? __( 'Unable to load the latest updates. Please try again later.' )
						: __( 'There are no new features to display at the moment.' )
					}
				</p>
				<button
					className="retry-button"
					onClick={ () => window.location.reload() }
				>
					{ __( 'Try Again' ) }
				</button>
			</div>
		</div>
	);
};

export default Error;
