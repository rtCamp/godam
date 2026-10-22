/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Notice, ExternalLink, Spinner } from '@wordpress/components';
import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { VeSection, VeTextInput } from '../controls';
import FormPreview from './FormPreview';

/**
 * Lazy-load Marketo's forms2 library for a given instance host, once per host.
 *
 * @param {string} instanceHost Protocol-relative host, e.g. `//123-ABC-456.mktoweb.com`.
 * @return {Promise<void>} Resolves when `window.MktoForms2` is available.
 */
const forms2Loaders = {};
function loadForms2Library( instanceHost ) {
	if ( window.MktoForms2 ) {
		return Promise.resolve();
	}
	if ( forms2Loaders[ instanceHost ] ) {
		return forms2Loaders[ instanceHost ];
	}

	forms2Loaders[ instanceHost ] = new Promise( ( resolve, reject ) => {
		const script = document.createElement( 'script' );
		script.src = `${ instanceHost }/js/forms2/js/forms2.min.js`;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			delete forms2Loaders[ instanceHost ];
			reject( new Error( 'Failed to load Marketo forms2 library.' ) );
		};
		document.head.appendChild( script );
	} );

	return forms2Loaders[ instanceHost ];
}

/**
 * Marketo form layer settings + live form preview.
 *
 * Marketo has no WordPress plugin and no form-list API, so the marketer types
 * the Marketo Form ID directly. The Pod ID and Munchkin ID come from
 * Settings → Integrations → Marketo (exposed via `window.videoData.marketoConfig`).
 * When a valid ID is entered the form is rendered live over the video using
 * Marketo's forms2 library — the same path used on the frontend.
 *
 * @param {Object} props         Props.
 * @param {string} props.layerID The layer id to edit.
 * @return {JSX.Element} The Marketo layer settings + preview.
 */
const Marketo = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );

	const isConfigured = Boolean( window?.videoData?.marketoActive );
	const marketoConfig = window?.videoData?.marketoConfig ?? {};
	// Normalized by PHP (Marketo::get_instance_host) so the editor and the
	// frontend always target the same Marketo instance, pod or mktoweb domain.
	const instanceHost = marketoConfig.instanceHost ?? '';
	const munchkinId = marketoConfig.munchkinId ?? '';
	const settingsUrl = `${ window?.videoData?.adminUrl ?? '/wp-admin/' }admin.php?page=rtgodam_settings`;

	const formId = layer?.marketo_id ?? '';

	// Debounce the form ID so we don't fetch a Marketo form on every keystroke.
	const [ previewFormId, setPreviewFormId ] = useState( formId );
	useEffect( () => {
		const timer = setTimeout( () => setPreviewFormId( formId ), 600 );
		return () => clearTimeout( timer );
	}, [ formId ] );

	const canRender = Boolean( isConfigured && instanceHost && munchkinId && previewFormId );

	// 'idle' | 'loading' | 'ready' | 'error'
	const [ status, setStatus ] = useState( 'idle' );

	// Reset to the idle prompt whenever we can no longer render (e.g. ID cleared).
	useEffect( () => {
		if ( ! canRender ) {
			setStatus( 'idle' );
		}
	}, [ canRender ] );

	/**
	 * Callback ref on the `<form>` node. It fires exactly when the node mounts
	 * into the (portaled) preview overlay, so we never call `loadForm` before
	 * the element exists. A fresh `key` on the form remounts it — and re-runs
	 * this — whenever the previewed form ID changes.
	 *
	 * @param {HTMLElement|null} node The mounted form element, or null on unmount.
	 */
	const mountMarketoForm = useCallback( ( node ) => {
		if ( ! node || ! canRender ) {
			return;
		}

		let settled = false;
		setStatus( 'loading' );

		// Guard against a never-firing callback (e.g. an invalid form ID or a
		// slow network). Also poll for Marketo having injected the form fields,
		// in case the readiness callback does not fire.
		const timeoutId = setTimeout( () => {
			if ( ! settled ) {
				settled = true;
				setStatus( 'error' );
			}
		}, 12000 );

		const markReady = () => {
			if ( ! settled ) {
				settled = true;
				clearTimeout( timeoutId );
				setStatus( 'ready' );
			}
		};

		loadForms2Library( instanceHost )
			.then( () => {
				if ( settled || ! window.MktoForms2 ) {
					return;
				}

				window.MktoForms2.loadForm( instanceHost, munchkinId, Number( previewFormId ), () => markReady() );

				// Backup readiness detection: Marketo adds `.mktoForm` + fields to
				// the node once it renders, even if the callback above is missed.
				let polls = 0;
				const poll = setInterval( () => {
					polls += 1;
					if ( settled || polls > 60 ) {
						clearInterval( poll );
						return;
					}
					if ( node.querySelector( '.mktoFormRow, .mktoButtonRow, input, select, textarea' ) ) {
						clearInterval( poll );
						markReady();
					}
				}, 200 );
			} )
			.catch( () => {
				if ( ! settled ) {
					settled = true;
					clearTimeout( timeoutId );
					setStatus( 'error' );
				}
			} );
	}, [ canRender, instanceHost, munchkinId, previewFormId ] );

	const changeFormID = ( value ) => {
		// Marketo form IDs are numeric; keep digits only.
		const sanitized = String( value ).replace( /[^0-9]/g, '' );
		dispatch( updateLayerField( { id: layer.id, field: 'marketo_id', value: sanitized } ) );
	};

	// Body shown inside the on-video preview overlay.
	//
	// Unlike the other form layers — whose previews are inert markup — this is a
	// real, working Marketo form. Pointer events are disabled so that editing a
	// layer can never submit it and create a live lead in the Marketo instance.
	const previewBody = (
		<div
			className="form-container marketo-form-container"
			style={ { pointerEvents: 'none' } }
		>
			{ status === 'loading' && (
				<p className="godam-marketo-preview__status">
					<Spinner />
					{ __( 'Loading Marketo form…', 'godam' ) }
				</p>
			) }

			{ status === 'error' && (
				<p className="godam-marketo-preview__status">
					{ __( 'Could not load this Marketo form. Check the Form ID and your Marketo connection, and your browser console for Marketo errors.', 'godam' ) }
				</p>
			) }

			{ status === 'idle' && (
				<p className="godam-marketo-preview__status">
					{ isConfigured
						? __( 'Enter a Marketo Form ID to preview the form here.', 'godam' )
						: __( 'Connect Marketo in Settings → Integrations to preview the form.', 'godam' ) }
				</p>
			) }

			{ canRender && (
				<form
					key={ previewFormId }
					id={ `mktoForm_${ previewFormId }` }
					ref={ mountMarketoForm }
				/>
			) }
		</div>
	);

	return (
		<>
			<VeSection title={ __( 'Form', 'godam' ) }>
				{ ! isConfigured && (
					<Notice
						className="mb-4"
						status="warning"
						isDismissible={ false }
					>
						{ __( 'Marketo is not connected, or the integration is turned off, so this form will not show on your videos. Connect and enable Marketo in', 'godam' ) }
						{ ' ' }
						<ExternalLink href={ settingsUrl }>
							{ __( 'Settings → Integrations → Marketo', 'godam' ) }
						</ExternalLink>
						{ '.' }
					</Notice>
				) }

				<VeTextInput
					label={ __( 'Marketo Form ID', 'godam' ) }
					help={ __( 'The numeric ID of the Marketo form to embed, e.g. 1234.', 'godam' ) }
					type="number"
					value={ formId }
					onChange={ changeFormID }
					placeholder={ __( 'e.g. 1234', 'godam' ) }
				/>
			</VeSection>

			<FormPreview
				bgColor={ layer?.bg_color }
				allowSkip={ layer?.allow_skip }
			>
				{ previewBody }
			</FormPreview>
		</>
	);
};

export default Marketo;
