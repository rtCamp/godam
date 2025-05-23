/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Notice, SelectControl } from '@wordpress/components';
import { chevronRight, pencil } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { useGetSingleGravityFormQuery } from '../../redux/api/gravity-forms';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

const templateOptions = [
	{
		value: 'orbital',
		label: 'Orbital',
	},
	{
		value: 'gravity',
		label: 'Gravity',
	},
];

const GravityForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const gforms = useSelector( ( state ) => state.videoReducer.gforms );
	const { data: formHTML, isFetching } = useGetSingleGravityFormQuery( { id: layer.gf_id, theme: layer.theme || 'orbital' } );

	const forms = gforms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'gf_id', value: formID } ) );
	};

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;
	// For now we are enabling all the features
	const isValidAPIKey = true;

	const isGFPluginActive = Boolean( window?.videoData?.gf_active );

	return (
		<>
			{
				! isGFPluginActive &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'Please activate the Gravity Forms plugin to use this feature.', 'godam' ) }
				</Notice>
			}

			{
				<FormSelector disabled={ ! isValidAPIKey || ! isGFPluginActive } className="gravity-form-selector mb-4" formID={ layer.gf_id } forms={ forms } handleChange={ changeFormID } />
			}

			<SelectControl
				className="mb-4"
				label={ __( 'Select form theme', 'godam' ) }
				options={ templateOptions }
				value={ layer.theme || 'orbital' }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'theme', value } ) )
				}
				disabled={ ! isValidAPIKey || ! isGFPluginActive }
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
							( formHTML && ! isFetching ) &&
							<div className="form-container" dangerouslySetInnerHTML={ { __html: formHTML } } />
						}

						{
							isFetching &&
							<div className="form-container">
								<p>{ __( 'Loading form…', 'godam' ) }</p>
							</div>
						}

						{
							formHTML &&
							<Button
								href={ `${ window?.videoData?.adminUrl }admin.php?page=gf_edit_forms&id=${ layer.gf_id }` }
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

export default GravityForm;
