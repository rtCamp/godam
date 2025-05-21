/**
 * External dependencies
 */
import { useEffect, useState, useRef } from 'react';
/**
 * Internal dependencies
 */
import giftIcon from '../../../assets/src/images/gift.png';

const carouselSlides = [
	{
		title: 'Welcome to Your GoDAM Dashboard',
		description: 'Visualize performance, track engagement, and get real-time insights across all your media.',
	},
	{
		tip: 'See how many users played your videos each day — track growth at a glance.',
	},
	{
		tip: 'Monitor average engagement and watch time to understand what content works best.',
	},
	{
		tip: 'Keep tabs on your bandwidth and storage — no surprises, just clarity.',
	},
	{
		tip: 'View global reach and top countries your videos are being watched in.',
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
		<div className="dashboard-donut-container hero-donut-block border border-zinc-200 p-4 flex-1 min-w-[300px] flex flex-col items-center justify-center text-center relative">
			<div className="w-full h-[140px] overflow-hidden relative">
				<img src={ giftIcon } alt="Gift Icon" className="w-16 h-16 mb-3 mx-auto" />
				<div
					key={ currentIndex }
					className="w-full h-full transition-transform duration-500 transform translate-x-0 animate-slide-in"
				>
					{ currentSlide.title && (
						<h3 className="text-lg font-semibold mb-2">
							{ currentSlide.title }
						</h3>
					) }
					<p className="text-sm text-center px-4">
						{ currentSlide.description || currentSlide.tip }
					</p>
				</div>
			</div>
			<div className="flex gap-2 mt-4">
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
		</div>
	);
};

export default MarketingCarousel;
