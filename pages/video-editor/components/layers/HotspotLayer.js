/**
 * External dependencies
 */
import { Rnd } from 'react-rnd';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal, TextControl, DropdownMenu, MenuItem, ColorPalette } from '@wordpress/components';
import { arrowLeft, trash, plus, chevronDown, chevronUp, chevronRight, moreVertical, check } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useRef, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';
import LayerControls from '../LayerControls';

const HotspotLayer = ( { layerID, goBack } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	const hotspots = layer?.hotspots || [];
	const [ isDeleteModalOpen, setDeleteModalOpen ] = useState( false );
	const [ expandedHotspotIndex, setExpandedHotspotIndex ] = useState( null );

	const containerRef = useRef( null );

	// ratio {x, y} for px -> ratio
	const [ ratio, setRatio ] = useState( { x: 1, y: 1 } );

	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	};

	const pxToRatio = ( px, dimension ) => px * ratio[ dimension ];
	const ratioToPx = ( val, dimension ) => val / ratio[ dimension ];

	// Add a new hotspot with default position/size
	const handleAddHotspot = () => {
		const newHotspot = {
			id: uuidv4(),
			tooltipText: 'New Hotspot',
			link: '',
			position: { x: 50, y: 50 },
			size: { width: 48, height: 48 },
			oPosition: { x: 50, y: 50 },
			backgroundColor: '#0c80dfa6',
		};
		updateField( 'hotspots', [ ...hotspots, newHotspot ] );
	};

	const handleDeleteHotspot = ( index ) => {
		const updatedHotspots = hotspots.filter( ( _, i ) => i !== index );
		updateField( 'hotspots', updatedHotspots );
	};

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

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
					{ __( 'Hotspot Layer', 'transcoder' ) }
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

			<div className="mb-4">
				<TextControl
					label={ __( 'Layer Duration (seconds)', 'transcoder' ) }
					type="number"
					min="1"
					value={ layer?.duration || '' }
					onChange={ ( value ) => {
						const newValue = parseInt( value, 10 ) || 0;
						updateField( 'duration', newValue );
					} }
					help="Duration (in seconds) this layer will stay visible"
				/>
			</div>

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
													hotspots.map( ( h, i ) =>
														i === index
															? { ...h, showStyle: ! h.showStyle }
															: h,
													),
												);
											} }
										>
											Show Style
										</MenuItem>
										<MenuItem
											icon={ trash }
											onClick={ () => {
												handleDeleteHotspot( index );
											} }
											className="text-red-500"
										>
											Delete Hotspot
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
											hotspots.map( ( h, i ) =>
												i === index
													? { ...h, tooltipText: val }
													: h,
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
											hotspots.map( ( h, i ) =>
												i === index ? { ...h, link: val } : h,
											),
										)
									}
								/>
								{ hotspot.showStyle && (
									<div className="flex flex-col gap-2">
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
													hotspots.map( ( h, i ) =>
														i === index
															? { ...h, backgroundColor: newColor }
															: h,
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
								size={ hotspot.size }
								bounds="parent"
								maxWidth={ 100 }
								maxHeight={ 100 }
								minWidth={ 20 }
								minHeight={ 20 }
								lockAspectRatio
								onDragStop={ ( e, d ) => {
									const newHotspots = hotspots.map( ( h, i ) => {
										if ( i === index ) {
											return {
												...h,
												oPosition: {
													x: pxToRatio( d.x, 'x' ),
													y: pxToRatio( d.y, 'y' ),
												},
											};
										}
										return h;
									} );
									updateField( 'hotspots', newHotspots );
								} }
								onResizeStop={ ( e, direction, ref ) => {
									const newHotspots = hotspots.map( ( h, i ) => {
										if ( i === index ) {
											return {
												...h,
												size: {
													width: ref.offsetWidth,
													height: ref.offsetHeight,
												},
											};
										}
										return h;
									} );
									updateField( 'hotspots', newHotspots );
								} }
								onClick={ () => setExpandedHotspotIndex( index ) }
								className="hotspot circle"
								style={ {
									backgroundColor: hotspot.backgroundColor || '#0c80dfa6',
								} }
							>
								<div className="hotspot-content">
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
