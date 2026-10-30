/**
 * WordPress dependencies
 */
import { ToggleControl } from '@wordpress/components';
import { sprintf, __ } from '@wordpress/i18n';

/**
 * Site-level "Track video views on this site" switch for a MAP tool.
 *
 * Central sends a view to Marketo or HubSpot only with that tool's visitor
 * cookie, so turning this off stops this site sending the cookie. GoDAM
 * Central's own "Track video views" switch, and every other site on the
 * licence, are left as they are.
 *
 * @param {Object}   props                 Props.
 * @param {string}   props.label           Tool name, e.g. "Marketo".
 * @param {Object}   props.settings        Current `integrations.<tool>` settings (holds `track_views`).
 * @param {Function} props.onSettingChange Persist a single `integrations.<tool>` field.
 * @param {?boolean} props.centralTracking Central's `tracking_active`, or undefined when unknown.
 * @return {JSX.Element} The toggle.
 */
const SiteTrackingToggle = ( { label, settings = {}, onSettingChange, centralTracking } ) => {
	const checked = settings?.track_views !== false;

	let help = sprintf(
		/* translators: %s: Tool name, e.g. "Marketo". */
		__( 'Turn off to stop this site sending video views to %s. GoDAM Central’s setting and your other sites are not changed.', 'godam' ),
		label,
	);
	if ( checked && false === centralTracking ) {
		help += ' ' + __( 'Video-view tracking is off on GoDAM Central, so nothing is sent until it is turned on there.', 'godam' );
	}

	return (
		<div style={ { marginTop: '16px' } }>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Track video views on this site', 'godam' ) }
				checked={ checked }
				onChange={ ( value ) => onSettingChange?.( 'track_views', value ) }
				help={ help }
				disabled={ ! onSettingChange }
			/>
		</div>
	);
};

export default SiteTrackingToggle;
