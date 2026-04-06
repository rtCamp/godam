/**
 * WordPress dependencies
 */
import { useState, useEffect, useRef } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { Button, Spinner } from '@wordpress/components';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { __, sprintf } from '@wordpress/i18n';

const VIDEO_POSTER_ALLOWED_MEDIA_TYPES = [ 'image' ];

/**
 * ThumbnailPanel — scrollable grid of all available video thumbnails for the block Inspector.
 *
 * Fetches auto-generated and custom thumbnails from the GoDAM REST API and renders them
 * as clickable tiles. The active poster (block-level override or global default) is
 * highlighted with a selection ring. An upload tile at the end opens the WP Media Library
 * to set a fully custom image as the block-level poster.
 *
 * @param {Object}   props               Component props.
 * @param {number}   props.attachmentId  WordPress attachment ID for the video.
 * @param {string}   props.poster        Block-level poster override (attribute).
 * @param {string}   props.defaultPoster Global/fallback poster from attachment meta.
 * @param {Function} props.onSelect      Called with { url } when a thumbnail tile is chosen.
 * @param {Function} props.onRemove      Called when the user resets to the global thumbnail.
 *
 * @return {JSX.Element|null} The rendered thumbnail panel, or null when no video is selected.
 */
export default function ThumbnailPanel( {
	attachmentId,
	poster,
	defaultPoster,
	onSelect,
	onRemove,
} ) {
	const [ thumbnails, setThumbnails ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( false );

	// Tracks the URL of the image uploaded via the "+" button.
	// Kept separately from `poster` so it persists when the user selects a
	// different thumbnail from the list.
	const [ customUploadedPoster, setCustomUploadedPoster ] = useState( null );

	// Ref lets the fetch callback read the latest poster without adding it
	// as an effect dependency (which would re-trigger the fetch on every selection).
	const posterRef = useRef( poster );
	posterRef.current = poster;

	useEffect( () => {
		if ( ! attachmentId ) {
			setThumbnails( [] );
			setCustomUploadedPoster( null );
			return;
		}

		let cancelled = false;
		setIsLoading( true );
		setCustomUploadedPoster( null );

		apiFetch( {
			path: `/godam/v1/media-library/get-video-thumbnail?attachment_id=${ attachmentId }`,
		} )
			.then( ( response ) => {
				if ( cancelled || ! response?.success ) {
					return;
				}

				const {
					thumbnails: autoThumbs = [],
					customThumbnails = [],
				} = response.data;

				const thumbList = [
					...customThumbnails.map( ( url ) => ( { url, isCustom: true } ) ),
					...autoThumbs.map( ( url ) => ( { url, isCustom: false } ) ),
				];

				setThumbnails( thumbList );

				// If the saved poster is not in the server list it was uploaded
				// directly in the block editor — restore it as the custom tile.
				const currentPoster = posterRef.current;
				if ( currentPoster && ! thumbList.some( ( t ) => t.url === currentPoster ) ) {
					setCustomUploadedPoster( currentPoster );
				}
			} )
			.catch( () => {
				// Silently ignore — defaultPoster will still show if available.
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoading( false );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ attachmentId ] );

	// Highlight the block-level override when set, otherwise highlight the global default.
	const activePoster = poster || defaultPoster;

	// Called when a new image is uploaded via the "+" button.
	function handleCustomUpload( image ) {
		setCustomUploadedPoster( image.url );
		onSelect( image );
	}

	// Called when the "×" button or "Reset to global" is clicked.
	function handleRemoveCustom() {
		setCustomUploadedPoster( null );
		onRemove();
	}

	if ( ! attachmentId ) {
		return null;
	}

	return (
		<div className="godam-thumbnail-panel">
			<p className="godam-thumbnail-panel__label">
				{ __( 'Video Thumbnail', 'godam' ) }
			</p>

			{ isLoading ? (
				<div className="godam-thumbnail-panel__spinner">
					<Spinner />
				</div>
			) : (
				<div className="godam-thumbnail-grid">
					{ /* Upload tile — hidden while a custom thumbnail is present */ }
					{ ! customUploadedPoster && (
						<div className="godam-thumbnail-tile godam-thumbnail-upload-tile">
							<MediaUploadCheck>
								<MediaUpload
									title={ __( 'Upload Custom Thumbnail', 'godam' ) }
									onSelect={ handleCustomUpload }
									allowedTypes={ VIDEO_POSTER_ALLOWED_MEDIA_TYPES }
									render={ ( { open } ) => (
										<Button
											onClick={ open }
											className="godam-thumbnail-upload-btn"
											aria-label={ __( 'Upload custom thumbnail', 'godam' ) }
										>
											<span aria-hidden="true">+</span>
										</Button>
									) }
								/>
							</MediaUploadCheck>
						</div>
					) }

					{ /* Block-level custom poster — persists independently of which tile is active */ }
					{ customUploadedPoster && (
						<div
							className={ `godam-thumbnail-tile godam-thumbnail-custom-block-tile${ activePoster === customUploadedPoster ? ' is-selected' : '' }` }
							title={ __( 'Custom uploaded thumbnail', 'godam' ) }
							role="button"
							tabIndex={ 0 }
							onClick={ () => onSelect( { url: customUploadedPoster } ) }
							onKeyDown={ ( e ) => {
								if ( e.key === 'Enter' || e.key === ' ' ) {
									onSelect( { url: customUploadedPoster } );
								}
							} }
							aria-label={ __( 'Select custom thumbnail', 'godam' ) }
							aria-pressed={ activePoster === customUploadedPoster }
						>
							<img src={ customUploadedPoster } alt={ __( 'Custom thumbnail', 'godam' ) } draggable="false" />
							<button
								type="button"
								className="godam-thumbnail-delete-btn"
								onClick={ ( e ) => {
									e.stopPropagation();
									handleRemoveCustom();
								} }
								aria-label={ __( 'Remove custom thumbnail', 'godam' ) }
							>
								&#x2715;
							</button>
						</div>
					) }

					{ thumbnails.map( ( thumb ) => (
						<button
							key={ thumb.url }
							type="button"
							className={
								`godam-thumbnail-tile${ activePoster === thumb.url
									? ' is-selected'
									: '' }`
							}
							onClick={ () => onSelect( { url: thumb.url } ) }
							aria-label={
								/* translators: %s: thumbnail URL */
								sprintf( __( 'Select thumbnail: %s', 'godam' ), thumb.url )
							}
							aria-pressed={ activePoster === thumb.url }
						>
							<img src={ thumb.url } alt="" draggable="false" />
						</button>
					) ) }
				</div>
			) }

			{ !! poster && (
				<p className="godam-thumbnail-override-notice">
					{ __( 'Block override active.', 'godam' ) }
					{ ' ' }
					<Button
						variant="link"
						isDestructive
						onClick={ handleRemoveCustom }
					>
						{ __( 'Reset to global', 'godam' ) }
					</Button>
				</p>
			) }
		</div>
	);
}
