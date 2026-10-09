/**
 * WordPress dependencies
 */
import { Notice, ExternalLink } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { hasValidAPIKey } from '../utils/index.js';

const SETUP_GUIDE_URL = 'https://godam.io/docs/troubleshooting?utm_source=wordpress-plugin&utm_medium=settings&utm_campaign=preflight-check&utm_content=setup-guide-link';

const CALLBACK_CAUSES = [
	__( 'A security plugin (such as Wordfence or Solid Security) blocking unauthenticated REST API requests.', 'godam' ),
	__( 'A Cloudflare WAF or bot-protection rule challenging requests to /wp-json/.', 'godam' ),
	__( 'A server firewall or host-level rule blocking incoming requests.', 'godam' ),
	__( 'A reverse proxy or maintenance mode returning errors for the REST API.', 'godam' ),
];

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

const PreflightNotice = ( { status, title, children } ) => (
	<Notice className="mb-4 godam-preflight-notice" status={ status } isDismissible={ false }>
		<p><strong>{ title }</strong></p>
		{ children }
		<p className="description">
			{ __( 'GoDAM re-runs these checks every few hours. This notice goes away once they pass.', 'godam' ) }
			{ ' ' }
			<ExternalLink href={ SETUP_GUIDE_URL }>{ __( 'GoDAM Setup Guide', 'godam' ) }</ExternalLink>
		</p>
	</Notice>
);

/**
 * Problems GoDAM Central's licence preflight found on this site.
 *
 * GoDAM's screens strip WordPress admin notices, so the settings page shows the
 * same checks as RTGODAM_Transcoder_Admin::preflight_notices() itself. The four
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

	// Endpoints blocked by the same thing get the same fix from Central; say it once.
	const remediations = [ ...new Set( callbackIssues.map( ( check ) => check.remediation ).filter( Boolean ) ) ];

	return (
		<>
			{ callbackIssues.length > 0 && (
				<PreflightNotice
					status={ callbackIssues.some( ( check ) => check.status === 'fail' ) ? 'error' : 'warning' }
					title={ __( 'GoDAM cannot reach your site', 'godam' ) }
				>
					<p>{ __( 'Transcoding will finish on GoDAM, but this site will not be told, so videos stay at "Processing".', 'godam' ) }</p>
					<ul className="godam-preflight-notice__list">
						{ callbackIssues.map( ( check ) => <li key={ check.id }>{ check.label }</li> ) }
					</ul>
					{ remediations.map( ( remediation ) => (
						<p key={ remediation }>{ remediation }</p>
					) ) }
					<details className="godam-preflight-notice__details">
						<summary>{ __( 'Common causes', 'godam' ) }</summary>
						<ul className="godam-preflight-notice__list">
							{ CALLBACK_CAUSES.map( ( cause ) => <li key={ cause }>{ cause }</li> ) }
						</ul>
					</details>
					{ /* Central's messages are raw connection errors: useful to support, noise to everyone else. */ }
					<details className="godam-preflight-notice__details">
						<summary>{ __( 'Technical details', 'godam' ) }</summary>
						<ul className="godam-preflight-notice__list godam-preflight-notice__technical">
							{ callbackIssues.map( ( check ) => (
								<li key={ check.id }>{ `${ check.label }: ${ check.message }` }</li>
							) ) }
						</ul>
					</details>
				</PreflightNotice>
			) }

			{ otherIssues.map( ( check ) => (
				<PreflightNotice
					key={ check.id }
					status={ check.status === 'fail' ? 'error' : 'warning' }
					title={ check.label || __( 'GoDAM setup check', 'godam' ) }
				>
					{ check.message && <p>{ check.message }</p> }
					{ check.remediation && <p>{ check.remediation }</p> }
				</PreflightNotice>
			) ) }
		</>
	);
};

export default PreflightNotices;
