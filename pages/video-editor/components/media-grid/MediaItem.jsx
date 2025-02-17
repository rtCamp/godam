/**
 * External dependencies
 */
import React, { useState, forwardRef } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Icon, moreHorizontalMobile, seen, link } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import NoThumbnailImage from '../../assets/no-thumbnail.jpg';

const MediaItem = forwardRef( ( { item, handleAttachmentClick }, ref ) => {
	const [ isActionOpen, setIsActionOpen ] = useState( false );
	const [ isCopied, setIsCopied ] = useState( false );

	const handleItemClick = ( e ) => {
		if ( e.target.closest( '.godam-video-list__video__thumbnail__actions' ) ) {
			return;
		}

		// Check if the click item is the overlay button.
		if ( e.target.closest( '.godam-video-list__video__thumbnail__overlay' ) ) {
			setIsActionOpen( ! isActionOpen );
		} else {
			handleAttachmentClick( item.id );
		}
	};

	const copyLink = ( e ) => {
		e.preventDefault();
		navigator.clipboard.writeText( item.link );

		setIsCopied( true );

		setTimeout( () => {
			setIsCopied( false );
		}, 2000 );
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

				<button className="godam-video-list__video__thumbnail__overlay" >
					<Icon icon={ moreHorizontalMobile } />
				</button>

				{ isActionOpen && (
					<div className="godam-video-list__video__thumbnail__actions">
						<a href={ item.link } target="_blank" className="godam-video-list__video__thumbnail__actions__action" rel="noreferrer">
							<Icon icon={ seen } />
							<span>{ __( 'Preview template', 'godam' ) }</span>
						</a>

						<button
							href="#"
							onClick={ copyLink }
							className="godam-video-list__video__thumbnail__actions__action">
							<Icon icon={ link } />

							{ isCopied ? (
								<span>{ __( 'Link copied', 'godam' ) }</span>
							) : (
								<span>{ __( 'Copy video Link', 'godam' ) }</span>
							) }
						</button>
					</div>
				) }

				<span className="godam-video-list__video__thumbnail__time text-xs text-white font-bold">{ item?.fileLength }</span>
			</div>

			<div className="godam-video-list__video__info">
				<h3 className="text-sm">{ item?.title }</h3>
				{ item?.description && <p className="text-xs">{ item.description }</p> }
			</div>
		</div>
	);
} );

export default MediaItem;
