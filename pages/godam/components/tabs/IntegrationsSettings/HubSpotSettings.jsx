/**
 * WordPress dependencies
 */
import {
	Card,
	CardBody,
	Flex,
	FlexItem,
	Button,
	Spinner,
	Notice,
	ExternalLink,
	Icon,
} from '@wordpress/components';
import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { external, check, wordpress } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import godamIcon from '../../../../../assets/src/images/godam-icon.svg';
import hubSpotIcon from '../../../../video-editor/assets/layers/HubSpotIcon.svg';

/**
 * Human text for each connection state.
 */
const STATE_LABELS = {
	connected: __( 'Connected', 'godam' ),
	not_connected: __( 'Not connected', 'godam' ),
	needs_attention: __( 'Needs attention', 'godam' ),
};

/**
 * Badge colour per state.
 */
const STATE_COLORS = {
	connected: '#007a4d',
	not_connected: '#757575',
	needs_attention: '#996800',
};

/**
 * How often to poll Central for the connection to flip to connected, and for how
 * long, while the admin connects HubSpot on GoDAM in another tab.
 */
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * GoDAM support, linked from admin-facing error notices.
 */
const SUPPORT_URL = 'https://app.godam.io/helpdesk/my-tickets';

/**
 * Small coloured status badge.
 *
 * @param {Object} props       Props.
 * @param {string} props.state One of `connected`, `not_connected`, `needs_attention`.
 * @return {JSX.Element} The badge.
 */
const StatusBadge = ( { state } ) => (
	<span
		className="godam-hubspot-badge"
		style={ {
			display: 'inline-block',
			padding: '2px 10px',
			borderRadius: '10px',
			fontSize: '12px',
			fontWeight: 600,
			color: '#fff',
			backgroundColor: STATE_COLORS[ state ] || STATE_COLORS.not_connected,
		} }
	>
		{ STATE_LABELS[ state ] || STATE_LABELS.not_connected }
	</span>
);

/**
 * One label/value row in the connected config card.
 *
 * @param {Object} props          Props.
 * @param {string} props.label    Row label.
 * @param {Object} props.children Row value.
 * @return {JSX.Element} The row.
 */
const ConfigRow = ( { label, children } ) => (
	<CardBody size="small">
		<Flex justify="space-between" gap={ 3 }>
			<FlexItem>
				<span style={ { color: '#757575' } }>{ label }</span>
			</FlexItem>
			<FlexItem>
				<span style={ { fontWeight: 500 } }>{ children }</span>
			</FlexItem>
		</Flex>
	</CardBody>
);

/**
 * The two connection methods, shown as selectable cards.
 */
const SOURCE_OPTIONS = [
	{
		value: 'central',
		title: __( 'GoDAM Central', 'godam' ),
		description: __( 'Connect HubSpot through GoDAM. Recommended because it also enables video-view tracking on your HubSpot dashboard.', 'godam' ),
		recommended: true,
	},
	{
		value: 'leadin',
		title: __( 'HubSpot plugin', 'godam' ),
		description: __( 'Use the “HubSpot All-In-One Marketing” plugin’s own connection.', 'godam' ),
		recommended: false,
	},
];

/**
 * The connector + HubSpot icon pairing shown on a connection-method card. The
 * leading icon reflects how this site reaches HubSpot: GoDAM for the Central
 * method, WordPress (the HubSpot plugin) for the plugin method.
 *
 * @param {Object} props         Props.
 * @param {string} props.variant The card's source value (`central` or `leadin`).
 * @return {JSX.Element} The paired icons.
 */
const SourceIcons = ( { variant } ) => (
	<Flex justify="flex-start" align="center" gap={ 2 } style={ { flexGrow: 0, width: 'auto' } }>
		{ variant === 'leadin' ? (
			<span style={ { display: 'inline-flex', color: '#21759b' } }>
				<Icon icon={ wordpress } size={ 28 } />
			</span>
		) : (
			<img src={ godamIcon } alt={ __( 'GoDAM', 'godam' ) } style={ { width: 28, height: 28 } } />
		) }
		<span aria-hidden="true" style={ { color: '#949494', fontSize: 16, lineHeight: 1 } }>+</span>
		<img src={ hubSpotIcon } alt={ __( 'HubSpot', 'godam' ) } style={ { width: 28, height: 28 } } />
	</Flex>
);

/**
 * One selectable connection-method card.
 *
 * @param {Object}   props          Props.
 * @param {Object}   props.option   One of SOURCE_OPTIONS.
 * @param {boolean}  props.selected Whether this card is the chosen source.
 * @param {Function} props.onSelect Called with the option value when picked.
 * @return {JSX.Element} The card.
 */
const SourceCard = ( { option, selected, onSelect } ) => (
	<div
		role="radio"
		aria-checked={ selected }
		tabIndex={ 0 }
		className="godam-hubspot-source-card"
		onClick={ () => onSelect( option.value ) }
		onKeyDown={ ( event ) => {
			if ( event.key === 'Enter' || event.key === ' ' ) {
				event.preventDefault();
				onSelect( option.value );
			}
		} }
		style={ {
			flex: '1 1 220px',
			minWidth: 220,
			position: 'relative',
			cursor: 'pointer',
			padding: '16px',
			borderRadius: 8,
			border: `2px solid ${ selected ? 'var(--wp-admin-theme-color, #5D31FF)' : '#e0e0e0' }`,
			backgroundColor: selected ? 'rgba(93, 49, 255, 0.04)' : '#fff',
			transition: 'border-color 0.15s ease, background-color 0.15s ease',
		} }
	>
		{ selected && (
			<span
				style={ {
					position: 'absolute',
					top: 10,
					right: 10,
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: 20,
					height: 20,
					borderRadius: '50%',
					backgroundColor: 'var(--wp-admin-theme-color, #5D31FF)',
					color: '#fff',
				} }
			>
				<Icon icon={ check } size={ 14 } fill="#ffffff" />
			</span>
		) }

		<SourceIcons variant={ option.value } />

		<Flex justify="flex-start" align="center" gap={ 2 } style={ { marginTop: 12 } }>
			<FlexItem>
				<strong>{ option.title }</strong>
			</FlexItem>
			{ option.recommended && (
				<FlexItem>
					<span
						style={ {
							fontSize: 11,
							fontWeight: 600,
							color: '#007a4d',
							backgroundColor: 'rgba(0, 122, 77, 0.1)',
							padding: '1px 8px',
							borderRadius: 10,
						} }
					>
						{ __( 'Recommended', 'godam' ) }
					</span>
				</FlexItem>
			) }
		</Flex>

		<p style={ { margin: '6px 0 0', color: '#757575', fontSize: 13 } }>
			{ option.description }
		</p>
	</div>
);

/**
 * HubSpot integration settings.
 *
 * HubSpot can be connected two ways, and the admin chooses one here. With GoDAM
 * Central (recommended) the connection is made on GoDAM (OAuth): this tab reads
 * the status from Central via the plugin's server-to-server `godam/v1/hubspot/*`
 * routes, and when HubSpot is not connected it opens GoDAM to connect and polls
 * until it is — the source that also enables video-view tracking. With the
 * HubSpot plugin, the "HubSpot All-In-One Marketing" (leadin) plugin owns the
 * connection and this tab shows whether it is connected and links out to it.
 *
 * The on/off toggle above this component (rendered by IntegrationsSettings) is
 * the site-level switch; it does not disconnect the account. The chosen source
 * is saved with the integration settings (Save button at the bottom of the tab).
 *
 * @param {Object}   props                 Props.
 * @param {Object}   props.settings        Current `integrations.hubspot` settings (`enable`, `source`).
 * @param {Function} props.onSettingChange Persist a single `integrations.hubspot` field.
 * @return {JSX.Element|null} The HubSpot settings body.
 */
const HubSpotSettings = ( { settings = {}, onSettingChange } ) => {
	const enabled = settings?.enable !== false;
	const source = settings?.source === 'leadin' ? 'leadin' : 'central';

	const [ status, setStatus ] = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ statusError, setStatusError ] = useState( '' );
	const [ connecting, setConnecting ] = useState( false );

	const pollTimer = useRef( null );
	const pollDeadline = useRef( 0 );

	const clearPoll = useCallback( () => {
		if ( pollTimer.current ) {
			window.clearInterval( pollTimer.current );
			pollTimer.current = null;
		}
		setConnecting( false );
	}, [] );

	// `silent` poll calls skip the loading spinner, so a background re-check does
	// not blank the whole panel every few seconds.
	const loadStatus = useCallback( async ( { silent = false } = {} ) => {
		if ( ! silent ) {
			setLoading( true );
		}
		setStatusError( '' );
		try {
			const res = await apiFetch( { path: '/godam/v1/hubspot/status' } );
			setStatus( res );
			return res;
		} catch ( error ) {
			setStatusError(
				error?.message || __( 'Could not load the HubSpot connection status.', 'godam' ),
			);
			return null;
		} finally {
			if ( ! silent ) {
				setLoading( false );
			}
		}
	}, [] );

	useEffect( () => {
		if ( enabled ) {
			loadStatus();
		}
	}, [ enabled, loadStatus ] );

	// Re-check when the admin returns to this tab, so finishing the connect on
	// GoDAM after the polling window closed still updates without a reload.
	useEffect( () => {
		const onFocus = () => {
			if ( enabled ) {
				loadStatus( { silent: true } );
			}
		};
		window.addEventListener( 'focus', onFocus );
		return () => window.removeEventListener( 'focus', onFocus );
	}, [ enabled, loadStatus ] );

	// Stop polling when the component unmounts.
	useEffect( () => clearPoll, [ clearPoll ] );

	const hubspot = status?.hubspot || {};
	const state = hubspot.state || 'not_connected';
	const isConnected = state === 'connected' || state === 'needs_attention';
	const isLive = status ? status.live !== false : false;
	const settingsUrl = status?.settings_url || '';
	const leadin = status?.leadin || {};

	// The HubSpot plugin is only a connection option when it is active. When it is
	// not, there is no choice to make: show GoDAM Central only. The stored choice
	// is kept untouched, so it returns if the plugin is reactivated.
	const leadinActive = Boolean( leadin.active );
	const effectiveSource = leadinActive ? source : 'central';

	// Begin connecting HubSpot on GoDAM: open Central and poll until it reports a
	// connection (or the deadline passes).
	const handleConnectOnGoDAM = () => {
		if ( settingsUrl ) {
			window.open( settingsUrl, '_blank', 'noopener,noreferrer' );
		}

		clearPoll();
		setConnecting( true );
		pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;

		pollTimer.current = window.setInterval( async () => {
			if ( Date.now() > pollDeadline.current ) {
				clearPoll();
				return;
			}
			const res = await loadStatus( { silent: true } );
			if ( res?.hubspot?.state === 'connected' || res?.hubspot?.state === 'needs_attention' ) {
				clearPoll();
			}
		}, POLL_INTERVAL_MS );
	};

	// Integration switched off: nothing to configure.
	if ( ! enabled ) {
		return (
			<p className="godam-hubspot-settings" style={ { color: '#757575' } }>
				{ __( 'Turn on HubSpot to connect your account and show HubSpot forms on this site.', 'godam' ) }
			</p>
		);
	}

	return (
		<div className="godam-hubspot-settings">
			{ /* The connection-method choice only appears when the HubSpot plugin
			     is active (so there is actually a choice). Otherwise Central is the
			     only method and its connection UI shows directly below. */ }
			{ ! loading && leadinActive && (
				<div className="godam-hubspot-source mb-4">
					<p className="godam-hubspot-source__label" style={ { fontWeight: 600, margin: '0 0 4px' } }>
						{ __( 'Connection method', 'godam' ) }
					</p>
					<p style={ { color: '#757575', fontSize: 13, margin: '0 0 12px' } }>
						{ __( 'Choose how this site connects to HubSpot.', 'godam' ) }
					</p>
					<div
						role="radiogroup"
						aria-label={ __( 'Connection method', 'godam' ) }
					>
						<Flex justify="flex-start" align="stretch" gap={ 3 } style={ { flexWrap: 'wrap' } }>
							{ SOURCE_OPTIONS.map( ( option ) => (
								<SourceCard
									key={ option.value }
									option={ option }
									selected={ source === option.value }
									onSelect={ ( value ) => onSettingChange?.( 'source', value ) }
								/>
							) ) }
						</Flex>
					</div>
				</div>
			) }

			{ statusError && (
				<Notice status="error" isDismissible={ false } className="mb-4">
					{ statusError }
					{ ' ' }
					<ExternalLink href={ SUPPORT_URL }>
						{ __( 'Contact support', 'godam' ) }
					</ExternalLink>
				</Notice>
			) }

			{ loading && (
				<div className="mb-4">
					<Spinner />
				</div>
			) }

			{ /* GoDAM Central source. */ }
			{ ! loading && effectiveSource === 'central' && (
				<>
					<Flex justify="flex-start" gap={ 2 } className="mb-4" style={ { flexWrap: 'wrap' } }>
						<FlexItem>
							<strong>{ __( 'HubSpot connection (GoDAM Central)', 'godam' ) }</strong>
						</FlexItem>
						<FlexItem>
							<StatusBadge state={ state } />
						</FlexItem>
					</Flex>

					{ ! isLive && (
						<Notice status="warning" isDismissible={ false } className="mb-4">
							{ status?.error || __( 'Could not reach GoDAM’s HubSpot service, so the details below may be out of date.', 'godam' ) }
							{ ' ' }
							{ settingsUrl && (
								<ExternalLink href={ settingsUrl }>
									{ __( 'Open GoDAM settings', 'godam' ) }
								</ExternalLink>
							) }
							{ ' ' }
							<ExternalLink href={ SUPPORT_URL }>
								{ __( 'Contact support', 'godam' ) }
							</ExternalLink>
						</Notice>
					) }

					{ isConnected ? (
						<>
							{ state === 'needs_attention' && (
								<Notice status="warning" isDismissible={ false } className="mb-4">
									{ __( 'This connection needs attention on GoDAM.', 'godam' ) }
								</Notice>
							) }

							<Card size="small" className="godam-hubspot-config">
								<ConfigRow label={ __( 'Portal ID', 'godam' ) }>
									{ hubspot.portal_id || '—' }
								</ConfigRow>
								<ConfigRow label={ __( 'Region', 'godam' ) }>
									{ hubspot.region || '—' }
								</ConfigRow>
								{ isLive && typeof hubspot.tracking_active !== 'undefined' && (
									<ConfigRow label={ __( 'Video-view tracking', 'godam' ) }>
										<span style={ { color: hubspot.tracking_active ? '#007a4d' : '#757575' } }>
											{ hubspot.tracking_active ? __( 'On', 'godam' ) : __( 'Off', 'godam' ) }
										</span>
									</ConfigRow>
								) }
							</Card>

							{ settingsUrl && (
								<Flex justify="flex-start" gap={ 3 } style={ { marginTop: '12px' } }>
									<FlexItem>
										<Button
											variant="primary"
											href={ settingsUrl }
											target="_blank"
											rel="noopener noreferrer"
											icon={ external }
											iconPosition="right"
											data-test-id="godam-settings-hubspot-button-manage"
										>
											{ __( 'Manage on GoDAM', 'godam' ) }
										</Button>
									</FlexItem>
								</Flex>
							) }
						</>
					) : (
						<>
							<p>
								{ __( 'Connect HubSpot on GoDAM to show HubSpot forms on this site and track video views. Connecting opens GoDAM in a new tab; this page updates once it is connected.', 'godam' ) }
							</p>
							<Flex justify="flex-start" gap={ 3 } align="center">
								<FlexItem>
									<Button
										variant="primary"
										onClick={ handleConnectOnGoDAM }
										icon={ external }
										iconPosition="right"
										disabled={ connecting || ! settingsUrl }
										data-test-id="godam-settings-hubspot-button-connect"
									>
										{ __( 'Connect on GoDAM', 'godam' ) }
									</Button>
								</FlexItem>
								{ connecting && (
									<FlexItem>
										<Flex gap={ 2 } align="center">
											<Spinner />
											<span style={ { color: '#757575' } }>
												{ __( 'Waiting for the connection…', 'godam' ) }
											</span>
										</Flex>
									</FlexItem>
								) }
							</Flex>
						</>
					) }
				</>
			) }

			{ /* HubSpot (leadin) plugin source. */ }
			{ ! loading && effectiveSource === 'leadin' && (
				<>
					<Flex justify="flex-start" gap={ 2 } className="mb-4" style={ { flexWrap: 'wrap' } }>
						<FlexItem>
							<strong>{ __( 'HubSpot connection (HubSpot plugin)', 'godam' ) }</strong>
						</FlexItem>
						<FlexItem>
							<StatusBadge state={ leadin.connected ? 'connected' : 'not_connected' } />
						</FlexItem>
					</Flex>

					{ leadin.connected ? (
						<Card size="small" className="godam-hubspot-config">
							<ConfigRow label={ __( 'Portal ID', 'godam' ) }>
								{ leadin.portal_id || '—' }
							</ConfigRow>
							<ConfigRow label={ __( 'Region', 'godam' ) }>
								{ leadin.region || '—' }
							</ConfigRow>
						</Card>
					) : (
						<Notice status="warning" isDismissible={ false }>
							{ __( 'The “HubSpot All-In-One Marketing” plugin is active but not connected to an account. Connect it from its own settings to use HubSpot forms through the plugin, or switch to GoDAM Central above.', 'godam' ) }
						</Notice>
					) }
				</>
			) }
		</div>
	);
};

export default HubSpotSettings;
