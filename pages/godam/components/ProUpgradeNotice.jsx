/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

const PENDING_KEY = 'godam_upgrade_pending';
const LAST_TRY_KEY = 'godam_upgrade_last_try';
const WINDOW_MS = 30 * 60 * 1000; // how long a started checkout stays "live"
const COOLDOWN_MS = 8 * 1000; // min gap between re-verify reloads

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
		window.localStorage.removeItem( LAST_TRY_KEY );
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
				window.localStorage.removeItem( LAST_TRY_KEY );
			};

			// Give up on a checkout that wasn't completed within the window.
			if ( Date.now() - pending.ts > WINDOW_MS ) {
				clear();
				return;
			}

			const u = window.userData || {};
			const plan = u.userApiData?.active_plan || '';
			const upgraded = !! u.validApiKey &&
				( ( plan && plan !== pending.plan ) || ( u.totalStorage && u.totalStorage !== pending.storage ) );
			if ( upgraded ) {
				setShow( true );
				clear();
				return;
			}

			// Plan not updated yet — re-verify (throttled) and reload to pull the
			// fresh plan/quota into window.userData, then re-check on next run.
			const lastTry = parseInt( window.localStorage.getItem( LAST_TRY_KEY ) || '0', 10 );
			if ( Date.now() - lastTry < COOLDOWN_MS ) {
				return;
			}
			window.localStorage.setItem( LAST_TRY_KEY, String( Date.now() ) );
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
					{ __( 'With a paid plan, you get 50 GB storage, 50 GB bandwidth and unlimited usage limits.', 'godam' ) }
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
