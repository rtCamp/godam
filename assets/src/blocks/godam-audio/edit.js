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
	Disabled,
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
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { useState } from '@wordpress/element';
import { trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { Caption } from './caption';
import './editor.scss';

const ALLOWED_MEDIA_TYPES = [ 'audio' ];
const ALLOWED_THUMBNAIL_TYPES = [ 'image' ];

/**
 * Edit component for the GoDAM Audio block.
 *
 * @param {Object}   props                   - The properties passed to the component.
 * @param {Object}   props.attributes        - The block attributes.
 * @param {string}   props.className         - The class name for the component for styling.
 * @param {Function} props.setAttributes     - Function to update the block's attributes.
 * @param {boolean}  props.isSelected        - Whether the block is currently selected.
 * @param {Function} props.insertBlocksAfter - Function to insert blocks after the current block.
 *
 * @return {JSX.Element} The rendered audio block component with optional controls and captions.
 */
function AudioEdit( {
	attributes,
	className,
	setAttributes,
	isSelected: isSingleSelected,
	insertBlocksAfter,
} ) {
	const { id, autoplay, loop, preload, src, audioTitle, description, thumbnail, thumbnailId } = attributes;
	const [ temporaryURL, setTemporaryURL ] = useState( attributes.blob );

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
				caption: undefined,
				blob: undefined,
			} );
			setTemporaryURL();
			return;
		}

		// Guard against non-audio selections.
		const mediaType = media.type || ( media.mime || media.mime_type || '' ).split( '/' )[ 0 ];
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

		setAttributes( {
			blob: undefined,
			src: media.url,
			id: media.id,
			caption: media.caption || media.title,
			audioTitle: media.title || '',
			description: media.description || '',
		} );
		setTemporaryURL();
	}

	function onRemoveAudio() {
		setAttributes( {
			src: undefined,
			id: undefined,
			caption: undefined,
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
		const mediaType = media.type || ( media.mime || media.mime_type || '' ).split( '/' )[ 0 ];
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

	const classes = clsx( className, {
		'is-transient': !! temporaryURL,
	} );

	const blockProps = useBlockProps( { className: classes } );

	// ── Empty state ───────────────────────────────────────────────────────────
	if ( ! hasAudio ) {
		return (
			<>
				<InspectorControls>
					<PanelBody title={ __( 'Audio Selection', 'godam' ) } initialOpen={ true }>
						<MediaUploadCheck>
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
										className="godam-audio__add-btn"
										data-test-id="godam-audio-button-select"
									>
										{ __( '+ Add Audio File', 'godam' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
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
					{ fileName && (
						<div className="godam-audio-file-row">
							<span className="godam-audio-file-row__icon dashicons dashicons-media-audio" />
							<span className="godam-audio-file-row__name" title={ fileName }>
								{ fileName }
							</span>
							<Button
								icon={ trash }
								label={ __( 'Remove audio', 'godam' ) }
								isDestructive
								size="small"
								onClick={ onRemoveAudio }
								data-test-id="godam-audio-button-remove"
							/>
						</div>
					) }

					<TextControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Audio Title', 'godam' ) }
						data-test-id="godam-audio-control-title"
						value={ audioTitle }
						placeholder={ __( 'Add a title…', 'godam' ) }
						onChange={ ( value ) => setAttributes( { audioTitle: value } ) }
					/>

					<TextareaControl
						__nextHasNoMarginBottom
						label={ __( 'Description', 'godam' ) }
						data-test-id="godam-audio-control-description"
						value={ description }
						placeholder={ __( 'Add a short description…', 'godam' ) }
						rows={ 4 }
						onChange={ ( value ) => setAttributes( { description: value } ) }
					/>
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
										className="godam-audio__add-btn"
										data-test-id="godam-audio-button-upload-thumbnail"
									>
										{ __( '+ Upload Image', 'godam' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
					) }
				</PanelBody>

				{ /* Settings */ }
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
					{ /* Thumbnail */ }
					<div className="godam-audio-card__cover" data-test-id="godam-audio-element-cover">
						{ thumbnail ? (
							<img src={ thumbnail } alt={ audioTitle || __( 'Audio thumbnail', 'godam' ) } />
						) : (
							<div className="godam-audio-card__cover-placeholder">
								<span className="dashicons dashicons-media-audio" />
							</div>
						) }
					</div>

					{ /* Info + player */ }
					<div className="godam-audio-card__body">
						{ audioTitle && (
							<p className="godam-audio-card__title" data-test-id="godam-audio-element-title">{ audioTitle }</p>
						) }
						{ description && (
							<p className="godam-audio-card__description" data-test-id="godam-audio-element-description">{ description }</p>
						) }
						<Disabled isDisabled={ ! isSingleSelected }>
							<audio controls src={ src ?? temporaryURL } style={ { width: '100%' } } />
						</Disabled>
						{ !! temporaryURL && <Spinner /> }
					</div>
				</div>

				<Caption
					attributes={ attributes }
					setAttributes={ setAttributes }
					isSelected={ isSingleSelected }
					insertBlocksAfter={ insertBlocksAfter }
					label={ __( 'Audio caption text', 'godam' ) }
					showToolbarButton={ isSingleSelected }
				/>
			</figure>
		</>
	);
}

export default AudioEdit;
