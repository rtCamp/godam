/**
 * WordPress dependencies
 */
import { ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const WooCommerceSettings = ( { settings = {}, onSettingChange, hasValidAPIKey, getPricingUrl } ) => {
	const enable = settings?.enable !== undefined ? settings.enable : true;

	return (
		<ToggleControl
			__nextHasNoMarginBottom
			className="godam-toggle godam-margin-bottom"
			label={ __( 'Enable WooCommerce Integration', 'godam-woo' ) }
			checked={ enable }
			help={
				! hasValidAPIKey
					? (
						<>
							{ __( 'This is a Pro feature.', 'godam-woo' ) }
							{ ' ' }
							<a href={ getPricingUrl( 'woocommerce-integration' ) } target="_blank" rel="noopener noreferrer">
								{ __( 'Upgrade to Pro', 'godam-woo' ) }
							</a>
							{ ' ' }
							{ __( 'to use this integration.', 'godam-woo' ) }
						</>
					)
					: __( 'Enable or disable the WooCommerce integration.', 'godam-woo' )
			}
			disabled={ ! hasValidAPIKey && ! enable }
			onChange={ ( value ) => onSettingChange( 'enable', value ) }
		/>
	);
};

export default WooCommerceSettings;
