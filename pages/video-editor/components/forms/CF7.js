/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { useGetSingleCF7FormQuery } from '../../redux/api/cf7-forms';
import FormFields from './FormFields';
import FormPreview from './FormPreview';

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
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'cf7_id', value: formID } ) );
	};

	const formTheme = layer.theme || 'godam';

	const isCF7PluginActive = Boolean( window?.videoData?.cf7Active );

	const handleThemeChange = ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'theme', value } ) );

	return (
		<>
			<FormFields
				isActive={ isCF7PluginActive }
				pluginLabel={ __( 'Contact Form 7', 'godam' ) }
				formID={ layer.cf7_id }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				theme={ {
					value: formTheme,
					options: templateOptions,
					onChange: handleThemeChange,
				} }
				editUrl={ `${ window?.videoData?.adminUrl }admin.php?page=wpcf7&post=${ layer.cf7_id }&action=edit` }
				showEditButton={ Boolean( formHTML ) }
			/>

			<FormPreview
				bgColor={ layer.bg_color }
				allowSkip={ layer.allow_skip }
				isFetching={ isFetching }
				html={ formHTML }
				containerClassName={ formTheme === 'godam' ? 'rtgodam-wpcf7-form' : '' }
			/>
		</>
	);
};

export default CF7;
