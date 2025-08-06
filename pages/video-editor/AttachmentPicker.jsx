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
import AnnualPlanOfferBanner from '../../assets/src/images/annual-plan-offer-banner.png';

const AttachmentPicker = ( { handleAttachmentClick } ) => {
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const [ attachments, setAttachments ] = useState( [] );
	const [ showOfferBanner, setShowOfferBanner ] = useState( ( '0' !== window?.godamSettings?.showOfferBanner ) );

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
			{ showOfferBanner && ! window?.userData?.validApiKey && (
				<div className="notice annual-plan-offer-banner px-10">
					<a
						href={ `https://godam.io/pricing?utm_campaign=annual-plan&utm_source=${
							window?.location?.host || ''
						}&utm_medium=plugin&utm_content=banner` }
					>
						<img
							src={ AnnualPlanOfferBanner }
							alt="Annual Plan Offer Banner"
							className="annual-plan-offer-banner__img"
						/>
					</a>
					<button
						type="button"
						className="annual-plan-offer-banner__dismiss"
						onClick={ handleDismissBanner }
					>
						&times;
					</button>
				</div>
			) }
			<div className="h-full overflow-auto is-dismissable godam-video-list-wrapper px-8 md:px-10 bg-white">
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