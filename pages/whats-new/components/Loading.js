/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Header from './Header';

const Loading = () => {
	return (
		<div className="godam-whats-new-container">
			<Header />

			<div className="loading-container">
				<div className="loading-spinner"></div>
				<p>{ __( 'Loading latest updates…' ) }</p>
			</div>
		</div>
	);
};

export default Loading;
