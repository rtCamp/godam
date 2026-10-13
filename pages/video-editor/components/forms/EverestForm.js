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
import { useGetSingleEverestFormQuery } from '../../redux/api/everest-forms';
import FormFields from './FormFields';
import FormPreview from './FormPreview';

const EverestForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const everestForms = useSelector( ( state ) => state.videoReducer.everestForms ) || [];
	const { data: formHTML, isFetching } = useGetSingleEverestFormQuery( layer.everest_form_id, {
		skip: 'undefined' === typeof layer?.everest_form_id,
	} );

	const forms = everestForms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'everest_form_id', value: formID } ) );
	};

	const isEverestFormsPluginActive = Boolean( window?.videoData?.everestFormsActive );

	return (
		<>
			<FormFields
				isActive={ isEverestFormsPluginActive }
				pluginLabel={ __( 'Everest Forms', 'godam' ) }
				formID={ layer.everest_form_id }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				selectorClassName="everest-form-selector"
				editUrl={ `${ window?.videoData?.adminUrl }admin.php?page=evf-builder&view=fields&form_id=${ layer.everest_form_id }` }
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

export default EverestForm;
