/**
 * WordPress dependencies
 */
import { CardBody, CardDivider, ExternalLink, Notice, ToggleControl } from '@wordpress/components';
import { sprintf, __ } from '@wordpress/i18n';

/**
 * "Video-view tracking" section of a MAP tool's connection card, rendered as the
 * card's last row (below the connection details).
 *
 * GoDAM Central is the master switch: the plugin only tracks the tools Central
 * lists, and the site switch can only drop one of them for this site. So the
 * section shows what can actually take effect:
 *
 * Central tracking off: no switch, just a notice pointing to Central. The saved
 * site choice is kept and applies again once Central turns tracking on.
 *
 * Central tracking on: Central's state, the site switch, and the tool's note
 * (shown only while the switch is on, since it describes what tracking loads).
 *
 * Central's state unknown (status not live): the switch, without Central's line,
 * so a network error does not lock the setting.
 *
 * @param {Object}   props                 Props.
 * @param {string}   props.label           Tool name, e.g. "Marketo".
 * @param {Object}   props.settings        Current `integrations.<tool>` settings (holds `track_views`).
 * @param {Function} props.onSettingChange Persist a single `integrations.<tool>` field.
 * @param {?boolean} props.centralTracking Central's `tracking_active`, or undefined when unknown.
 * @param {string}   props.settingsUrl     GoDAM Central settings URL, if known.
 * @param {string}   props.note            What tracking adds to the site's pages.
 * @return {JSX.Element} The section.
 */
const VideoTrackingSection = ( { label, settings = {}, onSettingChange, centralTracking, settingsUrl = '', note = '' } ) => {
	const checked = settings?.track_views !== false;

	let body;
	if ( false === centralTracking ) {
		body = (
			<Notice status="info" isDismissible={ false }>
				{ sprintf(
					/* translators: %s: Tool name, e.g. "Marketo". */
					__( 'Video-view tracking is off on GoDAM Central, so this site doesn’t send video views to %s. This site’s own setting applies once it is turned on there.', 'godam' ),
					label,
				) }
				{ settingsUrl && (
					<>
						{ ' ' }
						<ExternalLink href={ settingsUrl }>
							{ __( 'Turn on in GoDAM Central', 'godam' ) }
						</ExternalLink>
					</>
				) }
			</Notice>
		);
	} else {
		body = (
			<>
				{ true === centralTracking && (
					<p style={ { margin: '0 0 12px', color: '#757575' } }>
						{ __( 'GoDAM Central:', 'godam' ) }{ ' ' }
						<span style={ { color: '#007a4d', fontWeight: 500 } }>{ __( 'On', 'godam' ) }</span>
					</p>
				) }

				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Track video views on this site', 'godam' ) }
					checked={ checked }
					onChange={ ( value ) => onSettingChange?.( 'track_views', value ) }
					help={ sprintf(
						/* translators: %s: Tool name, e.g. "Marketo". */
						__( 'Turn off to stop this site sending video views to %s. GoDAM Central and your other sites are not changed.', 'godam' ),
						label,
					) }
					disabled={ ! onSettingChange }
				/>

				{ checked && note && (
					<p style={ { margin: '12px 0 0', color: '#757575', fontSize: 13 } }>{ note }</p>
				) }
			</>
		);
	}

	return (
		<>
			<CardDivider />
			<CardBody size="small" className="godam-video-tracking">
				<p style={ { margin: '0 0 8px' } }>
					<strong>{ __( 'Video-view tracking', 'godam' ) }</strong>
				</p>
				{ body }
			</CardBody>
		</>
	);
};

export default VideoTrackingSection;
