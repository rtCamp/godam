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
 * O8 — free-trial countdown banner.
 *
 * The "60-day free trial" is modelled in godam-core as a **Free subscription**
 * (active_plan "Free"), not a Frappe trial — so `trial_end_date` is null and the
 * period end lives in `end_date` (current_invoice_end). Shows a full-width strip
 * ("Free trial ends on <date>" + "Upgrade Now") while the connected account is on
 * the Free plan and that end date is still in the future.
 *
 * @return {JSX.Element|null} The banner, or null when not on the free plan.
 */
const TrialCountdownBanner = () => {
	const userData = window.userData || {};
	const plan = ( userData.userApiData?.active_plan || '' ).toLowerCase();
	const planEnd = parseDate( userData.userApiData?.end_date );
	const isFreeTrial = !! userData.validApiKey && 'free' === plan && !! planEnd && planEnd.getTime() > Date.now();

	if ( ! isFreeTrial ) {
		return null;
	}

	const endLabel = planEnd.toLocaleDateString( undefined, { year: 'numeric', month: 'long', day: 'numeric' } );

	return (
		<div className="godam-trial-banner -ml-[32px] bg-[var(--wp-admin-theme-color)] pl-[32px]" data-test-id="godam-header-banner-trial">
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
