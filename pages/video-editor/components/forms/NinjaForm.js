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
import FormFields from './FormFields';
import FormPreview from './FormPreview';
import { useState } from 'react';
import clsx from 'clsx';

const NinjaForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const ninjaForms = useSelector( ( state ) => state.videoReducer.ninjaForms ) || [];

	const [ isFetching, setIsFetching ] = useState( true );

	const forms = ninjaForms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		setIsFetching( true );
		dispatch( updateLayerField( { id: layer.id, field: 'ninja_form_id', value: formID } ) );
	};

	const isNinjaFormsPluginActive = Boolean( window?.videoData?.ninjaFormsActive );

	return (
		<>
			<FormFields
				isActive={ isNinjaFormsPluginActive }
				pluginLabel={ __( 'Ninja Forms', 'godam' ) }
				formID={ layer.ninja_form_id }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				selectorClassName="ninja-form-selector"
				editUrl={ `${ window?.videoData?.adminUrl }admin.php?page=ninja-forms&form_id=${ layer.ninja_form_id }` }
				showEditButton={ Boolean( layer.ninja_form_id ) && ! isFetching }
			/>

			<FormPreview
				bgColor={ layer.bg_color }
				allowSkip={ layer.allow_skip }
			>
				{ layer?.ninja_form_id && (
					<div className={ clsx( 'form-container', 'ninja-form', { loading: isFetching } ) }>
						<iframe
							src={ window.godamRestRoute.homeUrl + '?rtgodam-render-layer=ninja-forms&rtgodam-layer-id=' + layer?.ninja_form_id }
							title="Ninja Form"
							scrolling="auto"
							width="100%"
							className={ isFetching ? 'hidden' : '' }
							onLoad={ () => setIsFetching( false ) }
						></iframe>
						{ isFetching && <p>{ __( 'Loading form…', 'godam' ) }</p> }
					</div>
				) }
			</FormPreview>
		</>
	);
};

export default NinjaForm;
