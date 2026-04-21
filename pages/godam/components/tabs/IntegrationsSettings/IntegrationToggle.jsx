/**
 * WordPress dependencies
 */
import { ToggleControl, Spinner } from '@wordpress/components';
import { sprintf, __ } from '@wordpress/i18n';

/**
 * Reusable toggle for enabling/disabling an add-on integration.
 *
 * @param {Object}   props
 * @param {string}   props.label          Human-readable integration name (e.g. "WooCommerce").
 * @param {boolean}  props.enabled        Current enabled state.
 * @param {Function} props.onChange       Callback when toggled.
 * @param {boolean}  props.hasValidAPIKey Whether the site has a valid API key.
 * @param {Function} props.getPricingUrl  Returns the upgrade URL for a given feature slug.
 * @param {string}   props.featureSlug    Slug passed to getPricingUrl (e.g. "woocommerce-integration").
 * @param {boolean}  props.isToggling     Whether activation/deactivation is in progress.
 */
const IntegrationToggle = ( {
	label,
	enabled,
	onChange,
	hasValidAPIKey,
	getPricingUrl,
	featureSlug,
	isToggling,
} ) => {
	return (
		<ToggleControl
			__nextHasNoMarginBottom
			className="godam-toggle godam-margin-bottom"
			label={
				<>
					{ sprintf(
						/* translators: %s: Integration name, e.g. "WooCommerce". */
						__( 'Enable %s Integration', 'godam' ),
						label,
					) }
					{ isToggling && <Spinner /> }
				</>
			}
			checked={ enabled }
			help={
				! hasValidAPIKey
					? (
						<>
							{ __( 'This is a Pro feature.', 'godam' ) }
							{ ' ' }
							<a href={ getPricingUrl( featureSlug ) } target="_blank" rel="noopener noreferrer">
								{ __( 'Upgrade to Pro', 'godam' ) }
							</a>
							{ ' ' }
							{ __( 'to use this integration.', 'godam' ) }
						</>
					)
					: sprintf(
						/* translators: %s: Integration name, e.g. "WooCommerce". */
						__( 'Enable or disable the %s integration.', 'godam' ),
						label,
					)
			}
			disabled={ isToggling || ( ! hasValidAPIKey && ! enabled ) }
			onChange={ onChange }
		/>
	);
};

export default IntegrationToggle;
