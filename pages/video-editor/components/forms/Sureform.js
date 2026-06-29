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
import { useGetSingleSureformQuery } from '../../redux/api/sureforms';
import FormFields from './FormFields';
import FormPreview from './FormPreview';

const SureForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const sureforms = useSelector( ( state ) => state.videoReducer.sureforms );
	const { data: formHTML, isFetching } = useGetSingleSureformQuery( layer.sureform_id, {
		skip: 'undefined' === typeof layer?.sureform_id,
	} );

	const forms = sureforms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'sureform_id', value: formID } ) );
	};

	const isSureformsPluginActive = Boolean( window?.videoData?.sureformsActive );

	return (
		<>
			<FormFields
				isActive={ isSureformsPluginActive }
				pluginLabel={ __( 'SureForms', 'godam' ) }
				formID={ layer.sureform_id }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				editUrl={ `${ window?.videoData?.adminUrl }post.php?post=${ layer.sureform_id }&action=edit` }
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

export default SureForm;
