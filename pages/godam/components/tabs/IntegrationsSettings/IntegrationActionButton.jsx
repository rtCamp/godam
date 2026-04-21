/**
 * WordPress dependencies
 */
import { Button, Spinner } from '@wordpress/components';
import { sprintf, __ } from '@wordpress/i18n';

/**
 * Reusable action button for an integration tab.
 *
 * Only rendered when the add-on plugin is NOT installed. Once installed,
 * the toggle button handles activation/deactivation instead.
 *
 * States (add-on NOT installed):
 * 1. Required plugin NOT active + no API key  → "Purchase Now"
 * 2. Required plugin NOT active + valid key   → "Learn More"
 * 3. Required plugin active + no API key      → "Purchase Now"
 * 4. Required plugin active + valid API key   → "Install {name}" (triggers install)
 *
 * If the add-on IS installed → returns null (no button).
 *
 * @param {Object}   props
 * @param {string}   props.label            Human-readable add-on name (e.g. "GoDAM for Woo").
 * @param {boolean}  props.isAddonInstalled Whether the add-on plugin files exist.
 * @param {boolean}  props.isRequiredActive Whether the required dependency plugin is installed & active.
 * @param {boolean}  props.hasValidAPIKey   Whether the site has a valid API key.
 * @param {Function} props.getPricingUrl    Returns the upgrade URL for a given feature slug.
 * @param {string}   props.featureSlug      Slug passed to getPricingUrl.
 * @param {string}   [props.learnMoreUrl]   Optional custom Learn More URL.
 * @param {Function} [props.onInstall]      Callback fired when the Install button is clicked.
 * @param {boolean}  [props.isInstalling]   Whether an install is currently in progress.
 */
const IntegrationActionButton = ( {
	label,
	isAddonInstalled,
	isRequiredActive,
	hasValidAPIKey,
	getPricingUrl,
	featureSlug,
	learnMoreUrl,
	onInstall,
	isInstalling,
} ) => {
	// Add-on already installed — no button needed; toggle handles it.
	if ( isAddonInstalled ) {
		return null;
	}

	// 4. Required plugin active + valid API key → Install button.
	if ( isRequiredActive && hasValidAPIKey ) {
		return (
			<Button
				variant="primary"
				className="godam-button godam-margin-bottom"
				onClick={ onInstall }
				disabled={ isInstalling }
				isBusy={ isInstalling }
			>
				{ isInstalling ? (
					<>
						<Spinner />
						{ __( 'Installing…', 'godam' ) }
					</>
				) : (
					sprintf(
						/* translators: %s: Add-on plugin name, e.g. "GoDAM for Woo". */
						__( 'Install %s', 'godam' ),
						label,
					)
				) }
			</Button>
		);
	}

	// 2. Required plugin NOT active + valid key → Learn More.
	if ( ! isRequiredActive && hasValidAPIKey ) {
		return (
			<Button
				variant="primary"
				className="godam-button godam-margin-bottom"
				href={ learnMoreUrl || getPricingUrl( featureSlug ) }
				target="_blank"
				rel="noopener noreferrer"
			>
				{ __( 'Learn More', 'godam' ) }
			</Button>
		);
	}

	// 1 & 3. No valid API key (regardless of required plugin) → Purchase Now.
	return (
		<Button
			variant="primary"
			className="godam-button godam-margin-bottom"
			href={ getPricingUrl( featureSlug ) }
			target="_blank"
			rel="noopener noreferrer"
		>
			{ __( 'Purchase Now', 'godam' ) }
		</Button>
	);
};

export default IntegrationActionButton;
