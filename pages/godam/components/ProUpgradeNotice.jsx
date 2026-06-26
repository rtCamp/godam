/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

const REFRESHED_KEY = 'godam_upgrade_refreshed'; // one-shot guard for the post-return re-verify

/**
 * Build the upgrade hand-off (godam-core "WordPress → app → back" flow).
 *
 * Preferred: `/godam_upgrade?organization=&wp_return=` — runs the in-app upgrade
 * and 302s back here with `?godam_upgrade=success`. Needs the org name (persisted
 * at workspace-connect). Without it (license-key / pre-existing sites) we fall
 * back to the plain billing page.
 *
 * @return {{ url: string, roundTrip: boolean }} The URL + whether it returns here.
 */
export const getUpgrade = () => {
	const apiBase = window.godamRestRoute?.apiBase || 'https://app.godam.io';
	// Prefer the org name from the verify_api_key response — that covers EVERY
	// connected site (incl. license-key / Settings-pasted) once godam-core returns
	// it. Fall back to the name persisted at workspace-connect (interim, workspace
	// sites only), then to the plain billing page.
	const org = window.userData?.userApiData?.organization || window.userData?.organization || '';
	if ( org ) {
		return {
			url: `${ apiBase }/godam_upgrade?organization=${ encodeURIComponent( org ) }&wp_return=${ encodeURIComponent( window.location.href ) }`,
			roundTrip: true,
		};
	}
	return { url: `${ apiBase }/web/billing?tab=Plans`, roundTrip: false };
};

/**
 * Start the upgrade from a CTA click. Round-trip → same-tab navigation (godam-core
 * redirects back); fallback → new tab so WordPress isn't lost.
 */
export const startUpgrade = () => {
	const { url, roundTrip } = getUpgrade();
	if ( roundTrip ) {
		window.location.href = url;
	} else {
		window.open( url, '_blank', 'noopener,noreferrer' );
	}
};

/**
 * O11 — "You are now a pro member" confirmation.
 *
 * godam-core's upgrade flow returns the user here with `?godam_upgrade=success`
 * after flushing the license cache. We re-verify once (so window.userData picks up
 * the new plan), then show a bottom-right toast and strip the query.
 *
 * @return {JSX.Element|null} The toast, or null.
 */
const ProUpgradeNotice = () => {
	const [ show, setShow ] = useState( false );

	useEffect( () => {
		const params = new URLSearchParams( window.location.search );
		if ( params.get( 'godam_upgrade' ) !== 'success' ) {
			return;
		}

		// First pass after the return: re-verify (godam-core already flushed its
		// cache, so this pulls the new plan) and reload so window.userData updates.
		// One-shot via sessionStorage so it can't loop.
		if ( ! window.sessionStorage.getItem( REFRESHED_KEY ) ) {
			window.sessionStorage.setItem( REFRESHED_KEY, '1' );
			const restUrl = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';
			fetch( restUrl + 'godam/v1/settings/refresh-api-key-status', {
				method: 'POST',
				headers: { 'X-WP-Nonce': window.wpApiSettings?.nonce || '' },
			} ).finally( () => window.location.reload() );
			return;
		}

		// Second pass (post-reload): plan is fresh → confirm, then strip the query
		// so a later reload doesn't re-trigger.
		window.sessionStorage.removeItem( REFRESHED_KEY );
		params.delete( 'godam_upgrade' );
		params.delete( 'plan' );
		params.delete( 'organization' );
		const qs = params.toString();
		window.history.replaceState( {}, '', window.location.pathname + ( qs ? `?${ qs }` : '' ) );
		setShow( true );
	}, [] );

	if ( ! show ) {
		return null;
	}

	return (
		<div
			className="godam-pro-toast fixed bottom-6 right-6 z-[100000] w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
			data-test-id="godam-header-notice-pro-member"
		>
			<div className="h-24 bg-indigo-50" aria-hidden="true"></div>
			<div className="p-4">
				<p className="m-0 text-sm font-bold text-slate-900">{ __( 'You are now a pro member', 'godam' ) }</p>
				<p className="mb-3 mt-1 text-xs leading-relaxed text-slate-600">
					{ __( 'With a paid plan, you get fixed storage, bandwidth that resets monthly, and unlimited sites.', 'godam' ) }
				</p>
				<div className="flex justify-end">
					<Button variant="primary" size="compact" onClick={ () => setShow( false ) } data-test-id="godam-header-button-pro-got-it">
						{ __( 'Got it', 'godam' ) }
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ProUpgradeNotice;
