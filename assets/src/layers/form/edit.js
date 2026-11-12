/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import { store as layersStore, getLayerVariation, isVariationAvailable } from '@godam/layers';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Notice } from '@wordpress/components';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../../../pages/video-editor/redux/slice/videoSlice';
import ColorPickerButton from '../../../../pages/video-editor/components/shared/color-picker/ColorPickerButton.jsx';
import LayersHeader from '../../../../pages/video-editor/components/layers/LayersHeader.js';
import { VeSection, VeToggle, VeColorList } from '../../../../pages/video-editor/components/controls';
import FormProviderPanel from '../../../../pages/video-editor/components/forms/FormProviderPanel';

/**
 * Component to render and manage a form layer within the video editor. The
 * form plugin's part of the panel comes from the layer's form provider (a Form
 * layer variation): its own `edit` panel, or the shared `FormProviderPanel`.
 *
 * @param {Object}   param0          - Props passed to the FormLayer component.
 * @param {string}   param0.layerID  - Unique identifier for the form layer.
 * @param {Function} param0.goBack   - Callback function to navigate back to the previous view.
 * @param {number}   param0.duration - Total duration of the video (in seconds or milliseconds).
 *
 * @return {JSX.Element} The rendered FormLayer component.
 */
const FormLayer = ( { layerID, goBack, duration } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );

	const formType = useSelect( ( select ) => select( layersStore ).getLayerType( 'form' ), [] );
	const provider = getLayerVariation( formType, layer );
	const ProviderPanel = provider?.edit;
	const isPluginActive = Boolean( provider ) && isVariationAvailable( provider );

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			<div className="godam-ve-config">
				{ provider && ProviderPanel && <ProviderPanel layerID={ layer.id } /> }
				{ provider && ! ProviderPanel && <FormProviderPanel layerID={ layer.id } provider={ provider } /> }
				{ ! provider && (
					<VeSection title={ __( 'Form', 'godam' ) }>
						<Notice status="warning" isDismissible={ false }>
							{ sprintf(
								/* translators: %s is a form provider name stored on the layer, e.g. "acme-forms". */
								__( 'This layer uses the "%s" form, which isn\'t available. Activate the add-on that provides it, or delete the layer.', 'godam' ),
								layer?.form_type,
							) }
						</Notice>
					</VeSection>
				) }

				<VeSection title={ __( 'Behaviour', 'godam' ) }>
					<div data-test-id="godam-form-control-allow-skip">
						<VeToggle
							label={ __( 'Allow user to skip', 'godam' ) }
							checked={ layer.allow_skip }
							onChange={ ( value ) =>
								dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
							}
							help={ __( 'If enabled, the user will be able to skip the form submission.', 'godam' ) }
							disabled={ ! isPluginActive }
						/>
					</div>
				</VeSection>

				<VeSection title={ __( 'Background Colour', 'godam' ) }>
					<VeColorList>
						<ColorPickerButton
							className="godam-ve-color-row"
							value={ layer?.bg_color ?? '#FFFFFFB3' }
							label={ __( 'Background', 'godam' ) }
							enableAlpha={ true }
							onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'bg_color', value } ) ) }
							disabled={ ! isPluginActive }
						/>
					</VeColorList>
				</VeSection>
			</div>
		</>
	);
};

export default FormLayer;
