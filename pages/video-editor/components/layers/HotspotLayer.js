/**
 * External dependencies
 */
import { Rnd } from 'react-rnd';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal, TextControl } from '@wordpress/components';
import { arrowLeft, trash, plus } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';

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

	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	};

	const handleAddHotspot = () => {
		const newHotspot = {
			id: uuidv4(),
			tooltipText: 'New Hotspot',
			position: { x: 50, y: 50 },
			size: { width: 48, height: 48 },
			link: '',
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

	return (
		<>
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">{ __( 'Hotspot Layer', 'transcoder' ) }</p>
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

			<div className="flex flex-col gap-4">
				<Button icon={ plus } isPrimary onClick={ handleAddHotspot }>
					{ __( 'Add Hotspot', 'transcoder' ) }
				</Button>

				{ /* Render and Edit Existing Hotspots */ }
				{ hotspots.map( ( hotspot, index ) => (
					<div key={ hotspot.id } className="p-2 border rounded">
						<h4>{ `Hotspot ${ index + 1 }` }</h4>
						<TextControl
							label={ __( 'Tooltip Text', 'transcoder' ) }
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
						<Button
							isDestructive
							onClick={ () => handleDeleteHotspot( index ) }
						>
							{ __( 'Delete', 'transcoder' ) }
						</Button>
					</div>
				) ) }
			</div>

			{ /* Render Hotspots on Video */ }
			<LayerControls>
				<div
					className="absolute inset-0 px-4 py-8 bg-white bg-opacity-70 my-auto"
					style={ { backgroundColor: layer.bg_color || 'transparent' } }
				>
					{ hotspots.map( ( hotspot, index ) => (
						<Rnd
							key={ hotspot.id }
							position={ hotspot.position }
							size={ hotspot.size }
							bounds="parent"
							maxWidth={ 100 }
							maxHeight={ 100 }
							minWidth={ 20 }
							minHeight={ 20 }
							lockAspectRatio
							onDragStop={ ( e, d ) =>
								updateField(
									'hotspots',
									hotspots.map( ( h, i ) =>
										i === index ? { ...h, position: { x: d.x, y: d.y } } : h,
									),
								)
							}
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
										<span style={ { color: '#fff' } }>{ hotspot.tooltipText }</span>
									) }
								</div>
							</div>
						</Rnd>
					) ) }
				</div>
			</LayerControls>
		</>
	);
};

export default HotspotLayer;
