/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useEffect, useRef, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
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
 * HubSpot's own embed script. The portal ID and region come from the connected
 * "HubSpot All-In-One Marketing" (leadin) plugin via `window.videoData`, never
 * from the layer, so the preview matches what the frontend renders.
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
	const portalId = window?.videoData?.hubspotPortalId || '';
	const region = window?.videoData?.hubspotHublet || 'na1';

	const formId = layer?.hubspot_id || '';
	const containerRef = useRef( null );
	const containerId = `godam-hubspot-form-${ layer.id }`;

	const [ isLoading, setIsLoading ] = useState( false );

	const forms = hubspotForms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( value ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'hubspot_id', value } ) );
	};

	useEffect( () => {
		let cancelled = false;

		if ( ! isActive || ! portalId || ! formId || ! containerRef.current ) {
			if ( containerRef.current ) {
				containerRef.current.innerHTML = '';
			}
			setIsLoading( false );
			return undefined;
		}

		setIsLoading( true );

		loadHubSpotScript().then( () => {
			if ( cancelled || ! window.hbspt || ! containerRef.current ) {
				return;
			}

			// Rebuild the target node so switching form IDs never stacks forms.
			containerRef.current.innerHTML = '';

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
		};
	}, [ isActive, portalId, region, formId, containerId ] );

	return (
		<>
			<FormFields
				isActive={ isActive }
				pluginLabel={ __( 'HubSpot', 'godam' ) }
				formID={ formId }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				selectorClassName="hubspot-form-selector"
			/>

			<FormPreview
				bgColor={ layer.bg_color }
				allowSkip={ layer.allow_skip }
			>
				{ isActive && formId && (
					<div className={ clsx( 'form-container', 'hubspot-form', { loading: isLoading } ) }>
						<div ref={ containerRef } id={ containerId } className={ isLoading ? 'hidden' : '' } />
						{ isLoading && <p>{ __( 'Loading form…', 'godam' ) }</p> }
					</div>
				) }
			</FormPreview>
		</>
	);
};

export default HubSpotForm;
