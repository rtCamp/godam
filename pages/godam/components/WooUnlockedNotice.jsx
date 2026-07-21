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
	<svg viewBox="0 0 60 64" fill="none" aria-hidden="true" { ...props }>
		<path d="M28.8726 11.918C28.6663 11.6696 28.3292 11.6071 28.0381 11.7664L2.80244 26.138C1.34399 26.9765 0.207904 28.3907 0.0285135 30.048C-0.181209 32.0575 0.77808 33.9101 2.50689 34.8994L6.75483 37.3303C6.87009 37.3962 7.00007 37.362 7.0902 37.2832L28.8795 12.7694C29.091 12.521 29.0953 12.1758 28.9055 11.9369L28.8726 11.918Z" fill="currentColor" />
		<path d="M58.883 6.47149C58.8925 3.97813 57.4713 2.01324 55.5233 0.985398C53.6515 -0.172641 51.2199 -0.412481 49.0465 0.820911L39.742 6.12193C38.6458 6.7549 37.7532 7.67823 37.1735 8.78058L18.4544 42.765C18.1442 43.3697 18.3548 44.0987 18.9475 44.4378L35.6264 53.9822C36.2192 54.3214 36.9635 54.139 37.3396 53.572L57.8369 20.6051C58.5155 19.5593 58.8812 18.3344 58.8907 17.0796L58.909 6.46464L58.883 6.47149Z" fill="currentColor" />
		<path d="M59.7051 58.7002L59.733 29.9036C59.7442 29.5841 59.5051 29.3169 59.1844 29.2638C58.8638 29.2107 58.5631 29.3863 58.4669 29.7006L47.8078 60.5836C47.7576 60.7069 47.8182 60.8286 47.9335 60.8945L52.1814 63.3254C53.9102 64.3147 56.0134 64.2145 57.6721 63.0342C59.0369 62.0552 59.7285 60.3867 59.7215 58.7096L59.7051 58.7002Z" fill="currentColor" />
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
		if ( new URLSearchParams( window.location.search ).get( 'page' ) === 'rtgodam_media_editor' ) {
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
