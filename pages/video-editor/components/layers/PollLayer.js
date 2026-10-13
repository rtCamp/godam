/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { ComboboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import { useGetPollsQuery, useGetPollQuery } from '../../redux/api/polls';
import LayersHeader from './LayersHeader.js';
import FormPreview from '../forms/FormPreview';
import { VeSection, VeToggle, VeColorList } from '../controls';

const PollLayer = ( { layerID, goBack, duration } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );

	const { data: polls } = useGetPollsQuery();
	const { data: currentPoll } = useGetPollQuery( layer.poll_id, { skip: ! layer.poll_id } );

	const handlePollChange = ( value ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'poll_id', value } ) );
	};

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			<div className="godam-ve-config">
				{ polls?.length > 0 && (
					<VeSection title={ __( 'Poll', 'godam' ) }>
						<div data-test-id="godam-poll-control-select">
							<ComboboxControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								className="godam-ve-control godam-ve-select"
								label={ __( 'Select Poll', 'godam' ) }
								value={ layer.poll_id }
								onChange={ handlePollChange }
								options={ polls.map( ( poll ) => ( { value: poll.pollq_id, label: poll.pollq_question } ) ) }
							/>
						</div>
					</VeSection>
				) }

				<VeSection title={ __( 'Behaviour', 'godam' ) }>
					<div data-test-id="godam-poll-control-allow-skip">
						<VeToggle
							label={ __( 'Allow user to skip', 'godam' ) }
							checked={ layer.allow_skip }
							onChange={ ( value ) =>
								dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
							}
							help={ __( 'If enabled, the user will be able to skip the poll.', 'godam' ) }
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
						/>
					</VeColorList>
				</VeSection>
			</div>

			<FormPreview bgColor={ layer.bg_color } allowSkip={ layer.allow_skip }>
				<div className="form-container poll-container" dangerouslySetInnerHTML={ { __html: currentPoll?.html } } />
			</FormPreview>
		</>
	);
};

export default PollLayer;
