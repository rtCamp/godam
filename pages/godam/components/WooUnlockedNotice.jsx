/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

/**
 * Internal dependencies
 */
import godamMark from '../../../assets/src/images/godam-icon-colored.png';

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
		<circle cx="12" cy="12" r="8" { ...stroke } />
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
		title: __( 'Interactive product hotspots', 'godam' ),
		body: __( 'Tag products directly on your videos so viewers can buy in a click.', 'godam' ),
	},
	{
		Icon: ShoppableIcon,
		title: __( 'Shoppable video', 'godam' ),
		body: __( 'Turn any product video into a storefront that drives conversions.', 'godam' ),
	},
	{
		Icon: ReelIcon,
		title: __( 'Reel Pops', 'godam' ),
		body: __( 'Surface short, shoppable product reels across your store.', 'godam' ),
	},
	{
		Icon: ProductPageIcon,
		title: __( 'Enhanced product page', 'godam' ),
		body: __( 'Showcase your videos right on the WooCommerce product page.', 'godam' ),
	},
];

const restBase = () => window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

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

	useEffect( () => {
		// Only connected sites can have "unlocked" Woo features; skip the request
		// entirely otherwise so disconnected/onboarding pages stay quiet.
		if ( ! window?.userData?.validApiKey ) {
			return;
		}
		fetch( restBase() + 'godam/v1/onboarding/woo-nudge', {
			headers: { 'X-WP-Nonce': window.wpApiSettings?.nonce || '' },
		} )
			.then( ( res ) => ( res.ok ? res.json() : null ) )
			.then( ( data ) => {
				if ( data?.show ) {
					setShow( true );
				}
			} )
			.catch( () => {} );
	}, [] );

	// Backdrop click only hides the nudge for this view; it does NOT persist `seen`,
	// so an accidental click can't permanently kill a one-time nudge.
	const closeOnly = () => setShow( false );

	// The explicit "Get Started" CTA is what marks the nudge seen for good.
	const dismiss = () => {
		setShow( false );
		fetch( restBase() + 'godam/v1/onboarding/woo-nudge', {
			method: 'POST',
			headers: { 'X-WP-Nonce': window.wpApiSettings?.nonce || '' },
		} ).catch( () => {} );
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
					<img className="mb-5 h-8 w-8" src={ godamMark } alt="" aria-hidden="true" />
					<h2 className="m-0 text-2xl font-bold leading-tight text-slate-900">{ __( "You've Unlocked Woo Features", 'godam' ) }</h2>
					<p className="mb-6 mt-2 text-sm leading-relaxed text-slate-500">
						{ __( 'Turn your product videos into interactive shopping experiences, focused video content for WooCommerce.', 'godam' ) }
					</p>
					<div className="mb-7 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
						{ FEATURES.map( ( { Icon, title, body } ) => (
							<div key={ title } className="flex gap-3">
								<span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[#5d31ff]">
									<Icon />
								</span>
								<span>
									<span className="block text-sm font-semibold text-slate-900">{ title }</span>
									<span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{ body }</span>
								</span>
							</div>
						) ) }
					</div>
					<Button variant="primary" className="godam-woo-nudge__cta w-full justify-center" onClick={ dismiss } data-test-id="godam-header-button-woo-get-started">
						{ __( 'Get Started', 'godam' ) }
					</Button>
				</div>
				{ /* Right rail reserved for a future Pro-features preview. Intentionally empty for now (no placeholder UI yet). */ }
				<div className="godam-woo-nudge__media hidden w-72 flex-shrink-0 bg-gradient-to-br from-[#5d31ff] to-[#9b6bff] md:block" aria-hidden="true" />
			</div>
		</div>
	);
};

export default WooUnlockedNotice;
