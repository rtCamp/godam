/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @wordpress/no-unsafe-wp-apis */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useBlockProps, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import {
	Button,
	Modal,
	SearchControl,
	Spinner,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { useState, useEffect, useCallback } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { video as videoIcon, closeSmall, store as storeIcon } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import './editor.scss';

/**
 * Play icon SVG
 */
const PlayIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M8 5v14l11-7z" />
	</svg>
);

/**
 * The edit function for GoDAM Video Product Gallery Item block.
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Function to set block attributes.
 * @param {Object}   props.context       Block context from parent.
 * @return {JSX.Element} Element to render.
 */
export default function Edit( { attributes, setAttributes, context } ) {
	const {
		videoId,
		videoThumbnail,
		videoTitle,
		productId,
		productName,
		productPrice,
		productImage,
	} = attributes;

	// Get context from parent block - layout for future use
	// eslint-disable-next-line no-unused-vars
	const layout = context[ 'godam/videoProductGallery/layout' ] || 'carousel';
	const viewRatio = context[ 'godam/videoProductGallery/viewRatio' ] || '9:16';

	// Convert ratio to CSS-friendly format
	const ratioClass = viewRatio.replace( ':', '-' );

	// Product modal and search state
	const [ isProductModalOpen, setIsProductModalOpen ] = useState( false );
	const [ productSearchQuery, setProductSearchQuery ] = useState( '' );
	const [ searchResults, setSearchResults ] = useState( [] );
	const [ isSearching, setIsSearching ] = useState( false );

	// Get video details when videoId changes
	const videoMedia = useSelect(
		( select ) => {
			if ( videoId > 0 ) {
				return select( 'core' ).getMedia( videoId );
			}
			return null;
		},
		[ videoId ],
	);

	// Update video attributes when media is loaded
	useEffect( () => {
		if ( videoMedia ) {
			const thumbnail =
				videoMedia?.meta?.rtgodam_media_video_thumbnail ||
				videoMedia?.media_details?.sizes?.thumbnail?.source_url ||
				videoMedia?.media_details?.sizes?.medium?.source_url ||
				'';

			setAttributes( {
				videoUrl: videoMedia.source_url || '',
				videoThumbnail: thumbnail,
				videoTitle: videoMedia.title?.rendered || '',
			} );
		}
	}, [ videoMedia, setAttributes ] );

	// Handle video selection
	const onSelectVideo = ( media ) => {
		if ( ! media || ! media.id ) {
			return;
		}

		const thumbnail =
			media?.meta?.rtgodam_media_video_thumbnail ||
			media?.image?.src ||
			media?.icon ||
			'';

		setAttributes( {
			videoId: media.id,
			videoUrl: media.url || '',
			videoThumbnail: thumbnail,
			videoTitle: media.title || '',
		} );
	};

	// Product search with debounce
	const searchProducts = useCallback(
		async ( query ) => {
			if ( ! query || query.length < 2 ) {
				setSearchResults( [] );
				return;
			}

			setIsSearching( true );

			try {
				const results = await apiFetch( {
					path: `/wc/store/v1/products?search=${ encodeURIComponent( query ) }&per_page=10`,
				} );

				setSearchResults( results || [] );
			} catch ( error ) {
				// Fallback to another endpoint if wc/store fails
				try {
					const fallbackResults = await apiFetch( {
						path: `/godam/v1/product-gallery/products?search=${ encodeURIComponent( query ) }`,
					} );
					setSearchResults( fallbackResults || [] );
				} catch ( fallbackError ) {
					setSearchResults( [] );
				}
			} finally {
				setIsSearching( false );
			}
		},
		[],
	);

	// Debounced search effect
	useEffect( () => {
		const timeoutId = setTimeout( () => {
			searchProducts( productSearchQuery );
		}, 300 );

		return () => clearTimeout( timeoutId );
	}, [ productSearchQuery, searchProducts ] );

	// Handle product selection
	const onSelectProduct = ( product ) => {
		setAttributes( {
			productId: product.id,
			productName: product.name,
			productPrice: product.prices?.price
				? `${ product.prices.currency_symbol || '$' }${ ( parseInt( product.prices.price, 10 ) / 100 ).toFixed( 2 ) }`
				: product.price || '',
			productImage:
				product.images?.[ 0 ]?.src ||
				product.images?.[ 0 ]?.thumbnail ||
				product.thumbnail ||
				'',
		} );
		setIsProductModalOpen( false );
		setProductSearchQuery( '' );
		setSearchResults( [] );
	};

	// Clear product
	const onClearProduct = () => {
		setAttributes( {
			productId: 0,
			productName: '',
			productPrice: '',
			productImage: '',
		} );
	};

	const blockProps = useBlockProps( {
		className: `godam-video-product-gallery-item godam-video-product-gallery-item--ratio-${ ratioClass }`,
	} );

	return (
		<div { ...blockProps }>
			{ /* Video Preview Section */ }
			<MediaUploadCheck>
				<MediaUpload
					onSelect={ onSelectVideo }
					allowedTypes={ [ 'video' ] }
					value={ videoId }
					render={ ( { open } ) => (
						<div
							className={ `godam-gallery-item__video-preview ${ ! videoId ? 'godam-gallery-item__video-preview--empty' : '' }` }
							onClick={ open }
							onKeyDown={ ( e ) => e.key === 'Enter' && open() }
							role="button"
							tabIndex={ 0 }
						>
							{ videoId && videoThumbnail ? (
								<>
									<img
										src={ videoThumbnail }
										alt={ videoTitle || __( 'Video thumbnail', 'godam' ) }
										className="godam-gallery-item__thumbnail"
									/>
									<div className="godam-gallery-item__play-icon">
										<PlayIcon />
									</div>
								</>
							) : (
								<div className="godam-gallery-item__placeholder">
									{ videoIcon }
									<span>{ __( 'Select Video', 'godam' ) }</span>
								</div>
							) }
						</div>
					) }
				/>
			</MediaUploadCheck>

			{ /* Product Section */ }
			<div className={ `godam-gallery-item__product ${ ! productId ? 'godam-gallery-item__product--empty' : '' }` }>
				{ productId ? (
					<div className="godam-gallery-item__product-info">
						{ productImage && (
							<img
								src={ productImage }
								alt={ productName }
								className="godam-gallery-item__product-image"
							/>
						) }
						<div className="godam-gallery-item__product-details">
							<p className="godam-gallery-item__product-name">{ productName }</p>
							{ productPrice && (
								<p className="godam-gallery-item__product-price">{ productPrice }</p>
							) }
						</div>
						<Button
							icon={ closeSmall }
							className="godam-gallery-item__product-remove"
							onClick={ onClearProduct }
							label={ __( 'Remove product', 'godam' ) }
							size="small"
						/>
					</div>
				) : (
					<div className="godam-gallery-item__product-select">
						<Button
							variant="secondary"
							icon={ storeIcon }
							onClick={ () => setIsProductModalOpen( true ) }
							className="godam-gallery-item__select-product-button"
							size="compact"
						>
							{ __( 'Select Product', 'godam' ) }
						</Button>
					</div>
				) }
			</div>

			{ /* Product Picker Modal */ }
			{ isProductModalOpen && (
				<Modal
					title={ __( 'Select Product', 'godam' ) }
					onRequestClose={ () => {
						setIsProductModalOpen( false );
						setProductSearchQuery( '' );
						setSearchResults( [] );
					} }
					className="godam-product-picker-modal"
					size="medium"
				>
					<VStack spacing={ 4 }>
						<SearchControl
							__nextHasNoMarginBottom
							label={ __( 'Search products', 'godam' ) }
							value={ productSearchQuery }
							onChange={ setProductSearchQuery }
							placeholder={ __( 'Search products…', 'godam' ) }
						/>

						<div className="godam-product-picker-modal__results">
							{ isSearching && (
								<HStack justify="center" className="godam-product-picker-modal__loading">
									<Spinner />
								</HStack>
							) }

							{ ! isSearching && productSearchQuery && searchResults.length === 0 && (
								<p className="godam-product-picker-modal__empty">
									{ __( 'No products found. Try a different search term.', 'godam' ) }
								</p>
							) }

							{ ! isSearching && ! productSearchQuery && (
								<p className="godam-product-picker-modal__hint">
									{ __( 'Start typing to search for products.', 'godam' ) }
								</p>
							) }

							{ ! isSearching && searchResults.length > 0 && (
								<VStack spacing={ 2 } className="godam-product-picker-modal__list">
									{ searchResults.map( ( product ) => (
										<button
											key={ product.id }
											type="button"
											className="godam-product-picker-modal__item"
											onClick={ () => onSelectProduct( product ) }
										>
											<HStack spacing={ 3 } alignment="center">
												{ ( product.images?.[ 0 ]?.src || product.images?.[ 0 ]?.thumbnail ) && (
													<img
														src={ product.images?.[ 0 ]?.src || product.images?.[ 0 ]?.thumbnail }
														alt={ product.name }
														className="godam-product-picker-modal__item-image"
													/>
												) }
												<VStack spacing={ 0 } className="godam-product-picker-modal__item-info">
													<span className="godam-product-picker-modal__item-name">
														{ product.name }
													</span>
													{ product.prices?.price && (
														<span className="godam-product-picker-modal__item-price">
															{ product.prices.currency_symbol || '$' }
															{ ( parseInt( product.prices.price, 10 ) / 100 ).toFixed( 2 ) }
														</span>
													) }
												</VStack>
											</HStack>
										</button>
									) ) }
								</VStack>
							) }
						</div>
					</VStack>
				</Modal>
			) }
		</div>
	);
}
