/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable import/no-unresolved */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	MediaUpload,
	MediaUploadCheck,
} from '@wordpress/block-editor';
import { Button } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { closeSmall, pencil, video as videoIcon } from '@wordpress/icons';

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

export default function Edit( { attributes, setAttributes, context } ) {
	const { videoId } = attributes;
	const layout = context[ 'godam/galleryV2/layout' ] || 'carousel';
	const showTitle = context[ 'godam/galleryV2/showTitle' ] !== false;
	const itemWidth = context[ 'godam/galleryV2/itemWidth' ] || 180;
	const viewRatio = context[ 'godam/galleryV2/viewRatio' ] || '9:16';

	const media = useSelect(
		( select ) => {
			if ( videoId > 0 ) {
				return select( coreStore ).getMedia( videoId );
			}

			return null;
		},
		[ videoId ],
	);

	const videoTitle = media?.title?.rendered || __( 'Untitled video', 'godam' );
	const videoThumbnail = getVideoThumbnail( media );
	const videoDate = formatDisplayDate( media?.date );

	const blockProps = useBlockProps( {
		className: `godam-gallery-v2-item godam-gallery-v2-item--${ layout } godam-gallery-v2-item--ratio-${ viewRatio.replace( ':', '-' ) }`,
		style: {
			'--godam-gallery-item-width': `${ itemWidth }px`,
		},
	} );

	return (
		<div { ...blockProps }>
			<MediaUploadCheck>
				<MediaUpload
					onSelect={ ( mediaItem ) => {
						if ( mediaItem?.id ) {
							setAttributes( { videoId: mediaItem.id } );
						}
					} }
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
							{ videoId && videoThumbnail ? (
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
												onSelect={ ( mediaItem ) => {
													if ( mediaItem?.id ) {
														setAttributes( { videoId: mediaItem.id } );
													}
												} }
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
												setAttributes( { videoId: 0 } );
											} }
										>
											{ __( 'Remove', 'godam' ) }
										</Button>
									</div>
								</>
							) : (
								<div className="godam-gallery-v2-item__placeholder">
									{ videoIcon }
									<span>{ __( 'Select Video', 'godam' ) }</span>
								</div>
							) }
						</div>
					) }
				/>
			</MediaUploadCheck>

			{ videoId ? (
				<>
					{ showTitle && (
						<div className="godam-gallery-v2-item__meta">
							<div className="godam-gallery-v2-item__copy">
								<strong title={ videoTitle }>{ videoTitle }</strong>
								{ videoDate && <span>{ videoDate }</span> }
							</div>
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
