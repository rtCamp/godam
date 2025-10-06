/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';

/**
 * WordPress dependencies
 */
import { Button, Notice } from '@wordpress/components';
import { chevronRight, pencil } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField, setJetpackForms, setJetpackPluginActive } from '../../redux/slice/videoSlice';
import { useGetSingleJetpackFormQuery, useGetJetpackFormsQuery } from '../../redux/api/jetpack-forms';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

const JetpackForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const jetpackForms = useSelector( ( state ) => state.videoReducer.jetpackForms ) || [];

	// Use Redux Toolkit Query for fetching Jetpack forms
	const { data: formsData, error: formsError } = useGetJetpackFormsQuery();

	// Use existing query for single form
	const { data: formHTML, isFetching, error } = useGetSingleJetpackFormQuery( { id: layer?.jp_id }, {
		skip: 'undefined' === typeof layer?.jp_id,
	} );

	// Initialize Jetpack forms data - useEffect must be called unconditionally
	useEffect( () => {
		// Set Jetpack plugin active status
		dispatch( setJetpackPluginActive( Boolean( window?.videoData?.jetpackActive ) ) );

		// Update forms data when API response is available
		if ( formsData ) {
			dispatch( setJetpackForms( formsData ) );

			// Clear the previously selected form when no forms are available
			if ( formsData.length === 0 && layer?.jp_id ) {
				dispatch( updateLayerField( {
					id: layer.id,
					field: 'jp_id',
					value: '',
				} ) );

				dispatch( updateLayerField( {
					id: layer.id,
					field: 'origin_post_id',
					value: '',
				} ) );
			}

			// Auto-select the first form if no form is currently selected and forms are available
			if ( formsData && formsData.length > 0 && ! layer?.jp_id ) {
				const firstForm = formsData[ 0 ];
				changeFormID( firstForm.id );
			}
		}

		// Handle error case
		if ( formsError ) {
			dispatch( setJetpackForms( [] ) );

			// Also clear the form selection on error
			if ( layer?.jp_id ) {
				dispatch( updateLayerField( {
					id: layer.id,
					field: 'jp_id',
					value: '',
				} ) );

				dispatch( updateLayerField( {
					id: layer.id,
					field: 'origin_post_id',
					value: '',
				} ) );
			}
		}
	}, [ dispatch, formsData, formsError, layer?.jp_id, layer?.id ] );

	// Ensure forms is always an array with proper structure
	const forms = Array.isArray( jetpackForms )
		? jetpackForms.map( ( form ) => {
			const formData = {
				value: String( form.id ),
				label: form.title || `Form ${ form.id }`,
				origin_post_id: form.origin_post_id || form.post_id,
			};
			return formData;
		} )
		: [];

	const changeFormID = ( formID ) => {
		// Find the selected form to get the origin post ID
		const selectedForm = forms.find( ( form ) => form.value === formID );

		// Extract post ID from form ID as fallback
		const postIdFromFormId = getPostIdFromFormId( formID );
		// Determine origin post ID with fallback logic
		let originPostId = '';
		if ( selectedForm && selectedForm.origin_post_id ) {
			originPostId = selectedForm.origin_post_id;
		} else if ( postIdFromFormId ) {
			originPostId = String( postIdFromFormId );
		}
		// Update jp_id first
		dispatch( updateLayerField( {
			id: layer?.id,
			field: 'jp_id',
			value: formID,
		} ) );

		// Update origin_post_id separately
		dispatch( updateLayerField( {
			id: layer?.id,
			field: 'origin_post_id',
			value: originPostId,
		} ) );
	};

	// Add a useEffect to fix missing origin_post_id when form is already selected
	useEffect( () => {
		if ( layer?.jp_id && ! layer?.origin_post_id && forms.length > 0 ) {
			changeFormID( layer.jp_id );
		}
	}, [ layer?.jp_id, layer?.origin_post_id, forms.length ] );

	// Add null check for layer
	if ( ! layer ) {
		return null;
	}

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
	const isJetpackPluginActive = Boolean( window?.videoData?.jetpackActive );

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

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.bg_color,
						} }
						className="godam-layer"
					>
						{
							// Only show form preview if a form is selected
							layer.jp_id && (
								<>
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
										! isFetching && ! formHTML && ! error &&
										<div className="form-container">
											<p>{ __( 'No form selected or form not found.', 'godam' ) }</p>
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
								</>
							)
						}

						{
							// Show message when no forms are available
							! layer.jp_id && forms.length === 0 && (
								<div className="form-container">
									<p>
										{ __( 'No Jetpack forms found. Please ', 'godam' ) }
										<a
											href={ `${ window?.videoData?.adminUrl }admin.php?page=jetpack-forms-admin#/responses` }
											target="_blank"
											rel="noopener noreferrer"
											style={ { color: '#007cba', textDecoration: 'underline' } }
										>
											{ __( 'create a Jetpack contact form', 'godam' ) }
										</a>
										{ __( ' first.', 'godam' ) }
									</p>
								</div>
							)
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
