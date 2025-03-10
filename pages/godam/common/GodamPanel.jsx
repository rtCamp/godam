/**
 * WordPress dependencies
 */
import { Panel, PanelBody, Button } from '@wordpress/components';
import { unlock } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

const isValidLicense = window.userData.valid_license;

const GodamPanel = ( { heading, isPremiumFeature, children } ) => {
	return (
		<div className="relative">

			{
				! isValidLicense && isPremiumFeature && (
					<div className="premium-feature-overlay">
						<Button icon={ unlock } href="https://app.godam.io/subscription/plans" target="_blank" variant="primary">{ __( 'Unlock with GoDAM pro', 'godam' ) }</Button>
					</div>
				)
			}

			<Panel
				header={ heading }
				className="godam-panel mb-4"
			>
				<PanelBody
					opened={ true }
				>
					{ children }
				</PanelBody>
			</Panel>
		</div>

	);
};

export default GodamPanel;
