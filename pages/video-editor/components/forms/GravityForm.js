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
import { useGetSingleGravityFormQuery } from '../../redux/api/gravity-forms';
import FormFields from './FormFields';
import FormPreview from './FormPreview';

const templateOptions = [
	{
		value: 'orbital',
		label: __( 'Orbital', 'godam' ),
	},
	{
		value: 'gravity',
		label: __( 'Gravity', 'godam' ),
	},
];

const GravityForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const gforms = useSelector( ( state ) => state.videoReducer.gforms );
	const { data: formHTML, isFetching } = useGetSingleGravityFormQuery( { id: layer.gf_id, theme: layer.theme || 'orbital' }, {
		skip: 'undefined' === typeof layer?.gf_id,
	} );

	const forms = gforms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'gf_id', value: formID } ) );
	};

	const isGFPluginActive = Boolean( window?.videoData?.gfActive );

	const handleThemeChange = ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'theme', value } ) );

	return (
		<>
			<FormFields
				isActive={ isGFPluginActive }
				pluginLabel={ __( 'Gravity Forms', 'godam' ) }
				formID={ layer.gf_id }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				theme={ {
					value: layer.theme || 'orbital',
					options: templateOptions,
					onChange: handleThemeChange,
				} }
				editUrl={ `${ window?.videoData?.adminUrl }admin.php?page=gf_edit_forms&id=${ layer.gf_id }` }
				showEditButton={ Boolean( formHTML ) }
			/>

			<FormPreview
				bgColor={ layer.bg_color }
				allowSkip={ layer.allow_skip }
				isFetching={ isFetching }
				html={ formHTML }
			/>
		</>
	);
};

export default GravityForm;
