/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

const PENDING_KEY = 'godam_upgrade_pending';
const RELOADED_KEY = 'godam_upgrade_reloaded'; // we re-verify + reload at most once per checkout
const WINDOW_MS = 30 * 60 * 1000; // how long a started checkout stays "live"

/**
 * Snapshot the pre-upgrade plan when the user opens the web checkout, so the
 * return leg can tell an actual upgrade apart from an abandoned one. Called from
 * the "Upgrade plan" button in GoDAMHeader.
 */
export const markUpgradePending = () => {
	try {
		window.localStorage.setItem( PENDING_KEY, JSON.stringify( {
			ts: Date.now(),
			plan: window?.userData?.userApiData?.active_plan || '',
			storage: window?.userData?.totalStorage || 0,
		} ) );
		window.localStorage.removeItem( RELOADED_KEY );
	} catch ( e ) {
		// localStorage unavailable — the confirmation just won't auto-show.
	}
};

/**
 * O11 — "You are now a pro member" confirmation.
 *
 * The web checkout opens in another tab; on return to WordPress this re-verifies
 * the API key and, once the plan reflects the upgrade (plan name or storage quota
 * changed from the pre-checkout snapshot), shows a bottom-right toast. Bounded to
 * a short window so an abandoned checkout never triggers it.
 *
 * @return {JSX.Element|null} The toast, or null when there's nothing to confirm.
 */
const ProUpgradeNotice = () => {
	const [ show, setShow ] = useState( false );

	useEffect( () => {
		const handleReturn = () => {
			let pending = null;
			try {
				pending = JSON.parse( window.localStorage.getItem( PENDING_KEY ) || 'null' );
			} catch ( e ) {
				pending = null;
			}
			if ( ! pending || ! pending.ts ) {
				return;
			}

			const clear = () => {
				window.localStorage.removeItem( PENDING_KEY );
				window.localStorage.removeItem( RELOADED_KEY );
			};

			// Give up on a checkout that wasn't completed within the window.
			if ( Date.now() - pending.ts > WINDOW_MS ) {
				clear();
				return;
			}

			const u = window.userData || {};
			// Disconnected sites are owned by the onboarding overlay — never act
			// (and never reload) here.
			if ( ! u.validApiKey ) {
				return;
			}

			const plan = u.userApiData?.active_plan || '';
			// A real upgrade = the plan name changed between two known plans, or the
			// storage quota went up. Requiring both sides non-empty avoids a false
			// "pro member" when the snapshot simply had no plan and one appears later.
			const upgraded =
				( pending.plan && plan && plan !== pending.plan ) ||
				( u.totalStorage && pending.storage && u.totalStorage > pending.storage );
			if ( upgraded ) {
				setShow( true );
				clear();
				return;
			}

			// Not reflected yet: re-verify and reload ONCE to pull the fresh
			// plan/quota into window.userData (refresh-api-key-status only updates
			// the server cache). Capped at a single reload so refocusing the tab
			// never reloads the page repeatedly while the user is working.
			if ( window.localStorage.getItem( RELOADED_KEY ) ) {
				return;
			}
			window.localStorage.setItem( RELOADED_KEY, '1' );
			const restUrl = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';
			fetch( restUrl + 'godam/v1/settings/refresh-api-key-status', {
				method: 'POST',
				headers: { 'X-WP-Nonce': window.wpApiSettings?.nonce || '' },
			} ).finally( () => window.location.reload() );
		};

		handleReturn();
		window.addEventListener( 'focus', handleReturn );
		return () => window.removeEventListener( 'focus', handleReturn );
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
