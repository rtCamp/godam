/**
 * WordPress dependencies
 */
import { Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { hasValidAPIKey } from '../utils/index.js';

const TROUBLESHOOTING_URL = 'https://godam.io/docs/troubleshooting/?utm_source=wordpress-plugin&utm_medium=settings&utm_campaign=preflight-check&utm_content=troubleshooting-button';
const SUPPORT_URL = 'https://app.godam.io/helpdesk/my-tickets';

/**
 * The licence preflight checks GoDAM Central flagged for this site.
 *
 * Mirrors rtgodam_get_preflight_issues(): the quota check is left out because the
 * Plan Usage meters and the usage-limit notices already cover it.
 *
 * @return {Object[]} Checks with a `warn` or `fail` status.
 */
const getPreflightIssues = () => {
	if ( ! hasValidAPIKey ) {
		return [];
	}

	const checks = window?.userData?.userApiData?.preflight?.checks;

	if ( ! Array.isArray( checks ) ) {
		return [];
	}

	return checks.filter( ( check ) => check?.id !== 'check_quota' && [ 'warn', 'fail' ].includes( check?.status ) );
};

/**
 * One preflight notice: a title and a sentence for the site owner, the troubleshooting
 * guide as the call to action, and Contact Support as a secondary link.
 *
 * @param {Object} props
 * @param {string} props.status  `error` or `warning`.
 * @param {string} props.title   Notice title.
 * @param {string} props.message What goes wrong and why, in a sentence or two.
 * @param {string} props.section Section of the troubleshooting guide that covers this problem.
 *
 * @return {JSX.Element} The notice.
 */
const PreflightNotice = ( { status, title, message, section = '' } ) => (
	<Notice className="mb-4 godam-preflight-notice" status={ status } isDismissible={ false }>
		<p><strong>{ title }</strong></p>
		<p>{ message }</p>
		<div className="godam-preflight-notice__actions">
			<Button variant="primary" href={ TROUBLESHOOTING_URL + ( section ? `#${ section }` : '' ) } target="_blank" rel="noopener noreferrer">
				{ __( 'How to fix', 'godam' ) }
			</Button>
			<Button variant="link" href={ SUPPORT_URL } target="_blank" rel="noopener noreferrer">
				{ __( 'Contact Support', 'godam' ) }
			</Button>
		</div>
	</Notice>
);

/**
 * Problems GoDAM Central's licence preflight found on this site.
 *
 * GoDAM's screens strip WordPress admin notices, so the settings page shows the
 * same notices as RTGODAM_Transcoder_Admin::preflight_notices() itself. The four
 * callback checks share a cause and are shown as one notice.
 *
 * @see https://github.com/rtCamp/godam-core/issues/856
 *
 * @return {JSX.Element|null} The notices, or null when every check passed.
 */
const PreflightNotices = () => {
	const issues = getPreflightIssues();

	if ( ! issues.length ) {
		return null;
	}

	const callbackIssues = issues.filter( ( check ) => check.id?.startsWith( 'check_callback_' ) );
	const otherIssues = issues.filter( ( check ) => ! callbackIssues.includes( check ) );

	return (
		<>
			{ callbackIssues.length > 0 && (
				<PreflightNotice
					status={ callbackIssues.some( ( check ) => check.status === 'fail' ) ? 'error' : 'warning' }
					title={ __( 'Your site can\'t receive transcoding updates', 'godam' ) }
					message={ __( 'New videos may stay at "Processing" because transcoding updates can\'t reach this site. A firewall, security plugin or Cloudflare rule is usually blocking it. After you fix it, this message can take a few hours to clear.', 'godam' ) }
					section="site-not-reachable"
				/>
			) }

			{ otherIssues.map( ( check ) => (
				<PreflightNotice
					key={ check.id }
					status={ check.status === 'fail' ? 'error' : 'warning' }
					title={ check.label || __( 'Setup check', 'godam' ) }
					message={ check.remediation || check.message }
				/>
			) ) }
		</>
	);
};

export default PreflightNotices;
