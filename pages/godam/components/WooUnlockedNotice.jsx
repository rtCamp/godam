/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

const FEATURES = [
	{
		title: __( 'Interactive product hotspots', 'godam' ),
		body: __( 'Tag products directly on your videos so viewers can buy in a click.', 'godam' ),
	},
	{
		title: __( 'Shoppable video', 'godam' ),
		body: __( 'Turn any product video into a storefront that drives conversions.', 'godam' ),
	},
	{
		title: __( 'Reel Pops', 'godam' ),
		body: __( 'Surface short, shoppable product reels across your store.', 'godam' ),
	},
];

const restBase = () => window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

/**
 * O10 — "You've unlocked Woo features" post-install nudge.
 *
 * Shown once per user, the first time they open GoDAM admin with WooCommerce
 * active after onboarding. The show/seen state is fetched (and dismissal
 * persisted) through the `onboarding/woo-nudge` REST route, so nothing has to be
 * localized onto every admin page — the component asks for itself when it mounts
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
			<div className="godam-woo-nudge__scrim absolute inset-0 bg-black/40" onClick={ dismiss } aria-hidden="true" />
			<div
				className="godam-woo-nudge__card relative z-10 flex w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl"
				role="dialog"
				aria-modal="true"
				aria-label={ __( 'You have unlocked Woo features', 'godam' ) }
			>
				<div className="flex-1 p-6">
					<h2 className="m-0 text-lg font-bold text-slate-900">{ __( "You've Unlocked Woo Features", 'godam' ) }</h2>
					<p className="mb-4 mt-1 text-sm leading-relaxed text-slate-600">
						{ __( 'Turn your product videos into interactive shopping experiences — focused video content for WooCommerce.', 'godam' ) }
					</p>
					<ul className="m-0 mb-5 list-none space-y-3 p-0">
						{ FEATURES.map( ( feature ) => (
							<li key={ feature.title } className="flex gap-3">
								<span className="mt-[6px] h-2 w-2 flex-shrink-0 rounded-full bg-[#5d31ff]" aria-hidden="true" />
								<span>
									<span className="block text-sm font-semibold text-slate-900">{ feature.title }</span>
									<span className="block text-xs leading-relaxed text-slate-500">{ feature.body }</span>
								</span>
							</li>
						) ) }
					</ul>
					<Button variant="primary" onClick={ dismiss } data-test-id="godam-header-button-woo-get-started">
						{ __( 'Get Started', 'godam' ) }
					</Button>
				</div>
				{ /* Pro-features preview — intentionally an empty styled panel for now (placeholder per design). */ }
				<div className="godam-woo-nudge__media hidden w-64 flex-shrink-0 bg-gradient-to-br from-[#5d31ff] to-[#9b6bff] sm:block" aria-hidden="true" />
			</div>
		</div>
	);
};

export default WooUnlockedNotice;
