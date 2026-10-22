/**
 * WordPress dependencies
 */
import {
	Card,
	CardBody,
	Flex,
	FlexItem,
	FlexBlock,
	TextControl,
	Button,
	Spinner,
	Notice,
	ExternalLink,
} from '@wordpress/components';
import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

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
 * Human text for the `reason` GoDAM Central reports on a connected-but-broken tool.
 */
const REASON_TEXT = {
	activity_type_not_set_up: __(
		'The “GoDAM Video View” activity type is not set up in Marketo — usually Marketo’s limit of 10 custom activity types. Fix it on GoDAM.',
		'godam',
	),
};

/**
 * Small coloured status badge.
 *
 * @param {Object} props       Props.
 * @param {string} props.state One of `connected`, `not_connected`, `needs_attention`.
 * @return {JSX.Element} The badge.
 */
const StatusBadge = ( { state } ) => (
	<span
		className="godam-marketo-badge"
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
 * Marketo integration settings.
 *
 * GoDAM Central is the source of truth for the Marketo connection. When the
 * integration is on, this tab reads the status from Central (via the plugin's
 * server-to-server `godam/v1/marketo/*` routes) and shows one of two things: a
 * short form to connect Marketo directly from WordPress when it is not connected,
 * or the connection details read-only (with a link to manage it on GoDAM) when it
 * is. Disconnect and the tracking switch stay on Central.
 *
 * The on/off toggle above this component (rendered by IntegrationsSettings) is
 * the site-level switch; it does not disconnect the account.
 *
 * @param {Object} props          Props.
 * @param {Object} props.settings Current `integrations.marketo` settings (holds `enable`).
 * @return {JSX.Element|null} The Marketo settings body.
 */
const MarketoSettings = ( { settings = {} } ) => {
	const enabled = settings?.enable !== false;

	const [ status, setStatus ] = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ statusError, setStatusError ] = useState( '' );

	const [ form, setForm ] = useState( {
		munchkin_id: '',
		client_id: '',
		client_secret: '',
		forms_host: '',
		recaptcha_site_key: '',
	} );
	const [ submitting, setSubmitting ] = useState( false );
	const [ testing, setTesting ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	const loadStatus = useCallback( async () => {
		setLoading( true );
		setStatusError( '' );
		try {
			const res = await apiFetch( { path: '/godam/v1/marketo/status' } );
			setStatus( res );
		} catch ( error ) {
			setStatusError(
				error?.message || __( 'Could not load the Marketo connection status.', 'godam' ),
			);
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		if ( enabled ) {
			loadStatus();
		}
	}, [ enabled, loadStatus ] );

	const setField = ( key, value ) => setForm( ( prev ) => ( { ...prev, [ key ]: value } ) );

	const marketo = status?.marketo || {};
	const state = marketo.state || 'not_connected';
	const isConnected = state === 'connected' || state === 'needs_attention';
	const isLive = status ? status.live !== false : false;
	const settingsUrl = status?.settings_url || '';

	const handleConnect = async () => {
		setSubmitting( true );
		setNotice( null );
		try {
			const res = await apiFetch( {
				path: '/godam/v1/marketo/connect',
				method: 'POST',
				data: form,
			} );

			// `connect_marketo` sets `message` for a partial success (e.g. connected
			// for forms only, or the activity type could not be set up).
			setNotice( {
				status: res?.message ? 'warning' : 'success',
				message: res?.message || __( 'Marketo connected to GoDAM.', 'godam' ),
			} );

			await loadStatus();
			setForm( ( prev ) => ( { ...prev, client_id: '', client_secret: '' } ) );
		} catch ( error ) {
			setNotice( {
				status: 'error',
				message: error?.message || __( 'Could not connect Marketo. Please try again.', 'godam' ),
			} );
		} finally {
			setSubmitting( false );
		}
	};

	const handleTest = async () => {
		setTesting( true );
		setNotice( null );
		try {
			const res = await apiFetch( { path: '/godam/v1/marketo/test', method: 'POST' } );
			setNotice( {
				status: 'success',
				message: res?.activity_type_ready
					? __( 'Connection works and video-view tracking is set up.', 'godam' )
					: __( 'Connection works.', 'godam' ),
			} );
		} catch ( error ) {
			setNotice( {
				status: 'error',
				message: error?.message || __( 'The connection test failed.', 'godam' ),
			} );
		} finally {
			setTesting( false );
		}
	};

	// Integration switched off: nothing to configure.
	if ( ! enabled ) {
		return (
			<p className="godam-marketo-settings" style={ { color: '#757575' } }>
				{ __( 'Turn on Marketo to connect your account and show Marketo forms on this site.', 'godam' ) }
			</p>
		);
	}

	if ( loading ) {
		return (
			<div className="godam-marketo-settings">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="godam-marketo-settings">
			{ statusError && (
				<Notice status="error" isDismissible={ false } className="mb-4">
					{ statusError }
				</Notice>
			) }

			{ notice && (
				<Notice status={ notice.status } onRemove={ () => setNotice( null ) } className="mb-4">
					{ notice.message }
				</Notice>
			) }

			<Flex justify="flex-start" gap={ 2 } className="mb-4" style={ { flexWrap: 'wrap' } }>
				<FlexItem>
					<strong>{ __( 'Marketo connection', 'godam' ) }</strong>
				</FlexItem>
				<FlexItem>
					<StatusBadge state={ state } />
				</FlexItem>
			</Flex>

			{ ! isLive && (
				<Notice status="warning" isDismissible={ false } className="mb-4">
					{ status?.error || __( 'Could not reach GoDAM’s Marketo service, so the details below may be out of date.', 'godam' ) }
					{ ' ' }
					{ settingsUrl && (
						<ExternalLink href={ settingsUrl }>
							{ __( 'Open GoDAM settings', 'godam' ) }
						</ExternalLink>
					) }
				</Notice>
			) }

			{ isConnected ? (
				<>
					{ state === 'needs_attention' && (
						<Notice status="warning" isDismissible={ false } className="mb-4">
							{ REASON_TEXT[ marketo.reason ] ||
								__( 'This connection needs attention on GoDAM.', 'godam' ) }
						</Notice>
					) }

					<Card size="small" className="godam-marketo-config">
						<ConfigRow label={ __( 'Munchkin ID', 'godam' ) }>
							{ marketo.munchkin_id || '—' }
						</ConfigRow>
						<ConfigRow label={ __( 'Forms host', 'godam' ) }>
							{ marketo.forms_host || __( 'Auto', 'godam' ) }
						</ConfigRow>
						{ isLive && (
							<ConfigRow label={ __( 'Video-view tracking', 'godam' ) }>
								<span style={ { color: marketo.tracking_active ? '#007a4d' : '#757575' } }>
									{ marketo.tracking_active ? __( 'On', 'godam' ) : __( 'Off', 'godam' ) }
								</span>
							</ConfigRow>
						) }
					</Card>

					{ marketo.reason === 'no_api_credentials' && (
						<p style={ { color: '#757575', fontSize: '13px', margin: '10px 0 0' } }>
							{ __( 'Connected for forms only. Add a Client ID and Client Secret to list forms in the editor and track video views.', 'godam' ) }
						</p>
					) }

					<Flex justify="flex-start" gap={ 4 } style={ { marginTop: '12px' } }>
						{ settingsUrl && (
							<FlexItem>
								<ExternalLink href={ settingsUrl }>
									{ __( 'Manage on GoDAM', 'godam' ) }
								</ExternalLink>
							</FlexItem>
						) }
						<FlexItem>
							<Button
								variant="link"
								onClick={ handleTest }
								isBusy={ testing }
								disabled={ testing }
								data-test-id="godam-settings-marketo-button-test"
							>
								{ __( 'Test connection', 'godam' ) }
							</Button>
						</FlexItem>
					</Flex>
				</>
			) : (
				<>
					<p>
						{ __( 'Connect your Marketo instance. The Munchkin ID alone is enough to show forms; add the API credentials to also list forms in the editor and track video views. GoDAM checks the credentials with Marketo before saving.', 'godam' ) }
					</p>

					<TextControl
						className="mb-4"
						label={ __( 'Munchkin Account ID', 'godam' ) }
						help={ __( 'Your Marketo account ID, e.g. "123-ABC-456". In Marketo: Admin → Munchkin.', 'godam' ) }
						value={ form.munchkin_id }
						onChange={ ( value ) => setField( 'munchkin_id', value ) }
						data-test-id="godam-settings-marketo-control-munchkin-id"
					/>

					<Flex justify="flex-start" align="flex-start" gap={ 4 } className="godam-marketo-credentials">
						<FlexBlock>
							<TextControl
								className="mb-4"
								type="password"
								autoComplete="off"
								label={ __( 'Client ID (optional)', 'godam' ) }
								help={ __( 'Admin → LaunchPoint → your service → View Details.', 'godam' ) }
								value={ form.client_id }
								onChange={ ( value ) => setField( 'client_id', value ) }
								data-test-id="godam-settings-marketo-control-client-id"
							/>
						</FlexBlock>
						<FlexBlock>
							<TextControl
								className="mb-4"
								type="password"
								autoComplete="off"
								label={ __( 'Client Secret (optional)', 'godam' ) }
								help={ __( 'Shown next to the Client ID. Stored securely; never shown again.', 'godam' ) }
								value={ form.client_secret }
								onChange={ ( value ) => setField( 'client_secret', value ) }
								data-test-id="godam-settings-marketo-control-client-secret"
							/>
						</FlexBlock>
					</Flex>

					<details className="godam-marketo-advanced" style={ { margin: '0 0 16px' } }>
						<summary style={ { cursor: 'pointer', fontSize: '13px' } }>
							{ __( 'Advanced (optional)', 'godam' ) }
						</summary>
						<div style={ { marginTop: '12px' } }>
							<TextControl
								className="mb-4"
								label={ __( 'Forms host', 'godam' ) }
								help={ __( 'A Marketo host such as "app-sj04.marketo.com". Leave blank to let GoDAM work it out from the Munchkin ID.', 'godam' ) }
								value={ form.forms_host }
								onChange={ ( value ) => setField( 'forms_host', value ) }
								data-test-id="godam-settings-marketo-control-forms-host"
							/>

							<TextControl
								className="mb-4"
								label={ __( 'reCAPTCHA site key', 'godam' ) }
								help={ __( 'Only needed if your Marketo forms use Google reCAPTCHA.', 'godam' ) }
								value={ form.recaptcha_site_key }
								onChange={ ( value ) => setField( 'recaptcha_site_key', value ) }
								data-test-id="godam-settings-marketo-control-recaptcha-key"
							/>
						</div>
					</details>

					<Button
						variant="primary"
						onClick={ handleConnect }
						isBusy={ submitting }
						disabled={ submitting || ! form.munchkin_id }
						data-test-id="godam-settings-marketo-button-connect"
					>
						{ __( 'Connect Marketo', 'godam' ) }
					</Button>
				</>
			) }
		</div>
	);
};

export default MarketoSettings;
