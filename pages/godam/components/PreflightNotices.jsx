/**
 * WordPress dependencies
 */
import { Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { hasValidAPIKey } from '../utils/index.js';

const HOW_TO_FIX_URL = 'https://godam.io/docs/troubleshooting?utm_source=wordpress-plugin&utm_medium=settings&utm_campaign=preflight-check&utm_content=how-to-fix-button';

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
 * One preflight notice: a title and a sentence for the site owner, with Central's own
 * messages (meant for support) collapsed under "Details".
 *
 * @param {Object}   props
 * @param {string}   props.status  `error` or `warning`.
 * @param {string}   props.title   Notice title.
 * @param {string}   props.message What goes wrong and why, in a sentence or two.
 * @param {Object[]} props.checks  The checks behind the notice.
 *
 * @return {JSX.Element} The notice.
 */
const PreflightNotice = ( { status, title, message, checks } ) => (
	<Notice className="mb-4 godam-preflight-notice" status={ status } isDismissible={ false }>
		<p><strong>{ title }</strong></p>
		<p>{ message }</p>
		<details className="godam-preflight-notice__details">
			<summary>{ __( 'Details', 'godam' ) }</summary>
			<ul className="godam-preflight-notice__technical">
				{ checks.map( ( check ) => (
					<li key={ check.id }>{ `${ check.label }: ${ check.message } ${ check.remediation || '' }` }</li>
				) ) }
			</ul>
		</details>
		<Button variant="secondary" href={ HOW_TO_FIX_URL } target="_blank" rel="noopener noreferrer">
			{ __( 'How to fix', 'godam' ) }
		</Button>
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
					title={ __( 'GoDAM can\'t reach your site', 'godam' ) }
					message={ __( 'New videos may stay at "Processing" because GoDAM can\'t send updates back to this site. A firewall, security plugin or Cloudflare rule is usually blocking it.', 'godam' ) }
					checks={ callbackIssues }
				/>
			) }

			{ otherIssues.map( ( check ) => (
				<PreflightNotice
					key={ check.id }
					status={ check.status === 'fail' ? 'error' : 'warning' }
					title={ check.label || __( 'GoDAM setup check', 'godam' ) }
					message={ check.remediation || check.message }
					checks={ [ check ] }
				/>
			) ) }
		</>
	);
};

export default PreflightNotices;
