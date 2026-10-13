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
import { useGetSingleForminatorFormQuery } from '../../redux/api/forminator-forms';
import FormFields from './FormFields';
import FormPreview from './FormPreview';

const ForminatorForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const forminatorForms = useSelector( ( state ) => state.videoReducer.forminatorForms );
	const { data: formHTML, isFetching } = useGetSingleForminatorFormQuery( layer.forminator_id, {
		skip: 'undefined' === typeof layer?.forminator_id,
	} );

	const forms = forminatorForms?.map( ( form ) => ( {
		value: form.id,
		label: form.name,
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'forminator_id', value: formID } ) );
	};

	const isForminatorFormsPluginActive = Boolean( window?.videoData?.forminatorActive );

	return (
		<>
			<FormFields
				isActive={ isForminatorFormsPluginActive }
				pluginLabel={ __( 'Forminator Forms', 'godam' ) }
				formID={ layer.forminator_id }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				editUrl={ `${ window?.videoData?.adminUrl }admin.php?page=forminator-cform-wizard&id=${ layer.forminator_id }` }
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

export default ForminatorForm;
