/**
 * External dependencies
 */
import React, { forwardRef } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { DropdownMenu } from '@wordpress/components';
import { Icon, moreHorizontalMobile, seen, link, chartBar } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import NoThumbnailImage from '../../assets/no-thumbnail.jpg';

const MediaItem = forwardRef( ( { item, handleAttachmentClick }, ref ) => {
	const handleItemClick = ( e ) => {
		if ( e.target.closest( '.godam-video-list__video__thumbnail__overlay' ) ) {
			return;
		}

		handleAttachmentClick( item.id );
	};

	return (
		<div
			className="godam-video-list__video"
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
					controls={ [
						{
							icon: <Icon icon={ seen } />,
							onClick: () => {
								window.open( item.link, '_blank' );
							},
							title: __( 'Preview template', 'godam' ),
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
		</div>
	);
} );

export default MediaItem;
