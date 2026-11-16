/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { Notice } from '@wordpress/components';

/**
 * Internal dependencies
 */
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
 * @param {Object} props
 * @param {Object} [props.userData] The localized user data. Defaults to `window.userData`.
 * @param {string} [props.area]     Page area, for the test id (e.g. 'dashboard').
 *
 * @return {JSX.Element|null} The notice, or nothing.
 */
const TrialDaysNotice = ( { userData = window.userData, area = 'dashboard' } ) => {
	// wp_localize_script() sends every number as a string ("5"), and no date as null or "".
	const daysLeft = /^\d+$/.test( String( userData?.trialDaysLeft ?? '' ) ) ? Number( userData.trialDaysLeft ) : null;

	if ( 'trial' !== userData?.connectionStatus || ! userData?.validApiKey || null === daysLeft ) {
		return null;
	}

	return (
		<div className="godam-trial-days" data-test-id={ `godam-${ area }-notice-trial-days` }>
			<Notice status={ daysLeft <= 3 ? 'warning' : 'info' } isDismissible={ false }>
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
