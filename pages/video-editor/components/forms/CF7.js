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
import { useGetSingleCF7FormQuery } from '../../redux/api/cf7-forms';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

const templateOptions = [
	{
		value: 'godam',
		label: __( 'GoDAM', 'godam' ),
	},
	{
		value: 'default',
		label: __( 'Default', 'godam' ),
	},
];

const CF7 = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const cf7Forms = useSelector( ( state ) => state.videoReducer.cf7Forms );
	const { data: formHTML, isFetching } = useGetSingleCF7FormQuery( { id: layer.cf7_id, theme: layer.theme || 'godam' }, {
		skip: 'undefined' === typeof layer?.cf7_id,
	} );

	const forms = cf7Forms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) ) || [];

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'cf7_id', value: formID } ) );
	};

	const formTheme = layer.theme || 'godam';

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.validApiKey;
	// For now we are enabling all the features
	const isValidAPIKey = true;

	const isCF7PluginActive = Boolean( window?.videoData?.cf7Active );

	const handleThemeChange = ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'theme', value } ) );

	return (
		<>
			{
				! isCF7PluginActive &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'Please activate the Contact Form 7 plugin to use this feature.', 'godam' ) }
				</Notice>
			}

			{
				isCF7PluginActive && forms.length === 0 &&
				<Notice
					className="mb-4"
					status="info"
					isDismissible={ false }
				>
					{ __( 'No Contact Form 7 forms found. Please create a form first.', 'godam' ) }
				</Notice>
			}

			{
				<FormSelector disabled={ ! isValidAPIKey || ! isCF7PluginActive } className="mb-4" formID={ layer.cf7_id } forms={ forms } handleChange={ changeFormID } />
			}

			<SelectControl
				__next40pxDefaultSize
				className="mb-4"
				label={ __( 'Select form theme', 'godam' ) }
				options={ templateOptions }
				value={ layer.theme || 'godam' }
				onChange={ handleThemeChange }
				disabled={ ! isValidAPIKey || ! isCF7PluginActive }
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
