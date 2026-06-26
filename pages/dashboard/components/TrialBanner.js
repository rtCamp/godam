/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Button, Modal } from '@wordpress/components';

/**
 * O8 trial-countdown banner + O11 upgrade hand-off and "pro member" confirmation.
 *
 * Reads the connected account's plan/trial fields from the verify_api_key
 * response (window.userData.userApiData): trial_start_date / trial_end_date /
 * active_plan / subscription_status. The banner shows only during an active
 * trial; clicking Upgrade opens the web checkout. On return, if the account is
 * now on a paid plan, the "You are now a pro member" confirmation is shown.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const UPGRADE_PENDING = 'godam_upgrade_pending'; // timestamp (ms) of the in-flight checkout
const UPGRADE_LAST_TRY = 'godam_upgrade_last_try'; // timestamp (ms) of the last re-verify
const UPGRADE_WINDOW_MS = 30 * 60 * 1000; // how long a pending checkout stays "live"
const UPGRADE_COOLDOWN_MS = 8 * 1000; // min gap between re-verify reloads

/**
 * Parse a Frappe date/datetime ("YYYY-MM-DD HH:MM:SS") or unix timestamp.
 *
 * Frappe sends naive datetimes in the server timezone (UTC); we mark them as
 * UTC so the countdown doesn't shift by the viewer's local offset. Strings that
 * already carry a Z or ±HH:MM offset are left as-is.
 *
 * @param {string|number|null} value Raw date value.
 * @return {Date|null} Parsed date, or null when absent/invalid.
 */
const parseDate = ( value ) => {
	if ( ! value ) {
		return null;
	}
	if ( typeof value === 'number' ) {
		const ts = new Date( value * 1000 );
		return Number.isNaN( ts.getTime() ) ? null : ts;
	}
	let str = String( value ).trim().replace( ' ', 'T' );
	if ( ! /[zZ]|[+-]\d{2}:?\d{2}$/.test( str ) ) {
		str += 'Z';
	}
	const date = new Date( str );
	return Number.isNaN( date.getTime() ) ? null : date;
};

const TrialBanner = () => {
	const api = window.userData?.userApiData || {};
	const checkoutUrl = ( window.godamRestRoute?.apiBase || 'https://app.godam.io' ) + '/web/billing?tab=Plans';

	const trialEnd = parseDate( api.trial_end_date );
	const trialStart = parseDate( api.trial_start_date );
	const now = new Date();

	const isTrial = !! trialEnd && trialEnd.getTime() > now.getTime();
	const isPaid = !! window.userData?.validApiKey && !! api.active_plan && ! isTrial;

	const [ showProModal, setShowProModal ] = useState( false );

	// O11: handle the return leg from web checkout. Runs on mount and whenever the
	// dashboard tab regains focus, since checkout completes in another tab. The
	// plan flip is async on godam-core's side, so we re-verify on each focus until
	// it turns paid — capped to a short window after the click so an abandoned
	// checkout never lingers (and never falsely confirms a later trial expiry).
	useEffect( () => {
		const handleReturn = () => {
			const pendingTs = parseInt( window.localStorage.getItem( UPGRADE_PENDING ) || '', 10 );
			if ( Number.isNaN( pendingTs ) ) {
				return;
			}

			const clearPending = () => {
				window.localStorage.removeItem( UPGRADE_PENDING );
				window.localStorage.removeItem( UPGRADE_LAST_TRY );
			};

			// Plan now reflects paid → congratulate once and stop.
			if ( isPaid ) {
				setShowProModal( true );
				clearPending();
				return;
			}

			// Give up on a checkout that wasn't completed within the window.
			if ( Date.now() - pendingTs > UPGRADE_WINDOW_MS ) {
				clearPending();
				return;
			}

			// Still on trial: re-verify, throttled so rapid focus events don't
			// fire back-to-back reloads. refresh-api-key-status only refreshes the
			// server cache, so reload to pull the fresh plan into window.userData.
			const lastTry = parseInt( window.localStorage.getItem( UPGRADE_LAST_TRY ) || '0', 10 );
			if ( Date.now() - lastTry < UPGRADE_COOLDOWN_MS ) {
				return;
			}
			window.localStorage.setItem( UPGRADE_LAST_TRY, String( Date.now() ) );
			const restUrl = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';
			fetch( restUrl + 'godam/v1/settings/refresh-api-key-status', {
				method: 'POST',
				headers: { 'X-WP-Nonce': window.wpApiSettings?.nonce || '' },
			} ).finally( () => window.location.reload() );
		};

		handleReturn();
		window.addEventListener( 'focus', handleReturn );
		return () => window.removeEventListener( 'focus', handleReturn );
	}, [ isPaid ] );

	const onUpgrade = () => {
		// Mark a checkout in flight (timestamped) so the return leg can re-verify
		// within the window and confirm the upgrade.
		window.localStorage.setItem( UPGRADE_PENDING, String( Date.now() ) );
		window.localStorage.removeItem( UPGRADE_LAST_TRY );
	};

	// Both use ceil (a partial day still counts), and days-left is clamped to the
	// total so the banner can never read "15 of 14 days left".
	const totalDays = trialStart && trialEnd ? Math.max( 1, Math.ceil( ( trialEnd - trialStart ) / DAY_MS ) ) : null;
	const daysLeftRaw = trialEnd ? Math.max( 0, Math.ceil( ( trialEnd - now ) / DAY_MS ) ) : 0;
	const daysLeft = totalDays ? Math.min( totalDays, daysLeftRaw ) : daysLeftRaw;
	const endLabel = trialEnd ? trialEnd.toLocaleDateString( undefined, { year: 'numeric', month: 'long', day: 'numeric' } ) : '';

	return (
		<>
			{ isTrial && (
				<div className="godam-trial-banner" data-test-id="godam-dashboard-trial-banner">
					<div className="godam-trial-banner__info">
						<strong className="godam-trial-banner__title">
							{ totalDays
								? sprintf(
									/* translators: 1: days left, 2: total trial days. */
									__( 'Free trial active · %1$d of %2$d days left', 'godam' ),
									daysLeft,
									totalDays,
								)
								: sprintf(
									/* translators: %d: days left in trial. */
									__( 'Free trial active · %d days left', 'godam' ),
									daysLeft,
								) }
						</strong>
						<span className="godam-trial-banner__sub">
							{ sprintf(
								/* translators: %s: trial end date. */
								__( 'Your free trial ends on %s. Upgrade to keep all Pro features.', 'godam' ),
								endLabel,
							) }
						</span>
					</div>
					<a
						className="components-button is-primary godam-trial-banner__cta"
						href={ checkoutUrl }
						target="_blank"
						rel="noopener noreferrer"
						onClick={ onUpgrade }
						data-test-id="godam-dashboard-button-upgrade"
					>
						{ __( 'Upgrade Now', 'godam' ) }
					</a>
				</div>
			) }

			{ showProModal && (
				<Modal
					title={ __( 'You are now a pro member', 'godam' ) }
					onRequestClose={ () => setShowProModal( false ) }
					className="godam-pro-modal"
				>
					<p>
						{ sprintf(
							/* translators: %s: plan name. */
							__( 'Welcome to %s! Your account is upgraded — all Pro features are unlocked on this site.', 'godam' ),
							api.active_plan || __( 'GoDAM Pro', 'godam' ),
						) }
					</p>
					<div className="godam-pro-modal__footer">
						<Button variant="primary" onClick={ () => setShowProModal( false ) } data-test-id="godam-dashboard-button-pro-got-it">
							{ __( 'Got it', 'godam' ) }
						</Button>
					</div>
				</Modal>
			) }
		</>
	);
};

export default TrialBanner;
