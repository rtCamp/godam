/**
 * External dependencies
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { trash } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';
import { layerTypes } from '../SidebarLayers';

/**
 * Header for the selected layer's configuration panel: an editable layer name,
 * a static "TYPE • time" subtitle, and a delete action. Shared by every layer
 * type. The timestamp is read-only here (it is set on the timeline / in the
 * layer's own trigger config), so the header is purely informational + naming.
 *
 * @param {Object}   param0           - Props passed to the LayersHeader component.
 * @param {Object}   param0.layer     - The layer object containing type and metadata.
 * @param {Function} param0.goBack    - Callback used to clear the selection after delete.
 * @param {string}   param0.layerName - Optional custom layer label for add-ons.
 *
 * @return {JSX.Element} The rendered LayersHeader component.
 */
const LayersHeader = ( { layer, goBack, layerName: customLayerName } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const dispatch = useDispatch();
	// Images have no timeline — every layer renders at 0s, so the timestamp is
	// meaningless there and the subtitle shows only the type label.
	const mediaType = useSelector( ( state ) => state.videoReducer.mediaType );
	const isTimelineMedia = mediaType !== 'image';

	/**
	 * Resolve the layer type label (e.g. "CTA", or the specific form integration).
	 */
	const layerTypeData = layerTypes.find( ( l ) => l.type === layer.type );
	const typeLabel = customLayerName || (
		'form' === layer.type
			? layerTypeData?.formType[ layer?.form_type ?? 'gravity' ]?.layerText
			: layerTypeData?.layerText
	) || '';

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	return (
		<>
			<div className="godam-ve-layer-head">
				<div className="godam-ve-layer-head__body">
					<input
						type="text"
						className="godam-ve-layer-head__name"
						value={ layer?.name ?? '' }
						placeholder={ __( 'Layer name', 'godam' ) }
						aria-label={ __( 'Layer name', 'godam' ) }
						onChange={ ( e ) => dispatch( updateLayerField( { id: layer.id, field: 'name', value: e.target.value } ) ) }
					/>
					<p className="godam-ve-layer-head__subtitle">
						<span>{ typeLabel }</span>
						{ isTimelineMedia && (
							<>
								<span aria-hidden="true">•</span>
								<span>
									{ sprintf(
										/* translators: %s is the layer display time in seconds. */
										__( '%ss', 'godam' ),
										layer.displayTime,
									) }
								</span>
							</>
						) }
					</p>
				</div>

				<Button
					className="godam-ve-layer-head__delete"
					icon={ trash }
					isDestructive
					label={ __( 'Delete layer', 'godam' ) }
					onClick={ () => setOpen( true ) }
				/>

				{ isOpen && (
					<Modal
						title={ __( 'Delete layer', 'godam' ) }
						onRequestClose={ () => setOpen( false ) }
					>
						<div className="flex justify-between items-center gap-3">
							<Button
								variant="tertiary"
								className="w-full justify-center"
								onClick={ () => setOpen( false ) }
							>
								{ __( 'Cancel', 'godam' ) }
							</Button>
							<Button
								variant="primary"
								className="w-full justify-center"
								isDestructive
								onClick={ handleDeleteLayer }
							>
								{ __( 'Delete layer', 'godam' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>
		</>
	);
};

export default LayersHeader;
