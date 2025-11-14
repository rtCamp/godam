/**
 * External dependencies
 */
import { useEffect, useState, useRef } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import addLayersImage from '../../../assets/src/images/add-layers.png';
import centralMediaManagerImage from '../../../assets/src/images/central-media-manager.png';
import videoAnalyticsImage from '../../../assets/src/images/video-analytics.png';
import comparisonAnalyticsImage from '../../../assets/src/images/video-analytics-comparison.png';
import singleVideoImage from '../../../assets/src/images/single-video.png';

const carouselSlides = [
	{}, // "What's New" slide
	{
		image: centralMediaManagerImage,
		link: 'https://godam.io/features/central-media-manager/',
	},
	{
		image: singleVideoImage,
		link: 'https://godam.io/features/central-media-manager/',
	},
	{
		image: addLayersImage,
		link: 'https://godam.io/features/video-overlay/',
	},
	{
		image: videoAnalyticsImage,
		link: 'https://godam.io/features/analytics/',
	},
	{
		image: comparisonAnalyticsImage,
		link: 'https://godam.io/features/analytics/',
	},
];

const MarketingCarousel = () => {
	const [ currentIndex, setCurrentIndex ] = useState( 0 );
	const intervalRef = useRef();

	useEffect( () => {
		startAutoSlide();
		return () => clearInterval( intervalRef.current );
	}, [] );

	const startAutoSlide = () => {
		clearInterval( intervalRef.current );
		intervalRef.current = setInterval( () => {
			setCurrentIndex( ( prev ) => ( prev + 1 ) % carouselSlides.length );
		}, 5000 );
	};

	const goToSlide = ( index ) => {
		setCurrentIndex( index );
		startAutoSlide();
	};

	const currentSlide = carouselSlides[ currentIndex ];

	return (
		<div className="dashboard-donut-container hero-donut-block border border-zinc-200 flex-1 min-w-[300px] h-[346px] flex flex-col items-center justify-center text-center relative">
			<div className="w-full h-full overflow-hidden relative">
				<div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
					{ carouselSlides.map( ( _, index ) => (
						<span
							role="button"
							tabIndex="0"
							key={ index }
							onClick={ () => goToSlide( index ) }
							onKeyDown={ ( e ) => {
								if ( e.key === 'Enter' || e.key === ' ' ) {
									goToSlide( index );
								}
							} }
							className={ `w-2 h-2 rounded-full transition-all duration-300 cursor-pointer ${
								index === currentIndex ? 'bg-[#AB3A6C]' : 'bg-[#D9CDB5]'
							}` }
						></span>
					) ) }
				</div>
				<div
					key={ currentIndex }
					className="w-full h-full flex flex-col items-center justify-center transition-transform duration-500 transform translate-x-0 animate-slide-in"
				>
					{ currentIndex === 0 ? (
						<>
							<h3 className="text-lg font-semibold mb-2 text-pink-800">{ __( 'What\'s New', 'godam' ) }</h3>
							<a
								href="https://godam.io/blog/whats-new-in-godam-v1-1-0/"
								target="_blank"
								rel="noopener noreferrer"
								className="marketing-carousel-read-more"
							>
								{ __( 'Read More', 'godam' ) }
							</a>
						</>
					) : (
						<>
							{ currentSlide.image && (
								<a
									href={ currentSlide.link }
									target="_blank"
									rel="noopener noreferrer"
								>
									<img
										src={ currentSlide.image }
										alt={ __( 'Feature Screenshot', 'godam' ) }
										className="w-full max-w-full max-h-[346px] rounded mx-auto object-contain"
									/>
								</a>
							) }
						</>
					) }
				</div>
			</div>
		</div>
	);
};

export default MarketingCarousel;
