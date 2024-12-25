/**
 * External dependencies
 */
import { Rnd } from 'react-rnd';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal, TextControl } from '@wordpress/components';
import { arrowLeft, trash, plus, chevronDown, chevronUp, chevronRight } from '@wordpress/icons';
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

	// Use a ref for the container in which Rnd is bounded
	const containerRef = useRef( null );

	// We'll store ratioX & ratioY in state
	const [ ratio, setRatio ] = useState( { x: 1, y: 1 } );

	// Helper to dispatch updates
	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	};

	// ---- Convert from px to ratio-based or ratio-based to px ----
	const pxToRatio = ( px, dimension ) => {
		// dimension is 'x' or 'y'
		return px * ratio[ dimension ];
	};

	const ratioToPx = ( val, dimension ) => {
		// dimension is 'x' or 'y'
		return val / ratio[ dimension ];
	};

	// Add a new hotspot with default original position/size
	const handleAddHotspot = () => {
		const newHotspot = {
			id: uuidv4(),
			tooltipText: 'New Hotspot',
			link: '',
			// Store pixel-based for initial states
			position: { x: 50, y: 50 },
			size: { width: 48, height: 48 },
			// Original positions in ratio form
			oPosition: { x: 50, y: 50 },
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

	// Recalculate ratio whenever container size changes
	const recalcRatio = () => {
		if ( containerRef.current ) {
			const { offsetWidth, offsetHeight } = containerRef.current;
			// Natural size of the video
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
				<p className="font-semibold">{ __( 'Hotspot Layer', 'transcoder' ) }</p>
				<Button icon={ trash } isDestructive onClick={ () => setDeleteModalOpen( true ) } />
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

			<div className="flex flex-col gap-4">
				{ hotspots.map( ( hotspot, index ) => (
					<div key={ hotspot.id } className="p-2 border rounded">
						<Button
							icon={ expandedHotspotIndex === index ? chevronUp : chevronDown }
							className="flex justify-between w-full"
							onClick={ () => toggleHotspotExpansion( index ) }
						>
							<div className="flex-1">
								{ `Hotspot ${ index + 1 }` }
							</div>
							<Button
								icon={ trash }
								isDestructive
								onClick={ ( e ) => {
									e.stopPropagation(); // Prevent triggering the expansion toggle
									handleDeleteHotspot( index );
								} }
							/>
						</Button>
						{ expandedHotspotIndex === index && (
							<div className="mt-3">
								<TextControl
									label={ __( 'Tooltip Text', 'transcoder' ) }
									placeholder="Click Me!"
									value={ hotspot.tooltipText }
									onChange={ ( value ) =>
										updateField(
											'hotspots',
											hotspots.map( ( h, i ) =>
												i === index ? { ...h, tooltipText: value } : h,
											),
										)
									}
								/>
								<TextControl
									label={ __( 'Link', 'transcoder' ) }
									placeholder="https://www.example.com"
									value={ hotspot.link }
									onChange={ ( value ) =>
										updateField(
											'hotspots',
											hotspots.map( ( h, i ) =>
												i === index ? { ...h, link: value } : h,
											),
										)
									}
								/>
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
												// Ensure we store back to oPosition
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
								onResizeStop={ ( e, direction, ref ) =>
									updateField(
										'hotspots',
										hotspots.map( ( h, i ) =>
											i === index
												? {
													...h,
													size: {
														width: ref.offsetWidth,
														height: ref.offsetHeight,
													},
												}
												: h,
										),
									)
								}
								className="hotspot circle"
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
