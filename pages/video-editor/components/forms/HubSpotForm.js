/**
 * External dependencies
 */
import { useSelector } from 'react-redux';
import { useState, useEffect, useRef } from 'react';

/**
 * WordPress dependencies
 */
import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import LayerControl from '../LayerControls';

const HUBSPOT_SCRIPT = 'https://js.hsforms.net/forms/v2.js';

const HubSpotForm = ( { layerID } ) => {
	const layer = useSelector( ( state ) => state.videoReducer.godamCentralLayers.find( ( _layer ) => _layer.id === layerID ) );
	const transcodingJobId = useSelector( ( state ) => state.videoReducer.transcodingJobId );

	const [ isLoading, setIsLoading ] = useState( true );
	const [ portalId, setPortalId ] = useState( null );
	const containerRef = useRef( null );

	const formId = layer?.hubspot_id;
	const containerId = `hubspot-form-${ formId }`;

	useEffect( () => {
		apiFetch( { path: `${ window.wpApiSettings.root }godam/v1/hubspot-portal-id` } ).then( ( { hubspotPortalId } ) => setPortalId( hubspotPortalId ) );
	}, [] );

	useEffect( () => {
		const handleFormReady = ( event ) => {
			const { formId: eventFormId } = event.detail;
			if ( formId !== eventFormId ) {
				return;
			}
			setIsLoading( false );
		};

		window.addEventListener(
			'hs-form-event:on-ready',
			handleFormReady,
		);

		return () => {
			window.removeEventListener(
				'hs-form-event:on-ready',
				handleFormReady,
			);
		};
	}, [ formId ] );

	useEffect( () => {
		const loadForm = () => {
			if ( ! window.hbspt || ! containerRef.current || ! portalId ) {
				return;
			}

			containerRef.current.innerHTML = '';

			window.hbspt.forms.create( {
				portalId,
				formId,
				target: `#${ containerId }`,
			} );
		};

		if ( ! document.querySelector( '#hubspot-script' ) ) {
			const script = document.createElement( 'script' );
			script.src = HUBSPOT_SCRIPT;
			script.async = true;
			script.id = 'hubspot-script';
			script.onload = loadForm;
			document.body.appendChild( script );
		} else {
			loadForm();
		}
	}, [ portalId, formId, containerId ] );

	return (
		<>
			{
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'This form can only be edited from', 'godam' ) }
				&nbsp;
					<u>
						<a href={ window.godamRestRoute.apiBase + `/web/video-editor/${ transcodingJobId }` } target="_blank" rel="noopener noreferrer">
							{ __( 'GoDAM Central', 'godam' ) }
						</a>
					</u>
				</Notice>
			}

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: `rgba(${ parseInt( layer.backgroundColor.slice( 1, 3 ), 16 ) }, ${ parseInt( layer.backgroundColor.slice( 3, 5 ), 16 ) }, ${ parseInt( layer.backgroundColor.slice( 5, 7 ), 16 ) }, ${ layer.backgroundOpacity })`,
						} }
						className="easydam-layer godam-layer godam-layer-form godam-form-type-hubspot"
					>
						<div className="hubspot-form" ref={ containerRef } id={ containerId } />
						{ isLoading && (
							<div className="hubspot-form-spinner" />
						) }
					</div>
				</>
			</LayerControl>
		</>
	);
};

export default HubSpotForm;
