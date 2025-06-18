/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';

/**
 * WordPress dependencies
 */
import { Button, Notice, SelectControl } from '@wordpress/components';
import { chevronRight, pencil } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField, setJetpackForms, setJetpackPluginActive } from '../../redux/slice/videoSlice';
import { useGetSingleJetpackFormQuery } from '../../redux/api/jetpack-forms';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

const templateOptions = [
	{
		value: 'default',
		label: __( 'Default', 'godam' ),
	},
];

const JetpackForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const jetpackForms = useSelector( ( state ) => state.videoReducer.jetpackForms ) || [];

	const { data: formHTML, isFetching, error } = useGetSingleJetpackFormQuery(
		{
			id: layer?.jp_id,
			theme: layer?.theme || 'default',
		},
		{
			skip: ! layer?.jp_id,
		},
	);

	// Initialize Jetpack forms data - useEffect must be called unconditionally
	useEffect( () => {
		// Set Jetpack plugin active status
		dispatch( setJetpackPluginActive( Boolean( window?.videoData?.jetpack_active ) ) );

		// Fetch and set Jetpack forms
		fetch( window.godamRestRoute.url + 'godam/v1/jetpack-forms', {
			headers: {
				'X-WP-Nonce': window.godamRestRoute.nonce,
			},
		} )
			.then( ( response ) => response.json() )
			.then( ( data ) => {
				dispatch( setJetpackForms( data ) );
			} )
			.catch( ( ) => {
				dispatch( setJetpackForms( [] ) );
			} );
	}, [ dispatch ] );

	// Add null check for layer
	if ( ! layer ) {
		return null;
	}

	// Ensure forms is always an array with proper structure
	const forms = Array.isArray( jetpackForms )
		? jetpackForms.map( ( form ) => ( {
			value: String( form.id ),
			label: form.title || `Form ${ form.id }`,
		} ) )
		: [];

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'jp_id', value: formID } ) );
	};

	// Helper function to extract post ID from form ID
	const getPostIdFromFormId = ( formId ) => {
		if ( ! formId ) {
			return null;
		}
		// Form ID format is "postId-formNumber" (e.g., "123-1")
		const parts = formId.split( '-' );
		return parts[ 0 ] ? parseInt( parts[ 0 ] ) : null;
	};

	// Helper function to get edit URL for the post containing the form
	const getEditFormUrl = ( formId ) => {
		const postId = getPostIdFromFormId( formId );
		if ( ! postId ) {
			return '#';
		}

		// Return URL to edit the post/page in block editor
		return `${ window?.videoData?.adminUrl }post.php?post=${ postId }&action=edit`;
	};

	const isValidAPIKey = true;
	const isJetpackPluginActive = Boolean( window?.videoData?.jetpack_active );

	return (
		<>
			{
				! isJetpackPluginActive &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'Please activate the Jetpack plugin to use this feature.', 'godam' ) }
				</Notice>
			}

			{
				<FormSelector
					disabled={ ! isValidAPIKey || ! isJetpackPluginActive }
					className="jetpack-form-selector mb-4"
					formID={ layer.jp_id }
					forms={ forms }
					handleChange={ changeFormID }
				/>
			}

			<SelectControl
				className="mb-4"
				label={ __( 'Select form theme', 'godam' ) }
				options={ templateOptions }
				value={ layer.theme || 'default' }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'theme', value } ) )
				}
				disabled={ ! isValidAPIKey || ! isJetpackPluginActive }
			/>

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.bg_color,
						} }
						className="easydam-layer"
					>
						{
							( formHTML && ! isFetching && ! error ) &&
							<div className="form-container jetpack-form-preview" dangerouslySetInnerHTML={ { __html: formHTML } } />
						}

						{
							isFetching &&
							<div className="form-container">
								<p>{ __( 'Loading form…', 'godam' ) }</p>
							</div>
						}

						{
							error &&
							<div className="form-container">
								<p>{ __( 'Error loading form. Please check if the form exists.', 'godam' ) }</p>
							</div>
						}

						{
							layer.jp_id &&
							<Button
								href={ getEditFormUrl( layer.jp_id ) }
								target="_blank"
								variant="secondary"
								icon={ pencil }
								className="absolute top-2 right-2"
							>{ __( 'Edit form', 'godam' ) }</Button>
						}
					</div>
					{ layer.allow_skip &&
					<Button
						className="skip-button"
						variant="primary"
						icon={ chevronRight }
						iconSize="18"
						iconPosition="right"
					>
						{ __( 'Skip', 'godam' ) }
					</Button>
					}
				</>
			</LayerControl>
		</>
	);
};

export default JetpackForm;
