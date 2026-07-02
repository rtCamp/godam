/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import './godam-woo-nudge.scss';
import { launchWooBlockTour } from '../../video-editor/onboarding/wooTour';
import hotspotsImage from './images/interactive-product-hotspots.webp';
import shoppableImage from './images/shoppable-video.webp';
import reelPopsImage from './images/reel-pops.webp';
import productPageImage from './images/enhanced-product-page.webp';

// GoDAM brand mark (same shape as the onboarding BrandLogo); fill="currentColor"
// so it takes the admin theme color via the .godam-woo-nudge__mark class.
const GodamMark = ( props ) => (
	<svg viewBox="0 0 64 64" fill="none" aria-hidden="true" { ...props }>
		<path d="M25.5578 20.0911L8.05587 37.593L3.46397 33.0011C0.818521 30.3556 2.0821 25.8336 5.72228 24.9464L25.5632 20.0964L25.5578 20.0911Z" fill="currentColor" />
		<path d="M47.3773 21.8867L45.5438 29.3875L22.6972 52.2341L11.2605 40.7974L34.1662 17.8916L41.5703 16.0796C45.0706 15.2247 48.2323 18.3863 47.372 21.8813L47.3773 21.8867Z" fill="currentColor" />
		<path d="M43.5059 38.1036L38.6667 57.8907C37.7741 61.5255 33.2521 62.7891 30.6066 60.1436L26.0363 55.5732L43.5059 38.1036Z" fill="currentColor" />
	</svg>
);

const stroke = {
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.6,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
};

const HotspotIcon = () => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
		<circle cx="12" cy="12" r="7" { ...stroke } />
		<circle cx="12" cy="12" r="2.5" fill="currentColor" />
	</svg>
);

const ShoppableIcon = () => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
		<path d="M6 8h12l-1 11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8z" { ...stroke } />
		<path d="M9 8V6.5a3 3 0 0 1 6 0V8" { ...stroke } />
	</svg>
);

const ReelIcon = () => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
		<rect x="7" y="3" width="10" height="18" rx="2" { ...stroke } />
		<path d="M10.5 9l4 3-4 3V9z" fill="currentColor" />
	</svg>
);

const ProductPageIcon = () => (
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
		<rect x="4" y="5" width="16" height="14" rx="2" { ...stroke } />
		<path d="M4 9h16M8 13h5M8 16h8" { ...stroke } />
	</svg>
);

const FEATURES = [
	{
		Icon: HotspotIcon,
		image: hotspotsImage,
		title: __( 'Interactive product hotspots', 'godam' ),
		body: __( 'Tag products directly on your videos so viewers can buy in a click.', 'godam' ),
	},
	{
		Icon: ShoppableIcon,
		image: shoppableImage,
		title: __( 'Shoppable video', 'godam' ),
		body: __( 'Turn any product video into a storefront that drives conversions.', 'godam' ),
	},
	{
		Icon: ReelIcon,
		image: reelPopsImage,
		title: __( 'Reel Pops', 'godam' ),
		body: __( 'Surface short, shoppable product reels across your store.', 'godam' ),
	},
	{
		Icon: ProductPageIcon,
		image: productPageImage,
		title: __( 'Enhanced product page', 'godam' ),
		body: __( 'Showcase your videos right on the WooCommerce product page.', 'godam' ),
	},
];

/**
 * O10: "You've unlocked Woo features" post-install nudge.
 *
 * Shown once per user, the first time they open GoDAM admin with WooCommerce
 * active after onboarding. The show/seen state is fetched (and dismissal
 * persisted) through the `onboarding/woo-nudge` REST route, so nothing has to be
 * localized onto every admin page: the component asks for itself when it mounts,
 * and only if the site is already connected.
 *
 * @return {JSX.Element|null} The nudge modal, or null.
 */
const WooUnlockedNotice = () => {
	const [ show, setShow ] = useState( false );
	// Right-rail Pro-features preview carousel.
	const [ slide, setSlide ] = useState( 0 );

	useEffect( () => {
		// Never on the Video Editor page — that screen has its own first-run
		// welcome chooser (Flow 2); the nudge (Flow 3) belongs to the other
		// GoDAM admin screens (e.g. the Dashboard) that share GoDAMHeader.
		if ( new URLSearchParams( window.location.search ).get( 'page' ) === 'rtgodam_video_editor' ) {
			return;
		}
		// Only connected sites can have "unlocked" Woo features; skip the request
		// entirely otherwise so disconnected/onboarding pages stay quiet.
		if ( ! window?.userData?.validApiKey ) {
			return;
		}
		// apiFetch (not raw fetch): resolves the REST root + nonce on any admin
		// page. window.wpApiSettings isn't reliably present on the Dashboard, so a
		// manual-nonce fetch could silently fail and re-show / fail to persist.
		apiFetch( { path: '/godam/v1/onboarding/woo-nudge' } )
			.then( ( data ) => {
				if ( data?.show ) {
					setShow( true );
				}
			} )
			.catch( () => {} );
	}, [] );

	// Auto-advance the preview carousel while the nudge is open.
	useEffect( () => {
		if ( ! show ) {
			return undefined;
		}
		const timer = setInterval( () => {
			setSlide( ( s ) => ( s + 1 ) % FEATURES.length );
		}, 3500 );
		return () => clearInterval( timer );
	}, [ show ] );

	// Backdrop click only hides the nudge for this view; it does NOT persist `seen`,
	// so an accidental click can't permanently kill a one-time nudge.
	const closeOnly = () => setShow( false );

	// Persist the one-time "seen" state so the nudge never re-appears.
	const markSeen = () => {
		apiFetch( { path: '/godam/v1/onboarding/woo-nudge', method: 'POST' } ).catch( () => {} );
	};

	// "Skip" — mark seen and close, without launching the tour.
	const handleSkip = () => {
		setShow( false );
		markSeen();
	};

	// "Get Started" — mark seen, then hand off to the in-editor Shoppable Video tour.
	const handleGetStarted = () => {
		setShow( false );
		markSeen();
		launchWooBlockTour();
	};

	if ( ! show ) {
		return null;
	}

	return (
		<div
			className="godam-woo-nudge fixed inset-0 z-[100000] flex items-center justify-center p-4"
			data-test-id="godam-header-notice-woo-unlocked"
		>
			<div className="godam-woo-nudge__scrim absolute inset-0 bg-black/40" onClick={ closeOnly } aria-hidden="true" />
			<div
				className="godam-woo-nudge__card relative z-10 flex w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
				role="dialog"
				aria-modal="true"
				aria-label={ __( 'You have unlocked Woo features', 'godam' ) }
			>
				<div className="flex-1 p-8">
					<GodamMark className="godam-woo-nudge__mark mb-5 h-8 w-8" />
					<h2 className="m-0 text-2xl font-bold leading-tight text-slate-900">{ __( "You've Unlocked Woo Features", 'godam' ) }</h2>
					<p className="mb-6 mt-2 text-sm leading-relaxed text-slate-500">
						{ __( 'Turn your product videos into interactive shopping experiences, focused video content for WooCommerce.', 'godam' ) }
					</p>
					<div className="mb-7 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
						{ FEATURES.map( ( { Icon, title, body } ) => (
							<div key={ title } className="flex gap-3">
								<span className="godam-woo-nudge__chip flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
									<Icon />
								</span>
								<span>
									<span className="block text-sm font-semibold text-slate-900">{ title }</span>
									<span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{ body }</span>
								</span>
							</div>
						) ) }
					</div>
					<div className="godam-woo-nudge__actions flex gap-3">
						<Button variant="secondary" className="godam-woo-nudge__skip justify-center w-[30%]" onClick={ handleSkip } data-test-id="godam-header-button-woo-skip">
							{ __( 'Skip', 'godam' ) }
						</Button>
						<Button variant="primary" className="godam-woo-nudge__cta flex-1 justify-center" onClick={ handleGetStarted } data-test-id="godam-header-button-woo-get-started">
							{ __( 'Get Started', 'godam' ) }
						</Button>
					</div>
				</div>
				{ /* Right rail: rotating preview of the Pro features being unlocked. */ }
				<div className="godam-woo-nudge__media hidden w-72 flex-shrink-0 md:flex">
					<div className="godam-woo-nudge__carousel">
						<div className="godam-woo-nudge__frame">
							{ FEATURES.map( ( { image, title }, i ) => (
								<div
									key={ title }
									className={ `godam-woo-nudge__slide${ i === slide ? ' is-active' : '' }` }
									aria-hidden={ i === slide ? 'false' : 'true' }
								>
									<img className="godam-woo-nudge__slide-img" src={ image } alt={ title } />
								</div>
							) ) }
						</div>
						<span className="godam-woo-nudge__caption">
							{ FEATURES[ slide ]?.title }
						</span>
						<div className="godam-woo-nudge__dots" role="group" aria-label={ __( 'Feature preview slides', 'godam' ) }>
							{ FEATURES.map( ( { title }, i ) => (
								<button
									key={ title }
									type="button"
									className={ `godam-woo-nudge__dot${ i === slide ? ' is-active' : '' }` }
									aria-label={ title }
									aria-pressed={ i === slide }
									onClick={ () => setSlide( i ) }
								/>
							) ) }
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default WooUnlockedNotice;
