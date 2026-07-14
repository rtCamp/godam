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
import { useGetSingleWPFormQuery } from '../../redux/api/wpforms';
import FormFields from './FormFields';
import FormPreview from './FormPreview';

const WPForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const wpForms = useSelector( ( state ) => state.videoReducer.wpforms );
	const { data: formHTML, isFetching } = useGetSingleWPFormQuery( layer.wpform_id, {
		skip: 'undefined' === typeof layer?.wpform_id,
	} );

	const forms = wpForms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'wpform_id', value: formID } ) );
	};

	const isWPFormsPluginActive = Boolean( window?.videoData?.wpformsActive );

	return (
		<>
			<FormFields
				isActive={ isWPFormsPluginActive }
				pluginLabel={ __( 'WPForms', 'godam' ) }
				formID={ layer.wpform_id }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				editUrl={ `${ window?.videoData?.adminUrl }admin.php?page=wpforms-builder&view=fields&form_id=${ layer.wpform_id }` }
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

export default WPForm;
