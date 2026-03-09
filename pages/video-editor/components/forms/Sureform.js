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
import { useGetSingleSureformQuery } from '../../redux/api/sureforms';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

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

	const isValidAPIKey = window?.videoData?.validApiKey ?? false;

	const isSureformsPluginActive = Boolean( window?.videoData?.sureformsActive );

	return (
		<>
			{
				! isSureformsPluginActive &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'Please activate the SureForms plugin to use this feature.', 'godam' ) }
				</Notice>
			}

			{
				<FormSelector disabled={ ! isValidAPIKey || ! isSureformsPluginActive } className="mb-4" formID={ layer.sureform_id } forms={ forms } handleChange={ changeFormID } />
			}

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.bg_color,
						} }
						className="easydam-layer"
					>

						{
							( formHTML && ! isFetching ) &&
							<div className="form-container" dangerouslySetInnerHTML={ { __html: formHTML } } />
						}

						{
							isFetching &&
							<div className="form-container">
								<p>{ __( 'Loading form…', 'godam' ) }</p>
							</div>
						}

						{
							formHTML &&
							<Button
								href={ `${ window?.videoData?.adminUrl }post.php?post=${ layer.sureform_id }&action=edit` }
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

export default SureForm;
