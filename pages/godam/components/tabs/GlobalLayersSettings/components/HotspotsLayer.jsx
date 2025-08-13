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
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../redux/slice/media-settings.js';

const HotspotsLayer = () => {
	const dispatch = useDispatch();

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'hotspots', key, value } ) );
	};

	const placementOptions = [
		{ label: __( 'Start of video', 'godam' ), value: 'start' },
		{ label: __( 'Middle of video', 'godam' ), value: 'middle' },
		{ label: __( 'End of video', 'godam' ), value: 'end' },
		{ label: __( 'Throughout video', 'godam' ), value: 'throughout' },
	];

	const shapeOptions = [
		{ label: __( 'Circle', 'godam' ), value: 'circle' },
		{ label: __( 'Square', 'godam' ), value: 'square' },
		{ label: __( 'Rectangle', 'godam' ), value: 'rectangle' },
		{ label: __( 'Pin', 'godam' ), value: 'pin' },
	];

	const animationOptions = [
		{ label: __( 'None', 'godam' ), value: 'none' },
		{ label: __( 'Pulse', 'godam' ), value: 'pulse' },
		{ label: __( 'Bounce', 'godam' ), value: 'bounce' },
		{ label: __( 'Fade', 'godam' ), value: 'fade' },
	];

	// Add a new hotspot
	const addHotspot = () => {
		const currentHotspots = mediaSettings?.global_layers?.hotspots?.hotspots || [];
		const newHotspot = {
			id: Date.now(),
			title: __( 'New Hotspot', 'godam' ),
			description: '',
			x: 50, // Default position (percentage)
			y: 50,
			width: 40,
			height: 40,
			url: '',
			new_tab: true,
			start_time: 0,
			end_time: 10,
		};
		handleSettingChange( 'hotspots', [ ...currentHotspots, newHotspot ] );
	};

	// Remove a hotspot
	const removeHotspot = ( hotspotId ) => {
		const currentHotspots = mediaSettings?.global_layers?.hotspots?.hotspots || [];
		const updatedHotspots = currentHotspots.filter( hotspot => hotspot.id !== hotspotId );
		handleSettingChange( 'hotspots', updatedHotspots );
	};

	// Update a specific hotspot
	const updateHotspot = ( hotspotId, key, value ) => {
		const currentHotspots = mediaSettings?.global_layers?.hotspots?.hotspots || [];
		const updatedHotspots = currentHotspots.map( hotspot => 
			hotspot.id === hotspotId ? { ...hotspot, [ key ]: value } : hotspot
		);
		handleSettingChange( 'hotspots', updatedHotspots );
	};

	const hotspots = mediaSettings?.global_layers?.hotspots?.hotspots || [];

	return (
		<Panel header={ __( 'Hotspots Layer', 'godam' ) } className="godam-panel">
			<PanelBody opened>
				<ToggleControl
					className="godam-toggle mb-4"
					label={ __( 'Enable Global Hotspots Layer', 'godam' ) }
					help={ __( 'Enable or disable interactive hotspots on all videos across the site', 'godam' ) }
					checked={ mediaSettings?.global_layers?.hotspots?.enabled || false }
					onChange={ ( value ) => handleSettingChange( 'enabled', value ) }
				/>

				{
					mediaSettings?.global_layers?.hotspots?.enabled && (
						<>
							<SelectControl
								className="godam-select mb-4"
								label={ __( 'Default Hotspot Shape', 'godam' ) }
								help={ __( 'Choose the default shape for new hotspots', 'godam' ) }
								value={ mediaSettings?.global_layers?.hotspots?.default_shape || 'circle' }
								options={ shapeOptions }
								onChange={ ( value ) => handleSettingChange( 'default_shape', value ) }
							/>

							<SelectControl
								className="godam-select mb-4"
								label={ __( 'Default Animation', 'godam' ) }
								help={ __( 'Choose the default animation for hotspots', 'godam' ) }
								value={ mediaSettings?.global_layers?.hotspots?.default_animation || 'pulse' }
								options={ animationOptions }
								onChange={ ( value ) => handleSettingChange( 'default_animation', value ) }
							/>

							<div className="mb-4">
								<label className="components-base-control__label">{ __( 'Default Hotspot Color', 'godam' ) }</label>
								<ColorPicker
									color={ mediaSettings?.global_layers?.hotspots?.default_color || '#ff0000' }
									onChange={ ( value ) => handleSettingChange( 'default_color', value ) }
								/>
							</div>

							<SelectControl
								className="godam-select mb-4"
								label={ __( 'Default Placement', 'godam' ) }
								help={ __( 'Choose when hotspots should appear by default', 'godam' ) }
								value={ mediaSettings?.global_layers?.hotspots?.placement || 'throughout' }
								options={ placementOptions }
								onChange={ ( value ) => handleSettingChange( 'placement', value ) }
							/>

							<div className="border-t pt-4 mt-6">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg font-medium">{ __( 'Global Hotspots', 'godam' ) }</h3>
									<Button
										variant="secondary"
										onClick={ addHotspot }
									>
										{ __( 'Add Hotspot', 'godam' ) }
									</Button>
								</div>

								{ hotspots.length === 0 ? (
									<p className="text-gray-600">
										{ __( 'No hotspots added yet. Click "Add Hotspot" to create your first interactive hotspot.', 'godam' ) }
									</p>
								) : (
									hotspots.map( ( hotspot, index ) => (
										<div key={ hotspot.id } className="border border-gray-200 rounded p-4 mb-4">
											<div className="flex justify-between items-center mb-3">
												<h4 className="font-medium">{ __( 'Hotspot', 'godam' ) } { index + 1 }</h4>
												<Button
													variant="link"
													isDestructive
													onClick={ () => removeHotspot( hotspot.id ) }
												>
													{ __( 'Remove', 'godam' ) }
												</Button>
											</div>

											<TextControl
												className="godam-input mb-3"
												label={ __( 'Title', 'godam' ) }
												value={ hotspot.title || '' }
												onChange={ ( value ) => updateHotspot( hotspot.id, 'title', value ) }
											/>

											<TextareaControl
												className="godam-textarea mb-3"
												label={ __( 'Description', 'godam' ) }
												help={ __( 'Optional description or tooltip text', 'godam' ) }
												value={ hotspot.description || '' }
												onChange={ ( value ) => updateHotspot( hotspot.id, 'description', value ) }
											/>

											<TextControl
												className="godam-input mb-3"
												label={ __( 'URL', 'godam' ) }
												help={ __( 'Optional link when hotspot is clicked', 'godam' ) }
												value={ hotspot.url || '' }
												onChange={ ( value ) => updateHotspot( hotspot.id, 'url', value ) }
												type="url"
											/>

											{ hotspot.url && (
												<ToggleControl
													className="godam-toggle mb-3"
													label={ __( 'Open in New Tab', 'godam' ) }
													checked={ hotspot.new_tab || false }
													onChange={ ( value ) => updateHotspot( hotspot.id, 'new_tab', value ) }
												/>
											) }

											<div className="grid grid-cols-2 gap-3">
												<RangeControl
													label={ __( 'X Position (%)', 'godam' ) }
													value={ hotspot.x || 50 }
													onChange={ ( value ) => updateHotspot( hotspot.id, 'x', value ) }
													min={ 0 }
													max={ 100 }
												/>

												<RangeControl
													label={ __( 'Y Position (%)', 'godam' ) }
													value={ hotspot.y || 50 }
													onChange={ ( value ) => updateHotspot( hotspot.id, 'y', value ) }
													min={ 0 }
													max={ 100 }
												/>

												<RangeControl
													label={ __( 'Start Time (s)', 'godam' ) }
													value={ hotspot.start_time || 0 }
													onChange={ ( value ) => updateHotspot( hotspot.id, 'start_time', value ) }
													min={ 0 }
													max={ 300 }
												/>

												<RangeControl
													label={ __( 'End Time (s)', 'godam' ) }
													value={ hotspot.end_time || 10 }
													onChange={ ( value ) => updateHotspot( hotspot.id, 'end_time', value ) }
													min={ 1 }
													max={ 300 }
												/>
											</div>
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

export default HotspotsLayer;
