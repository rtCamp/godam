/**
 * External dependencies
 */

import { useDispatch, useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';

/**
 * WordPress dependencies
 */
import { Button, ToggleControl, ComboboxControl, Panel, PanelBody } from '@wordpress/components';
import { chevronRight } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import LayerControl from '../LayerControls';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';

import { useGetPollsQuery, useGetPollQuery } from '../../redux/api/polls';
import LayersHeader from './LayersHeader.js';

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
			{
				polls?.length > 0 &&
					<ComboboxControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Select poll', 'godam' ) }
						className="godam-combobox mb-4"
						value={ layer.poll_id }
						onChange={ handlePollChange }
						options={ polls.map( ( poll ) => ( { value: poll.pollq_id, label: poll.pollq_question } ) ) }
					/>
			}

			<ToggleControl
				className="mb-4 godam-toggle"
				label={ __( 'Allow user to skip', 'godam' ) }
				checked={ layer.allow_skip }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
				}
				help={ __( 'If enabled, the user will be able to skip the form submission.', 'godam' ) }
			/>

			<Panel
				className="-mx-4 border-x-0 godam-advance-panel">
				<PanelBody
					title={ __( 'Advance', 'godam' ) }
					initialOpen={ false }
				>

					{ /* Layer background color */ }
					<label
						htmlFor="color"
						className="text-base font-medium block mb-2"
					>
						{ __( 'Color', 'godam' ) }
					</label>
					<ColorPickerButton
						className="mb-4"
						value={ layer?.bg_color ?? '#FFFFFFB3' }
						label={ __( 'Layer background color', 'godam' ) }
						enableAlpha={ true }
						onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'bg_color', value } ) ) }
					/>

					<label htmlFor="custom-css" className="text-base font-medium block mb-2">{ __( 'Custom CSS', 'godam' ) }</label>

					<div>
						<Editor
							id="custom-css"
							className="code-editor"
							defaultLanguage="css"
							options={ {
								minimap: { enabled: false },
							} }
							defaultValue={ layer.custom_css }
							onChange={ ( value ) =>
								dispatch( updateLayerField( { id: layer.id, field: 'custom_css', value } ) )
							}
						/>
					</div>
				</PanelBody>
			</Panel>

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.bg_color,
						} } className="godam-layer">
						<div className="form-container poll-container" dangerouslySetInnerHTML={ { __html: currentPoll?.html } } />
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

export default PollLayer;
