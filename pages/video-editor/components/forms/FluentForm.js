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
import { useGetSingleFluentFormQuery } from '../../redux/api/fluent-forms';
import FormFields from './FormFields';
import FormPreview from './FormPreview';

const FluentForm = ( { layerID } ) => {
	const dispatch = useDispatch();

	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );

	const fluentForms = useSelector( ( state ) => state.videoReducer.fluentForms );
	const { data: formHTML, isFetching } = useGetSingleFluentFormQuery( layer.fluent_form_id, {
		skip: 'undefined' === typeof layer?.fluent_form_id,
	} );

	const forms = fluentForms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'fluent_form_id', value: formID } ) );
	};

	const isFluentFormsPluginActive = Boolean( window?.videoData?.fluentformsActive );

	return (
		<>
			<FormFields
				isActive={ isFluentFormsPluginActive }
				pluginLabel={ __( 'Fluent Forms', 'godam' ) }
				formID={ layer.fluent_form_id }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				editUrl={ `${ window?.videoData?.adminUrl }admin.php?page=fluent_forms&route=editor&form_id=${ layer.fluent_form_id }` }
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

export default FluentForm;
