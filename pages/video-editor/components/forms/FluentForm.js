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
import { useGetSingleFluentFormQuery } from '../../redux/api/fluent-forms';
import LayerControl from '../LayerControls';
import FormSelector from './FormSelector';

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

	const isValidAPIKey = window?.videoData?.validApiKey ?? false;

	const isFluentFormsPluginActive = Boolean( window?.videoData?.fluentformsActive );

	return (
		<>
			{
				! isFluentFormsPluginActive &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'Please activate the Fluent Forms plugin to use this feature.', 'godam' ) }
				</Notice>
			}

			{
				<FormSelector
					disabled={ ! isValidAPIKey || ! isFluentFormsPluginActive }
					className="mb-4"
					formID={ layer.fluent_form_id }
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
								href={ `${ window?.videoData?.adminUrl }admin.php?page=fluent_forms&route=editor&form_id=${ layer.fluent_form_id }` }
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

export default FluentForm;
