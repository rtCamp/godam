/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Notice } from '@wordpress/components';
import { chevronRight, pencil } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';
import { useState } from 'react';
import clsx from 'clsx';

const NinjaForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const ninjaForms = useSelector( ( state ) => state.videoReducer.ninjaForms ) || [];

	const [ isFetching, setIsFetching ] = useState( true );

	const forms = ninjaForms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		setIsFetching( true );
		dispatch( updateLayerField( { id: layer.id, field: 'ninja_form_id', value: formID } ) );
	};

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;
	// For now we are enabling all the features
	const isValidAPIKey = true;

	const isNinjaFormsPluginActive = Boolean( window?.videoData?.ninjaFormsActive );

	return (
		<>
			{
				! isNinjaFormsPluginActive &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'Please activate the Ninja Forms plugin to use this feature.', 'godam' ) }
				</Notice>
			}

			{
				<FormSelector
					disabled={ ! isValidAPIKey || ! isNinjaFormsPluginActive }
					className="ninja-form-selector mb-4"
					formID={ layer.ninja_form_id }
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

						{ layer?.ninja_form_id &&
							<div className={ clsx( 'form-container', 'ninja-form', { loading: isFetching } ) }>
								{ <iframe
									src={ window.godamRestRoute.homeUrl + '?rtgodam-render-layer=ninja-forms&rtgodam-layer-id=' + layer?.ninja_form_id }
									title="Ninja Form"
									scrolling="auto"
									width="100%"
									className={ isFetching ? 'hidden' : '' }
									onLoad={ () => setIsFetching( false ) }
								></iframe> }

								{
									isFetching &&
									<p>{ __( 'Loading form…', 'godam' ) }</p>
								}
							</div>
						}

						{
							! isValidAPIKey &&
							<p className="text-sm text-gray-500">{ __( 'This features is available in premium version', 'godam' ) }</p>
						}

						{
							! isFetching &&
							<Button
								href={ `${ window?.videoData?.adminUrl }admin.php?page=ninja-forms&form_id=${ layer.ninja_form_id }` }
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

export default NinjaForm;
