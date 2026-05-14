/* eslint-disable eslint-comments/disable-enable-pair */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	MediaUpload,
	MediaUploadCheck,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { Button } from '@wordpress/components';
import { useDispatch, useSelect, select as dataSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as noticesStore } from '@wordpress/notices';
import { closeSmall, pencil, video as videoIcon } from '@wordpress/icons';
import { useRef, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import './editor.scss';

const PlayIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M8 5v14l11-7z" />
	</svg>
);

const getVideoThumbnail = ( media ) =>
	media?.meta?.rtgodam_media_video_thumbnail ||
	media?.media_details?.sizes?.medium?.source_url ||
	media?.media_details?.sizes?.thumbnail?.source_url ||
	media?.icon ||
	'';

const formatDisplayDate = ( dateString ) => {
	if ( ! dateString ) {
		return '';
	}

	return new Date( dateString ).toLocaleDateString( 'en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	} );
};

export default function Edit( { attributes, setAttributes, context, clientId } ) {
	const { videoId } = attributes;
	const layout = context[ 'godam/galleryV2/layout' ] || 'carousel';
	const showTitle = context[ 'godam/galleryV2/showTitle' ] !== false;
	const itemWidthRaw = context[ 'godam/galleryV2/itemWidth' ] || 'M';
	const itemWidthMap = { S: 200, M: 260, L: 320 };
	const itemWidth = itemWidthMap[ itemWidthRaw ] || itemWidthMap.M;
	const viewRatio = context[ 'godam/galleryV2/viewRatio' ] || '16:9';
	const { removeBlock } = useDispatch( 'core/block-editor' );
	const { createNotice } = useDispatch( noticesStore );

	// Ref to track the GoDAM virtual media ID from the most recent selection.
	const pendingVirtualMediaId = useRef( null );

	// Shared handler for both MediaUpload instances.
	// Skips setAttributes for non-numeric GoDAM virtual IDs — the
	// godam-virtual-attachment-created event provides the real WP ID.
	const onSelectVideo = ( mediaItem ) => {
		if ( ! mediaItem?.id ) {
			return;
		}
		// Only allow video attachments.
		if ( mediaItem.type && mediaItem.type !== 'video' ) {
			createNotice( 'warning', __( 'Only video files can be added to the gallery.', 'godam' ), {
				type: 'snackbar',
				isDismissible: true,
			} );
			return;
		}
		if ( mediaItem.mime && ! mediaItem.mime.startsWith( 'video/' ) ) {
			createNotice( 'warning', __( 'Only video files can be added to the gallery.', 'godam' ), {
				type: 'snackbar',
				isDismissible: true,
			} );
			return;
		}
		pendingVirtualMediaId.current = mediaItem.id;
		const numericId = parseInt( mediaItem.id, 10 );
		if ( numericId > 0 && String( numericId ) === String( mediaItem.id ) ) {
			// Prevent selecting a video already used by a sibling.
			const { getBlockRootClientId, getBlock } = dataSelect( blockEditorStore );
			const parentClientId = getBlockRootClientId( clientId );
			const parentBlock = getBlock( parentClientId );
			const isDuplicate = ( parentBlock?.innerBlocks || [] ).some(
				( block ) => block.clientId !== clientId && block.attributes?.videoId === numericId,
			);
			if ( isDuplicate ) {
				createNotice( 'warning', __( 'This video is already in the gallery.', 'godam' ), {
					type: 'snackbar',
					isDismissible: true,
				} );
				return;
			}
			setAttributes( { videoId: numericId } );
		}
	};

	// Listen for the GoDAM virtual attachment event and update videoId
	// with the real WP attachment ID once it has been created.
	useEffect( () => {
		const handleVirtualAttachmentCreated = ( event ) => {
			const { attachment, virtualMediaId } = event.detail || {};
			if (
				attachment?.id &&
				pendingVirtualMediaId.current !== null &&
				String( pendingVirtualMediaId.current ) === String( virtualMediaId )
			) {
				pendingVirtualMediaId.current = null;

				// Prevent selecting a video already used by a sibling.
				const { getBlockRootClientId, getBlock } = dataSelect( blockEditorStore );
				const parentClientId = getBlockRootClientId( clientId );
				const parentBlock = getBlock( parentClientId );
				const isDuplicate = ( parentBlock?.innerBlocks || [] ).some(
					( block ) => block.clientId !== clientId && block.attributes?.videoId === attachment.id,
				);
				if ( isDuplicate ) {
					createNotice( 'warning', __( 'This video is already in the gallery.', 'godam' ), {
						type: 'snackbar',
						isDismissible: true,
					} );
					return;
				}

				setAttributes( { videoId: attachment.id } );
			}
		};

		document.addEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );

		return () => {
			document.removeEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );
		};
	}, [ clientId, setAttributes, createNotice ] );

	const { media, hasResolvedMedia } = useSelect(
		( select ) => {
			const coreSelect = select( coreStore );

			if ( videoId > 0 ) {
				return {
					media: coreSelect.getMedia( videoId ),
					hasResolvedMedia: coreSelect.hasFinishedResolution( 'getMedia', [ videoId ] ),
				};
			}

			return {
				media: null,
				hasResolvedMedia: false,
			};
		},
		[ videoId ],
	);
	const isLoadingMedia = videoId > 0 && ! hasResolvedMedia;

	const videoTitle = media?.title?.rendered || __( 'Untitled video', 'godam' );
	const videoThumbnail = getVideoThumbnail( media );
	const videoDate = formatDisplayDate( media?.date );
	let previewContent;

	if ( isLoadingMedia ) {
		previewContent = (
			<div className="godam-gallery-v2-item__loading" aria-hidden="true">
				<div className="godam-gallery-v2-item__loading-shimmer" />
			</div>
		);
	} else if ( videoId && videoThumbnail ) {
		previewContent = (
			<>
				<img
					src={ videoThumbnail }
					alt={ videoTitle }
					className="godam-gallery-v2-item__thumbnail"
				/>
				<div className="godam-gallery-v2-item__play-icon">
					<PlayIcon />
				</div>
				<div className="godam-gallery-v2-item__preview-overlay">
					<MediaUploadCheck>
						<MediaUpload
							onSelect={ onSelectVideo }
							allowedTypes={ [ 'video' ] }
							value={ videoId }
							render={ ( { open: openMediaModal } ) => (
								<Button
									variant="secondary"
									icon={ pencil }
									className="godam-gallery-v2-item__overlay-action"
									onClick={ ( event ) => {
										event.stopPropagation();
										openMediaModal();
									} }
								>
									{ __( 'Replace', 'godam' ) }
								</Button>
							) }
						/>
					</MediaUploadCheck>
					<Button
						variant="secondary"
						icon={ closeSmall }
						isDestructive
						className="godam-gallery-v2-item__overlay-action"
						onClick={ ( event ) => {
							event.stopPropagation();
							removeBlock( clientId );
						} }
					>
						{ __( 'Remove', 'godam' ) }
					</Button>
				</div>
			</>
		);
	} else {
		previewContent = (
			<div className="godam-gallery-v2-item__placeholder">
				{ videoIcon }
				<span>{ __( 'Select Video', 'godam' ) }</span>
			</div>
		);
	}

	const blockProps = useBlockProps( {
		className: `godam-gallery-v2-item godam-gallery-v2-item--${ layout } godam-gallery-v2-item--ratio-${ viewRatio.replace( ':', '-' ) }`,
		style: {
			'--godam-gallery-item-width': `${ itemWidth }px`, // resolved from size key
		},
	} );

	return (
		<div { ...blockProps }>
			<MediaUploadCheck>
				<MediaUpload
					onSelect={ onSelectVideo }
					allowedTypes={ [ 'video' ] }
					value={ videoId }
					render={ ( { open } ) => (
						<div
							className={ `godam-gallery-v2-item__preview ${ ! videoId ? 'godam-gallery-v2-item__preview--empty' : '' }` }
							onClick={ open }
							onKeyDown={ ( event ) => {
								if ( event.key === 'Enter' || event.key === ' ' ) {
									event.preventDefault();
									open();
								}
							} }
							role="button"
							tabIndex={ 0 }
						>
							{ previewContent }
						</div>
					) }
				/>
			</MediaUploadCheck>

			{ videoId ? (
				<>
					{ showTitle && (
						<div className="godam-gallery-v2-item__meta">
							{ isLoadingMedia ? (
								<div className="godam-gallery-v2-item__meta-skeleton" aria-hidden="true">
									<div className="godam-gallery-v2-item__meta-skeleton-line godam-gallery-v2-item__meta-skeleton-line--title" />
									<div className="godam-gallery-v2-item__meta-skeleton-line godam-gallery-v2-item__meta-skeleton-line--date" />
								</div>
							) : (
								<div className="godam-gallery-v2-item__copy">
									<strong title={ videoTitle }>{ videoTitle }</strong>
									{ videoDate && <span>{ videoDate }</span> }
								</div>
							) }
						</div>
					) }
				</>
			) : (
				<div className="godam-gallery-v2-item__meta">
					<p className="godam-gallery-v2-item__empty-copy">
						{ __( 'Choose a video to add this gallery item.', 'godam' ) }
					</p>
				</div>
			) }
		</div>
	);
}
