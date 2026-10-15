/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Icon, update } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import ContactSupportLink from './ContactSupportLink';
import './analytics-unavailable.scss';

/**
 * A chart that has lost its line to the cloud. Decorative.
 *
 * @return {JSX.Element} The illustration.
 */
const UnavailableIllustration = () => (
	<svg className="godam-analytics-unavailable__illustration" width="200" height="120" viewBox="0 0 200 120" fill="none" aria-hidden="true" focusable="false">
		<circle cx="100" cy="60" r="58" fill="#f5f2ff" />
		<rect x="30" y="34" width="66" height="52" rx="8" fill="#fff" stroke="#d9d0ff" strokeWidth="1.5" />
		<rect x="40" y="62" width="8" height="16" rx="2" fill="#5d31ff" opacity=".35" />
		<rect x="52" y="54" width="8" height="24" rx="2" fill="#5d31ff" opacity=".55" />
		<rect x="64" y="46" width="8" height="32" rx="2" fill="#5d31ff" opacity=".8" />
		<rect x="76.75" y="58.75" width="6.5" height="18.5" rx="2" stroke="#5d31ff" strokeWidth="1.5" strokeDasharray="2 2" />
		<path className="godam-analytics-unavailable__flow" d="M98 60H112" stroke="#5d31ff" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" />
		<path className="godam-analytics-unavailable__flow" d="M126 60H138" stroke="#5d31ff" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" />
		<path d="M115 51l3 5M123 51l-3 5M115 69l3-5M123 69l-3-5" stroke="#d97706" strokeWidth="1.75" strokeLinecap="round" />
		<path d="M143 76H169A9 9 0 0 0 170.5 58.2A12 12 0 0 0 147.6 61.5A7.5 7.5 0 0 0 143 76Z" fill="#fff" stroke="#5d31ff" strokeWidth="1.75" strokeLinejoin="round" />
	</svg>
);

/**
 * A faded outline of the page behind the card, so it reads as "your analytics
 * live here and will come back" rather than an empty page. Decorative.
 *
 * @param {Object} props
 * @param {string} props.area Page area; the Dashboard keeps its real title.
 * @return {JSX.Element} The outline.
 */
const PageOutline = ( { area } ) => (
	<div className="godam-analytics-unavailable__outline" aria-hidden="true">
		<div className="godam-analytics-unavailable__outline-head">
			{ 'dashboard' === area && <span className="godam-analytics-unavailable__outline-title">{ __( 'Dashboard', 'godam' ) }</span> }
			<span className="godam-analytics-unavailable__bar godam-analytics-unavailable__bar--head" />
		</div>
		<div className="godam-analytics-unavailable__outline-tiles">
			{ [ 50, 60, 45, 55 ].map( ( width ) => (
				<div key={ width } className="godam-analytics-unavailable__outline-tile">
					<span className="godam-analytics-unavailable__bar" style={ { width: `${ width }%` } } />
					<span className="godam-analytics-unavailable__bar godam-analytics-unavailable__bar--value" />
				</div>
			) ) }
		</div>
		<div className="godam-analytics-unavailable__outline-panels">
			<div className="godam-analytics-unavailable__outline-panel">
				<span className="godam-analytics-unavailable__bar" style={ { width: '30%' } } />
				<svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none" fill="none" focusable="false">
					<path d="M0 150H400M0 110H400M0 70H400M0 30H400" stroke="#f0f0f1" strokeWidth="1" />
					<path d="M0 130C60 122 90 92 150 98S240 52 290 64 360 36 400 44" stroke="#c3c4c7" strokeWidth="3" strokeDasharray="6 8" strokeLinecap="round" />
				</svg>
			</div>
			<div className="godam-analytics-unavailable__outline-panel">
				<span className="godam-analytics-unavailable__bar" style={ { width: '40%' } } />
				{ [ 100, 85, 92, 70, 80 ].map( ( width ) => (
					<span key={ width } className="godam-analytics-unavailable__bar godam-analytics-unavailable__bar--row" style={ { width: `${ width }%` } } />
				) ) }
			</div>
		</div>
	</div>
);

/**
 * Shown to a connected user in place of the Dashboard or single-video Analytics
 * page when the GoDAM analytics service can't be reached (server down, or it
 * returned a microservice error). Offers a retry in place and Contact Support.
 * The disconnected / not-yet-connected case is handled by the onboarding
 * overlay, not here.
 *
 * Deliberately plain markup (no @wordpress/components) so it renders through
 * `renderToString` in unit tests, like AnalyticsSectionError.
 *
 * @param {Object}   props
 * @param {string}   [props.area='dashboard'] Page area, used for the test ids (e.g. 'dashboard', 'analytics').
 * @param {Function} [props.onRetry]          Re-runs the failed request; omit to hide "Try again".
 * @param {boolean}  [props.checking]         A retry is in flight.
 * @param {?Date}    [props.lastChecked]      When the last request failed.
 * @param {string}   [props.errorCode]        Code to quote to support (errorType or HTTP status).
 * @return {JSX.Element} The error card over a faded outline of the page.
 */
const AnalyticsUnavailableNotice = ( {
	area = 'dashboard',
	onRetry,
	checking = false,
	lastChecked = null,
	errorCode = '',
} ) => {
	const titleId = `godam-${ area }-analytics-unavailable-title`;

	return (
		<div className="godam-analytics-unavailable" data-test-id={ `godam-${ area }-notice-analytics-unavailable` }>
			<PageOutline area={ area } />
			<div className="godam-analytics-unavailable__overlay">
				<section className="godam-analytics-unavailable__card" aria-labelledby={ titleId }>
					<UnavailableIllustration />

					{ /* Only the message is a live region, so "Try again" / "Checking…" don't re-announce the card. */ }
					<div className="godam-analytics-unavailable__text" role="alert">
						<h2 id={ titleId } className="godam-analytics-unavailable__title">
							{ __( 'Analytics are temporarily unavailable', 'godam' ) }
						</h2>
						<p className="godam-analytics-unavailable__message">
							{ __( 'We can’t connect to GoDAM Analytics right now, but your videos are playing normally. This is usually temporary. Try again in a moment.', 'godam' ) }
						</p>
					</div>

					<div className="godam-analytics-unavailable__actions">
						{ onRetry && (
							<button
								type="button"
								className="godam-analytics-unavailable__retry"
								// aria-disabled, not disabled, so keyboard focus stays on the button.
								onClick={ checking ? undefined : onRetry }
								aria-disabled={ checking }
								data-test-id={ `godam-${ area }-button-analytics-retry` }
							>
								<Icon icon={ update } size={ 18 } className={ checking ? 'is-spinning' : '' } />
								<span>{ checking ? __( 'Checking…', 'godam' ) : __( 'Try again', 'godam' ) }</span>
							</button>
						) }
						<ContactSupportLink variant="button" testId={ `godam-${ area }-link-contact-support` } />
					</div>

					{ ( lastChecked || errorCode ) && (
						<p className="godam-analytics-unavailable__meta">
							{ lastChecked && (
								<span>
									{ sprintf(
									/* translators: %s: time of the last failed request, e.g. 12:19:05 PM. */
										__( 'Last checked %s', 'godam' ),
										lastChecked.toLocaleTimeString( [], { hour: 'numeric', minute: '2-digit', second: '2-digit' } ),
									) }
								</span>
							) }
							{ errorCode && (
								<span>
									{ __( 'Error code:', 'godam' ) } <code>{ errorCode }</code>
								</span>
							) }
						</p>
					) }
				</section>
			</div>
		</div>
	);
};

export default AnalyticsUnavailableNotice;
