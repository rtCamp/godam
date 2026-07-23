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
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { useEffect } from '@wordpress/element';
import { plus, trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { CustomizeVideoIcon } from '../godam-player/icons';
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
					<div className="godam-image__frame">
						<img className="godam-image__img" src={ url } alt={ alt || '' } />
					</div>
				</figure>
			) }
		</>
	);
}

export default ImageEdit;
