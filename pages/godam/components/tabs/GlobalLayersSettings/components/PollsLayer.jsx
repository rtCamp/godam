/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	ToggleControl,
	Panel,
	PanelBody,
	TextControl,
	TextareaControl,
	SelectControl,
	RangeControl,
	ColorPicker,
	Button,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../redux/slice/media-settings.js';

const PollsLayer = () => {
	const dispatch = useDispatch();

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'polls', key, value } ) );
	};

	const placementOptions = [
		{ label: __( 'Start of video', 'godam' ), value: 'start' },
		{ label: __( 'Middle of video', 'godam' ), value: 'middle' },
		{ label: __( 'End of video', 'godam' ), value: 'end' },
	];

	const positionOptions = [
		{ label: __( 'Center', 'godam' ), value: 'center' },
		{ label: __( 'Top', 'godam' ), value: 'top' },
		{ label: __( 'Bottom', 'godam' ), value: 'bottom' },
		{ label: __( 'Left', 'godam' ), value: 'left' },
		{ label: __( 'Right', 'godam' ), value: 'right' },
	];

	// Add a new poll
	const addPoll = () => {
		const currentPolls = mediaSettings?.global_layers?.polls?.polls || [];
		const newPoll = {
			id: Date.now(),
			question: __( 'New Poll Question', 'godam' ),
			options: [
				{ id: 1, text: __( 'Option 1', 'godam' ) },
				{ id: 2, text: __( 'Option 2', 'godam' ) },
			],
			multiple_choice: false,
			show_results: true,
			duration: 15,
			position: 30,
		};
		handleSettingChange( 'polls', [ ...currentPolls, newPoll ] );
	};

	// Remove a poll
	const removePoll = ( pollId ) => {
		const currentPolls = mediaSettings?.global_layers?.polls?.polls || [];
		const updatedPolls = currentPolls.filter( poll => poll.id !== pollId );
		handleSettingChange( 'polls', updatedPolls );
	};

	// Update a specific poll
	const updatePoll = ( pollId, key, value ) => {
		const currentPolls = mediaSettings?.global_layers?.polls?.polls || [];
		const updatedPolls = currentPolls.map( poll => 
			poll.id === pollId ? { ...poll, [ key ]: value } : poll
		);
		handleSettingChange( 'polls', updatedPolls );
	};

	// Add option to a poll
	const addPollOption = ( pollId ) => {
		const currentPolls = mediaSettings?.global_layers?.polls?.polls || [];
		const updatedPolls = currentPolls.map( poll => {
			if ( poll.id === pollId ) {
				const newOption = {
					id: Date.now(),
					text: __( 'New Option', 'godam' ),
				};
				return { ...poll, options: [ ...poll.options, newOption ] };
			}
			return poll;
		} );
		handleSettingChange( 'polls', updatedPolls );
	};

	// Remove option from a poll
	const removePollOption = ( pollId, optionId ) => {
		const currentPolls = mediaSettings?.global_layers?.polls?.polls || [];
		const updatedPolls = currentPolls.map( poll => {
			if ( poll.id === pollId ) {
				return { ...poll, options: poll.options.filter( option => option.id !== optionId ) };
			}
			return poll;
		} );
		handleSettingChange( 'polls', updatedPolls );
	};

	// Update poll option
	const updatePollOption = ( pollId, optionId, text ) => {
		const currentPolls = mediaSettings?.global_layers?.polls?.polls || [];
		const updatedPolls = currentPolls.map( poll => {
			if ( poll.id === pollId ) {
				const updatedOptions = poll.options.map( option =>
					option.id === optionId ? { ...option, text } : option
				);
				return { ...poll, options: updatedOptions };
			}
			return poll;
		} );
		handleSettingChange( 'polls', updatedPolls );
	};

	const polls = mediaSettings?.global_layers?.polls?.polls || [];

	return (
		<Panel header={ __( 'Polls Layer', 'godam' ) } className="godam-panel">
			<PanelBody opened>
				<ToggleControl
					className="godam-toggle mb-4"
					label={ __( 'Enable Global Polls Layer', 'godam' ) }
					help={ __( 'Enable or disable interactive polls on all videos across the site', 'godam' ) }
					checked={ mediaSettings?.global_layers?.polls?.enabled || false }
					onChange={ ( value ) => handleSettingChange( 'enabled', value ) }
				/>

				{
					mediaSettings?.global_layers?.polls?.enabled && (
						<>
							<SelectControl
								className="godam-select mb-4"
								label={ __( 'Default Poll Placement', 'godam' ) }
								help={ __( 'Choose when polls should appear by default', 'godam' ) }
								value={ mediaSettings?.global_layers?.polls?.placement || 'middle' }
								options={ placementOptions }
								onChange={ ( value ) => handleSettingChange( 'placement', value ) }
							/>

							<SelectControl
								className="godam-select mb-4"
								label={ __( 'Default Poll Position', 'godam' ) }
								help={ __( 'Choose where polls should appear on screen by default', 'godam' ) }
								value={ mediaSettings?.global_layers?.polls?.screen_position || 'center' }
								options={ positionOptions }
								onChange={ ( value ) => handleSettingChange( 'screen_position', value ) }
							/>

							<RangeControl
								className="godam-range mb-4"
								label={ __( 'Default Poll Duration (seconds)', 'godam' ) }
								help={ __( 'How long polls should be displayed by default', 'godam' ) }
								value={ mediaSettings?.global_layers?.polls?.default_duration || 15 }
								onChange={ ( value ) => handleSettingChange( 'default_duration', value ) }
								min={ 5 }
								max={ 60 }
							/>

							<ToggleControl
								className="godam-toggle mb-4"
								label={ __( 'Show Results by Default', 'godam' ) }
								help={ __( 'Whether to show poll results after voting by default', 'godam' ) }
								checked={ mediaSettings?.global_layers?.polls?.show_results_default || true }
								onChange={ ( value ) => handleSettingChange( 'show_results_default', value ) }
							/>

							<div className="mb-4">
								<label className="components-base-control__label">{ __( 'Default Background Color', 'godam' ) }</label>
								<ColorPicker
									color={ mediaSettings?.global_layers?.polls?.background_color || '#ffffff' }
									onChange={ ( value ) => handleSettingChange( 'background_color', value ) }
								/>
							</div>

							<div className="mb-4">
								<label className="components-base-control__label">{ __( 'Default Text Color', 'godam' ) }</label>
								<ColorPicker
									color={ mediaSettings?.global_layers?.polls?.text_color || '#000000' }
									onChange={ ( value ) => handleSettingChange( 'text_color', value ) }
								/>
							</div>

							<div className="border-t pt-4 mt-6">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg font-medium">{ __( 'Global Polls', 'godam' ) }</h3>
									<Button
										variant="secondary"
										onClick={ addPoll }
									>
										{ __( 'Add Poll', 'godam' ) }
									</Button>
								</div>

								{ polls.length === 0 ? (
									<p className="text-gray-600">
										{ __( 'No polls added yet. Click "Add Poll" to create your first interactive poll.', 'godam' ) }
									</p>
								) : (
									polls.map( ( poll, index ) => (
										<div key={ poll.id } className="border border-gray-200 rounded p-4 mb-4">
											<div className="flex justify-between items-center mb-3">
												<h4 className="font-medium">{ __( 'Poll', 'godam' ) } { index + 1 }</h4>
												<Button
													variant="link"
													isDestructive
													onClick={ () => removePoll( poll.id ) }
												>
													{ __( 'Remove', 'godam' ) }
												</Button>
											</div>

											<TextareaControl
												className="godam-textarea mb-3"
												label={ __( 'Poll Question', 'godam' ) }
												value={ poll.question || '' }
												onChange={ ( value ) => updatePoll( poll.id, 'question', value ) }
											/>

											<div className="mb-3">
												<div className="flex justify-between items-center mb-2">
													<label className="components-base-control__label">{ __( 'Poll Options', 'godam' ) }</label>
													<Button
														variant="tertiary"
														onClick={ () => addPollOption( poll.id ) }
														size="small"
													>
														{ __( 'Add Option', 'godam' ) }
													</Button>
												</div>

												{ poll.options?.map( ( option, optionIndex ) => (
													<div key={ option.id } className="flex gap-2 mb-2">
														<TextControl
															className="flex-1"
															placeholder={ __( 'Option text', 'godam' ) }
															value={ option.text || '' }
															onChange={ ( value ) => updatePollOption( poll.id, option.id, value ) }
														/>
														{ poll.options.length > 2 && (
															<Button
																variant="link"
																isDestructive
																onClick={ () => removePollOption( poll.id, option.id ) }
																size="small"
															>
																{ __( 'Remove', 'godam' ) }
															</Button>
														) }
													</div>
												) ) }
											</div>

											<ToggleControl
												className="godam-toggle mb-3"
												label={ __( 'Multiple Choice', 'godam' ) }
												help={ __( 'Allow users to select multiple options', 'godam' ) }
												checked={ poll.multiple_choice || false }
												onChange={ ( value ) => updatePoll( poll.id, 'multiple_choice', value ) }
											/>

											<ToggleControl
												className="godam-toggle mb-3"
												label={ __( 'Show Results', 'godam' ) }
												help={ __( 'Show poll results after voting', 'godam' ) }
												checked={ poll.show_results !== false }
												onChange={ ( value ) => updatePoll( poll.id, 'show_results', value ) }
											/>

											<RangeControl
												className="godam-range mb-3"
												label={ __( 'Poll Position (seconds)', 'godam' ) }
												help={ __( 'When this poll should appear in the video', 'godam' ) }
												value={ poll.position || 30 }
												onChange={ ( value ) => updatePoll( poll.id, 'position', value ) }
												min={ 1 }
												max={ 300 }
											/>

											<RangeControl
												className="godam-range"
												label={ __( 'Poll Duration (seconds)', 'godam' ) }
												help={ __( 'How long this poll should be displayed', 'godam' ) }
												value={ poll.duration || 15 }
												onChange={ ( value ) => updatePoll( poll.id, 'duration', value ) }
												min={ 5 }
												max={ 60 }
											/>
										</div>
									) )
								) }
							</div>
						</>
					)
				}
			</PanelBody>
		</Panel>
	);
};

export default PollsLayer;
