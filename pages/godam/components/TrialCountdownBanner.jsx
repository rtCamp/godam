/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { info } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { startUpgrade } from './ProUpgradeNotice';

/**
 * Parse a Frappe date/datetime ("YYYY-MM-DD HH:MM:SS") or unix timestamp.
 *
 * Frappe sends naive datetimes in the server timezone (UTC); mark them as UTC so
 * the trial-end date doesn't shift by the viewer's local offset.
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

/**
 * O8 — trial-countdown banner.
 *
 * A full-width strip shown across GoDAM admin pages while the connected account
 * is on an active free trial: "Free trial ends on <date>" + an "Upgrade Now" CTA
 * that opens the web checkout (and marks the upgrade pending so the "pro member"
 * confirmation shows on return).
 *
 * @return {JSX.Element|null} The banner, or null when not on a trial.
 */
const TrialCountdownBanner = () => {
	const userData = window.userData || {};
	const trialEnd = parseDate( userData.userApiData?.trial_end_date );
	const isTrial = !! userData.validApiKey && !! trialEnd && trialEnd.getTime() > Date.now();

	if ( ! isTrial ) {
		return null;
	}

	const endLabel = trialEnd.toLocaleDateString( undefined, { year: 'numeric', month: 'long', day: 'numeric' } );

	return (
		<div className="godam-trial-banner -ml-[32px] bg-[#5d31ff] pl-[32px]" data-test-id="godam-header-banner-trial">
			<div className="mx-auto flex max-w-[1440px] items-center justify-center gap-3 px-4 py-2 text-sm text-white">
				<span className="flex items-center gap-1.5 [&>svg]:fill-current">
					<Icon icon={ info } size={ 18 } />
					{ sprintf(
						/* translators: %s: trial end date. */
						__( 'Free trial ends on %s', 'godam' ),
						endLabel,
					) }
				</span>
				<button
					type="button"
					onClick={ startUpgrade }
					className="rounded bg-white px-3 py-1 text-xs font-medium text-slate-900 hover:bg-slate-100"
					data-test-id="godam-header-button-upgrade-now"
				>
					{ __( 'Upgrade Now', 'godam' ) }
				</button>
			</div>
		</div>
	);
};

export default TrialCountdownBanner;
