/**
 * WordPress dependencies
 */
import {
	Button,
	PanelBody,
	ToggleControl,
} from '@wordpress/components';
import {
	BlockControls,
	InspectorControls,
	MediaUpload,
	MediaUploadCheck,
	MediaReplaceFlow,
	useBlockProps,
} from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as noticesStore } from '@wordpress/notices';
import { useEffect, useMemo, useRef } from '@wordpress/element';
import { plus, trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { CustomizeVideoIcon } from '../godam-player/icons';
import { initImageFrame } from '../../js/godam-image-layers/render-image-frame.js';
import './editor.scss';

const ALLOWED_MEDIA_TYPES = [ 'image' ];

/**
 * Edit component for the GoDAM Image block.
 *
 * Lets the author pick an image attachment and toggle whether the hotspot /
 * product layers authored in the GoDAM image editor are overlaid on the front
 * end. The layers themselves are rendered server-side (render.php) + a shared
 * front-end script; the editor canvas just previews the image.
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Attribute setter.
 * @param {boolean}  props.isSelected    Whether the block is selected.
 * @return {JSX.Element} The rendered edit UI.
 */
function ImageEdit( { attributes, setAttributes, isSelected } ) {
	const { id, url, alt, showImageLayers } = attributes;
	const { createErrorNotice } = useDispatch( noticesStore );

	// After a GoDAM-tab upload the media frame first sets a placeholder id and
	// then dispatches this event with the real numeric attachment id; swap it in
	// so the front-end render resolves layers by attachment id (mirrors the
	// audio/video blocks).
	useEffect( () => {
		const handleVirtualAttachmentCreated = ( event ) => {
			const { attachment, virtualMediaId } = event.detail || {};
			if ( attachment && ( id === undefined || id === virtualMediaId ) ) {
				setAttributes( { id: attachment.id } );
			}
		};
		document.addEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );
		return () => {
			document.removeEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );
		};
	}, [ id, setAttributes ] );

	// The GoDAM image editor is the shared editor shell opened by attachment id.
	// Relative to /wp-admin/ so it works in any install path; new tab so block
	// edits aren't lost.
	const editorUrl = id ? `admin.php?page=rtgodam_media_editor&id=${ id }` : '';

	function onSelectImage( media ) {
		if ( ! media || ! media.url ) {
			setAttributes( { id: undefined, url: undefined, alt: '', width: undefined, height: undefined } );
			return;
		}

		// Derive the type from the MIME string (media.type is the REST post type
		// "attachment" for fresh uploads, which would reject valid images).
		const mediaType = ( media.mime || media.mime_type || '' ).split( '/' )[ 0 ];
		if ( mediaType && mediaType !== 'image' ) {
			createErrorNotice(
				__( 'Only image files are allowed in the GoDAM Image block.', 'godam' ),
				{ type: 'snackbar' },
			);
			return;
		}

		setAttributes( {
			id: media.id,
			url: media.url,
			alt: typeof media.alt === 'string' ? media.alt : ( media.alt_text ?? '' ),
			width: media.width || media?.sizes?.full?.width || undefined,
			height: media.height || media?.sizes?.full?.height || undefined,
		} );
	}

	const blockProps = useBlockProps( { className: 'godam-image' } );
	const hasImage = !! url;

	// Fetch the attachment's authored layers so the editor canvas can preview the
	// same hotspot / product-hotspot overlays the front end renders. rtgodam_meta
	// is exposed as a REST field on attachments (see Meta_Rest_Fields).
	const rtgodamMeta = useSelect(
		( select ) => ( id ? select( coreStore ).getEntityRecord( 'postType', 'attachment', id )?.rtgodam_meta : null ),
		[ id ],
	);

	// Keep only drawable layers (mirror render.php): hotspot layers with hotspots
	// and Woo layers with product hotspots.
	const layers = useMemo( () => {
		const all = ( rtgodamMeta && Array.isArray( rtgodamMeta.layers ) ) ? rtgodamMeta.layers : [];
		return all.filter( ( layer ) => {
			if ( ! layer || ! layer.type ) {
				return false;
			}
			if ( 'hotspot' === layer.type ) {
				return Array.isArray( layer.hotspots ) && layer.hotspots.length > 0;
			}
			if ( 'woo' === layer.type ) {
				return Array.isArray( layer.productHotspots ) && layer.productHotspots.length > 0;
			}
			return false;
		} );
	}, [ rtgodamMeta ] );

	const showLayers = !! showImageLayers && layers.length > 0;
	const layersJson = useMemo( () => JSON.stringify( layers ), [ layers ] );
	const instanceId = useMemo( () => `img_editor_${ Math.random().toString( 36 ).slice( 2, 10 ) }`, [] );
	const frameRef = useRef( null );

	// Draw (and redraw) the layers onto the editor-canvas frame whenever the
	// image or layers change. The canvas is an iframe; the ref points at the real
	// node inside it, and initImageFrame() draws directly onto that node — the
	// same renderer the front end uses (Woo hotspots included, when the woo add-on
	// registers its manager). We reset the render guard + overlay so edits redraw.
	useEffect( () => {
		const frame = frameRef.current;
		if ( ! frame || ! showLayers ) {
			return;
		}
		frame.dataset.godamLayersRendered = '';
		const overlay = frame.querySelector( '.godam-image-layer' );
		if ( overlay ) {
			overlay.innerHTML = '';
		}
		initImageFrame( frame );
	}, [ showLayers, layersJson, url, instanceId ] );

	// The inspector "Image Selection" panel mirrors the GoDAM Video block: an
	// outlined "Add Image" button when empty, or a "Customize Image" button plus
	// the selected-media row once an image is chosen.
	const imageSelectionPanelContent = ! hasImage ? (
		<MediaUploadCheck>
			<MediaUpload
				onSelect={ onSelectImage }
				allowedTypes={ ALLOWED_MEDIA_TYPES }
				accept="image/*"
				render={ ( { open } ) => (
					<Button
						onClick={ open }
						icon={ plus }
						className="godam-image-selection__add-btn"
						data-test-id="godam-image-button-add-image"
					>
						{ __( 'Add Image', 'godam' ) }
					</Button>
				) }
			/>
		</MediaUploadCheck>
	) : (
		<>
			{ id && (
				<Button
					href={ editorUrl }
					target="_blank"
					rel="noopener noreferrer"
					className="godam-image-selection__customize-btn"
					icon={ CustomizeVideoIcon }
					iconSize={ 14 }
					data-test-id="godam-image-button-edit"
				>
					{ __( 'Customize Image', 'godam' ) }
				</Button>
			) }
			<div className="godam-image-selection__item">
				<img
					src={ url }
					alt=""
					className="godam-image-selection__item-thumbnail"
				/>
				<span className="godam-image-selection__item-title">
					{ alt || url }
				</span>
				<Button
					icon={ trash }
					iconSize={ 16 }
					label={ __( 'Remove image', 'godam' ) }
					onClick={ () => onSelectImage( undefined ) }
					className="godam-image-selection__item-delete"
					data-test-id="godam-image-button-remove"
				/>
			</div>
		</>
	);

	return (
		<>
			{ isSelected && hasImage && (
				<BlockControls group="other">
					<MediaReplaceFlow
						mediaId={ id }
						mediaURL={ url }
						allowedTypes={ ALLOWED_MEDIA_TYPES }
						accept="image/*"
						onSelect={ onSelectImage }
						onReset={ () => onSelectImage( undefined ) }
					/>
				</BlockControls>
			) }

			<InspectorControls>
				<PanelBody title={ __( 'Image Selection', 'godam' ) } data-test-id="godam-image-panel-image-selection">
					<p className="godam-image-selection__description">
						{ __( 'Add hotspot and product layers to make your image stand out.', 'godam' ) }
					</p>
					{ imageSelectionPanelContent }
					{ hasImage && (
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-image-selection__toggle"
							label={ __( 'Show image layers', 'godam' ) }
							checked={ !! showImageLayers }
							onChange={ ( value ) => setAttributes( { showImageLayers: value } ) }
							help={ __( 'Overlays the hotspot / product layers authored in the GoDAM image editor.', 'godam' ) }
							data-test-id="godam-image-control-show-layers"
						/>
					) }
				</PanelBody>
			</InspectorControls>

			{ ! hasImage ? (
				<div { ...blockProps } data-test-id="godam-image-canvas-placeholder">
					<div className="godam-image-add-placeholder">
						<div className="godam-image-add-placeholder__preview" />
						<h2 className="godam-image-add-placeholder__title">
							{ __( 'Add Image Here', 'godam' ) }
						</h2>
						<p className="godam-image-add-placeholder__description">
							{ __( 'Upload or select an image from your media library to get started.', 'godam' ) }
						</p>
						<MediaUploadCheck>
							<MediaUpload
								onSelect={ onSelectImage }
								allowedTypes={ ALLOWED_MEDIA_TYPES }
								accept="image/*"
								render={ ( { open } ) => (
									<Button
										onClick={ open }
										icon={ plus }
										variant="primary"
										className="godam-image-add-placeholder__btn"
										data-test-id="godam-image-button-upload"
									>
										{ __( 'Add Image', 'godam' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
					</div>
				</div>
			) : (
				<figure { ...blockProps } data-test-id="godam-image-canvas">
					{ showLayers ? (
						<div
							className="godam-image__frame"
							ref={ frameRef }
							data-id={ id }
							data-instance-id={ instanceId }
							data-godam-image-layers={ layersJson }
							style={ { position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0 } }
						>
							<img
								className="godam-image__img"
								src={ url }
								alt={ alt || '' }
								style={ { display: 'block', width: '100%', height: 'auto' } }
							/>
							<div className="easydam-layer hotspot-layer godam-image-layer"></div>
						</div>
					) : (
						<div className="godam-image__frame">
							<img className="godam-image__img" src={ url } alt={ alt || '' } />
						</div>
					) }
				</figure>
			) }
		</>
	);
}

export default ImageEdit;
