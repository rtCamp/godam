/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Notice, ExternalLink, Spinner } from '@wordpress/components';
import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { VeSection, VeTextInput } from '../controls';
import FormPreview from './FormPreview';
import FormSelector from './FormSelector';

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
 * When the Marketo connection on GoDAM Central has API credentials (Client ID
 * and Secret), its approved forms are listed in a "Select Form" picker, like
 * HubSpot. A forms-only connection has no list, so the marketer types the
 * Marketo Form ID instead. The Munchkin ID and forms host come from the
 * GoDAM Central connection (exposed via `window.videoData.marketoConfig`).
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
	const settingsUrl = `${ window?.videoData?.adminUrl ?? '/wp-admin/' }admin.php?page=rtgodam_settings&settings_tab=integrations-settings&integration_tab=marketo`;

	const formId = layer?.marketo_id ? String( layer.marketo_id ) : '';

	// Approved forms from GoDAM Central (`godam/v1/marketo/forms`); empty for a
	// forms-only connection or when Central could not list them.
	const marketoForms = useSelector( ( state ) => state.videoReducer.marketoForms );
	const formOptions = useMemo( () => {
		const options = ( marketoForms || [] ).map( ( form ) => ( {
			value: String( form.id ),
			label: form.title,
		} ) );

		// Keep a saved form that is no longer listed (unapproved or deleted since
		// it was picked) selectable, so the picker does not show it as blank.
		if ( options.length > 0 && formId && ! options.some( ( option ) => option.value === formId ) ) {
			options.unshift( {
				value: formId,
				/* translators: %s is a Marketo form ID. */
				label: sprintf( __( 'Form %s', 'godam' ), formId ),
			} );
		}

		return options;
	}, [ marketoForms, formId ] );
	const hasFormList = isConfigured && formOptions.length > 0;

	// forms2 sends a submission through a hidden iframe and only accepts its
	// replies from the protocol it asked for. On an HTTP page it asks for
	// `http://`, the browser upgrades the iframe to HTTPS and every submit hangs
	// on "Please Wait". `app-*.marketo.com` hosts are always asked for over HTTPS.
	const isInsecurePage = 'http:' === window.location.protocol && ! /^\/\/app-.*?\.marketo\.com/i.test( instanceHost );

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

		const settle = ( nextStatus ) => {
			if ( ! settled ) {
				settled = true;
				clearTimeout( timeoutId );
				setStatus( nextStatus );
			}
		};
		const markReady = () => settle( 'ready' );

		loadForms2Library( instanceHost )
			.then( () => {
				if ( settled || ! window.MktoForms2 ) {
					return;
				}

				// forms2 renders before it calls back, so no fields here means the
				// form did not load, e.g. a form ID from another Marketo instance.
				window.MktoForms2.loadForm( instanceHost, munchkinId, Number( previewFormId ), () => {
					settle( node.querySelector( 'input, select, textarea, button' ) ? 'ready' : 'error' );
				} );

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
			.catch( () => settle( 'error' ) );
	}, [ canRender, instanceHost, munchkinId, previewFormId ] );

	const changeFormID = ( value ) => {
		// Marketo form IDs are numeric; keep digits only.
		const sanitized = String( value ).replace( /[^0-9]/g, '' );
		dispatch( updateLayerField( { id: layer.id, field: 'marketo_id', value: sanitized } ) );
		return sanitized;
	};

	// A form picked from the list is final, so preview it without the typing debounce.
	const selectFormID = ( value ) => {
		setPreviewFormId( changeFormID( value ?? '' ) );
	};

	let idlePrompt = __( 'Connect Marketo in Settings → Integrations to preview the form.', 'godam' );
	if ( hasFormList ) {
		idlePrompt = __( 'Select a Marketo form to preview it here.', 'godam' );
	} else if ( isConfigured ) {
		idlePrompt = __( 'Enter a Marketo Form ID to preview the form here.', 'godam' );
	}

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
					{ idlePrompt }
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

				{ isConfigured && isInsecurePage && (
					<Notice
						className="mb-4"
						status="warning"
						isDismissible={ false }
					>
						{ __( 'This site is served over HTTP. Marketo forms can only be submitted on HTTPS pages; on HTTP the submit button stays on "Please Wait".', 'godam' ) }
					</Notice>
				) }

				{ hasFormList ? (
					<FormSelector
						className="marketo-form-selector"
						formID={ formId }
						forms={ formOptions }
						handleChange={ selectFormID }
					/>
				) : (
					<VeTextInput
						label={ __( 'Marketo Form ID', 'godam' ) }
						help={ isConfigured
							? __( 'The numeric ID of the Marketo form to embed, e.g. 1234. Add the Client ID and Client Secret in Settings → Integrations → Marketo to pick from a list of your forms instead.', 'godam' )
							: __( 'The numeric ID of the Marketo form to embed, e.g. 1234.', 'godam' ) }
						type="number"
						value={ formId }
						onChange={ changeFormID }
						placeholder={ __( 'e.g. 1234', 'godam' ) }
					/>
				) }
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
