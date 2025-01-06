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
} from '@wordpress/components';
import {
	arrowLeft,
	trash,
	plus,
	chevronDown,
	chevronUp,
	chevronRight,
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

const HotspotLayer = ( { layerID, goBack } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	const hotspots = layer?.hotspots || [];

	// Delete modal
	const [ isDeleteModalOpen, setDeleteModalOpen ] = useState( false );
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

	return (
		<>
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">
					{ __( 'Hotspot Layer at', 'transcoder' ) } { layer.displayTime }s
				</p>
				<Button
					icon={ trash }
					isDestructive
					onClick={ () => setDeleteModalOpen( true ) }
				/>
				{ isDeleteModalOpen && (
					<Modal
						title={ __( 'Delete Hotspot Layer', 'transcoder' ) }
						onRequestClose={ () => setDeleteModalOpen( false ) }
					>
						<div className="flex justify-between items-center gap-3">
							<Button
								className="w-full justify-center"
								isDestructive
								variant="primary"
								onClick={ () => {
									handleDeleteLayer();
									setDeleteModalOpen( false );
								} }
							>
								{ __( 'Delete Layer', 'transcoder' ) }
							</Button>
							<Button
								className="w-full justify-center"
								variant="secondary"
								onClick={ () => setDeleteModalOpen( false ) }
							>
								{ __( 'Cancel', 'transcoder' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>

			{ /* Duration */ }
			<div className="mb-4">
				<TextControl
					label={ __( 'Layer Duration (seconds)', 'transcoder' ) }
					type="number"
					min="1"
					value={ layer?.duration || '' }
					onChange={ ( val ) => {
						const newVal = parseInt( val, 10 ) || 0;
						updateField( 'duration', newVal );
					} }
					help="Duration (in seconds) this layer will stay visible"
				/>
			</div>

			{ /* Pause on hover */ }
			<div className="mb-4">
				<ToggleControl
					label={ __( 'Pause video on hover', 'transcoder' ) }
					checked={ layer?.pauseOnHover || false }
					onChange={ ( isChecked ) => updateField( 'pauseOnHover', isChecked ) }
				/>
				<p className="text-xs text-gray-500 mt-1">
					{ __(
						'Player will pause the video while the layer is displayed and users hover over the hotspots.',
						'transcoder',
					) }
				</p>
			</div>

			{ /* Hotspots list */ }
			<div className="flex flex-col gap-4">
				{ hotspots.map( ( hotspot, index ) => (
					<div key={ hotspot.id } className="p-2 border rounded">
						<div className="flex justify-between items-center">
							<Button
								icon={ expandedHotspotIndex === index ? chevronUp : chevronDown }
								className="flex-1 text-left"
								onClick={ () => toggleHotspotExpansion( index ) }
							>
								{ `Hotspot ${ index + 1 }` }
							</Button>
							<DropdownMenu
								icon={ moreVertical }
								label={ `Hotspot ${ index + 1 } options` }
								toggleProps={ { 'aria-label': `Options for Hotspot ${ index + 1 }` } }
							>
								{ () => (
									<>
										<MenuItem
											icon={ hotspot.showStyle ? check : '' }
											onClick={ () => {
												updateField(
													'hotspots',
													hotspots.map( ( h2, j ) =>
														j === index
															? {
																...h2,
																showStyle: ! h2.showStyle,
																showIcon: ! h2.showStyle ? false : h2.showIcon,
																icon: ! h2.showStyle ? '' : h2.icon,
															}
															: h2,
													),
												);
											} }
										>
											{ __( 'Show Style', 'transcoder' ) }
										</MenuItem>
										<MenuItem
											icon={ hotspot.showIcon ? check : '' }
											onClick={ () => {
												updateField(
													'hotspots',
													hotspots.map( ( h2, j ) =>
														j === index
															? {
																...h2,
																showIcon: ! h2.showIcon, // Enable icon
																showStyle: ! h2.showIcon ? false : h2.showStyle, // Disable style
															}
															: h2,
													),
												);
											} }
										>
											{ __( 'Show Icon', 'transcoder' ) }
										</MenuItem>
										<MenuItem
											icon={ trash }
											onClick={ () => handleDeleteHotspot( index ) }
											className="text-red-500"
										>
											{ __( 'Delete Hotspot', 'transcoder' ) }
										</MenuItem>
									</>
								) }
							</DropdownMenu>
						</div>

						{ expandedHotspotIndex === index && (
							<div className="mt-3">
								<TextControl
									label={ __( 'Tooltip Text', 'transcoder' ) }
									placeholder="Click Me!"
									value={ hotspot.tooltipText }
									onChange={ ( val ) =>
										updateField(
											'hotspots',
											hotspots.map( ( h2, j ) =>
												j === index ? { ...h2, tooltipText: val } : h2,
											),
										)
									}
								/>
								<TextControl
									label={ __( 'Link', 'transcoder' ) }
									placeholder="https://www.example.com"
									value={ hotspot.link }
									onChange={ ( val ) =>
										updateField(
											'hotspots',
											hotspots.map( ( h2, j ) =>
												j === index ? { ...h2, link: val } : h2,
											),
										)
									}
								/>
								{ hotspot.showIcon && (
									<div className="flex flex-col gap-2 mt-2">
										<FontAwesomeIconPicker
											hotspot={ hotspot }
											index={ index }
											updateField={ updateField }
											hotspots={ hotspots }
										/>
									</div>
								) }
								{ hotspot.showStyle && (
									<div className="flex flex-col gap-2 mt-2">
										<label
											htmlFor={ `hotspot-color-${ index }` }
											className="text-xs text-gray-700"
										>
											{ __( 'BACKGROUND COLOR', 'transcoder' ) }
										</label>
										<ColorPalette
											id={ `hotspot-color-${ index }` }
											value={ hotspot.backgroundColor || '#0c80dfa6' }
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
											enableAlpha
										/>
									</div>
								) }
							</div>
						) }
					</div>
				) ) }

				<Button
					isPrimary
					id="add-hotspot-btn"
					icon={ plus }
					iconPosition="left"
					onClick={ handleAddHotspot }
				>
					{ __( 'Add Hotspot', 'transcoder' ) }
				</Button>
			</div>

			{ /* The actual layer content */ }
			<LayerControls>
				<div
					ref={ containerRef }
					className="absolute inset-0 px-4 py-8 bg-white bg-opacity-70 my-auto"
					style={ { backgroundColor: layer.bg_color || 'transparent' } }
				>
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
				<Button
					className="absolute bottom-6 right-0"
					variant="primary"
					icon={ chevronRight }
					iconSize="18"
					iconPosition="right"
				>
					{ __( 'Next', 'transcoder' ) }
				</Button>
			</LayerControls>
		</>
	);
};

export default HotspotLayer;
