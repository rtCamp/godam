/**
 * External dependencies
 */
import { Rnd } from 'react-rnd';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Button,
	Modal,
	TextControl,
	ToggleControl,
	DropdownMenu,
	MenuItem,
	ColorPalette,
	Notice,
	Panel,
	PanelBody,
	SelectControl,
} from '@wordpress/components';
import {
	arrowLeft,
	trash,
	plus,
	chevronDown,
	chevronUp,
	moreVertical,
	check,
} from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useRef, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';
import LayerControls from '../LayerControls';
import FontAwesomeIconPicker from '../hotspot/FontAwesomeIconPicker';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ColorPickerButton from '../ColorPickerButton';

const HotspotLayer = ( { layerID, goBack } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	const hotspots = layer?.hotspots || [];

	// Delete modal
	const [ isOpen, setOpen ] = useState( false );
	// Track expanded hotspot
	const [ expandedHotspotIndex, setExpandedHotspotIndex ] = useState( null );

	const containerRef = useRef( null );

	// ratio { x, y } for px <-> ratio
	const [ ratio, setRatio ] = useState( { x: 1, y: 1 } );

	// Helper to dispatch updates
	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	};

	const pxToRatio = ( px, dimension ) => px * ratio[ dimension ];
	const ratioToPx = ( val, dimension ) => val / ratio[ dimension ];

	// Add a new hotspot
	const handleAddHotspot = () => {
		const newHotspot = {
			id: uuidv4(),
			tooltipText: 'New Hotspot',
			link: '',
			position: { x: 50, y: 50 },
			size: { diameter: 48 },
			oSize: { diameter: 48 },
			oPosition: { x: 50, y: 50 },
			backgroundColor: '#0c80dfa6',
			icon: '',
		};
		updateField( 'hotspots', [ ...hotspots, newHotspot ] );
	};

	const handleDeleteHotspot = ( index ) => {
		updateField(
			'hotspots',
			hotspots.filter( ( _, i ) => i !== index ),
		);
	};

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	// Expand/hide a hotspot’s panel
	const toggleHotspotExpansion = ( index ) => {
		setExpandedHotspotIndex( expandedHotspotIndex === index ? null : index );
	};

	const recalcRatio = () => {
		if ( containerRef.current ) {
			const { offsetWidth, offsetHeight } = containerRef.current;
			const baseWidth = 800;
			const baseHeight = 600;

			setRatio( {
				x: baseWidth / offsetWidth,
				y: baseHeight / offsetHeight,
			} );
		}
	};

	useEffect( () => {
		recalcRatio();
		window.addEventListener( 'resize', recalcRatio );
		return () => window.removeEventListener( 'resize', recalcRatio );
	}, [] );

	// If we want to disable the premium layers the we can use this code
	// const isValidLicense = window?.videoData?.valid_license;

	// For now we are enabling all the features
	const isValidLicense = true;

	return (
		<>
			<div className="flex justify-between items-center border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="text-base">{ __( 'Hotspot layer at', 'godam' ) } { layer.displayTime }s</p>
				<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
				{ isOpen && (
					<Modal title={ __( 'Delete layer', 'godam' ) } onRequestClose={ () => setOpen( false ) }>
						<div className="flex justify-between items-center gap-3">
							<Button className="w-full justify-center" isDestructive variant="primary" onClick={ handleDeleteLayer }>
								{ __( 'Delete layer', 'godam' ) }
							</Button>
							<Button className="w-full justify-center" variant="secondary" onClick={ () => setOpen( false ) }>
								{ __( 'Cancel', 'godam' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>

			{
				! isValidLicense &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'This features is available in premium version', 'godam' ) }
				</Notice>
			}

			{ /* Duration */ }
			<div className="mb-4">
				<TextControl
					label={ __( 'Layer Duration (seconds)', 'godam' ) }
					className="godam-input"
					type="number"
					min="1"
					value={ layer?.duration || '' }
					onChange={ ( val ) => {
						const newVal = parseInt( val, 10 ) || 0;
						updateField( 'duration', newVal );
					} }
					help="Duration this layer will stay visible for."
					disabled={ ! isValidLicense }
				/>
			</div>

			{ /* Pause on hover */ }
			<div className="mb-4">
				<ToggleControl
					className="godam-toggle"
					label={ __( 'Pause video on hover', 'godam' ) }
					checked={ layer?.pauseOnHover || false }
					onChange={ ( isChecked ) => updateField( 'pauseOnHover', isChecked ) }
					disabled={ ! isValidLicense }
				/>
				<p className="text-md text-gray-500 mt-2">
					{ __(
						'Player will pause the video while the layer is displayed and users hover over the hotspots.',
						'godam',
					) }
				</p>
			</div>

			{ /* Hotspots List */ }
			<div className="flex flex-col">
				{ hotspots.map( ( hotspot, index ) => (
					<Panel
						key={ hotspot.id }
						className="-mx-4 border-x-0 godam-advance-panel"
					>
						<PanelBody
							title={ `Hotspot ${ index + 1 }` }
							initialOpen={ false }
						>
							<TextControl
								label={ __( 'Tooltip Text', 'godam' ) }
								placeholder="Click Me!"
								className="godam-input mb-4"
								value={ hotspot.tooltipText }
								onChange={ ( val ) =>
									updateField(
										'hotspots',
										hotspots.map( ( h2, j ) =>
											j === index ? { ...h2, tooltipText: val } : h2,
										),
									)
								}
								disabled={ ! isValidLicense }
							/>
							<TextControl
								label={ __( 'URL', 'godam' ) }
								placeholder="https://www.example.com"
								className="godam-input"
								value={ hotspot.link }
								onChange={ ( val ) =>
									updateField(
										'hotspots',
										hotspots.map( ( h2, j ) =>
											j === index ? { ...h2, link: val } : h2,
										),
									)
								}
								disabled={ ! isValidLicense }
							/>
							<SelectControl
								label={ __( 'Style', 'godam' ) }
								className="godam-select"
								options={ [
									{ label: 'Color', value: 'color' },
									{ label: 'Icon', value: 'icon' },
								] }
								value={ hotspot.showIcon ? 'icon' : 'color' }
								onChange={ ( val ) => {
									updateField(
										'hotspots',
										hotspots.map( ( h2, j ) =>
											j === index
												? {
													...h2,
													showStyle: val === 'color',
													showIcon: val === 'icon',
												}
												: h2,
										),
									);
								} }
							/>
							{ ( hotspot.showStyle || ! hotspot.showIcon ) && (
								<div className="flex flex-col gap-2 mt-2">
									<label
										htmlFor={ `hotspot-color-${ index }` }
										className="godam-label"
									>
										{ __( 'Color', 'godam' ) }
									</label>

									<ColorPickerButton
										id={ `hotspot-color-${ index }` }
										value={ hotspot.backgroundColor || '#0c80dfa6' }
										label={ hotspot.backgroundColor || '#0c80dfa6' }
										onChange={ ( newColor ) => {
											updateField(
												'hotspots',
												hotspots.map( ( h2, j ) =>
													j === index
														? {
															...h2,
															backgroundColor: newColor,
														}
														: h2,
												),
											);
										} }
										enableAlpha={ true }
									/>
								</div>
							) }
							{ hotspot.showIcon && (
								<div className="flex flex-col gap-2 mt-2">
									<FontAwesomeIconPicker
										hotspot={ hotspot }
										index={ index }
										updateField={ updateField }
										hotspots={ hotspots }
										disabled={ ! isValidLicense }
									/>
								</div>
							) }

							<Button
								variant="secondary"
								className="mt-4 godam-button"
								isDestructive
								onClick={ () => handleDeleteHotspot( index ) }
							>
								{ __( 'Delete Hotspot', 'godam' ) }
							</Button>
						</PanelBody>
					</Panel>
				) ) }

				<div className="flex justify-center mt-4">
					<Button
						variant="primary"
						id="add-hotspot-btn"
						className="godam-button w-fit"
						icon={ plus }
						iconPosition="left"
						onClick={ handleAddHotspot }
						disabled={ ! isValidLicense }
					>
						{ __( 'Add Hotspot', 'godam' ) }
					</Button>
				</div>
			</div>

			{ /* The actual layer content */ }
			<LayerControls>
				<div
					ref={ containerRef }
					className="easydam-layer hotspot-layer"
					style={ { backgroundColor: layer.bg_color || 'transparent' } }
				>
					<div
						className="absolute inset-0 bg-transparent z-10 pointer-events-auto"
					></div>
					{ hotspots.map( ( hotspot, index ) => {
						const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
						const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;

						return (
							<Rnd
								key={ hotspot.id }
								position={ {
									x: ratioToPx( fallbackPosX, 'x' ),
									y: ratioToPx( fallbackPosY, 'y' ),
								} }
								size={ {
									width: ratioToPx(
										hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48,
										'x',
									),
									height: ratioToPx(
										hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48,
										'x',
									),
								} }
								bounds="parent"
								maxWidth={ 100 }
								maxHeight={ 100 }
								minWidth={ 20 }
								minHeight={ 20 }
								lockAspectRatio
								onDragStop={ ( e, d ) => {
									const newHotspots = hotspots.map( ( h2, j ) => {
										if ( j === index ) {
											return {
												...h2,
												oPosition: {
													x: pxToRatio( d.x, 'x' ),
													y: pxToRatio( d.y, 'y' ),
												},
											};
										}
										return h2;
									} );
									updateField( 'hotspots', newHotspots );
								} }
								onResizeStop={ ( e, direction, ref ) => {
									const newDiameterPx = ref.offsetWidth;
									const newHotspots = hotspots.map( ( h2, j ) => {
										if ( j === index ) {
											return {
												...h2,
												oSize: {
													diameter: pxToRatio( newDiameterPx, 'x' ),
												},
											};
										}
										return h2;
									} );
									updateField( 'hotspots', newHotspots );
								} }
								onClick={ () => setExpandedHotspotIndex( index ) }
								className="hotspot circle"
								style={ {
									backgroundColor: hotspot.icon ? 'white' : hotspot.backgroundColor || '#0c80dfa6',
								} }
							>
								<div className={ `hotspot-content flex items-center justify-center ${ ! hotspot.icon ? 'no-icon' : '' }` }>
									{ hotspot.icon ? (
										<FontAwesomeIcon
											icon={ [ 'fas', hotspot.icon ] }
											className="pointer-events-none"
											style={ {
												width: '50%',
												height: '50%',
												color: '#000',
											} }
										/>
									) : null }

									<span className="index">{ index + 1 }</span>

									<div className="hotspot-tooltip">
										{ hotspot.link ? (
											<a
												href={ hotspot.link }
												target="_blank"
												rel="noopener noreferrer"
											>
												{ hotspot.tooltipText }
											</a>
										) : (
											hotspot.tooltipText
										) }
									</div>
								</div>
							</Rnd>
						);
					} ) }
				</div>
			</LayerControls>
		</>
	);
};

export default HotspotLayer;
