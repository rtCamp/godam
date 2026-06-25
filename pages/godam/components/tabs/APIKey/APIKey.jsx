/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Notice, Panel, PanelBody, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import APISettings from '../VideoSettings/APISettings.jsx';
import { hasAPIKey } from '../../../utils/index.js';

/**
 * API Key tab.
 *
 * Houses the upgrade banner (shown until a key is connected), the API key
 * settings, and the plan-usage meters (shown once a key is connected).
 *
 * @return {JSX.Element} The rendered tab.
 */
const APIKey = () => {
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	return (
		<div data-test-id="godam-settings-api-key">
			{ notice.isVisible && (
				<Notice
					className="mb-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			{ ! hasAPIKey && (
				<Panel className="godam-panel godam-margin-bottom godam-api-key-banner">
					<PanelBody opened>
						<h2>{ __( 'Ensure Smooth Video Playback', 'godam' ) }</h2>

						<p>{ __( 'Start with GoDAM Free for 60 days, or plans starting from $9/mo.', 'godam' ) }</p>

						<div className="button-group">
							<Button
								href={ `https://godam.io/pricing?utm_campaign=buy-plan&utm_source=${ window?.location?.host || '' }&utm_medium=plugin&utm_content=settings` }
								target="_blank"
								variant="primary"
							>
								{ __( 'Choose GoDAM Plan', 'godam' ) }
							</Button>
						</div>
					</PanelBody>
				</Panel>
			) }

			<APISettings setNotice={ setNotice } />
		</div>
	);
};

export default APIKey;
