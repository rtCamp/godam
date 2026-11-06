/**
 * External dependencies
 */
import { isVariationAvailable } from '@godam/layers';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import FormFields from './FormFields';
import FormPreview from './FormPreview';
import { useLayerAttributes } from '../../layers/hooks';
import { buildSettingsUrl, getFormIdField } from '../../utils/formUtils';

// Shared across panels, so reopening a layer doesn't fetch the same list or form again.
const formListCache = new Map();
const formHtmlCache = new Map();

const cached = ( cache, key, load ) => {
	if ( ! cache.has( key ) ) {
		cache.set( key, Promise.resolve().then( load ).catch( ( error ) => {
			cache.delete( key );
			throw error;
		} ) );
	}
	return cache.get( key );
};

/**
 * The settings panel for a form provider that doesn't bring its own `edit`
 * panel: a form picker filled from `provider.getForms()` and a live preview
 * from `provider.getFormHtml( formId )`. The chosen ID is stored on the
 * layer under `provider.idField`.
 *
 * `getForms()` resolves to `[ { id, title } ]`; `getFormHtml( id )` resolves
 * to the form's markup.
 *
 * @param {Object} props          Props.
 * @param {string} props.layerID  The form layer's id.
 * @param {Object} props.provider The layer's form provider (a Form variation).
 * @return {JSX.Element} The panel.
 */
const FormProviderPanel = ( { layerID, provider } ) => {
	const [ layer, setAttributes ] = useLayerAttributes( layerID );
	const idField = getFormIdField( provider );
	const formId = layer?.[ idField ];
	const isActive = isVariationAvailable( provider );

	const [ forms, setForms ] = useState( [] );
	const [ preview, setPreview ] = useState( { isFetching: false, html: '', error: '' } );

	useEffect( () => {
		if ( ! isActive || typeof provider.getForms !== 'function' ) {
			return undefined;
		}
		let cancelled = false;
		cached( formListCache, provider.name, () => provider.getForms() )
			.then( ( list ) => ! cancelled && setForms( Array.isArray( list ) ? list : [] ) )
			.catch( () => ! cancelled && setForms( [] ) );
		return () => {
			cancelled = true;
		};
	}, [ isActive, provider ] );

	useEffect( () => {
		if ( ! isActive || ! formId || typeof provider.getFormHtml !== 'function' ) {
			setPreview( { isFetching: false, html: '', error: '' } );
			return undefined;
		}
		let cancelled = false;
		setPreview( { isFetching: true, html: '', error: '' } );
		cached( formHtmlCache, `${ provider.name }:${ formId }`, () => provider.getFormHtml( formId ) )
			.then( ( html ) => ! cancelled && setPreview( { isFetching: false, html: html || '', error: '' } ) )
			.catch( () => ! cancelled && setPreview( {
				isFetching: false,
				html: '',
				error: __( 'The form could not be loaded.', 'godam' ),
			} ) );
		return () => {
			cancelled = true;
		};
	}, [ isActive, formId, provider ] );

	if ( ! layer ) {
		return null;
	}

	return (
		<>
			<FormFields
				isActive={ isActive }
				pluginLabel={ provider.title }
				formType={ provider.settingsUrl ? layer.form_type : undefined }
				formID={ formId }
				forms={ forms.map( ( form ) => ( { value: form.id, label: form.title } ) ) }
				onSelectForm={ ( id ) => setAttributes( { [ idField ]: id } ) }
				editUrl={ provider.settingsUrl && formId ? buildSettingsUrl( layer.form_type, formId ) : '' }
				showEditButton={ Boolean( preview.html ) }
			/>

			<FormPreview
				bgColor={ layer.bg_color }
				allowSkip={ layer.allow_skip }
				isFetching={ preview.isFetching }
				error={ preview.error }
				html={ preview.html }
			/>
		</>
	);
};

export default FormProviderPanel;
