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
} from '@wordpress/block-editor';
import { __, _x } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { useState } from '@wordpress/element';
import { plus, trash, edit as editIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import AudioMiniPlayer from './player';
import AudioTabs from './tabs';
import './editor.scss';

const ALLOWED_MEDIA_TYPES = [ 'audio' ];
const ALLOWED_THUMBNAIL_TYPES = [ 'image' ];

/**
 * Sliders/adjustments icon for the "Customize Audio" button (matches the design).
 */
const customizeIcon = (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
		<line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
		<line x1="4" y1="15" x2="20" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
		<circle cx="9" cy="9" r="2.4" fill="currentColor" />
		<circle cx="15" cy="15" r="2.4" fill="currentColor" />
	</svg>
);

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
 *
 * @return {JSX.Element} The rendered audio block component.
 */
function AudioEdit( {
	attributes,
	className,
	setAttributes,
	isSelected: isSingleSelected,
} ) {
	const { id, autoplay, loop, preload, src, audioTitle, description, thumbnail, thumbnailId, showTranscript } = attributes;
	const [ temporaryURL, setTemporaryURL ] = useState( attributes.blob );

	// The customization editor (transcription + chapters) is the video editor in
	// audio mode, opened by attachment ID. Relative to /wp-admin/ so it works in
	// any install path; opened in a new tab so block edits aren't lost.
	const editorUrl = id ? `admin.php?page=rtgodam_video_editor&id=${ id }` : '';

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

		setAttributes( {
			blob: undefined,
			src: media.url,
			id: media.id,
			audioTitle: mediaTitle,
			description: mediaDescription,
		} );
		setTemporaryURL();
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

	const hasAudio = !! ( src || temporaryURL );
	const fileName = src ? decodeURIComponent( src.split( '/' ).pop().split( '?' )[ 0 ] ) : '';

	// The selected attachment's file size, shown in the Audio Selection file row.
	const audioMedia = useSelect( ( select ) => ( id ? select( 'core' ).getMedia( id ) : null ), [ id ] );
	const fileSize = formatBytes( audioMedia?.media_details?.filesize );

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
			{ id && (
				<Button
					__next40pxDefaultSize
					variant="primary"
					href={ editorUrl }
					target="_blank"
					rel="noopener noreferrer"
					icon={ customizeIcon }
					className="godam-audio__btn"
					data-test-id="godam-audio-button-customize"
				>
					{ __( 'Customize Audio', 'godam' ) }
				</Button>
			) }

			<div className="godam-audio-file" data-test-id="godam-audio-file">
				<span className="godam-audio-file__icon">
					<span className="dashicons dashicons-media-default"></span>
				</span>
				<span className="godam-audio-file__meta">
					<span className="godam-audio-file__name" title={ fileName }>{ fileName }</span>
					{ fileSize && <span className="godam-audio-file__size">{ fileSize }</span> }
				</span>
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
					{ thumbnail ? (
						<div className="godam-audio-thumbnail-preview">
							<img src={ thumbnail } alt={ __( 'Audio thumbnail', 'godam' ) } />
							<div className="godam-audio-thumbnail-preview__actions">
								<MediaUploadCheck>
									<MediaUpload
										onSelect={ onSelectThumbnail }
										allowedTypes={ ALLOWED_THUMBNAIL_TYPES }
										value={ thumbnailId }
										render={ ( { open } ) => (
											<Button variant="secondary" size="small" onClick={ open } data-test-id="godam-audio-button-replace-thumbnail">
												{ __( 'Replace', 'godam' ) }
											</Button>
										) }
									/>
								</MediaUploadCheck>
								<Button
									variant="secondary"
									size="small"
									isDestructive
									onClick={ onRemoveThumbnail }
									data-test-id="godam-audio-button-remove-thumbnail"
								>
									{ __( 'Remove', 'godam' ) }
								</Button>
							</div>
						</div>
					) : (
						<MediaUploadCheck>
							<MediaUpload
								onSelect={ onSelectThumbnail }
								allowedTypes={ ALLOWED_THUMBNAIL_TYPES }
								value={ thumbnailId }
								render={ ( { open } ) => (
									<Button
										__next40pxDefaultSize
										variant="secondary"
										onClick={ open }
										icon={ plus }
										className="godam-audio__btn"
										data-test-id="godam-audio-button-upload-thumbnail"
									>
										{ __( 'Upload Image', 'godam' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
					) }
				</PanelBody>

				{ /* Settings */ }
				<PanelBody title={ __( 'Transcription', 'godam' ) } initialOpen={ false } data-test-id="godam-audio-panel-transcription">
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show transcript', 'godam' ) }
						checked={ showTranscript }
						onChange={ toggleAttribute( 'showTranscript' ) }
						help={ __( 'Display the Chapters / Transcript panel below the player on the front end.', 'godam' ) }
						data-test-id="godam-audio-control-show-transcript"
					/>
					{ id && (
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

				<PanelBody title={ __( 'Settings', 'godam' ) } initialOpen={ false } data-test-id="godam-audio-panel-settings">
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

					<AudioTabs id={ id } showTranscript={ showTranscript } />
				</div>
			</figure>
		</>
	);
}

export default AudioEdit;
