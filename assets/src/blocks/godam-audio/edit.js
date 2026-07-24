/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { isBlobURL } from '@wordpress/blob';
import {
	Button,
	DropZone,
	Notice,
	PanelBody,
	SelectControl,
	Spinner,
	TextControl,
	TextareaControl,
	ToggleControl,
} from '@wordpress/components';
import {
	BlockControls,
	InspectorControls,
	MediaUpload,
	MediaUploadCheck,
	MediaReplaceFlow,
	useBlockProps,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { __, _x, sprintf } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { store as noticesStore } from '@wordpress/notices';
import { useState, useRef, useEffect } from '@wordpress/element';
import { plus, trash, edit as editIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { CustomizeVideoIcon } from '../godam-player/icons';
import AudioMiniPlayer from './player';
import AudioTabs from './tabs';
import './editor.scss';

const ALLOWED_MEDIA_TYPES = [ 'audio' ];
const ALLOWED_THUMBNAIL_TYPES = [ 'image' ];

/**
 * Format a byte count as a human-readable size (e.g. "84 KB").
 *
 * @param {number} bytes Byte count.
 * @return {string} Formatted size, or '' when unknown.
 */
const formatBytes = ( bytes ) => {
	if ( ! bytes || Number.isNaN( bytes ) ) {
		return '';
	}
	const units = [ 'B', 'KB', 'MB', 'GB' ];
	let value = bytes;
	let unit = 0;
	while ( value >= 1024 && unit < units.length - 1 ) {
		value /= 1024;
		unit += 1;
	}
	return `${ value.toFixed( unit === 0 ? 0 : 1 ) } ${ units[ unit ] }`;
};

/**
 * Edit component for the GoDAM Audio block.
 *
 * @param {Object}   props               - The properties passed to the component.
 * @param {Object}   props.attributes    - The block attributes.
 * @param {string}   props.className     - The class name for the component for styling.
 * @param {Function} props.setAttributes - Function to update the block's attributes.
 * @param {boolean}  props.isSelected    - Whether the block is currently selected.
 * @param {string}   props.clientId      - The block's client ID.
 *
 * @return {JSX.Element} The rendered audio block component.
 */
function AudioEdit( {
	attributes,
	className,
	setAttributes,
	isSelected: isSingleSelected,
	clientId,
} ) {
	const { id, autoplay, loop, preload, src, audioTitle, description, thumbnail, thumbnailId, showTranscript, showChapters } = attributes;
	const [ temporaryURL, setTemporaryURL ] = useState( attributes.blob );

	// Tracks the most recent audio selection so an in-flight thumbnail fetch can
	// discard its result if the user has since picked a different file.
	const latestThumbnailRequestId = useRef();

	// A GoDAM-tab selection first sets the block's id to the GoDAM (string) id,
	// then the media frame creates the backing WP attachment asynchronously and
	// dispatches this event with the real numeric id. Swap it in so chapters,
	// the transcript and the thumbnail resolve by attachment id (mirrors the
	// video block). Runs only for the placeholder/matching id, leaving native
	// WP audio untouched.
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

	// The customization editor (transcription + chapters) is the video editor in
	// audio mode, opened by attachment ID. Relative to /wp-admin/ so it works in
	// any install path; opened in a new tab so block edits aren't lost.
	const editorUrl = id ? `admin.php?page=rtgodam_media_editor&id=${ id }` : '';

	function toggleAttribute( attribute ) {
		return ( newValue ) => {
			setAttributes( { [ attribute ]: newValue } );
		};
	}

	const { createErrorNotice } = useDispatch( noticesStore );
	function onUploadError( message ) {
		createErrorNotice( message, { type: 'snackbar' } );
	}

	function getAutoplayHelp( checked ) {
		return checked
			? __( 'Autoplay may cause usability issues for some users.', 'godam' )
			: null;
	}

	function onSelectAudio( media ) {
		if ( ! media || ! media.url ) {
			setAttributes( {
				src: undefined,
				id: undefined,
				blob: undefined,
			} );
			setTemporaryURL();
			return;
		}

		// Guard against non-audio selections. Derive the type from the MIME
		// string rather than `media.type`: the latter is the top-level type
		// ("audio") for library selections but the REST post type
		// ("attachment") for freshly uploaded files, which would reject every
		// uploaded audio file. `mime` is set on library selections,
		// `mime_type` on uploads.
		const mediaType = ( media.mime || media.mime_type || '' ).split( '/' )[ 0 ];
		if ( mediaType && mediaType !== 'audio' ) {
			createErrorNotice(
				__( 'Only audio files are allowed in the GoDAM Audio block.', 'godam' ),
				{ type: 'snackbar' },
			);
			return;
		}

		if ( isBlobURL( media.url ) ) {
			setTemporaryURL( media.url );
			return;
		}

		// Normalize the description/title to strings. Library selections expose
		// them as plain strings, but freshly uploaded files come from the REST
		// API where each is an object ( { raw, rendered } ). Storing the object
		// would make React throw "Objects are not valid as a React child" when
		// the value is rendered (and PHP `esc_html()` warns on the frontend).
		const rawMediaDescription = typeof media.description === 'string'
			? media.description
			: ( media.description?.raw ?? media.description?.rendered ?? '' );
		// WordPress sometimes seeds an attachment's description with the raw
		// media URL; strip any URLs so the file path isn't shown as copy.
		const mediaDescription = rawMediaDescription
			.replace( /https?:\/\/\S+/g, '' )
			.replace( /\s+/g, ' ' )
			.trim();
		const mediaTitle = typeof media.title === 'string'
			? media.title
			: ( media.title?.raw ?? media.title?.rendered ?? '' );

		const nextAttributes = {
			blob: undefined,
			src: media.url,
			id: media.id,
			audioTitle: mediaTitle,
			description: mediaDescription,
		};

		// Auto-fill the thumbnail with the GoDAM cover on selection. GoDAM-tab
		// items carry it on the media model (`thumbnail_url`), so apply it in the
		// same batch. `thumbnailId` is cleared because the cover is an external
		// URL, not a WP image attachment.
		if ( media.origin === 'godam' && media.thumbnail_url ) {
			nextAttributes.thumbnail = media.thumbnail_url;
			nextAttributes.thumbnailId = undefined;
		}

		setAttributes( nextAttributes );
		setTemporaryURL();

		// Media Library-tab items are plain WP attachments — the cover is not on
		// the media model, so read it from the attachment's meta. This surfaces
		// the cover of an already-created virtual GoDAM audio picked from that tab;
		// a user-uploaded audio has no such meta, so nothing is overwritten.
		if ( media.origin !== 'godam' && media.id ) {
			const requestedId = media.id;
			latestThumbnailRequestId.current = requestedId;

			apiFetch( { path: `/wp/v2/media/${ media.id }` } )
				.then( ( response ) => {
					// Discard a stale response if a different file was selected
					// while this request was in flight.
					if ( latestThumbnailRequestId.current !== requestedId ) {
						return;
					}
					const audioThumbnail = response?.meta?.rtgodam_media_audio_thumbnail;
					if ( audioThumbnail ) {
						setAttributes( { thumbnail: audioThumbnail, thumbnailId: undefined } );
					}
				} )
				.catch( () => {} );
		}
	}

	function onRemoveAudio() {
		setAttributes( {
			src: undefined,
			id: undefined,
			blob: undefined,
			audioTitle: '',
			description: '',
			thumbnail: '',
			thumbnailId: undefined,
		} );
	}

	function onSelectThumbnail( media ) {
		if ( ! media || ! media.url ) {
			return;
		}
		// Derive the type from the MIME string; `media.type` is "attachment"
		// for freshly uploaded files and would reject valid image uploads.
		const mediaType = ( media.mime || media.mime_type || '' ).split( '/' )[ 0 ];
		if ( mediaType && mediaType !== 'image' ) {
			createErrorNotice(
				__( 'Only image files are allowed for the GoDAM Audio thumbnail.', 'godam' ),
				{ type: 'snackbar' },
			);
			return;
		}
		setAttributes( { thumbnail: media.url, thumbnailId: media.id } );
	}

	function onRemoveThumbnail() {
		setAttributes( { thumbnail: '', thumbnailId: undefined } );
	}

	const thumbnailButtonRef = useRef();
	const thumbnailDescriptionId = `godam-audio-thumbnail-description-${ clientId }`;
	const { getSettings } = useSelect( blockEditorStore );

	// Drag-and-drop upload for the thumbnail, mirroring core's poster control.
	function onDropThumbnail( filesList ) {
		getSettings().mediaUpload( {
			allowedTypes: ALLOWED_THUMBNAIL_TYPES,
			filesList,
			onFileChange: ( [ image ] ) => {
				if ( isBlobURL( image?.url ) ) {
					return;
				}
				if ( image ) {
					onSelectThumbnail( image );
				}
			},
			onError: onUploadError,
			multiple: false,
		} );
	}

	const hasAudio = !! ( src || temporaryURL );
	// Derive a display file name from the URL. `decodeURIComponent` throws on
	// malformed percent-encoding (e.g. a literal "%" in the file name), which
	// would crash the block during render, so fall back to the raw segment.
	let fileName = '';
	if ( src ) {
		const rawFileName = src.split( '/' ).pop().split( '?' )[ 0 ];
		try {
			fileName = decodeURIComponent( rawFileName );
		} catch {
			fileName = rawFileName;
		}
	}

	// The selected attachment's record, plus whether its lookup has finished.
	// `isMediaResolved` lets us distinguish "still loading" from "resolved to
	// nothing", so we only flag a deletion once the REST lookup has completed.
	const { audioMedia, isMediaResolved } = useSelect( ( select ) => {
		if ( ! id ) {
			return { audioMedia: null, isMediaResolved: false };
		}
		const core = select( 'core' );
		return {
			audioMedia: core.getMedia( id ),
			isMediaResolved: core.hasFinishedResolution( 'getMedia', [ id ] ),
		};
	}, [ id ] );
	const fileSize = formatBytes( audioMedia?.media_details?.filesize );

	// The attachment was deleted from the Media Library out from under the block:
	// its numeric id is still stored, the lookup has finished, yet no record came
	// back. `src` (and thus `hasAudio`) still holds the now-dangling URL, so surface
	// an error instead of rendering a player that points at a 404.
	const isAudioDeleted = Boolean( id ) && isMediaResolved && ! audioMedia;

	const classes = clsx( className, {
		'is-transient': !! temporaryURL,
	} );

	const blockProps = useBlockProps( { className: classes } );

	// Audio Selection panel content (matches the ToolsPanel design): an "Add
	// Audio File" button when empty, or a primary "Customize Audio" button, a
	// file row (icon + name + size + remove), plus Title and Description fields.
	const audioSelectionPanelContent = ( ! src && ! temporaryURL ) ? (
		<MediaUpload
			onSelect={ onSelectAudio }
			allowedTypes={ ALLOWED_MEDIA_TYPES }
			accept="audio/*"
			onError={ onUploadError }
			render={ ( { open } ) => (
				<Button
					__next40pxDefaultSize
					variant="secondary"
					onClick={ open }
					icon={ plus }
					className="godam-audio__btn"
					data-test-id="godam-audio-button-add-audio"
				>
					{ __( 'Add Audio File', 'godam' ) }
				</Button>
			) }
		/>
	) : (
		<>
			{ id && ! isAudioDeleted && (
				<Button
					__next40pxDefaultSize
					variant="primary"
					href={ editorUrl }
					target="_blank"
					rel="noopener noreferrer"
					icon={ CustomizeVideoIcon }
					iconSize={ 14 }
					className="godam-audio__btn"
					data-test-id="godam-audio-button-customize"
				>
					{ __( 'Customize Audio', 'godam' ) }
				</Button>
			) }

			<div className="godam-audio-file" data-test-id="godam-audio-file">
				<MediaUploadCheck>
					<MediaUpload
						onSelect={ onSelectAudio }
						allowedTypes={ ALLOWED_MEDIA_TYPES }
						accept="audio/*"
						value={ id }
						onError={ onUploadError }
						render={ ( { open } ) => (
							<button
								type="button"
								className="godam-audio-file__main"
								onClick={ open }
								aria-label={ __( 'Replace audio file', 'godam' ) }
								data-test-id="godam-audio-button-replace-audio"
							>
								<span className="godam-audio-file__icon">
									<span className="dashicons dashicons-media-default"></span>
								</span>
								<span className="godam-audio-file__meta">
									<span className="godam-audio-file__name" title={ fileName }>{ fileName }</span>
									{ fileSize && <span className="godam-audio-file__size">{ fileSize }</span> }
								</span>
							</button>
						) }
					/>
				</MediaUploadCheck>
				<Button
					icon={ trash }
					label={ __( 'Remove audio', 'godam' ) }
					onClick={ onRemoveAudio }
					className="godam-audio-file__delete"
					data-test-id="godam-audio-button-remove"
				/>
			</div>

			<TextControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Audio Title', 'godam' ) }
				placeholder={ __( 'Add a title…', 'godam' ) }
				value={ audioTitle }
				onChange={ ( value ) => setAttributes( { audioTitle: value } ) }
				data-test-id="godam-audio-control-title"
			/>

			<TextareaControl
				__nextHasNoMarginBottom
				label={ __( 'Description', 'godam' ) }
				placeholder={ __( 'Add a short description…', 'godam' ) }
				value={ description }
				onChange={ ( value ) => setAttributes( { description: value } ) }
				data-test-id="godam-audio-control-description"
			/>
		</>
	);

	// ── Empty state ───────────────────────────────────────────────────────────
	if ( ! hasAudio ) {
		return (
			<>
				<InspectorControls>
					<PanelBody title={ __( 'Audio Selection', 'godam' ) } initialOpen={ true } data-test-id="godam-audio-panel-selection">
						{ audioSelectionPanelContent }
					</PanelBody>
				</InspectorControls>

				<figure { ...blockProps } data-test-id="godam-audio-canvas-placeholder">
					<div className="godam-audio-empty">
						<h3 className="godam-audio-empty__title">
							{ __( 'Add an audio file', 'godam' ) }
						</h3>
						<p className="godam-audio-empty__subtitle">
							{ __( 'Upload an audio file to embed a player on your page or post.', 'godam' ) }
						</p>
						<MediaUploadCheck>
							<MediaUpload
								onSelect={ onSelectAudio }
								allowedTypes={ ALLOWED_MEDIA_TYPES }
								accept="audio/*"
								onError={ onUploadError }
								render={ ( { open } ) => (
									<Button
										variant="primary"
										onClick={ open }
										className="godam-audio-empty__btn"
										data-test-id="godam-audio-button-upload"
									>
										{ __( '+ Upload Audio', 'godam' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
					</div>
				</figure>
			</>
		);
	}

	// ── Has audio ─────────────────────────────────────────────────────────────
	return (
		<>
			{ /* ── Toolbar ─────────────────────────────────────────────────── */ }
			{ isSingleSelected && (
				<BlockControls group="other">
					<MediaReplaceFlow
						mediaId={ id }
						mediaURL={ src }
						allowedTypes={ ALLOWED_MEDIA_TYPES }
						accept="audio/*"
						onSelect={ onSelectAudio }
						onError={ onUploadError }
						onReset={ () => onSelectAudio( undefined ) }
					/>
				</BlockControls>
			) }

			{ /* ── Inspector ─────────────────────────────────────────────────── */ }
			<InspectorControls>

				{ /* Audio Selection */ }
				<PanelBody title={ __( 'Audio Selection', 'godam' ) } initialOpen={ true } data-test-id="godam-audio-panel-selection">
					{ audioSelectionPanelContent }
				</PanelBody>

				{ /* Thumbnail */ }
				<PanelBody title={ __( 'Thumbnail', 'godam' ) } initialOpen={ true } data-test-id="godam-audio-panel-thumbnail">
					<MediaUploadCheck>
						<MediaUpload
							title={ __( 'Select thumbnail', 'godam' ) }
							onSelect={ onSelectThumbnail }
							allowedTypes={ ALLOWED_THUMBNAIL_TYPES }
							value={ thumbnailId }
							render={ ( { open } ) => (
								<div className="godam-audio-thumbnail__container">
									{ thumbnail && (
										<Button
											__next40pxDefaultSize
											onClick={ open }
											aria-haspopup="dialog"
											aria-label={ __( 'Edit or replace the thumbnail.', 'godam' ) }
											className="godam-audio-thumbnail__preview"
											data-test-id="godam-audio-thumbnail-preview"
										>
											<img
												src={ thumbnail }
												alt={ __( 'Thumbnail preview', 'godam' ) }
												className="godam-audio-thumbnail__preview-image"
											/>
										</Button>
									) }
									<div
										className={ clsx( 'godam-audio-thumbnail__actions', {
											'godam-audio-thumbnail__actions-select': ! thumbnail,
										} ) }
									>
										<Button
											__next40pxDefaultSize
											onClick={ open }
											ref={ thumbnailButtonRef }
											className="godam-audio-thumbnail__action"
											aria-describedby={ thumbnailDescriptionId }
											aria-haspopup="dialog"
											variant={ ! thumbnail ? 'secondary' : undefined }
											data-test-id="godam-audio-button-replace-thumbnail"
										>
											{ ! thumbnail ? __( 'Set thumbnail', 'godam' ) : __( 'Replace', 'godam' ) }
										</Button>
										<p id={ thumbnailDescriptionId } hidden>
											{ thumbnail
												? sprintf(
													/* translators: %s: thumbnail image URL. */
													__( 'The current thumbnail url is %s.', 'godam' ),
													thumbnail,
												)
												: __( 'There is no thumbnail currently selected.', 'godam' ) }
										</p>
										{ !! thumbnail && (
											<Button
												__next40pxDefaultSize
												onClick={ () => {
													onRemoveThumbnail();
													thumbnailButtonRef.current?.focus();
												} }
												className="godam-audio-thumbnail__action"
												data-test-id="godam-audio-button-remove-thumbnail"
											>
												{ __( 'Remove', 'godam' ) }
											</Button>
										) }
									</div>
									<DropZone onFilesDrop={ onDropThumbnail } />
								</div>
							) }
						/>
					</MediaUploadCheck>
				</PanelBody>

				{ /* Settings */ }
				<PanelBody title={ __( 'Transcription', 'godam' ) } initialOpen={ true } data-test-id="godam-audio-panel-transcription">
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show transcript', 'godam' ) }
						checked={ showTranscript }
						onChange={ toggleAttribute( 'showTranscript' ) }
						data-test-id="godam-audio-control-show-transcript"
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show chapters', 'godam' ) }
						checked={ showChapters }
						onChange={ toggleAttribute( 'showChapters' ) }
						data-test-id="godam-audio-control-show-chapters"
					/>
					{ id && ! isAudioDeleted && (
						<Button
							__next40pxDefaultSize
							variant="secondary"
							href={ `${ editorUrl }&tab=transcription` }
							target="_blank"
							rel="noopener noreferrer"
							icon={ editIcon }
							className="godam-audio__btn"
							data-test-id="godam-audio-button-edit-transcript"
						>
							{ __( 'Edit', 'godam' ) }
						</Button>
					) }
				</PanelBody>

				<PanelBody title={ __( 'Settings', 'godam' ) } initialOpen={ true } data-test-id="godam-audio-panel-settings">
					<div data-test-id="godam-audio-control-autoplay">
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Autoplay', 'godam' ) }
							onChange={ toggleAttribute( 'autoplay' ) }
							checked={ autoplay }
							help={ getAutoplayHelp }
						/>
					</div>
					<div data-test-id="godam-audio-control-loop">
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Loop', 'godam' ) }
							onChange={ toggleAttribute( 'loop' ) }
							checked={ loop }
						/>
					</div>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ _x( 'Preload', 'noun; Audio block parameter', 'godam' ) }
						data-test-id="godam-audio-control-preload"
						value={ preload || '' }
						onChange={ ( value ) =>
							setAttributes( { preload: value || undefined } )
						}
						options={ [
							{ value: '', label: __( 'Browser default', 'godam' ) },
							{ value: 'auto', label: __( 'Auto', 'godam' ) },
							{ value: 'metadata', label: __( 'Metadata', 'godam' ) },
							{ value: 'none', label: _x( 'None', 'Preload value', 'godam' ) },
						] }
					/>
				</PanelBody>

			</InspectorControls>

			{ /* ── Block canvas ─────────────────────────────────────────────── */ }
			<figure { ...blockProps } data-test-id="godam-audio-canvas">
				{ isAudioDeleted ? (
					<div className="godam-audio-error" data-test-id="godam-audio-error">
						<Notice status="error" isDismissible={ false }>
							{ __( 'The audio file for this block was deleted from the Media Library. Replace it with another file or remove the block.', 'godam' ) }
						</Notice>
						<div className="godam-audio-error__actions">
							<MediaUploadCheck>
								<MediaUpload
									onSelect={ onSelectAudio }
									allowedTypes={ ALLOWED_MEDIA_TYPES }
									accept="audio/*"
									onError={ onUploadError }
									render={ ( { open } ) => (
										<Button
											__next40pxDefaultSize
											variant="primary"
											onClick={ open }
											data-test-id="godam-audio-error-button-replace"
										>
											{ __( 'Replace audio file', 'godam' ) }
										</Button>
									) }
								/>
							</MediaUploadCheck>
							<Button
								__next40pxDefaultSize
								variant="secondary"
								onClick={ onRemoveAudio }
								data-test-id="godam-audio-error-button-remove"
							>
								{ __( 'Remove audio', 'godam' ) }
							</Button>
						</div>
					</div>
				) : (
					<div className="godam-audio-card">
						<div className="godam-audio-card__head">
							<div className="godam-audio-card__cover" data-test-id="godam-audio-element-cover">
								{ thumbnail && (
									<img src={ thumbnail } alt={ audioTitle || __( 'Audio thumbnail', 'godam' ) } />
								) }
							</div>

							<div className="godam-audio-card__body">
								<p className="godam-audio-card__title" data-test-id="godam-audio-element-title">
									{ audioTitle || __( 'Untitled audio', 'godam' ) }
								</p>
								{ description && (
									<p className="godam-audio-card__description" data-test-id="godam-audio-element-description">{ description }</p>
								) }
								<AudioMiniPlayer src={ src ?? temporaryURL } />
								{ !! temporaryURL && <Spinner /> }
							</div>
						</div>

						<AudioTabs id={ id } showTranscript={ showTranscript } showChapters={ showChapters } />
					</div>
				) }
			</figure>
		</>
	);
}

export default AudioEdit;
