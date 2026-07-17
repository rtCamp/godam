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
import { edit as editIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
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
	const editorUrl = id ? `admin.php?page=rtgodam_video_editor&id=${ id }` : '';

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

	// ── Empty state ───────────────────────────────────────────────────────────
	if ( ! hasImage ) {
		return (
			<figure { ...blockProps } data-test-id="godam-image-canvas-placeholder">
				<div className="godam-image-empty">
					<h3 className="godam-image-empty__title">{ __( 'Add an image', 'godam' ) }</h3>
					<p className="godam-image-empty__subtitle">
						{ __( 'Select an image to overlay GoDAM hotspot and product layers.', 'godam' ) }
					</p>
					<MediaUploadCheck>
						<MediaUpload
							onSelect={ onSelectImage }
							allowedTypes={ ALLOWED_MEDIA_TYPES }
							accept="image/*"
							render={ ( { open } ) => (
								<Button
									variant="primary"
									onClick={ open }
									className="godam-image-empty__btn"
									data-test-id="godam-image-button-upload"
								>
									{ __( '+ Select Image', 'godam' ) }
								</Button>
							) }
						/>
					</MediaUploadCheck>
				</div>
			</figure>
		);
	}

	// ── Has image ─────────────────────────────────────────────────────────────
	return (
		<>
			{ isSelected && (
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
				<PanelBody title={ __( 'Image Layers', 'godam' ) } initialOpen={ true } data-test-id="godam-image-panel-layers">
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show image layers', 'godam' ) }
						checked={ !! showImageLayers }
						onChange={ ( value ) => setAttributes( { showImageLayers: value } ) }
						help={ __( 'Overlays the hotspot / product layers authored in the GoDAM image editor.', 'godam' ) }
						data-test-id="godam-image-control-show-layers"
					/>
					{ id && (
						<Button
							__next40pxDefaultSize
							variant="secondary"
							href={ editorUrl }
							target="_blank"
							rel="noopener noreferrer"
							icon={ editIcon }
							className="godam-image__btn"
							data-test-id="godam-image-button-edit"
						>
							{ __( 'Edit in GoDAM', 'godam' ) }
						</Button>
					) }
				</PanelBody>
			</InspectorControls>

			<figure { ...blockProps } data-test-id="godam-image-canvas">
				<div className="godam-image__frame">
					<img className="godam-image__img" src={ url } alt={ alt || '' } />
				</div>
			</figure>
		</>
	);
}

export default ImageEdit;
