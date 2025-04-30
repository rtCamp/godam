/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, SelectControl } from '@wordpress/components';
import { chevronRight, pencil } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { useGetSingleCF7FormQuery } from '../../redux/api/cf7-forms';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

const templateOptions = [
	{
		value: 'godam',
		label: 'GoDAM',
	},
	{
		value: 'default',
		label: 'Default',
	},
];

const CF7 = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const cf7Forms = useSelector( ( state ) => state.videoReducer.cf7Forms );
	const { data: formHTML, isFetching } = useGetSingleCF7FormQuery( { id: layer.cf7_id, theme: layer.theme || 'godam' } );

	const forms = cf7Forms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'cf7_id', value: formID } ) );
	};

	const formTheme = layer.theme || 'godam';

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;
	// For now we are enabling all the features
	const isValidAPIKey = true;

	return (
		<>
			{
				forms.length > 0 &&
					<FormSelector disabled={ ! isValidAPIKey } className="gravity-form-selector mb-4" formID={ layer.cf7_id } forms={ forms } handleChange={ changeFormID } />
			}

			<SelectControl
				className="mb-4"
				label={ __( 'Select form theme', 'godam' ) }
				options={ templateOptions }
				value={ layer.theme || 'godam' }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'theme', value } ) )
				}
				disabled={ ! isValidAPIKey }
			/>

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.bg_color,
						} }
						className="easydam-layer relative"
					>

						{
							( formHTML && ! isFetching ) &&
							<div className={ `form-container ${ formTheme === 'godam' ? 'rtgodam-wpcf7-form' : '' }` } dangerouslySetInnerHTML={ { __html: formHTML } } />
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
								href={ `${ window?.videoData?.adminUrl }admin.php?page=wpcf7&post=${ layer.cf7_id }&action=edit` }
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

export default CF7;
