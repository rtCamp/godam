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
const UPGRADE_PENDING = 'godam_upgrade_pending';
const UPGRADE_REFRESHED = 'godam_upgrade_refreshed';

/**
 * Parse a Frappe date/datetime ("YYYY-MM-DD HH:MM:SS") or unix timestamp.
 *
 * @param {string|number|null} value Raw date value.
 * @return {Date|null} Parsed date, or null when absent/invalid.
 */
const parseDate = ( value ) => {
	if ( ! value ) {
		return null;
	}
	const date = new Date( typeof value === 'number' ? value * 1000 : String( value ).replace( ' ', 'T' ) );
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

	// O11: handle the return leg from web checkout (runs on mount and whenever the
	// dashboard tab regains focus, since the upgrade completes in another tab).
	useEffect( () => {
		const handleReturn = () => {
			if ( ! window.localStorage.getItem( UPGRADE_PENDING ) ) {
				return;
			}
			// Plan now reflects paid → congratulate once, clear the flags.
			if ( isPaid ) {
				setShowProModal( true );
				window.localStorage.removeItem( UPGRADE_PENDING );
				window.localStorage.removeItem( UPGRADE_REFRESHED );
				return;
			}
			// Still showing the trial: the verify cache may be stale right after
			// checkout. Force one re-verify, then reload so the fresh plan loads.
			// The REFRESHED guard runs this at most once per upgrade (no loop).
			if ( window.localStorage.getItem( UPGRADE_REFRESHED ) ) {
				return;
			}
			window.localStorage.setItem( UPGRADE_REFRESHED, '1' );
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
		// Mark a checkout in flight so the return leg can confirm + re-verify.
		window.localStorage.setItem( UPGRADE_PENDING, '1' );
		window.localStorage.removeItem( UPGRADE_REFRESHED );
	};

	const totalDays = trialStart && trialEnd ? Math.max( 1, Math.round( ( trialEnd - trialStart ) / DAY_MS ) ) : null;
	const daysLeft = trialEnd ? Math.max( 0, Math.ceil( ( trialEnd - now ) / DAY_MS ) ) : 0;
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
