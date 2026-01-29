/**
 * External dependencies
 */
import React, { forwardRef, useState, useEffect } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { DropdownMenu, Snackbar } from '@wordpress/components';
import { Icon, moreHorizontalMobile, seen, link, chartBar, video, copy } from '@wordpress/icons';
import { createPortal } from '@wordpress/element';

/**
 * Internal dependencies
 */
import NoThumbnailImage from '../../assets/no-thumbnail.jpg';
import { copyGoDAMVideoBlock, prefetchMediaDataForCopy } from '../../utils';
import { canManageAttachment } from '../../../../assets/src/js/media-library/utility.js';

const MediaItem = forwardRef( ( { item, handleAttachmentClick }, ref ) => {
	const [ snackbarMessage, setSnackbarMessage ] = useState( '' );
	const [ showSnackbar, setShowSnackbar ] = useState( false );

	const handleItemClick = ( e ) => {
		if ( e.target.closest( '.godam-video-list__video__thumbnail__overlay' ) ) {
			return;
		}

		// If user cannot manage the attachment, prevent default action.
		if ( ! canManageAttachment( item?.author ) ) {
			return e.preventDefault();
		}

		handleAttachmentClick( item.id );
	};

	const handleCopyGoDAMVideoBlock = async () => {
		const result = await copyGoDAMVideoBlock( item.id );
		if ( result ) {
			setSnackbarMessage( __( 'GoDAM Video Block copied to clipboard', 'godam' ) );
			setShowSnackbar( true );
		} else {
			setSnackbarMessage( __( 'Failed to copy GoDAM Video Block', 'godam' ) );
			setShowSnackbar( true );
		}
	};

	const handleOnSnackbarRemove = () => {
		setShowSnackbar( false );
	};

	const getPreviewTemplateUrl = ( videoItem ) => {
		const homeUrl = window?.godamRestRoute?.homeUrl;
		const videoSlug = window?.godamSettings?.videoPostSettings?.video_slug;
		const videoName = videoItem?.name;
		return ( homeUrl && videoSlug && videoName )
			? `${ homeUrl }/${ videoSlug }/${ videoName }`
			: videoItem?.link;
	};

	// Pre-fetch data on mount to ensure copy always works
	useEffect( () => {
		prefetchMediaDataForCopy( item.id );
	}, [ item.id ] );

	return (
		<div
			className={ `godam-video-list__video ${ ! canManageAttachment( item?.author ) ? 'disabled' : '' }` }
			aria-disabled={ ! canManageAttachment( item?.author ) }
			disabled={ ! canManageAttachment( item?.author ) }
			onClick={ handleItemClick }
			role="button"
			ref={ ref }
			tabIndex={ 0 }
			onKeyDown={ ( e ) => {
				if ( e.key === 'Enter' ) {
					handleItemClick();
				}
			} }
		>
			<div className="godam-video-list__video__thumbnail">

				{ item?.image?.src && ! item?.image?.src.includes( '.svg' ) // svg is default image for video.
					? (
						<img src={ item?.image?.src } alt="video thumbnail" />
					) : (
						<img src={ NoThumbnailImage } alt="video thumbnail" />
					)
				}

				<DropdownMenu
					className="godam-video-list__video__thumbnail__overlay"
					menuProps={ {
						className: 'godam-video-list__video__thumbnail__overlay__menu',
					} }
					controls={ [
						...( window?.godamSettings?.videoPostSettings?.allow_single ? [ {
							icon: <Icon icon={ seen } />,
							onClick: () => {
								window.open( getPreviewTemplateUrl( item ), '_blank' );
							},
							title: __( 'Preview template', 'godam' ),
						} ] : [] ),
						{
							icon: <Icon icon={ video } />,
							onClick: () => {
								window.open( `/?godam_page=video-preview&id=${ item.id }`, '_blank' );
							},
							title: __( 'Preview Video', 'godam' ),
						},
						{
							icon: <Icon icon={ copy } />,
							onClick: () => {
								handleCopyGoDAMVideoBlock( item.id );
							},
							title: __( 'Copy Video Block', 'godam' ),
						},
						{
							icon: <Icon icon={ link } />,
							onClick: () => {
								navigator.clipboard.writeText( item?.url );
							},
							title: __( 'Copy video Link', 'godam' ),
						},
						{
							icon: <Icon icon={ chartBar } />,
							onClick: () => {
								window.open( `${ window?.pluginInfo?.adminUrl }admin.php?page=rtgodam_analytics&id=${ item?.id }`, '_blank' );
							},
							title: __( 'View analytics', 'godam' ),
						},
					] }
					icon={ <Icon icon={ moreHorizontalMobile } /> }
					label={ __( 'Quick actions.', 'godam' ) }
				/>

				{ item?.fileLength && <span className="godam-video-list__video__thumbnail__time text-xs text-white font-bold">{ item?.fileLength }</span> }
			</div>

			<div className="godam-video-list__video__info">
				<h3 className="text-sm">{ item?.title }</h3>
				{ item?.description && <p className="text-xs">{ item?.description }</p> }
			</div>

			{ showSnackbar && createPortal(
				<Snackbar className="fixed bottom-4 right-4 opacity-70 z-50"
					onRemove={ handleOnSnackbarRemove }
				>
					{ snackbarMessage }
				</Snackbar>, document.body )
			}
		</div>
	);
} );

export default MediaItem;
