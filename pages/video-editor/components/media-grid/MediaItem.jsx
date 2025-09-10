/**
 * External dependencies
 */
import React, { forwardRef, useState } from 'react';

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
import { copyGoDAMVideoBlock } from '../../utils';
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
			data-testid={ `godam-media-item-${ item?.id }` }
		>
			<div className="godam-video-list__video__thumbnail" data-testid={ `godam-media-item-thumbnail-${ item?.id }` }>

				{ item?.image?.src && ! item?.image?.src.includes( '.svg' ) // svg is default image for video.
					? (
						<img src={ item?.image?.src } alt="video thumbnail" data-testid={ `godam-media-item-image-${ item?.id }` } />
					) : (
						<img src={ NoThumbnailImage } alt="video thumbnail" data-testid={ `godam-media-item-default-image-${ item?.id }` } />
					)
				}

				<DropdownMenu
					className="godam-video-list__video__thumbnail__overlay"
					menuProps={ {
						className: 'godam-video-list__video__thumbnail__overlay__menu',
					} }
					controls={ [
						{
							icon: <Icon icon={ seen } />,
							onClick: () => {
								window.open( item.link, '_blank' );
							},
							title: __( 'Preview template', 'godam' ),
						},
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
					data-testid={ `godam-media-item-dropdown-${ item?.id }` }
				/>

				{ item?.fileLength && <span className="godam-video-list__video__thumbnail__time text-xs text-white font-bold" data-testid={ `godam-media-item-duration-${ item?.id }` }>{ item?.fileLength }</span> }
			</div>

			<div className="godam-video-list__video__info" data-testid={ `godam-media-item-info-${ item?.id }` }>
				<h3 className="text-sm" data-testid={ `godam-media-item-title-${ item?.id }` }>{ item?.title }</h3>
				{ item?.description && <p className="text-xs" data-testid={ `godam-media-item-description-${ item?.id }` }>{ item?.description }</p> }
			</div>

			{ showSnackbar && createPortal(
				<Snackbar className="fixed bottom-4 right-4 opacity-70 z-50"
					onRemove={ handleOnSnackbarRemove }
					data-testid={ `godam-media-item-snackbar-${ item?.id }` }
				>
					{ snackbarMessage }
				</Snackbar>, document.body )
			}
		</div>
	);
} );

export default MediaItem;
