/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { Notice } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getFreeTrialEnd } from '../godam/components/TrialCountdownBanner';
import './trial-days-notice.scss';

/**
 * Whether a URL from the server is safe to link to.
 *
 * @param {string} url URL.
 *
 * @return {boolean} True for an http(s) URL.
 */
const isLinkable = ( url ) => typeof url === 'string' && /^https?:\/\//i.test( url );

/**
 * Days left from what the server sends.
 *
 * wp_localize_script() sends every number as a string ("5"), and no date as null or "".
 * Anything numeric is read, with a part day counted as a day (as the server counts them),
 * so an imprecise value still shows the countdown; a negative one means it has ended.
 *
 * @param {*} value `trialDaysLeft` as sent.
 *
 * @return {number|null} Whole days left, or null when unknown or ended.
 */
export const parseDaysLeft = ( value ) => {
	if ( null === value || undefined === value || 'boolean' === typeof value || '' === String( value ).trim() ) {
		return null;
	}

	const days = Number( String( value ).trim() );

	return Number.isFinite( days ) && days >= 0 ? Math.ceil( days ) : null;
};

/**
 * The trial's last three days (2, 1 and 0 days left) are a warning.
 *
 * @type {number}
 */
export const WARNING_DAYS = 3;

/**
 * The line saying how long the trial has left.
 *
 * Same wording as the Media Library notice (render_trial_notice() in
 * admin/class-rtgodam-transcoder-admin.php), so both share one translation.
 *
 * @param {number} daysLeft Days left; 0 on the trial's last day.
 *
 * @return {string} The message.
 */
export const trialMessage = ( daysLeft ) => {
	if ( 0 === daysLeft ) {
		return __( 'Your GoDAM trial ends today.', 'godam' );
	}

	return sprintf(
		/* translators: %d: days left in the GoDAM trial */
		_n( 'Your GoDAM trial ends in %d day.', 'Your GoDAM trial ends in %d days.', daysLeft, 'godam' ),
		daysLeft,
	);
};

/**
 * How many trial days are left, with a link to upgrade, for a site on a GoDAM trial (#114).
 *
 * Reads what the server localizes as `userData` (rtgodam_get_user_data( true )):
 * `connectionStatus`, `trialDaysLeft` and `renewalUrl`. Shows nothing unless the site is
 * on a trial its key can use (a site refused by Central can't use the trial) and Central
 * said when the trial ends.
 *
 * Stays quiet while the header's Free plan banner (TrialCountdownBanner) shows, so the
 * page never says the trial is ending twice.
 *
 * @param {Object} props
 * @param {Object} [props.userData] The localized user data. Defaults to `window.userData`.
 * @param {string} [props.area]     Page area, for the test id (e.g. 'dashboard').
 *
 * @return {JSX.Element|null} The notice, or nothing.
 */
const TrialDaysNotice = ( { userData = window.userData, area = 'dashboard' } ) => {
	const daysLeft = parseDaysLeft( userData?.trialDaysLeft );

	if ( 'trial' !== userData?.connectionStatus || ! userData?.validApiKey || null === daysLeft || getFreeTrialEnd( userData ) ) {
		return null;
	}

	return (
		<div className="godam-trial-days" data-test-id={ `godam-${ area }-notice-trial-days` }>
			<Notice status={ daysLeft < WARNING_DAYS ? 'warning' : 'info' } isDismissible={ false }>
				<strong>{ trialMessage( daysLeft ) }</strong>
				{ isLinkable( userData.renewalUrl ) && (
					<>
						{ ' ' }
						<a
							className="godam-trial-days__link"
							href={ userData.renewalUrl }
							target="_blank"
							rel="noopener noreferrer"
							data-test-id={ `godam-${ area }-link-trial-upgrade` }
						>
							{ __( 'Upgrade to keep transcoding and other Pro features', 'godam' ) }
							{ /* Same arrow as the dashboard's other outbound links. */ }
							<span className="godam-trial-days__arrow" aria-hidden="true">↗</span>
						</a>
						.
					</>
				) }
			</Notice>
		</div>
	);
};

export default TrialDaysNotice;
