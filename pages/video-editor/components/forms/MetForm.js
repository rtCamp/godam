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

const MetForm = ( { layerID } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const metforms = useSelector( ( state ) => state.videoReducer.metforms ) || [];

	const [ isFetching, setIsFetching ] = useState( true );

	const forms = metforms?.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const changeFormID = ( formID ) => {
		setIsFetching( true );
		dispatch( updateLayerField( { id: layer.id, field: 'metform_id', value: formID } ) );
	};

	const isMetFormPluginActive = Boolean( window?.videoData?.metformActive );

	return (
		<>
			<FormFields
				isActive={ isMetFormPluginActive }
				pluginLabel={ __( 'MetForm', 'godam' ) }
				formID={ layer.metform_id }
				formType={ layer.form_type }
				forms={ forms }
				onSelectForm={ changeFormID }
				selectorClassName="met-form-selector"
				editUrl={ `${ window?.videoData?.adminUrl }?post=${ layer.metform_id }&action=elementor` }
				showEditButton={ Boolean( layer.metform_id ) && ! isFetching }
			/>

			<FormPreview
				bgColor={ layer.bg_color }
				allowSkip={ layer.allow_skip }
			>
				{ layer?.metform_id && (
					<div className={ clsx( 'form-container', 'metform', { loading: isFetching } ) }>
						<iframe
							src={ window.godamRestRoute.homeUrl + '?rtgodam-render-layer=metform&rtgodam-layer-id=' + layer?.metform_id }
							title="Met Form"
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

export default MetForm;
