/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Notice } from '@wordpress/components';
import { chevronRight, pencil } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';
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

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;
	// For now we are enabling all the features
	const isValidAPIKey = true;

	const isMetFormPluginActive = Boolean( window?.videoData?.metformActive );

	return (
		<>
			{
				! isMetFormPluginActive &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'Please activate the MetForm plugin to use this feature.', 'godam' ) }
				</Notice>
			}

			{
				<FormSelector
					disabled={ ! isValidAPIKey || ! isMetFormPluginActive }
					className="met-form-selector mb-4"
					formID={ layer.metform_id }
					forms={ forms }
					handleChange={ changeFormID }
				/>
			}

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.bg_color,
						} }
						className="godam-layer"
					>

						{
							layer?.metform_id && (
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
							)
						}

						{
							! isValidAPIKey &&
							<p className="text-sm text-gray-500">{ __( 'This features is available in premium version', 'godam' ) }</p>
						}

						{
							! isFetching &&
							<Button
								href={ `${ window?.videoData?.adminUrl }?post=${ layer.metform_id }&action=elementor` }
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

export default MetForm;
