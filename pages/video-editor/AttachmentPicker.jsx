/**
 * External dependencies
 */
import React, { useState } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Icon, search } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import MediaGrid from './components/media-grid/MediaGrid.jsx';
import './attachment-picker.scss';
import NewYearSaleBanner from '../../assets/src/images/new-year-sale-2026.webp';

const AttachmentPicker = ( { handleAttachmentClick } ) => {
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const [ attachments, setAttachments ] = useState( [] );
	// showOfferBanner will now be a boolean (true/false) based on PHP calculation passed via godamSettings, or '0' if dismissed
	const [ showOfferBanner, setShowOfferBanner ] = useState( window?.godamSettings?.showOfferBanner && '0' !== window?.godamSettings?.showOfferBanner );

	const handleDismissBanner = () => {
		setShowOfferBanner( false );

		if ( window.wp && window.wp.ajax ) {
			window.wp.ajax.post( 'godam_dismiss_offer_banner', {
				nonce: window?.godamSettings?.showOfferBannerNonce || '',
			} );
		}
	};

	return (
		<>
			{ showOfferBanner && (
				<div className="notice annual-plan-offer-banner">
					<a
						href={ `${ window?.videoData?.godamBaseUrl }/pricing?utm_campaign=new-year-sale-2026&utm_source=${ window?.location?.host || '' }&utm_medium=plugin&utm_content=video-editor-banner` }
						className="annual-plan-offer-banner__link"
						target="_blank"
						rel="noopener noreferrer"
						aria-label={ __( 'Claim the GoDAM New Year Sale 2026 offer', 'godam' ) }
					>
						<img
							src={ NewYearSaleBanner }
							alt={ __( 'New Year Sale 2026 offer from GoDAM', 'godam' ) }
							className="annual-plan-offer-banner__image"
							loading="lazy"
						/>
					</a>
					<button
						type="button"
						className="annual-plan-offer-banner__dismiss"
						onClick={ handleDismissBanner }
						aria-label={ __( 'Dismiss banner', 'godam' ) }
					>
						&times;
					</button>
				</div>
			) }
			<div className="h-full overflow-auto is-dismissable px-6 md:px-10 bg-white">
				<div className="godam-video-list-header py-10">
					<h1 className="godam-video-list__title">{ __( 'Videos', 'godam' ) }</h1>

					<div className="godam-video-list__filters">
						<div className="godam-video-list__filters__search">
							<Icon icon={ search } />

							<input
								type="text"
								placeholder={ __( 'Search videos', 'godam' ) }
								onChange={ ( e ) => {
									setSearchTerm( e.target.value );
									setPage( 1 );
									setAttachments( [] );
								} }
							/>
						</div>
					</div>
				</div>

				<MediaGrid
					search={ searchTerm }
					page={ page }
					handleAttachmentClick={ handleAttachmentClick }
					setPage={ setPage }
					setAttachments={ setAttachments }
					attachments={ attachments }
				/>
			</div>
		</>
	);
};

export default AttachmentPicker;
