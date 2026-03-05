/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Notice, ExternalLink } from '@wordpress/components';
import { chevronRight, pencil } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { useGetSingleForminatorFormQuery } from '../../redux/api/forminator-forms';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

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

	const isValidAPIKey = window?.videoData?.validApiKey ?? false;

	const isForminatorFormsPluginActive = Boolean( window?.videoData?.forminatorActive );

	return (
		<>
			{
				! isForminatorFormsPluginActive &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'Please activate the Forminator Forms plugin to use this feature.', 'godam' ) }
				</Notice>
			}

			{
				<FormSelector disabled={ ! isValidAPIKey || ! isForminatorFormsPluginActive } className="mb-4" formID={ layer.forminator_id } forms={ forms } handleChange={ changeFormID } />
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
							! isValidAPIKey &&
							<p className="text-sm text-gray-500">{ __( 'Forms layer is a Pro feature. Your saved settings are stored but will not be applied on the frontend without an active Pro plan.', 'godam' ) } <ExternalLink href={ `https://godam.io/pricing?utm_campaign=upgrade&utm_source=${ window?.location?.host || '' }&utm_medium=plugin&utm_content=form-layer` } className="godam-link">{ __( 'Upgrade your plan', 'godam' ) }</ExternalLink></p>
						}

						{
							formHTML &&
							<Button
								href={ `${ window?.videoData?.adminUrl }admin.php?page=forminator-cform-wizard&id=${ layer.forminator_id }` }
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

export default ForminatorForm;
