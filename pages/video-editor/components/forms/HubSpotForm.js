/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { Notice, ExternalLink } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { VeSection, VeTextInput } from '../controls';
import FormFields from './FormFields';
import FormPreview from './FormPreview';

const HUBSPOT_SCRIPT_ID = 'godam-hubspot-forms-v2';
const HUBSPOT_SCRIPT_SRC = 'https://js.hsforms.net/forms/v2.js';

/**
 * Ensure the HubSpot forms embed script is present, resolving once `window.hbspt`
 * is available. The script is shared across layers, so it is injected only once.
 *
 * @return {Promise<void>} Resolves when `window.hbspt` is ready.
 */
const loadHubSpotScript = () =>
	new Promise( ( resolve ) => {
		if ( window.hbspt ) {
			resolve();
			return;
		}

		let script = document.getElementById( HUBSPOT_SCRIPT_ID );
		if ( ! script ) {
			script = document.createElement( 'script' );
			script.id = HUBSPOT_SCRIPT_ID;
			script.src = HUBSPOT_SCRIPT_SRC;
			script.async = true;
			document.body.appendChild( script );
		}

		// The script may exist but not have finished executing yet; poll for the
		// global rather than relying solely on a load event that may have fired.
		const start = Date.now();
		const timer = setInterval( () => {
			if ( window.hbspt || Date.now() - start > 15000 ) {
				clearInterval( timer );
				resolve();
			}
		}, 100 );
	} );

/**
 * HubSpot form layer editor control.
 *
 * The form is picked from the connected HubSpot account's form list (fetched via
 * `godam/v1/hubspot-forms`, same as the other providers) and previewed live with
 * HubSpot's own embed script. The portal ID and region come from whichever
 * source is active (GoDAM Central or the "HubSpot All-In-One Marketing" / leadin
 * plugin) via `window.videoData`, never from the layer, so the preview matches
 * what the frontend renders.
 *
 * The form is normally picked from the connected account's form list. When no
 * list is available (an account that returns none, or a Central connection that
 * cannot list forms) the marketer types the HubSpot form ID instead.
 *
 * @param {Object} props         Component props.
 * @param {string} props.layerID The ID of the layer being edited.
 * @return {JSX.Element} The HubSpot form layer control.
 */
const HubSpotForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const hubspotForms = useSelector( ( state ) => state.videoReducer.hubspotForms ) || [];

	const isActive = Boolean( window?.videoData?.hubspotActive );
	const isEnabled = window?.videoData?.hubspotEnabled !== false;
	const portalId = window?.videoData?.hubspotPortalId || '';
	const region = window?.videoData?.hubspotHublet || 'na1';
	const source = window?.videoData?.hubspotSource || '';
	const settingsUrl = `${ window?.videoData?.adminUrl ?? '/wp-admin/' }admin.php?page=rtgodam_settings`;

	const formId = layer?.hubspot_id || '';
	const containerId = `godam-hubspot-form-${ layer.id }`;

	// The preview target lives inside a portal (LayerControls) that only mounts
	// after it finds its placeholder asynchronously, so a plain ref can still be
	// null when the effect first runs — leaving the form unrendered. A callback
	// ref stored in state re-runs the render effect the moment the node attaches
	// (and again when the portal remounts it after switching layers).
	const [ container, setContainer ] = useState( null );
	const setContainerRef = useCallback( ( node ) => setContainer( node ), [] );

	const [ isLoading, setIsLoading ] = useState( false );

	const forms = hubspotForms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( value ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'hubspot_id', value } ) );
	};

	useEffect( () => {
		if ( ! isActive || ! portalId || ! formId || ! container ) {
			if ( container ) {
				container.innerHTML = '';
			}
			setIsLoading( false );
			return undefined;
		}

		let cancelled = false;
		setIsLoading( true );

		// HubSpot renders the form asynchronously and its onFormReady callback is
		// not always delivered, which left "Loading form…" showing forever. Watch
		// the container and clear the loading state as soon as the form markup
		// actually appears.
		const observer = new MutationObserver( () => {
			if ( ! cancelled && container.querySelector( 'iframe, form' ) ) {
				setIsLoading( false );
			}
		} );
		observer.observe( container, { childList: true, subtree: true } );

		loadHubSpotScript().then( () => {
			if ( cancelled || ! window.hbspt?.forms?.create || ! container ) {
				return;
			}

			// Rebuild the target node so switching form IDs never stacks forms.
			container.innerHTML = '';

			window.hbspt.forms.create( {
				portalId,
				formId,
				region,
				target: `#${ containerId }`,
				onFormReady: () => {
					if ( ! cancelled ) {
						setIsLoading( false );
					}
				},
			} );
		} );

		return () => {
			cancelled = true;
			observer.disconnect();
		};
	}, [ isActive, portalId, region, formId, containerId, container ] );

	return (
		<>
			{ isActive && forms.length > 0 ? (
				<FormFields
					isActive={ isActive }
					pluginLabel={ __( 'HubSpot', 'godam' ) }
					formID={ formId }
					forms={ forms }
					onSelectForm={ changeFormID }
					selectorClassName="hubspot-form-selector"
				/>
			) : (
				// Shown when the form cannot be configured normally: the integration
				// is off or not connected, or there is no form list to pick from (an
				// account with no forms, or a Central connection that cannot list
				// them). Either way, type the HubSpot form ID.
				<VeSection title={ __( 'Form', 'godam' ) }>
					{ ! isActive && (
						<Notice className="mb-4" status="warning" isDismissible={ false }>
							{ ! isEnabled && (
								<>
									{ __( 'The HubSpot integration is turned off, so this form will not show on your videos. Turn it on in', 'godam' ) }
									{ ' ' }
									<ExternalLink href={ settingsUrl }>
										{ __( 'Settings → Integrations → HubSpot', 'godam' ) }
									</ExternalLink>
									{ '.' }
								</>
							) }
							{ isEnabled && 'leadin' === source && (
								__( 'Activate and connect the HubSpot plugin to use this form.', 'godam' )
							) }
							{ isEnabled && 'leadin' !== source && (
								<>
									{ __( 'HubSpot is not connected, so this form will not show on your videos. Connect HubSpot in', 'godam' ) }
									{ ' ' }
									<ExternalLink href={ settingsUrl }>
										{ __( 'Settings → Integrations → HubSpot', 'godam' ) }
									</ExternalLink>
									{ '.' }
								</>
							) }
						</Notice>
					) }

					<VeTextInput
						label={ __( 'HubSpot Form ID', 'godam' ) }
						help={ __( 'The HubSpot form GUID, e.g. 1a2b3c4d-5e6f-7890-abcd-ef1234567890.', 'godam' ) }
						value={ formId }
						onChange={ changeFormID }
						placeholder={ __( 'e.g. 1a2b3c4d-5e6f-7890-abcd-ef1234567890', 'godam' ) }
						disabled={ ! isEnabled }
					/>
				</VeSection>
			) }

			<FormPreview
				bgColor={ layer.bg_color }
				allowSkip={ layer.allow_skip }
			>
				{ isActive && formId && (
					<div className={ clsx( 'form-container', 'hubspot-form', { loading: isLoading } ) }>
						{ isLoading && <p>{ __( 'Loading form…', 'godam' ) }</p> }
						{ /* The target must stay visible: HubSpot's embed does not
						     render into (or fire onFormReady for) a display:none
						     container. */ }
						<div ref={ setContainerRef } id={ containerId } />
					</div>
				) }
			</FormPreview>
		</>
	);
};

export default HubSpotForm;
